const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { describeRequest, completion } = require('../utils/audit');

function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative);
  const localRequire = Module.createRequire(filename);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}
const request = (extra = {}) => ({ method: 'PUT', baseUrl: '/api/products', route: { path: '/:id' }, params: { id: 7 }, user: { id: 2, name: 'Staff', role: 'staff', password: 'secret' }, body: { stock: 35, password: 'secret', access_token: 'token' }, ...extra });
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; } });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('submission reviews save snapshots only after a successful update', async () => {
  for (const status of ['approved', 'rejected']) {
    for (const savedSuccessfully of [true, false]) {
      const submission = { id: 42, type: 'promo', status: 'pending', admin_notes: null, submitted_by: 7, submitted_by_name: 'Staff', data: { title: 'Promo', password: 'private' } };
      let reviews = 0;
      const controller = load('controllers/admin.controller.js', {
        '../models/user.model': {}, '../models/product.model': {}, '../models/transaction.model': {},
        '../models/promo.model': { create: async () => assert.fail('Must use the atomic review') },
        '../models/submission.model': {
          getById: async () => submission,
          reviewAtomic: async () => { reviews++; if (!savedSuccessfully) throw new Error('offline'); return { before: submission, after: { status, admin_notes: 'Reviewed' } }; },
        },
      });
      let saved;
      const store = { start: async () => 'audit-id', finish: async (_id, fields) => { saved = fields; } };
      const { createAuditMiddleware } = load('middleware/audit.js', { '../models/audit.model': store });
      const req = request({ baseUrl: '/api/admin', route: { path: '/approve-submission/:id' }, params: { id: 42 }, body: { status, admin_notes: 'Reviewed' } });
      const res = response();
      await createAuditMiddleware(store)(req, res, () => {});
      await controller.approveSubmission(req, res);
      await settle();
      assert.equal(reviews, 1);
      assert.equal(saved.outcome, savedSuccessfully ? 'succeeded' : 'failed');
      if (savedSuccessfully) {
        assert.deepEqual(saved.details.changes, [
          { field: 'status', label: 'Submission status', before: 'pending', after: status },
          { field: 'admin_notes', label: 'Review notes', before: null, after: 'Reviewed' },
        ]);
        assert.equal(saved.details.requested_by.name, 'Staff');
        assert.equal(saved.details.submission.id, 42);
      } else {
        assert.equal(res.statusCode, 500);
        assert.equal(saved.details.snapshot_version, undefined);
      }
      assert.ok(!JSON.stringify(saved).includes('private'));
    }
  }
});

test('legacy submission reviews explain the outcome without inventing changes', async () => {
  const { auditPresentation } = await import('../../frontend/src/utils/auditDetails.mjs');
  for (const action of ['Approve submission', 'Reject submission']) {
    const entry = { action, outcome: 'succeeded', details: { requested: { status: 'rejected' } } };
    const view = auditPresentation(entry);
    assert.match(view.message, /older activity/);
    assert.equal(view.changes, undefined);
    assert.equal(auditPresentation({ ...entry, outcome: 'failed' }).severity, 'error');
    assert.equal(auditPresentation({ ...entry, outcome: 'pending' }).severity, 'warning');
  }
});

test('account approval and rejection persist safe status snapshots through audit middleware', async () => {
  for (const [file, handler, status, route] of [
    ['user', 'approve', 'active', '/:id/approve'],
    ['user', 'reject', 'rejected', '/:id/reject'],
    ['admin', 'approveStaff', 'active', '/approve-staff/:id'],
    ['admin', 'approveStaff', 'rejected', '/approve-staff/:id'],
  ]) {
    const user = { id: 7, user_id: 'S100001', name: 'Test Staff', role: 'staff', status: 'pending', password: 'private' };
    const controller = load(`controllers/${file}.controller.js`, {
      '../models/user.model': { findById: async () => user, updateStatus: async () => ({ ...user, status }) },
      '../models/submission.model': {}, '../models/product.model': {}, '../models/promo.model': {}, '../models/transaction.model': {},
    });
    let saved;
    const store = { start: async () => 'audit-id', finish: async (_id, fields) => { saved = fields; } };
    const { createAuditMiddleware } = load('middleware/audit.js', { '../models/audit.model': store });
    const req = request({ baseUrl: `/api/${file === 'admin' ? 'admin' : 'users'}`, route: { path: route }, body: { status } });
    const res = response();
    await createAuditMiddleware(store)(req, res, () => {});
    await controller[handler](req, res);
    await settle();
    assert.equal(saved.outcome, 'succeeded');
    assert.deepEqual(saved.details.changes, [{ field: 'status', label: 'Account status', before: 'pending', after: status }]);
    assert.equal(saved.details.account.name, 'Test Staff');
    assert.ok(!JSON.stringify(saved).includes('private'));
  }
});

