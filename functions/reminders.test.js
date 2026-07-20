const {
  REMINDER_DAYS_BEFORE,
  getReminderQueryWindow,
  isReminderCandidate,
  buildReminderEmail,
} = require('./reminders');

function buildReservation(overrides = {}) {
  return {
    clientName: 'María López',
    email: 'maria@example.com',
    service: 'Masaje relajante',
    durationMinutes: 60,
    price: 60,
    address: 'Calle Falsa 123',
    date: new Date('2026-07-22T10:00:00.000Z'),
    reminderSent: false,
    ...overrides,
  };
}

describe('REMINDER_DAYS_BEFORE', () => {
  it('is 2 days', () => {
    expect(REMINDER_DAYS_BEFORE).toBe(2);
  });
});

describe('getReminderQueryWindow', () => {
  it('targets the local calendar date exactly 2 days from now', () => {
    // 10:00 UTC on the 20th is 11:00 local (WEST, UTC+1) on the 20th.
    const now = new Date('2026-07-20T10:00:00.000Z');
    const { targetDateKey } = getReminderQueryWindow(now);
    expect(targetDateKey).toBe('2026-07-22');
  });

  it('produces a query window that fully contains the target local day', () => {
    const now = new Date('2026-07-20T10:00:00.000Z');
    const { targetDateKey, queryStart, queryEnd } = getReminderQueryWindow(now);

    // The target day's local midnight and last instant, both in WEST (UTC+1).
    const localDayStart = new Date(`${targetDateKey}T00:00:00+01:00`);
    const localDayEnd = new Date(`${targetDateKey}T23:59:59+01:00`);

    expect(queryStart.getTime()).toBeLessThan(localDayStart.getTime());
    expect(queryEnd.getTime()).toBeGreaterThan(localDayEnd.getTime());
  });

  it('handles the winter (WET, UTC+0) offset too', () => {
    const now = new Date('2026-01-20T10:00:00.000Z');
    const { targetDateKey, queryStart, queryEnd } = getReminderQueryWindow(now);
    expect(targetDateKey).toBe('2026-01-22');

    const localDayStart = new Date(`${targetDateKey}T00:00:00+00:00`);
    const localDayEnd = new Date(`${targetDateKey}T23:59:59+00:00`);
    expect(queryStart.getTime()).toBeLessThan(localDayStart.getTime());
    expect(queryEnd.getTime()).toBeGreaterThan(localDayEnd.getTime());
  });
});

describe('isReminderCandidate', () => {
  const targetDateKey = '2026-07-22';

  it('is true for a matching, unreminded reservation with an email', () => {
    expect(isReminderCandidate(buildReservation(), targetDateKey)).toBe(true);
  });

  it('is false when there is no email (therapist manual entry may omit it)', () => {
    expect(isReminderCandidate(buildReservation({ email: '' }), targetDateKey)).toBe(false);
  });

  it('is false when the reminder was already sent', () => {
    expect(isReminderCandidate(buildReservation({ reminderSent: true }), targetDateKey)).toBe(
      false
    );
  });

  it('is false when the reservation is not on the target date', () => {
    const reservation = buildReservation({ date: new Date('2026-07-25T10:00:00.000Z') });
    expect(isReminderCandidate(reservation, targetDateKey)).toBe(false);
  });
});

describe('buildReminderEmail', () => {
  it('includes the client name, service, date/time, address and price', () => {
    const { subject, html, text } = buildReminderEmail(buildReservation());

    expect(subject).toContain('Masaje relajante');
    for (const content of [html, text]) {
      expect(content).toContain('María López');
      expect(content).toContain('Masaje relajante');
      expect(content).toContain('60 min');
      expect(content).toContain('Calle Falsa 123');
      expect(content).toContain('€60');
    }
  });

  it('omits the price line when price is not a number', () => {
    const { html, text } = buildReminderEmail(buildReservation({ price: null }));
    expect(html).not.toContain('Precio');
    expect(text).not.toContain('Precio');
  });
});
