const { db } = require('../config/db');
const supabase = require('../config/supabase');
const DAY_MS = 24 * 60 * 60 * 1000;
const reportDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getReportDateKey = (date) => {
  const parts = Object.fromEntries(
    reportDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getReportTransactions = async (period, month) => {
  const allTransactions = await db.transactions.getAll();
  if (period === 'monthly' && month) {
    return allTransactions.filter((transaction) => {
      const date = new Date(transaction.created_at);
      return Number.isFinite(date.getTime()) && getReportDateKey(date).startsWith(`${month}-`);
    });
  }
  const cutoff = Date.now() - (period === 'weekly' ? 7 : 30) * DAY_MS;
  return allTransactions.filter((transaction) => Date.parse(transaction.created_at) >= cutoff);
};

const TransactionModel = {
  async findReplay(receipt, staffId, payload) {
    const { data, error } = await supabase.from('transactions').select('*, transaction_items(product_id,quantity)').eq('receipt_number', receipt).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const normalize = items => {
      const counts = new Map();
      for (const item of items) counts.set(Number(item.product_id), (counts.get(Number(item.product_id)) || 0) + Number(item.quantity));
      return JSON.stringify([...counts.entries()].sort((a,b) => a[0]-b[0]));
    };
    if (data.staff_id !== staffId || data.user_id !== payload.user_id || data.payment_method !== payload.payment_method ||
      Number(data.tendered_amount) !== Number(payload.tendered_amount ?? null) || normalize(data.transaction_items) !== normalize(payload.items)) {
      throw Object.assign(new Error('This checkout reference was already used. Start a new sale.'), { status: 409 });
    }
    return data;
  },
  async create({ receipt_number, user_id, staff_id, total_amount, payment_method, tendered_amount, items, submission_id }) {
    const { data, error } = await supabase.rpc('create_sale_atomic', {
      p_receipt_number: receipt_number,
      p_user_id: user_id,
      p_staff_id: staff_id,
      p_payment_method: payment_method,
      p_tendered_amount: tendered_amount === undefined ? null : tendered_amount,
      p_expected_total: total_amount,
      p_items: items.map(({ product_id, quantity }) => ({ product_id, quantity })),
      p_submission_id: submission_id === undefined ? null : Number(submission_id),
    });
    if (error) {
      const failure = new Error(error.message || 'Unable to record sale.');
      if (['PT400', 'PT403', 'PT409'].includes(error.code)) {
        failure.status = Number(error.code.slice(2));
      }
      throw failure;
    }
    if (!Number.isInteger(data)) throw new Error('Sale did not return a transaction ID.');
    return data;
  },

  async getAll() {
    const transactions = await db.transactions.getAll();
    const sortedTransactions = transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return Promise.all(sortedTransactions.map(async t => {
      const user = t.user_id ? await db.clients.findById(t.user_id) : null;
      const staff = await db.staff.findById(t.staff_id);
      return {
        ...t,
        user_name: user ? user.name : null,
        staff_name: staff ? staff.name : null
      };
    }));
  },

  async getById(id) {
    const transaction = await db.transactions.findById(id);
    if (!transaction) return null;

    const user = transaction.user_id ? await db.clients.findById(transaction.user_id) : null;
    const staff = await db.staff.findById(transaction.staff_id);
    const items = await db.transaction_items.find({ transaction_id: id });
    
    const itemsWithProductName = await Promise.all(items.map(async item => {
      const product = await db.products.findById(item.product_id);
      return { ...item, product_name: product ? product.name : 'Unknown' };
    }));

    return {
      ...transaction,
      user_name: user ? user.name : null,
      staff_name: staff ? staff.name : null,
      items: itemsWithProductName
    };
  },

  async getByUserId(userId) {
    const transactions = await db.transactions.find({ user_id: userId });
    const sortedTransactions = transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return Promise.all(sortedTransactions.map(async t => {
      const staff = await db.staff.findById(t.staff_id);
      const items = await db.transaction_items.find({ transaction_id: t.id });
      const itemsWithProductName = await Promise.all(items.map(async item => {
        const product = await db.products.findById(item.product_id);
        return {
          ...item,
          product_name: product ? product.name : 'Unknown',
          product_price: product ? Number(product.price) : Number(item.unit_price || 0),
        };
      }));

      const productSummary = itemsWithProductName
        .map((item) => `${item.product_name || 'Unknown'} x${Number(item.quantity || 0)}`)
        .join(', ');

      return {
        ...t,
        staff_name: staff ? staff.name : null,
        items: itemsWithProductName,
        product_summary: productSummary
      };
    }));
  },

  async getByStaffId(staffId) {
    const transactions = await db.transactions.find({ staff_id: staffId });
    const sortedTransactions = transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return Promise.all(sortedTransactions.map(async t => {
      const user = t.user_id ? await db.clients.findById(t.user_id) : null;
      return { ...t, user_name: user ? user.name : null };
    }));
  },

  async getSalesByCategory(period = 'monthly', month) {
    const transactions = await getReportTransactions(period, month);
    const categorySales = {};

    for (const t of transactions) {
      const items = await db.transaction_items.find({ transaction_id: t.id });
      for (const item of items) {
        const product = await db.products.findById(item.product_id);
        if (product) {
          const cat = product.category;
          if (!categorySales[cat]) {
            categorySales[cat] = { category: cat, total_sales: 0, transaction_count: new Set() };
          }
          categorySales[cat].total_sales += Number(item.subtotal || 0);
          categorySales[cat].transaction_count.add(t.id);
        }
      }
    }

    return Object.values(categorySales)
      .map(c => ({ ...c, transaction_count: c.transaction_count.size }))
      .sort((a, b) => b.total_sales - a.total_sales);
  },

  async getTopProducts(period = 'monthly', month) {
    const transactions = await getReportTransactions(period, month);
    const productSales = {};

    for (const t of transactions) {
      const items = await db.transaction_items.find({ transaction_id: t.id });
      for (const item of items) {
        const product = await db.products.findById(item.product_id);
        if (product) {
          if (!productSales[product.id]) {
            productSales[product.id] = { name: product.name, category: product.category, total_quantity: 0, total_sales: 0 };
          }
          productSales[product.id].total_quantity += Number(item.quantity || 0);
          productSales[product.id].total_sales += Number(item.subtotal || 0);
        }
      }
    }

    return Object.values(productSales)
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 10);
  },

  async getSalesSummary(period = 'monthly', month) {
    const transactions = await getReportTransactions(period, month);
    const total_transactions = transactions.length;
    const total_revenue = transactions.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);

    return { total_transactions, total_revenue };
  },

  async getSalesTrend(startDate, endDate) {
    const rangeStart = Date.parse(`${startDate}T00:00:00+08:00`);
    const rangeEnd = Date.parse(`${endDate}T00:00:00+08:00`) + DAY_MS;
    const rangeDuration = rangeEnd - rangeStart;
    const previousRangeStart = rangeStart - rangeDuration;
    const dailySales = new Map();

    for (let timestamp = rangeStart; timestamp < rangeEnd; timestamp += DAY_MS) {
      const date = getReportDateKey(new Date(timestamp));
      dailySales.set(date, { date, total_sales: 0, transaction_count: 0 });
    }

    const allTransactions = await db.transactions.getAll();
    const currentTransactions = [];
    const previousTransactions = [];

    for (const transaction of allTransactions) {
      const createdAt = Date.parse(transaction.created_at);
      if (!Number.isFinite(createdAt)) continue;

      if (createdAt >= rangeStart && createdAt < rangeEnd) {
        currentTransactions.push(transaction);
        const date = getReportDateKey(new Date(createdAt));
        const day = dailySales.get(date);
        if (day) {
          day.total_sales += Number(transaction.total_amount || 0);
          day.transaction_count += 1;
        }
      } else if (createdAt >= previousRangeStart && createdAt < rangeStart) {
        previousTransactions.push(transaction);
      }
    }

    const sumRevenue = (transactions) => transactions.reduce(
      (total, transaction) => total + Number(transaction.total_amount || 0),
      0,
    );
    const totalRevenue = sumRevenue(currentTransactions);
    const previousRevenue = sumRevenue(previousTransactions);

    return {
      data: Array.from(dailySales.values()),
      summary: {
        total_transactions: currentTransactions.length,
        total_revenue: totalRevenue,
      },
      comparison: {
        previous_start_date: getReportDateKey(new Date(previousRangeStart)),
        previous_end_date: getReportDateKey(new Date(rangeStart - DAY_MS)),
        total_transactions: previousTransactions.length,
        total_revenue: previousRevenue,
        revenue_change_percent: previousRevenue === 0
          ? null
          : ((totalRevenue - previousRevenue) / previousRevenue) * 100,
      },
    };
  },

  async getRecentTransactions(limit = 10) {
    const allTransactions = await db.transactions.getAll();
    const transactions = allTransactions
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    return Promise.all(transactions.map(async t => {
      const user = t.user_id ? await db.clients.findById(t.user_id) : null;
      const staff = await db.staff.findById(t.staff_id);
      return {
        ...t,
        user_name: user ? user.name : null,
        staff_name: staff ? staff.name : null
      };
    }));
  },

  async getCount() {
    return await db.transactions.count();
  }
};

module.exports = TransactionModel;
