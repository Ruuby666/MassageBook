// Pure logic for the client's email reminder, kept free of Firestore /
// nodemailer dependencies so it's unit testable, same pattern as
// validation.js. sendReminders runs hourly during the day and reminds
// every confirmed appointment coming up in the next REMINDER_WINDOW_HOURS
// — not only those exactly 2 days away, so short-notice bookings and ones
// confirmed late still get their reminder.
const { escapeHtml } = require('./html');

const REMINDER_WINDOW_HOURS = 48;
// Skip bookings made in the last few hours: the client just booked (and,
// for web bookings, gets a confirmation email), so a reminder right after
// would be noise. They're picked up on a later run instead.
const RECENT_BOOKING_HOURS = 12;

function getReminderQueryWindow(now = new Date()) {
  return {
    queryStart: now,
    queryEnd: new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60000),
  };
}

// Pending (unconfirmed) bookings are skipped — a reminder would be
// misleading if the therapist may still reject it. Older docs without a
// status predate the review flow and count as confirmed.
function isReminderCandidate(reservation, now = new Date()) {
  if (!reservation.email) return false;
  if (reservation.reminderSent) return false;
  if (reservation.status === 'pending') return false;
  const { queryStart, queryEnd } = getReminderQueryWindow(now);
  const start = reservation.date.getTime();
  if (start <= queryStart.getTime() || start > queryEnd.getTime()) return false;
  const recentCutoff = now.getTime() - RECENT_BOOKING_HOURS * 60 * 60000;
  return !reservation.createdAt || reservation.createdAt.getTime() <= recentCutoff;
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

  const subject = `Recordatorio: tu ${reservation.service} el ${dateLabel} a las ${timeLabel}`;

  const html = `
    <p>Hola ${escapeHtml(reservation.clientName)},</p>
    <p>Te recordamos tu cita de <strong>${escapeHtml(reservation.service)}</strong> (${reservation.durationMinutes} min):</p>
    <p><strong>${dateLabel}, ${timeLabel}</strong></p>
    <p>Dirección: ${escapeHtml(reservation.address)}</p>
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
  REMINDER_WINDOW_HOURS,
  RECENT_BOOKING_HOURS,
  getReminderQueryWindow,
  isReminderCandidate,
  buildReminderEmail,
};
