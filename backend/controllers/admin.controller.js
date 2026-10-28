const UserModel = require('../models/user.model');
const ProductModel = require('../models/product.model');
const PromoModel = require('../models/promo.model');
const TransactionModel = require('../models/transaction.model');
const SubmissionModel = require('../models/submission.model');
const { accountStatusDetails, submissionReviewDetails } = require('../utils/audit');

const isValidReportDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await UserModel.getCount();
    const totalProducts = await ProductModel.getCount();
    const totalTransactions = await TransactionModel.getCount();
    const pendingStaff = (await UserModel.getPendingStaff()).length;
    const pendingClients = (await UserModel.getPendingClients()).length;
    const pendingSubmissions = await SubmissionModel.getPendingCount();
    const recentTransactions = await TransactionModel.getRecentTransactions(5);

    res.json({
      totalUsers,
      totalProducts,
      totalTransactions,
      pendingStaff,
      pendingClients,
      pendingSubmissions,
      recentTransactions
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getPendingStaff = async (req, res) => {
  try {
    const pending = await UserModel.getPendingStaff();
    res.json(pending);
  } catch (error) {
    console.error('Get pending staff error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getPendingClients = async (req, res) => {
  try {
    const pending = await UserModel.getPendingClients();
    res.json(pending);
  } catch (error) {
    console.error('Get pending clients error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.approveStaff = async (req, res) => {
  try {
    const { status } = req.body; // 'active' or 'rejected'
    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "active" or "rejected".' });
    }
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const updated = await UserModel.updateStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: 'User not found.' });
    req.accountAuditDetails = accountStatusDetails(user, updated);
    res.json({ message: `Staff account ${status === 'active' ? 'approved' : 'rejected'} successfully.` });
  } catch (error) {
    console.error('Approve staff error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getPendingSubmissions = async (req, res) => {
  try {
    const submissions = await SubmissionModel.getAll('pending');
    res.json(submissions);
  } catch (error) {
    console.error('Get pending submissions error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getMySubmissions = async (req, res) => {
  try {
    const submissions = await SubmissionModel.getByUserId(req.user.id);
    res.json(submissions);
  } catch (error) {
    console.error('Get staff submissions error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.approveSubmission = async (req, res) => {
  try {
    const { status, admin_notes } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "approved" or "rejected".' });
    }

    const submission = await SubmissionModel.getById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });

    if (submission.status !== 'pending') return res.status(409).json({ message: 'This submission has already been reviewed.' });
    if (admin_notes != null && (typeof admin_notes !== 'string' || admin_notes.length > 2000)) {
      return res.status(400).json({ message: 'Review notes must be at most 2000 characters.' });
    }
    let credentials;
    let passwordHash = null;
    let passwordResetTarget = null;
    if (status === 'approved' && submission.type === 'password_reset') {
      const target = await UserModel.findByIdWithPassword(submission.data.target_user_id);
      if (!target || target.role === 'admin') return res.status(400).json({ message: 'Invalid password reset target.' });
      passwordResetTarget = target;
      const password = require('../utils/password').generateTempPassword();
      passwordHash = await require('bcryptjs').hash(password, 10);
      credentials = { user_id: target.user_id, email: target.email, password };
    }
    const result = await SubmissionModel.reviewAtomic(req.params.id, status, admin_notes, req.user.id, passwordHash);
    req.submissionAuditDetails = submissionReviewDetails(result.before, result.after);
    res.setHeader('Cache-Control', 'no-store');
    if (credentials && passwordResetTarget?.auth_user_id) {
      try {
        await require('../utils/supabase-auth-password').updateSupabasePassword(
          passwordResetTarget.auth_user_id,
          credentials.password,
        );
      } catch (error) {
        const restored = await UserModel.updatePassword(
          passwordResetTarget.id,
          passwordResetTarget.password,
          Boolean(passwordResetTarget.must_change_password),
        );
        if (!restored) {
          console.error('Password reset rollback failed after Supabase Auth update error:', error.code || 'unavailable');
          return res.status(503).json({
            message: 'Submission review completed, but password synchronization failed and the prior password could not be restored. Reset the account through Account Management immediately.',
          });
        }
        console.error('Supabase Auth password reset failed; previous account password was restored:', error.code || 'unavailable');
        return res.status(503).json({
          message: 'Submission review completed, but Supabase Auth password reset failed. The prior account password was restored; issue a new reset through Account Management.',
        });
      }
    }
    res.json({ message: 'Submission ' + status + ' successfully.', ...(credentials ? { credentials } : {}) });
  } catch (error) {
    console.error('Approve submission error:', error.code || 'unavailable');
    const status = error.status || 500;
    res.status(status).json({ message: status < 500 ? error.message : 'Submission review could not be saved. Check its status before retrying.' });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { period = 'monthly', chart = 'sales_category', month } = req.query;
    const validPeriods = ['daily', 'weekly', 'monthly', 'custom'];
    const validCharts = ['sales_category', 'top_products', 'sales_trend', 'damage_returns'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({ message: 'Invalid period. Use "daily", "weekly", "monthly", or "custom".' });
    }
    if (!validCharts.includes(chart)) {
      return res.status(400).json({ message: 'Invalid chart type.' });
    }
    if (month !== undefined && (period !== 'monthly' || typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
      return res.status(400).json({ message: 'Use a valid month in YYYY-MM format with the monthly period.' });
    }

    let { start_date, end_date } = req.query;
    if (period === 'daily') {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      start_date = today;
      end_date = today;
    } else if (period === 'custom') {
      ({ start_date, end_date } = req.query);
    }

    if (period === 'custom' && (!isValidReportDate(start_date) || !isValidReportDate(end_date))) {
      return res.status(400).json({ message: 'Provide valid start_date and end_date values in YYYY-MM-DD format.' });
    }

    if (period === 'custom' && start_date > end_date) {
      return res.status(400).json({ message: 'end_date must be on or after start_date.' });
    }

    if (chart === 'damage_returns') {
      if (!start_date || !end_date) {
        const now = new Date();
        if (period === 'monthly' && month) {
          const [year, monthNumber] = month.split('-').map(Number);
          start_date = `${month}-01`;
          end_date = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`;
        } else {
          const dateInManila = value => new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(value);
          end_date = dateInManila(now);
          const start = new Date(`${end_date}T00:00:00Z`);
          start.setUTCDate(start.getUTCDate() - (period === 'daily' ? 0 : period === 'weekly' ? 6 : 29));
          start_date = start.toISOString().slice(0, 10);
        }
      }
      const { data, error } = await require('../config/supabase').rpc('inventory_loss_report', {
        p_start: start_date,
        p_end: end_date,
      });
      if (error) throw error;
      return res.json({ data: data || [], period, chart, month: month || null, start_date, end_date });
    }

    if (chart === 'sales_trend') {
      if (period === 'daily' || period === 'custom') {
        const rangeStart = Date.parse(`${start_date}T00:00:00.000Z`);
        const rangeEnd = Date.parse(`${end_date}T00:00:00.000Z`);
        const dayCount = (rangeEnd - rangeStart) / (24 * 60 * 60 * 1000) + 1;
        if (period === 'custom' && dayCount > 366) {
          return res.status(400).json({ message: 'The selected date range cannot exceed 366 days.' });
        }
      }
      if (period !== 'daily' && period !== 'custom' && (!isValidReportDate(start_date) || !isValidReportDate(end_date))) {
        return res.status(400).json({ message: 'Provide valid start_date and end_date values in YYYY-MM-DD format.' });
      }

      const startTime = Date.parse(`${start_date}T00:00:00.000Z`);
      const endTime = Date.parse(`${end_date}T00:00:00.000Z`);
      const dayCount = (endTime - startTime) / (24 * 60 * 60 * 1000) + 1;
      if (dayCount < 1) {
        return res.status(400).json({ message: 'end_date must be on or after start_date.' });
      }
      if (dayCount > 366) {
        return res.status(400).json({ message: 'The selected date range cannot exceed 366 days.' });
      }

      const report = await TransactionModel.getSalesTrend(start_date, end_date);
      return res.json({ ...report, period, chart, start_date, end_date });
    }

    let data;
    if (chart === 'sales_category') {
      data = await TransactionModel.getSalesByCategory(period, month, start_date, end_date);
    } else {
      data = await TransactionModel.getTopProducts(period, month, start_date, end_date);
    }

    const summary = await TransactionModel.getSalesSummary(period, month, start_date, end_date);

    res.json({ data, summary, period, chart, month: month || null });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
