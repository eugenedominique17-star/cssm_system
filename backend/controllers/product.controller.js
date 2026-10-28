const Joi = require('joi');
const ProductModel = require('../models/product.model');
const SubmissionModel = require('../models/submission.model');

const productSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  price: Joi.number().positive().required(),
  stock: Joi.number().valid(0).default(0),
  category: Joi.string().min(2).max(100).required(),
  image_url: Joi.string().allow('', null),
  expiry_date: Joi.valid('', null).optional()
});

exports.getAll = async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const products = await ProductModel.getAll(activeOnly);
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

    const { name, description, price, stock, category, image_url, expiry_date } = req.body;

    // Staff submissions go through pending approval
    if (req.user.role === 'staff') {
      const submissionId = await SubmissionModel.create({
        type: 'product',
        data: { name, description, price, stock, category, image_url, expiry_date },
        submitted_by: req.user.id
      });
      return res.status(201).json({ message: 'Product submitted for admin approval.', submissionId });
    }

    // Admin creates directly
    const productId = await ProductModel.create({
      name, description, price, stock, category, image_url, expiry_date,
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

    if (req.user.role === 'staff') {
      if (price !== undefined) {
        return res.status(403).json({ message: 'Only admins can edit product prices.' });
      }
      const submissionId = await SubmissionModel.create({
        type: 'stock_update',
        data: {
          product_id: parseInt(req.params.id),
          name,
          description,
          price,
          category,
          image_url,
          expiry_date
        },
        submitted_by: req.user.id
      });
      return res.json({ message: 'Product details submitted for admin approval.', submissionId });
    }

    await ProductModel.update(req.params.id, { name, description, price, stock, category, image_url, expiry_date, status });
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
