const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const UserModel = require('../models/user.model');
const AuditSecret = require('../models/audit-secret.model');
const { validateKey } = require('../utils/audit-secret');
require('dotenv').config();

const loginSchema = Joi.object({
  identifier: Joi.string().required(), // email or user_id
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  first_name: Joi.string().allow(''),
  middle_name: Joi.string().allow(''),
  last_name: Joi.string().allow(''),
  birthdate: Joi.string().allow(''),
  gender: Joi.string().allow(''),
  address: Joi.string().allow(''),
  phone: Joi.string().allow(''),
  contract_details: Joi.string().allow('')
});

exports.login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { identifier, password } = req.body;
    const user = await UserModel.findByIdentifier(identifier);
    if (!user) return res.status(401).json({ message: 'Invalid identifier or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid identifier or password.' });

      if (user.status !== 'active') {
        if (user.status === 'pending') {
          return res.status(403).json({ message: 'Account is pending approval. Please wait for admin to activate your account.' });
        }
        return res.status(403).json({ message: 'Account has been rejected or deactivated.' });
      }

    const token = jwt.sign(
      { id: user.id, user_id: user.user_id, name: user.name, email: user.email, role: user.role, status: user.status },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      // Additive: forced first-login password change flag
      user: {
        id: user.id, user_id: user.user_id, name: user.name, email: user.email,
        role: user.role, status: user.status,
        must_change_password: Boolean(user.must_change_password)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.registerStaff = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, password, first_name, middle_name, last_name, birthdate, gender, address, contract_details, phone } = req.body;
    const existing = await UserModel.findByEmail(email);
    if (existing) return res.status(400).json({ message: 'Email already registered.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role: 'staff',
      status: 'pending',
      first_name,
      middle_name,
      last_name,
      birthdate,
      gender,
      address,
      contract_details,
      phone,
      created_by: req.user?.id
    });

    res.status(201).json({ message: 'Registration successful! Your account is pending admin approval.', userId: user.id, user_id: user.user_id });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.registerClient = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, password, first_name, middle_name, last_name, birthdate, gender, address, phone } = req.body;
    const existing = await UserModel.findByEmail(email);
    if (existing) return res.status(400).json({ message: 'Email already registered.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role: 'client',
      status: 'pending',
      first_name,
      middle_name,
      last_name,
      birthdate,
      gender,
      address,
      phone
    });

    res.status(201).json({ 
      message: 'Registration successful! Please wait for Admin approval.',
      userId: user.id,
      user_id: user.user_id
    });
  } catch (error) {
    console.error('Register client error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const schema = Joi.object({ currentPassword: Joi.string().required(), newPassword: Joi.string().min(6).required() });
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { currentPassword, newPassword } = req.body;
    if (currentPassword === newPassword) return res.status(400).json({ message: 'New password must be different from the current password.' });
    try {
      validateKey();
    } catch (configurationError) {
      console.error('Password change audit encryption is unavailable:', configurationError.code || 'unavailable');
      const message = configurationError.code === 'AUDIT_SECRET_KEY_INVALID'
        ? 'Password change is temporarily unavailable. The audit encryption key is invalid.'
        : 'Password change is temporarily unavailable. The audit encryption key is not configured.';
      return res.status(503).json({ message });
    }
    const user = await UserModel.findByIdWithPassword(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const linkedAuth = Boolean(user.auth_user_id);
    const authPassword = linkedAuth ? require('../utils/supabase-auth-password') : null;
    if (linkedAuth) {
      await authPassword.verifyCurrentPassword(user.auth_user_id, user.email, currentPassword);
    } else {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    if (linkedAuth) await authPassword.updateSupabasePassword(user.auth_user_id, newPassword);
    const updated = await UserModel.updatePassword(req.user.id, hashed, false);
    if (!updated) {
      if (linkedAuth) {
        try {
          await authPassword.updateSupabasePassword(user.auth_user_id, currentPassword);
        } catch (rollbackError) {
          console.error('Supabase Auth password rollback failed:', rollbackError.code || 'unavailable');
          return res.status(503).json({ message: 'Password synchronization failed. Contact an administrator before signing out.' });
        }
      }
      return res.status(500).json({ message: 'Password change could not be saved.' });
    }

    await AuditSecret.save(req.auditId, currentPassword);
    req.passwordAuditDetails = {
      account: { id: req.user.id, user_id: user.user_id, name: user.name, role: user.role },
      previous_password: { available: true, masked: '********' },
    };

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Server error.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Only clients can edit this profile.' });
    const manilaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const schema = Joi.object({
      first_name: Joi.string().trim().min(1).max(100).required(),
      middle_name: Joi.string().trim().max(100).allow('').default(''),
      last_name: Joi.string().trim().min(1).max(100).required(),
      birthdate: Joi.string().allow('').custom((value, helpers) => {
        if (!value) return value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return helpers.error('date.format');
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return helpers.error('date.format');
        if (value > manilaToday) return helpers.error('date.max');
        return value;
      }, 'date validation').messages({
        'date.format': 'Enter a valid birthdate.',
        'date.max': 'Birthdate cannot be in the future.',
      }),
      gender: Joi.string().valid('', 'male', 'female', 'other').allow(''),
      address: Joi.string().trim().max(500).allow(''),
      phone: Joi.string().trim().max(30).allow(''),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    const name = [value.first_name, value.middle_name, value.last_name].filter(Boolean).join(' ');
    if (name.length > 100) return res.status(400).json({ message: 'Your full name must not exceed 100 characters.' });
    const profileUpdate = { ...value, name };
    if (value.birthdate !== undefined) profileUpdate.birthdate = value.birthdate || null;
    if (value.gender !== undefined) profileUpdate.gender = value.gender || null;
    const updated = await UserModel.update(req.user.id, profileUpdate);
    if (!updated) return res.status(500).json({ message: 'Unable to save your profile. Please try again.' });
    const { password, ...profile } = updated;
    res.json({ message: 'Profile updated successfully.', user: { ...profile, role: 'client' } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Unable to save your profile. Please try again.' });
  }
};
