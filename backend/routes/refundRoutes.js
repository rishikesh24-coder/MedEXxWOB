const express = require('express');
const refundController = require('../controllers/refundController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// Hospital-facing refunds
router.get('/my', refundController.getMyRefunds);

// Admin-facing refunds
router.get('/admin', requireAdmin, refundController.getAdminRefunds);

// Specific refund details
router.get('/:id', refundController.getRefundById);

// Admin-only refund processing
router.post('/:id/process', requireAdmin, refundController.processRefund);

module.exports = router;