test('legacy approvals do not invent historical status and failed approvals hide snapshots', async () => {
  const { auditPresentation } = await import('../../frontend/src/utils/auditDetails.mjs');
  const entry = { action: 'Approve account', outcome: 'succeeded', details: {} };
  assert.match(auditPresentation(entry).message, /Account approved successfully/);
  assert.equal(auditPresentation(entry).changes, undefined);
  const done = completion(entry, {}, 500, { snapshot_version: 1, changes: [{ before: 'pending', after: 'active' }] });
  assert.equal(done.details.snapshot_version, undefined);
  assert.equal(auditPresentation({ ...entry, ...done }).severity, 'error');
});

test('logs allowlisted metadata only and describes submission as pending approval, not stock changed', () => {
  const entry = describeRequest(request());
  assert.deepEqual(entry.details, { requested: { stock: 35 } });
  const done = completion(entry, { submissionId: 91, password: 'private', credentials: { password: 'private' } }, 200);
  assert.equal(done.action, 'Submit product for approval');
  assert.equal(done.entity_id, '91');
  assert.equal(done.details.reference_type, 'Submission');
  assert.ok(!JSON.stringify(done).includes('private'));
  assert.deepEqual(describeRequest(request({ baseUrl: '/api/users', route: { path: '/:id/reset-password' } })).details.requested, {});
});

test('audit persists pending entry before controller and confirms response after finish', async () => {
  const calls = [];
  const store = { start: async entry => { calls.push('start'); assert.equal(entry.actor_id, '2'); assert.ok(!JSON.stringify(entry).includes('secret')); return 'audit-id'; }, finish: async (id, fields) => { calls.push('finish'); assert.equal(id, 'audit-id'); assert.equal(fields.outcome, 'succeeded'); } };
  const { createAuditMiddleware } = load('middleware/audit.js', { '../models/audit.model': store });
  const res = response();
  await createAuditMiddleware(store)(request(), res, () => { calls.push('controller'); res.json({ submissionId: 91 }); });
  await settle();
  assert.deepEqual(calls, ['start', 'controller', 'finish']);
  assert.equal(res.body.submissionId, 91);
});

test('audit failure blocks mutation before work; completion failure preserves successful response', async () => {
  const { createAuditMiddleware } = load('middleware/audit.js', { '../models/audit.model': {} });
  const res = response();
  await createAuditMiddleware({ start: async () => { throw new Error('offline'); } })(request(), res, () => assert.fail('Must not mutate'));
  assert.equal(res.statusCode, 503);
  const done = response();
  await createAuditMiddleware({ start: async () => 'id', finish: async () => { throw new Error('offline'); } })(request(), done, () => done.json({ transactionId: 99 }));
  await settle();
  assert.equal(done.statusCode, 200);
  assert.equal(done.body.transactionId, 99);
  assert.equal(done.headers['X-Audit-Status'], 'pending');
});

test('failed requests remain failed and read requests are not logged', async () => {
  assert.equal(completion(describeRequest(request()), {}, 409).outcome, 'failed');
  const { createAuditMiddleware } = load('middleware/audit.js', { '../models/audit.model': {} });
  let passed = false;
  await createAuditMiddleware({ start: () => assert.fail('Read must not log') })(request({ method: 'GET' }), response(), () => { passed = true; });
  assert.equal(passed, true);
});

