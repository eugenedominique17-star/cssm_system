const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
process.env.AUDIT_SECRET_KEY ||= '00'.repeat(32);

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

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const request = token => ({
  headers: { authorization: `Bearer ${token}` },
  method: 'GET',
  baseUrl: '/api/products',
  path: '/',
});

test('Express accepts only active, linked Supabase Auth identities', async () => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'supabase-compat-test-secret';
  try {
    let profile = { id: 1000001, user_id: 'C000001', email: 'client@example.com', role: 'client', status: 'active' };
    const { authenticate } = load('middleware/auth.js', {
      '../models/user.model': { findBySupabaseToken: async () => profile },
      './audit': { auditMutation() {} },
      dotenv: { config() {} },
    });

    let next = 0;
    const req = request('supabase-access-token');
    await authenticate(req, response(), () => next++);
    assert.equal(next, 1);
    assert.equal(req.user.id, 1000001);
    assert.equal(req.user.role, 'client');

    for (const value of [null, { ...profile, status: 'inactive' }]) {
      profile = value;
      const res = response();
      await authenticate(request('supabase-access-token'), res, () => assert.fail('Inactive or unmapped identity was accepted'));
      assert.equal(res.statusCode, 401);
    }
  } finally {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  }
});

test('Supabase identity lookup failures fail closed with 503', async () => {
  const { authenticate } = load('middleware/auth.js', {
    '../models/user.model': {
      findBySupabaseToken: async () => { throw Object.assign(new Error('offline'), { status: 503 }); },
    },
    './audit': { auditMutation() {} },
    dotenv: { config() {} },
  });
  const res = response();
  await authenticate(request('supabase-access-token'), res, () => assert.fail('Lookup failure was accepted'));
  assert.equal(res.statusCode, 503);
});

test('auth identity lookup returns a role-tagged profile without password hashes', async () => {
  const rows = {
    clients: null,
    staff: {
      id: 2000001,
      auth_user_id: 'auth-uuid',
      email: 'staff@example.com',
      password: '$2b$hash',
      status: 'active',
    },
    admins: null,
  };
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
      };
    },
  };
  const users = load('models/user.model.js', {
    '../config/db': { db: {} },
    '../config/supabase': supabase,
  });

  const profile = await users.findByAuthUserId('auth-uuid');
  assert.equal(profile.id, 2000001);
  assert.equal(profile.role, 'staff');
  assert.equal(profile.password, undefined);
});

