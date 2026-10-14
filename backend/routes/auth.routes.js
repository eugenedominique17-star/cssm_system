const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMutation } = require('../middleware/audit');

router.post('/login', authController.login);
router.post('/register/staff', authController.registerStaff);
router.post('/register/client', authController.registerClient);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authorize('client'), authController.updateProfile);
router.post('/change-password', authenticate, auditMutation, authController.changePassword);

module.exports = router;
