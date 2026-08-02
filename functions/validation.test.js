const {
  BUFFER_MINUTES,
  ValidationError,
  parseReservation,
  assertFutureDate,
  assertWithinBusinessHours,
  getLocalDateKey,
  assertNotBlocked,
  applyService,
  getOverlapWindow,
  hasOverlap,
} = require('./validation');

function validPayload(overrides = {}) {
  return {
    clientName: 'María López',
    phone: '5512345678',
    email: 'maria@example.com',
    address: 'Av. Reforma 123',
    serviceId: 'svc-relajante',
    date: '2099-01-01T09:00:00.000Z',
    notes: '',
    ...overrides,
  };
}

function validService(overrides = {}) {
  return {
    name: 'Masaje relajante',
    description: 'Masaje suave para liberar tensión.',
    durationMinutes: 60,
    price: 800,
    materials: 'Aceite esencial de lavanda',
    enabled: true,
    ...overrides,
  };
}

describe('parseReservation', () => {
  it('accepts a fully valid unauthenticated payload', () => {
    const result = parseReservation(validPayload(), { authenticated: false });
    expect(result.clientName).toBe('María López');
    expect(result.serviceId).toBe('svc-relajante');
    expect(result.startDate).toBeInstanceOf(Date);
  });

  it('trims whitespace from string fields', () => {
    const result = parseReservation(
      validPayload({ clientName: '  María López  ', address: '  Av. Reforma 123  ' }),
      { authenticated: false }
    );
    expect(result.clientName).toBe('María López');
    expect(result.address).toBe('Av. Reforma 123');
  });

  it('rejects a missing client name', () => {
    expect(() => parseReservation(validPayload({ clientName: '' }), { authenticated: false })).toThrow(
      ValidationError
    );
  });

  it('rejects a missing address', () => {
    expect(() => parseReservation(validPayload({ address: '' }), { authenticated: false })).toThrow(
      ValidationError
    );
  });

  it('rejects a missing serviceId', () => {
    expect(() =>
      parseReservation(validPayload({ serviceId: '' }), { authenticated: false })
    ).toThrow(ValidationError);
  });

  it('rejects an unparseable date', () => {
    expect(() =>
      parseReservation(validPayload({ date: 'not-a-date' }), { authenticated: false })
    ).toThrow(ValidationError);
  });

  it('requires a valid email when unauthenticated (public form)', () => {
    expect(() =>
      parseReservation(validPayload({ email: '' }), { authenticated: false })
    ).toThrow(ValidationError);
    expect(() =>
      parseReservation(validPayload({ email: 'not-an-email' }), { authenticated: false })
    ).toThrow(ValidationError);
  });

  it('does not require an email when authenticated (therapist manual entry)', () => {
    expect(() =>
      parseReservation(validPayload({ email: '' }), { authenticated: true })
    ).not.toThrow();
  });
});

describe('applyService', () => {
  it('merges the service name, duration and price into the reservation', () => {
    const reservation = { clientName: 'María López' };
    const result = applyService(reservation, validService());
    expect(result.clientName).toBe('María López');
    expect(result.service).toBe('Masaje relajante');
    expect(result.durationMinutes).toBe(60);
    expect(result.price).toBe(800);
  });

  it('rejects when the service does not exist', () => {
    expect(() => applyService({}, null)).toThrow(ValidationError);
    expect(() => applyService({}, undefined)).toThrow(ValidationError);
  });

  it('rejects a disabled service when unauthenticated (public form)', () => {
    expect(() =>
      applyService({}, validService({ enabled: false }), { authenticated: false })
    ).toThrow(ValidationError);
  });

  it('allows a disabled service when authenticated (therapist can still book it herself)', () => {
    expect(() =>
      applyService({}, validService({ enabled: false }), { authenticated: true })
    ).not.toThrow();
  });

  it.each([15, 45, 75, 120])('accepts any therapist-set duration (%s min)', (durationMinutes) => {
    const result = applyService({}, validService({ durationMinutes }));
    expect(result.durationMinutes).toBe(durationMinutes);
  });

  it('falls back to null price when the service has no numeric price', () => {
    const result = applyService({}, validService({ price: undefined }));
    expect(result.price).toBeNull();
  });
});

