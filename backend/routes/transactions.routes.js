const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'staff'), transactionController.getAll);
router.get('/my', authenticate, authorize('client'), transactionController.getMyTransactions);
router.get('/walk-in-requests/my', authenticate, authorize('client'), transactionController.getMyWalkInRequests);
router.post('/walk-in-requests/:id/cancel', authenticate, authorize('client', 'staff', 'admin'), transactionController.cancelWalkInRequest);
router.get('/staff', authenticate, authorize('staff'), transactionController.getByStaff);
router.post('/walk-in-request', authenticate, authorize('client'), transactionController.createWalkInRequest);
router.post('/walk-in-request/staff', authenticate, authorize('staff'), transactionController.createStaffWalkInRequest);
router.get('/walk-in-requests/pending', authenticate, authorize('staff'), transactionController.getPendingWalkInRequests);
router.get('/walk-in-requests/cancelled', authenticate, authorize('staff'), transactionController.getCancelledWalkInRequests);
router.post('/walk-in-requests/:id/complete', authenticate, authorize('staff'), transactionController.completeWalkInRequest);
router.get('/:id', authenticate, authorize('admin', 'staff', 'client'), transactionController.getById);
router.post('/', authenticate, authorize('admin', 'staff'), transactionController.create);

module.exports = router;
