const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const { auditMutation } = require('./audit');
require('dotenv').config();

const normalizeRole = (role) => {
  const value = typeof role === 'string' ? role.trim().toLowerCase() : role;
  return value === 'user' ? 'client' : value;
};

async function getAuthenticatedUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const supabaseUser = await UserModel.findBySupabaseToken(token);
    if (!supabaseUser || supabaseUser.status !== 'active') {
      const error = new Error('Invalid or expired token.');
      error.status = 401;
      throw error;
    }
    return { ...supabaseUser, role: normalizeRole(supabaseUser.role) };
  }

  if (!decoded || typeof decoded !== 'object' || !decoded.id) {
    const error = new Error('Invalid or expired token.');
    error.status = 401;
    throw error;
  }

  const user = await UserModel.findById(decoded.id);
  if (!user || user.status !== 'active' || normalizeRole(user.role) !== normalizeRole(decoded.role)) {
    const error = new Error('Account is inactive or no longer available. Please log in again.');
    error.status = 401;
    throw error;
  }
  return { ...decoded, ...user, role: normalizeRole(user.role) };
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  try {
    req.user = await getAuthenticatedUser(authHeader.slice(7));
  } catch (error) {
    return res.status(error.status || 503).json({
      message: error.status ? error.message : 'Unable to verify account. Please try again.',
    });
  }
  const passwordRoute = req.baseUrl === '/api/auth' && (
    (req.method === 'GET' && req.path === '/me') ||
    (req.method === 'POST' && req.path === '/change-password')
  );
  if (req.user.must_change_password && !passwordRoute) {
    return res.status(403).json({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Change your temporary password before continuing.' });
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.map(normalizeRole).includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    return auditMutation(req, res, next);
  };
};

module.exports = { authenticate, authorize, getAuthenticatedUser };
