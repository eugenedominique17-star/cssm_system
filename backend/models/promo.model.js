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
    const [promos, products] = await Promise.all([db.promos.getAll(), db.products.getAll()]);
    const productImages = new Map(products.map(product => [product.id, {
      name: product.name,
      image_url: product.image_url,
    }]));
    const enriched = promos.map(promo => ({
      ...promo,
      product: promo.product_id ? productImages.get(promo.product_id) || null : null,
      image_url: promo.product_id ? productImages.get(promo.product_id)?.image_url || null : null,
    }));
    const filtered = activeOnly ? filterActivePromos(enriched) : enriched;
    return filtered.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  },

  async getById(id) {
    return await db.promos.findById(id);
  },

  async getActive() {
    const promos = await db.promos.find({ status: 'active' });
    return filterActivePromos(promos).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  },

  async create({ title, description, discount_type, discount_value, start_date, end_date, product_id, status, created_by }) {
    const promo = await db.promos.insert({
      title, description, discount_type, discount_value: parseFloat(discount_value),
      start_date, end_date, product_id: product_id || null, status: status || 'pending', created_by
    });
    return promo.id;
  },

  async update(id, { title, description, discount_type, discount_value, start_date, end_date, product_id, status }) {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (discount_type !== undefined) updates.discount_type = discount_type;
    if (discount_value !== undefined) updates.discount_value = parseFloat(discount_value);
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (product_id !== undefined) updates.product_id = product_id || null;
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