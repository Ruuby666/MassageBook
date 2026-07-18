const {
  BUFFER_MINUTES,
  ValidationError,
  parseReservation,
  assertFutureDate,
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