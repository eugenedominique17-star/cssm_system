const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function load(supabase, user) {
  const filename = path.resolve(__dirname, '..', 'sse.js');
  const localRequire = Module.createRequire(filename);
  const mocks = {
    './config/supabase': supabase,
    './models/user.model': { findById: async () => user },
  };
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}

test('order notifications publish to a private channel for the linked Auth identity', async () => {
  const calls = [];
  const channel = {
    async send(message) {
      calls.push(['send', message]);
      return 'ok';
    },
  };
  const supabase = {
    channel(topic, options) {
      calls.push(['channel', topic, options]);
      return channel;
    },
    async removeChannel(value) {
      calls.push(['remove', value]);
    },
  };
  const notifications = load(supabase, { auth_user_id: 'auth-uuid' });
  const payload = { status: 'completed', receipt_number: 'REC-1' };

  await notifications.sendToUser(1000001, 'order_status_update', payload);

  assert.deepEqual(calls, [
    ['channel', 'order-status:auth-uuid', { config: { private: true } }],
    ['send', { type: 'broadcast', event: 'order_status_update', payload }],
    ['remove', channel],
  ]);
});

test('unlinked legacy accounts retain their in-process SSE notification path', async () => {
  const notifications = load(null, { auth_user_id: null });
  let received;
  const response = { write: value => { received = value; } };

  notifications.addClient(1000001, response);
  await notifications.sendToUser(1000001, 'order_status_update', { status: 'completed' });

  assert.equal(received, 'event: order_status_update\ndata: {"status":"completed"}\n\n');
  notifications.removeClient(1000001, response);
});
