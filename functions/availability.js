// Pure logic for the public booking calendar: which start times a client
// can pick for a given massage. Built only from validation.js's predicates
// (business hours, blocks, 30-min buffer) so the calendar can never offer
// a slot createReservation would then reject. Kept free of Firestore so
// it's unit testable, same pattern as validation.js.
const {
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  getLocalDateKey,
  getLocalMinutesOfDay,
  isWithinBusinessHours,
  isBlocked,
  getOverlapWindow,
  hasOverlap,
} = require('./validation');

const SLOT_STEP_MINUTES = 30;
const BOOKING_WINDOW_DAYS = 30;

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" + minutes since local midnight in the Canary Islands → the
// real instant. The zone is always UTC+0 (WET) or UTC+1 (WEST), so try
// both offsets and keep the one that maps back to the same local time.
// Returns null for a local time skipped by a DST jump (never in business
// hours, but handled anyway).
function canaryLocalToDate(dateKey, minutesOfDay) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const asUtc = Date.UTC(year, month - 1, day, 0, minutesOfDay);
  for (const offsetMinutes of [0, 60]) {
    const candidate = new Date(asUtc - offsetMinutes * 60000);
    if (
      getLocalDateKey(candidate) === dateKey &&
      getLocalMinutesOfDay(candidate) === minutesOfDay
    ) {
      return candidate;
    }
  }
  return null;
}

// Days the public form can book: from tomorrow (no same-day bookings, see
// assertNotSameDay) up to BOOKING_WINDOW_DAYS ahead, in Canary local days.
function getBookableDateKeys(now = new Date(), days = BOOKING_WINDOW_DAYS) {
  const todayKey = getLocalDateKey(now);
  return Array.from({ length: days }, (_, index) => addDaysToDateKey(todayKey, index + 1));
}

// Over-fetch window for the reservations query: a full UTC day of margin
// on each side covers any offset/buffer, then computeDaySlots filters
// precisely — same over-fetch-then-filter pattern as getOverlapWindow.
function getAvailabilityQueryWindow(dateKeys) {
  const dayMs = 24 * 60 * 60000;
  return {
    queryStart: new Date(Date.parse(`${dateKeys[0]}T00:00:00Z`) - dayMs),
    queryEnd: new Date(Date.parse(`${dateKeys[dateKeys.length - 1]}T00:00:00Z`) + 2 * dayMs),
  };
}

function formatMinutes(minutes) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// existingReservations: [{ start, end }] in ms, as hasOverlap expects.
// Pending reservations count too — they hold their slot until reviewed.
function computeDaySlots(dateKey, durationMinutes, existingReservations, blocksForDay) {
  const slots = [];
  for (
    let minutes = BUSINESS_HOURS_START * 60;
    minutes + durationMinutes <= BUSINESS_HOURS_END * 60;
    minutes += SLOT_STEP_MINUTES
  ) {
    const start = canaryLocalToDate(dateKey, minutes);
    if (!start) continue;
    if (!isWithinBusinessHours(start, durationMinutes)) continue;
    if (isBlocked(start, durationMinutes, blocksForDay)) continue;
    const { rangeStart, rangeEnd } = getOverlapWindow(start, durationMinutes, false);
    if (hasOverlap(rangeStart, rangeEnd, existingReservations)) continue;
    slots.push({ time: formatMinutes(minutes), start: start.toISOString() });
  }
  return slots;
}

function computeAvailability({ dateKeys, durationMinutes, existingReservations, blocks }) {
  return dateKeys.map((dateKey) => ({
    dateKey,
    slots: computeDaySlots(
      dateKey,
      durationMinutes,
      existingReservations,
      blocks.filter((block) => block.date === dateKey)
    ),
  }));
}

module.exports = {
  SLOT_STEP_MINUTES,
  BOOKING_WINDOW_DAYS,
  canaryLocalToDate,
  getBookableDateKeys,
  getAvailabilityQueryWindow,
  computeDaySlots,
  computeAvailability,
};
