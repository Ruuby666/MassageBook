// Pure logic for the therapist's scheduled push alerts (notifyTherapist in
// index.js): pending bookings left unreviewed, and a heads-up before each
// appointment. Kept free of Firestore so it's unit testable, same pattern
// as reminders.js. Reservations here have `date`/`createdAt` as Dates.
const { getLocalMinutesOfDay } = require('./validation');

// A pending booking gets one nudge once it's been waiting this long.
const PENDING_REMINDER_HOURS = 2;
// Pending nudges only go out during the day (Canary local time) — a
// booking made at 23:00 is nudged the next morning, not at 01:00.
const NUDGE_HOURS_START = 9;
const NUDGE_HOURS_END = 21;
// The before-appointment alert fires once the appointment is this close.
// notifyTherapist runs every 15 minutes, so it lands 45–60 minutes before.
const UPCOMING_LEAD_MINUTES = 60;

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Atlantic/Canary',
  hour: '2-digit',
  minute: '2-digit',
});

const dayTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Atlantic/Canary',
  weekday: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function isWithinNudgeHours(now = new Date()) {
  const minutes = getLocalMinutesOfDay(now);
  return minutes >= NUDGE_HOURS_START * 60 && minutes < NUDGE_HOURS_END * 60;
}

// Still pending, waiting long enough, not nudged yet, and not already in
// the past (a missed pending booking is no longer actionable).
function selectPendingToNudge(reservations, now = new Date()) {
  const cutoff = now.getTime() - PENDING_REMINDER_HOURS * 60 * 60000;
  return reservations
    .filter(
      (reservation) =>
        reservation.status === 'pending' &&
        !reservation.pendingReminderSent &&
        reservation.createdAt &&
        reservation.createdAt.getTime() <= cutoff &&
        reservation.date.getTime() > now.getTime()
    )
    .sort((a, b) => a.date - b.date);
}

// One push for all of them, so several waiting bookings don't buzz the
// phone several times. Tapping it opens the soonest one's day.
function buildPendingNudgePush(pending) {
  const first = pending[0];
  const title =
    pending.length === 1 ? 'Reserva sin revisar' : `${pending.length} reservas sin revisar`;
  const list = pending
    .map((reservation) => `${reservation.clientName} (${dayTimeFormatter.format(reservation.date)})`)
    .join(', ');
  return {
    title,
    body: `Pendiente de confirmar: ${list}`,
    data: { reservationId: first.id, date: first.date.toISOString() },
  };
}

// Confirmed (or legacy, no status) appointments starting within the lead
// window that haven't had their heads-up yet. Pending ones are covered by
// the pending nudge instead.
function selectUpcoming(reservations, now = new Date()) {
  const horizon = now.getTime() + UPCOMING_LEAD_MINUTES * 60000;
  return reservations.filter(
    (reservation) =>
      reservation.status !== 'pending' &&
      !reservation.therapistReminderSent &&
      reservation.date.getTime() > now.getTime() &&
      reservation.date.getTime() <= horizon
  );
}

// Unlike the new-booking push, this one shows the address: it's the
// therapist's own phone and where to go next is the whole point.
function buildUpcomingPush(reservation) {
  return {
    title: `Próxima cita a las ${timeFormatter.format(reservation.date)}`,
    body: `${reservation.clientName} · ${reservation.service}\n${reservation.address}`,
    data: { reservationId: reservation.id, date: reservation.date.toISOString() },
  };
}

module.exports = {
  PENDING_REMINDER_HOURS,
  NUDGE_HOURS_START,
  NUDGE_HOURS_END,
  UPCOMING_LEAD_MINUTES,
  isWithinNudgeHours,
  selectPendingToNudge,
  buildPendingNudgePush,
  selectUpcoming,
  buildUpcomingPush,
};