describe('assertFutureDate', () => {
  it('throws for a date in the past', () => {
    const past = new Date('2020-01-01T00:00:00.000Z');
    expect(() => assertFutureDate(past, new Date('2026-01-01T00:00:00.000Z'))).toThrow(
      ValidationError
    );
  });

  it('throws when the date equals "now" exactly (must be strictly future)', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(() => assertFutureDate(new Date(now.getTime()), now)).toThrow(ValidationError);
  });

  it('does not throw for a date in the future', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const future = new Date(now.getTime() + 60000);
    expect(() => assertFutureDate(future, now)).not.toThrow();
  });
});

describe('assertWithinBusinessHours', () => {
  // Fixture times are given in UTC but written as the Canary Islands
  // local wall-clock time they represent. July falls in EU daylight
  // saving, so the Canaries run WEST (UTC+1): UTC = local - 1h.
  it('allows a start time comfortably inside 8:00-21:00 local', () => {
    const localNineAm = new Date('2026-07-15T08:00:00.000Z'); // 09:00 local
    expect(() => assertWithinBusinessHours(localNineAm, 60, false)).not.toThrow();
  });

  it('rejects a start time before 8:00 local when unauthenticated', () => {
    const localBeforeOpen = new Date('2026-07-15T06:59:00.000Z'); // 07:59 local
    expect(() => assertWithinBusinessHours(localBeforeOpen, 30, false)).toThrow(ValidationError);
  });

  it('rejects an appointment that would end after 21:00 local when unauthenticated', () => {
    const localEightPm = new Date('2026-07-15T19:00:00.000Z'); // 20:00 local
    expect(() => assertWithinBusinessHours(localEightPm, 90, false)).toThrow(ValidationError);
  });

  it('allows an appointment that ends exactly at 21:00 local', () => {
    const localEightPm = new Date('2026-07-15T19:00:00.000Z'); // 20:00 local
    expect(() => assertWithinBusinessHours(localEightPm, 60, false)).not.toThrow();
  });

  it('does not restrict hours when authenticated (therapist manual entry)', () => {
    const localMidnight = new Date('2026-07-14T23:00:00.000Z'); // 00:00 local (Jul 15)
    expect(() => assertWithinBusinessHours(localMidnight, 60, true)).not.toThrow();
  });

  it('accounts for winter time (WET, UTC+0) as well as summer (WEST, UTC+1)', () => {
    const winterNineAm = new Date('2026-01-15T09:00:00.000Z'); // 09:00 local (WET)
    expect(() => assertWithinBusinessHours(winterNineAm, 60, false)).not.toThrow();
    const winterBeforeOpen = new Date('2026-01-15T07:59:00.000Z'); // 07:59 local (WET)
    expect(() => assertWithinBusinessHours(winterBeforeOpen, 30, false)).toThrow(ValidationError);
  });
});

describe('getLocalDateKey', () => {
  it('returns the Canary Islands local calendar date, not UTC', () => {
    // 23:30 UTC on the 14th is 00:30 local (WEST, UTC+1) on the 15th.
    const date = new Date('2026-07-14T23:30:00.000Z');
    expect(getLocalDateKey(date)).toBe('2026-07-15');
  });

  it('matches the UTC date when local time is comfortably mid-day', () => {
    const date = new Date('2026-07-15T12:00:00.000Z'); // 13:00 local
    expect(getLocalDateKey(date)).toBe('2026-07-15');
  });
});

