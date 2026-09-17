const express = require('express');
const marketplaceController = require('../controllers/marketplaceController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', marketplaceController.getMarketplace);
router.get('/:id', marketplaceController.getMarketplaceItem);
router.get('/:id/alternatives', marketplaceController.getMarketplaceAlternatives);

module.exports = router;
