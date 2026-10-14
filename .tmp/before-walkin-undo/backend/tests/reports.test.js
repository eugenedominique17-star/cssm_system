const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function load(relativePath, mocks) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const localRequire = Module.createRequire(filename);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}

test('selected month uses Philippine calendar boundaries for every report total', async () => {
  const transactions = [
    { id: 1, created_at: '2026-08-31T15:59:59Z', total_amount: '9' },
    { id: 2, created_at: '2026-08-31T16:00:00Z', total_amount: '100' },
    { id: 3, created_at: '2026-09-30T15:59:59Z', total_amount: '200' },
    { id: 4, created_at: '2026-09-30T16:00:00Z', total_amount: '400' },
  ];
  const db = {
    transactions: { getAll: async () => transactions },
    transaction_items: { find: async ({ transaction_id }) => [{ product_id: 1, quantity: 1, subtotal: String(transactions.find((item) => item.id === transaction_id).total_amount) }] },
    products: { findById: async () => ({ id: 1, name: 'Milk', category: 'Dairy' }) },
  };
  const model = load('models/transaction.model.js', { '../config/db': { db }, '../config/supabase': {} });

  assert.deepEqual(await model.getSalesSummary('monthly', '2026-09'), { total_transactions: 2, total_revenue: 300 });
  assert.deepEqual(await model.getSalesByCategory('monthly', '2026-09'), [{ category: 'Dairy', total_sales: 300, transaction_count: 2 }]);
  assert.deepEqual(await model.getTopProducts('monthly', '2026-09'), [{ name: 'Milk', category: 'Dairy', total_quantity: 2, total_sales: 300 }]);
});

test('custom ranges use identical Philippine boundaries for revenue, categories and products', async () => {
  const transactions = [
    { id: 1, created_at: '2026-09-30T15:59:59Z', total_amount: 50 },
    { id: 2, created_at: '2026-09-30T16:00:00Z', total_amount: 100 },
    { id: 3, created_at: '2026-10-02T15:59:59Z', total_amount: 200 },
    { id: 4, created_at: '2026-10-02T16:00:00Z', total_amount: 400 },
  ];
  const db = {
    transactions: { getAll: async () => transactions },
    transaction_items: { find: async ({ transaction_id }) => [{ product_id: 1, quantity: 1, subtotal: transactions.find(t => t.id === transaction_id).total_amount }] },
    products: { findById: async () => ({ id: 1, name: 'Milk', category: 'Dairy' }) },
  };
  const model = load('models/transaction.model.js', { '../config/db': { db }, '../config/supabase': {} });
  const args = ['monthly', undefined, '2026-10-01', '2026-10-02'];
  const trend = await model.getSalesTrend(args[2], args[3]);
  assert.equal(trend.summary.total_revenue, 300);
  assert.equal((await model.getSalesSummary(...args)).total_revenue, 300);
  assert.equal((await model.getSalesByCategory(...args))[0].total_sales, 300);
  assert.equal((await model.getTopProducts(...args))[0].total_sales, 300);
  assert.equal(trend.comparison.total_revenue, 50);
  assert.equal(trend.comparison.revenue_change_percent, 500);
});

test('projection counts zero-sale days, excludes current partial day, and requires history', () => {
  const { salesProjection } = require('../utils/sales-projection');
  const now = new Date('2026-10-12T08:00:00+08:00');
  const data = [
    { created_at: '2026-10-05T10:00:00+08:00', total_amount: 70 },
    { created_at: '2026-10-11T23:59:59+08:00', total_amount: 70 },
    { created_at: '2026-10-12T00:00:00+08:00', total_amount: 999 },
  ];
  const projection = salesProjection(data, now);
  assert.equal(projection.available, true);
  assert.equal(projection.average_daily_sales, 20);
  assert.equal(projection.estimated_revenue, 140);
  assert.equal(projection.source_start, '2026-10-05');
  assert.equal(projection.source_end, '2026-10-11');
  assert.equal(projection.forecast_start, '2026-10-12');
  assert.equal(projection.forecast_end, '2026-10-18');
  assert.equal(salesProjection(data.slice(1), now).available, false);
  assert.equal(salesProjection([], now).estimated_revenue, null);
  assert.equal(salesProjection([{ created_at: '2026-01-01', total_amount: 1 }], now).estimated_revenue, 0);
});
