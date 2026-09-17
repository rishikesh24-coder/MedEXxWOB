const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const logger = require('../utils/logger');

// Local in-memory store for development fallback
const fallbackAuditLogs = [];

const auditService = {
  /**
   * Logs a compliant immutable audit event
   */
  async logEvent({
    action,
    entityType,
    entityId,
    actorRole = 'hospital',
    hospitalId = null,
    hospitalName = null,
    partnerHospitalId = null,
    partnerHospitalName = null,
    summary,
    resultingStatus = null,
    metadata = {},
  }) {
    // Defense-in-depth: Never persist secrets or tokens in audit logs
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.token;
    delete safeMetadata.secret;
    delete safeMetadata.authToken;
    delete safeMetadata.credentials;

    const event = {
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      actor_role: actorRole,
      hospital_id: hospitalId,
      hospital_name: hospitalName,
      partner_hospital_id: partnerHospitalId,
      partner_hospital_name: partnerHospitalName,
      summary,
      resulting_status: resultingStatus,
      metadata: safeMetadata,
      created_at: new Date().toISOString(),
    };

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client.from('audit_logs').insert([event]).select().single();
        if (!error && data) return data;
      } catch (err) {
        logger.warn('Failed to insert audit log into Supabase. Storing in local audit buffer:', err.message);
      }
    }

    const localLog = { id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...event };
    fallbackAuditLogs.unshift(localLog);
    if (fallbackAuditLogs.length > 500) fallbackAuditLogs.length = 500;
    return localLog;
  },

  /**
   * Fetches audit logs with optional filtering
   */
  async getAuditTrail({ hospitalId = null, entityType = null, entityId = null, search = null, limit = 50 }) {
    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);

        if (hospitalId && hospitalId !== 'admin') {
          query = query.or(`hospital_id.eq.${hospitalId},partner_hospital_id.eq.${hospitalId}`);
        }
        if (entityType && entityType !== 'all') {
          query = query.eq('entity_type', entityType);
        }
        if (entityId) {
          query = query.eq('entity_id', String(entityId));
        }
        if (search) {
          query = query.ilike('summary', `%${search}%`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        logger.warn('Failed to query Supabase audit logs, falling back to local store:', err.message);
      }
    }

    let logs = [...fallbackAuditLogs];
    if (hospitalId && hospitalId !== 'admin') {
      logs = logs.filter((l) => l.hospital_id === hospitalId || l.partner_hospital_id === hospitalId);
    }
    if (entityType && entityType !== 'all') {
      logs = logs.filter((l) => l.entity_type === entityType);
    }
    if (entityId) {
      logs = logs.filter((l) => String(l.entity_id) === String(entityId));
    }
    if (search) {
      const q = search.toLowerCase();
      logs = logs.filter((l) => (l.summary || '').toLowerCase().includes(q) || (l.action || '').toLowerCase().includes(q));
    }
    return logs.slice(0, limit);
  }
};

module.exports = auditService;
