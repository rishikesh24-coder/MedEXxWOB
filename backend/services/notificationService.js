const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const logger = require('../utils/logger');

// Local in-memory notification store for development / offline resilience
const fallbackNotifications = [];

const notificationService = {
  /**
   * Creates an in-app notification with stable references for exact deep-linking
   * @param {object} params
   */
  async createNotification({
    hospitalId,
    userId = null,
    notificationType = 'INFO',
    type = 'info',
    title,
    message,
    relatedEntityType = null,
    relatedEntityId = null,
    link = null,
    metadata = {},
  }) {
    const notification = {
      id: uuidv4(),
      hospital_id: hospitalId || null,
      user_id: userId || null,
      recipient_user_id: userId || null,
      notification_type: notificationType,
      type,
      title,
      message: message || '',
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId ? String(relatedEntityId) : null,
      link,
      metadata: metadata || {},
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert([notification])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        logger.warn('Supabase notification insertion failed:', err.message);
      }
    }

    fallbackNotifications.unshift(notification);
    if (fallbackNotifications.length > 500) fallbackNotifications.length = 500;
    return notification;
  },

  /**
   * Retrieves notifications with pagination and status filters
   */
  async getNotifications({
    hospitalId = null,
    userId = null,
    isAdmin = false,
    isRead = null,
    type = null,
    limit = 50,
    offset = 0,
  }) {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client
          .from('notifications')
          .select('*', { count: 'exact' });

        if (!isAdmin) {
          if (hospitalId && userId) {
            query = query.or(`hospital_id.eq.${hospitalId},recipient_user_id.eq.${userId},user_id.eq.${userId}`);
          } else if (hospitalId) {
            query = query.eq('hospital_id', hospitalId);
          } else if (userId) {
            query = query.or(`recipient_user_id.eq.${userId},user_id.eq.${userId}`);
          }
        }

        if (isRead !== null && isRead !== undefined) {
          const boolRead = isRead === true || isRead === 'true';
          query = query.eq('is_read', boolRead);
        }

        if (type) {
          query = query.or(`type.eq.${type},notification_type.eq.${type}`);
        }

        query = query
          .order('created_at', { ascending: false })
          .range(parsedOffset, parsedOffset + parsedLimit - 1);

        const { data, count, error } = await query;
        if (!error && data && data.length > 0) {
          return {
            items: data,
            notifications: data,
            total: count !== null ? count : data.length,
            limit: parsedLimit,
            offset: parsedOffset,
          };
        }
      } catch (err) {
        logger.warn('Supabase notifications query failed, using fallback:', err.message);
      }
    }

    let items = [...fallbackNotifications];

    if (!isAdmin) {
      if (hospitalId && userId) {
        items = items.filter(
          (n) =>
            n.hospital_id === hospitalId ||
            n.recipient_user_id === userId ||
            n.user_id === userId
        );
      } else if (hospitalId) {
        items = items.filter((n) => n.hospital_id === hospitalId);
      } else if (userId) {
        items = items.filter(
          (n) => n.recipient_user_id === userId || n.user_id === userId
        );
      }
    }

    if (isRead !== null && isRead !== undefined) {
      const boolRead = isRead === true || isRead === 'true';
      items = items.filter((n) => Boolean(n.is_read) === boolRead);
    }

    if (type) {
      items = items.filter(
        (n) =>
          (n.type && n.type.toLowerCase() === type.toLowerCase()) ||
          (n.notification_type && n.notification_type.toLowerCase() === type.toLowerCase())
      );
    }

    const total = items.length;
    const paginated = items.slice(parsedOffset, parsedOffset + parsedLimit);

    return {
      items: paginated,
      notifications: paginated,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    };
  },

  /**
   * Retrieves count of unread notifications
   */
  async getUnreadCount({ hospitalId = null, userId = null, isAdmin = false }) {
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false);

        if (!isAdmin) {
          if (hospitalId && userId) {
            query = query.or(`hospital_id.eq.${hospitalId},recipient_user_id.eq.${userId},user_id.eq.${userId}`);
          } else if (hospitalId) {
            query = query.eq('hospital_id', hospitalId);
          } else if (userId) {
            query = query.or(`recipient_user_id.eq.${userId},user_id.eq.${userId}`);
          }
        }

        const { count, error } = await query;
        if (!error && count !== null) return { unreadCount: count };
      } catch (err) {
        logger.warn('Supabase notifications unread count failed, using fallback:', err.message);
      }
    }

    let items = fallbackNotifications.filter((n) => !n.is_read);
    if (!isAdmin) {
      if (hospitalId && userId) {
        items = items.filter(
          (n) =>
            n.hospital_id === hospitalId ||
            n.recipient_user_id === userId ||
            n.user_id === userId
        );
      } else if (hospitalId) {
        items = items.filter((n) => n.hospital_id === hospitalId);
      } else if (userId) {
        items = items.filter(
          (n) => n.recipient_user_id === userId || n.user_id === userId
        );
      }
    }

    return { unreadCount: items.length };
  },

  /**
   * Marks a single notification as read
   */
  async markRead(id, { hospitalId = null, userId = null, isAdmin = false } = {}) {
    const readAt = new Date().toISOString();

    if (isConfigured && supabaseAdmin) {
      try {
        let query = supabaseAdmin
          .from('notifications')
          .update({ is_read: true, read_at: readAt })
          .eq('id', id);

        if (!isAdmin && hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }

        const { data, error } = await query.select().single();
        if (!error && data) return data;
      } catch (err) {
        logger.warn('Supabase markRead notification failed, using fallback:', err.message);
      }
    }

    const item = fallbackNotifications.find((n) => n.id === id);
    if (item) {
      if (!isAdmin && hospitalId && item.hospital_id && item.hospital_id !== hospitalId) {
        throw new Error('Unauthorized to mark this notification as read');
      }
      item.is_read = true;
      item.read_at = readAt;
      return item;
    }

    return { id, is_read: true, read_at: readAt };
  },

  /**
   * Marks all notifications as read for a hospital or user
   */
  async markAllRead({ hospitalId = null, userId = null, isAdmin = false }) {
    const readAt = new Date().toISOString();

    if (isConfigured && supabaseAdmin) {
      try {
        let query = supabaseAdmin
          .from('notifications')
          .update({ is_read: true, read_at: readAt })
          .eq('is_read', false);

        if (!isAdmin) {
          if (hospitalId) {
            query = query.eq('hospital_id', hospitalId);
          } else if (userId) {
            query = query.or(`recipient_user_id.eq.${userId},user_id.eq.${userId}`);
          }
        }

        await query;
      } catch (err) {
        logger.warn('Supabase markAllRead notifications failed:', err.message);
      }
    }

    let updatedCount = 0;
    fallbackNotifications.forEach((n) => {
      let matches = false;
      if (isAdmin) {
        matches = true;
      } else if (hospitalId && n.hospital_id === hospitalId) {
        matches = true;
      } else if (userId && (n.recipient_user_id === userId || n.user_id === userId)) {
        matches = true;
      }

      if (matches && !n.is_read) {
        n.is_read = true;
        n.read_at = readAt;
        updatedCount++;
      }
    });

    return { success: true, updatedCount, readAt };
  },

  /**
   * Helper to retrieve notifications specifically for a hospital
   */
  async getNotificationsForHospital(hospitalId, limit = 50) {
    const res = await this.getNotifications({ hospitalId, limit });
    return res.items || res;
  },

  getDevNotifications() {
    return fallbackNotifications;
  },
};

module.exports = notificationService;
