const auditService = require('../services/auditService');
const { successResponse } = require('../utils/apiResponse');

const auditController = {
  async getAuditTrail(req, res, next) {
    try {
      const hospitalId = req.user?.role === 'admin' ? (req.query.hospitalId || null) : req.user?.hospitalId;
      const { entityType, search, limit } = req.query;

      const logs = await auditService.getAuditTrail({
        hospitalId,
        entityType,
        search,
        limit: limit ? parseInt(limit, 10) : 50,
      });

      return successResponse(res, logs, 'Audit trail retrieved');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = auditController;
