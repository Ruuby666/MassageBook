const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const nodemailer = require('nodemailer');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const {
  ValidationError,
  parseReservation,
  assertFutureDate,
  assertWithinBusinessHours,
  getLocalDateKey,
  assertNotBlocked,
  applyService,
  getOverlapWindow,
  hasOverlap,
} = require('./validation');
const {
  getReminderQueryWindow,
  isReminderCandidate,
  buildReminderEmail,
} = require('./reminders');

initializeApp();
const db = getFirestore();

const gmailUser = defineSecret('GMAIL_USER');
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');

// Single write path for reservations, called by both the public booking
// form (unauthenticated) and the therapist's manual-entry screen
// (authenticated). See validation.js for the business rules. Duration,
// display name and price always come from the services catalog doc, never
// from the client, so a tampered request can't change pricing/duration.
exports.createReservation = onCall(async (request) => {
  const authenticated = Boolean(request.auth);

  let reservation;
  try {
    reservation = parseReservation(request.data || {}, { authenticated });
    assertFutureDate(reservation.startDate);

    const serviceSnap = await db.collection('services').doc(reservation.serviceId).get();
    reservation = applyService(reservation, serviceSnap.exists ? serviceSnap.data() : null, {
      authenticated,
    });
    assertWithinBusinessHours(reservation.startDate, reservation.durationMinutes, authenticated);

    const dateKey = getLocalDateKey(reservation.startDate);
    const blocksSnapshot = await db.collection('blocks').where('date', '==', dateKey).get();
    const blocksForDay = blocksSnapshot.docs.map((doc) => doc.data());
    assertNotBlocked(reservation.startDate, reservation.durationMinutes, blocksForDay, authenticated);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }

  const { clientName, phone, email, address, serviceId, service, durationMinutes, price, notes, startDate } =
    reservation;
  const { rangeStart, rangeEnd, queryStart, queryEnd } = getOverlapWindow(
    startDate,
    durationMinutes,
    authenticated
  );

  const nearbySnapshot = await db
    .collection('reservations')
    .where('date', '>=', Timestamp.fromDate(queryStart))
    .where('date', '<', Timestamp.fromDate(queryEnd))
    .get();

  const existingReservations = nearbySnapshot.docs.map((doc) => {
    const existing = doc.data();
    const start = existing.date.toDate().getTime();
    return { start, end: start + existing.durationMinutes * 60000 };
  });

  if (hasOverlap(rangeStart, rangeEnd, existingReservations)) {
    throw new HttpsError(
      'failed-precondition',
      'Ese horario ya está ocupado o muy cerca de otra cita. Elige otra hora.'
    );
  }

  const docRef = await db.collection('reservations').add({
    clientName,
    phone,
    email,
    address,
    serviceId,
    service,
    durationMinutes,
    price,
    date: Timestamp.fromDate(startDate),
    notes,
    createdAt: Timestamp.now(),
    reminderSent: false,
  });

  return { id: docRef.id };
});

// Lets the therapist reschedule an existing reservation's date/time from
// the app. Authenticated only — the public form never edits a booking, it
// only creates new ones. Reuses the same overlap logic as createReservation
// (buffer-free, since this is always an authenticated call), just excluding
// the reservation's own current slot from the conflict check. Resets
// reminderSent so sendReminders re-evaluates against the new date.
exports.updateReservationTime = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Solo la terapeuta puede editar citas.');
  }

  const reservationId = String(request.data?.reservationId || '').trim();
  if (!reservationId) {
    throw new HttpsError('invalid-argument', 'Falta el id de la reserva.');
  }

  const startDate = new Date(request.data?.date);
  if (Number.isNaN(startDate.getTime())) {
    throw new HttpsError('invalid-argument', 'La fecha/hora no es válida.');
  }

  try {
    assertFutureDate(startDate);
  } catch (error) {
    throw new HttpsError(error.code, error.message);
  }

  const reservationRef = db.collection('reservations').doc(reservationId);
  const reservationSnap = await reservationRef.get();
  if (!reservationSnap.exists) {
    throw new HttpsError('not-found', 'Esa reserva ya no existe.');
  }
  const { durationMinutes } = reservationSnap.data();

  const { rangeStart, rangeEnd, queryStart, queryEnd } = getOverlapWindow(
    startDate,
    durationMinutes,
    true
  );

  const nearbySnapshot = await db
    .collection('reservations')
    .where('date', '>=', Timestamp.fromDate(queryStart))
    .where('date', '<', Timestamp.fromDate(queryEnd))
    .get();

  const existingReservations = nearbySnapshot.docs
    .filter((doc) => doc.id !== reservationId)
    .map((doc) => {
      const existing = doc.data();
      const start = existing.date.toDate().getTime();
      return { start, end: start + existing.durationMinutes * 60000 };
    });

  if (hasOverlap(rangeStart, rangeEnd, existingReservations)) {
    throw new HttpsError(
      'failed-precondition',
      'Ese horario ya está ocupado o muy cerca de otra cita. Elige otra hora.'
    );
  }

  await reservationRef.update({ date: Timestamp.fromDate(startDate), reminderSent: false });

  return { id: reservationId };
});

// Daily at 10:00 Canary Islands time — emails clients whose reservation is
// exactly 2 days away and hasn't already been reminded. Failures for one
// reservation don't block the rest of the batch.
exports.sendReminders = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'Atlantic/Canary', secrets: [gmailUser, gmailAppPassword] },
  async () => {
    const { targetDateKey, queryStart, queryEnd } = getReminderQueryWindow();

    const snapshot = await db
      .collection('reservations')
      .where('date', '>=', Timestamp.fromDate(queryStart))
      .where('date', '<', Timestamp.fromDate(queryEnd))
      .get();

    const candidates = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), date: doc.data().date.toDate() }))
      .filter((reservation) => isReminderCandidate(reservation, targetDateKey));

    if (candidates.length === 0) {
      logger.info(`No reminders to send for ${targetDateKey}.`);
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser.value(), pass: gmailAppPassword.value() },
    });

    for (const reservation of candidates) {
      const { subject, html, text } = buildReminderEmail(reservation);
      try {
        await transporter.sendMail({
          from: gmailUser.value(),
          to: reservation.email,
          subject,
          html,
          text,
        });
        await db.collection('reservations').doc(reservation.id).update({ reminderSent: true });
      } catch (error) {
        logger.error(`Failed to send reminder for reservation ${reservation.id}:`, error);
      }
    }
  }
);