describe('assertNotBlocked', () => {
  const localNineAm = new Date('2026-07-15T08:00:00.000Z'); // 09:00 local

  it('rejects when the whole day is blocked', () => {
    const blocks = [{ allDay: true }];
    expect(() => assertNotBlocked(localNineAm, 60, blocks, false)).toThrow(ValidationError);
  });

  it('rejects when the appointment overlaps a partial-hour block', () => {
    const blocks = [{ allDay: false, startTime: '08:30', endTime: '10:00' }];
    expect(() => assertNotBlocked(localNineAm, 60, blocks, false)).toThrow(ValidationError);
  });

  it('allows the appointment when it falls outside every block that day', () => {
    const blocks = [{ allDay: false, startTime: '12:00', endTime: '13:00' }];
    expect(() => assertNotBlocked(localNineAm, 60, blocks, false)).not.toThrow();
  });

  it('allows when there are no blocks that day', () => {
    expect(() => assertNotBlocked(localNineAm, 60, [], false)).not.toThrow();
  });

  it('does not restrict the therapist booking over her own block from the app', () => {
    const blocks = [{ allDay: true }];
    expect(() => assertNotBlocked(localNineAm, 60, blocks, true)).not.toThrow();
  });
});

describe('getOverlapWindow', () => {
  const start = new Date('2026-07-15T09:00:00.000Z');

  it('applies the 30-min buffer on both sides when unauthenticated', () => {
    const { rangeStart, rangeEnd } = getOverlapWindow(start, 60, false);
    const bufferMs = BUFFER_MINUTES * 60000;
    expect(rangeStart).toBe(start.getTime() - bufferMs);
    expect(rangeEnd).toBe(start.getTime() + 60 * 60000 + bufferMs);
  });

  it('applies no buffer when authenticated', () => {
    const { rangeStart, rangeEnd } = getOverlapWindow(start, 60, true);
    expect(rangeStart).toBe(start.getTime());
    expect(rangeEnd).toBe(start.getTime() + 60 * 60000);
  });

  it('pads the Firestore query window beyond the buffered range', () => {
    const { rangeStart, rangeEnd, queryStart, queryEnd } = getOverlapWindow(start, 60, false);
    expect(queryStart.getTime()).toBeLessThan(rangeStart);
    expect(queryEnd.getTime()).toBeGreaterThan(rangeEnd);
  });
});

describe('hasOverlap', () => {
  it('is true when an existing reservation overlaps the range', () => {
    const existing = [{ start: 1000, end: 2000 }];
    expect(hasOverlap(1500, 2500, existing)).toBe(true);
  });

  it('is false when ranges only touch at the boundary', () => {
    const existing = [{ start: 1000, end: 2000 }];
    expect(hasOverlap(2000, 3000, existing)).toBe(false);
  });

  it('is false when there is a gap between ranges', () => {
    const existing = [{ start: 1000, end: 2000 }];
    expect(hasOverlap(2500, 3000, existing)).toBe(false);
  });

  it('is false for an empty candidate list', () => {
    expect(hasOverlap(1000, 2000, [])).toBe(false);
  });

  it('checks every candidate, not just the first', () => {
    const existing = [
      { start: 0, end: 100 },
      { start: 5000, end: 6000 },
    ];
    expect(hasOverlap(5500, 5600, existing)).toBe(true);
  });

  it('simulates the full end-to-end scenario verified manually via curl: unauthenticated booking 15 min after an existing one is rejected, 2h after is allowed', () => {
    const existingStart = new Date('2026-07-20T15:00:00.000Z');
    const existing = [{ start: existingStart.getTime(), end: existingStart.getTime() + 60 * 60000 }];

    const tooClose = getOverlapWindow(new Date('2026-07-20T15:15:00.000Z'), 30, false);
    expect(hasOverlap(tooClose.rangeStart, tooClose.rangeEnd, existing)).toBe(true);

    const farEnough = getOverlapWindow(new Date('2026-07-20T17:00:00.000Z'), 30, false);
    expect(hasOverlap(farEnough.rangeStart, farEnough.rangeEnd, existing)).toBe(false);
  });
});