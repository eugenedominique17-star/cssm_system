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

test('custom and daily product reports use the selected Philippine date range', async () => {
  const transactions = [
    { id: 1, created_at: '2026-10-25T16:30:00Z', total_amount: '10' },
    { id: 2, created_at: '2026-10-26T16:30:00Z', total_amount: '20' },
    { id: 3, created_at: '2026-10-27T16:30:00Z', total_amount: '30' },
  ];
  const db = {
    transactions: { getAll: async () => transactions },
    transaction_items: {
      find: async ({ transaction_id }) => [{
        product_id: transaction_id,
        quantity: transaction_id,
        subtotal: String(transactions.find((item) => item.id === transaction_id).total_amount),
      }],
    },
    products: {
      findById: async (id) => ({ id, name: `Product ${id}`, category: 'Test' }),
    },
  };
  const model = load('models/transaction.model.js', { '../config/db': { db }, '../config/supabase': {} });

  assert.deepEqual(
    await model.getTopProducts('custom', undefined, '2026-10-26', '2026-10-26'),
    [{ name: 'Product 2', category: 'Test', total_quantity: 2, total_sales: 20 }],
  );
  assert.deepEqual(
    await model.getSalesSummary('daily', undefined, '2026-10-27', '2026-10-27'),
    { total_transactions: 1, total_revenue: 30 },
  );
});
