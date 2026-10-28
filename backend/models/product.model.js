const { db } = require('../config/db');
const supabase = require('../config/supabase');

const ProductModel = {
  async getAll(activeOnly = false, includePricing = true) {
    let products = await db.products.getAll();
    const { data: availability, error } = await supabase.rpc('inventory_available_stock');
    if (error && error.code !== 'PGRST202') throw error;
    if (!error) {
      const available = new Map(availability.map(row => [row.product_id, Number(row.available_stock || 0)]));
      products = products.map(product => ({ ...product, physical_store_stock: product.stock, stock: available.get(product.id) || 0 }));
    }
    if (activeOnly) {
      products = products.filter(p => p.status === 'active');
    }
    const sorted = products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return includePricing ? sorted : sorted.map(({ purchase_price, selling_markup_percent, ...product }) => product);
  },

  async getById(id) {
    return await db.products.findById(id);
  },

  async create({ name, description, price, purchase_price, selling_markup_percent, stock, category, image_url, expiry_date, status, created_by }) {
    const product = await db.products.insert({
      name, description, price: parseFloat(price), purchase_price, selling_markup_percent, stock: 0,
      category, image_url: image_url || null, expiry_date: null,
      status: status || 'pending', created_by
    });
    return product.id;
  },

  async update(id, { name, description, price, purchase_price, selling_markup_percent, stock, category, image_url, expiry_date, status }) {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price);
    if (purchase_price !== undefined) updates.purchase_price = parseFloat(purchase_price);
    if (selling_markup_percent !== undefined) updates.selling_markup_percent = parseFloat(selling_markup_percent);
    if (stock !== undefined) updates.stock = parseInt(stock);
    if (category !== undefined) updates.category = category;
    if (image_url !== undefined) updates.image_url = image_url;
    if (expiry_date !== undefined) updates.expiry_date = expiry_date || null;
    if (status !== undefined) updates.status = status;
    const result = await db.products.update(id, updates);
    if (!result) throw Object.assign(new Error('Product update failed. Use Inventory for stock changes.'), { status: 409 });
    return result;
  },

  async delete(id) {
    const deleted = await db.products.delete(id);
    if (!deleted) throw Object.assign(new Error('Products with inventory history cannot be deleted. Mark the product inactive instead.'), { status: 409 });
    return deleted;
  },

  async getLowStock(threshold = 10) {
    const products = await this.getAll(true);
    return products.filter(p => p.stock <= threshold);
  },

  async getCount() {
    return await db.products.count();
  }
};

module.exports = ProductModel;
