const {
  REMINDER_WINDOW_HOURS,
  RECENT_BOOKING_HOURS,
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

// 20 July 2026 10:00 UTC = 11:00 in the Canary Islands (WEST, UTC+1).
const NOW = new Date('2026-07-20T10:00:00.000Z');
const hoursFromNow = (h) => new Date(NOW.getTime() + h * 60 * 60000);

describe('getReminderQueryWindow', () => {
  it('covers the next REMINDER_WINDOW_HOURS from now', () => {
    const { queryStart, queryEnd } = getReminderQueryWindow(NOW);
    expect(REMINDER_WINDOW_HOURS).toBe(48);
    expect(queryStart).toEqual(NOW);
    expect(queryEnd).toEqual(hoursFromNow(48));
  });
});

describe('isReminderCandidate', () => {
  // Booked well before, appointment in 30 h: the normal case.
  const candidate = (overrides = {}) =>
    buildReservation({ date: hoursFromNow(30), createdAt: hoursFromNow(-72), ...overrides });

  it('is true for a confirmed, unreminded reservation within the next 48 h', () => {
    expect(isReminderCandidate(candidate(), NOW)).toBe(true);
    expect(isReminderCandidate(candidate({ status: 'confirmed' }), NOW)).toBe(true);
  });

  it('covers short-notice bookings too (appointment in a few hours)', () => {
    expect(isReminderCandidate(candidate({ date: hoursFromNow(3) }), NOW)).toBe(true);
  });

  it('is false when there is no email (therapist manual entry may omit it)', () => {
    expect(isReminderCandidate(candidate({ email: '' }), NOW)).toBe(false);
  });

  it('is false when the reminder was already sent', () => {
    expect(isReminderCandidate(candidate({ reminderSent: true }), NOW)).toBe(false);
  });

  it('is false while the reservation is still pending', () => {
    expect(isReminderCandidate(candidate({ status: 'pending' }), NOW)).toBe(false);
  });

  it('is false beyond 48 h or once the appointment has started', () => {
    expect(isReminderCandidate(candidate({ date: hoursFromNow(49) }), NOW)).toBe(false);
    expect(isReminderCandidate(candidate({ date: hoursFromNow(-1) }), NOW)).toBe(false);
  });

  it(`waits ${RECENT_BOOKING_HOURS} h after booking so it doesn't land right after the confirmation`, () => {
    expect(isReminderCandidate(candidate({ createdAt: hoursFromNow(-2) }), NOW)).toBe(false);
    expect(isReminderCandidate(candidate({ createdAt: hoursFromNow(-13) }), NOW)).toBe(true);
  });

  it('treats legacy reservations without createdAt as old enough', () => {
    expect(isReminderCandidate(candidate({ createdAt: undefined }), NOW)).toBe(true);
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

describe('buildReminderEmail escaping', () => {
  it('escapes client-submitted fields in the HTML body', () => {
    const { html } = buildReminderEmail(buildReservation({ clientName: '<b>X</b>' }));
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });
});
