const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser);

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/', notificationController.getNotifications);

router.patch('/read-all', notificationController.markAllRead);
router.put('/read-all', notificationController.markAllRead);

router.patch('/:id/read', notificationController.markRead);
router.put('/:id/read', notificationController.markRead);

module.exports = router;
