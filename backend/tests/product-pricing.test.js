const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('selling price applies a percentage markup to the unit purchase cost', async () => {
  const { calculateSellingPrice } = await import(pathToFileURL(
    path.resolve(__dirname, '../../frontend/src/utils/productPricing.mjs'),
  ));

  assert.equal(calculateSellingPrice(1000, 20), 1200);
  assert.equal(calculateSellingPrice(19.99, 12.5), 22.49);
  assert.equal(calculateSellingPrice(10, 0), 10);
  assert.equal(calculateSellingPrice('', 20), null);
  assert.equal(calculateSellingPrice(10, ''), null);
  assert.equal(calculateSellingPrice(-1, 20), null);
  assert.equal(calculateSellingPrice(10, -1), null);
  assert.equal(calculateSellingPrice(10, 10001), null);
  assert.equal(calculateSellingPrice(99999999, 100), null);
});

test('public product results do not expose purchase cost or markup', async () => {
  const filename = path.resolve(__dirname, '../models/product.model.js');
  const Module = require('node:module');
  const fs = require('node:fs');
  const local = Module.createRequire(filename);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => {
    if (name === '../config/db') return {
      db: { products: { getAll: async () => [{
        id: 1, name: 'Coffee', status: 'active', stock: 5, price: 1200, purchase_price: 1000, selling_markup_percent: 20,
      }] } },
    };
    if (name === '../config/supabase') return { rpc: async () => ({ data: [{ product_id: 1, available_stock: 5 }] }) };
    return local(name);
  };
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);

  const [product] = await mod.exports.getAll(true, false);
  assert.equal(product.price, 1200);
  assert.equal(product.purchase_price, undefined);
  assert.equal(product.selling_markup_percent, undefined);
});

test('staff product pricing changes are submitted for admin approval', async () => {
  const filename = path.resolve(__dirname, '../controllers/product.controller.js');
  const Module = require('node:module');
  const fs = require('node:fs');
  const local = Module.createRequire(filename);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  let submitted;
  mod.require = name => {
    if (name === '../models/product.model') return { getById: async () => ({ id: 7 }) };
    if (name === '../models/submission.model') return { create: async value => { submitted = value; return 42; } };
    return local(name);
  };
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await mod.exports.update({
    params: { id: '7' },
    user: { id: 3, role: 'staff' },
    body: {
      name: 'Coffee',
      category: 'Drinks',
      purchase_price: 1000,
      selling_markup_percent: 20,
      price: 1200,
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(submitted.type, 'stock_update');
  assert.equal(submitted.data.price, 1200);
  assert.equal(submitted.data.purchase_price, 1000);
  assert.equal(submitted.data.selling_markup_percent, 20);
});