test('linked password changes verify and update Supabase Auth before saving the legacy hash', async () => {
  const calls = [];
  const api = load('controllers/auth.controller.js', {
    '../models/user.model': {
      findByIdWithPassword: async () => ({
        id: 2000001,
        auth_user_id: 'auth-uuid',
        email: 'staff@example.com',
        password: 'old-hash',
      }),
      updatePassword: async (...args) => { calls.push(['legacy', ...args]); return { id: args[0] }; },
    },
    '../utils/supabase-auth-password': {
      verifyCurrentPassword: async (...args) => calls.push(['verify', ...args]),
      updateSupabasePassword: async (...args) => calls.push(['supabase', ...args]),
    },
    '../models/audit-secret.model': { save: async (...args) => calls.push(['audit-secret', ...args]) },
    bcryptjs: {
      genSalt: async () => 'salt',
      hash: async () => 'new-hash',
    },
  });
  const res = response();
  await api.changePassword({
    user: { id: 2000001 }, auditId: 'audit-id',
    body: { currentPassword: 'old-pass', newPassword: 'new-pass' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [
    ['verify', 'auth-uuid', 'staff@example.com', 'old-pass'],
    ['supabase', 'auth-uuid', 'new-pass'],
    ['legacy', 2000001, 'new-hash', false],
    ['audit-secret', 'audit-id', 'old-pass'],
  ]);
});

test('linked password change rolls back Auth when the legacy profile write fails', async () => {
  const authPasswords = [];
  const api = load('controllers/auth.controller.js', {
    '../models/user.model': {
      findByIdWithPassword: async () => ({
        id: 2000001,
        auth_user_id: 'auth-uuid',
        email: 'staff@example.com',
        password: 'old-hash',
      }),
      updatePassword: async () => null,
    },
    '../utils/supabase-auth-password': {
      verifyCurrentPassword: async () => {},
      updateSupabasePassword: async (_id, password) => authPasswords.push(password),
    },
    '../models/audit-secret.model': { save: async () => {} },
    bcryptjs: {
      genSalt: async () => 'salt',
      hash: async () => 'new-hash',
    },
  });
  const res = response();
  await api.changePassword({
    user: { id: 2000001 },
    body: { currentPassword: 'old-pass', newPassword: 'new-pass' },
  }, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(authPasswords, ['new-pass', 'old-pass']);
});

test('admin reset synchronizes linked Supabase Auth before revealing credentials', async () => {
  const calls = [];
  const api = load('controllers/user.controller.js', {
    '../models/user.model': {
      findByIdWithPassword: async () => ({
        id: 2000001,
        auth_user_id: 'auth-uuid',
        email: 'staff@example.com',
        user_id: 'S000001',
        name: 'Staff',
        role: 'staff',
        password: 'old-hash',
        must_change_password: false,
      }),
      updatePassword: async (...args) => { calls.push(['legacy', ...args]); return { id: args[0] }; },
    },
    '../utils/supabase-auth-password': {
      updateSupabasePassword: async (...args) => calls.push(['supabase', ...args]),
    },
    bcryptjs: {
      genSalt: async () => 'salt',
      hash: async () => 'temp-hash',
    },
  });
  const res = response();
  await api.resetPassword({ params: { id: '2000001' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.credentials.email, 'staff@example.com');
  assert.deepEqual(calls[0], ['legacy', 2000001, 'temp-hash', true]);
  assert.equal(calls[1][0], 'supabase');
  assert.equal(calls[1][1], 'auth-uuid');
  assert.equal(calls[1][2], res.body.credentials.password);
});

test('admin reset restores the legacy password and withholds credentials if Auth reset fails', async () => {
  const passwordWrites = [];
  const api = load('controllers/user.controller.js', {
    '../models/user.model': {
      findByIdWithPassword: async () => ({
        id: 2000001,
        auth_user_id: 'auth-uuid',
        email: 'staff@example.com',
        role: 'staff',
        password: 'old-hash',
        must_change_password: false,
      }),
      updatePassword: async (...args) => {
        passwordWrites.push(args);
        return { id: args[0] };
      },
    },
    '../utils/supabase-auth-password': {
      updateSupabasePassword: async () => {
        throw Object.assign(new Error('Auth unavailable.'), { status: 503 });
      },
    },
    bcryptjs: {
      genSalt: async () => 'salt',
      hash: async () => 'temp-hash',
    },
  });
  const res = response();
  await api.resetPassword({ params: { id: '2000001' } }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.credentials, undefined);
  assert.equal(passwordWrites.length, 2);
  assert.deepEqual(passwordWrites[0], [2000001, 'temp-hash', true]);
  assert.deepEqual(passwordWrites[1], [2000001, 'old-hash', false]);
});

test('password-reset submission approval synchronizes linked Supabase Auth', async () => {
  const calls = [];
  const target = {
    id: 2000001,
    auth_user_id: 'auth-uuid',
    role: 'staff',
    user_id: 'S000001',
    email: 'staff@example.com',
    password: 'old-hash',
    must_change_password: false,
  };
  const api = load('controllers/admin.controller.js', {
    '../models/user.model': {
      findByIdWithPassword: async () => target,
      updatePassword: async (...args) => { calls.push(['restore', ...args]); return { id: args[0] }; },
    },
    '../models/product.model': {},
    '../models/promo.model': {},
    '../models/transaction.model': {},
    '../models/submission.model': {
      getById: async () => ({
        id: 7,
        type: 'password_reset',
        status: 'pending',
        data: { target_user_id: target.id },
      }),
      reviewAtomic: async (...args) => {
        calls.push(['review', ...args]);
        return { before: {}, after: {} };
      },
    },
    '../utils/audit': { accountStatusDetails() {}, submissionReviewDetails: () => ({ reviewed: true }) },
    '../utils/password': { generateTempPassword: () => 'TempPassword123!' },
    bcryptjs: { hash: async () => 'new-hash' },
    '../utils/supabase-auth-password': {
      updateSupabasePassword: async (...args) => calls.push(['auth', ...args]),
    },
  });
  const res = response();
  res.setHeader = () => {};
  await api.approveSubmission({
    params: { id: '7' },
    body: { status: 'approved' },
    user: { id: 3000001 },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.map(call => call[0]), ['review', 'auth']);
  assert.deepEqual(calls[1], ['auth', 'auth-uuid', res.body.credentials.password]);
});

test('failed Auth reset after review restores the existing password and withholds temporary credentials', async () => {
  const restored = [];
  const target = {
    id: 2000001,
    auth_user_id: 'auth-uuid',
    role: 'staff',
    user_id: 'S000001',
    email: 'staff@example.com',
    password: 'old-hash',
    must_change_password: false,
  };
  const api = load('controllers/admin.controller.js', {
    '../models/user.model': {
      findByIdWithPassword: async () => target,
      updatePassword: async (...args) => { restored.push(args); return { id: args[0] }; },
    },
    '../models/product.model': {},
    '../models/promo.model': {},
    '../models/transaction.model': {},
    '../models/submission.model': {
      getById: async () => ({
        id: 7,
        type: 'password_reset',
        status: 'pending',
        data: { target_user_id: target.id },
      }),
      reviewAtomic: async () => ({ before: {}, after: {} }),
    },
    '../utils/audit': { accountStatusDetails() {}, submissionReviewDetails: () => ({ reviewed: true }) },
    '../utils/password': { generateTempPassword: () => 'TempPassword123!' },
    bcryptjs: { hash: async () => 'new-hash' },
    '../utils/supabase-auth-password': {
      updateSupabasePassword: async () => {
        throw Object.assign(new Error('Auth unavailable.'), { status: 503, code: 'unavailable' });
      },
    },
  });
  const res = response();
  res.setHeader = () => {};
  await api.approveSubmission({
    params: { id: '7' },
    body: { status: 'approved' },
    user: { id: 3000001 },
  }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.credentials, undefined);
  assert.deepEqual(restored, [[2000001, 'old-hash', false]]);
});
