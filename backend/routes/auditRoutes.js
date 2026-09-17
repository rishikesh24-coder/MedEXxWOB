const express = require('express');
const auditController = require('../controllers/auditController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/', auditController.getAuditTrail);

module.exports = router;
