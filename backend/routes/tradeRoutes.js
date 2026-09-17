const express = require('express');
const tradeController = require('../controllers/tradeController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All trading endpoints require valid authentication
router.use(authenticateUser);

// 1. Analytics & Summary Views
router.get('/summary', tradeController.getTradingSummary);
router.get('/history', tradeController.getTradeHistory);
router.get('/export', tradeController.exportTrades);
router.get('/analytics/admin', requireAdmin, tradeController.getAdminAnalytics);
router.get('/analytics/medicine/:medicineId', tradeController.getMedicineAnalytics);
router.get('/analytics/hospital/:hospitalId', tradeController.getHospitalAnalytics);

// 2. Listing & Specific Trade Queries
router.get('/', tradeController.getTrades);
router.get('/:id', tradeController.getTradeById);

module.exports = router;
