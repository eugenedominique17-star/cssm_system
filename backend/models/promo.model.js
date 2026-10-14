const { db } = require('../config/db');

const filterActivePromos = (promos = [], now = new Date()) => {
  const current = new Date(now);

  return promos.filter((promo) => {
    if (!promo || promo.status !== 'active') return false;

    const start = promo.start_date ? new Date(promo.start_date) : null;
    const end = promo.end_date ? new Date(promo.end_date) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    return current >= start && current <= end;
  });
};

const PromoModel = {
  async getAll(activeOnly = false) {
    const promos = await db.promos.getAll();
    const filtered = activeOnly ? filterActivePromos(promos) : promos;
    return filtered.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  },

  async getById(id) {
    return await db.promos.findById(id);
  },

  async getActive() {
    const promos = await db.promos.find({ status: 'active' });
    return filterActivePromos(promos).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  },

  async create({ title, description, discount_type, discount_value, start_date, end_date, status, created_by }) {
    const promo = await db.promos.insert({
      title, description, discount_type, discount_value: parseFloat(discount_value),
      start_date, end_date, status: status || 'pending', created_by
    });
    return promo.id;
  },

  async update(id, { title, description, discount_type, discount_value, start_date, end_date, status }) {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (status !== undefined) updates.status = status;
    return await db.promos.update(id, updates);
  },

  async delete(id) {
    return await db.promos.delete(id);
  },

  async getCount() {
    return await db.promos.count();
  }
};

PromoModel.filterActivePromos = filterActivePromos;
module.exports = PromoModel;