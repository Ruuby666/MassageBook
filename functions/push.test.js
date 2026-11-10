const {
  EXPO_PUSH_URL,
  RESERVATIONS_CHANNEL_ID,
  buildNewReservationPush,
  sendExpoPush,
} = require('./push');

function buildReservation(overrides = {}) {
  return {
    clientName: 'María López',
    service: 'Masaje relajante',
    phone: '600123456',
    address: 'Calle Falsa 123',
    date: new Date('2026-07-22T10:00:00.000Z'),
    ...overrides,
  };
}

function mockFetch(body, { ok = true, status = 200 } = {}) {
  return jest.fn().mockResolvedValue({ ok, status, json: async () => body });
}

describe('buildNewReservationPush', () => {
  it('shows client, service and Canary local date/time', () => {
    const { title, body } = buildNewReservationPush(buildReservation(), 'res1');

    expect(title).toBe('Nueva reserva pendiente');
    expect(body).toContain('María López');
    expect(body).toContain('Masaje relajante');
    // 10:00 UTC in July is 11:00 in the Canary Islands (WEST, UTC+1).
    expect(body).toContain('11:00');
  });

  it('keeps phone and address off the lock screen', () => {
    const { body } = buildNewReservationPush(buildReservation(), 'res1');
    expect(body).not.toContain('600123456');
    expect(body).not.toContain('Calle Falsa');
  });

  it('carries the reservation id and ISO date so the app can open that day', () => {
    const { data } = buildNewReservationPush(buildReservation(), 'res1');
    expect(data).toEqual({ reservationId: 'res1', date: '2026-07-22T10:00:00.000Z' });
  });
});

describe('sendExpoPush', () => {
  const message = { title: 't', body: 'b', data: {} };

  it('skips the request entirely when there are no tokens', async () => {
    const fetchImpl = mockFetch({ data: [] });
    await expect(sendExpoPush([], message, fetchImpl)).resolves.toEqual({ invalidTokens: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts one message per token on the reservations channel', async () => {
    const fetchImpl = mockFetch({ data: [{ status: 'ok' }, { status: 'ok' }] });
    await sendExpoPush(['tokA', 'tokB'], message, fetchImpl);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(EXPO_PUSH_URL);
    const sent = JSON.parse(options.body);
    expect(sent.map((item) => item.to)).toEqual(['tokA', 'tokB']);
    expect(sent[0]).toMatchObject({ title: 't', body: 'b', channelId: RESERVATIONS_CHANNEL_ID });
  });

  it('reports only DeviceNotRegistered tokens as invalid', async () => {
    const fetchImpl = mockFetch({
      data: [
        { status: 'ok' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'MessageRateExceeded' } },
      ],
    });
    const { invalidTokens } = await sendExpoPush(['a', 'b', 'c'], message, fetchImpl);
    expect(invalidTokens).toEqual(['b']);
  });

  it('throws when Expo rejects the request', async () => {
    const fetchImpl = mockFetch({}, { ok: false, status: 500 });
    await expect(sendExpoPush(['a'], message, fetchImpl)).rejects.toThrow('500');
  });
});
