const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auditController = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'staff'), userController.getAll);
router.get('/my-created', authenticate, authorize('staff'), userController.getMyCreatedAccounts);
router.get('/:id', authenticate, authorize('admin', 'staff'), userController.getById);
router.post('/', authenticate, authorize('admin', 'staff'), userController.createCustomer);
router.post('/staff', authenticate, authorize('admin', 'staff'), userController.createStaff);
router.put('/:id/approve', authenticate, authorize('admin'), userController.approve);
router.put('/:id/reject', authenticate, authorize('admin'), userController.reject);
// Additive: password management (admin reset; staff request needs admin approval)
router.put('/:id/reset-password', authenticate, authorize('admin'), userController.resetPassword);
router.post('/:id/reveal-previous-password', authenticate, authorize('admin'), auditController.revealPreviousPasswordForUser);
router.post('/:id/request-password-reset', authenticate, authorize('staff'), userController.requestPasswordReset);
router.put('/:id', authenticate, authorize('admin'), userController.update);
router.put('/:id/deactivate', authenticate, authorize('admin'), userController.deactivate);
router.delete('/:id', authenticate, authorize('admin'), userController.delete);

module.exports = router;