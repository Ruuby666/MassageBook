const {
  isWithinNudgeHours,
  selectPendingToNudge,
  buildPendingNudgePush,
} = require('./therapistAlerts');

// 20 July 2026 12:00 UTC = 13:00 in the Canary Islands (WEST, UTC+1).
const NOW = new Date('2026-07-20T12:00:00.000Z');
const minutes = (n) => n * 60000;
const hours = (n) => n * 60 * 60000;

function reservation(overrides = {}) {
  return {
    id: 'r1',
    clientName: 'María López',
    service: 'Masaje relajante',
    address: 'Calle Triana 12',
    phone: '600123456',
    status: 'pending',
    createdAt: new Date(NOW.getTime() - hours(3)),
    date: new Date(NOW.getTime() + hours(24)),
    ...overrides,
  };
}

describe('isWithinNudgeHours', () => {
  it('is true during the day (Canary local time)', () => {
    expect(isWithinNudgeHours(NOW)).toBe(true); // 13:00 local
  });

  it('is false at night', () => {
    expect(isWithinNudgeHours(new Date('2026-07-20T23:30:00.000Z'))).toBe(false); // 00:30 local
    expect(isWithinNudgeHours(new Date('2026-07-20T07:30:00.000Z'))).toBe(false); // 08:30 local
  });

  it('starts at 9:00 and stops at 21:00 local', () => {
    expect(isWithinNudgeHours(new Date('2026-07-20T08:00:00.000Z'))).toBe(true); // 09:00
    expect(isWithinNudgeHours(new Date('2026-07-20T20:00:00.000Z'))).toBe(false); // 21:00
  });
});

describe('selectPendingToNudge', () => {
  it('picks a pending booking waiting over 2 hours', () => {
    expect(selectPendingToNudge([reservation()], NOW)).toHaveLength(1);
  });

  it('waits until the booking has been pending for 2 hours', () => {
    const fresh = reservation({ createdAt: new Date(NOW.getTime() - minutes(90)) });
    expect(selectPendingToNudge([fresh], NOW)).toEqual([]);
  });

  it('nudges only once', () => {
    expect(selectPendingToNudge([reservation({ pendingReminderSent: true })], NOW)).toEqual([]);
  });

  it('ignores confirmed bookings and pending ones already in the past', () => {
    const confirmed = reservation({ status: 'confirmed' });
    const past = reservation({ date: new Date(NOW.getTime() - hours(1)) });
    expect(selectPendingToNudge([confirmed, past], NOW)).toEqual([]);
  });

  it('sorts by appointment date, soonest first', () => {
    const later = reservation({ id: 'later', date: new Date(NOW.getTime() + hours(48)) });
    const sooner = reservation({ id: 'sooner', date: new Date(NOW.getTime() + hours(5)) });
    expect(selectPendingToNudge([later, sooner], NOW).map((r) => r.id)).toEqual(['sooner', 'later']);
  });
});

describe('buildPendingNudgePush', () => {
  it('uses a singular title for one booking and opens its day', () => {
    const r = reservation();
    const push = buildPendingNudgePush([r]);
    expect(push.title).toBe('Reserva sin revisar');
    expect(push.body).toContain('María López');
    expect(push.data).toEqual({ reservationId: 'r1', date: r.date.toISOString() });
  });

  it('groups several bookings into one push', () => {
    const push = buildPendingNudgePush([
      reservation({ id: 'a', clientName: 'Carlos' }),
      reservation({ id: 'b', clientName: 'Lucía' }),
    ]);
    expect(push.title).toBe('2 reservas sin revisar');
    expect(push.body).toContain('Carlos');
    expect(push.body).toContain('Lucía');
    expect(push.data.reservationId).toBe('a');
  });

  it('keeps the client phone off the lock screen', () => {
    expect(buildPendingNudgePush([reservation()]).body).not.toContain('600123456');
  });
});
