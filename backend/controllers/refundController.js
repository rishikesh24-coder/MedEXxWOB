const refundService = require('../services/refundService');
const { successResponse } = require('../utils/apiResponse');

const refundController = {
  /**
   * GET /api/refunds/my
   * List of refunds for the authenticated hospital
   */
  async getMyRefunds(req, res, next) {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { page, limit } = req.query;

      const result = await refundService.getMyRefunds({
        hospitalId,
        page,
        limit,
      });

      return successResponse(res, result, 'Hospital refund records retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/refunds/:id
   * Detail view of specific refund record
   */
  async getRefundById(req, res, next) {
    try {
      const { id } = req.params;
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      const refund = await refundService.getRefundById(id, { hospitalId, isAdmin });
      return successResponse(res, refund, 'Refund details retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/refunds/admin (or GET /api/admin/refunds)
   * Platform-wide monitoring for administrators
   */
  async getAdminRefunds(req, res, next) {
    try {
      const { page, limit, status, search } = req.query;

      const result = await refundService.getAdminRefunds({
        page,
        limit,
        status,
        search,
      });

      return successResponse(res, result, 'Administrative refund records retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/refunds/:id/process
   * Admin-only disbursement of refund via payment gateway
   */
  async processRefund(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const user = req.user;

      const result = await refundService.processRefundDisbursement({
        refundId: id,
        user,
        notes,
      });

      return successResponse(res, result, 'Refund disbursement processed successfully');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = refundController;
