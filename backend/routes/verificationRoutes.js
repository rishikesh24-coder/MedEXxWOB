const express = require('express');
const verificationController = require('../controllers/verificationController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { requireBodyFields } = require('../middleware/validator');

const router = express.Router();

// All verification endpoints are admin-controlled
router.use(authenticateUser, requireAdmin);

router.put('/:id/approve', verificationController.approveHospital);
router.put('/:id/reject', requireBodyFields(['reason']), verificationController.rejectHospital);
router.put('/:id/review-status', requireBodyFields(['status']), verificationController.setReviewStatus);

router.put('/:hospitalId/documents/:documentId/verify', verificationController.verifyDocument);
router.put('/:hospitalId/documents/:documentId/reject', requireBodyFields(['reason']), verificationController.rejectDocument);

module.exports = router;