test('admin audit permission rejects staff and client before accessing history', () => {
  const { authorize } = load('middleware/auth.js', { '../models/user.model': {}, '../middleware/audit': { auditMutation: (_req, _res, next) => next() }, dotenv: { config() {} } });
  for (const role of ['staff', 'client']) {
    const res = response();
    authorize('admin')({ user: { role } }, res, () => assert.fail('History must be admin-only'));
    assert.equal(res.statusCode, 403);
  }
  let allowed = false;
  authorize('admin')({ user: { role: 'admin' } }, response(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('filters reject invalid dates, arrays, inverted ranges and unbounded pages', async () => {
  const controller = load('controllers/audit.controller.js', { '../models/audit.model': { list: () => assert.fail('Invalid query must not reach DB') } });
  for (const query of [{ from: '2026-02-30' }, { role: ['admin'] }, { from: '2026-10-07', to: '2026-10-06' }, { page: '-1' }, { page: '99999999' }]) {
    const res = response();
    await controller.list({ query }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('activity details distinguish approval, pending submission, expiry and missing snapshots', async () => {
  const { auditTitle, auditPresentation, auditValue } = await import('../../frontend/src/utils/auditDetails.mjs');
  const approved = { action: 'Inventory approve_restock', actor_role: 'admin', outcome: 'succeeded', details: {} };
  assert.equal(auditTitle(approved), 'Stock Request Approved');
  assert.doesNotMatch(auditPresentation(approved).message, /still needs approval/);
  assert.match(auditPresentation(approved).message, /not recorded/);
  assert.equal(auditPresentation({ ...approved, outcome: 'failed' }).severity, 'error');
  assert.equal(auditPresentation({ ...approved, outcome: 'pending' }).severity, 'warning');
  const snapshot = { ...approved, details: { snapshot_version: 1, result: 'Approved.', changes: [{field:'available_quantity',before:20,after:35}] } };
  assert.deepEqual(auditPresentation(snapshot).changes, snapshot.details.changes);
  const expiry = auditPresentation({ ...approved, action: 'Edit batch expiry', details: {old_expiry_date:null,new_expiry_date:'2099-01-01'} });
  assert.equal(expiry.changes[0].before, null); assert.equal(expiry.changes[0].after, '2099-01-01');
  const order = { action:'Create order', entity_type:'Order', outcome:'succeeded', details:{linked_order:{receipt_number:'REC-81'}} };
  assert.equal(auditTitle(order), 'Order Created');
  assert.equal(auditPresentation(order).severity, 'success');
  assert.match(auditPresentation(order).message, /saved transaction record/);
  assert.equal(auditPresentation({...order, details:{}}).severity, 'warning');
  assert.equal(auditValue(0), '0'); assert.equal(auditValue(null), 'Not set');
});

test('admin audit listing links completed orders to safe saved transaction fields', async () => {
  const entry = { id:'audit-1', entity_id:'81', entity_type:'Order', action:'Create order', outcome:'succeeded', details:{} };
  const query = {
    select() { return this; },
    order() { return this; },
    range() { return Promise.resolve({ data:[entry], count:1, error:null }); },
  };
  const audit = load('models/audit.model.js', {
    '../config/supabase': { from: table => { assert.equal(table, 'audit_logs'); return query; } },
    './transaction.model': { getAuditDetails: async ids => {
      assert.deepEqual(ids, ['81']);
      return [{ id:81, receipt_number:'REC-81', user_name:'Customer', total_amount:12.5, items:[{ product_id:9, product_name:'Milk', quantity:1, unit_price:12.5, subtotal:12.5, email:'private@example.com' }] }];
    } },
  });
  const result = await audit.list({ page:0, role:'', outcome:'', entity:'', search:'', from:'', to:'' });
  assert.equal(result.entries[0].details.linked_order.receipt_number, 'REC-81');
  assert.equal(result.entries[0].details.linked_order.items[0].product_name, 'Milk');
  assert.equal(JSON.stringify(result.entries).includes('private@example.com'), false);
});

test('order audit enrichment batches saved transaction, item, customer and product lookups', async () => {
  const tables = {
    transactions: [{ id:81, receipt_number:'REC-81', user_id:7, total_amount:12.5, payment_method:'cash', tendered_amount:20, change_amount:7.5 }],
    transaction_items: [{ transaction_id:81, product_id:9, quantity:1, unit_price:12.5, subtotal:12.5 }],
    clients: [{ id:7, name:'Customer' }],
    products: [{ id:9, name:'Milk' }],
  };
  const transactionModel = load('models/transaction.model.js', {
    '../config/db': { db:{} },
    '../config/supabase': { from: table => ({
      select() { return this; },
      in(column, ids) {
        assert.ok(Array.isArray(ids));
        return Promise.resolve({ data:tables[table], error:null });
      },
    }) },
  });
  const [order] = await transactionModel.getAuditDetails(['81']);
  assert.equal(order.user_name, 'Customer');
  assert.equal(order.items[0].product_name, 'Milk');
  assert.equal(order.items[0].subtotal, 12.5);
});

test('legacy request context does not invent past totals or attach a later rejection to a submission', () => {
  const { attachInventoryContext, attachOrderContext } = require('../utils/audit-context');
  const doc = { id:'request',status:'rejected',reviewed_by:1,actor_id:2,actor_name:'Staff',actor_role:'staff',reason:'Wrong quantity',inventory_document_items:[{product_id:9,quantity:15,expiry_date:'2099-01-01',products:{name:'Milk'}}] };
  const entry = {entity_id:'request',outcome:'succeeded',action:'Inventory restock',details:{}};
  const [submission, rejection] = attachInventoryContext([entry,{...entry,action:'Inventory reject_restock',actor_name:'Admin',actor_id:1}], [doc]);
  assert.equal(submission.details.linked_request.quantity_requested,15);
  assert.equal(submission.details.linked_request.reason,undefined);
  assert.equal(submission.details.changes,undefined);
  assert.equal(rejection.details.linked_request.reason,'Wrong quantity');
  const frozen={...entry,details:{snapshot_version:1,product:{name:'Original name'}}};
  assert.strictEqual(attachInventoryContext([frozen],[doc])[0],frozen);
  const orderEntry = { id:'audit-id', outcome:'succeeded', entity_type:'Order', action:'Create order', entity_id:'81', details:{requested:{}} };
  const linkedOrders = attachOrderContext([orderEntry], [{
    id:81, receipt_number:'REC-81', user_name:'Customer', total_amount:12.5, payment_method:'cash',
    tendered_amount:20, change_amount:7.5,
    items:[{product_id:9,product_name:'Milk',quantity:1,unit_price:12.5,subtotal:12.5,password:'must not leak'}],
    password:'must not leak',
  }]);
  assert.deepEqual(linkedOrders[0].details.linked_order, {
    receipt_number:'REC-81', customer_name:'Customer', total_amount:12.5, payment_method:'cash',
    tendered_amount:20, change_amount:7.5,
    items:[{product_id:9,product_name:'Milk',quantity:1,unit_price:12.5,subtotal:12.5}],
  });
  assert.strictEqual(attachOrderContext([{...orderEntry, outcome:'failed'}], [{id:81}])[0].details.linked_order, undefined);
});

test('inventory audit RPC uses the server audit ID and does not retry mutation failures', async () => {
  const id='123e4567-e89b-42d3-a456-426614174000';let calls=0;
  const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,args)=>{
    calls++;assert.equal(name,'inventory_audited_command');assert.equal(args.p_audit_id,'server-audit');return {error:{code:'PT409',message:'Stock changed'}};
  }}});
  const req={params:{kind:'restock'},user:{id:2,role:'staff'},auditId:'server-audit',body:{id,payload:{product_id:1,quantity:2,expiry_date:null}}};
  const res=response();await api.command(req,res);assert.equal(res.statusCode,409);assert.equal(calls,1);
});
