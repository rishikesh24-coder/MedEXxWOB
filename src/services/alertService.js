import { getStoredItem, setStoredItem, KEYS } from './storage.js';
import { calculateMedicineExpiry } from '../utils/expiryUtils.js';

import { API_BASE_URL } from '../config/api.js';

// Internal memory cache for alerts
let cachedHospitalAlerts = [];
let cachedAdminAlerts = [];
let activeSseConnection = null;

const getAuthHeaders = () => {
  const session = getStoredItem(KEYS.AUTH, null);
  const token = session?.token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Normalizes a backend alert record to the structure expected by frontend components
 */
const normalizeBackendAlert = (raw, defaultRole = 'hospital') => {
  const severity = (raw.severity || 'INFO').toUpperCase();
  const alertType = raw.alert_type || raw.category || 'GENERAL';
  const isRead = Boolean(raw.is_read || raw.read);
  const isDismissed = Boolean(raw.is_dismissed || raw.dismissed);

  let group = 'info';
  if (severity === 'CRITICAL') group = 'critical';
  else if (severity === 'WARNING' || severity === 'ACTION') group = 'action';

  // Construct stable deep link if not explicitly provided or if pointing to legacy /hospital/requests
  let link = raw.link;
  if (!link || link === '/hospital/requests' || link.startsWith('/hospital/requests?')) {
    if (raw.inventory_lot_id || raw.inventoryLotId) {
      const lotId = raw.inventory_lot_id || raw.inventoryLotId;
      const bNo = raw.batch_no || raw.batchNo || raw.metadata?.batchNo || '';
      link = defaultRole === 'admin'
        ? `/admin/inventory?inventoryLotId=${encodeURIComponent(lotId)}`
        : `/hospital/inventory?inventoryLotId=${encodeURIComponent(lotId)}${bNo ? `&batchNo=${encodeURIComponent(bNo)}` : ''}`;
    } else if (raw.request_id || raw.requestId) {
      const reqId = raw.request_id || raw.requestId;
      const isIncoming = alertType === 'PENDING_REQUEST' || alertType === 'REQUEST_CREATED' || raw.target_type === 'incoming_request';
      link = isIncoming
        ? `/hospital/incoming-requests?requestId=${encodeURIComponent(reqId)}`
        : `/hospital/my-requests?requestId=${encodeURIComponent(reqId)}`;
    } else if (raw.payment_id || raw.paymentId) {
      const pId = raw.payment_id || raw.paymentId;
      const rId = raw.request_id || raw.requestId;
      link = `/hospital/payment-history?paymentId=${encodeURIComponent(pId)}${rId ? `&requestId=${encodeURIComponent(rId)}` : ''}`;
    } else if (raw.transfer_id || raw.transferId) {
      link = `/hospital/track?txn=${encodeURIComponent(raw.transfer_id || raw.transferId)}`;
    } else {
      link = defaultRole === 'admin' ? '/admin/alerts' : '/hospital/alerts';
    }
  }

  return {
    id: String(raw.id),
    group,
    severity,
    category: alertType,
    title: raw.title || 'System Alert',
    desc: raw.message || raw.description || '',
    message: raw.message || raw.description || '',
    link,
    actionText: raw.action_text || (raw.inventory_lot_id ? 'Inspect Lot' : 'View Details'),
    timestamp: raw.created_at || raw.timestamp || new Date().toISOString(),
    urgent: severity === 'CRITICAL',
    sourceId: raw.related_entity_id || raw.inventory_lot_id || raw.id,
    targetType: raw.related_entity_type || (raw.inventory_lot_id ? 'inventory' : 'system'),
    inventoryLotId: raw.inventory_lot_id || raw.inventoryLotId || null,
    inventoryId: raw.inventory_lot_id || raw.inventoryLotId || null,
    hospitalId: raw.hospital_id || null,
    medicineName: raw.metadata?.medicineName || '',
    batchNo: raw.metadata?.batchNo || '',
    read: isRead,
    dismissed: isDismissed,
    metadata: raw.metadata || {},
  };
};

export const alertService = {
  /**
   * Retrieves active alerts for a hospital.
   * Authoritative: First attempts GET /api/alerts from backend.
   * Fallback: Runs local client-side evaluation if backend is offline.
   * @param {string} hospitalId 
   * @returns {Promise<Array>|Array} List of active, non-dismissed alerts
   */
  async getHospitalAlerts(hospitalId) {
    if (!hospitalId) return cachedHospitalAlerts;

    // 1. Try Authoritative Backend API
    try {
      const res = await fetch(`${API_BASE_URL}/alerts?hospitalId=${encodeURIComponent(hospitalId)}&limit=100`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json?.data) ? json.data : (json?.data?.items || []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const mapped = rawList.map((item) => normalizeBackendAlert(item, 'hospital'));
          cachedHospitalAlerts = mapped.filter((a) => !a.dismissed);
          return cachedHospitalAlerts;
        }
      }
    } catch (err) {
      // Backend unavailable, seamless fallback to deterministic local store
    }

    // 2. Client-Side Fallback Generator
    const generated = this.generateLocalHospitalAlerts(hospitalId);
    cachedHospitalAlerts = generated;
    return generated;
  },

  /**
   * Generates local hospital alerts from storage (Offline / Dev Fallback)
   */
  generateLocalHospitalAlerts(hospitalId) {
    if (!hospitalId) return [];

    const storedAlertMeta = getStoredItem(KEYS.ALERTS, {});
    const rawMedicines = getStoredItem(KEYS.MEDICINES, []);
    const medicines = rawMedicines.filter((m) => m.hospitalId === hospitalId || !m.hospitalId);
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const incomingRequests = requests.filter((r) => r.toHospitalId === hospitalId || !r.toHospitalId);
    const outgoingRequests = requests.filter((r) => r.fromHospitalId === hospitalId);
    const trackingList = getStoredItem(KEYS.TRACKING, []).filter(
      (t) => t.senderHospitalId === hospitalId || t.receiverHospitalId === hospitalId || t.senderHospital?.includes(hospitalId) || t.receiverHospital?.includes(hospitalId)
    );

    const generatedAlerts = [];
    const now = new Date();

    // 1. Critical & Warning: Expired, Near-Expiry, Low Stock
    medicines.forEach((med) => {
      const expDate = med.expiryDate;
      const mfgDate = med.mfgDate;
      const qty = med.quantity ?? med.usableStock ?? 0;
      const medName = med.brandName || med.medicineName || med.name || 'Medicine Lot';
      const exp = calculateMedicineExpiry(expDate, mfgDate, qty);

      if (exp.isExpired) {
        generatedAlerts.push({
          id: `alert-exp-${med.id}`,
          group: 'critical',
          severity: 'CRITICAL',
          category: 'EXPIRED_STOCK',
          title: `Expired Stock Alert: ${medName}`,
          desc: `Batch ${med.batchNo || med.batch || 'N/A'} (${qty} units) has passed its statutory expiry date. Immediate quarantine required.`,
          link: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(med.batchNo || med.batch || '')}`,
          actionText: 'Inspect Inventory',
          timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
          urgent: true,
          sourceId: med.id,
          targetType: 'inventory',
          inventoryLotId: med.id,
          inventoryId: med.id,
          hospitalId: hospitalId,
          batchNo: med.batchNo || med.batch || '',
          medicineName: medName,
        });
      } else if (exp.isNearExpiry) {
        generatedAlerts.push({
          id: `alert-near-${med.id}`,
          group: 'action',
          severity: 'WARNING',
          category: 'EXPIRING_SOON',
          title: `Expiring Soon: ${medName}`,
          desc: `${qty} units expire in ${exp.daysRemaining} days. Shelf-life concession active to prioritize redistribution to partner hospitals.`,
          link: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(med.batchNo || med.batch || '')}`,
          actionText: 'View in Inventory',
          timestamp: new Date(now.getTime() - 95 * 60000).toISOString(),
          urgent: exp.daysRemaining <= 30,
          sourceId: med.id,
          targetType: 'inventory',
          inventoryLotId: med.id,
          inventoryId: med.id,
          hospitalId: hospitalId,
          batchNo: med.batchNo || med.batch || '',
          medicineName: medName,
        });
      }

      if (exp.isLowStock && !exp.isExpired) {
        generatedAlerts.push({
          id: `alert-low-${med.id}`,
          group: 'action',
          severity: 'ACTION',
          category: 'LOW_STOCK',
          title: `Low Stock Warning: ${medName}`,
          desc: `Current reserve is ${qty} units (below safety threshold). Replenish from peer hospitals.`,
          link: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(med.batchNo || med.batch || '')}`,
          actionText: 'Inspect Stock',
          timestamp: new Date(now.getTime() - 140 * 60000).toISOString(),
          urgent: false,
          sourceId: med.id,
          targetType: 'inventory',
          inventoryLotId: med.id,
          inventoryId: med.id,
          hospitalId: hospitalId,
          batchNo: med.batchNo || med.batch || '',
          medicineName: medName,
        });
      }
    });

    // 2. Incoming Requests
    incomingRequests.forEach((req) => {
      if (req.status === 'pending') {
        const reqName = req.medicineName || 'Medicine';
        const fromHosp = req.fromHospitalName || req.requesterHospital || 'Peer Hospital';
        generatedAlerts.push({
          id: `alert-req-pending-${req.id}`,
          group: 'action',
          severity: 'ACTION',
          category: 'PENDING_REQUEST',
          title: `Requisition Awaiting Approval: ${reqName}`,
          desc: `${fromHosp} requested ${req.quantity} units. Review clinical availability and approve or reject.`,
          link: `/hospital/incoming-requests?requestId=${encodeURIComponent(req.id)}`,
          actionText: 'Review Requisition',
          timestamp: req.requestDate || new Date(now.getTime() - 40 * 60000).toISOString(),
          urgent: true,
          sourceId: req.id,
        });
      }
    });

    // 3. Outgoing Requests
    outgoingRequests.forEach((req) => {
      const reqName = req.medicineName || 'Medicine';
      const toHosp = req.toHospitalName || 'Supplier Hospital';

      if (req.status === 'accepted') {
        generatedAlerts.push({
          id: `alert-req-acc-${req.id}`,
          group: 'info',
          severity: 'INFORMATION',
          category: 'REQUEST_ACCEPTED',
          title: `Requisition Approved: ${reqName}`,
          desc: `${toHosp} approved transfer request for ${req.quantity} units. Dispatch packaging underway.`,
          link: `/hospital/my-requests?requestId=${encodeURIComponent(req.id)}`,
          actionText: 'Track Request',
          timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
          urgent: false,
          sourceId: req.id,
        });
      } else if (req.status === 'rejected' || req.status === 'cancelled') {
        generatedAlerts.push({
          id: `alert-req-rej-${req.id}`,
          group: 'info',
          severity: 'INFORMATION',
          category: req.status === 'cancelled' ? 'REQUEST_CANCELLED' : 'REQUEST_REJECTED',
          title: `Requisition ${req.status === 'cancelled' ? 'Cancelled' : 'Declined'}: ${reqName}`,
          desc: req.cancellationReason || req.rejectReason || `Requisition #${req.transactionId || req.id} was terminated.`,
          link: `/hospital/my-requests?requestId=${encodeURIComponent(req.id)}`,
          actionText: 'Inspect Requisition',
          timestamp: new Date(now.getTime() - 180 * 60000).toISOString(),
          urgent: false,
          sourceId: req.id,
        });
      }
    });

    // 4. Logistics & Transfers
    trackingList.forEach((trk) => {
      const status = (trk.status || '').toLowerCase();
      const med = trk.medicineName || 'Consignment';
      const txnId = trk.transactionId || trk.id;

      if (status.includes('fail') || status.includes('breach') || status.includes('quarantine')) {
        generatedAlerts.push({
          id: `alert-trk-fail-${txnId}`,
          group: 'critical',
          severity: 'CRITICAL',
          category: 'FAILED_TRANSFER',
          title: `Cold-Chain Anomaly / Failed Transfer: ${med}`,
          desc: `Sensor alert for Transfer ${txnId}: Temperature breach flagged. Quarantine protocol initiated.`,
          link: `/hospital/track?txn=${txnId}`,
          actionText: 'Inspect Telemetry',
          timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
          urgent: true,
          sourceId: txnId,
        });
      }
    });

    const severityWeight = { CRITICAL: 3, WARNING: 2, ACTION: 2, INFORMATION: 1 };

    return generatedAlerts
      .map((alert) => {
        const meta = storedAlertMeta[alert.id] || {};
        return {
          ...alert,
          read: meta.read || false,
          dismissed: meta.dismissed || false,
        };
      })
      .filter((alert) => !alert.dismissed)
      .sort((a, b) => {
        const weightDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        if (weightDiff !== 0) return weightDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
  },

  /**
   * Retrieves administrative alerts from backend or local fallback
   */
  async getAdminAlerts() {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts?limit=100`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json?.data) ? json.data : (json?.data?.items || []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const mapped = rawList.map((item) => normalizeBackendAlert(item, 'admin'));
          cachedAdminAlerts = mapped.filter((a) => !a.dismissed);
          return cachedAdminAlerts;
        }
      }
    } catch (err) {
      // Backend unavailable, fallback
    }

    const generated = this.generateLocalAdminAlerts();
    cachedAdminAlerts = generated;
    return generated;
  },

  /**
   * Generates admin alerts locally (Offline Fallback)
   */
  generateLocalAdminAlerts() {
    const storedAlertMeta = getStoredItem(KEYS.ALERTS, {});
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const requests = getStoredItem(KEYS.REQUESTS, []);

    const alerts = [];

    medicines.forEach((med) => {
      const exp = calculateMedicineExpiry(med.expiryDate, med.mfgDate, med.quantity, med.minStockLevel || 20);
      const batchNo = med.batchNo || med.batchNumber || '';
      const medName = med.brandName || med.medicineName || 'Pharmaceutical Lot';
      const hospId = med.hospitalId || '';

      if (exp.isExpired) {
        alerts.push({
          id: `admin-crit-exp-${med.id}`,
          category: 'CRITICAL',
          type: 'error',
          severity: 'CRITICAL',
          title: `Expired Medicine Batch: ${medName}`,
          description: `Batch ${batchNo || 'N/A'} at ${med.hospitalName || 'Health Facility'} expired on ${med.expiryDate}.`,
          relatedItem: `${medName} (${med.hospitalName || 'Facility'})`,
          timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
          targetType: 'inventory',
          inventoryLotId: med.id,
          inventoryId: med.id,
          hospitalId: hospId,
          batchNo: batchNo,
          medicineName: medName,
          link: `/admin/inventory?inventoryLotId=${encodeURIComponent(med.id)}`,
          actionText: 'Inspect',
        });
      } else if (Number(med.quantity || 0) === 0) {
        alerts.push({
          id: `admin-crit-oos-${med.id}`,
          category: 'CRITICAL',
          type: 'error',
          severity: 'CRITICAL',
          title: `Medicine Out of Stock: ${medName}`,
          description: `Zero available units recorded at ${med.hospitalName || 'Health Facility'}.`,
          relatedItem: `${medName} (${med.hospitalName || 'Facility'})`,
          timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
          targetType: 'inventory',
          inventoryLotId: med.id,
          inventoryId: med.id,
          hospitalId: hospId,
          batchNo: batchNo,
          medicineName: medName,
          link: `/admin/inventory?inventoryLotId=${encodeURIComponent(med.id)}`,
          actionText: 'Inspect',
        });
      }
    });

    hospitals.forEach((hosp) => {
      if (hosp.status === 'pending' || hosp.status === 'under_review') {
        alerts.push({
          id: `admin-info-hosp-${hosp.id}`,
          category: 'INFORMATION',
          type: 'info',
          severity: 'INFO',
          title: `Verification Request: ${hosp.name}`,
          description: `New hospital applicant registered from ${hosp.city}. Statutory documents awaiting review.`,
          relatedItem: hosp.name,
          timestamp: hosp.registeredDate || new Date().toISOString(),
          targetType: 'hospital',
          hospitalId: hosp.id,
          link: `/admin/verification?hospitalId=${encodeURIComponent(hosp.id)}`,
          actionText: 'Inspect Dossier',
        });
      }
    });

    requests.forEach((req) => {
      if (req.status === 'pending') {
        alerts.push({
          id: `admin-info-req-${req.id}`,
          category: 'INFORMATION',
          type: 'info',
          severity: 'INFO',
          title: `New Inter-Hospital Requisition: ${req.medicineName}`,
          description: `Order from ${req.fromHospitalName} to ${req.toHospitalName} for ${req.quantity} units is awaiting processing.`,
          relatedItem: req.id,
          timestamp: req.requestDate || new Date().toISOString(),
          targetType: 'order',
          orderId: req.id,
          link: `/admin/orders?orderId=${encodeURIComponent(req.id)}`,
          actionText: 'Inspect Order',
        });
      }
    });

    return alerts
      .map((alert) => {
        const meta = storedAlertMeta[alert.id] || {};
        return {
          ...alert,
          read: meta.read || false,
          dismissed: meta.dismissed || false,
        };
      })
      .filter((alert) => !alert.dismissed);
  },

  /**
   * Marks an alert as read both locally and in backend
   */
  async markAsRead(alertId) {
    const meta = getStoredItem(KEYS.ALERTS, {});
    meta[alertId] = { ...(meta[alertId] || {}), read: true };
    setStoredItem(KEYS.ALERTS, meta);

    const match = cachedHospitalAlerts.find((a) => a.id === alertId);
    if (match) match.read = true;

    try {
      await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
    } catch (e) {
      // Offline fallback
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medex-alert-event', { detail: { action: 'read', alertId } }));
    }
  },

  /**
   * Dismisses an active alert
   */
  async dismissAlert(alertId) {
    const meta = getStoredItem(KEYS.ALERTS, {});
    meta[alertId] = { ...(meta[alertId] || {}), dismissed: true };
    setStoredItem(KEYS.ALERTS, meta);

    cachedHospitalAlerts = cachedHospitalAlerts.filter((a) => a.id !== alertId);
    cachedAdminAlerts = cachedAdminAlerts.filter((a) => a.id !== alertId);

    try {
      await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}/dismiss`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
    } catch (e) {
      // Offline fallback
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medex-alert-event', { detail: { action: 'dismiss', alertId } }));
    }
  },

  /**
   * Marks all alerts as read
   */
  async markAllAsRead(target) {
    const meta = getStoredItem(KEYS.ALERTS, {});
    if (Array.isArray(target)) {
      target.forEach((alert) => {
        meta[alert.id] = { ...(meta[alert.id] || {}), read: true };
      });
    } else if (typeof target === 'string') {
      const alerts = cachedHospitalAlerts.length > 0 ? cachedHospitalAlerts : this.generateLocalHospitalAlerts(target);
      alerts.forEach((alert) => {
        meta[alert.id] = { ...(meta[alert.id] || {}), read: true };
      });
    }
    setStoredItem(KEYS.ALERTS, meta);

    cachedHospitalAlerts.forEach((a) => { a.read = true; });

    try {
      await fetch(`${API_BASE_URL}/alerts/read-all`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(typeof target === 'string' ? { hospitalId: target } : {}),
      });
    } catch (e) {
      // Offline fallback
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('medex-alert-event', { detail: { action: 'read_all' } }));
    }
  },

  /**
   * Clears all alerts for a hospital
   */
  clearAllAlerts(hospitalId) {
    const alerts = this.generateLocalHospitalAlerts(hospitalId);
    const meta = getStoredItem(KEYS.ALERTS, {});
    alerts.forEach((alert) => {
      meta[alert.id] = { ...(meta[alert.id] || {}), dismissed: true };
    });
    setStoredItem(KEYS.ALERTS, meta);
    cachedHospitalAlerts = [];
  },

  markAdminAlertAsRead(alertId) {
    return this.markAsRead(alertId);
  },

  markAllAdminAlertsAsRead() {
    const meta = getStoredItem(KEYS.ALERTS, {});
    cachedAdminAlerts.forEach((a) => {
      meta[a.id] = { ...(meta[a.id] || {}), read: true };
      a.read = true;
    });
    setStoredItem(KEYS.ALERTS, meta);

    fetch(`${API_BASE_URL}/alerts/read-all`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    }).catch(() => {});
  },

  dismissAdminAlert(alertId) {
    return this.dismissAlert(alertId);
  },

  getAdminUnreadCount() {
    if (cachedAdminAlerts.length > 0) {
      return cachedAdminAlerts.filter((a) => !a.read).length;
    }
    const alerts = this.generateLocalAdminAlerts();
    return alerts.filter((a) => !a.read).length;
  },

  getHospitalUnreadCount(hospitalId) {
    if (cachedHospitalAlerts.length > 0) {
      return cachedHospitalAlerts.filter((a) => !a.read).length;
    }
    const alerts = this.generateLocalHospitalAlerts(hospitalId);
    return alerts.filter((a) => !a.read).length;
  },

  /**
   * Triggers a server-side inventory alert scan
   */
  async triggerInventoryScan(hospitalId = null) {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/scan`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ hospitalId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback
    }
    return null;
  },

  /**
   * Subscribes to real-time alerts via Server-Sent Events (SSE)
   * @param {function} onAlert - Callback invoked when a new live alert arrives
   * @returns {function} Unsubscribe cleanup function
   */
  subscribeToAlerts(onAlert) {
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    if (!token || typeof EventSource === 'undefined') {
      return () => {};
    }

    try {
      // If active connection already exists, reuse or close
      if (activeSseConnection) {
        activeSseConnection.close();
      }

      // EventSource with query token for browser compatibility
      const sseUrl = `${API_BASE_URL}/alerts/stream?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(sseUrl);
      activeSseConnection = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type !== 'CONNECTED' && data.id) {
            const normalized = normalizeBackendAlert(data);
            cachedHospitalAlerts.unshift(normalized);
            cachedAdminAlerts.unshift(normalized);

            if (typeof onAlert === 'function') {
              onAlert(normalized);
            }

            // Dispatch custom DOM event for other components to react
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('medex-alert-event', { detail: normalized }));
            }
          }
        } catch (e) {
          // Ignore heartbeats and comments
        }
      };

      eventSource.onerror = () => {
        // SSE auto-reconnects by default in modern browsers
      };

      return () => {
        eventSource.close();
        if (activeSseConnection === eventSource) {
          activeSseConnection = null;
        }
      };
    } catch (e) {
      return () => {};
    }
  },
};

export default alertService;
