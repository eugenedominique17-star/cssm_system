const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

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

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

function controller(options = {}) {
  const submissions = [];
  const sales = [];
  const events = [];
  const product = { id: 1, name: 'Milk', stock: 20, price: 10, status: 'active', expiry_date: '2999-01-01', ...options.product };
  const api = load('controllers/transaction.controller.js', {
    '../models/product.model': { getById: async () => product },
    '../models/user.model': { findById: async () => ({ id: 100, role: 'client', status: 'active' }) },
    '../models/submission.model': {
      create: async (data) => { submissions.push(data); return 5; },
      getById: async () => ({ id: 5, type: 'walk_in_order', status: 'pending', submitted_by: 100,
        data: { items: [{ product_id: 1, quantity: 2 }] } }),
      cancelPendingWalkIn: async () => options.cancelResult === undefined ? { id: 5 } : options.cancelResult,
      updateStatus: async () => { throw new Error('Completion must update status atomically in the database'); },
    },
    '../models/transaction.model': { create: async (data) => {
      if (options.saleError) throw options.saleError;
      sales.push(data); return 12;
    } },
    '../sse': { sendToUser: (...args) => events.push(args) },
  });
  return { api, submissions, sales, events };
}

test('client checkout uses signed-in identity and merges repeated products', async () => {
  const { api, submissions } = controller();
  const res = response();
  await api.createWalkInRequest({ user: { id: 100 }, body: {
    user_id: 999, items: [{ product_id: 1, quantity: 2 }, { product_id: 1, quantity: 3 }],
  } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(submissions[0].submitted_by, 100);
  assert.equal(submissions[0].data.items[0].quantity, 5);
});

test('checkout rejects invalid and excessive quantities without recording an order', async () => {
  for (const items of [[], [{ product_id: -1, quantity: 1 }], [{ product_id: 1, quantity: 0 }],
    [{ product_id: 1, quantity: 1.5 }], [{ product_id: 1, quantity: 2147483647 }, { product_id: 1, quantity: 1 }]]) {
    const { api, submissions } = controller();
    const res = response();
    await api.createWalkInRequest({ user: { id: 100 }, body: { items } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(submissions.length, 0);
  }
});

test('every sale and order creation path rejects expired products', async () => {
  for (const handler of ['create', 'createWalkInRequest', 'createStaffWalkInRequest', 'completeWalkInRequest']) {
    const { api, sales, submissions } = controller({ product: { expiry_date: '2000-01-01' } });
    const res = response();
    await api[handler]({ user: { id: 200, role: 'staff' }, params: { id: 5 },
      body: { user_id: 100, items: [{ product_id: 1, quantity: 2 }], payment_method: 'cash', tendered_amount: 100 } }, res);
    assert.equal(res.statusCode, 400, handler);
    assert.match(res.body.message, /expired/);
    assert.equal(sales.length + submissions.length, 0);
  }
});

test('expiry respects Philippine midnight, including expiry today and no expiry', () => {
  const { isExpired } = require('../utils/expiry');
  assert.equal(isExpired('2026-10-04', new Date('2026-10-04T15:59:59Z')), false);
  assert.equal(isExpired('2026-10-04', new Date('2026-10-04T16:00:00Z')), true);
  assert.equal(isExpired(null), false);
});

test('completion passes submission ID to the atomic sale and then notifies the client', async () => {
  const { api, sales, events } = controller();
  const res = response();
  await api.completeWalkInRequest({ user: { id: 200 }, params: { id: '5' },
    body: { payment_method: 'cash', tendered_amount: 25 } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(sales[0].submission_id, '5');
  assert.equal(res.body.change, 5);
  assert.equal(events.length, 1);
});

test('failed atomic sale returns conflict without sending a completion notification', async () => {
  const { api, events } = controller({ saleError: Object.assign(new Error('Insufficient stock'), { status: 409 }) });
  const res = response();
  await api.completeWalkInRequest({ user: { id: 200 }, params: { id: '5' },
    body: { payment_method: 'cash', tendered_amount: 25 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(events.length, 0);
});

test('cancellation loses safely when order was already completed', async () => {
  const { api, events } = controller({ cancelResult: null });
  const res = response();
  await api.cancelWalkInRequest({ user: { id: 100, role: 'client' }, params: { id: 5 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(events.length, 0);
});

test('cash checkout rounds totals and produces distinct receipt numbers', async () => {
  const { api, sales } = controller({ product: { price: 0.1 } });
  for (let i = 0; i < 2; i++) {
    const res = response();
    await api.create({ user: { id: 200 }, body: { user_id: 100,
      items: [{ product_id: 1, quantity: 3 }], payment_method: 'cash', tendered_amount: 0.3 } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(sales[i].total_amount, 0.3);
  }
  assert.notEqual(sales[0].receipt_number, sales[1].receipt_number);
});

test('authentication reloads account status on every request and rejects deleted or changed-role accounts', async () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'regression-test-only-secret';
  try {
    let user = { id: 200, role: 'staff', status: 'active', name: 'Current name' };
    const { authenticate } = load('middleware/auth.js', {
      '../models/user.model': { findById: async () => user },
      dotenv: { config() {} },
    });
    const token = jwt.sign({ id: 200, role: 'staff', name: 'Old name' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: 'Bearer ' + token } };
    let next = 0;
    await authenticate(req, response(), () => next++);
    assert.equal(next, 1);
    assert.equal(req.user.name, 'Current name');
    for (const state of [{ id: 200, role: 'staff', status: 'rejected' }, null,
      { id: 200, role: 'client', status: 'active' }]) {
      user = state;
      const res = response();
      await authenticate(req, res, () => next++);
      assert.equal(res.statusCode, 401);
    }
    assert.equal(next, 1);
  } finally {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('authentication fails closed on lookup failure and rejects missing/invalid tokens', async () => {
  const { authenticate } = load('middleware/auth.js', {
    '../models/user.model': { findById: async () => { throw new Error('offline'); } },
    jsonwebtoken: { verify: () => ({ id: 200, role: 'staff' }) },
    dotenv: { config() {} },
  });
  const res = response();
  await authenticate({ headers: { authorization: 'Bearer test' } }, res, () => assert.fail('Access must be denied'));
  assert.equal(res.statusCode, 503);
  const missing = response();
  await authenticate({ headers: {} }, missing, () => assert.fail('Access must be denied'));
  assert.equal(missing.statusCode, 401);
});

test('sale model uses one RPC, strips supplied prices and preserves database conflicts', async () => {
  const calls = [];
  let failure = null;
  const model = load('models/transaction.model.js', {
    '../config/db': { db: new Proxy({}, { get() { throw new Error('Partial writes are forbidden'); } }) },
    '../config/supabase': { rpc: async (...args) => { calls.push(args); return { data: 12, error: failure }; } },
  });
  const input = { receipt_number: 'test', user_id: 100, staff_id: 200, total_amount: 20,
    payment_method: 'cash', tendered_amount: 25, submission_id: 5,
    items: [{ product_id: 1, quantity: 2, unit_price: 999, subtotal: 1998 }] };
  assert.equal(await model.create(input), 12);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'create_sale_atomic');
  assert.deepEqual(calls[0][1].p_items, [{ product_id: 1, quantity: 2 }]);
  failure = { code: 'PT409', message: 'This order is no longer pending.' };
  await assert.rejects(model.create(input), error => error.status === 409);
});

test('cancellation performs a conditional pending-only update', async () => {
  const filters = [];
  const query = { update() { return this; }, eq(...args) { filters.push(args); return this; },
    select() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
  const model = load('models/submission.model.js', {
    '../config/db': { db: {} }, '../config/supabase': { from: () => query },
  });
  assert.equal(await model.cancelPendingWalkIn(5, 'Cancelled'), null);
  assert.deepEqual(filters, [['id', 5], ['type', 'walk_in_order'], ['status', 'pending']]);
});

test('completion returns exact cent change', async () => {
  const { api } = controller({ product: { price: 0.1 } });
  const res = response();
  await api.completeWalkInRequest({ user: { id: 200 }, params: { id: 5 },
    body: { payment_method: 'cash', tendered_amount: 0.3 } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.change, 0.1);
});

test('invalid and expired tokens never reach account lookup', async () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'regression-test-only-secret';
  try {
    const { authenticate } = load('middleware/auth.js', {
      '../models/user.model': { findById: async () => assert.fail('Invalid token must not query accounts') },
      dotenv: { config() {} },
    });
    const expired = jwt.sign({ id: 1, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: -1 });
    for (const token of ['invalid', expired]) {
      const res = response();
      await authenticate({ headers: { authorization: 'Bearer ' + token } }, res, () => assert.fail('Invalid token accepted'));
      assert.equal(res.statusCode, 401);
    }
  } finally {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('SSE rejects inactive accounts and closes a stream after account deactivation', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let handler;
  let active = false;
  let ended = false;
  let removed = 0;
  load('routes/sse.routes.js', {
    express: { Router: () => ({ get: (_path, fn) => { handler = fn; } }) },
    '../middleware/auth': { getAuthenticatedUser: async () => {
      if (!active) throw Object.assign(new Error('Inactive account'), { status: 401 });
      return { id: 100, role: 'client' };
    } },
    '../sse': { addClient() {}, removeClient() { removed++; } },
    dotenv: { config() {} },
  });
  const rejected = response();
  await handler({ query: { token: 'token' } }, rejected);
  assert.equal(rejected.statusCode, 401);
  active = true;
  const res = { setHeader() {}, flushHeaders() {}, write() {}, end() { ended = true; } };
  await handler({ query: { token: 'token' }, on() {} }, res);
  active = false;
  t.mock.timers.tick(25000);
  await new Promise(setImmediate);
  assert.equal(ended, true);
  assert.equal(removed, 1);
});
