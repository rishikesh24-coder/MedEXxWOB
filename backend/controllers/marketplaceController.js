const inventoryService = require('../services/inventoryService');
const medicineService = require('../services/medicineService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const marketplaceController = {
  async getMarketplace(req, res, next) {
    try {
      const currentHospitalId = req.user?.hospitalId;
      const { search, dosageForm, page, limit, sortBy, sortOrder } = req.query;

      const listings = await inventoryService.getMarketplace({
        currentHospitalId,
        search,
        dosageForm,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      return successResponse(res, listings, 'Marketplace listings retrieved');
    } catch (err) {
      next(err);
    }
  },

  async getMarketplaceItem(req, res, next) {
    try {
      const { id } = req.params;
      const item = await inventoryService.getMarketplaceItem(id);
      if (!item) {
        return errorResponse(res, 'Marketplace listing not found', 404);
      }
      return successResponse(res, item, 'Marketplace listing retrieved');
    } catch (err) {
      next(err);
    }
  },

  async getMarketplaceAlternatives(req, res, next) {
    try {
      const { id } = req.params;
      const currentHospitalId = req.user?.hospitalId;
      let medicineId = id;

      // Check if ID is an inventory lot
      try {
        const lot = await inventoryService.getBatchDetail(id);
        if (lot && lot.medicineId) {
          medicineId = lot.medicineId;
        }
      } catch (e) {
        // ID is already medicine ID
      }

      const alternatives = await medicineService.getAlternatives(medicineId, { currentHospitalId });
      return successResponse(res, alternatives, 'Marketplace alternatives retrieved');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = marketplaceController;
