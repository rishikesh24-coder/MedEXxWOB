const verificationService = require('../services/verificationService');
const { successResponse } = require('../utils/apiResponse');

const verificationController = {
  async approveHospital(req, res, next) {
    try {
      const { id } = req.params;
      const result = await verificationService.approveHospital(id, req.user);
      return successResponse(res, result, 'Hospital approved and granted operational privileges');
    } catch (err) {
      next(err);
    }
  },

  async rejectHospital(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await verificationService.rejectHospital(id, reason, req.user);
      return successResponse(res, result, 'Hospital application rejected with statutory reasons');
    } catch (err) {
      next(err);
    }
  },

  async setReviewStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      const result = await verificationService.setReviewStatus(id, status, note, req.user);
      return successResponse(res, result, 'Review status updated');
    } catch (err) {
      next(err);
    }
  },

  async verifyDocument(req, res, next) {
    try {
      const { hospitalId, documentId } = req.params;
      const result = await verificationService.verifyHospitalDocument(hospitalId, documentId, req.user);
      return successResponse(res, result, 'Statutory document verified');
    } catch (err) {
      next(err);
    }
  },

  async rejectDocument(req, res, next) {
    try {
      const { hospitalId, documentId } = req.params;
      const { reason } = req.body;
      const result = await verificationService.rejectHospitalDocument(hospitalId, documentId, reason, req.user);
      return successResponse(res, result, 'Statutory document rejected');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = verificationController;
