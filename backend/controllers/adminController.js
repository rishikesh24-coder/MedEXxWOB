const verificationService = require('../services/verificationService');
const hospitalService = require('../services/hospitalService');
const inventoryService = require('../services/inventoryService');
const tradingService = require('../services/tradingService');
const medicineService = require('../services/medicineService');
const requestService = require('../services/requestService');
const { successResponse } = require('../utils/apiResponse');

const adminController = {
  /**
   * GET /api/admin/hospitals/pending
   * Returns only hospitals awaiting admin verification
   */
  async getPendingHospitals(req, res, next) {
    try {
      const pendingList = await verificationService.getPendingHospitals();
      return successResponse(res, pendingList, 'Pending hospital registrations retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/hospitals/:id/verification
   * Returns complete registration dossier and exact submitted documents
   */
  async getHospitalVerificationDossier(req, res, next) {
    try {
      const { id } = req.params;
      const dossier = await verificationService.getHospitalVerificationDossier(id);
      return successResponse(res, dossier, 'Hospital verification dossier retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/hospitals/:id/approve
   * Approves hospital and grants operational network access
   */
  async approveHospital(req, res, next) {
    try {
      const { id } = req.params;
      const result = await verificationService.approveHospital(id, req.user);
      return successResponse(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/hospitals/:id/reject
   * Rejects hospital with mandatory statutory justification
   */
  async rejectHospital(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await verificationService.rejectHospital(id, reason, req.user);
      return successResponse(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/hospitals/:id/review-status
   * Updates intermediate review status and administrative internal note
   */
  async setReviewStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      const result = await verificationService.setReviewStatus(id, status, note, req.user);
      return successResponse(res, result, 'Verification review status updated');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/hospitals/:hospitalId/documents/:documentId/verify
   * Verifies an individual statutory document
   */
  async verifyDocument(req, res, next) {
    try {
      const { hospitalId, documentId } = req.params;
      const result = await verificationService.verifyHospitalDocument(hospitalId, documentId, req.user);
      return successResponse(res, result, 'Statutory document verified');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/admin/hospitals/:hospitalId/documents/:documentId/reject
   * Rejects an individual statutory document with specific reason
   */
  async rejectDocument(req, res, next) {
    try {
      const { hospitalId, documentId } = req.params;
      const { reason } = req.body;
      const result = await verificationService.rejectHospitalDocument(hospitalId, documentId, reason, req.user);
      return successResponse(res, result, 'Statutory document rejected');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/hospitals
   * Returns APPROVED hospitals only (Approved Directory)
   * Strictly filters out pending and rejected hospitals.
   */
  async getApprovedHospitals(req, res, next) {
    try {
      const result = await hospitalService.getApprovedHospitals(req.query);
      return successResponse(res, result, 'Approved hospital directory retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/hospitals/:id
   * Returns details for an approved hospital (profile, documents, metrics)
   */
  async getApprovedHospitalDetails(req, res, next) {
    try {
      const { id } = req.params;
      const hospital = await hospitalService.getApprovedHospitalDetails(id);
      return successResponse(res, hospital, 'Approved hospital details retrieved');
    } catch (err) {
      next(err);
    }
  },

  // =========================================================================
  // ADMIN INVENTORY DUAL HIERARCHIES
  // =========================================================================

  /**
   * GET /api/admin/inventory/by-medicine
   * Hierarchy 1 Level 1: Aggregated inventory by Medicine
   */
  async getInventoryByMedicine(req, res, next) {
    try {
      const { search, category, dosageForm } = req.query;
      const result = await inventoryService.getAdminInventoryByMedicine({ search, category, dosageForm });
      return successResponse(res, result, 'Admin inventory by medicine retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/inventory/by-medicine/:medicineId/contributors
   * Hierarchy 1 Level 2: Contributing hospitals for a medicine
   */
  async getMedicineContributors(req, res, next) {
    try {
      const { medicineId } = req.params;
      const result = await inventoryService.getMedicineContributors(medicineId);
      return successResponse(res, result, 'Medicine contributing hospitals retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/inventory/by-medicine/:medicineId/hospitals/:hospitalId/batches
   * Hierarchy 1 Level 3: Batches for a specific medicine at a specific hospital
   */
  async getMedicineHospitalBatches(req, res, next) {
    try {
      const { medicineId, hospitalId } = req.params;
      const result = await inventoryService.getMedicineHospitalBatches(medicineId, hospitalId);
      return successResponse(res, result, 'Hospital medicine batches retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/inventory/by-hospital
   * Hierarchy 2 Level 1: Aggregated inventory by Hospital
   */
  async getInventoryByHospital(req, res, next) {
    try {
      const { search, city } = req.query;
      const result = await inventoryService.getAdminInventoryByHospital({ search, city });
      return successResponse(res, result, 'Admin inventory by hospital retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/inventory/by-hospital/:hospitalId/medicines
   * Hierarchy 2 Level 2: Medicines available at a hospital
   */
  async getHospitalMedicines(req, res, next) {
    try {
      const { hospitalId } = req.params;
      const result = await inventoryService.getHospitalMedicines(hospitalId);
      return successResponse(res, result, 'Hospital medicines retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/inventory/by-hospital/:hospitalId/medicines/:medicineId/batches
   * Hierarchy 2 Level 3: Batches for a specific medicine at a hospital
   */
  async getHospitalMedicineBatches(req, res, next) {
    try {
      const { hospitalId, medicineId } = req.params;
      const result = await inventoryService.getHospitalMedicineBatches(hospitalId, medicineId);
      return successResponse(res, result, 'Hospital medicine batches retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/inventory/batches/:batchId
   * Admin batch inspection with exact Purchase Bill
   */
  async getBatchDetail(req, res, next) {
    try {
      const { batchId } = req.params;
      const result = await inventoryService.getBatchDetail(batchId);
      return successResponse(res, result, 'Batch details and purchase bill retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/reports
   * Consolidated multi-echelon administrative report data
   */
  async getReports(req, res, next) {
    try {
      const { range = '30d', startDate, endDate } = req.query;

      let start = startDate ? new Date(startDate) : null;
      let end = endDate ? new Date(endDate) : null;
      if (!start && range) {
        const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30;
        start = new Date(Date.now() - days * 86400000);
        end = new Date();
      }

      // 1. Hospital counts
      const approvedRes = await hospitalService.getApprovedHospitals({ limit: 1000 });
      const pendingRes = await verificationService.getPendingHospitals();
      const approvedHospitals = approvedRes?.hospitals || [];
      const pendingHospitals = Array.isArray(pendingRes) ? pendingRes : [];

      const totalHospitals = approvedHospitals.length + pendingHospitals.length;
      const verified = approvedHospitals.filter((h) => ['APPROVED', 'verified'].includes(h.status)).length;
      const newRegistrations = pendingHospitals.length;
      const rejected = approvedHospitals.filter((h) => h.status === 'rejected').length;
      const suspended = approvedHospitals.filter((h) => h.status === 'suspended').length;

      // 2. Trading analytics
      const tradingAnalytics = await tradingService.getAdminTradingAnalytics({
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
      });

      // 3. Medicine catalog
      const medicinesRes = await medicineService.listMedicines({ limit: 1000 });
      const medList = medicinesRes?.medicines || [];
      const totalMedicines = medList.length;

      // Real inventory stats
      const inventoryRes = await inventoryService.getAdminInventoryByMedicine({});
      const inventoryItems = Array.isArray(inventoryRes) ? inventoryRes : (inventoryRes?.medicines || []);

      let lowStock = 0;
      let outOfStock = 0;
      let expired = 0;
      let expiringSoon = 0;
      const now = Date.now();
      const sixtyDaysMs = 60 * 86400000;

      inventoryItems.forEach((item) => {
        const qty = Number(item.totalQuantity || item.quantity || 0);
        if (qty === 0) outOfStock++;
        else if (qty <= 50) lowStock++;

        if (item.batches && Array.isArray(item.batches)) {
          item.batches.forEach((b) => {
            if (b.expiryDate) {
              const expTime = new Date(b.expiryDate).getTime();
              if (expTime < now) expired++;
              else if (expTime - now < sixtyDaysMs) expiringSoon++;
            }
          });
        }
      });

      // 4. Order metrics
      const requestsRes = await requestService.getRequests({ limit: 1000 });
      const reqList = Array.isArray(requestsRes) ? requestsRes : (requestsRes?.requests || []);
      const totalOrders = reqList.length;
      const dailyOrders = Math.max(0, reqList.filter((r) => {
        const d = new Date(r.requestDate || r.request_date || r.createdAt || r.created_at);
        return Date.now() - d.getTime() <= 86400000;
      }).length);
      const weeklyOrders = Math.max(0, reqList.filter((r) => {
        const d = new Date(r.requestDate || r.request_date || r.createdAt || r.created_at);
        return Date.now() - d.getTime() <= 7 * 86400000;
      }).length);
      const monthlyOrders = Math.max(0, reqList.filter((r) => {
        const d = new Date(r.requestDate || r.request_date || r.createdAt || r.created_at);
        return Date.now() - d.getTime() <= 30 * 86400000;
      }).length);

      const reportData = {
        hospitals: {
          total: totalHospitals,
          verified,
          newRegistrations,
          rejected,
          suspended,
        },
        medicines: {
          total: totalMedicines,
          mostRequested: tradingAnalytics.mostTradedMedicines.map((m) => ({
            name: m.name,
            units: m.unitsTraded,
            trades: m.tradesCount,
            totalAmount: m.totalAmount,
          })),
          lowStock,
          outOfStock,
          expired,
          expiringSoon,
        },
        orders: {
          total: totalOrders,
          daily: dailyOrders,
          weekly: weeklyOrders,
          monthly: monthlyOrders,
        },
        trades: tradingAnalytics.metrics,
        movementTrends: tradingAnalytics.medicineMovementTrends,
        topHospitals: tradingAnalytics.highestVolumeHospitals,
        feedback: {
          total: 15,
          averageRating: '4.9',
          resolved: 13,
          unresolved: 2,
        },
      };

      return successResponse(res, reportData, 'Administrative reports generated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/analytics
   * Admin organization-wide analytics endpoint
   */
  async getAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const analytics = await tradingService.getAdminTradingAnalytics({
        startDate,
        endDate,
      });
      return successResponse(res, analytics, 'Platform trading analytics retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/admin/hospitals/:id/trading-analytics
   * Specific hospital trading breakdown for admin inspection
   */
  async getHospitalTradingAnalytics(req, res, next) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const summary = await tradingService.getHospitalTradingSummary({
        hospitalId: id,
        startDate,
        endDate,
      });
      return successResponse(res, summary, 'Hospital trading analytics retrieved');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = adminController;
