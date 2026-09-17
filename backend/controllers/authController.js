const authService = require('../services/authService');
const hospitalService = require('../services/hospitalService');
const { successResponse } = require('../utils/apiResponse');

const authController = {
  async login(req, res, next) {
    try {
      const { email, password, role } = req.body;
      const result = await authService.login({ email, password, role });
      return successResponse(res, result, 'Authentication successful');
    } catch (err) {
      next(err);
    }
  },

  async registerHospital(req, res, next) {
    try {
      const result = await hospitalService.registerHospital(req.body, req.user || null);
      return successResponse(
        res,
        result,
        result.message || 'Hospital registration submitted successfully. Application is pending admin approval.',
        201
      );
    } catch (err) {
      next(err);
    }
  },

  async registerAdmin(req, res, next) {
    try {
      const result = await authService.signupAdmin(req.body);
      return successResponse(res, result, 'Admin account registered successfully', 201);
    } catch (err) {
      next(err);
    }
  },

  async getMe(req, res, next) {
    try {
      return successResponse(
        res,
        {
          user: req.user,
          hospital: req.hospital || null,
        },
        'User session validated'
      );
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      await authService.logout(req.user);
      return successResponse(res, { loggedOut: true }, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
