// Pure validation/overlap logic for createReservation, kept free of any
// Firestore or firebase-functions dependency so it can be unit tested
// without mocking the Admin SDK.
const BUFFER_MINUTES = 30;
const QUERY_MARGIN_HOURS = 4;
// The business operates in the Canary Islands (WET/WEST), which observes
// EU daylight saving — unlike a fixed-offset zone, a hardcoded UTC offset
// would be wrong for half the year, so business hours are computed via
// Intl with the IANA zone instead of manual offset math.
const BUSINESS_TIMEZONE = 'Atlantic/Canary';
const BUSINESS_HOURS_START = 8;
const BUSINESS_HOURS_END = 21;

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

const businessHoursFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function getLocalMinutesOfDay(date) {
  const parts = businessHoursFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour').value);
  const minute = Number(parts.find((part) => part.type === 'minute').value);
  return hour * 60 + minute;
}

// Public form only — the therapist can still book herself outside these
// hours from the app, same exception pattern as the buffer and `enabled`.
// Checks both ends of the appointment so a massage starting before 21:00
// can't run past it.
function assertWithinBusinessHours(startDate, durationMinutes, authenticated) {
  if (authenticated) return;

  const startMinutes = getLocalMinutesOfDay(startDate);
  const endMinutes = startMinutes + durationMinutes;

  if (startMinutes < BUSINESS_HOURS_START * 60 || endMinutes > BUSINESS_HOURS_END * 60) {
    throw new ValidationError(
      'invalid-argument',
      'Solo se puede reservar entre las 8:00 a.m. y las 9:00 p.m.'
    );
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
  BUFFER_MINUTES,
  QUERY_MARGIN_HOURS,
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  ValidationError,
  parseReservation,
  assertFutureDate,
  assertWithinBusinessHours,
  applyService,
  getOverlapWindow,
  hasOverlap,
};