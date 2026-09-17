const hospitalService = require('../services/hospitalService');
const { successResponse } = require('../utils/apiResponse');

const hospitalController = {
  /**
   * POST /api/hospitals/register
   * Registers new hospital application with validation and audit trail
   */
  async registerHospital(req, res, next) {
    try {
      const result = await hospitalService.registerHospital(req.body, req.user || null);
      return successResponse(res, result, result.message, 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/hospitals/me
   * Returns current authenticated hospital user's institutional profile
   */
  async getMyHospital(req, res, next) {
    try {
      const hospital = await hospitalService.getMyHospitalProfile(req.user);
      return successResponse(res, hospital, 'Hospital profile retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/hospitals/me
   * Updates current hospital's contact/location details safely
   */
  async updateMyHospital(req, res, next) {
    try {
      const updated = await hospitalService.updateMyHospitalProfile(req.user, req.body);
      return successResponse(res, updated, 'Hospital profile updated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Operational gate testing endpoint
   */
  async getOperationalTest(req, res, next) {
    try {
      return successResponse(res, {
        accessible: true,
        authorized: true,
        status: req.hospital?.status || 'APPROVED',
        hospital: req.hospital,
        message: 'Operational hospital resource accessed successfully.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Onboarding/Pending gate testing endpoint
   */
  async getPendingTest(req, res, next) {
    try {
      return successResponse(res, {
        accessible: true,
        authorized: true,
        status: req.hospital?.status || 'PENDING_APPROVAL',
        hospital: req.hospital,
        message: 'Onboarding resource accessible by pending institution.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Legacy / Admin operations
   */
  async suspendHospital(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await hospitalService.suspendHospital(id, reason, req.user?.name);
      return successResponse(res, result, 'Hospital operational privileges suspended');
    } catch (err) {
      next(err);
    }
  },

  async reactivateHospital(req, res, next) {
    try {
      const { id } = req.params;
      const result = await hospitalService.reactivateHospital(id, req.user?.name);
      return successResponse(res, result, 'Hospital operational privileges reactivated');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/hospitals
   * Returns directory of approved/verified hospitals for network collaboration
   */
  async getApprovedHospitals(req, res, next) {
    try {
      const { search, state, city } = req.query;
      const result = await hospitalService.getApprovedHospitals({ search, state, city });
      const data = Array.isArray(result) ? result : (result.hospitals || []);
      return successResponse(res, data, 'Approved hospital directory retrieved');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = hospitalController;
