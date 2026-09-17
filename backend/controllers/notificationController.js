const notificationService = require('../services/notificationService');
const { successResponse } = require('../utils/apiResponse');

const notificationController = {
  /**
   * Retrieves notifications with pagination, read/unread status, and type filters
   */
  async getNotifications(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.query.hospitalId || null) : req.user?.hospitalId;
      const userId = req.user?.id || null;

      const { isRead, type, limit, offset } = req.query;

      const result = await notificationService.getNotifications({
        hospitalId,
        userId,
        isAdmin,
        isRead,
        type,
        limit,
        offset,
      });

      return successResponse(res, result, 'Notifications retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Retrieves unread notification count
   */
  async getUnreadCount(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.query.hospitalId || null) : req.user?.hospitalId;
      const userId = req.user?.id || null;

      const result = await notificationService.getUnreadCount({ hospitalId, userId, isAdmin });
      return successResponse(res, result, 'Unread notification count retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Marks a single notification as read
   */
  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = req.user?.hospitalId;
      const userId = req.user?.id;

      const result = await notificationService.markRead(id, { hospitalId, userId, isAdmin });
      return successResponse(res, result, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Marks all notifications as read for current hospital or user
   */
  async markAllRead(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.body?.hospitalId || req.query?.hospitalId || null) : req.user?.hospitalId;
      const userId = req.user?.id || null;

      const result = await notificationService.markAllRead({ hospitalId, userId, isAdmin });
      return successResponse(res, result, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = notificationController;
