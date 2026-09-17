const alertService = require('../services/alertService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const alertController = {
  /**
   * Retrieves alerts with pagination, read/unread status, and type/severity filters
   */
  async getAlerts(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.query.hospitalId || null) : req.user?.hospitalId;

      const { isRead, type, category, severity, limit, offset } = req.query;

      const result = await alertService.getAlerts({
        hospitalId,
        isAdmin,
        isRead,
        alertType: type || category,
        severity,
        limit,
        offset,
      });

      return successResponse(res, result, 'Alerts retrieved successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Retrieves unread alert count
   */
  async getUnreadCount(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.query.hospitalId || null) : req.user?.hospitalId;

      const result = await alertService.getUnreadCount({ hospitalId, isAdmin });
      return successResponse(res, result, 'Unread alert count retrieved');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Marks a single alert as read
   */
  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = req.user?.hospitalId;

      const result = await alertService.markAlertRead(id, { hospitalId, isAdmin });
      return successResponse(res, result, 'Alert marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Marks all alerts as read for current hospital or system-wide for admin
   */
  async markAllRead(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.body?.hospitalId || req.query?.hospitalId || null) : req.user?.hospitalId;

      const result = await alertService.markAllAlertsRead({ hospitalId, isAdmin });
      return successResponse(res, result, 'All alerts marked as read');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Dismisses an alert
   */
  async dismiss(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = req.user?.hospitalId;

      const result = await alertService.dismissAlert(id, { hospitalId, isAdmin });
      return successResponse(res, result, 'Alert dismissed');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Server-side inventory scanner to detect low stock, expiring soon, and expired lots
   */
  async scanAlerts(req, res, next) {
    try {
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const hospitalId = isAdmin ? (req.body?.hospitalId || null) : req.user?.hospitalId;

      const results = await alertService.scanInventoryAlerts(hospitalId);
      return successResponse(res, results, 'Inventory alert scan completed successfully');
    } catch (err) {
      next(err);
    }
  },

  /**
   * Server-Sent Events (SSE) stream for real-time live alert dispatch
   */
  async streamAlerts(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const hospitalId = req.user?.hospitalId || null;

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', hospitalId, isAdmin, timestamp: new Date().toISOString() })}\n\n`);

    const client = alertService.addSseClient(res, { hospitalId, isAdmin });

    // Periodic heartbeat to prevent proxies/browsers from terminating idle connections
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (err) {
        clearInterval(heartbeatInterval);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeatInterval);
      alertService.removeSseClient(client);
      res.end();
    });
  }
};

module.exports = alertController;
