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

module.exports = {
  buildConfirmationEmail,
  buildRejectionEmail,
};
