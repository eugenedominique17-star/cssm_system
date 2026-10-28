const Joi = require('joi');
const ProductModel = require('../models/product.model');
const SubmissionModel = require('../models/submission.model');

const productSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  price: Joi.number().positive().required(),
  purchase_price: Joi.number().positive().max(99999999).precision(2).required(),
  selling_markup_percent: Joi.number().min(0).max(10000).precision(2).required(),
  stock: Joi.number().valid(0).default(0),
  category: Joi.string().min(2).max(100).required(),
  image_url: Joi.string().allow('', null),
  expiry_date: Joi.valid('', null).optional()
}).custom((value, helpers) => {
  const expected = Math.round((value.purchase_price * (1 + value.selling_markup_percent / 100) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(expected) || expected <= 0 || expected > 99999999 || value.price !== expected) {
    return helpers.error('any.invalid');
  }
  return value;
}, 'purchase price and markup calculation').messages({
  'any.invalid': 'Selling price must match the purchase price and markup.',
});

const productPricingError = (body) => {
  const hasPurchasePrice = body.purchase_price !== undefined;
  const hasMarkup = body.selling_markup_percent !== undefined;
  if (!hasPurchasePrice && !hasMarkup) return null;
  if (!hasPurchasePrice || !hasMarkup || body.purchase_price === null || body.purchase_price === ''
    || body.selling_markup_percent === null || body.selling_markup_percent === ''
    || !Number.isFinite(Number(body.purchase_price)) || Number(body.purchase_price) <= 0
    || Number(body.purchase_price) > 99999999
    || !Number.isFinite(Number(body.selling_markup_percent))
    || Number(body.selling_markup_percent) < 0 || Number(body.selling_markup_percent) > 10000) {
    return 'Enter a valid purchase price and markup percentage.';
  }
  const price = Math.round((Number(body.purchase_price) * (1 + Number(body.selling_markup_percent) / 100) + Number.EPSILON) * 100) / 100;
  if (price <= 0 || price > 99999999) return 'Calculated selling price is outside the allowed range.';
  if (body.price !== undefined && Number(body.price) !== price) return 'Selling price must match the purchase price and markup.';
  return null;
};

exports.getAll = async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const products = await ProductModel.getAll(activeOnly, req.user.role !== 'client');
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getById = async (req, res) => {
  try {
    const product = await ProductModel.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (req.user.role === 'client') {
      const { purchase_price, selling_markup_percent, ...publicProduct } = product;
      return res.json(publicProduct);
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { error } = productSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, description, stock, category, image_url, expiry_date, purchase_price, selling_markup_percent } = req.body;
    const price = Math.round((purchase_price * (1 + selling_markup_percent / 100) + Number.EPSILON) * 100) / 100;

    // Staff submissions go through pending approval
    if (req.user.role === 'staff') {
      const submissionId = await SubmissionModel.create({
        type: 'product',
        data: { name, description, price, purchase_price, selling_markup_percent, stock, category, image_url, expiry_date },
        submitted_by: req.user.id
      });
      return res.status(201).json({ message: 'Product submitted for admin approval.', submissionId });
    }

    // Admin creates directly
    const productId = await ProductModel.create({
      name, description, price, stock, category, image_url, expiry_date,
      purchase_price, selling_markup_percent,
      status: 'active',
      created_by: req.user.id
    });
    res.status(201).json({ message: 'Product created successfully.', productId });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.update = async (req, res) => {
  try {
    const product = await ProductModel.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const { name, description, price, stock, category, image_url, expiry_date, status } = req.body;
    if (stock !== undefined || (expiry_date !== undefined && expiry_date !== null && expiry_date !== '')) {
      return res.status(409).json({ message: 'Use Inventory for stock and batch expiry changes.' });
    }
    const pricingError = productPricingError(req.body);
    if (pricingError) return res.status(400).json({ message: pricingError });

    if (req.user.role === 'staff') {
      if (price !== undefined && req.body.purchase_price === undefined) {
        return res.status(403).json({ message: 'Only admins can edit product prices.' });
      }
      const submissionId = await SubmissionModel.create({
        type: 'stock_update',
        data: {
          product_id: parseInt(req.params.id),
          name,
          description,
          price,
          purchase_price: req.body.purchase_price,
          selling_markup_percent: req.body.selling_markup_percent,
          category,
          image_url,
          expiry_date
        },
        submitted_by: req.user.id
      });
      return res.json({ message: 'Product details submitted for admin approval.', submissionId });
    }

    const sellingPrice = req.body.purchase_price === undefined
      ? price
      : Math.round((Number(req.body.purchase_price) * (1 + Number(req.body.selling_markup_percent) / 100) + Number.EPSILON) * 100) / 100;
    await ProductModel.update(req.params.id, {
      name, description, price: sellingPrice,
      purchase_price: req.body.purchase_price,
      selling_markup_percent: req.body.selling_markup_percent,
      stock, category, image_url, expiry_date, status,
    });
    res.json({ message: 'Product updated successfully.' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Server error.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const product = await ProductModel.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    await ProductModel.delete(req.params.id);
    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Server error.' });
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const products = await ProductModel.getLowStock(threshold);
    res.json(products);
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
