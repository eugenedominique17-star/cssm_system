const Audit = require('../models/audit.model');
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
