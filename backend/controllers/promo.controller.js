const Joi = require('joi');
const PromoModel = require('../models/promo.model');
const SubmissionModel = require('../models/submission.model');

const promoSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  discount_type: Joi.string().valid('percentage', 'fixed', 'bundle').required(),
  discount_value: Joi.number().positive().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().greater(Joi.ref('start_date')).required()
});

exports.getAll = async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const promos = await PromoModel.getAll(activeOnly);
    res.json(promos);
  } catch (error) {
    console.error('Get promos error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getById = async (req, res) => {
  try {
    const promo = await PromoModel.getById(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found.' });
    res.json(promo);
  } catch (error) {
    console.error('Get promo error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { error } = promoSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { title, description, discount_type, discount_value, start_date, end_date } = req.body;

    if (req.user.role === 'staff') {
      const submissionId = await SubmissionModel.create({
        type: 'promo',
        data: { title, description, discount_type, discount_value, start_date, end_date },
        submitted_by: req.user.id
      });
      return res.status(201).json({ message: 'Promo submitted for admin approval.', submissionId });
    }

    const promoId = await PromoModel.create({
      title, description, discount_type, discount_value, start_date, end_date,
      status: 'active',
      created_by: req.user.id
    });
    res.status(201).json({ message: 'Promo created successfully.', promoId });
  } catch (error) {
    console.error('Create promo error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.update = async (req, res) => {
  try {
    const promo = await PromoModel.getById(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found.' });

    const { title, description, discount_type, discount_value, start_date, end_date, status } = req.body;

    if (req.user.role === 'staff') {
      const submissionId = await SubmissionModel.create({
        type: 'promo',
        data: { promo_id: parseInt(req.params.id), title, description, discount_type, discount_value, start_date, end_date },
        submitted_by: req.user.id
      });
      return res.json({ message: 'Update submitted for admin approval.', submissionId });
    }

    const updated = await PromoModel.update(req.params.id, { title, description, discount_type, discount_value, start_date, end_date, status });
    if (!updated) return res.status(500).json({ message: 'Promo update could not be saved.' });
    res.json({ message: 'Promo updated successfully.' });
  } catch (error) {
    console.error('Update promo error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const promo = await PromoModel.getById(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found.' });
    const deleted = await PromoModel.delete(req.params.id);
    if (!deleted) return res.status(500).json({ message: 'Promo deletion could not be saved.' });
    res.json({ message: 'Promo deleted successfully.' });
  } catch (error) {
    console.error('Delete promo error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
