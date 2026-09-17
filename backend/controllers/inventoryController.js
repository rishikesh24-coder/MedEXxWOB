const inventoryService = require('../services/inventoryService');
const { successResponse } = require('../utils/apiResponse');

const inventoryController = {
  /**
   * GET /api/inventory
   * Retrieves lots for authenticated hospital or filtered by admin.
   */
  async getInventory(req, res, next) {
    try {
      const { status, category, search, page, limit } = req.query;
      const hospitalId = req.query.hospitalId;

      const result = await inventoryService.getInventory({
        reqUser: req.user,
        hospitalId,
        status,
        category,
        search,
        page,
        limit,
      });

      return successResponse(res, result, 'Inventory lots retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/inventory/marketplace
   * Retrieves available, non-expired lots from approved partner hospitals.
   */
  async getMarketplace(req, res, next) {
    try {
      const { category, dosageForm, search, page, limit } = req.query;
      const currentHospitalId = req.user?.role === 'hospital' ? (req.user.hospitalId || req.user.id) : null;

      const items = await inventoryService.getMarketplaceInventory({
        currentHospitalId,
        category,
        dosageForm,
        search,
        page,
        limit,
      });

      return successResponse(res, items, 'Marketplace inventory retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/inventory/:id
   * Detailed information about a single lot with hospital ownership check.
   */
  async getLotById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await inventoryService.getLotDetails(id, req.user);
      return successResponse(res, result, 'Inventory lot retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/inventory
   * Registers a new medicine batch into hospital inventory.
   */
  async addMedicine(req, res, next) {
    try {
      const result = await inventoryService.addInventoryLot(req.body, req.user);
      return successResponse(res, result, 'Medicine batch registered into inventory', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/inventory/:id or PUT /api/inventory/:id
   * Updates lot metadata, stock quantity, or pricing.
   */
  async updateMedicine(req, res, next) {
    try {
      const { id } = req.params;
      const result = await inventoryService.updateInventoryLot(id, req.body, req.user);
      return successResponse(res, result, 'Inventory lot updated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/inventory/:id
   * Soft deletes / deactivates lot from active stock.
   */
  async deleteMedicine(req, res, next) {
    try {
      const { id } = req.params;
      const result = await inventoryService.deleteInventoryLot(id, req.user);
      return successResponse(res, result, 'Inventory lot deactivated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/inventory/:id/adjust
   * Performs atomic stock adjustment with immutable ledger record.
   */
  async adjustStock(req, res, next) {
    try {
      const { id } = req.params;
      const { quantityChange, reason } = req.body;
      const result = await inventoryService.adjustStock(id, { quantityChange, reason }, req.user);
      return successResponse(res, result, 'Stock level adjusted successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/inventory/:id/history
   * Retrieves immutable audit ledger of stock adjustments for a lot.
   */
  async getLotHistory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await inventoryService.getLotHistory(id, req.user);
      return successResponse(res, result, 'Lot adjustment history retrieved successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = inventoryController;
