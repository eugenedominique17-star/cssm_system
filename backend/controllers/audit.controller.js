const Audit = require('../models/audit.model');
const AuditSecret = require('../models/audit-secret.model');
const UserModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const authPassword = require('../utils/supabase-auth-password');
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

exports.list = async (req, res) => {
  const { role = '', outcome = '', entity = '', search = '', from = '', to = '', page = '0' } = req.query;
  if (![role, outcome, entity, search, from, to, page].every(v => typeof v === 'string') ||
      !/^\d{1,6}$/.test(page) || search.length > 100 ||
      !['', 'admin', 'staff', 'client'].includes(role) ||
      !['', 'pending', 'succeeded', 'failed'].includes(outcome) ||
      !['', 'Product', 'Promo', 'Account', 'Order', 'Approval', 'Inventory'].includes(entity) ||
      (from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) {
    return res.status(400).json({ message: 'Invalid audit filters or date range.' });
  }
  try {
    const result = await Audit.list({ page: Number(page), role, outcome, entity, search: search.replace(/[%_\\]/g, ''), from, to });
    res.json(result);
  } catch (error) {
    console.error('Audit list failed:', error.code || 'unavailable');
    res.status(503).json({ message: 'Audit history is unavailable. Check the audit database migration and connection.' });
  }
};

exports.revealPreviousPassword = async (req, res) => {
  return revealForAuditEvent(req, res, req.params.id);
};

async function revealForAuditEvent(req, res, auditEventId) {
  const adminPassword = req.body?.adminPassword;
  let auditId;
  const finish = async (outcome, details = {}) => {
    if (auditId) await Audit.finish(auditId, { outcome, entity_id: auditEventId, details: { ...details, http_status: outcome === 'succeeded' ? 200 : 403 } });
  };
  try {
    auditId = await Audit.start({ actor_id: String(req.user.id), actor_name: String(req.user.full_name || req.user.name || req.user.user_id || 'Admin'), actor_role: 'admin', action: 'Reveal previous password', entity_type: 'Account', entity_id: auditEventId, details: { requested: {} } });
    if (typeof adminPassword !== 'string' || !adminPassword) {
      await finish('failed', { result: 'Fresh admin authentication was not provided.' });
      return res.status(401).json({ message: 'Enter your current admin password.' });
    }
    const admin = await UserModel.findByIdWithPassword(req.user.id);
    if (!admin) return res.status(401).json({ message: 'Admin authentication failed.' });
    if (admin.auth_user_id) await authPassword.verifyCurrentPassword(admin.auth_user_id, admin.email, adminPassword);
    else if (!await bcrypt.compare(adminPassword, admin.password)) throw Object.assign(new Error('Current admin password is incorrect.'), { status: 401 });
    const previousPassword = await AuditSecret.reveal(auditEventId);
    if (previousPassword === null) {
      await finish('failed', { result: 'Previous password is unavailable.' });
      return res.status(404).json({ message: 'Previous password is unavailable.' });
    }
    await finish('succeeded', { result: 'Previous password revealed.' });
    return res.json({ previousPassword });
  } catch (error) {
    if (auditId) await finish('failed', { result: 'Previous password reveal was denied.' }).catch(() => {});
    return res.status(error.status || 401).json({ message: error.status ? error.message : 'Admin authentication failed.' });
  }
}

exports.revealPreviousPasswordForUser = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const auditEvent = await Audit.latestPasswordChangeForUser(user.id);
    if (!auditEvent) return res.status(404).json({ message: 'No previous password is available for this user.' });
    return revealForAuditEvent(req, res, auditEvent.id);
  } catch (error) {
    console.error('Find previous password failed:', error.code || error.message);
    return res.status(503).json({ message: 'Previous password is unavailable.' });
  }
};
