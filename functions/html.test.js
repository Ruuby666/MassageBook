const { escapeHtml } = require('./html');

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<a href="x">O\'Neil & co</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;O&#39;Neil &amp; co&lt;/a&gt;'
    );
  });

  it('leaves normal text alone', () => {
    expect(escapeHtml('María López, Calle Triana 12')).toBe('María López, Calle Triana 12');
  });

  it('turns null/undefined into an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
