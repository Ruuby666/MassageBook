const {
  BOOKING_WINDOW_DAYS,
  canaryLocalToDate,
  getBookableDateKeys,
  getAvailabilityQueryWindow,
  computeDaySlots,
  computeAvailability,
} = require('./availability');

// 22 July 2026 is summer time in the Canary Islands (WEST, UTC+1).
const SUMMER_DAY = '2026-07-22';

function reservationAt(isoStart, durationMinutes) {
  const start = Date.parse(isoStart);
  return { start, end: start + durationMinutes * 60000 };
}

function times(slots) {
  return slots.map((slot) => slot.time);
}

describe('canaryLocalToDate', () => {
  it('applies the summer offset (UTC+1)', () => {
    expect(canaryLocalToDate(SUMMER_DAY, 10 * 60).toISOString()).toBe('2026-07-22T09:00:00.000Z');
  });

  it('applies the winter offset (UTC+0)', () => {
    expect(canaryLocalToDate('2026-01-15', 10 * 60).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });
});

describe('getBookableDateKeys', () => {
  it('starts tomorrow (no same-day bookings) and spans the booking window', () => {
    const keys = getBookableDateKeys(new Date('2026-07-20T12:00:00.000Z'));
    expect(keys[0]).toBe('2026-07-21');
    expect(keys).toHaveLength(BOOKING_WINDOW_DAYS);
  });

  it('uses the Canary local day: 00:30 local on the 21st → first bookable is the 22nd', () => {
    const keys = getBookableDateKeys(new Date('2026-07-20T23:30:00.000Z'));
    expect(keys[0]).toBe('2026-07-22');
  });

  it('crosses month boundaries', () => {
    const keys = getBookableDateKeys(new Date('2026-07-30T12:00:00.000Z'), 3);
    expect(keys).toEqual(['2026-07-31', '2026-08-01', '2026-08-02']);
  });
});

describe('getAvailabilityQueryWindow', () => {
  it('fully contains every bookable local day', () => {
    const { queryStart, queryEnd } = getAvailabilityQueryWindow(['2026-07-21', '2026-07-22']);
    expect(queryStart.getTime()).toBeLessThanOrEqual(canaryLocalToDate('2026-07-21', 0).getTime());
    expect(queryEnd.getTime()).toBeGreaterThan(canaryLocalToDate('2026-07-22', 23 * 60 + 59).getTime());
  });
});

describe('computeDaySlots', () => {
  it('offers every 30 minutes from 8:00 so the massage ends by 21:00', () => {
    const slots = times(computeDaySlots(SUMMER_DAY, 60, [], []));
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('20:00');
    expect(slots).toHaveLength(25);
  });

  it('shortens the last slot for longer massages', () => {
    const slots = times(computeDaySlots(SUMMER_DAY, 90, [], []));
    expect(slots[slots.length - 1]).toBe('19:30');
  });

  it('returns the real instant to send to createReservation', () => {
    const [first] = computeDaySlots(SUMMER_DAY, 60, [], []);
    expect(first).toEqual({ time: '08:00', start: '2026-07-22T07:00:00.000Z' });
  });

  it('keeps the 30-minute buffer around existing reservations', () => {
    // Existing 10:00–11:00 local (09:00–10:00Z).
    const existing = [reservationAt('2026-07-22T09:00:00.000Z', 60)];
    const slots = times(computeDaySlots(SUMMER_DAY, 60, existing, []));

    expect(slots).toContain('08:30'); // ends 9:30, buffer until 10:00 — ok
    expect(slots).toContain('11:30'); // starts 30 min after it ends — ok
    for (const busy of ['09:00', '09:30', '10:00', '10:30', '11:00']) {
      expect(slots).not.toContain(busy);
    }
  });

  it('has no slots on an all-day block', () => {
    expect(computeDaySlots(SUMMER_DAY, 60, [], [{ allDay: true }])).toEqual([]);
  });

  it('skips slots overlapping a partial block', () => {
    const block = { allDay: false, startTime: '14:00', endTime: '16:00' };
    const slots = times(computeDaySlots(SUMMER_DAY, 60, [], [block]));

    expect(slots).toContain('13:00'); // ends exactly when the block starts
    expect(slots).toContain('16:00');
    for (const blocked of ['13:30', '14:00', '15:30']) {
      expect(slots).not.toContain(blocked);
    }
  });
});

describe('computeAvailability', () => {
  it('applies each block only to its own day', () => {
    const days = computeAvailability({
      dateKeys: ['2026-07-21', SUMMER_DAY],
      durationMinutes: 60,
      existingReservations: [],
      blocks: [{ date: SUMMER_DAY, allDay: true }],
    });

    expect(days[0].dateKey).toBe('2026-07-21');
    expect(days[0].slots.length).toBeGreaterThan(0);
    expect(days[1]).toEqual({ dateKey: SUMMER_DAY, slots: [] });
  });
});
