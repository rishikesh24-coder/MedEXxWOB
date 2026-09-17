const express = require('express');
const hospitalController = require('../controllers/hospitalController');
const { authenticateUser, requireAdmin, requireHospital, allowPendingHospital } = require('../middleware/auth');
const { requireBodyFields } = require('../middleware/validator');
const { registrationLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * POST /api/hospitals/register
 * Public registration endpoint for hospitals
 * Enforces mandatory fields, document checklist, duplicate detection, and PENDING_APPROVAL state.
 */
router.post('/register', registrationLimiter, hospitalController.registerHospital);

/**
 * GET /api/hospitals
 * Returns directory of approved/verified hospitals for network collaboration
 */
router.get('/', authenticateUser, hospitalController.getApprovedHospitals);

/**
 * GET /api/hospitals/me
 * Returns current authenticated hospital's institutional profile
 */
router.get('/me', authenticateUser, hospitalController.getMyHospital);

/**
 * PUT /api/hospitals/me
 * Updates current authenticated hospital's contact/location details
 */
router.put('/me', authenticateUser, hospitalController.updateMyHospital);

/**
 * GET /api/hospitals/operational-test
 * Gated operational test endpoint
 */
router.get('/operational-test', authenticateUser, requireHospital, hospitalController.getOperationalTest);

/**
 * GET /api/hospitals/pending-test
 * Onboarding test endpoint accessible to pending hospitals
 */
router.get('/pending-test', authenticateUser, allowPendingHospital, hospitalController.getPendingTest);

// Admin-only suspension and reactivation
router.put('/:id/suspend', authenticateUser, requireAdmin, requireBodyFields(['reason']), hospitalController.suspendHospital);
router.put('/:id/reactivate', authenticateUser, requireAdmin, hospitalController.reactivateHospital);

module.exports = router;
