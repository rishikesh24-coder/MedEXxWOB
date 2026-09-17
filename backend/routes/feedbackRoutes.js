const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All feedback operations require authenticated identity
router.use(authenticateUser);

// Query feedback records (hospitals get own; admin gets network-wide)
router.get('/', feedbackController.getFeedbacks);

// Submit new feedback
router.post('/', feedbackController.submitFeedback);

// View single feedback record
router.get('/:id', feedbackController.getFeedbackById);

// Admin-only reply to feedback
router.patch('/:id/reply', requireAdmin, feedbackController.replyFeedback);
router.post('/:id/reply', requireAdmin, feedbackController.replyFeedback);

// Admin-only status progression ('new', 'reviewed', 'resolved')
router.patch('/:id/status', requireAdmin, feedbackController.updateStatus);

module.exports = router;
