const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function controller(update) {
  const filename = path.resolve(__dirname, '../controllers/auth.controller.js');
  const localRequire = Module.createRequire(filename);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => name === '../models/user.model' ? { update } : name === 'dotenv' ? { config() {} } : localRequire(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('client name update uses authenticated identity, trims names and excludes password', async () => {
  const updates = [];
  const api = controller(async (id, fields) => { updates.push({ id, fields }); return { id, ...fields, password: 'private' }; });
  const res = response();
  await api.updateProfile({ user: { id: 100, role: 'client' }, body: { first_name: ' Maria Ana ', middle_name: ' ', last_name: " De la Cruz " } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(updates, [{ id: 100, fields: { first_name: 'Maria Ana', middle_name: '', last_name: 'De la Cruz', name: 'Maria Ana De la Cruz' } }]);
  assert.equal(res.body.user.role, 'client');
  assert.equal(Object.hasOwn(res.body.user, 'password'), false);
});

test('profile rejects unauthorized roles and protected fields before updating', async () => {
  const api = controller(async () => { assert.fail('Invalid profile must not be saved'); });
  for (const [role, extra, status] of [['admin', {}, 403], ['staff', {}, 403], ['client', { id: 999 }, 400], ['client', { role: 'admin' }, 400], ['client', { status: 'active' }, 400]]) {
    const res = response();
    await api.updateProfile({ user: { id: 100, role }, body: { first_name: 'Ana', last_name: 'Cruz', ...extra } }, res);
    assert.equal(res.statusCode, status);
  }
});

test('profile requires first and last names and respects stored full-name length', async () => {
  const api = controller(async () => { assert.fail('Invalid name must not be saved'); });
  for (const body of [{ first_name: ' ', last_name: 'Cruz' }, { first_name: 'Ana' }, { first_name: 'A'.repeat(60), last_name: 'B'.repeat(60) }]) {
    const res = response();
    await api.updateProfile({ user: { id: 100, role: 'client' }, body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('failed database update does not return profile success', async () => {
  const api = controller(async () => null);
  const res = response();
  await api.updateProfile({ user: { id: 100, role: 'client' }, body: { first_name: 'Ana', last_name: 'Cruz' } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.user, undefined);
});
