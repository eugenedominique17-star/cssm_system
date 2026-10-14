const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function loadController(transactionModel, notifications) {
  const filename = path.resolve(__dirname, '..', 'controllers', 'transaction.controller.js');
  const localRequire = Module.createRequire(filename);
  const mocks = {
    '../models/transaction.model': transactionModel,
    '../models/product.model': { getById: async () => ({ id: 1, name: 'Milk', status: 'active', expiry_date: null, stock: 10, price: 12.5 }) },
    '../models/submission.model': {},
    '../models/user.model': { findById: async () => ({ id: 42, role: 'client', status: 'active' }) },
    '../utils/expiry': { isExpired: () => false, storeDate: () => '2026-10-12' },
    '../sse': { sendToUser: (...args) => notifications.push(args) },
  };
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const request = {
  user: { id: 7, name: 'Cashier One', role: 'staff' },
  body: {
    user_id: 42,
    items: [{ product_id: 1, quantity: 2 }],
    payment_method: 'cash',
    tendered_amount: 30,
  },
};

test('completed linked-client sale sends its receipt, cashier, and time in real time', async () => {
  const notifications = [];
  const controller = loadController({
    create: async () => 101,
  }, notifications);
  const response = makeResponse();

  await controller.create(request, response);

  assert.equal(response.statusCode, 201);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0][0], 42);
  assert.equal(notifications[0][1], 'order_status_update');
  assert.deepEqual(notifications[0][2], {
    status: 'completed',
    receipt_number: response.body.receipt_number,
    total_amount: 25,
    cashier_name: 'Cashier One',
    completed_at: notifications[0][2].completed_at,
    message: 'Your purchase has been completed.',
  });
  assert.ok(Number.isFinite(Date.parse(notifications[0][2].completed_at)));
});

test('failed sale persistence does not send a completion notification', async () => {
  const notifications = [];
  const controller = loadController({
    create: async () => {
      throw new Error('database unavailable');
    },
  }, notifications);
  const response = makeResponse();

  await controller.create(request, response);

  assert.equal(response.statusCode, 500);
  assert.equal(notifications.length, 0);
});
