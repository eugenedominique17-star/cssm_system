const express = require('express');
const router = express.Router();
const { getAuthenticatedUser } = require('../middleware/auth');
const { addClient, removeClient } = require('../sse');
require('dotenv').config();

/**
 * GET /api/sse/orders
 * Establishes a Server-Sent Events connection for the authenticated client.
 * The token must be passed as a query param: ?token=<jwt>
 * (SSE connections cannot set custom headers from EventSource in browsers)
 */
router.get('/orders', async (req, res) => {
  // Authenticate via query token (SSE / EventSource limitation)
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  let user;
  try {
    user = await getAuthenticatedUser(token);
  } catch (error) {
    return res.status(error.status || 503).json({ message: error.status ? error.message : 'Unable to verify account.' });
  }

  // Only clients (end-users) listen to their own order updates
  const normalizedRole = typeof user.role === 'string'
    ? (user.role.trim().toLowerCase() === 'user' ? 'client' : user.role.trim().toLowerCase())
    : user.role;

  if (normalizedRole !== 'client' || user.must_change_password) {
    return res.status(403).json({ message: 'Forbidden.' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if applicable
  res.flushHeaders();

  // Send an initial "connected" event so the client knows the stream is ready
  res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id })}\n\n`);

  // Register this client
  addClient(user.id, res);

  // Heartbeat every 25 seconds to keep the connection alive through proxies
  const heartbeat = setInterval(async () => {
    try {
      const current = await getAuthenticatedUser(token);
      if (current.must_change_password) throw new Error('Password change required');
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      removeClient(user.id, res);
      res.end();
    }
  }, 25000);

  // Clean up when connection closes
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(user.id, res);
  });
});

module.exports = router;
