const UserModel = require('../models/user.model');
const ProductModel = require('../models/product.model');
const PromoModel = require('../models/promo.model');
const TransactionModel = require('../models/transaction.model');
const SubmissionModel = require('../models/submission.model');

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
    await UserModel.updateStatus(req.params.id, status);
    res.json({ message: `Staff account ${status === 'active' ? 'approved' : 'rejected'} successfully.` });
  } catch (error) {
    console.error('Approve staff error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getPendingSubmissions = async (req, res) => {
  try {
    const submissions = await SubmissionModel.getAll('pending');
    res.json(submissions.filter(submission => submission.type !== 'walk_in_order'));
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
    if (submission.type === 'walk_in_order') {
      return res.status(410).json({ message: 'Legacy order requests cannot be approved as sales. Use the cashier for direct in-store purchases.' });
    }

    if (status === 'approved') {
      const data = submission.data;
      if ((submission.type === 'stock_update' && data.stock !== undefined) || (submission.type === 'product' && Number(data.stock || 0) !== 0)) {
        return res.status(409).json({ message: 'This legacy stock request cannot be approved. Reject it and use Bodega Inventory receiving or transfer instead.' });
      }
      switch (submission.type) {
        case 'product':
          await ProductModel.create({
            name: data.name,
            description: data.description,
            price: data.price,
            stock: data.stock,
            category: data.category,
            image_url: data.image_url,
            expiry_date: data.expiry_date,
            status: 'active',
            created_by: submission.submitted_by
          });
          break;
        case 'promo':
          await PromoModel.create({
            title: data.title,
            description: data.description,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            start_date: data.start_date,
            end_date: data.end_date,
            status: 'active',
            created_by: submission.submitted_by
          });
          break;
        case 'stock_update':
          if (data.product_id) {
            await ProductModel.update(data.product_id, {
              name: data.name,
              description: data.description,
              price: data.price,
              category: data.category,
              image_url: data.image_url,
            });
          }
          break;
        // Additive: staff-requested password reset — apply simple pattern temp password
        case 'password_reset': {
          const bcrypt = require('bcryptjs');
          const target = await UserModel.findByIdWithPassword(data.target_user_id);
          if (target) {
            const tempPassword = `${String(target.role || 'client').toLowerCase()}123`;
            const saltRounds = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(tempPassword, saltRounds);
            await UserModel.updatePassword(target.id, hashed, true);
          }
          break;
        }
      }
    }

    await SubmissionModel.updateStatus(req.params.id, status, admin_notes);
    res.json({ message: `Submission ${status === 'approved' ? 'approved' : 'rejected'} successfully.` });
  } catch (error) {
    console.error('Approve submission error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { period = 'monthly', chart = 'sales_category', month } = req.query;
    const validPeriods = ['weekly', 'monthly'];
    const validCharts = ['sales_category', 'top_products', 'sales_trend'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({ message: 'Invalid period. Use "weekly" or "monthly".' });
    }
    if (!validCharts.includes(chart)) {
      return res.status(400).json({ message: 'Invalid chart type.' });
    }
    if (month !== undefined && (period !== 'monthly' || typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
      return res.status(400).json({ message: 'Use a valid month in YYYY-MM format with the monthly period.' });
    }

    if (chart === 'sales_trend' || req.query.start_date !== undefined || req.query.end_date !== undefined) {
      const { start_date, end_date } = req.query;
      if (!isValidReportDate(start_date) || !isValidReportDate(end_date)) {
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

      if (chart === 'sales_trend') {
        const report = await TransactionModel.getSalesTrend(start_date, end_date);
        return res.json({ ...report, period: 'custom', chart, start_date, end_date });
      }
      const data = chart === 'sales_category'
        ? await TransactionModel.getSalesByCategory(period, month, start_date, end_date)
        : await TransactionModel.getTopProducts(period, month, start_date, end_date);
      const summary = await TransactionModel.getSalesSummary(period, month, start_date, end_date);
      return res.json({ data, summary, period: 'custom', chart, start_date, end_date });
    }

    let data;
    if (chart === 'sales_category') {
      data = await TransactionModel.getSalesByCategory(period, month);
    } else {
      data = await TransactionModel.getTopProducts(period, month);
    }

    const summary = await TransactionModel.getSalesSummary(period, month);

    res.json({ data, summary, period, chart, month: month || null });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
