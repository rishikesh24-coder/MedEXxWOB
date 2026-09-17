const tradingService = require('../services/tradingService');
const { successResponse } = require('../utils/apiResponse');

const tradeController = {
  /**
   * GET /api/trades
   * Paginated list of authorized trades with filtering, sorting and search
   */
  async getTrades(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      const hospitalId = req.user?.hospitalId || req.user?.id;

      const {
        page = 1,
        limit = 20,
        status,
        search,
        startDate,
        endDate,
        medicineId,
        buyerHospitalId,
        sellerHospitalId,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await tradingService.getTrades({
        hospitalId,
        isAdmin,
        buyerHospitalId,
        sellerHospitalId,
        medicineId,
        status,
        search,
        startDate,
        endDate,
        sortBy,
        sortOrder,
        page,
        limit,
      });

      return successResponse(res, result, 'Trades retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/:id
   * Single trade detail with full traceability
   */
  async getTradeById(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      const hospitalId = req.user?.hospitalId || req.user?.id;

      const trade = await tradingService.getTradeById(id, {
        hospitalId,
        isAdmin,
      });

      return successResponse(res, trade, 'Trade details retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/summary
   * Trading analytics summary for the caller's hospital or whole platform for admin
   */
  async getTradingSummary(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      const callerHospitalId = req.user?.hospitalId || req.user?.id;
      const targetHospitalId = req.query.hospitalId || callerHospitalId;

      const { startDate, endDate } = req.query;

      if (isAdmin && !req.query.hospitalId) {
        // Organization-wide summary for admin
        const adminAnalytics = await tradingService.getAdminTradingAnalytics({
          startDate,
          endDate,
        });
        return successResponse(res, adminAnalytics, 'Admin trading analytics retrieved');
      }

      // Hospital trading summary
      if (!isAdmin && targetHospitalId !== callerHospitalId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied: You cannot view trading analytics for another facility.' }
        });
      }

      const summary = await tradingService.getHospitalTradingSummary({
        hospitalId: targetHospitalId,
        startDate,
        endDate,
      });

      return successResponse(res, summary, 'Hospital trading summary retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/history
   * Alias / convenient query for trade history
   */
  async getTradeHistory(req, res, next) {
    try {
      return tradeController.getTrades(req, res, next);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/export
   * Backend-generated CSV export respecting filters, date ranges, and authorization
   */
  async exportTrades(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      const hospitalId = req.user?.hospitalId || req.user?.id;

      const filters = {
        buyerHospitalId: req.query.buyerHospitalId,
        sellerHospitalId: req.query.sellerHospitalId,
        medicineId: req.query.medicineId,
        status: req.query.status,
        search: req.query.search,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const csvData = await tradingService.generateTradesCSV({
        hospitalId,
        isAdmin,
        filters,
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `medex-trading-report-${dateStr}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/analytics/medicine/:medicineId
   * Drill-down analytics for a specific medicine
   */
  async getMedicineAnalytics(req, res, next) {
    try {
      const { medicineId } = req.params;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      const hospitalId = req.user?.hospitalId || req.user?.id;
      const { startDate, endDate } = req.query;

      const analytics = await tradingService.getMedicineTradingAnalytics(medicineId, {
        hospitalId,
        isAdmin,
        startDate,
        endDate,
      });

      return successResponse(res, analytics, 'Medicine trading analytics retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/analytics/hospital/:hospitalId
   * Admin or self inspection of a hospital's trading breakdown
   */
  async getHospitalAnalytics(req, res, next) {
    try {
      const { hospitalId } = req.params;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      const callerHospitalId = req.user?.hospitalId || req.user?.id;

      if (!isAdmin && hospitalId !== callerHospitalId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied: You cannot view trading analytics for another facility.' }
        });
      }

      const { startDate, endDate } = req.query;
      const summary = await tradingService.getHospitalTradingSummary({
        hospitalId,
        startDate,
        endDate,
      });

      return successResponse(res, summary, 'Hospital trading analytics retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/trades/analytics/admin
   * Organization-wide trading analytics (Admin only)
   */
  async getAdminAnalytics(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied: Administrative privileges required.' }
        });
      }

      const { startDate, endDate } = req.query;
      const analytics = await tradingService.getAdminTradingAnalytics({
        startDate,
        endDate,
      });

      return successResponse(res, analytics, 'Platform trading analytics retrieved');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = tradeController;
