const ProductModel = require('../models/product.model');
const PromoModel = require('../models/promo.model');

exports.getHomepageData = async (req, res) => {
  try {
    const products = await ProductModel.getAll(true, false);
    const promos = await PromoModel.getAll(true);
    res.json({ products, promos });
  } catch (error) {
    console.error('Get homepage data error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};