const express = require('express');
const transferController = require('../controllers/transferController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All transfer and logistics tracking operations require authentication
router.use(authenticateUser);

// List transfers (tenant-isolated for hospitals; supervisory for admins)
router.get('/', transferController.getTransfers);

// Dispatch a new transfer consignment
router.post('/', transferController.createTransfer);

// Update transfer consignment milestone status or telemetry
router.patch('/:id/status', transferController.updateStatus);
router.put('/:id/status', transferController.updateStatus);

// Look up logistics tracking telemetry by transaction ID or tracking number
router.get('/track/:txnId', transferController.getTracking);
router.get('/:txnId', transferController.getTracking);

module.exports = router;
