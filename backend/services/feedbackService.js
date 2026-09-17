const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const auditService = require('./auditService');
const logger = require('../utils/logger');

// Fallback in-memory feedback store with realistic seed feedback
const fallbackFeedbacks = [
  {
    id: 'fb-0000001-0000-0000-0000-000000000001',
    hospitalId: '11111111-1111-1111-1111-111111111111',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    hospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    hospital_name: 'Apollo Hospital & Multi-Specialty Centre',
    rating: 5,
    category: 'Logistics & Cold-Chain',
    feedbackText: 'Cold-chain delivery arrived within SLA at precisely 3.8°C with digital data logger validation. Excellent compliance.',
    comment: 'Cold-chain delivery arrived within SLA at precisely 3.8°C with digital data logger validation. Excellent compliance.',
    adminReply: 'Thank you for verifying temperature logging. Nodal carrier performance logged.',
    admin_reply: 'Thank you for verifying temperature logging. Nodal carrier performance logged.',
    repliedDate: '2026-09-12',
    replied_date: '2026-09-12',
    status: 'resolved',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  }
];

class FeedbackService {
  /**
   * Submits new institutional feedback
   */
  async submitFeedback(feedbackData, user) {
    const rating = Number(feedbackData.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      const err = new Error('Feedback rating must be an integer between 1 and 5 stars.');
      err.statusCode = 400;
      err.code = 'INVALID_RATING';
      throw err;
    }

    const text = (feedbackData.feedbackText || feedbackData.comment || '').trim();
    if (!text) {
      const err = new Error('Feedback comments or evaluation text cannot be blank.');
      err.statusCode = 400;
      err.code = 'MISSING_FEEDBACK_TEXT';
      throw err;
    }

    const feedbackId = uuidv4();
    const hospitalId = user?.hospitalId || user?.id || feedbackData.hospitalId || '11111111-1111-1111-1111-111111111111';
    const hospitalName = user?.hospitalName || user?.name || feedbackData.hospitalName || 'Institutional Hospital';

    const newFeedback = {
      id: feedbackId,
      userId: user?.id || null,
      user_id: user?.id || null,
      hospitalId,
      hospital_id: hospitalId,
      hospitalName,
      hospital_name: hospitalName,
      requestId: feedbackData.requestId || null,
      request_id: feedbackData.requestId || null,
      transactionId: feedbackData.transactionId || null,
      transaction_id: feedbackData.transactionId || null,
      rating,
      category: feedbackData.category || 'General Service',
      comment: text,
      feedbackText: text,
      feedback_text: text,
      adminReply: null,
      admin_reply: null,
      repliedDate: null,
      replied_date: null,
      status: 'new',
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert into Supabase if configured
    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('feedback').insert({
          id: newFeedback.id,
          user_id: newFeedback.userId,
          hospital_id: newFeedback.hospitalId,
          hospital_name: newFeedback.hospitalName,
          request_id: newFeedback.requestId,
          transaction_id: newFeedback.transactionId,
          rating: newFeedback.rating,
          category: newFeedback.category,
          comment: newFeedback.comment,
          feedback_text: newFeedback.feedbackText,
          status: newFeedback.status,
        });
      } catch (err) {
        logger.warn('Failed to insert feedback into Supabase, saving in fallback memory:', err.message);
      }
    }

    fallbackFeedbacks.unshift(newFeedback);

    // Audit log
    auditService.logEvent({
      action: 'FEEDBACK_SUBMITTED',
      entityType: 'FEEDBACK',
      entityId: newFeedback.id,
      hospitalId: newFeedback.hospitalId,
      hospitalName: newFeedback.hospitalName,
      summary: `Hospital ${newFeedback.hospitalName} submitted ${newFeedback.rating}-star feedback under category "${newFeedback.category}"`,
      resultingStatus: 'new',
      metadata: { rating: newFeedback.rating, category: newFeedback.category }
    });

