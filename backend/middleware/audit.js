const Audit = require('../models/audit.model');
const { describeRequest, completion } = require('../utils/audit');

// Called after authentication AND authorization, before a mutation controller.
// A durable pending row survives interruptions; no operation runs if start fails.
function createAuditMiddleware(store = Audit) {
  return async (req, res, next) => {
    const event = describeRequest(req);
    if (!event) return next();
    const entry = { ...event, actor_id: String(req.user.id), actor_name: String(req.user.full_name || req.user.name || req.user.user_id || 'User').slice(0, 200), actor_role: req.user.role };
    let id;
    try { id = await store.start(entry); }
    catch (error) {
      console.error('Audit start failed:', error.code || 'unavailable');
      return res.status(503).json({ message: 'Activity logging is unavailable. No changes were made. Please contact the administrator.' });
    }
    req.auditId = id;
    const json = res.json.bind(res);
    let finalized = false;
    res.json = body => {
      if (finalized) return res;
      finalized = true;
      const status = res.statusCode;
      Promise.resolve().then(() => store.finish(id, completion(entry, body, status)))
        .catch(error => {
          // Do not turn a completed sale into a retryable error. Pending row remains visible.
          console.error('Audit completion failed:', id, error.code || 'unavailable');
          res.setHeader('X-Audit-Status', 'pending');
        }).finally(() => json(body));
      return res;
    };
    next();
  };
}

module.exports = { auditMutation: createAuditMiddleware(), createAuditMiddleware };
