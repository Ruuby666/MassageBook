// Client-submitted fields (name, address…) come straight from the public
// booking form, so every email builder escapes them before putting them
// into HTML — otherwise anyone booking could inject markup or links into
// the emails we send. Plain-text email bodies don't need it.
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = { escapeHtml };
