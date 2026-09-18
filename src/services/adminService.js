import { getStoredItem, setStoredItem, KEYS } from './storage.js';
import { ADMIN_ANALYTICS } from './mockData.js';
import { auditService } from './auditService.js';
import { calculateMedicineExpiry } from '../utils/expiryUtils.js';
import { getExpiryPricing, isExpiryAcceptable } from '../config/nearExpiryPolicy.js';

const assertAdminSession = () => {
  const session = getStoredItem(KEYS.AUTH, null);
  if (session?.user?.role !== 'admin') throw new Error('Admin authorization is required for this action');
};

import { API_BASE } from '../config/api.js';

const getAuthHeaders = () => {
  const session = getStoredItem(KEYS.AUTH, null);
  const token = session?.token || 'mock_jwt_token_admin';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

export const adminService = {
  // ==========================================
  // 1. DASHBOARD & SUPERVISORY ANALYTICS
  // ==========================================
  async getDashboard() {
    try {
      const response = await fetch(`${API_BASE}/admin/reports?range=30d`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        const rep = body?.data;
        if (rep) {
          return {
            stats: {
              totalHospitals: rep.hospitals?.total || 0,
              verifiedHospitals: rep.hospitals?.verified || 0,
              pendingVerification: rep.hospitals?.newRegistrations || 0,
              totalMedicines: rep.medicines?.total || 0,
              lowStock: rep.medicines?.lowStock || 0,
              expiringSoon: rep.medicines?.expiringSoon || 0,
              pendingOrders: rep.orders?.daily || 0,
              totalOrders: rep.orders?.total || 0,
            },
            medicineStockOverview: [
              { name: 'In Stock', value: Math.max(0, (rep.medicines?.total || 0) - (rep.medicines?.lowStock || 0) - (rep.medicines?.outOfStock || 0) - (rep.medicines?.expired || 0)), color: '#0A6E79' },
              { name: 'Low Stock', value: rep.medicines?.lowStock || 0, color: '#F59E0B' },
              { name: 'Out of Stock', value: rep.medicines?.outOfStock || 0, color: '#EF4444' },
              { name: 'Expired', value: rep.medicines?.expired || 0, color: '#94A3B8' },
            ],
            ordersOverview: [
              { status: 'Completed Trades', count: rep.trades?.completedTrades || 0, color: '#10B981' },
              { status: 'Active Requisitions', count: Math.max(0, (rep.orders?.total || 0) - (rep.trades?.completedTrades || 0) - (rep.trades?.cancelledTrades || 0)), color: '#3B82F6' },
              { status: 'Cancelled Trades', count: rep.trades?.cancelledTrades || 0, color: '#EF4444' },
            ],
            hospitalRegistrationTrend: [
              { month: 'Total', count: rep.hospitals?.total || 0, verified: rep.hospitals?.verified || 0 },
            ],
            recentActivity: [],
            feedbackSummary: rep.feedback || { total: 0, new: 0, underReview: 0, resolved: 0, averageRating: '5.0' },
            transferTrends: rep.movementTrends || [],
            systemPerformance: { coldChainAdherence: '99.8%', avgTransitTime: '4.2 hrs', errorRate: '0.02%' },
            topHotMedicines: rep.medicines?.mostRequested || [],
          };
        }
      }
    } catch (err) {
      console.warn('Backend admin dashboard reports unavailable, using fallback:', err.message);
    }

    await new Promise((r) => setTimeout(r, 100));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const payments = getStoredItem(KEYS.PAYMENTS, []);
    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);
    const auditLogs = getStoredItem(KEYS.AUDIT_TRAIL, []);

    // Medicine stock metrics
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;

    medicines.forEach((med) => {
      const exp = calculateMedicineExpiry(med.expiryDate, med.mfgDate, med.quantity, med.minStockLevel || 20);
      if (exp.isExpired) {
        expiredCount += 1;
      } else if (Number(med.quantity || 0) === 0) {
        outOfStockCount += 1;
      } else if (exp.isLowStock || Number(med.quantity || 0) <= (med.minStockLevel || 20)) {
        lowStockCount += 1;
      } else {
        inStockCount += 1;
      }

      if (exp.isNearExpiry && !exp.isExpired) {
        expiringSoonCount += 1;
      }
    });

    // Orders status counts
    const ordersCounts = {
      pending: requests.filter((r) => r.status === 'pending').length,
      processing: requests.filter((r) => r.status === 'accepted' || r.status === 'processing').length,
      shipped: requests.filter((r) => r.status === 'dispatched' || r.status === 'shipped').length,
      delivered: requests.filter((r) => r.status === 'delivered' || r.status === 'paid').length,
      cancelled: requests.filter((r) => r.status === 'rejected' || r.status === 'cancelled').length,
    };

    const verifiedHospitalsCount = hospitals.filter((h) => h.status === 'verified' || h.status === 'approved' || h.status === 'APPROVED').length;
    const pendingHospitalsCount = hospitals.filter((h) => h.status === 'pending' || h.status === 'under_review' || h.status === 'PENDING_APPROVAL').length;

    // 8 Required Summary Cards
    const summaryCards = {
      totalHospitals: hospitals.length,
      verifiedHospitals: verifiedHospitalsCount,
      pendingVerification: pendingHospitalsCount,
      totalMedicines: medicines.length,
      lowStock: lowStockCount,
      expiringSoon: expiringSoonCount,
      pendingOrders: ordersCounts.pending,
      totalOrders: requests.length,
    };

    // Visual Analytics A: Medicine Stock Overview
    const medicineStockOverview = [
      { name: 'In Stock', value: inStockCount, color: '#0A6E79' },
      { name: 'Low Stock', value: lowStockCount, color: '#F59E0B' },
      { name: 'Out of Stock', value: outOfStockCount, color: '#EF4444' },
      { name: 'Expired', value: expiredCount, color: '#94A3B8' },
    ];

    // Visual Analytics B: Orders Overview
    const ordersOverview = [
      { status: 'Pending', count: ordersCounts.pending, color: '#F59E0B' },
      { status: 'Processing', count: ordersCounts.processing, color: '#06B6D4' },
      { status: 'Shipped', count: ordersCounts.shipped, color: '#3B82F6' },
      { status: 'Delivered', count: ordersCounts.delivered, color: '#10B981' },
      { status: 'Cancelled', count: ordersCounts.cancelled, color: '#EF4444' },
    ];

    // Visual Analytics C: Hospital Registration Trend
    const hospitalRegistrationTrend = [
      { month: 'Apr', count: 4, verified: 3 },
      { month: 'May', count: 6, verified: 5 },
      { month: 'Jun', count: 9, verified: 8 },
      { month: 'Jul', count: 12, verified: 10 },
      { month: 'Aug', count: 18, verified: 15 },
      { month: 'Sep', count: hospitals.length || 24, verified: verifiedHospitalsCount || 20 },
    ];

    // Visual Analytics D: Recent Activity (synthesized from audit trail & events)
    const recentActivity = auditLogs.slice(0, 7).map((log, idx) => ({
      id: log.id || `act-${idx}`,
      type: log.action || 'ACTIVITY',
      title: log.description || log.summary || 'Administrative event logged',
      hospital: log.hospitalName || 'Health Facility',
      time: log.timestamp || new Date(Date.now() - idx * 3600000).toISOString(),
      status: log.status || log.resultingStatus || 'Completed',
    }));

    // Hospital Feedback Summary Card
    const fbTotal = feedbacks.length;
    const fbNew = feedbacks.filter((f) => !f.status || f.status === 'new').length;
    const fbUnderReview = feedbacks.filter((f) => f.status === 'under_review').length;
    const fbResolved = feedbacks.filter((f) => f.status === 'resolved').length;
    const fbAvgRating = fbTotal > 0
      ? (feedbacks.reduce((sum, f) => sum + Number(f.rating || 5), 0) / fbTotal).toFixed(1)
      : '4.8';

    const feedbackSummary = {
      total: fbTotal,
      new: fbNew,
      underReview: fbUnderReview,
      resolved: fbResolved,
      averageRating: fbAvgRating,
    };

    return {
      stats: summaryCards,
      medicineStockOverview,
      ordersOverview,
      hospitalRegistrationTrend,
      recentActivity,
      feedbackSummary,
      transferTrends: ADMIN_ANALYTICS.transferTrends,
      systemPerformance: ADMIN_ANALYTICS.systemPerformance,
      topHotMedicines: ADMIN_ANALYTICS.topHotMedicines,
    };
  },

  // ==========================================
  // 2. HOSPITAL MANAGEMENT & VERIFICATION (ABDM Integration-Ready Architecture)
  // ==========================================
  async getHospitals(filterStatus = null) {
    // 1. Try real API
    try {
      let endpoint = `${API_BASE}/admin/hospitals`;
      if (filterStatus === 'pending' || filterStatus === 'under_review') {
        endpoint = `${API_BASE}/admin/hospitals/pending`;
      }

      const response = await fetch(endpoint, {
        headers: getAuthHeaders(),
      });

      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        const list = Array.isArray(json.data) ? json.data : (json.data.hospitals || []);
        if (list.length > 0) {
          // Merge into local cache
          const localHospitals = getStoredItem(KEYS.HOSPITALS, []);
          const merged = [...localHospitals];
          list.forEach((item) => {
            const idx = merged.findIndex((h) => h.id === item.id);
            if (idx !== -1) merged[idx] = { ...merged[idx], ...item };
            else merged.unshift(item);
          });
          setStoredItem(KEYS.HOSPITALS, merged);
          return list;
        }
      }
    } catch (e) {
      // offline fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    if (!filterStatus || filterStatus === 'all') return hospitals;
    return hospitals.filter((h) => {
      const s = (h.status || '').toLowerCase();
      const f = filterStatus.toLowerCase();
      if (f === 'verified' || f === 'approved') return s === 'verified' || s === 'approved';
      if (f === 'pending') return s === 'pending' || s === 'pending_approval';
      return s === f;
    });
  },

  async verifyHospital(hospitalId) {
    assertAdminSession();

    // 1. Call real API
    try {
      const response = await fetch(`${API_BASE}/admin/hospitals/${hospitalId}/approve`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        const hospital = json.data.hospital || json.data;
        const hospitals = getStoredItem(KEYS.HOSPITALS, []);
        const idx = hospitals.findIndex((h) => h.id === hospitalId);
        if (idx !== -1) {
          hospitals[idx] = { ...hospitals[idx], status: 'approved', verifiedDate: new Date().toISOString().split('T')[0] };
          setStoredItem(KEYS.HOSPITALS, hospitals);
        }
        return hospital;
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 300));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const index = hospitals.findIndex((h) => h.id === hospitalId);
    if (index === -1) throw new Error('Hospital not found');

    const hospital = hospitals[index];
    hospital.status = 'verified';
    hospital.verifiedDate = new Date().toISOString().split('T')[0];
    hospital.rejectionReason = null;
    hospital.isDemoSimulation = true;

    setStoredItem(KEYS.HOSPITALS, hospitals);

    auditService.logEvent({
      action: 'HOSPITAL_APPLICATION_APPROVED',
      entityType: 'Hospitals',
      entityId: hospital.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      adminUser: 'Super Administrator',
      summary: `Hospital application approved for ${hospital.name} (${hospital.registrationNo}). Institutional trading privileges and centralized inventory access activated.`,
      resultingStatus: 'verified',
      metadata: { registrationNo: hospital.registrationNo },
    });

    return hospital;
  },

  async rejectHospital(hospitalId, reason) {
    assertAdminSession();

    // 1. Call real API
    try {
      const response = await fetch(`${API_BASE}/admin/hospitals/${hospitalId}/reject`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        const hospital = json.data.hospital || json.data;
        const hospitals = getStoredItem(KEYS.HOSPITALS, []);
        const idx = hospitals.findIndex((h) => h.id === hospitalId);
        if (idx !== -1) {
          hospitals[idx] = { ...hospitals[idx], status: 'rejected', rejectionReason: reason };
          setStoredItem(KEYS.HOSPITALS, hospitals);
        }
        return hospital;
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 300));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const index = hospitals.findIndex((h) => h.id === hospitalId);
    if (index === -1) throw new Error('Hospital not found');

    const hospital = hospitals[index];
    hospital.status = 'rejected';
    hospital.rejectionReason = reason || 'Statutory documentation incomplete or failed compliance verification.';
    hospital.verifiedDate = null;
    hospital.isDemoSimulation = true;

    setStoredItem(KEYS.HOSPITALS, hospitals);

    auditService.logEvent({
      action: 'HOSPITAL_APPLICATION_REJECTED',
      entityType: 'Hospitals',
      entityId: hospital.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      adminUser: 'Super Administrator',
      summary: `Hospital application rejected for ${hospital.name}. Rejection reason: ${hospital.rejectionReason}`,
      resultingStatus: 'rejected',
      metadata: { reason: hospital.rejectionReason },
    });

    return hospital;
  },

  async setReviewStatus(hospitalId, status, note = '') {
    await new Promise((r) => setTimeout(r, 250));
    assertAdminSession();
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const index = hospitals.findIndex((h) => h.id === hospitalId);
    if (index === -1) throw new Error('Hospital not found');

    const hospital = hospitals[index];
    hospital.status = status; // 'under_review' | 'documents_missing' | etc.
    hospital.reviewNote = note;
    setStoredItem(KEYS.HOSPITALS, hospitals);

    auditService.logEvent({
      action: 'VERIFICATION_STATUS_CHANGED',
      entityType: 'VERIFICATION',
      entityId: hospital.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      summary: `Verification status for ${hospital.name} transitioned to "${status}".`,
      resultingStatus: status,
      metadata: { note },
    });

    return hospital;
  },

  async suspendHospital(hospitalId, reason) {
    await new Promise((r) => setTimeout(r, 300));
    assertAdminSession();
    const trimmedReason = reason?.trim();
    if (!trimmedReason) throw new Error('Suspension reason is required');

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const index = hospitals.findIndex((h) => h.id === hospitalId);
    if (index === -1) throw new Error('Hospital not found');

    const hospital = hospitals[index];
    hospitals[index] = {
      ...hospital,
      status: 'suspended',
      statusBeforeSuspension: hospital.status === 'suspended' ? hospital.statusBeforeSuspension || 'verified' : hospital.status,
      suspensionReason: trimmedReason,
      suspendedAt: new Date().toISOString(),
    };
    setStoredItem(KEYS.HOSPITALS, hospitals);

    auditService.logEvent({
      action: 'HOSPITAL_SUSPENDED',
      entityType: 'VERIFICATION',
      entityId: hospital.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      summary: `Operational suspension placed on ${hospital.name}. Reason: ${trimmedReason}`,
      resultingStatus: 'suspended',
      metadata: { reason: trimmedReason },
    });

    return hospitals[index];
  },

  async reactivateHospital(hospitalId) {
    await new Promise((r) => setTimeout(r, 300));
    assertAdminSession();
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const index = hospitals.findIndex((h) => h.id === hospitalId);
    if (index === -1) throw new Error('Hospital not found');

    const hospital = hospitals[index];
    hospitals[index] = {
      ...hospital,
      status: hospital.statusBeforeSuspension && hospital.statusBeforeSuspension !== 'suspended'
        ? hospital.statusBeforeSuspension
        : 'verified',
      statusBeforeSuspension: null,
      suspensionReason: null,
      suspendedAt: null,
    };
    setStoredItem(KEYS.HOSPITALS, hospitals);

    auditService.logEvent({
      action: 'HOSPITAL_REACTIVATED',
      entityType: 'VERIFICATION',
      entityId: hospital.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      summary: `Hospital ${hospital.name} reactivated with trading privileges restored.`,
      resultingStatus: hospitals[index].status,
      metadata: {},
    });

    return hospitals[index];
  },

  async verifyHospitalDocument(hospitalId, documentId) {
    await new Promise((r) => setTimeout(r, 200));
    assertAdminSession();
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hospIndex = hospitals.findIndex((h) => h.id === hospitalId);
    if (hospIndex === -1) throw new Error('Hospital not found');

    const hospital = hospitals[hospIndex];
    const docs = hospital.documents || [];
    const docIndex = docs.findIndex((d) => d.id === documentId || d.name === documentId || d.documentName === documentId);
    if (docIndex === -1) throw new Error('Document not found');

    docs[docIndex] = {
      ...docs[docIndex],
      documentStatus: 'verified',
      verified: true,
      reviewedAt: new Date().toISOString().split('T')[0],
      rejectionReason: null,
    };

    hospital.documents = docs;
    hospitals[hospIndex] = hospital;
    setStoredItem(KEYS.HOSPITALS, hospitals);

    return { hospital, document: docs[docIndex] };
  },

  async rejectHospitalDocument(hospitalId, documentId, reason) {
    await new Promise((r) => setTimeout(r, 200));
    assertAdminSession();
    const trimmedReason = reason?.trim();
    if (!trimmedReason) throw new Error('Rejection reason is required');

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hospIndex = hospitals.findIndex((h) => h.id === hospitalId);
    if (hospIndex === -1) throw new Error('Hospital not found');

    const hospital = hospitals[hospIndex];
    const docs = hospital.documents || [];
    const docIndex = docs.findIndex((d) => d.id === documentId || d.name === documentId || d.documentName === documentId);
    if (docIndex === -1) throw new Error('Document not found');

    docs[docIndex] = {
      ...docs[docIndex],
      documentStatus: 'rejected',
      verified: false,
      reviewedAt: new Date().toISOString().split('T')[0],
      rejectionReason: trimmedReason,
    };

    hospital.documents = docs;
    hospitals[hospIndex] = hospital;
    setStoredItem(KEYS.HOSPITALS, hospitals);

    return { hospital, document: docs[docIndex] };
  },

  async updateDocumentReviewStatus(hospitalId, documentId, status, note = '') {
    await new Promise((r) => setTimeout(r, 150));
    assertAdminSession();
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hospIndex = hospitals.findIndex((h) => h.id === hospitalId);
    if (hospIndex === -1) throw new Error('Hospital not found');

    const hospital = hospitals[hospIndex];
    const docs = hospital.documents || [];
    const docIndex = docs.findIndex((d) => d.id === documentId || d.name === documentId || d.documentName === documentId);
    if (docIndex === -1) throw new Error('Document not found');

    const normalizedStatus = (status || 'submitted').toLowerCase();
    const isVerified = normalizedStatus === 'accepted' || normalizedStatus === 'verified';
    docs[docIndex] = {
      ...docs[docIndex],
      documentStatus: status,
      status: status,
      verified: isVerified,
      reviewedAt: new Date().toISOString().split('T')[0],
      reviewNote: note || null,
      rejectionReason: (normalizedStatus.includes('attention') || normalizedStatus === 'rejected') ? (note || 'Requires attention') : null,
    };

    hospital.documents = docs;
    hospitals[hospIndex] = hospital;
    setStoredItem(KEYS.HOSPITALS, hospitals);

    return { hospital, document: docs[docIndex] };
  },

  async getHospitalDetails(hospitalId) {
    try {
      const response = await fetch(`${API_BASE}/admin/hospitals/${hospitalId}/verification`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // offline fallback
    }

    await new Promise((r) => setTimeout(r, 150));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    return hospitals.find((h) => h.id === hospitalId) || hospitals[0] || null;
  },

  async updateHospitalDetails(hospitalId, updateData) {
    await new Promise((r) => setTimeout(r, 250));
    assertAdminSession();
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const index = hospitals.findIndex((h) => h.id === hospitalId);
    if (index === -1) throw new Error('Hospital not found');

    hospitals[index] = {
      ...hospitals[index],
      ...updateData,
    };
    setStoredItem(KEYS.HOSPITALS, hospitals);
    return hospitals[index];
  },

  // ==========================================
  // 3. MASTER MEDICINES CATALOGUE OVERSIGHT
  // ==========================================
  async getMedicineData() {
    try {
      const response = await fetch(`${API_BASE}/medicines?limit=200`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data?.items) {
        return json.data.items;
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 150));
    return getStoredItem(KEYS.MASTER_MEDICINES, []);
  },

  async addMedicineToHospital(medicineData) {
    assertAdminSession();

    // 1. Call real API
    try {
      const response = await fetch(`${API_BASE}/medicines`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(medicineData),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
        masterMeds.unshift(json.data);
        setStoredItem(KEYS.MASTER_MEDICINES, masterMeds);
        return json.data;
      }
    } catch (e) {
      // fallback
    }

    // Admin creates medicine in the Master Catalogue ONLY
    await new Promise((r) => setTimeout(r, 200));

    if (!medicineData.medicineName && !medicineData.brandName) {
      throw new Error('Medicine name is required for master catalogue registration');
    }

    const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
    const name = (medicineData.medicineName || medicineData.brandName).trim();
    const generic = (medicineData.genericName || '').trim();
    const form = medicineData.dosageForm || medicineData.form || 'Tablet';
    const strength = medicineData.strength || medicineData.power || '';

    // Generate standard medicine code if not specified
    let code = medicineData.medicineCode;
    if (!code) {
      const prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'MED';
      const strengthNum = strength.replace(/[^0-9]/g, '') || '100';
      code = `MED-${prefix}-${strengthNum}`;
    }

    const newMasterMed = {
      id: 'master-med-' + Date.now(),
      medicineCode: code,
      medicineName: name,
      brandName: name,
      genericName: generic,
      category: medicineData.category || 'General Therapeutics',
      dosageForm: form,
      form: form,
      strength: strength,
      power: strength,
      unit: medicineData.unit || 'mg',
      manufacturer: medicineData.manufacturer || 'Approved Pharmaceutical Lab',
      storageType: medicineData.storageType || 'Room Temperature (15°C - 25°C)',
      description: medicineData.description || 'Registered pharmaceutical formulation in MEDEX central master formulary.',
      status: 'active',
      dateAdded: new Date().toISOString().split('T')[0],
    };

    masterMeds.unshift(newMasterMed);
    setStoredItem(KEYS.MASTER_MEDICINES, masterMeds);

    auditService.logEvent({
      action: 'MASTER_MEDICINE_ADDED',
      entityType: 'MEDICINE',
      entityId: newMasterMed.id,
      actorRole: 'admin',
      summary: `Registered new medicine "${newMasterMed.medicineName}" (${newMasterMed.medicineCode}) in central master catalogue.`,
      resultingStatus: 'active',
      metadata: { code: newMasterMed.medicineCode, category: newMasterMed.category, manufacturer: newMasterMed.manufacturer },
    });

    return newMasterMed;
  },

  async updateMedicineData(id, updatedData) {
    assertAdminSession();

    // 1. Call real API
    try {
      const response = await fetch(`${API_BASE}/medicines/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedData),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
        const idx = masterMeds.findIndex((m) => m.id === id);
        if (idx !== -1) {
          masterMeds[idx] = json.data;
          setStoredItem(KEYS.MASTER_MEDICINES, masterMeds);
        }
        return json.data;
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
    const index = masterMeds.findIndex((m) => m.id === id);
    if (index === -1) throw new Error('Master medicine record not found');

    const name = updatedData.medicineName || updatedData.brandName || masterMeds[index].medicineName;
    const form = updatedData.dosageForm || updatedData.form || masterMeds[index].dosageForm;
    const strength = updatedData.strength || updatedData.power || masterMeds[index].strength;

    masterMeds[index] = {
      ...masterMeds[index],
      ...updatedData,
      medicineName: name,
      brandName: name,
      genericName: updatedData.genericName ?? masterMeds[index].genericName,
      category: updatedData.category ?? masterMeds[index].category,
      dosageForm: form,
      form: form,
      strength: strength,
      power: strength,
      unit: updatedData.unit ?? masterMeds[index].unit,
      manufacturer: updatedData.manufacturer ?? masterMeds[index].manufacturer,
      storageType: updatedData.storageType ?? masterMeds[index].storageType,
      medicineCode: updatedData.medicineCode ?? masterMeds[index].medicineCode,
      description: updatedData.description ?? masterMeds[index].description,
    };

    setStoredItem(KEYS.MASTER_MEDICINES, masterMeds);

    auditService.logEvent({
      action: 'MASTER_MEDICINE_UPDATED',
      entityType: 'MEDICINE',
      entityId: id,
      actorRole: 'admin',
      summary: `Updated master formulary entry for "${masterMeds[index].medicineName}".`,
      resultingStatus: 'active',
      metadata: { code: masterMeds[index].medicineCode },
    });

    return masterMeds[index];
  },

  async deleteMedicineData(id) {
    assertAdminSession();

    // 1. Call real API
    try {
      const response = await fetch(`${API_BASE}/medicines/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success) {
        const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
        const filtered = masterMeds.filter((m) => m.id !== id);
        setStoredItem(KEYS.MASTER_MEDICINES, filtered);
        return true;
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
    const target = masterMeds.find((m) => m.id === id);
    const filtered = masterMeds.filter((m) => m.id !== id);
    setStoredItem(KEYS.MASTER_MEDICINES, filtered);

    if (target) {
      auditService.logEvent({
        action: 'MASTER_MEDICINE_DELETED',
        entityType: 'MEDICINE',
        entityId: id,
        actorRole: 'admin',
        summary: `Removed "${target.medicineName}" (${target.medicineCode}) from central master catalogue.`,
        resultingStatus: 'deleted',
      });
    }

    return true;
  },

  // ==========================================
  // ADMIN INVENTORY DUAL HIERARCHIES
  // ==========================================
  async getAdminInventoryByMedicine(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE}/admin/inventory/by-medicine?${q}`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return [];
  },

  async getMedicineContributors(medicineId) {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/by-medicine/${medicineId}/contributors`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return [];
  },

  async getMedicineHospitalBatches(medicineId, hospitalId) {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/by-medicine/${medicineId}/hospitals/${hospitalId}/batches`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return [];
  },

  async getAdminInventoryByHospital(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE}/admin/inventory/by-hospital?${q}`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return [];
  },

  async getHospitalMedicines(hospitalId) {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/by-hospital/${hospitalId}/medicines`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return [];
  },

  async getHospitalMedicineBatches(hospitalId, medicineId) {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/by-hospital/${hospitalId}/medicines/${medicineId}/batches`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return [];
  },

  async getBatchDetail(batchId) {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/batches/${batchId}`, {
        headers: getAuthHeaders(),
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.success && json?.data) {
        return json.data;
      }
    } catch (e) {
      // fallback
    }
    return null;
  },

  // ==========================================
  // 4. TRANSFERS & BIO-WASTE OVERSIGHT
  // ==========================================
  async getTransfers() {
    try {
      const response = await fetch(`${API_BASE}/transfers`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 150));
    return getStoredItem(KEYS.TRACKING, []);
  },

  async updateTransferStatus(transactionId, newStatus) {
    assertAdminSession();
    try {
      await fetch(`${API_BASE}/transfers/${encodeURIComponent(transactionId)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      // offline fallback
    }

    await new Promise((r) => setTimeout(r, 250));
    const trackingList = getStoredItem(KEYS.TRACKING, []);
    const index = trackingList.findIndex((t) => t.transactionId === transactionId || t.id === transactionId);
    if (index !== -1) {
      trackingList[index].status = newStatus;
      if (trackingList[index].timeline) {
        const match = trackingList[index].timeline.find((t) => t.step.toLowerCase().includes(newStatus.toLowerCase()));
        if (match) match.completed = true;
      }
      setStoredItem(KEYS.TRACKING, trackingList);

      auditService.logEvent({
        action: 'SHIPMENT_STATUS_UPDATED',
        entityType: 'TRANSFER',
        entityId: trackingList[index].trackingNumber || transactionId,
        hospitalId: trackingList[index].senderHospitalId || 'hosp-admin',
        hospitalName: trackingList[index].senderHospital,
        summary: `Transfer status updated to "${newStatus}" for consignment ${trackingList[index].trackingNumber || transactionId}.`,
        resultingStatus: newStatus,
        metadata: { transactionId, status: newStatus },
      });

      return trackingList[index];
    }

    return { transactionId, status: newStatus };
  },

  async getDisposals() {
    await new Promise((r) => setTimeout(r, 150));
    return getStoredItem(KEYS.DISPOSALS, []);
  },

  async updateDisposalStatus(id, newStatus, certificateNo = null) {
    await new Promise((r) => setTimeout(r, 250));
    assertAdminSession();
    const disposals = getStoredItem(KEYS.DISPOSALS, []);
    const index = disposals.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Disposal record not found');

    disposals[index].status = newStatus;
    if (certificateNo) {
      disposals[index].certificateNo = certificateNo;
      disposals[index].certificateDate = new Date().toISOString().split('T')[0];
    }
    if (newStatus === 'Incinerated & Certified' && !disposals[index].certificateNo) {
      disposals[index].certificateNo = 'BMW-INC-2024-' + Math.floor(10000 + Math.random() * 90000);
      disposals[index].certificateDate = new Date().toISOString().split('T')[0];
    }

    setStoredItem(KEYS.DISPOSALS, disposals);

    auditService.logEvent({
      action: 'WASTE_STATUS_UPDATED',
      entityType: 'WASTE',
      entityId: disposals[index].id,
      hospitalId: disposals[index].hospitalId,
      hospitalName: disposals[index].hospitalName,
      summary: `Bio-waste disposal status updated to "${newStatus}" for ${disposals[index].medicineName}.`,
      resultingStatus: newStatus,
      metadata: { certificateNo: disposals[index].certificateNo },
    });

    return disposals[index];
  },

  // ==========================================
  // 5. ADMIN FEEDBACK MODERATION
  // ==========================================
  async getFeedback(ratingFilter = null) {
    try {
      let url = `${API_BASE}/feedback`;
      if (ratingFilter && ratingFilter !== 'all') {
        url += `?rating=${encodeURIComponent(ratingFilter)}`;
      }
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 150));
    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);
    if (!ratingFilter || ratingFilter === 'all') return feedbacks;
    return feedbacks.filter((f) => f.rating === Number(ratingFilter));
  },

  async replyFeedback(id, replyText) {
    assertAdminSession();
    try {
      await fetch(`${API_BASE}/feedback/${encodeURIComponent(id)}/reply`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ replyText }),
      });
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 250));
    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);
    const index = feedbacks.findIndex((f) => f.id === id);
    if (index === -1) throw new Error('Feedback not found');

    feedbacks[index].adminReply = replyText;
    feedbacks[index].repliedDate = new Date().toISOString().split('T')[0];
    if (feedbacks[index].status === 'new') {
      feedbacks[index].status = 'under_review';
    }

    setStoredItem(KEYS.FEEDBACKS, feedbacks);

    auditService.logEvent({
      action: 'FEEDBACK_REPLIED',
      entityType: 'Feedback',
      entityId: id,
      hospitalId: feedbacks[index].hospitalId,
      hospitalName: feedbacks[index].hospitalName,
      summary: `Admin replied to hospital feedback from ${feedbacks[index].hospitalName}`,
      resultingStatus: feedbacks[index].status,
    });

    return feedbacks[index];
  },

  async updateFeedbackStatus(id, newStatus) {
    assertAdminSession();
    try {
      await fetch(`${API_BASE}/feedback/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);
    const index = feedbacks.findIndex((f) => f.id === id);
    if (index === -1) throw new Error('Feedback record not found');

    feedbacks[index].status = newStatus;
    setStoredItem(KEYS.FEEDBACKS, feedbacks);

    auditService.logEvent({
      action: newStatus === 'resolved' ? 'FEEDBACK_RESOLVED' : 'FEEDBACK_STATUS_UPDATED',
      entityType: 'Feedback',
      entityId: id,
      hospitalId: feedbacks[index].hospitalId,
      hospitalName: feedbacks[index].hospitalName,
      summary: `Admin updated feedback from ${feedbacks[index].hospitalName} to "${newStatus}"`,
      resultingStatus: newStatus,
    });

    return feedbacks[index];
  },

  // ==========================================
  // 6. CENTRAL INVENTORY OVERSIGHT
  // ==========================================
  async getInventory(statusFilter = 'all', searchTerm = '', hospitalFilter = 'all', categoryFilter = 'all', expiryFilter = 'all') {
    await new Promise((r) => setTimeout(r, 150));
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const requests = getStoredItem(KEYS.REQUESTS, []);

    // Active reservations: requests with status in ['pending', 'accepted', 'processing']
    const reservedMap = {};
    requests.forEach((req) => {
      if (['pending', 'accepted', 'processing'].includes(req.status)) {
        reservedMap[req.medicineId] = (reservedMap[req.medicineId] || 0) + Number(req.quantity || 0);
      }
    });

    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiredUnits = 0;
    let expiringSoonCount = 0;
    const uniqueMedicinesSet = new Set();

    const items = medicines.map((med) => {
      const hosp = hospitals.find((h) => h.id === med.hospitalId) || { name: med.hospitalName || 'Health Facility', city: 'District' };
      const exp = calculateMedicineExpiry(med.expiryDate, med.mfgDate, med.quantity, med.minStockLevel || 20);
      const qty = Number(med.quantity || 0);
      const reserved = reservedMap[med.id] || 0;
      const available = Math.max(0, qty - reserved);

      const medName = med.brandName || med.medicineName || 'Pharmaceutical';
      uniqueMedicinesSet.add(medName.trim().toLowerCase());

      let computedStatus = 'in_stock';
      if (exp.isExpired) {
        computedStatus = 'expired';
        expiredUnits += 1;
      } else if (available === 0 || qty === 0) {
        computedStatus = 'out_of_stock';
        outOfStockCount += 1;
      } else if (available <= (med.minStockLevel || 20) || exp.isLowStock) {
        computedStatus = 'low_stock';
        lowStockCount += 1;
      } else {
        computedStatus = 'in_stock';
      }

      if (exp.isNearExpiry && !exp.isExpired) {
        expiringSoonCount += 1;
      }

      totalUnits += qty;

      return {
        id: med.id,
        medicine: medName,
        medicineName: medName,
        medicineId: med.medicineId || med.id,
        masterMedicineId: med.masterMedicineId || med.medicineId,
        genericName: med.genericName || 'Active Pharmaceutical Ingredient',
        category: med.category || 'Essential Medicines',
        dosage: med.dosage || med.strength || med.power || '',
        dosageForm: med.dosageForm || med.form || 'Tablet',
        form: med.form || med.dosageForm || 'Tablet',
        strength: med.strength || med.power || '',
        power: med.power || med.strength || '',
        packing: med.packing || med.packSize || '15 Tablets',
        packSize: med.packSize || med.packing || '15 Tablets',
        unit: med.unit || 'Tablet',
        shelfLocation: med.shelfLocation || 'Rack A - Shelf 3',
        manufacturer: med.manufacturer || 'Authorized Manufacturer',
        hospital: hosp.name,
        hospitalName: hosp.name,
        hospitalId: med.hospitalId,
        hospitalCity: hosp.city || 'Metro',
        hospitalState: hosp.state || 'India',
        availableStock: available,
        availableQuantity: available,
        totalStock: qty,
        totalQuantity: qty,
        quantity: qty,
        reservedStock: reserved,
        reservedQuantity: reserved,
        expiredStock: exp.isExpired ? qty : 0,
        minimumStock: med.minStockLevel || 20,
        minStockLevel: med.minStockLevel || 20,
        reorderLevel: med.reorderLevel || med.minStockLevel || 20,
        mrp: Number(med.mrp || med.unitOriginalPrice || 50),
        unitOriginalPrice: Number(med.mrp || med.unitOriginalPrice || 50),
        concessionRate: Number(med.concessionRate || med.unitFinalPrice || Math.round((med.unitOriginalPrice || 50) * (1 - (med.concessionPercent || 10) / 100))),
        unitFinalPrice: Number(med.concessionRate || med.unitFinalPrice || Math.round((med.unitOriginalPrice || 50) * (1 - (med.concessionPercent || 10) / 100))),
        costRate: Number(med.costRate || med.acquisitionCost || Math.round((med.unitOriginalPrice || 50) * 0.85)),
        acquisitionCost: Number(med.acquisitionCost || med.costRate || Math.round((med.unitOriginalPrice || 50) * 0.85)),
        supplier: med.supplier || 'Authorized Pharmaceutical Distributor',
        purchaseDate: med.purchaseDate || med.dateAdded || '2024-09-01',
        source: med.source || 'Standard Procurement',
        mfgDate: med.mfgDate || '2024-01-01',
        expiryDate: med.expiryDate,
        daysUntilExpiry: exp.daysUntilExpiry,
        isExpired: exp.isExpired,
        isNearExpiry: exp.isNearExpiry,
        status: computedStatus,
        stockStatus: computedStatus,
        lastUpdated: med.lastUpdated || med.dateAdded || '2024-09-01',
        batchNumber: med.batchNo || 'BATCH-2024',
        batchNo: med.batchNo || 'BATCH-2024',
        notes: med.notes || '',
        storageType: med.storageCondition || med.storageType || 'Room Temperature (15°C - 25°C)',
        storageCondition: med.storageCondition || med.storageType || 'Room Temperature (15°C - 25°C)',
        numberOfPacks: med.numberOfPacks !== undefined ? med.numberOfPacks : Math.max(1, Math.ceil(qty / (med.unitsPerPack || 15))),
        unitsPerPack: med.unitsPerPack || 15,
        totalUnits: med.totalUnits || qty,
      };
    });

    // Summary counts calculated from real centralized inventory
    const summary = {
      totalMedicines: uniqueMedicinesSet.size || medicines.length,
      totalUnits,
      totalStockUnits: totalUnits,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      expiringSoon: expiringSoonCount,
      expired: expiredUnits,
      totalStock: totalUnits,
      lowStockCount,
      outOfStockCount,
      expiredCount: expiredUnits,
    };

    // Filter items
    const filtered = items.filter((item) => {
      const matchSearch =
        !searchTerm ||
        item.medicine.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hospital.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hospitalId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchStatus = true;
      if (statusFilter && statusFilter !== 'all') {
        const normFilter = statusFilter.toLowerCase().replace(/[\s_-]+/g, '');
        if (normFilter === 'expiringsoon') {
          matchStatus = item.isNearExpiry && !item.isExpired;
        } else {
          const normItemStatus = (item.status || '').toLowerCase().replace(/[\s_-]+/g, '');
          matchStatus = normItemStatus === normFilter;
        }
      }

      let matchExpiry = true;
      if (expiryFilter && expiryFilter !== 'all') {
        const normExp = expiryFilter.toLowerCase().replace(/[\s_-]+/g, '');
        if (normExp === 'good') {
          matchExpiry = !item.isExpired && (item.daysUntilExpiry === undefined || item.daysUntilExpiry > 90);
        } else if (normExp === 'expiringsoon' || normExp === 'within90') {
          matchExpiry = !item.isExpired && item.daysUntilExpiry !== undefined && item.daysUntilExpiry <= 90;
        } else if (normExp === 'within60') {
          matchExpiry = !item.isExpired && item.daysUntilExpiry !== undefined && item.daysUntilExpiry <= 60;
        } else if (normExp === 'within30') {
          matchExpiry = !item.isExpired && item.daysUntilExpiry !== undefined && item.daysUntilExpiry <= 30;
        } else if (normExp === 'expired') {
          matchExpiry = item.isExpired;
        }
      }

      const matchHosp =
        !hospitalFilter ||
        hospitalFilter === 'all' ||
        item.hospitalId === hospitalFilter;

      const matchCategory =
        !categoryFilter ||
        categoryFilter === 'all' ||
        item.category.toLowerCase() === categoryFilter.toLowerCase();

      return matchSearch && matchStatus && matchExpiry && matchHosp && matchCategory;
    });

    return {
      items: filtered,
      summary,
    };
  },

  async adminAddStock({
    hospitalId,
    masterMedicineId,
    medicineName,
    genericName,
    category,
    dosageForm,
    form,
    dosage,
    strength,
    power,
    packing,
    packSize,
    numberOfPacks,
    unitsPerPack,
    totalUnits,
    unit,
    shelfLocation,
    storageCondition,
    storageType,
    mrp,
    concessionRate,
    costRate,
    acquisitionCost,
    reorderLevel,
    manufacturer,
    batchNo,
    quantity,
    mfgDate,
    expiryDate,
    minStockLevel,
    notes,
    unitOriginalPrice
  }) {
    await new Promise((r) => setTimeout(r, 200));
    assertAdminSession();
    if (!hospitalId) throw new Error('Hospital must be selected');
    if (!medicineName?.trim()) throw new Error('Medicine name must be specified');
    if (!batchNo?.trim()) throw new Error('Batch number is required');
    const addQty = Number(quantity);
    if (isNaN(addQty) || addQty <= 0) throw new Error('Quantity must be greater than 0');
    if (!expiryDate) throw new Error('Expiry date is required');

    if (!isExpiryAcceptable(expiryDate)) {
      throw new Error('Stock cannot be accepted because the medicine expires within 1 month.');
    }

    const rateMRP = Number(mrp) || Number(unitOriginalPrice) || 100;
    const policyPricing = getExpiryPricing(expiryDate, rateMRP);
    const rateConcession = policyPricing.sellingPricePerUnit;
    const rateCost = Number(costRate || acquisitionCost) || Math.round(rateMRP * 0.85);

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === hospitalId) || { name: 'Hospital Facility', city: 'District' };

    const normBatch = batchNo.trim().toLowerCase();
    const normName = medicineName.trim().toLowerCase();

    // Section 6 Duplicate Medicine/Batch Logic:
    // Hospital + Medicine + Batch
    const existingIndex = medicines.findIndex((m) => {
      if (m.hospitalId !== hospitalId) return false;
      const matchBatch = (m.batchNo || '').trim().toLowerCase() === normBatch;
      const matchName = (m.brandName || m.medicineName || '').trim().toLowerCase() === normName ||
        (masterMedicineId && (m.masterMedicineId === masterMedicineId || m.medicineId === masterMedicineId));
      return matchBatch && matchName;
    });

    let resultItem;
    let isNewRecord = false;
    let prevQuantity = 0;

    const uPerPack = Number(unitsPerPack) > 0 ? Number(unitsPerPack) : 15;
    const numPacks = Number(numberOfPacks) > 0 ? Number(numberOfPacks) : Math.max(1, Math.ceil(addQty / uPerPack));
    const resolvedPackSize = packSize || packing || `${uPerPack} Units / Strip`;
    const resolvedStorage = storageCondition || storageType || 'Room Temperature (15°C - 25°C)';

    if (existingIndex !== -1) {
      // Merge into existing batch (do NOT create duplicate row)
      prevQuantity = Number(medicines[existingIndex].quantity || medicines[existingIndex].totalQuantity || 0);
      const newTotal = prevQuantity + addQty;
      medicines[existingIndex].quantity = newTotal;
      medicines[existingIndex].totalQuantity = newTotal;
      medicines[existingIndex].totalUnits = newTotal;
      const prevPacks = Number(medicines[existingIndex].numberOfPacks || Math.ceil(prevQuantity / uPerPack));
      medicines[existingIndex].numberOfPacks = prevPacks + numPacks;
      medicines[existingIndex].unitsPerPack = uPerPack;
      medicines[existingIndex].packSize = resolvedPackSize;
      medicines[existingIndex].packing = resolvedPackSize;
      medicines[existingIndex].storageCondition = resolvedStorage;
      medicines[existingIndex].storageType = resolvedStorage;
      const reserved = Number(medicines[existingIndex].reservedQuantity || 0);
      medicines[existingIndex].availableQuantity = Math.max(0, newTotal - reserved);
      medicines[existingIndex].lastUpdated = new Date().toISOString().split('T')[0];
      if (mfgDate) medicines[existingIndex].mfgDate = mfgDate;
      if (expiryDate) medicines[existingIndex].expiryDate = expiryDate;
      if (minStockLevel || reorderLevel) {
        medicines[existingIndex].minStockLevel = Number(minStockLevel || reorderLevel);
        medicines[existingIndex].reorderLevel = Number(reorderLevel || minStockLevel);
      }
      if (shelfLocation) medicines[existingIndex].shelfLocation = shelfLocation;
      if (unit) medicines[existingIndex].unit = unit;
      medicines[existingIndex].mrp = rateMRP;
      medicines[existingIndex].unitOriginalPrice = rateMRP;
      medicines[existingIndex].concessionRate = rateConcession;
      medicines[existingIndex].unitFinalPrice = rateConcession;
      medicines[existingIndex].costRate = rateCost;
      medicines[existingIndex].acquisitionCost = rateCost;
      resultItem = medicines[existingIndex];
    } else {
      // Create separate batch record
      isNewRecord = true;
      resultItem = {
        id: 'med-' + Date.now(),
        masterMedicineId: masterMedicineId || undefined,
        medicineId: masterMedicineId || ('med-' + Date.now()),
        brandName: medicineName.trim(),
        medicineName: medicineName.trim(),
        genericName: genericName?.trim() || 'Active Formulation',
        category: category || 'Essential Medicines',
        dosage: dosage || strength || power || 'Standard',
        dosageForm: dosageForm || form || 'Tablet',
        form: dosageForm || form || 'Tablet',
        power: strength || power || 'Standard',
        strength: strength || power || 'Standard',
        packing: resolvedPackSize,
        packSize: resolvedPackSize,
        numberOfPacks: numPacks,
        unitsPerPack: uPerPack,
        totalUnits: addQty,
        unit: unit || 'Tablet',
        manufacturer: manufacturer || 'Authorized Manufacturer',
        batchNo: batchNo.trim(),
        batchNumber: batchNo.trim(),
        quantity: addQty,
        totalQuantity: addQty,
        reservedQuantity: 0,
        availableQuantity: addQty,
        reorderLevel: Number(reorderLevel || minStockLevel) || 20,
        minStockLevel: Number(minStockLevel || reorderLevel) || 20,
        shelfLocation: shelfLocation || 'Rack A - Shelf 3',
        storageCondition: resolvedStorage,
        storageType: resolvedStorage,
        mfgDate: mfgDate || new Date().toISOString().split('T')[0],
        expiryDate: expiryDate,
        mrp: rateMRP,
        unitOriginalPrice: rateMRP,
        concessionRate: rateConcession,
        unitFinalPrice: rateConcession,
        costRate: rateCost,
        acquisitionCost: rateCost,
        hospitalId,
        hospitalName: hosp.name,
        location: `${hosp.city || 'District'}, ${hosp.state || 'India'}`,
        source: 'Admin Stock Addition',
        dateAdded: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString().split('T')[0],
        notes: notes || 'Admin override stock addition',
        addedBy: 'Admin (Override)',
      };
      medicines.unshift(resultItem);
    }

    setStoredItem(KEYS.MEDICINES, medicines);

    // Record in Stock History (Section 12)
    const stockHistory = getStoredItem(KEYS.STOCK_HISTORY, []);
    stockHistory.unshift({
      id: 'sh-admin-' + Date.now(),
      medicineId: resultItem.id,
      medicineName: resultItem.brandName || resultItem.medicineName,
      batchNo: resultItem.batchNo,
      hospitalId,
      hospitalName: hosp.name,
      action: 'Admin Stock Addition',
      actionType: 'Admin Stock Addition',
      movementType: 'Admin Stock Addition',
      quantityDelta: addQty,
      previousStock: prevQuantity,
      resultingStock: resultItem.quantity,
      performedBy: 'Admin',
      shelfLocation: resultItem.shelfLocation,
      source: 'Admin Stock Addition',
      reason: notes || 'Admin override authorized batch addition',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    });
    setStoredItem(KEYS.STOCK_HISTORY, stockHistory);

    // Audit Trail
    auditService.logEvent({
      action: 'ADMIN_STOCK_ADDED',
      entityType: 'Inventory',
      entityId: resultItem.id,
      hospitalId,
      hospitalName: hosp.name,
      adminUser: 'Super Administrator',
      summary: `Admin added ${addQty} units of ${resultItem.brandName} (Batch: ${resultItem.batchNo}) to ${hosp.name}. Total balance: ${resultItem.quantity} units.`,
      resultingStatus: 'Completed',
      metadata: {
        isNewRecord,
        quantityDelta: addQty,
        resultingQuantity: resultItem.quantity,
        batchNo: resultItem.batchNo,
      }
    });

    return resultItem;
  },

  async adjustStock({ medicineId, quantityDelta, type = 'Intake', reason = 'Inventory adjustment' }) {
    await new Promise((r) => setTimeout(r, 200));
    assertAdminSession();
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const index = medicines.findIndex((m) => m.id === medicineId);
    if (index === -1) throw new Error('Medicine not found in inventory');

    const med = medicines[index];
    const prevStock = Number(med.quantity || 0);
    const newStock = Math.max(0, prevStock + Number(quantityDelta));
    med.quantity = newStock;
    med.lastUpdated = new Date().toISOString().split('T')[0];
    setStoredItem(KEYS.MEDICINES, medicines);

    // Record stock movement history
    const stockHistory = getStoredItem(KEYS.STOCK_HISTORY, []);
    stockHistory.unshift({
      id: 'sh-' + Date.now(),
      medicineId,
      medicineName: med.brandName || med.medicineName,
      batchNo: med.batchNo,
      hospitalId: med.hospitalId,
      hospitalName: med.hospitalName,
      action: Number(quantityDelta) >= 0 ? 'Stock Added' : 'Stock Adjustment',
      actionType: type,
      quantityDelta: Number(quantityDelta),
      previousStock: prevStock,
      resultingStock: newStock,
      performedBy: 'Admin',
      reason,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      adminUser: 'Super Administrator',
    });
    setStoredItem(KEYS.STOCK_HISTORY, stockHistory);

    auditService.logEvent({
      action: 'STOCK_ADJUSTED',
      entityType: 'Inventory',
      entityId: medicineId,
      hospitalId: med.hospitalId,
      hospitalName: med.hospitalName,
      summary: `Admin adjusted stock for ${med.brandName} (${quantityDelta > 0 ? '+' : ''}${quantityDelta} units). Reason: ${reason}`,
      resultingStatus: 'Completed',
    });

    return med;
  },

  async transferStock({ medicineId, sourceHospitalId, targetHospitalId, quantity, note }) {
    await new Promise((r) => setTimeout(r, 250));
    assertAdminSession();
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);

    const sourceMedIndex = medicines.findIndex((m) => m.id === medicineId);
    if (sourceMedIndex === -1) throw new Error('Source inventory record not found');
    const sourceMed = medicines[sourceMedIndex];

    const transferQty = Number(quantity);
    if (isNaN(transferQty) || transferQty <= 0) throw new Error('Transfer quantity must be greater than 0');
    
    const currentQty = Number(sourceMed.quantity || 0);
    if (currentQty <= 0) {
      throw new Error('Cannot transfer out-of-stock inventory (Current balance: 0 units)');
    }
    if (currentQty < transferQty) {
      throw new Error(`Insufficient stock. Available to transfer: ${currentQty} units`);
    }

    // Block transfer of expired stock (Section 21)
    const exp = calculateMedicineExpiry(sourceMed.expiryDate, sourceMed.mfgDate, currentQty, sourceMed.minStockLevel || 20);
    if (exp.isExpired) {
      throw new Error('Expired medicines cannot be transferred for redistribution under patient safety protocols.');
    }

    const sourceHosp = hospitals.find((h) => h.id === (sourceHospitalId || sourceMed.hospitalId)) || { name: sourceMed.hospitalName, id: sourceMed.hospitalId };
    const targetHosp = hospitals.find((h) => h.id === targetHospitalId);
    if (!targetHosp) throw new Error('Target destination hospital not found');
    if (targetHosp.id === sourceHosp.id) throw new Error('Destination hospital must be different from source hospital');

    // Deduct from source hospital
    sourceMed.quantity = currentQty - transferQty;
    sourceMed.lastUpdated = new Date().toISOString().split('T')[0];

    // Target hospital duplicate rule: Hospital + Medicine + Batch (Section 11)
    const normBatch = (sourceMed.batchNo || '').trim().toLowerCase();
    const normName = (sourceMed.brandName || sourceMed.medicineName || '').trim().toLowerCase();

    let targetMedIndex = medicines.findIndex((m) => {
      if (m.hospitalId !== targetHospitalId) return false;
      const matchBatch = (m.batchNo || '').trim().toLowerCase() === normBatch;
      const matchName = (m.brandName || m.medicineName || '').trim().toLowerCase() === normName ||
        (sourceMed.masterMedicineId && (m.masterMedicineId === sourceMed.masterMedicineId || m.medicineId === sourceMed.masterMedicineId));
      return matchBatch && matchName;
    });

    let targetMed;
    if (targetMedIndex !== -1) {
      // Increase existing batch quantity in target hospital
      targetMed = medicines[targetMedIndex];
      targetMed.quantity = Number(targetMed.quantity || 0) + transferQty;
      targetMed.lastUpdated = new Date().toISOString().split('T')[0];
    } else {
      // Create new inventory record in target hospital keeping same batch, mfg, and expiry
      targetMed = {
        ...sourceMed,
        id: 'med-' + Date.now() + '-xfr',
        hospitalId: targetHospitalId,
        hospitalName: targetHosp.name,
        location: `${targetHosp.city || ''}, ${targetHosp.state || 'India'}`,
        quantity: transferQty,
        batchNo: sourceMed.batchNo,
        mfgDate: sourceMed.mfgDate,
        expiryDate: sourceMed.expiryDate,
        dateAdded: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString().split('T')[0],
      };
      medicines.unshift(targetMed);
    }

    setStoredItem(KEYS.MEDICINES, medicines);

    // Create tracking consignment
    const txnId = 'TXN-XFR-' + Date.now().toString().slice(-6);
    const trackingList = getStoredItem(KEYS.TRACKING, []);
    trackingList.unshift({
      transactionId: txnId,
      trackingNumber: 'MED-TRK-' + Math.floor(100000 + Math.random() * 900000),
      medicineName: sourceMed.brandName || sourceMed.medicineName,
      batchNo: sourceMed.batchNo,
      quantity: transferQty,
      senderHospital: sourceHosp.name,
      senderHospitalId: sourceHosp.id,
      receiverHospital: targetHosp.name,
      receiverHospitalId: targetHosp.id,
      status: 'In Transit',
      temperature: '4.2°C',
      timeline: [
        { step: 'Transfer Authorized', timestamp: new Date().toISOString(), completed: true },
        { step: 'Cold-Chain Dispatch', timestamp: new Date().toISOString(), completed: true },
        { step: 'In Transit', timestamp: new Date().toISOString(), completed: true },
        { step: 'Delivered', timestamp: null, completed: false },
      ]
    });
    setStoredItem(KEYS.TRACKING, trackingList);

    // Log to Stock History for BOTH source and target (Section 12)
    const stockHistory = getStoredItem(KEYS.STOCK_HISTORY, []);
    
    // Source deduction
    stockHistory.unshift({
      id: 'sh-xfr-src-' + Date.now(),
      medicineId: sourceMed.id,
      medicineName: sourceMed.brandName || sourceMed.medicineName,
      batchNo: sourceMed.batchNo,
      hospitalId: sourceHosp.id,
      hospitalName: sourceHosp.name,
      partnerHospitalId: targetHosp.id,
      partnerHospitalName: targetHosp.name,
      action: 'Stock Transferred',
      actionType: 'Transfer',
      quantityDelta: -transferQty,
      previousStock: currentQty,
      resultingStock: sourceMed.quantity,
      performedBy: 'Admin',
      reason: `Transferred ${transferQty} units to ${targetHosp.name}. Note: ${note || 'Admin quota redistribution'}`,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    });

    // Destination addition
    stockHistory.unshift({
      id: 'sh-xfr-dest-' + Date.now(),
      medicineId: targetMed.id,
      medicineName: sourceMed.brandName || sourceMed.medicineName,
      batchNo: sourceMed.batchNo,
      hospitalId: targetHosp.id,
      hospitalName: targetHosp.name,
      partnerHospitalId: sourceHosp.id,
      partnerHospitalName: sourceHosp.name,
      action: 'Stock Received',
      actionType: 'Received',
      quantityDelta: transferQty,
      resultingStock: targetMed.quantity,
      performedBy: 'Admin',
      reason: `Received ${transferQty} units transferred from ${sourceHosp.name}. Note: ${note || 'Admin quota redistribution'}`,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    });

    setStoredItem(KEYS.STOCK_HISTORY, stockHistory);

    // Audit Trail
    auditService.logEvent({
      action: 'STOCK_TRANSFERRED',
      entityType: 'Inventory',
      entityId: txnId,
      hospitalId: sourceHosp.id,
      hospitalName: sourceHosp.name,
      partnerHospitalId: targetHosp.id,
      partnerHospitalName: targetHosp.name,
      adminUser: 'Super Administrator',
      summary: `Admin transferred ${transferQty} units of ${sourceMed.brandName} (Batch: ${sourceMed.batchNo}) from ${sourceHosp.name} to ${targetHosp.name}.`,
      resultingStatus: 'In Transit',
      metadata: {
        sourceHospital: sourceHosp.name,
        destinationHospital: targetHosp.name,
        medicine: sourceMed.brandName,
        batchNo: sourceMed.batchNo,
        quantity: transferQty,
      }
    });

    return { success: true, txnId, targetMed, sourceMed };
  },

  async getStockHistory(medicineId = null, batchNo = null, hospitalId = null) {
    await new Promise((r) => setTimeout(r, 100));
    const stockHistory = getStoredItem(KEYS.STOCK_HISTORY, []);
    
    let filtered = stockHistory;
    if (medicineId && medicineId !== 'all') {
      filtered = filtered.filter((h) => 
        h.medicineId === medicineId || 
        (h.medicineName && h.medicineName.toLowerCase() === medicineId.toLowerCase())
      );
    }
    if (batchNo && batchNo !== 'all') {
      filtered = filtered.filter((h) => (h.batchNo || '').toLowerCase() === batchNo.toLowerCase());
    }
    if (hospitalId && hospitalId !== 'all') {
      filtered = filtered.filter((h) => h.hospitalId === hospitalId || h.partnerHospitalId === hospitalId);
    }

    if (filtered.length === 0) {
      return [
        {
          id: 'sh-fallback-1',
          medicineName: 'Pharmaceutical Inventory Batch',
          batchNo: batchNo || 'BATCH-001',
          action: 'Stock Added',
          actionType: 'Intake',
          quantityDelta: 100,
          resultingStock: 100,
          performedBy: 'Apollo Hospital',
          reason: 'Initial verified stock intake registration',
          timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
          date: new Date(Date.now() - 48 * 3600000).toISOString().split('T')[0],
        }
      ];
    }

    return filtered;
  },

  // ==========================================
  // 7. CENTRAL ORDERS OVERSIGHT
  // ==========================================
  async getOrders(statusFilter = 'all') {
    await new Promise((r) => setTimeout(r, 150));
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const trackingList = getStoredItem(KEYS.TRACKING, []);

    let needSync = false;

    const orders = requests.map((req, idx) => {
      const fromHosp = hospitals.find((h) => h.id === req.fromHospitalId) || {
        id: req.fromHospitalId || 'hosp-1',
        name: req.fromHospitalName || 'Apollo Hospital',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '+91 98201 54321',
        email: 'apollo@medex.org',
        registrationNo: 'MH-GOV-8821',
      };
      const toHosp = hospitals.find((h) => h.id === req.toHospitalId) || {
        id: req.toHospitalId || 'hosp-2',
        name: req.toHospitalName || 'Fortis Memorial Research Institute',
        city: 'Gurgaon',
        state: 'Haryana',
        phone: '+91 98112 33445',
        email: 'fortis@medex.org',
        registrationNo: 'HR-MED-4412',
      };
      const med = medicines.find((m) => m.id === req.medicineId);

      // Keep exact raw status without collapsing into fewer states
      const rawStatus = (req.status || 'pending').toLowerCase().trim();
      let normStatus = rawStatus;
      if (rawStatus === 'shipped') normStatus = 'dispatched';
      if (rawStatus === 'processing') normStatus = 'preparing';
      if (rawStatus === 'under_review') normStatus = 'pending';

      const rawPay = (req.paymentStatus || '').toLowerCase().trim();
      let payStatus = 'pending';

      if (['paid', 'success', 'successful', 'completed', 'settled'].includes(rawPay)) {
        payStatus = 'paid';
        if (req.paymentStatus !== 'paid') {
          req.paymentStatus = 'paid';
          needSync = true;
        }
      } else if (rawPay === 'failed') {
        payStatus = 'failed';
      } else if (rawPay === 'refunded' || req.cancellation?.refundStatus) {
        payStatus = 'refunded';
      } else if (['paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(normStatus)) {
        // Legitimate fulfillment order: ensure payment status is synchronized with order status
        payStatus = 'paid';
        if (req.paymentStatus !== 'paid') {
          req.paymentStatus = 'paid';
          if (!req.paidDate) req.paidDate = req.requestDate || new Date().toISOString();
          if (!req.paymentCompletedAt) req.paymentCompletedAt = req.paidDate;
          needSync = true;
        }
      } else {
        payStatus = 'pending';
      }

      const unitPrice = Number(req.unitFinalPrice || req.pricePerUnit || med?.unitOriginalPrice || 48);
      const qty = Number(req.quantity || 10);
      const totalAmt = Number(req.totalAmount || qty * unitPrice);

      // Find matching logistics consignment if available
      const tracking = trackingList.find(
        (t) => t.transactionId === req.transactionId || t.trackingNumber === req.trackingNumber || t.medicineName === req.medicineName
      );

      const batchNo = req.batchNo || med?.batchNo || 'BAT-9841';
      const expiryDate = req.medicineExpiryDate || med?.expiryDate || '2025-12-31';
      const mfgDate = req.mfgDate || med?.mfgDate || '2024-01-15';
      const expectedDelivery = req.expectedDelivery || (normStatus === 'completed' ? 'Delivered' : normStatus === 'delivered' ? 'Dock Intake Complete' : 'Within 24-48 Hours');
      const logisticsSla = req.logisticsSla || (tracking ? `${tracking.temperature || 'Cold Chain 2°C - 8°C Verified'}` : 'Cold Chain 2°C - 8°C Verified');
      const hasDiscrepancy = Boolean(req.hasDiscrepancy || req.discrepancy);
      const discrepancy = req.discrepancy || (req.hasDiscrepancy ? 'Audit inspection note recorded' : null);

      // Build structured order timeline history reflecting real milestones
      const statusHistory = [];
      const reqDateStr = req.requestDate ? new Date(req.requestDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recorded';
      statusHistory.push({
        status: 'Requested',
        timestamp: reqDateStr,
        note: `Requisition created by ${fromHosp.name} for ${qty} units of ${req.medicineName}.`,
        actor: fromHosp.name,
      });

      if (['accepted', 'paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(normStatus) || req.acceptedAt) {
        const acceptDateStr = req.acceptedAt ? new Date(req.acceptedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Verified';
        statusHistory.push({
          status: 'Accepted',
          timestamp: acceptDateStr,
          note: `Requisition accepted by ${toHosp.name}. Batch ${batchNo} reserved.`,
          actor: toHosp.name,
        });
      }

      if (payStatus === 'paid' || req.paidDate) {
        const paidDateStr = req.paidDate ? new Date(req.paidDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Escrow Locked';
        statusHistory.push({
          status: 'Paid',
          timestamp: paidDateStr,
          note: `Settlement of ₹${totalAmt.toLocaleString('en-IN')} held securely in platform escrow. Ref: ${req.paymentId || 'PAY-DEMO-' + (req.transactionId || 'ESCROW')}`,
          actor: 'Payment Gateway / Escrow',
        });
      } else if (payStatus === 'failed') {
        statusHistory.push({
          status: 'Payment Failed',
          timestamp: req.paymentFailedAt ? new Date(req.paymentFailedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Failed',
          note: req.paymentFailureReason || 'Card authorization network failure. Order awaiting retry.',
          actor: 'Payment Gateway',
        });
      }

      if (['preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(normStatus) || req.preparingAt) {
        const prepDateStr = req.preparingAt ? new Date(req.preparingAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Dock Preparation';
        statusHistory.push({
          status: 'Preparing',
          timestamp: prepDateStr,
          note: `Pharmacists at ${toHosp.name} verifying batch cold-seal packaging & temperature sensor insertion.`,
          actor: toHosp.name,
        });
      }

      if (['dispatched', 'in transit', 'delivered', 'completed'].includes(normStatus) || req.dispatchedAt) {
        const dispDateStr = req.dispatchedAt ? new Date(req.dispatchedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Dock Cleared';
        statusHistory.push({
          status: 'Dispatched',
          timestamp: dispDateStr,
          note: `Consignment sealed and handed over to ${tracking?.courierName || 'MediCold Logistics Express Ltd.'}.`,
          actor: tracking?.courierName || 'Carrier Dispatch',
        });
      }

      if (['in transit', 'delivered', 'completed'].includes(normStatus) || req.inTransitAt) {
        const transitDateStr = req.inTransitAt ? new Date(req.inTransitAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'En Route';
        statusHistory.push({
          status: 'In Transit',
          timestamp: transitDateStr,
          note: `Consignment in transit. IoT Telemetry active: ${tracking?.temperature || '3.8°C (Compliant)'}. Current location: ${tracking?.currentLocation || 'NH-48 Corridor'}.`,
          actor: 'IoT Telemetry Gate',
        });
      }

      if (['delivered', 'completed'].includes(normStatus) || req.deliveredAt) {
        const delvDateStr = req.deliveredAt ? new Date(req.deliveredAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Intake Dock';
        statusHistory.push({
          status: 'Delivered',
          timestamp: delvDateStr,
          note: `Consignment arrived at ${fromHosp.name}. Inward dock inspection and physical temperature scan verified.`,
          actor: fromHosp.name,
        });
      }

      if (normStatus === 'completed' || req.completedAt) {
        const complDateStr = req.completedAt ? new Date(req.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Ledger Finalized';
        statusHistory.push({
          status: 'Completed',
          timestamp: complDateStr,
          note: `Pharmacy inventory balances synchronized. Escrow released to ${toHosp.name}. Requisition lifecycle completed.`,
          actor: 'MedEx Settlement Engine',
        });
      }

      if (normStatus === 'cancelled') {
        statusHistory.push({
          status: 'Cancelled',
          timestamp: req.cancellation?.cancelledAt ? new Date(req.cancellation.cancelledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Cancelled',
          note: `Requisition cancelled: ${req.cancellation?.reason || req.statusNote || 'Requirement modified by hospital.'}`,
          actor: fromHosp.name,
        });
      }

      if (normStatus === 'rejected') {
        statusHistory.push({
          status: 'Rejected',
          timestamp: reqDateStr,
          note: `Requisition declined by peer hospital: ${req.rejectReason || 'Stock needed for acute inpatient emergency.'}`,
          actor: toHosp.name,
        });
      }

      return {
        id: req.id,
        orderId: (req.transactionId || req.id || `req-${idx}`).toUpperCase().replace('REQ-', 'ORD-'),
        transactionId: req.transactionId || (req.id || '').toUpperCase(),
        medicineName: req.medicineName || med?.brandName || 'Essential Pharmaceutical',
        hospital: fromHosp,
        requestingHospital: fromHosp,
        fulfillingHospital: toHosp,
        providingHospital: toHosp,
        items: [
          {
            name: req.medicineName || med?.brandName || 'Essential Pharmaceutical Compound',
            genericName: req.genericName || med?.genericName || 'Active Formulation',
            quantity: qty,
            unitPrice,
            total: totalAmt,
            batchNo,
            expiryDate,
            mfgDate,
          }
        ],
        totalItems: qty,
        quantity: qty,
        totalAmount: totalAmt,
        settlementAmount: totalAmt,
        paymentStatus: payStatus,
        paymentReference: req.paymentId || (payStatus === 'paid' ? 'PAY-' + (req.transactionId || 'ESCROW') : null),
        paidDate: req.paidDate || null,
        orderDate: req.requestDate || '2024-08-20',
        status: normStatus,
        priority: req.urgency || req.priority || (req.statusNote?.includes('ICU') || req.notes?.includes('ICU') ? 'Emergency' : 'Standard Routine'),
        urgency: req.urgency || (req.notes?.includes('ICU') ? 'Emergency' : 'Standard Routine'),
        notes: req.notes || 'Standard pharmaceutical requisition via centralized peer exchange.',
        batchNo,
        expiryDate,
        mfgDate,
        expectedDelivery,
        logisticsSla,
        hasDiscrepancy,
        discrepancy,
        trackingInfo: tracking || null,
        statusHistory,
        cancellation: req.cancellation || null,
      };
    });

    if (needSync) {
      setStoredItem(KEYS.REQUESTS, requests);
    }

    if (!statusFilter || statusFilter === 'all') return orders;

    // Support all requested filters:
    // All Orders, Requested, Accepted, Paid, Preparing, Dispatched, In Transit, Delivered, Completed, Cancelled, Rejected, Payment Pending, Payment Failed, Discrepancy
    const sf = statusFilter.toLowerCase().trim();
    return orders.filter((o) => {
      const s = (o.status || '').toLowerCase().trim();
      const ps = (o.paymentStatus || '').toLowerCase().trim();

      if (sf === 'requested' || sf === 'pending') {
        return s === 'pending' || s === 'requested';
      }
      if (sf === 'accepted') {
        return s === 'accepted';
      }
      if (sf === 'paid') {
        return s === 'paid';
      }
      if (sf === 'preparing' || sf === 'processing') {
        return s === 'preparing' || s === 'processing';
      }
      if (sf === 'dispatched' || sf === 'shipped') {
        return s === 'dispatched' || s === 'shipped';
      }
      if (sf === 'in transit' || sf === 'in_transit' || sf === 'transit') {
        return s === 'in transit' || s === 'in_transit';
      }
      if (sf === 'delivered') {
        return s === 'delivered';
      }
      if (sf === 'completed') {
        return s === 'completed';
      }
      if (sf === 'cancelled') {
        return s === 'cancelled';
      }
      if (sf === 'rejected') {
        return s === 'rejected';
      }
      if (sf === 'payment pending' || sf === 'payment_pending') {
        return ps === 'pending' && s === 'accepted';
      }
      if (sf === 'payment failed' || sf === 'payment_failed') {
        return ps === 'failed';
      }
      if (sf === 'discrepancy') {
        return o.hasDiscrepancy || Boolean(o.discrepancy);
      }
      if (sf === 'insufficient stock' || sf === 'insufficient_stock') {
        return s === 'insufficient stock' || s === 'insufficient_stock';
      }

      return s === sf;
    });
  },

  async updateOrderStatus(orderId, targetStatus, note = '') {
    await new Promise((r) => setTimeout(r, 200));
    assertAdminSession();
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const index = requests.findIndex((r) => 
      r.id === orderId || 
      r.id?.toUpperCase().replace('REQ-', 'ORD-') === orderId ||
      r.transactionId === orderId
    );
    if (index === -1) throw new Error('Order record not found');

    const req = requests[index];
    const prevStatus = req.status;

    // Normalizing statuses & payment verification
    const targetNorm = targetStatus.toLowerCase().trim();
    const currentNorm = (req.status || 'pending').toLowerCase().trim();
    const currentPay = (req.paymentStatus || '').toLowerCase().trim();

    // Check payment state: normalized check
    const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(currentPay) || 
                   (['paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(currentNorm) && currentPay !== 'failed');

    // 1. Rejected or cancelled orders cannot continue through normal lifecycle (Section 10 & 11)
    if (['rejected', 'cancelled'].includes(currentNorm)) {
      throw new Error(`Cannot advance order: Requisition is currently ${currentNorm} and cannot proceed through fulfillment.`);
    }

    // 2. Admin MUST NOT bypass payment by manually marking an unpaid order as Paid (Section 2 & 14)
    if (targetNorm === 'paid') {
      if (!isPaid) {
        throw new Error('Admin cannot manually mark an order as Paid. Payment must be completed by the requesting hospital.');
      }
      req.status = 'paid';
      req.paymentStatus = 'paid';
      if (!req.paidDate) req.paidDate = new Date().toISOString();
      if (!req.paymentCompletedAt) req.paymentCompletedAt = req.paidDate;
    }

    // 3. Status transition sequence validation (Section 4 & 9)
    else if (targetNorm === 'accepted') {
      if (currentNorm !== 'pending' && currentNorm !== 'requested') {
        throw new Error(`Invalid transition: Cannot move order from ${req.status} to Accepted.`);
      }
      req.status = 'accepted';
      req.paymentStatus = 'pending';
      if (!req.acceptedAt) req.acceptedAt = new Date().toISOString();
    } else if (targetNorm === 'preparing') {
      // For: Accepted -> Preparing require successful payment. For: Paid -> Preparing allow if payment completed.
      if (!isPaid) {
        throw new Error(`Cannot advance order to Preparing: payment has not been successfully completed by the requesting hospital.`);
      }
      if (currentNorm !== 'paid' && currentNorm !== 'accepted') {
        throw new Error(`Invalid transition: Cannot advance order to Preparing from "${req.status}". Order must be Paid first.`);
      }
      req.status = 'preparing';
      req.paymentStatus = 'paid';
      if (!req.preparingAt) req.preparingAt = new Date().toISOString();
    } else if (targetNorm === 'dispatched') {
      // For: Preparing -> Dispatched allow if paymentStatus === successful/paid
      if (!isPaid) {
        throw new Error(`Cannot advance order to Dispatched: payment has not been successfully completed by the requesting hospital.`);
      }
      if (currentNorm !== 'preparing') {
        throw new Error(`Invalid transition: Cannot advance order directly from "${req.status}" to Dispatched. Order must be in Preparing status first.`);
      }
      req.status = 'dispatched';
      req.paymentStatus = 'paid';
      if (!req.dispatchedAt) req.dispatchedAt = new Date().toISOString();
    } else if (targetNorm === 'in transit') {
      if (!isPaid) {
        throw new Error(`Cannot advance order to In Transit: payment has not been successfully completed by the requesting hospital.`);
      }
      if (currentNorm !== 'dispatched') {
        throw new Error(`Invalid transition: Cannot move order from "${req.status}" to In Transit. Order must be Dispatched first.`);
      }
      req.status = 'in transit';
      req.paymentStatus = 'paid';
      if (!req.inTransitAt) req.inTransitAt = new Date().toISOString();
    } else if (targetNorm === 'delivered') {
      if (!isPaid) {
        throw new Error(`Cannot advance order to Delivered: payment has not been successfully completed by the requesting hospital.`);
      }
      if (currentNorm !== 'in transit') {
        throw new Error(`Invalid transition: Cannot move order from "${req.status}" to Delivered. Order must be In Transit first.`);
      }
      req.status = 'delivered';
      req.paymentStatus = 'paid';
      if (!req.deliveredAt) req.deliveredAt = new Date().toISOString();
    } else if (targetNorm === 'completed') {
      if (!isPaid) {
        throw new Error(`Cannot advance order to Completed: payment has not been successfully completed by the requesting hospital.`);
      }
      if (currentNorm !== 'delivered') {
        throw new Error(`Invalid transition: Cannot move order from "${req.status}" to Completed. Order must be Delivered first.`);
      }
      req.status = 'completed';
      req.paymentStatus = 'paid';
      if (!req.completedAt) req.completedAt = new Date().toISOString();
    } else {
      req.status = targetNorm;
      if (['preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(targetNorm)) {
        req.paymentStatus = 'paid';
      }
    }

    req.statusNote = note;

    if (!req.timeline) {
      req.timeline = [
        { step: 'Order Placed', timestamp: req.requestDate || new Date().toISOString(), completed: true },
        { step: 'Status updated by Admin to ' + targetStatus, timestamp: new Date().toISOString(), completed: true, note },
      ];
    } else {
      req.timeline.push({
        step: `Status transitioned to ${targetStatus}`,
        timestamp: new Date().toISOString(),
        completed: true,
        note,
      });
    }

    // Inventory Synchronization (Requirements 25, 26, 28)
    if ((targetNorm === 'delivered' || targetNorm === 'completed') && !req.stockReceivedByBuyer) {
      const medicines = getStoredItem(KEYS.MEDICINES, []);
      const buyerHospId = req.fromHospitalId;
      const normBatch = (req.batchNo || 'BAT-9841').trim().toLowerCase();
      const normName = (req.medicineName || '').trim().toLowerCase();

      let targetMedIndex = medicines.findIndex((m) => {
        if (m.hospitalId !== buyerHospId) return false;
        const matchBatch = (m.batchNo || '').trim().toLowerCase() === normBatch;
        const matchName = (m.brandName || m.medicineName || '').trim().toLowerCase() === normName;
        return matchBatch && matchName;
      });

      if (targetMedIndex !== -1) {
        medicines[targetMedIndex].quantity = Number(medicines[targetMedIndex].quantity || 0) + Number(req.quantity);
        medicines[targetMedIndex].lastUpdated = new Date().toISOString().split('T')[0];
      } else {
        medicines.unshift({
          id: 'med-' + Date.now() + '-rcv',
          medicineId: req.medicineId || ('med-rcv-' + Date.now()),
          brandName: req.medicineName,
          medicineName: req.medicineName,
          genericName: req.genericName || 'Active Formulation',
          category: 'Essential Medicines',
          form: req.form || 'Tablet',
          power: req.power || '',
          manufacturer: req.manufacturer || 'Approved Manufacturer',
          batchNo: req.batchNo || 'BAT-RCV-' + Date.now().toString().slice(-4),
          quantity: Number(req.quantity),
          minStockLevel: 20,
          mfgDate: req.mfgDate || '2024-01-01',
          expiryDate: req.medicineExpiryDate || req.expiryDate || '2025-12-31',
          unitOriginalPrice: Number(req.unitOriginalPrice || req.unitFinalPrice || 50),
          hospitalId: buyerHospId,
          hospitalName: req.fromHospitalName,
          dateAdded: new Date().toISOString().split('T')[0],
          lastUpdated: new Date().toISOString().split('T')[0],
          notes: `Procured through inter-hospital requisition #${req.transactionId || req.id}`,
        });
      }
      setStoredItem(KEYS.MEDICINES, medicines);
      req.stockReceivedByBuyer = true;
    }

    // Sync Tracking records in KEYS.TRACKING
    const trackingList = getStoredItem(KEYS.TRACKING, []);
    const trkIdx = trackingList.findIndex((t) => t.transactionId === req.transactionId);
    if (trkIdx !== -1) {
      if (targetNorm === 'preparing') trackingList[trkIdx].status = 'In Preparation';
      if (targetNorm === 'dispatched') trackingList[trkIdx].status = 'Dispatched';
      if (targetNorm === 'in transit') trackingList[trkIdx].status = 'In Transit';
      if (targetNorm === 'delivered') trackingList[trkIdx].status = 'Delivered';
      if (targetNorm === 'completed') trackingList[trkIdx].status = 'Completed';
      setStoredItem(KEYS.TRACKING, trackingList);
    }

    setStoredItem(KEYS.REQUESTS, requests);

    const displayId = (req.transactionId || req.id || '').toUpperCase().replace('REQ-', 'ORD-');
    auditService.logEvent({
      action: 'ORDER_STATUS_UPDATED',
      entityType: 'Orders',
      entityId: displayId,
      hospitalId: req.fromHospitalId,
      hospitalName: req.fromHospitalName,
      summary: `Admin updated Order #${displayId} to ${targetStatus.toUpperCase()}`,
      resultingStatus: targetStatus,
      metadata: { previousStatus: prevStatus, note },
    });

    return req;
  },

  // ==========================================
  // 8. REPORTS & ANALYTICS
  // ==========================================
  async getReports(range = '30d') {
    try {
      const response = await fetch(`${API_BASE}/admin/reports?range=${encodeURIComponent(range)}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        if (body?.data) return body.data;
      }
    } catch (err) {
      console.warn('Backend admin/reports unavailable, using fallback:', err.message);
    }

    await new Promise((r) => setTimeout(r, 100));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);

    // 1. Hospital reports
    const totalHospitals = hospitals.length;
    const verifiedHospitals = hospitals.filter((h) => h.status === 'verified').length;
    const rejectedHospitals = hospitals.filter((h) => h.status === 'rejected').length;
    const suspendedHospitals = hospitals.filter((h) => h.status === 'suspended').length;
    const newRegistrations = hospitals.filter((h) => h.status === 'pending' || h.status === 'under_review').length;

    // 2. Medicine reports
    let lowStock = 0;
    let outOfStock = 0;
    let expired = 0;
    let expiringSoon = 0;

    medicines.forEach((m) => {
      const exp = calculateMedicineExpiry(m.expiryDate, m.mfgDate, m.quantity, m.minStockLevel || 20);
      if (exp.isExpired) expired += 1;
      else if (Number(m.quantity || 0) === 0) outOfStock += 1;
      else if (Number(m.quantity || 0) <= (m.minStockLevel || 20)) lowStock += 1;

      if (exp.isNearExpiry && !exp.isExpired) expiringSoon += 1;
    });

    const mostRequested = medicines.slice(0, 5).map((m, idx) => ({
      name: m.brandName,
      units: 140 + idx * 85,
    }));

    // 3. Order reports
    const totalOrders = requests.length;
    const dailyOrders = Math.max(2, Math.round(totalOrders / 15));
    const weeklyOrders = Math.max(8, Math.round(totalOrders / 3));
    const monthlyOrders = totalOrders;

    const hospitalOrdersMap = {};
    requests.forEach((r) => {
      const name = r.fromHospitalName || 'Apollo Hospital';
      hospitalOrdersMap[name] = (hospitalOrdersMap[name] || 0) + 1;
    });
    const hospitalWiseOrders = Object.entries(hospitalOrdersMap).map(([name, count]) => ({
      hospital: name,
      orders: count,
    }));

    return {
      hospitals: {
        total: totalHospitals,
        verified: verifiedHospitals,
        newRegistrations,
        rejected: rejectedHospitals,
        suspended: suspendedHospitals,
      },
      medicines: {
        total: medicines.length,
        mostRequested,
        lowStock,
        outOfStock,
        expired,
        expiringSoon,
      },
      orders: {
        daily: dailyOrders,
        weekly: weeklyOrders,
        monthly: monthlyOrders,
        total: totalOrders,
        hospitalWise: hospitalWiseOrders,
        mostOrdered: mostRequested,
      },
      feedback: {
        total: feedbacks.length,
        averageRating: feedbacks.length > 0
          ? Number((feedbacks.reduce((acc, f) => acc + Number(f.rating || 5), 0) / feedbacks.length).toFixed(1))
          : 4.8,
        resolved: feedbacks.filter((f) => f.status === 'resolved').length,
        unresolved: feedbacks.filter((f) => f.status !== 'resolved').length,
        categoryWise: [
          { category: 'Medicine Availability', count: feedbacks.filter((f) => f.category === 'Medicine Availability').length || 2 },
          { category: 'Order / Delivery', count: feedbacks.filter((f) => f.category === 'Order / Delivery').length || 3 },
          { category: 'Inventory', count: feedbacks.filter((f) => f.category === 'Inventory').length || 1 },
          { category: 'Website / System', count: feedbacks.filter((f) => f.category === 'Website / System').length || 1 },
          { category: 'Support', count: feedbacks.filter((f) => f.category === 'Support').length || 1 },
        ],
        trends: [
          { month: 'Jun', rating: 4.6 },
          { month: 'Jul', rating: 4.7 },
          { month: 'Aug', rating: 4.8 },
          { month: 'Sep', rating: 4.9 },
        ],
      },
    };
  },

  async exportTradingReportCSV(filters = {}) {
    const query = new URLSearchParams();
    if (filters.startDate) query.append('startDate', filters.startDate);
    if (filters.endDate) query.append('endDate', filters.endDate);
    if (filters.status && filters.status !== 'all') query.append('status', filters.status);
    if (filters.search) query.append('search', filters.search);
    if (filters.medicineId) query.append('medicineId', filters.medicineId);

    const response = await fetch(`${API_BASE}/trades/export?${query.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Export failed with HTTP status ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `medex-national-trading-report-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  // ==========================================
  // 9. SETTINGS MANAGEMENT
  // ==========================================
  async getSettings() {
    await new Promise((r) => setTimeout(r, 100));
    return getStoredItem(KEYS.SETTINGS, {
      profile: {
        name: 'Super Administrator',
        email: 'admin@medex.org',
        phone: '+91 11 2345 6789',
        department: 'National Healthcare Logistics Oversight',
        avatar: '',
      },
      security: {
        twoFactorEnabled: false,
        sessionTimeoutMinutes: 60,
        lastPasswordChange: '2024-07-15',
        loginHistory: [
          { id: '1', ip: '103.21.14.88', location: 'New Delhi, India', device: 'Chrome / Windows 11', timestamp: 'Today, 09:30 AM', current: true },
          { id: '2', ip: '103.21.14.88', location: 'New Delhi, India', device: 'Chrome / Windows 11', timestamp: 'Yesterday, 04:15 PM', current: false },
          { id: '3', ip: '49.207.210.12', location: 'Mumbai, India', device: 'Safari / macOS', timestamp: 'Sep 05, 2024, 11:20 AM', current: false },
        ],
      },
      notifications: {
        lowStockNotifications: true,
        expiryNotifications: true,
        newHospitalNotifications: true,
        newOrderNotifications: true,
        feedbackNotifications: true,
      },
      system: {
        minStockThreshold: 20,
        expiryWarningPeriodDays: 60,
        requestSlaHours: 48,
        coldChainMinTemp: 2.0,
        coldChainMaxTemp: 8.0,
      }
    });
  },

  async updateSettings(updateData) {
    await new Promise((r) => setTimeout(r, 200));
    assertAdminSession();
    const current = await this.getSettings();
    const merged = {
      profile: { ...current.profile, ...(updateData.profile || {}) },
      security: { ...current.security, ...(updateData.security || {}) },
      notifications: { ...current.notifications, ...(updateData.notifications || {}) },
      system: { ...current.system, ...(updateData.system || {}) },
    };
    setStoredItem(KEYS.SETTINGS, merged);

    auditService.logEvent({
      action: 'SETTINGS_UPDATED',
      entityType: 'Settings',
      entityId: 'admin-config',
      summary: 'Admin updated system configuration and security preferences',
      resultingStatus: 'Saved',
    });

    return merged;
  }
};
