const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Keep in sync with src/constants/services.js in the Expo app.
const SERVICE_DURATIONS = [30, 50, 60, 90];
const BUFFER_MINUTES = 30;

// Single write path for reservations, called by both the public booking
// form (unauthenticated) and the therapist's manual-entry screen
// (authenticated). Unauthenticated calls get the 30-minute buffer between
// bookings; authenticated (therapist) calls only block literal overlaps,
// since the therapist may reasonably want to book back-to-back.
exports.createReservation = onCall(async (request) => {
  const data = request.data || {};

  const clientName = String(data.clientName || '').trim();
  const phone = String(data.phone || '').trim();
  const email = String(data.email || '').trim();
  const address = String(data.address || '').trim();
  const service = String(data.service || '').trim();
  const durationMinutes = Number(data.durationMinutes);
  const notes = String(data.notes || '').trim();

  if (!clientName) {
    throw new HttpsError('invalid-argument', 'El nombre del cliente es obligatorio.');
  }
  if (!address) {
    throw new HttpsError('invalid-argument', 'La dirección es obligatoria.');
  }
  // Email is required for the public form (reminders need it), optional
  // when the therapist books manually — she may not always collect it.
  if (!request.auth && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Ingresa un correo válido para tu recordatorio.');
  }
  if (!SERVICE_DURATIONS.includes(durationMinutes)) {
    throw new HttpsError(
      'invalid-argument',
      `La duración debe ser una de: ${SERVICE_DURATIONS.join(', ')} minutos.`
    );
  }

  const startDate = new Date(data.date);
  if (Number.isNaN(startDate.getTime())) {
    throw new HttpsError('invalid-argument', 'La fecha/hora no es válida.');
  }
  if (startDate.getTime() <= Date.now()) {
    throw new HttpsError('invalid-argument', 'La fecha debe ser en el futuro.');
  }

  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sameDaySnapshot = await db
    .collection('reservations')
    .where('date', '>=', Timestamp.fromDate(dayStart))
    .where('date', '<', Timestamp.fromDate(dayEnd))
    .get();

  const bufferMs = (request.auth ? 0 : BUFFER_MINUTES) * 60000;
  const rangeStart = startDate.getTime() - bufferMs;
  const rangeEnd = endDate.getTime() + bufferMs;

  const overlaps = sameDaySnapshot.docs.some((doc) => {
    const existing = doc.data();
    const existingStart = existing.date.toDate().getTime();
    const existingEnd = existingStart + existing.durationMinutes * 60000;
    return rangeStart < existingEnd && existingStart < rangeEnd;
  });

  if (overlaps) {
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
    service: service || 'Masaje',
    durationMinutes,
    date: Timestamp.fromDate(startDate),
    notes,
    createdAt: Timestamp.now(),
    reminderSent: false,
  });

  return { id: docRef.id };
});
