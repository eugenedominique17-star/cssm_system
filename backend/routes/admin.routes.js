const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');
const auditController = require('../controllers/audit.controller');

router.get('/audit-logs', authenticate, authorize('admin'), auditController.list);

router.get('/dashboard', authenticate, authorize('admin'), adminController.getDashboardStats);
router.get('/pending-staff', authenticate, authorize('admin'), adminController.getPendingStaff);
router.get('/pending-clients', authenticate, authorize('admin'), adminController.getPendingClients);
router.put('/approve-staff/:id', authenticate, authorize('admin'), adminController.approveStaff);
router.get('/pending-submissions', authenticate, authorize('admin'), adminController.getPendingSubmissions);
router.get('/my-submissions', authenticate, authorize('staff'), adminController.getMySubmissions);
router.put('/approve-submission/:id', authenticate, authorize('admin'), adminController.approveSubmission);
router.get('/reports', authenticate, authorize('admin'), adminController.getSalesReport);

module.exports = router;
