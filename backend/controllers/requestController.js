const requestService = require('../services/requestService');
const { successResponse } = require('../utils/apiResponse');

const requestController = {
  /**
   * GET /api/requests/my
   * Requests initiated by authenticated hospital (buyer)
   */
  async getMyRequests(req, res, next) {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { status, search, page, limit, startDate, endDate } = req.query;

      const result = await requestService.getMyRequests({
        hospitalId,
        status,
        search,
        page,
        limit,
        startDate,
        endDate,
      });

      return successResponse(res, result, 'Outgoing requisitions retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/requests/incoming
   * Requests sent to authenticated hospital (seller)
   */
  async getIncomingRequests(req, res, next) {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { status, search, page, limit, startDate, endDate } = req.query;

      const result = await requestService.getIncomingRequests({
        hospitalId,
        status,
        search,
        page,
        limit,
        startDate,
        endDate,
      });

      return successResponse(res, result, 'Incoming requisitions retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/requests/purchases
   * Derived purchases view (authenticated hospital is buyer)
   */
  async getPurchases(req, res, next) {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { search, page, limit, startDate, endDate } = req.query;

      const result = await requestService.getPurchases({
        hospitalId,
        search,
        page,
        limit,
        startDate,
        endDate,
      });

      return successResponse(res, result, 'Purchase order transactions retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/requests/sales
   * Derived sales view (authenticated hospital is seller)
   */
  async getSales(req, res, next) {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { search, page, limit, startDate, endDate } = req.query;

      const result = await requestService.getSales({
        hospitalId,
        search,
        page,
        limit,
        startDate,
        endDate,
      });

      return successResponse(res, result, 'Sales order transactions retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/requests/:id
   * Request detail with line item snapshot
   */
  async getRequestById(req, res, next) {
    try {
      const { id } = req.params;
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      const request = await requestService.getRequestById(id, { hospitalId, isAdmin });
      return successResponse(res, request, 'Requisition details retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/requests
   * Create requisition with atomic stock reservation
   */
  async createRequest(req, res, next) {
    try {
      const result = await requestService.createRequest(req.body, req.user);
      return successResponse(res, result, 'Requisition created and stock reserved successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/requests/:id/cancellation-policy
   * Pre-cancellation terms and estimated refund preview
   */
  async getCancellationPolicy(req, res, next) {
    try {
      const { id } = req.params;
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const isAdmin = req.user?.role === 'admin';

      const policy = await requestService.getCancellationPolicy(id, { hospitalId, isAdmin });
      return successResponse(res, policy, 'Cancellation terms retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/requests/:id/cancel
   * Atomic cancellation, stock release, and refund record creation
   */
  async cancelRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, note } = req.body;
      const hospitalId = req.user?.hospitalId || req.user?.id;

      const result = await requestService.cancelRequest({
        requestId: id,
        reason,
        note,
        hospitalId,
        reqUser: req.user,
      });

      return successResponse(res, result, 'Requisition cancelled and refund processed');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/requests/:id/accept
   * Supplier accepts incoming requisition
   */
  async acceptRequest(req, res, next) {
    try {
      const { id } = req.params;
      const hospitalId = req.user?.hospitalId || req.user?.id;

      const result = await requestService.acceptRequest({
        requestId: id,
        hospitalId,
        reqUser: req.user,
      });

      return successResponse(res, result, 'Requisition accepted successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/requests/:id/reject
   * Supplier declines incoming requisition and releases stock reservation
   */
  async rejectRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const hospitalId = req.user?.hospitalId || req.user?.id;

      const result = await requestService.rejectRequest({
        requestId: id,
        reason,
        hospitalId,
        reqUser: req.user,
      });

      return successResponse(res, result, 'Requisition declined and stock reservation released');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/requests
   * General list for admin or filtered queries
   */
  async getRequests(req, res, next) {
    try {
      const hospitalId = req.user?.role === 'admin' ? (req.query.hospitalId || null) : (req.user?.hospitalId || req.user?.id);
      const { type, status, search, page, limit, startDate, endDate } = req.query;

      const requests = await requestService.getRequests({
        hospitalId,
        type,
        status,
        search,
        page,
        limit,
        startDate,
        endDate,
      });

      return successResponse(res, requests, 'Requisitions retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = requestController;
