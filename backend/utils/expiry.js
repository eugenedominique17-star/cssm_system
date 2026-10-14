const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});

function storeDate(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// A date-only expiry stays valid through that date in the store's timezone.
function isExpired(expiryDate, now = new Date()) {
  return Boolean(expiryDate && String(expiryDate).slice(0, 10) < storeDate(now));
}

module.exports = { storeDate, isExpired };
