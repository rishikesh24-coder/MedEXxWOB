const paymentService = require('../services/paymentService');
const { successResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const paymentController = {
  /**
   * POST /api/payments/create
   * Create an authoritative payment order from backend request snapshot
   */
  async createPayment(req, res, next) {
    try {
      const { requestId } = req.body;
      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Requisition ID (requestId) is required to initiate payment.',
          },
        });
      }

      const payment = await paymentService.createPayment({
        user: req.user,
        requestId,
      });

      return successResponse(res, payment, 'Payment order created successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/verify
   * Verify client-submitted payment signature and transition state to PAID
   */
  async verifyPayment(req, res, next) {
    try {
      const { paymentId, providerOrderId, providerPaymentId, providerSignature } = req.body;

      if (!providerOrderId || !providerPaymentId || !providerSignature) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'providerOrderId, providerPaymentId, and providerSignature are required.',
          },
        });
      }

      const result = await paymentService.verifyPayment({
        user: req.user,
        paymentId,
        providerOrderId,
        providerPaymentId,
        providerSignature,
      });

      return successResponse(res, result, 'Payment successfully verified and escrow secured');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/webhook
   * Gateway webhook listener with HMAC verification and idempotency ledger
   */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'] || req.headers['x-signature'] || req.headers['signature'];
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

      if (!signature) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Missing gateway signature header.',
          },
        });
      }

      const result = await paymentService.handleWebhook({
        rawBody,
        signature,
        headers: req.headers,
      });

      return res.status(200).json({
        status: 'ok',
        received: true,
        ...result,
      });
    } catch (err) {
      logger.error('Payment webhook error:', err);
      return res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message,
      });
    }
  },

  /**
   * POST /api/payments/fail
   * Record client-side failure or cancellation without releasing reserved stock
   */
  async failPayment(req, res, next) {
    try {
      const { paymentId, reason } = req.body;
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Payment ID is required.',
          },
        });
      }

      const result = await paymentService.failPayment({
        user: req.user,
        paymentId,
        reason,
      });

      return successResponse(res, result, 'Payment failure recorded');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/retry
   * Re-initiates payment order for an existing pending requisition
   */
  async retryPayment(req, res, next) {
    try {
      const { requestId } = req.body;
      if (!requestId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Requisition ID (requestId) is required to retry payment.',
          },
        });
      }

      const payment = await paymentService.createPayment({
        user: req.user,
        requestId,
      });

      return successResponse(res, payment, 'New payment order generated for requisition');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/my
   * Hospital-facing payment transactions
   */
  async getMyPayments(req, res, next) {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { page, limit, status } = req.query;

      const result = await paymentService.getMyPayments({
        hospitalId,
        page,
        limit,
        status,
      });

      return successResponse(res, result, 'Hospital payments retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/admin
   * Platform-wide payment records for administrators
   */
  async getAdminPayments(req, res, next) {
    try {
      const { page, limit, status, search } = req.query;

      const result = await paymentService.getAdminPayments({
        page,
        limit,
        status,
        search,
      });

      return successResponse(res, result, 'Administrative payment records retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/:id
   * Specific payment detail
   */
  async getPaymentById(req, res, next) {
    try {
      const { id } = req.params;
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';

      const payment = await paymentService.getPaymentById(id, {
        hospitalId,
        isAdmin,
      });

      return successResponse(res, payment, 'Payment record retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = paymentController;
