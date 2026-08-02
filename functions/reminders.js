// Pure logic for the "2 days before" email reminder, kept free of Firestore
// / nodemailer dependencies so it's unit testable, same pattern as
// validation.js.
const { getLocalDateKey } = require('./validation');

const REMINDER_DAYS_BEFORE = 2;
// Wide enough to cover a full Canary Islands local calendar day regardless
// of which side of the WET/WEST DST boundary it falls on, then callers
// filter precisely with isReminderCandidate — same over-fetch-then-filter
// pattern as getOverlapWindow in validation.js.
const QUERY_MARGIN_HOURS = 36;

// Returns the Firestore query window that's guaranteed to contain every
// reservation whose local calendar date is exactly REMINDER_DAYS_BEFORE
// days from now.
function getReminderQueryWindow(now = new Date()) {
  const targetInstant = new Date(now.getTime() + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const targetDateKey = getLocalDateKey(targetInstant);
  // Midday UTC on the target date is safely inside that local day no
  // matter the DST offset (Canary is always UTC+0 or UTC+1).
  const anchor = new Date(`${targetDateKey}T12:00:00Z`);
  const marginMs = QUERY_MARGIN_HOURS * 60 * 60000;

  return {
    targetDateKey,
    queryStart: new Date(anchor.getTime() - marginMs),
    queryEnd: new Date(anchor.getTime() + marginMs),
  };
}

function isReminderCandidate(reservation, targetDateKey) {
  if (!reservation.email) return false;
  if (reservation.reminderSent) return false;
  return getLocalDateKey(reservation.date) === targetDateKey;
}

const emailDateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Atlantic/Canary',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const emailTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Atlantic/Canary',
  hour: '2-digit',
  minute: '2-digit',
});

function buildReminderEmail(reservation) {
  const dateLabel = emailDateFormatter.format(reservation.date);
  const timeLabel = emailTimeFormatter.format(reservation.date);
  const priceLine =
    typeof reservation.price === 'number' ? `<p>Precio: €${reservation.price}</p>` : '';

  const subject = `Recordatorio: tu ${reservation.service} es en 2 días`;

  const html = `
    <p>Hola ${reservation.clientName},</p>
    <p>Te recordamos tu cita de <strong>${reservation.service}</strong> (${reservation.durationMinutes} min):</p>
    <p><strong>${dateLabel}, ${timeLabel}</strong></p>
    <p>Dirección: ${reservation.address}</p>
    ${priceLine}
    <p>Si necesitas cambiar o cancelar la cita, responde a este correo.</p>
    <p>¡Nos vemos pronto!</p>
  `.trim();

  const text = [
    `Hola ${reservation.clientName},`,
    `Te recordamos tu cita de ${reservation.service} (${reservation.durationMinutes} min):`,
    `${dateLabel}, ${timeLabel}`,
    `Dirección: ${reservation.address}`,
    typeof reservation.price === 'number' ? `Precio: €${reservation.price}` : null,
    'Si necesitas cambiar o cancelar la cita, responde a este correo.',
    '¡Nos vemos pronto!',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

module.exports = {
  REMINDER_DAYS_BEFORE,
  QUERY_MARGIN_HOURS,
  getReminderQueryWindow,
  isReminderCandidate,
  buildReminderEmail,
};
