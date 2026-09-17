const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { requireBodyFields } = require('../middleware/validator');

const router = express.Router();

// All administrative routes require authenticated administrator identity
router.use(authenticateUser, requireAdmin);

// 1. Hospital Verification Workflow
router.get('/hospitals/pending', adminController.getPendingHospitals);
router.get('/hospitals/:id/verification', adminController.getHospitalVerificationDossier);
router.patch('/hospitals/:id/approve', adminController.approveHospital);
router.patch('/hospitals/:id/reject', requireBodyFields(['reason']), adminController.rejectHospital);
router.patch('/hospitals/:id/review-status', requireBodyFields(['status']), adminController.setReviewStatus);

// Document-level verification
router.patch('/hospitals/:hospitalId/documents/:documentId/verify', adminController.verifyDocument);
router.patch('/hospitals/:hospitalId/documents/:documentId/reject', requireBodyFields(['reason']), adminController.rejectDocument);

// 2. Approved Hospital Directory (Admin -> Hospitals)
// Strictly separate: Only returns approved hospitals
router.get('/hospitals', adminController.getApprovedHospitals);
router.get('/hospitals/:id', adminController.getApprovedHospitalDetails);

// 3. Admin Inventory Dual Hierarchy 1: Medicine -> Hospitals -> Batches
router.get('/inventory/by-medicine', adminController.getInventoryByMedicine);
router.get('/inventory/by-medicine/:medicineId/contributors', adminController.getMedicineContributors);
router.get('/inventory/by-medicine/:medicineId/hospitals/:hospitalId/batches', adminController.getMedicineHospitalBatches);

// 4. Admin Inventory Dual Hierarchy 2: Hospital -> Medicines -> Batches
router.get('/inventory/by-hospital', adminController.getInventoryByHospital);
router.get('/inventory/by-hospital/:hospitalId/medicines', adminController.getHospitalMedicines);
router.get('/inventory/by-hospital/:hospitalId/medicines/:medicineId/batches', adminController.getHospitalMedicineBatches);

// 5. Admin Batch Inspection with exact verified purchase bill
router.get('/inventory/batches/:batchId', adminController.getBatchDetail);

// 6. Admin Refunds Monitoring
const refundController = require('../controllers/refundController');
router.get('/refunds', refundController.getAdminRefunds);

// 7. Phase 10: Admin Reports & Multi-Echelon Analytics
router.get('/reports', adminController.getReports);
router.get('/analytics', adminController.getAnalytics);
router.get('/hospitals/:id/trading-analytics', adminController.getHospitalTradingAnalytics);

module.exports = router;
