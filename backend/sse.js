/**
 * SSE (Server-Sent Events) Manager
 * Manages real-time connections per user for order status updates.
 */

// Map<userId, Set<res>> — one user can have multiple tabs
const clients = new Map();

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
function sendToUser(userId, event, data) {
  const id = String(userId);
  const set = clients.get(id);
  if (!set || set.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // Connection already gone — clean up silently
      set.delete(res);
    }
  }
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
