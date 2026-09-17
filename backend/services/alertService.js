const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const inventoryService = require('./inventoryService');
const logger = require('../utils/logger');

// Local fallback store for offline development / test environments
const fallbackAlerts = [];
const sseClients = new Set();

const alertService = {
  /**
   * Registers a client connection for real-time Server-Sent Events (SSE)
   */
  registerSSEClient(client) {
    sseClients.add(client);
    logger.info(`SSE client connected. Active connections: ${sseClients.size}`);
    return () => {
      sseClients.delete(client);
      logger.info(`SSE client disconnected. Active connections: ${sseClients.size}`);
    };
  },

  addSseClient(res, { hospitalId = null, userId = null, isAdmin = false } = {}) {
    const client = { res, hospitalId, userId, role: isAdmin ? 'admin' : 'hospital' };
    sseClients.add(client);
    return client;
  },

  removeSseClient(client) {
    if (client) sseClients.delete(client);
  },

  /**
   * Broadcasts a real-time event to connected SSE clients
   */
  broadcastEvent(eventType, payload, targetHospitalId = null, targetUserId = null) {
    const data = JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() });
    for (const client of sseClients) {
      if (targetHospitalId && client.hospitalId && client.hospitalId !== targetHospitalId && client.role !== 'admin') {
        continue;
      }
      if (targetUserId && client.userId && client.userId !== targetUserId && client.role !== 'admin') {
        continue;
      }
      try {
        client.res.write(`event: ${eventType}\ndata: ${data}\n\n`);
      } catch (err) {
        logger.warn('Failed to dispatch SSE event to client:', err.message);
      }
    }
  },

  /**
   * Deterministically creates an alert with deduplication protection
   */
  async createAlert({
    hospitalId,
    recipientUserId = null,
    groupType = 'info',
    severity = 'INFO',
    category = 'SYSTEM',
    alertType = 'INFO',
    type = null,
    title,
    message,
    description = null,
    link = null,
    actionText = 'Inspect',
    urgent = false,
    sourceId = null,
    targetType = 'system',
    targetId = null,
    inventoryLotId = null,
    medicineId = null,
    batchNo = null,
    requestId = null,
    transferId = null,
    paymentId = null,
    refundId = null,
    dedupKey = null,
    metadata = {},
  }) {
    const finalType = alertType || type || 'INFO';
    const finalCategory = category || finalType;
    const finalSeverity = severity.toUpperCase();
    const finalMessage = message || description || title;

    const finalInvId = inventoryLotId || (String(targetType).toLowerCase() === 'inventory' ? targetId : null) || metadata?.inventoryLotId;
    const finalBatchNo = batchNo || metadata?.batchNo;
    const finalRequestId = requestId || (String(targetType).toLowerCase() === 'request' ? targetId : null) || metadata?.requestId;
    const finalTransferId = transferId || (String(targetType).toLowerCase() === 'transfer' ? targetId : null) || metadata?.transferId;
    const finalPaymentId = paymentId || (String(targetType).toLowerCase() === 'payment' ? targetId : null) || metadata?.paymentId;

    const targetEntityId = finalInvId || finalRequestId || finalTransferId || finalPaymentId || refundId || sourceId || 'global';
    
    // Deterministic deduplication key: recipient + alert_type + target_entity
    const computedDedupKey = dedupKey || `${hospitalId || 'admin'}_${finalType}_${targetEntityId}`;

    // 1. Check if an active (unread and undismissed) duplicate alert already exists
    const existing = await this.findActiveAlertByDedupKey(computedDedupKey);
    if (existing) {
      logger.debug(`Skipping duplicate alert creation for dedupKey: ${computedDedupKey}`);
      return existing;
    }

    // Compute deterministic deep link if not supplied
    let computedLink = link;
    if (!computedLink) {
      if (finalInvId) {
        const batchQuery = finalBatchNo ? `&batchNo=${encodeURIComponent(finalBatchNo)}` : '';
        computedLink = `/hospital/inventory?inventoryLotId=${encodeURIComponent(finalInvId)}${batchQuery}`;
      } else if (finalRequestId) {
        computedLink = `/hospital/my-requests?requestId=${encodeURIComponent(finalRequestId)}`;
      } else if (finalTransferId) {
        computedLink = `/hospital/track?transferId=${encodeURIComponent(finalTransferId)}`;
      } else {
        computedLink = hospitalId ? '/hospital/dashboard' : '/admin/dashboard';
      }
    }

    const nowIso = new Date().toISOString();
    const alertRecord = {
      id: `alert-${Date.now()}-${uuidv4().slice(0, 8)}`,
      hospital_id: hospitalId || null,
      hospitalId: hospitalId || null,
      recipient_user_id: recipientUserId || null,
      recipientUserId: recipientUserId || null,
      group_type: groupType.toLowerCase(),
      groupType: groupType.toLowerCase(),
      severity: finalSeverity,
      category: finalCategory,
      alert_type: finalType,
      alertType: finalType,
      type: finalType,
      title,
      message: finalMessage,
      description: finalMessage,
      link: computedLink,
      deep_link: computedLink,
      deepLink: computedLink,
      action_text: actionText,
      actionText,
      urgent: Boolean(urgent || finalSeverity === 'CRITICAL'),
      source_id: sourceId ? String(sourceId) : null,
      sourceId: sourceId ? String(sourceId) : null,
      target_type: targetType,
      targetType,
      inventory_lot_id: finalInvId || null,
      inventoryLotId: finalInvId || null,
      medicine_id: medicineId || null,
      medicineId: medicineId || null,
      batch_no: finalBatchNo || null,
      batchNo: finalBatchNo || null,
      request_id: finalRequestId || null,
      requestId: finalRequestId || null,
      transfer_id: finalTransferId || null,
      transferId: finalTransferId || null,
      payment_id: finalPaymentId || null,
      paymentId: finalPaymentId || null,
      refund_id: refundId || null,
      refundId: refundId || null,
      dedup_key: computedDedupKey,
      dedupKey: computedDedupKey,
      is_read: false,
      isRead: false,
      read: false,
      is_dismissed: false,
      isDismissed: false,
      metadata: {
        batchNo,
        medicineId,
        inventoryLotId,
        ...(metadata || {}),
      },
      created_at: nowIso,
      createdAt: nowIso,
      updated_at: nowIso,
      updatedAt: nowIso,
    };

    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('alerts').insert([{
          id: alertRecord.id,
          hospital_id: alertRecord.hospital_id,
          recipient_user_id: alertRecord.recipient_user_id,
          group_type: alertRecord.group_type,
          severity: alertRecord.severity,
          category: alertRecord.category,
          alert_type: alertRecord.alert_type,
          title: alertRecord.title,
          message: alertRecord.message,
          description: alertRecord.description,
          link: alertRecord.link,
          action_text: alertRecord.action_text,
          urgent: alertRecord.urgent,
          source_id: alertRecord.source_id,
          target_type: alertRecord.target_type,
          inventory_lot_id: alertRecord.inventory_lot_id,
          medicine_id: alertRecord.medicine_id,
          batch_no: alertRecord.batch_no,
          request_id: alertRecord.request_id,
          transfer_id: alertRecord.transfer_id,
          payment_id: alertRecord.payment_id,
          refund_id: alertRecord.refund_id,
          dedup_key: alertRecord.dedup_key,
          is_read: alertRecord.is_read,
        }]).select().single();

        if (!error && data) {
          this.broadcastEvent('ALERT_CREATED', data, hospitalId, recipientUserId);
          fallbackAlerts.unshift({ ...alertRecord, ...data });
          return { ...alertRecord, ...data };
        }
      } catch (dbErr) {
        logger.warn('Supabase alert insertion error, falling back to local store:', dbErr.message);
      }
    }

    fallbackAlerts.unshift(alertRecord);
    if (fallbackAlerts.length > 500) fallbackAlerts.length = 500;

    // Broadcast real-time update
    this.broadcastEvent('ALERT_CREATED', alertRecord, hospitalId, recipientUserId);
    return alertRecord;
  },

  /**
   * Helper: Finds an active (un-dismissed) alert by dedup_key
   */
  async findActiveAlertByDedupKey(dedupKey) {
    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('alerts')
          .select('*')
          .eq('dedup_key', dedupKey)
          .eq('is_dismissed', false)
          .single();

        if (!error && data) return data;
      } catch {
        // Fall through
      }
    }

    return fallbackAlerts.find((a) => (a.dedupKey === dedupKey || a.dedup_key === dedupKey) && !a.isDismissed && !a.dismissed && !a.is_dismissed);
  },

  async findAlertById(id) {
    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('alerts')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch {}
    }
    return fallbackAlerts.find((a) => a.id === id) || null;
  },

  /**
   * Server-side inventory alert scanner:
   * Generates EXPIRED, EXPIRING_SOON, and LOW_STOCK alerts with deterministic deduplication
   */
  async scanInventoryAlerts(arg = {}) {
    const hospitalId = (typeof arg === 'string' ? arg : arg?.hospitalId) || null;
    logger.info(`Running authoritative inventory alert scan for hospital: ${hospitalId || 'all'}`);
    
    let lotsData = await inventoryService.getInventory({ hospitalId });
    const lots = Array.isArray(lotsData) ? lotsData : (lotsData?.items || []);
    const now = new Date();
    const generated = [];
    let newCount = 0;

    for (const lot of lots) {
      const expDate = lot.expiryDate ? new Date(lot.expiryDate) : null;
      const daysRemaining = expDate ? Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)) : 999;
      const availableQty = Number(lot.availableQuantity !== undefined ? lot.availableQuantity : lot.quantity || 0);
      const minStock = Number(lot.minStockLevel || 20);
      const medName = lot.medicineName || lot.medicine || 'Pharmaceutical Compound';
      const lotHospId = lot.hospitalId || lot.hospital_id || hospitalId;

      // 1. EXPIRED (CRITICAL)
      if (daysRemaining <= 0 || lot.status === 'EXPIRED') {
        const alert = await this.createAlert({
          hospitalId: lotHospId,
          groupType: 'critical',
          severity: 'CRITICAL',
          category: 'INVENTORY',
          alertType: 'EXPIRED',
          title: `Expired Stock Alert: ${medName}`,
          message: `Batch ${lot.batchNo || 'N/A'} (${availableQty} units) has passed its statutory expiry date. Immediate quarantine required.`,
          link: `/hospital/inventory?inventoryLotId=${encodeURIComponent(lot.id)}&batchNo=${encodeURIComponent(lot.batchNo || '')}`,
          actionText: 'Inspect Lot',
          urgent: true,
          targetType: 'inventory',
          inventoryLotId: lot.id,
          medicineId: lot.medicineId || lot.medicine_id,
          batchNo: lot.batchNo,
          dedupKey: `${lotHospId}_EXPIRED_${lot.id}`,
        });
        if (alert) { generated.push(alert); newCount++; }
      }
      // 2. EXPIRING_SOON (WARNING)
      else if (daysRemaining <= 60) {
        const alert = await this.createAlert({
          hospitalId: lotHospId,
          groupType: 'action',
          severity: 'WARNING',
          category: 'INVENTORY',
          alertType: 'EXPIRING_SOON',
          title: `Expiring Soon: ${medName}`,
          message: `Batch ${lot.batchNo || 'N/A'} (${availableQty} units) expires in ${daysRemaining} days. Prioritize peer hospital redistribution or consumption.`,
          link: `/hospital/inventory?inventoryLotId=${encodeURIComponent(lot.id)}&batchNo=${encodeURIComponent(lot.batchNo || '')}`,
          actionText: 'View in Inventory',
          urgent: daysRemaining <= 30,
          targetType: 'inventory',
          inventoryLotId: lot.id,
          medicineId: lot.medicineId || lot.medicine_id,
          batchNo: lot.batchNo,
          dedupKey: `${lotHospId}_EXPIRING_SOON_${lot.id}`,
        });
        if (alert) { generated.push(alert); newCount++; }
      }

      // 3. LOW_STOCK (WARNING)
      if (availableQty <= minStock && daysRemaining > 0) {
        const alert = await this.createAlert({
          hospitalId: lotHospId,
          groupType: 'action',
          severity: 'WARNING',
          category: 'INVENTORY',
          alertType: 'LOW_STOCK',
          title: `Low Stock Reserve: ${medName}`,
          message: `Available inventory is ${availableQty} units (below safety threshold ${minStock}). Reorder or request replenishment.`,
          link: `/hospital/inventory?inventoryLotId=${encodeURIComponent(lot.id)}&batchNo=${encodeURIComponent(lot.batchNo || '')}`,
          actionText: 'Inspect Lot',
          urgent: false,
          targetType: 'inventory',
          inventoryLotId: lot.id,
          medicineId: lot.medicineId || lot.medicine_id,
          batchNo: lot.batchNo,
          dedupKey: `${lotHospId}_LOW_STOCK_${lot.id}`,
        });
        if (alert) { generated.push(alert); newCount++; }
      }
    }

    return {
      scannedLotsCount: lots.length,
      newAlertsCreatedCount: newCount,
      details: generated,
      alerts: generated,
    };
  },

  /**
   * Event Alert Helper: Requests
   */
  async createRequestAlert(arg1) {
    let hospitalId = arg1?.hospitalId;
    let requestId = arg1?.requestId;
    let status = arg1?.status || arg1?.type || arg1?.eventType || 'REQUEST_UPDATED';
    let medicineName = arg1?.medicineName || 'Medicine';
    let reason = arg1?.reason;
    let actor = arg1?.actor || 'Peer Hospital';

    if (arg1?.request) {
      const req = arg1.request;
      status = arg1.type || arg1.eventType || req.status;
      requestId = req.id || req.requestId;
      medicineName = req.medicineName || medicineName;
      const isBuyer = status === 'REQUEST_ACCEPTED' || status === 'REQUEST_REJECTED';
      hospitalId = isBuyer
        ? (req.fromHospitalId || req.from_hospital_id)
        : (req.toHospitalId || req.to_hospital_id);
    }

    let type = (status || 'REQUEST_UPDATED').toUpperCase();
    if (type === 'CANCELLED') type = 'REQUEST_CANCELLED';
    if (type === 'ACCEPTED') type = 'REQUEST_ACCEPTED';
    if (type === 'REJECTED') type = 'REQUEST_REJECTED';
    const isCancelled = type.includes('CANCEL');
    const isRejected = type.includes('REJECT');

    const isIncoming = type === 'PENDING_REQUEST' || type === 'REQUEST_CREATED' || type === 'NEW_REQUEST';
    const computedLink = isIncoming
      ? `/hospital/incoming-requests?requestId=${encodeURIComponent(requestId || '')}`
      : `/hospital/my-requests?requestId=${encodeURIComponent(requestId || '')}`;

    return this.createAlert({
      hospitalId,
      groupType: isCancelled || isRejected ? 'action' : 'info',
      severity: isCancelled || isRejected ? 'WARNING' : 'INFO',
      category: 'REQUESTS',
      alertType: type,
      title: `Requisition ${type === 'CANCELLED' ? 'Cancelled' : status}: ${medicineName}`,
      message: reason || `${actor} updated requisition #${requestId} for ${medicineName}.`,
      link: computedLink,
      actionText: isIncoming ? 'Review Requisition' : 'View Requisition',
      urgent: Boolean(arg1?.request?.urgency === 'Emergency'),
      targetType: 'request',
      requestId,
      medicineId: arg1?.medicineId || arg1?.request?.medicineId,
      metadata: {
        medicineName,
        reason,
        status,
      },
    });
  },

  /**
   * Event Alert Helper: Payments & Refunds
   */
  async createPaymentAlert(arg1) {
    let hospitalId = arg1?.hospitalId;
    let paymentId = arg1?.paymentId;
    let requestId = arg1?.requestId;
    let status = (arg1?.status || arg1?.type || arg1?.eventType || 'PAID').toUpperCase();
    let amount = arg1?.amount;
    let reason = arg1?.reason;

    if (arg1?.payment) {
      const p = arg1.payment;
      paymentId = p.id;
      requestId = p.requestId || p.request_id;
      amount = p.amount;
      hospitalId = p.sellerHospitalId || p.seller_hospital_id || p.buyerHospitalId || p.buyer_hospital_id;
      status = (arg1.type || arg1.eventType || p.status || 'PAID').toUpperCase();
    }

    const isPaid = status === 'PAID' || status === 'PAYMENT_SUCCESS';
    const isFailed = status.includes('FAIL');
    const alertType = isPaid ? 'PAYMENT_RECEIVED' : isFailed ? 'PAYMENT_FAILED' : status;

    const computedLink = `/hospital/payment-history?paymentId=${encodeURIComponent(paymentId || '')}&requestId=${encodeURIComponent(requestId || '')}`;

    return this.createAlert({
      hospitalId,
      groupType: isFailed ? 'critical' : 'info',
      severity: isFailed ? 'CRITICAL' : 'INFO',
      category: 'FINANCE',
      alertType,
      title: isPaid ? `Payment Received: ₹${amount || 0}` : `Payment Alert: ${status}`,
      message: reason || `Payment ${paymentId || ''} of ₹${amount || 0} for requisition ${requestId || ''} is ${status}.`,
      link: computedLink,
      actionText: 'View Payment',
      targetType: 'payment',
      paymentId,
      requestId,
      metadata: {
        amount,
        paymentId,
        requestId,
        status,
      },
    });
  },

  /**
   * Event Alert Helper: Logistics & Transfers
   */
  async createTransferAlert(arg1) {
    let hospitalId = arg1?.hospitalId;
    let transferId = arg1?.transferId;
    let transactionId = arg1?.transactionId;
    let status = (arg1?.status || arg1?.type || arg1?.eventType || 'TRANSFER_IN_TRANSIT').toUpperCase();
    let medicineName = arg1?.medicineName || 'Consignment';
    let issue = arg1?.issue;
    let temperature = arg1?.temperature;

    if (arg1?.transfer) {
      const t = arg1.transfer;
      transferId = t.id || t.transferId || t.transactionId;
      transactionId = t.transactionId || t.transaction_id || t.id;
      medicineName = t.medicineName || medicineName;
      hospitalId = t.destinationHospitalId || t.destination_hospital_id || t.hospitalId;
      status = (arg1.type || arg1.eventType || t.status || status).toUpperCase();
    }

    const isFailed = status.includes('FAIL') || status.includes('BREACH');
    const alertType = isFailed ? 'FAILED_TRANSFER' : status;

    const computedTrackLink = `/hospital/track?transferId=${encodeURIComponent(transferId || '')}${transactionId ? `&txn=${encodeURIComponent(transactionId)}` : ''}`;

    return this.createAlert({
      hospitalId,
      groupType: isFailed ? 'critical' : 'info',
      severity: isFailed ? 'CRITICAL' : 'INFO',
      category: 'TRANSFERS',
      alertType,
      title: isFailed
        ? `Transfer Alert: ${medicineName}`
        : `Transfer Update: ${medicineName}`,
      message: issue || `Transfer ${transferId || transactionId} status is ${status}.${temperature ? ` Logged temperature: ${temperature}°C.` : ''}`,
      link: computedTrackLink,
      actionText: 'Track Consignment',
      targetType: 'transfer',
      transferId: transferId || transactionId,
      metadata: {
        medicineName,
        temperature,
        issue,
        status,
      },
    });
  },

  /**
   * Event Alert Helper: Hospital Registration
   */
  async createHospitalAlert(arg1) {
    let hospitalId = arg1?.hospitalId || arg1?.hospital?.id;
    let status = (arg1?.status || arg1?.type || 'VERIFIED').toUpperCase();
    let hospitalName = arg1?.hospitalName || arg1?.hospital?.name || 'Hospital Facility';
    let reason = arg1?.reason;

    const isVerified = status === 'VERIFIED' || status === 'REGISTRATION_APPROVED';
    const alertType = isVerified ? 'HOSPITAL_VERIFIED' : `HOSPITAL_${status}`;

    return this.createAlert({
      hospitalId,
      groupType: isVerified ? 'info' : 'action',
      severity: isVerified ? 'INFO' : 'WARNING',
      category: 'HOSPITAL',
      alertType,
      title: isVerified ? 'Hospital Accreditation Approved!' : 'Hospital Registration Notice',
      message: isVerified
        ? `Congratulations! ${hospitalName} has been verified by MedEx regulatory administration.`
        : `Registration status update for ${hospitalName}.${reason ? ` Reason: ${reason}` : ''}`,
      link: '/hospital/dashboard',
      actionText: 'View Status',
      targetType: 'verification',
      metadata: {
        hospitalId,
        hospitalName,
        status,
      },
    });
  },

  /**
   * Retrieves alerts for the authenticated hospital or admin
   */
  async getAlerts({ hospitalId = null, recipientUserId = null, isAdmin = false, isRead = null, alertType = null, type = null, severity = null, page = 1, limit = 50, offset = 0 }) {
    const limitNum = Math.max(1, Number(limit) || 50);
    const parsedOffset = Math.max(0, Number(offset) || (Math.max(1, Number(page)) - 1) * limitNum);
    const filterType = alertType || type;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('alerts').select('*', { count: 'exact' });

        if (!isAdmin && hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        } else if (isAdmin && hospitalId && hospitalId !== 'admin') {
          query = query.eq('hospital_id', hospitalId);
        }

        if (isRead !== null && isRead !== undefined && isRead !== 'all') {
          query = query.eq('is_read', isRead === true || isRead === 'true');
        }

        if (filterType && filterType !== 'all') {
          query = query.eq('alert_type', filterType);
        }

        if (severity && severity !== 'all') {
          query = query.eq('severity', severity.toUpperCase());
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(parsedOffset, parsedOffset + limitNum - 1);

        if (!error && data && data.length > 0) {
          const unreadRes = await this.getUnreadCount({ hospitalId, isAdmin });
          return {
            items: data,
            alerts: data,
            total: count !== null ? count : data.length,
            page: Number(page),
            limit: limitNum,
            offset: parsedOffset,
            unreadCount: unreadRes.unreadCount,
          };
        }
      } catch (err) {
        logger.warn('Supabase getAlerts failed, using in-memory store:', err.message);
      }
    }

    let filtered = [...fallbackAlerts];

    if (!isAdmin && hospitalId) {
      filtered = filtered.filter((a) => a.hospitalId === hospitalId || a.hospital_id === hospitalId);
    } else if (isAdmin && hospitalId && hospitalId !== 'admin') {
      filtered = filtered.filter((a) => a.hospitalId === hospitalId || a.hospital_id === hospitalId);
    }

    if (isRead !== null && isRead !== undefined && isRead !== 'all') {
      const targetRead = isRead === true || isRead === 'true';
      filtered = filtered.filter((a) => Boolean(a.is_read || a.isRead || a.read) === targetRead);
    }

    if (filterType && filterType !== 'all') {
      filtered = filtered.filter((a) => (a.alertType || a.alert_type || a.type) === filterType);
    }

    if (severity && severity !== 'all') {
      filtered = filtered.filter((a) => (a.severity || '').toUpperCase() === severity.toUpperCase());
    }

    const unreadCount = filtered.filter((a) => !a.is_read && !a.isRead && !a.read && !a.is_dismissed && !a.isDismissed).length;
    const paginated = filtered.slice(parsedOffset, parsedOffset + limitNum);

    return {
      items: paginated,
      alerts: paginated,
      total: filtered.length,
      page: Number(page),
      limit: limitNum,
      offset: parsedOffset,
      unreadCount,
    };
  },

  /**
   * Returns exact count of unread alerts efficiently
   */
  async getUnreadCount({ hospitalId = null, recipientUserId = null, isAdmin = false } = {}) {
    let count = 0;
    let queriedDb = false;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('alerts').select('id', { count: 'exact', head: true }).eq('is_read', false);

        if (!isAdmin && hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        } else if (isAdmin && hospitalId && hospitalId !== 'admin') {
          query = query.eq('hospital_id', hospitalId);
        }

        const { count: dbCount, error } = await query;
        if (!error && dbCount !== null) {
          count = dbCount;
          queriedDb = true;
        }
      } catch {
        // Fall through
      }
    }

    if (!queriedDb || count === 0) {
      let filtered = fallbackAlerts.filter((a) => !a.is_read && !a.isRead && !a.read && !a.is_dismissed && !a.isDismissed);
      if (!isAdmin && hospitalId) {
        filtered = filtered.filter((a) => a.hospitalId === hospitalId || a.hospital_id === hospitalId);
      }
      count = filtered.length;
    }

    return { unreadCount: count };
  },

  /**
   * Marks a specific alert as read
   */
  async markAlertRead(id, { hospitalId = null, isAdmin = false } = {}) {
    const nowIso = new Date().toISOString();

    const alert = await this.findAlertById(id);
    if (!alert) {
      const err = new Error('Alert not found');
      err.statusCode = 404;
      throw err;
    }

    const targetHosp = alert.hospital_id || alert.hospitalId;
    if (!isAdmin && hospitalId && targetHosp && targetHosp !== hospitalId) {
      const err = new Error("Access denied: You cannot mark another hospital's alert as read.");
      err.statusCode = 403;
      throw err;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        let query = supabaseAdmin.from('alerts').update({ is_read: true, read_at: nowIso }).eq('id', id);
        if (!isAdmin && hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }
        await query;
      } catch (err) {
        logger.warn('Supabase markAlertRead failed:', err.message);
      }
    }

    alert.is_read = true;
    alert.isRead = true;
    alert.read = true;
    alert.read_at = nowIso;
    alert.readAt = nowIso;

    this.broadcastEvent('ALERT_READ', { id, is_read: true }, hospitalId);
    return { id, is_read: true, isRead: true, read_at: nowIso, readAt: nowIso };
  },

  /**
   * Marks all alerts as read for a hospital or admin
   */
  async markAllAlertsRead({ hospitalId = null, isAdmin = false } = {}) {
    const nowIso = new Date().toISOString();

    if (isConfigured && supabaseAdmin) {
      try {
        let query = supabaseAdmin.from('alerts').update({ is_read: true, read_at: nowIso }).eq('is_read', false);
        if (!isAdmin && hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }
        await query;
      } catch (err) {
        logger.warn('Supabase markAllAlertsRead failed:', err.message);
      }
    }

    let updatedCount = 0;
    fallbackAlerts.forEach((a) => {
      let matches = false;
      if (isAdmin) matches = true;
      else if (hospitalId && (a.hospitalId === hospitalId || a.hospital_id === hospitalId)) matches = true;

      if (matches && !a.is_read && !a.isRead && !a.read) {
        a.is_read = true;
        a.isRead = true;
        a.read = true;
        a.read_at = nowIso;
        a.readAt = nowIso;
        updatedCount++;
      }
    });

    this.broadcastEvent('ALERTS_ALL_READ', { hospitalId, read_at: nowIso }, hospitalId);
    return { success: true, updatedCount, readAt: nowIso };
  },

  async dismissAlert(id, { hospitalId = null, isAdmin = false } = {}) {
    const alert = await this.findAlertById(id);
    if (!alert) {
      const err = new Error('Alert not found');
      err.statusCode = 404;
      throw err;
    }

    const targetHosp = alert.hospital_id || alert.hospitalId;
    if (!isAdmin && hospitalId && targetHosp && targetHosp !== hospitalId) {
      const err = new Error("Access denied: You cannot dismiss another hospital's alert.");
      err.statusCode = 403;
      throw err;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        let query = supabaseAdmin.from('alerts').update({ is_dismissed: true }).eq('id', id);
        if (!isAdmin && hospitalId) {
          query = query.eq('hospital_id', hospitalId);
        }
        await query;
      } catch {
        // Fall through
      }
    }

    alert.is_dismissed = true;
    alert.isDismissed = true;
    alert.dismissed = true;

    this.broadcastEvent('ALERT_DISMISSED', { id }, targetHosp);
    return { id, isDismissed: true, is_dismissed: true };
  },

  markAlertAsRead(id, opts) {
    return this.markAlertRead(id, opts);
  },

  markAllAlertsAsRead(opts) {
    return this.markAllAlertsRead(opts);
  },

  getHospitalAlerts(hospitalId) {
    return this.getAlerts({ hospitalId, isAdmin: false });
  },

  getDevAlerts() {
    return fallbackAlerts;
  },
};

module.exports = alertService;
