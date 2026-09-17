const medicineService = require('../services/medicineService');
const { successResponse } = require('../utils/apiResponse');

const medicineController = {
  /**
   * GET /api/medicines
   * Search and list medicines with pagination
   */
  async listMedicines(req, res, next) {
    try {
      const { search, category, dosageForm, page, limit } = req.query;
      const result = await medicineService.listMedicines({
        search,
        category,
        dosageForm,
        page,
        limit,
      });
      return successResponse(res, result, 'Master medicines retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/medicines/:id
   * Get single medicine by UUID or code
   */
  async getMedicineById(req, res, next) {
    try {
      const { id } = req.params;
      const medicine = await medicineService.getMedicineById(id);
      return successResponse(res, medicine, 'Medicine details retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/medicines
   * Register new medicine in master formulary catalogue
   */
  async createMedicine(req, res, next) {
    try {
      const result = await medicineService.createMedicine(req.body, req.user);
      return successResponse(res, result, 'Medicine successfully registered in master catalogue', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/medicines/:id
   * Update master medicine formulary record
   */
  async updateMedicine(req, res, next) {
    try {
      const { id } = req.params;
      const result = await medicineService.updateMedicine(id, req.body, req.user);
      return successResponse(res, result, 'Medicine formulation updated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/medicines/:id
   * Deactivate master medicine formulary record
   */
  async deleteMedicine(req, res, next) {
    try {
      const { id } = req.params;
      const result = await medicineService.deleteMedicine(id, req.user);
      return successResponse(res, result, 'Medicine formulation deactivated successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/medicines/:id/alternatives
   * Clinical exact alternative composition matching
   */
  async getAlternatives(req, res, next) {
    try {
      const { id } = req.params;
      const currentHospitalId = req.user?.hospitalId || req.query.currentHospitalId || null;
      const result = await medicineService.getAlternatives(id, { currentHospitalId });
      return successResponse(res, result, 'Clinically equivalent medicine alternatives retrieved');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = medicineController;
