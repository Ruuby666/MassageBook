const { buildConfirmationEmail, buildRejectionEmail } = require('./notifications');

function buildReservation(overrides = {}) {
  return {
    clientName: 'María López',
    email: 'maria@example.com',
    service: 'Masaje relajante',
    durationMinutes: 60,
    price: 60,
    address: 'Calle Falsa 123',
    date: new Date('2026-07-22T10:00:00.000Z'),
    ...overrides,
  };
}

describe('buildConfirmationEmail', () => {
  it('includes the client name, service, date/time, address and price', () => {
    const { subject, html, text } = buildConfirmationEmail(buildReservation());

    expect(subject).toContain('confirmada');
    for (const content of [html, text]) {
      expect(content).toContain('María López');
      expect(content).toContain('Masaje relajante');
      expect(content).toContain('60 min');
      expect(content).toContain('Calle Falsa 123');
      expect(content).toContain('€60');
    }
  });

  it('omits the price line when price is not a number', () => {
    const { html, text } = buildConfirmationEmail(buildReservation({ price: null }));
    expect(html).not.toContain('Precio');
    expect(text).not.toContain('Precio');
  });
});

describe('buildRejectionEmail', () => {
  it('includes the client name and date/time, and asks to reschedule', () => {
    const { subject, html, text } = buildRejectionEmail(buildReservation());

    expect(subject).toContain('No pudimos confirmar');
    for (const content of [html, text]) {
      expect(content).toContain('María López');
      expect(content).toContain('reagendar');
    }
  });
});
