export function philippineDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function daysRemaining(expiry, today) {
  return expiry ? Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
}
export function matchesExpiry(expiry, today, filter) {
  const days = daysRemaining(expiry, today);
  if (filter === 'all') return true;
  if (filter === 'missing') return days === null;
  if (filter === 'expired') return days !== null && days < 0;
  if (filter === 'today') return days === 0;
  return days !== null && days >= 0 && days <= Number(filter);
}
