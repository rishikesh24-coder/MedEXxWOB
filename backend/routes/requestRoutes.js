const express = require('express');
const requestController = require('../controllers/requestController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// 1. Static query views
router.get('/my', requestController.getMyRequests);
router.get('/incoming', requestController.getIncomingRequests);
router.get('/purchases', requestController.getPurchases);
router.get('/sales', requestController.getSales);
router.get('/', requestController.getRequests);

// 2. Creation
router.post('/', requestController.createRequest);

// 3. Dynamic parameterized routes
router.get('/:id/cancellation-policy', requestController.getCancellationPolicy);
router.post('/:id/cancel', requestController.cancelRequest);
router.patch('/:id/accept', requestController.acceptRequest);
router.patch('/:id/reject', requestController.rejectRequest);

// Backward-compatibility respond endpoint
router.put('/:id/respond', (req, res, next) => {
  const { action, reason } = req.body;
  if (action === 'accept') {
    return requestController.acceptRequest(req, res, next);
  } else if (action === 'reject') {
    return requestController.rejectRequest(req, res, next);
  }
  return res.status(400).json({ success: false, error: { message: 'Invalid action. Must be accept or reject.' } });
});

router.get('/:id', requestController.getRequestById);

module.exports = router;
