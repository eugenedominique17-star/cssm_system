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
  assert.equal(auditValue(0), '0'); assert.equal(auditValue(null), 'Not set');
});

test('legacy request context does not invent past totals or attach a later rejection to a submission', () => {
  const { attachInventoryContext } = require('../utils/audit-context');
  const doc = { id:'request',status:'rejected',reviewed_by:1,actor_id:2,actor_name:'Staff',actor_role:'staff',reason:'Wrong quantity',inventory_document_items:[{product_id:9,quantity:15,expiry_date:'2099-01-01',products:{name:'Milk'}}] };
  const entry = {entity_id:'request',outcome:'succeeded',action:'Inventory restock',details:{}};
  const [submission, rejection] = attachInventoryContext([entry,{...entry,action:'Inventory reject_restock',actor_name:'Admin',actor_id:1}], [doc]);
  assert.equal(submission.details.linked_request.quantity_requested,15);
  assert.equal(submission.details.linked_request.reason,undefined);
  assert.equal(submission.details.changes,undefined);
  assert.equal(rejection.details.linked_request.reason,'Wrong quantity');
  const frozen={...entry,details:{snapshot_version:1,product:{name:'Original name'}}};
  assert.strictEqual(attachInventoryContext([frozen],[doc])[0],frozen);
});

test('inventory audit RPC uses the server audit ID and does not retry mutation failures', async () => {
  const id='123e4567-e89b-42d3-a456-426614174000';let calls=0;
  const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,args)=>{
    calls++;assert.equal(name,'inventory_audited_command');assert.equal(args.p_audit_id,'server-audit');return {error:{code:'PT409',message:'Stock changed'}};
  }}});
  const req={params:{kind:'restock'},user:{id:2,role:'staff'},auditId:'server-audit',body:{id,payload:{product_id:1,quantity:2,expiry_date:null}}};
  const res=response();await api.command(req,res);assert.equal(res.statusCode,409);assert.equal(calls,1);
});
