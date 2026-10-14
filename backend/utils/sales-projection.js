const { storeDate } = require('./expiry');
const DAY_MS = 86400000;

// Estimate the next seven calendar days from the last seven complete store days.
// Zero-sale days count in the average; today's partial sales never do.
function salesProjection(transactions, now = new Date()) {
  const today = Date.parse(`${storeDate(now)}T00:00:00+08:00`);
  const start = today - 7 * DAY_MS;
  const dated = transactions.map(t => ({ ...t, timestamp: Date.parse(t.created_at) }))
    .filter(t => Number.isFinite(t.timestamp));
  const enoughHistory = dated.some(t => t.timestamp < start + DAY_MS);
  const revenue = dated.filter(t => t.timestamp >= start && t.timestamp < today)
    .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
  return {
    available: enoughHistory,
    source_start: storeDate(new Date(start)),
    source_end: storeDate(new Date(today - DAY_MS)),
    forecast_start: storeDate(new Date(today)),
    forecast_end: storeDate(new Date(today + 6 * DAY_MS)),
    average_daily_sales: enoughHistory ? Math.round(revenue / 7 * 100) / 100 : null,
    estimated_revenue: enoughHistory ? Math.round(revenue * 100) / 100 : null,
    method: 'Average daily sales over the last 7 complete days × 7. Zero-sale days included; not a guarantee.',
  };
}

module.exports = { salesProjection };
