// Pure validation/overlap logic for createReservation, kept free of any
// Firestore or firebase-functions dependency so it can be unit tested
// without mocking the Admin SDK.
const SERVICE_DURATIONS = [30, 50, 60, 90];
const BUFFER_MINUTES = 30;
const QUERY_MARGIN_HOURS = 4;

class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Duration/name/price are no longer trusted from the client — they come
// from the services catalog (see applyService) so a client can't tamper
// with pricing or duration by editing the request payload.
function parseReservation(data, { authenticated }) {
  const clientName = String(data.clientName || '').trim();
  const phone = String(data.phone || '').trim();
  const email = String(data.email || '').trim();
  const address = String(data.address || '').trim();
  const serviceId = String(data.serviceId || '').trim();
  const notes = String(data.notes || '').trim();

  if (!clientName) {
    throw new ValidationError('invalid-argument', 'El nombre del cliente es obligatorio.');
  }
  if (!address) {
    throw new ValidationError('invalid-argument', 'La dirección es obligatoria.');
  }
  // Email is required for the public form (reminders need it), optional
  // when the therapist books manually — she may not always collect it.
  if (!authenticated && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('invalid-argument', 'Ingresa un correo válido para tu recordatorio.');
  }
  if (!serviceId) {
    throw new ValidationError('invalid-argument', 'Selecciona un tipo de masaje.');
  }

  const startDate = new Date(data.date);
  if (Number.isNaN(startDate.getTime())) {
    throw new ValidationError('invalid-argument', 'La fecha/hora no es válida.');
  }

  return { clientName, phone, email, address, serviceId, notes, startDate };
}

function assertFutureDate(startDate, now = new Date()) {
  if (startDate.getTime() <= now.getTime()) {
    throw new ValidationError('invalid-argument', 'La fecha debe ser en el futuro.');
  }
}

// serviceData is `snapshot.data()` (or null/undefined if the doc doesn't
// exist) for the requested serviceId — the caller does the Firestore read,
// this function just enforces the business rule on the result. "enabled"
// only gates the public form — it means "clients can pick this", not
// "this massage doesn't exist" — the therapist can still book a disabled
// one herself since she's choosing it directly, not relying on the menu.
function applyService(reservation, serviceData, { authenticated } = {}) {
  if (!serviceData) {
    throw new ValidationError('invalid-argument', 'Ese tipo de masaje ya no existe.');
  }
  if (!authenticated && !serviceData.enabled) {
    throw new ValidationError(
      'failed-precondition',
      'Ese masaje ya no está disponible. Elige otro.'
    );
  }
  return {
    ...reservation,
    service: serviceData.name,
    durationMinutes: serviceData.durationMinutes,
    price: typeof serviceData.price === 'number' ? serviceData.price : null,
  };
}

// Unauthenticated (public form) calls get a 30-min buffer on both sides;
// authenticated (therapist) calls only block literal overlaps. The query
// window is padded further just to fetch candidates from Firestore —
// widened well beyond any buffer/duration combo rather than computed from
// "calendar day" boundaries, which would depend on whose timezone is doing
// the computing.
function getOverlapWindow(startDate, durationMinutes, authenticated) {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const bufferMs = (authenticated ? 0 : BUFFER_MINUTES) * 60000;
  const rangeStart = startDate.getTime() - bufferMs;
  const rangeEnd = endDate.getTime() + bufferMs;
  const marginMs = QUERY_MARGIN_HOURS * 60 * 60000;

  return {
    endDate,
    rangeStart,
    rangeEnd,
    queryStart: new Date(rangeStart - marginMs),
    queryEnd: new Date(rangeEnd + marginMs),
  };
}

function hasOverlap(rangeStart, rangeEnd, existingReservations) {
  return existingReservations.some(({ start, end }) => rangeStart < end && start < rangeEnd);
}

module.exports = {
  SERVICE_DURATIONS,
  BUFFER_MINUTES,
  QUERY_MARGIN_HOURS,
  ValidationError,
  parseReservation,
  assertFutureDate,
  applyService,
  getOverlapWindow,
  hasOverlap,
};