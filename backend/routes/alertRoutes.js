const express = require('express');
const alertController = require('../controllers/alertController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

// Stream must come before /:id routes
router.get('/stream', alertController.streamAlerts);
router.get('/unread-count', alertController.getUnreadCount);
router.get('/', alertController.getAlerts);

router.post('/scan', alertController.scanAlerts);

router.patch('/read-all', alertController.markAllRead);
router.put('/read-all', alertController.markAllRead);

router.patch('/:id/read', alertController.markRead);
router.put('/:id/read', alertController.markRead);

router.put('/:id/dismiss', alertController.dismiss);

module.exports = router;
