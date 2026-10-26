const bcrypt = require('bcryptjs');
const Joi = require('joi');
const UserModel = require('../models/user.model');
const SubmissionModel = require('../models/submission.model');
const { accountStatusDetails } = require('../utils/audit');

const { generateTempPassword } = require('../utils/password');

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

exports.getAll = async (req, res) => {
  try {
    const role = req.query.role;
    let users;
    if (role) {
      users = await UserModel.getByRole(role);
    } else {
      users = await UserModel.getAll();
    }
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getById = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.getMyCreatedAccounts = async (req, res) => {
  try {
    const users = await UserModel.getByCreatedBy(req.user.id);
    res.json(users);
  } catch (error) {
    console.error('Get created accounts error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { error } = createUserSchema.validate(req.body);
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
      status: 'active',
      first_name,
      middle_name,
      last_name,
      birthdate,
      gender,
      address,
      phone,
      created_by: req.user?.id,
      must_change_password: true
    });

    res.status(201).json({
      message: 'Client account created successfully.',
      userId: user.id,
      user_id: user.user_id,
      credentials: { email, password } // Staff can hand these to the client
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.approve = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updated = await UserModel.updateStatus(req.params.id, 'active');
    if (!updated) return res.status(404).json({ message: 'User not found.' });
    req.accountAuditDetails = accountStatusDetails(user, updated);
    res.json({ message: 'User approved successfully.' });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.reject = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updated = await UserModel.updateStatus(req.params.id, 'rejected');
    if (!updated) return res.status(404).json({ message: 'User not found.' });
    req.accountAuditDetails = accountStatusDetails(user, updated);
    res.json({ message: 'User rejected successfully.' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { error } = createUserSchema.validate(req.body);
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
      created_by: req.user?.id,
      must_change_password: true
    });

    res.status(201).json({
      message: 'Staff account created successfully. It is pending admin approval.',
      userId: user.id,
      user_id: user.user_id,
      credentials: { email, password }
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    const updated = await UserModel.update(req.params.id, { name, email, role, status });
    if (!updated) return res.status(500).json({ message: 'Account update could not be saved.' });
    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be deactivated.' });
    }

    const updated = await UserModel.updateStatus(req.params.id, 'inactive');
    if (!updated) return res.status(500).json({ message: 'Account deactivation could not be saved.' });
    res.json({ message: 'User deactivated successfully.' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await UserModel.delete(req.params.id);
    if (!deleted) return res.status(500).json({ message: 'Account deletion could not be saved.' });
    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Admin-only password reset; show the random credential only in this response.
exports.resetPassword = async (req, res) => {
  try {
    const user = await UserModel.findByIdWithPassword(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot reset another admin password.' });

    const tempPassword = generateTempPassword(user.role);
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(tempPassword, salt);
    const updated = await UserModel.updatePassword(user.id, hashed, true);
    if (!updated) return res.status(500).json({ message: 'Password reset could not be saved.' });
    if (user.auth_user_id) {
      try {
        await require('../utils/supabase-auth-password').updateSupabasePassword(user.auth_user_id, tempPassword);
      } catch (error) {
        const restored = await UserModel.updatePassword(user.id, user.password, Boolean(user.must_change_password));
        if (!restored) {
          console.error('Legacy password rollback failed after Supabase Auth reset failure:', error.code || 'unavailable');
          return res.status(503).json({ message: 'Password reset synchronization failed. Contact an administrator.' });
        }
        return res.status(error.status || 503).json({ message: error.message || 'Password reset synchronization failed.' });
      }
    }

    res.json({
      message: 'Password reset successfully. User must change it on next login.',
      credentials: { email: user.email, user_id: user.user_id, password: tempPassword }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Additive: Staff requests a password reset for a created account (needs admin approval)
exports.requestPasswordReset = async (req, res) => {
  try {
    const target = await UserModel.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'admin') return res.status(400).json({ message: 'Cannot request a reset for an admin account.' });

    const submissionId = await SubmissionModel.create({
      type: 'password_reset',
      data: {
        target_user_id: target.id,
        target_user_id_formatted: target.user_id,
        target_name: target.name,
        target_email: target.email,
        target_role: target.role
      },
      submitted_by: req.user.id
    });

    res.status(201).json({
      message: 'Password reset request submitted for admin approval.',
      submissionId
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
