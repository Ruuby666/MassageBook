// Pure logic for the confirmation/rejection emails sent when the therapist
// reviews a pending reservation, kept free of Firestore/nodemailer
// dependencies so it's unit testable, same pattern as reminders.js.

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

function buildConfirmationEmail(reservation) {
  const dateLabel = emailDateFormatter.format(reservation.date);
  const timeLabel = emailTimeFormatter.format(reservation.date);
  const priceLine =
    typeof reservation.price === 'number' ? `<p>Precio: €${reservation.price}</p>` : '';

  const subject = 'Tu reserva fue confirmada';

  const html = `
    <p>Hola ${reservation.clientName},</p>
    <p>Tu cita de <strong>${reservation.service}</strong> (${reservation.durationMinutes} min) quedó confirmada:</p>
    <p><strong>${dateLabel}, ${timeLabel}</strong></p>
    <p>Dirección: ${reservation.address}</p>
    ${priceLine}
    <p>¡Gracias por confiar en nosotros!</p>
  `.trim();

  const text = [
    `Hola ${reservation.clientName},`,
    `Tu cita de ${reservation.service} (${reservation.durationMinutes} min) quedó confirmada:`,
    `${dateLabel}, ${timeLabel}`,
    `Dirección: ${reservation.address}`,
    typeof reservation.price === 'number' ? `Precio: €${reservation.price}` : null,
    '¡Gracias por confiar en nosotros!',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

function buildRejectionEmail(reservation) {
  const dateLabel = emailDateFormatter.format(reservation.date);
  const timeLabel = emailTimeFormatter.format(reservation.date);

  const subject = 'No pudimos confirmar tu horario';

  const html = `
    <p>Hola ${reservation.clientName},</p>
    <p>Lamentablemente no pudimos confirmar tu reserva del <strong>${dateLabel}, ${timeLabel}</strong>.</p>
    <p>Contáctanos para reagendar en otro horario. ¡Gracias por tu comprensión!</p>
  `.trim();

  const text = [
    `Hola ${reservation.clientName},`,
    `Lamentablemente no pudimos confirmar tu reserva del ${dateLabel}, ${timeLabel}.`,
    'Contáctanos para reagendar en otro horario. ¡Gracias por tu comprensión!',
  ].join('\n');

  return { subject, html, text };
}

// Sent when the therapist moves an existing reservation from the app, so
// the client doesn't show up (or wait at home) at the old time.
function buildRescheduleEmail(reservation, previousDate) {
  const oldLabel = `${emailDateFormatter.format(previousDate)}, ${emailTimeFormatter.format(previousDate)}`;
  const newLabel = `${emailDateFormatter.format(reservation.date)}, ${emailTimeFormatter.format(reservation.date)}`;

  const subject = 'Tu cita ha cambiado de horario';

  const html = `
    <p>Hola ${reservation.clientName},</p>
    <p>Tu cita de <strong>${reservation.service}</strong> (${reservation.durationMinutes} min) ha cambiado de horario:</p>
    <p>Antes: <s>${oldLabel}</s></p>
    <p>Ahora: <strong>${newLabel}</strong></p>
    <p>Dirección: ${reservation.address}</p>
    <p>Si el nuevo horario no te viene bien, responde a este correo.</p>
  `.trim();

  const text = [
    `Hola ${reservation.clientName},`,
    `Tu cita de ${reservation.service} (${reservation.durationMinutes} min) ha cambiado de horario:`,
    `Antes: ${oldLabel}`,
    `Ahora: ${newLabel}`,
    `Dirección: ${reservation.address}`,
    'Si el nuevo horario no te viene bien, responde a este correo.',
  ].join('\n');

  return { subject, html, text };
}

// Sent when the therapist deletes a reservation and chooses to notify the
// client (she may also delete without notifying, e.g. a test booking).
function buildCancellationEmail(reservation) {
  const dateLabel = emailDateFormatter.format(reservation.date);
  const timeLabel = emailTimeFormatter.format(reservation.date);

  const subject = 'Tu cita ha sido cancelada';

  const html = `
    <p>Hola ${reservation.clientName},</p>
    <p>Tu cita de <strong>${reservation.service}</strong> del <strong>${dateLabel}, ${timeLabel}</strong> ha sido cancelada.</p>
    <p>Si quieres reservar otro horario, responde a este correo.</p>
  `.trim();

  const text = [
    `Hola ${reservation.clientName},`,
    `Tu cita de ${reservation.service} del ${dateLabel}, ${timeLabel} ha sido cancelada.`,
    'Si quieres reservar otro horario, responde a este correo.',
  ].join('\n');

  return { subject, html, text };
}

module.exports = {
  buildConfirmationEmail,
  buildRejectionEmail,
  buildRescheduleEmail,
  buildCancellationEmail,
};
