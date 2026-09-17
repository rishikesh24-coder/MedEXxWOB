const express = require('express');
const medicineController = require('../controllers/medicineController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Allow public or authenticated discovery of master clinical medicines
router.get('/', medicineController.listMedicines);
router.get('/:id/alternatives', medicineController.getAlternatives);
router.get('/:id', medicineController.getMedicineById);

// Creation, modification and deactivation strictly require authenticated administrator privilege
router.post('/', authenticateUser, requireAdmin, medicineController.createMedicine);
router.patch('/:id', authenticateUser, requireAdmin, medicineController.updateMedicine);
router.delete('/:id', authenticateUser, requireAdmin, medicineController.deleteMedicine);

module.exports = router;