    return newFeedback;
  }

  /**
   * Retrieves feedbacks with role-based isolation
   */
  async getFeedbacks(filter = {}, user = null) {
    let feedbacks = [...fallbackFeedbacks];

    // Read from Supabase if configured
    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('feedback').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          feedbacks = data.map(f => ({
            id: f.id,
            userId: f.user_id,
            hospitalId: f.hospital_id,
            hospitalName: f.hospital_name,
            requestId: f.request_id,
            transactionId: f.transaction_id,
            rating: f.rating,
            category: f.category,
            comment: f.comment || f.feedback_text,
            feedbackText: f.feedback_text || f.comment,
            adminReply: f.admin_reply,
            repliedDate: f.replied_date,
            status: f.status,
            createdAt: f.created_at,
          }));
        }
      } catch (err) {
        logger.warn('Supabase feedback query failed, using memory fallback:', err.message);
      }
    }

    // Role-based tenant isolation:
    // Non-admin hospitals can only see feedback they submitted
    if (user && user.role !== 'admin') {
      const userHospId = user.hospitalId || user.id;
      feedbacks = feedbacks.filter(f => f.hospitalId === userHospId || f.hospital_id === userHospId);
    }

    // Filter by rating
    if (filter.rating && filter.rating !== 'all') {
      const r = Number(filter.rating);
      feedbacks = feedbacks.filter(f => f.rating === r);
    }

    // Filter by status ('all', 'new', 'reviewed', 'resolved')
    if (filter.status && filter.status !== 'all') {
      feedbacks = feedbacks.filter(f => (f.status || '').toLowerCase() === filter.status.toLowerCase());
    }

    // Filter by category
    if (filter.category && filter.category !== 'all') {
      feedbacks = feedbacks.filter(f => (f.category || '').toLowerCase() === filter.category.toLowerCase());
    }

    // Search query
    if (filter.search) {
      const q = filter.search.toLowerCase();
      feedbacks = feedbacks.filter(f => 
        (f.feedbackText || f.comment || '').toLowerCase().includes(q) ||
        (f.hospitalName || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q)
      );
    }

    return feedbacks;
  }

  /**
   * Retrieves single feedback record by ID with authorization verification
   */
  async getFeedbackById(id, user = null) {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();

    let feedback = fallbackFeedbacks.find(f => f.id.toLowerCase() === cleanId);

    if (!feedback && isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('feedback').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          feedback = {
            id: data.id,
            userId: data.user_id,
            hospitalId: data.hospital_id,
            hospitalName: data.hospital_name,
            requestId: data.request_id,
            transactionId: data.transaction_id,
            rating: data.rating,
            category: data.category,
            comment: data.comment || data.feedback_text,
            feedbackText: data.feedback_text || data.comment,
            adminReply: data.admin_reply,
            repliedDate: data.replied_date,
            status: data.status,
            createdAt: data.created_at,
          };
        }
      } catch (err) {
        logger.warn('Failed to query single feedback from Supabase:', err.message);
      }
    }

    if (!feedback) {
      const err = new Error(`Feedback record '${id}' not found.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Tenant isolation check
    if (user && user.role !== 'admin') {
      const userHospId = user.hospitalId || user.id;
      if (feedback.hospitalId !== userHospId && feedback.hospital_id !== userHospId) {
        const err = new Error('Access denied: You do not have permission to inspect feedback from other institutions.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_FEEDBACK_ACCESS';
        throw err;
      }
    }

    return feedback;
  }

  /**
   * Admin writes resolution reply to a feedback record
   */
  async replyFeedback(id, replyText, adminUser) {
    const cleanText = (replyText || '').trim();
    if (!cleanText) {
      const err = new Error('Administrator response reply cannot be empty.');
      err.statusCode = 400;
      err.code = 'MISSING_REPLY_TEXT';
      throw err;
    }

    const feedback = await this.getFeedbackById(id, adminUser);
    const today = new Date().toISOString().split('T')[0];

    feedback.adminReply = cleanText;
    feedback.admin_reply = cleanText;
    feedback.repliedDate = today;
    feedback.replied_date = today;
    if (feedback.status === 'new') {
      feedback.status = 'under_review';
    }

    // Persist in memory fallback
    const memIdx = fallbackFeedbacks.findIndex(f => f.id.toLowerCase() === id.toLowerCase());
    if (memIdx !== -1) {
      fallbackFeedbacks[memIdx].adminReply = cleanText;
      fallbackFeedbacks[memIdx].admin_reply = cleanText;
      fallbackFeedbacks[memIdx].repliedDate = today;
      fallbackFeedbacks[memIdx].replied_date = today;
      fallbackFeedbacks[memIdx].status = feedback.status;
    }

    // Persist in Supabase
    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('feedback')
          .update({
            admin_reply: cleanText,
            replied_date: today,
            status: feedback.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        logger.warn('Failed to update feedback reply in Supabase:', err.message);
      }
    }

    // Audit log
    auditService.logEvent({
      action: 'FEEDBACK_REPLIED',
      entityType: 'FEEDBACK',
      entityId: feedback.id,
      hospitalId: feedback.hospitalId,
      hospitalName: feedback.hospitalName,
      summary: `Administrator replied to feedback from ${feedback.hospitalName}`,
      resultingStatus: feedback.status,
      metadata: { replyText: cleanText, status: feedback.status }
    });

    return feedback;
  }

  /**
   * Admin updates feedback workflow status ('new', 'reviewed', 'resolved')
   */
  async updateFeedbackStatus(id, newStatus, adminUser) {
    const validStatuses = ['new', 'reviewed', 'resolved'];
    const statusLower = (newStatus || '').toLowerCase();
    if (!validStatuses.includes(statusLower)) {
      const err = new Error(`Invalid status '${newStatus}'. Must be one of: ${validStatuses.join(', ')}`);
      err.statusCode = 400;
      err.code = 'INVALID_STATUS';
      throw err;
    }

    const feedback = await this.getFeedbackById(id, adminUser);
    feedback.status = statusLower;

    const memIdx = fallbackFeedbacks.findIndex(f => f.id.toLowerCase() === id.toLowerCase());
    if (memIdx !== -1) {
      fallbackFeedbacks[memIdx].status = statusLower;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('feedback')
          .update({
            status: statusLower,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        logger.warn('Failed to update feedback status in Supabase:', err.message);
      }
    }

    auditService.logEvent({
      action: statusLower === 'resolved' ? 'FEEDBACK_RESOLVED' : 'FEEDBACK_STATUS_UPDATED',
      entityType: 'FEEDBACK',
      entityId: feedback.id,
      hospitalId: feedback.hospitalId,
      hospitalName: feedback.hospitalName,
      summary: `Administrator updated feedback status to "${statusLower}" for ${feedback.hospitalName}`,
      resultingStatus: statusLower,
    });

    return feedback;
  }
}

module.exports = new FeedbackService();
