const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// Specific routes before parameterized :id
router.get('/marketplace', inventoryController.getMarketplace);

// Standard collection routes
router.get('/', inventoryController.getInventory);
router.post('/', inventoryController.addMedicine);

// Item specific routes
router.get('/:id', inventoryController.getLotById);
router.patch('/:id', inventoryController.updateMedicine);
router.put('/:id', inventoryController.updateMedicine);
router.delete('/:id', inventoryController.deleteMedicine);

// Stock adjustment and history ledger
router.post('/:id/adjust', inventoryController.adjustStock);
router.get('/:id/history', inventoryController.getLotHistory);

module.exports = router;
