const feedbackService = require('../services/feedbackService');

class FeedbackController {
  async getFeedbacks(req, res, next) {
    try {
      const { rating, status, category, search, page, limit } = req.query;
      const feedbacks = await feedbackService.getFeedbacks({ rating, status, category, search, page, limit }, req.user);
      return res.status(200).json({
        success: true,
        data: feedbacks,
        meta: {
          total: feedbacks.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async getFeedbackById(req, res, next) {
    try {
      const { id } = req.params;
      const feedback = await feedbackService.getFeedbackById(id, req.user);
      return res.status(200).json({
        success: true,
        data: feedback,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async submitFeedback(req, res, next) {
    try {
      const feedback = await feedbackService.submitFeedback(req.body, req.user);
      return res.status(201).json({
        success: true,
        data: feedback,
        message: 'Institutional feedback successfully recorded.',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async replyFeedback(req, res, next) {
    try {
      const { id } = req.params;
      const { replyText, adminReply } = req.body;
      const text = replyText || adminReply;
      const updated = await feedbackService.replyFeedback(id, text, req.user);
      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Administrator resolution reply successfully posted.',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await feedbackService.updateFeedbackStatus(id, status, req.user);
      return res.status(200).json({
        success: true,
        data: updated,
        message: `Feedback status updated to "${status}".`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FeedbackController();
