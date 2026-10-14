const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/inventory.controller');
router.get('/', authenticate, authorize('admin','staff'), controller.overview);
router.get('/history', authenticate, authorize('admin','staff'), controller.history);
router.get('/requests', authenticate, authorize('admin','staff'), controller.requests);
router.post('/:kind', authenticate, authorize('admin','staff'), controller.command);
module.exports = router;
