const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { webhookLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// 1. Gateway Webhook Endpoint (Unauthenticated, signature verified, rate limited)
router.post('/webhook', webhookLimiter, paymentController.handleWebhook);

// 2. Authenticated Endpoints
router.use(authenticateUser);

// Hospital payment operations
router.post('/create', paymentController.createPayment);
router.post('/verify', paymentController.verifyPayment);
router.post('/fail', paymentController.failPayment);
router.post('/retry', paymentController.retryPayment);
router.get('/my', paymentController.getMyPayments);

// Admin-facing payment monitoring
router.get('/admin', requireAdmin, paymentController.getAdminPayments);

// Specific payment detail
router.get('/:id', paymentController.getPaymentById);

module.exports = router;
