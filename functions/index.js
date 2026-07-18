const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const {
  ValidationError,
  parseReservation,
  assertFutureDate,
  assertWithinBusinessHours,
  applyService,
  getOverlapWindow,
  hasOverlap,
} = require('./validation');

initializeApp();
const db = getFirestore();

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