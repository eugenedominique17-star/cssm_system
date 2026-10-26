/**
 * SSE (Server-Sent Events) Manager
 * Manages real-time connections per user for order status updates.
 */

// Map<userId, Set<res>> — one user can have multiple tabs
const clients = new Map();
const supabase = require('./config/supabase');
const UserModel = require('./models/user.model');

/**
 * Register a new SSE client connection.
 * @param {number|string} userId
 * @param {import('express').Response} res
 */
function addClient(userId, res) {
  const id = String(userId);
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(res);
}

/**
 * Remove a client when the connection closes.
 * @param {number|string} userId
 * @param {import('express').Response} res
 */
function removeClient(userId, res) {
  const id = String(userId);
  const set = clients.get(id);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(id);
}

/**
 * Send an SSE event to a specific user.
 * @param {number|string} userId
 * @param {string} event  - event name
 * @param {object} data   - payload (will be JSON-stringified)
 */
function publishToSupabaseUser(userId, event, data) {
  if (!supabase) return Promise.resolve();

  return UserModel.findById(userId).then(async user => {
    if (!user?.auth_user_id) return;

    const channel = supabase.channel(`order-status:${user.auth_user_id}`, {
      config: { private: true },
    });
    try {
      const status = await channel.send({ type: 'broadcast', event, payload: data });
      if (status !== 'ok') {
        console.error('Supabase Realtime order notification was not delivered:', status);
      }
    } finally {
      await supabase.removeChannel(channel);
    }
  }).catch(error => {
    console.error('Supabase Realtime order notification failed:', error.code || error.name || 'unknown');
  });
}

function sendToUser(userId, event, data) {
  const id = String(userId);
  const set = clients.get(id);
  if (set && set.size > 0) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
      try {
        res.write(payload);
      } catch {
        set.delete(res);
      }
    }
  }
  return publishToSupabaseUser(userId, event, data);
}

/**
 * Broadcast an SSE event to ALL connected clients.
 * @param {string} event
 * @param {object} data
 */
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, set] of clients) {
    for (const res of set) {
      try {
        res.write(payload);
      } catch {
        set.delete(res);
      }
    }
  }
}

module.exports = { addClient, removeClient, sendToUser, broadcast };
