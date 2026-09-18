import {
  INITIAL_HOSPITALS,
  INITIAL_MASTER_MEDICINES,
  INITIAL_MEDICINES,
  INITIAL_STOCK_HISTORY,
  INITIAL_REQUESTS,
  INITIAL_TRACKING,
  INITIAL_PAYMENTS,
  INITIAL_DISPOSALS,
  INITIAL_FEEDBACKS,
  HOSPITAL_ANALYTICS,
  ADMIN_ANALYTICS
} from './mockData.js';

export const KEYS = {
  HOSPITALS: 'sms_hospitals',
  MASTER_MEDICINES: 'sms_master_medicines',
  MEDICINES: 'sms_medicines',
  REQUESTS: 'sms_requests',
  TRACKING: 'sms_tracking',
  PAYMENTS: 'sms_payments',
  DISPOSALS: 'sms_disposals',
  FEEDBACKS: 'sms_feedbacks',
  AUTH: 'sms_auth_session',
  ALERTS: 'sms_alerts',
  AUDIT_TRAIL: 'sms_audit_trail',
  SETTINGS: 'sms_admin_settings',
  STOCK_HISTORY: 'sms_stock_history',
  SALE_LISTINGS: 'sms_sale_listings',
};

// Initialize localStorage with mock data if not present, and seamlessly merge new mock data
export const initializeStorage = () => {
  // 1. Hospitals: initialize or migrate with comprehensive 24-hospital dataset & future-ready document models
  const HOSPITALS_DATASET_VERSION = 'medex_v3_cdsco_expansion';
  const storedVersion = localStorage.getItem('sms_hospital_dataset_version');
  const storedHospitals = localStorage.getItem(KEYS.HOSPITALS);

  if (!storedHospitals || storedVersion !== HOSPITALS_DATASET_VERSION) {
    let userCreatedHospitals = [];
    if (storedHospitals) {
      try {
        const parsed = JSON.parse(storedHospitals);
        const seedIds = new Set(INITIAL_HOSPITALS.map((h) => h.id));
        userCreatedHospitals = parsed.filter((h) => !seedIds.has(h.id));
      } catch (e) {
        userCreatedHospitals = [];
      }
    }

    const normalizedInit = INITIAL_HOSPITALS.map((hosp) => ({
      ...hosp,
      documents: (hosp.documents || []).map((doc, idx) => ({
        id: doc.id || `doc-${hosp.id}-${idx + 1}`,
        hospitalId: hosp.id,
        documentType: doc.documentType || doc.type || 'Registration Certificate',
        documentName: doc.documentName || doc.name || 'Document.pdf',
        fileName: doc.fileName || doc.documentName || doc.name || 'Document.pdf',
        fileReference: doc.fileReference || `/documents/${doc.documentName || doc.name || 'document.pdf'}`,
        name: doc.name || doc.documentName || 'Document.pdf',
        type: doc.type || doc.documentType || 'Registration Certificate',
        required: doc.required ?? true,
        status: doc.status || 'Submitted',
        submissionStatus: doc.submissionStatus || 'submitted',
        documentStatus: doc.documentStatus || (doc.verified ? 'verified' : (hosp.status === 'verified' ? 'verified' : (doc.rejectionReason ? 'rejected' : 'pending'))),
        uploadedAt: doc.uploadedAt || hosp.registeredDate || '2024-08-01',
        reviewedAt: doc.reviewedAt || (doc.verified ? hosp.verifiedDate || '2024-08-02' : null),
        rejectionReason: doc.rejectionReason || null,
        documentUrl: doc.documentUrl || `/documents/${doc.name || 'document.pdf'}`,
        size: doc.size || '2.4 MB',
        verified: doc.verified ?? (doc.documentStatus === 'verified'),
      })),
    }));

    localStorage.setItem(KEYS.HOSPITALS, JSON.stringify([...normalizedInit, ...userCreatedHospitals]));
    localStorage.setItem('sms_hospital_dataset_version', HOSPITALS_DATASET_VERSION);
  } else {
    try {
      let parsedHosp = JSON.parse(storedHospitals);
      const existingHospIds = new Set(parsedHosp.map((h) => h.id));
      const missingHosp = INITIAL_HOSPITALS.filter((h) => !existingHospIds.has(h.id));
      if (missingHosp.length > 0) {
        parsedHosp = [...parsedHosp, ...missingHosp];
      }
      
      const normalizedHosp = parsedHosp.map((hosp) => {
        const normalizedDocs = (hosp.documents || []).map((doc, idx) => {
          const docId = doc.id || `doc-${hosp.id}-${idx + 1}`;
          const docStatus = doc.documentStatus || (doc.verified ? 'verified' : (hosp.status === 'verified' ? 'verified' : (doc.rejectionReason ? 'rejected' : 'pending')));
          return {
            id: docId,
            hospitalId: hosp.id,
            documentType: doc.documentType || doc.type || 'Registration Certificate',
            documentName: doc.documentName || doc.name || 'Document.pdf',
            fileName: doc.fileName || doc.documentName || doc.name || 'Document.pdf',
            fileReference: doc.fileReference || `/documents/${doc.documentName || doc.name || 'document.pdf'}`,
            name: doc.name || doc.documentName || 'Document.pdf',
            type: doc.type || doc.documentType || 'Registration Certificate',
            required: doc.required ?? true,
            status: doc.status || 'Submitted',
            submissionStatus: doc.submissionStatus || 'submitted',
            documentStatus: docStatus,
            uploadedAt: doc.uploadedAt || hosp.registeredDate || '2024-08-01',
            reviewedAt: doc.reviewedAt || (docStatus === 'verified' ? hosp.verifiedDate || '2024-08-02' : null),
            rejectionReason: doc.rejectionReason || null,
            documentUrl: doc.documentUrl || `/documents/${doc.name || 'document.pdf'}`,
            size: doc.size || '2.4 MB',
            verified: docStatus === 'verified',
          };
        });
        return {
          ...hosp,
          documents: normalizedDocs,
        };
      });
      localStorage.setItem(KEYS.HOSPITALS, JSON.stringify(normalizedHosp));
    } catch (e) {
      console.error('Failed to migrate hospitals', e);
    }
  }

  // 1b. Master Medicines Catalogue: initialize or migrate with INITIAL_MASTER_MEDICINES
  const MASTER_DATASET_VERSION = 'medex_v3_cdsco_expansion';
  const storedMasterVersion = localStorage.getItem('sms_master_medicines_version');
  const storedMasterMeds = localStorage.getItem(KEYS.MASTER_MEDICINES);

  if (!storedMasterMeds || storedMasterVersion !== MASTER_DATASET_VERSION) {
    let userCreatedMaster = [];
    if (storedMasterMeds) {
      try {
        const parsed = JSON.parse(storedMasterMeds);
        const seedIds = new Set(INITIAL_MASTER_MEDICINES.map((m) => m.id));
        userCreatedMaster = parsed.filter((m) => !seedIds.has(m.id));
      } catch (e) {
        userCreatedMaster = [];
      }
    }
    localStorage.setItem(KEYS.MASTER_MEDICINES, JSON.stringify([...INITIAL_MASTER_MEDICINES, ...userCreatedMaster]));
    localStorage.setItem('sms_master_medicines_version', MASTER_DATASET_VERSION);
  }

  // 2. Medicines: initialize or merge missing & ensure complete medical inventory fields
  const MEDICINES_DATASET_VERSION = 'medex_v3_cdsco_expansion';
  const storedMedVersion = localStorage.getItem('sms_medicines_dataset_version');
  const storedMedicines = localStorage.getItem(KEYS.MEDICINES);

  if (!storedMedicines || storedMedVersion !== MEDICINES_DATASET_VERSION) {
    let userCreatedLots = [];
    if (storedMedicines) {
      try {
        const parsed = JSON.parse(storedMedicines);
        const seedIds = new Set(INITIAL_MEDICINES.map((m) => m.id));
        userCreatedLots = parsed.filter((m) => !seedIds.has(m.id));
      } catch (e) {
        userCreatedLots = [];
      }
    }
    localStorage.setItem(KEYS.MEDICINES, JSON.stringify([...INITIAL_MEDICINES, ...userCreatedLots]));
    localStorage.setItem('sms_medicines_dataset_version', MEDICINES_DATASET_VERSION);
  } else {
    try {
      let parsed = JSON.parse(storedMedicines);
      let modified = false;

      // Merge newly added mock medicines (such as Dolo 650 multi-batch records)
      const existingMedIds = new Set(parsed.map((m) => m.id));
      const missingMeds = INITIAL_MEDICINES.filter((m) => !existingMedIds.has(m.id));
      if (missingMeds.length > 0) {
        parsed = [...missingMeds, ...parsed];
        modified = true;
      }

      // Backfill missing fields (dosage, dosageForm, packing, unit, shelfLocation, mrp, concessionRate, costRate, packaging, total/reserved/available)
      const updated = parsed.map((m) => {
        let med = { ...m };
        const match = INITIAL_MEDICINES.find((init) => init.id === m.id);
        if (match) {
          if (!med.images && match.images) {
            med.images = match.images;
            modified = true;
          }
          if (!med.image && match.image) {
            med.image = match.image;
            modified = true;
          }
          if (!med.invoice && match.invoice) {
            med.invoice = match.invoice;
            modified = true;
          }
          if (!med.mfgDate && match.mfgDate) {
            med.mfgDate = match.mfgDate;
            modified = true;
          }
          if (!med.form && match.form) {
            med.form = match.form;
            modified = true;
          }
          if (med.minStockLevel === undefined && match.minStockLevel !== undefined) {
            med.minStockLevel = match.minStockLevel;
            modified = true;
          }
          if (!med.shelfLocation && match.shelfLocation) {
            med.shelfLocation = match.shelfLocation;
            modified = true;
          }
        }
        if (!med.form) {
          med.form = med.dosageForm || 'Tablet';
          modified = true;
        }
        if (!med.dosageForm) {
          med.dosageForm = med.form || 'Tablet';
          modified = true;
        }
        if (!med.dosage) {
          med.dosage = med.power || med.strength || match?.dosage || 'Standard formulation';
          modified = true;
        }
        if (!med.packing) {
          med.packing = med.packSize || match?.packing || '15 Tablets / Strip';
          modified = true;
        }
        if (!med.packSize) {
          med.packSize = med.packing || match?.packSize || '15 Tablets / Strip';
          modified = true;
        }
        if (!med.unitsPerPack) {
          med.unitsPerPack = match?.unitsPerPack || 15;
          modified = true;
        }
        if (med.numberOfPacks === undefined) {
          med.numberOfPacks = match?.numberOfPacks || Math.ceil((med.totalQuantity || med.quantity || 0) / (med.unitsPerPack || 15));
          modified = true;
        }
        if (med.totalUnits === undefined) {
          med.totalUnits = match?.totalUnits || Number(med.totalQuantity !== undefined ? med.totalQuantity : (med.quantity || 0));
          modified = true;
        }
        if (!med.unit) {
          med.unit = match?.unit || 'Tablet';
          modified = true;
        }
        if (!med.shelfLocation) {
          med.shelfLocation = match?.shelfLocation || 'Rack A - Shelf 3';
          modified = true;
        }
        if (med.minStockLevel === undefined) {
          med.minStockLevel = 20;
          modified = true;
        }
        if (med.reorderLevel === undefined) {
          med.reorderLevel = med.minStockLevel || 20;
          modified = true;
        }
        if (med.totalQuantity === undefined) {
          med.totalQuantity = Number(med.quantity ?? match?.totalQuantity ?? 0);
          modified = true;
        }
        if (med.reservedQuantity === undefined) {
          med.reservedQuantity = Number(match?.reservedQuantity ?? 0);
          modified = true;
        }
        if (med.availableQuantity === undefined) {
          med.availableQuantity = Math.max(0, (med.totalQuantity || med.quantity || 0) - (med.reservedQuantity || 0));
          modified = true;
        }
        if (med.mrp === undefined) {
          med.mrp = Number(med.unitOriginalPrice ?? match?.mrp ?? 100);
          modified = true;
        }
        if (med.concessionRate === undefined) {
          med.concessionRate = Number(med.unitFinalPrice ?? match?.concessionRate ?? Math.round((med.mrp || 100) * (1 - (med.concessionPercent || 10) / 100)));
          modified = true;
        }
        if (med.costRate === undefined) {
          med.costRate = Number(match?.costRate ?? Math.round((med.mrp || 100) * 0.85));
          modified = true;
        }
        if (med.acquisitionCost === undefined) {
          med.acquisitionCost = Number(match?.acquisitionCost ?? med.costRate ?? Math.round((med.mrp || 100) * 0.85));
          modified = true;
        }
        if (!med.mfgDate) {
          if (med.expiryDate) {
            const d = new Date(med.expiryDate);
            d.setFullYear(d.getFullYear() - 1);
            med.mfgDate = d.toISOString().split('T')[0];
          } else {
            med.mfgDate = '2023-11-15';
          }
          modified = true;
        }
        return med;
      });

      // Synchronize benchmark Dolo 650 records if present
      const doloBench = INITIAL_MEDICINES.find((m) => m.id === 'inv-dolo-hosp1-abc123');
      if (doloBench) {
        const doloIdx = updated.findIndex((m) => m.id === 'inv-dolo-hosp1-abc123');
        if (doloIdx !== -1) {
          updated[doloIdx] = { ...updated[doloIdx], ...doloBench };
          modified = true;
        }
      }

      if (modified) {
        localStorage.setItem(KEYS.MEDICINES, JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to migrate medicines mfgDate', e);
    }
  }

  // 3. Requests: initialize or merge missing & ensure expiryDate/requirementGroupId
  const REQUESTS_DATASET_VERSION = 'medex_v3_cdsco_expansion';
  const storedReqVersion = localStorage.getItem('sms_requests_dataset_version');
  const storedRequests = localStorage.getItem(KEYS.REQUESTS);

  if (!storedRequests || storedReqVersion !== REQUESTS_DATASET_VERSION) {
    let userCreatedReqs = [];
    if (storedRequests) {
      try {
        const parsed = JSON.parse(storedRequests);
        const seedIds = new Set(INITIAL_REQUESTS.map((r) => r.id));
        userCreatedReqs = parsed.filter((r) => !seedIds.has(r.id));
      } catch (e) {
        userCreatedReqs = [];
      }
    }
    localStorage.setItem(KEYS.REQUESTS, JSON.stringify([...INITIAL_REQUESTS, ...userCreatedReqs]));
    localStorage.setItem('sms_requests_dataset_version', REQUESTS_DATASET_VERSION);
  } else {
    try {
      let parsedReqs = JSON.parse(storedRequests);
      let modified = false;

      // Merge missing mock requests
      const existingReqIds = new Set(parsedReqs.map((r) => r.id));
      const missingReqs = INITIAL_REQUESTS.filter((r) => !existingReqIds.has(r.id));
      if (missingReqs.length > 0) {
        parsedReqs = [...parsedReqs, ...missingReqs];
        modified = true;
      }

      // Ensure all demo requests are present and updated with consistent values
      const demoReqs = INITIAL_REQUESTS.filter((r) => r.id?.startsWith('req-demo-'));
      demoReqs.forEach((demo) => {
        const existingIdx = parsedReqs.findIndex((r) => r.id === demo.id);
        if (existingIdx === -1) {
          parsedReqs.unshift(demo);
          modified = true;
        } else {
          // If stored demo request has inconsistent payment/order status, update to latest consistent mock state
          const stored = parsedReqs[existingIdx];
          if (
            stored.paymentStatus !== demo.paymentStatus || 
            (demo.status === 'paid' && stored.status !== 'paid' && stored.status === 'accepted')
          ) {
            parsedReqs[existingIdx] = {
              ...stored,
              status: demo.status,
              paymentStatus: demo.paymentStatus,
              paymentId: demo.paymentId || stored.paymentId,
              paidDate: demo.paidDate || stored.paidDate,
              paymentCompletedAt: demo.paymentCompletedAt || stored.paymentCompletedAt || demo.paidDate,
            };
            modified = true;
          }
        }
      });

      // Ensure the competing request test group exists if not present
      const hasCompeting = parsedReqs.some((r) => r.id === 'req-competing-1');
      if (!hasCompeting) {
        const competingSample = INITIAL_REQUESTS.filter((r) => r.id?.startsWith('req-competing'));
        if (competingSample.length > 0) {
          parsedReqs.unshift(...competingSample);
          modified = true;
        }
      }

      // Ensure benchmark completed purchase history orders ORD-1024 and ORD-1031 exist
      ['ORD-1024', 'ORD-1031'].forEach((ordId) => {
        const demo = INITIAL_REQUESTS.find((r) => r.id === ordId || r.orderId === ordId);
        if (demo) {
          const existingIdx = parsedReqs.findIndex((r) => r.id === ordId || r.orderId === ordId);
          if (existingIdx === -1) {
            parsedReqs.unshift(demo);
            modified = true;
          } else {
            parsedReqs[existingIdx] = { ...parsedReqs[existingIdx], ...demo };
            modified = true;
          }
        }
      });

      // Universal Order & Payment State Synchronization (Sections 3, 5, 6, 20)
      const updatedReqs = parsedReqs.map((req) => {
        let changed = false;
        const s = (req.status || 'pending').toLowerCase().trim();
        let ps = (req.paymentStatus || '').toLowerCase().trim();

        // 1. Normalize payment status aliases
        if (['success', 'successful', 'completed', 'settled'].includes(ps)) {
          ps = 'paid';
          req.paymentStatus = 'paid';
          changed = true;
        }

        // 2. Synchronize fulfillment orders with paid payment state
        if (['paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(s)) {
          if (req.paymentStatus !== 'paid') {
            req.paymentStatus = 'paid';
            changed = true;
          }
          if (!req.paidDate) {
            req.paidDate = req.requestDate || new Date().toISOString();
            changed = true;
          }
          if (!req.paymentCompletedAt) {
            req.paymentCompletedAt = req.paidDate;
            changed = true;
          }
        } else if (s === 'accepted' && ps !== 'failed' && ps !== 'paid') {
          if (req.paymentStatus !== 'pending') {
            req.paymentStatus = 'pending';
            changed = true;
          }
        }

        // 3. Ensure 48-hour expiryDate exists
        if (!req.expiryDate && req.requestDate) {
          const d = new Date(req.requestDate);
          req.expiryDate = new Date(d.getTime() + 48 * 3600 * 1000).toISOString();
          changed = true;
        }

        if (changed) modified = true;
        return req;
      });

      if (modified) {
        localStorage.setItem(KEYS.REQUESTS, JSON.stringify(updatedReqs));
      }
    } catch (e) {
      console.error('Failed to migrate requests', e);
    }
  }

  // 4. Tracking: initialize or merge missing by transactionId
  const storedTracking = localStorage.getItem(KEYS.TRACKING);
  if (!storedTracking) {
    localStorage.setItem(KEYS.TRACKING, JSON.stringify(INITIAL_TRACKING));
  } else {
    try {
      const parsedTracking = JSON.parse(storedTracking);
      const existingTxnIds = new Set(parsedTracking.map((t) => t.transactionId));
      const missingTracking = INITIAL_TRACKING.filter((t) => !existingTxnIds.has(t.transactionId));
      if (missingTracking.length > 0) {
        localStorage.setItem(KEYS.TRACKING, JSON.stringify([...parsedTracking, ...missingTracking]));
      }
    } catch (e) {
      console.error('Failed to migrate tracking', e);
    }
  }

  // 5. Payments: initialize or merge missing
  const storedPayments = localStorage.getItem(KEYS.PAYMENTS);
  if (!storedPayments) {
    localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
  } else {
    try {
      const parsedPayments = JSON.parse(storedPayments);
      const existingPaymentIds = new Set(parsedPayments.map((payment) => payment.id));
      const missingPayments = INITIAL_PAYMENTS.filter((payment) => !existingPaymentIds.has(payment.id));
      if (missingPayments.length > 0) {
        localStorage.setItem(KEYS.PAYMENTS, JSON.stringify([...parsedPayments, ...missingPayments]));
      }
    } catch (e) {
      console.error('Failed to migrate payment history', e);
    }
  }

  // 6. Disposals: initialize or merge missing & ensure hospitalId
  const storedDisposals = localStorage.getItem(KEYS.DISPOSALS);
  if (!storedDisposals) {
    localStorage.setItem(KEYS.DISPOSALS, JSON.stringify(INITIAL_DISPOSALS));
  } else {
    try {
      let parsedDisp = JSON.parse(storedDisposals);
      let modified = false;

      // Merge missing disposals
      const existingDispIds = new Set(parsedDisp.map((d) => d.id));
      const missingDisposals = INITIAL_DISPOSALS.filter((d) => !existingDispIds.has(d.id));
      if (missingDisposals.length > 0) {
        parsedDisp = [...parsedDisp, ...missingDisposals];
        modified = true;
      }

      const updatedDisp = parsedDisp.map((d) => {
        if (!d.hospitalId) {
          modified = true;
          const match = INITIAL_DISPOSALS.find((init) => init.id === d.id);
          return {
            ...d,
            hospitalId: match?.hospitalId || 'hosp-1',
            wasteCategory: match?.wasteCategory || d.wasteCategory || 'Expired Pharmaceuticals',
            treatmentMethod: match?.treatmentMethod || 'High-Temperature Double-Chamber Incineration',
            manifestNumber: match?.manifestNumber || 'MPCB-BMW-MNF-' + Math.floor(10000 + Math.random() * 90000),
          };
        }
        return d;
      });

      if (modified) {
        localStorage.setItem(KEYS.DISPOSALS, JSON.stringify(updatedDisp));
      }
    } catch (e) {
      console.error('Failed to migrate disposals', e);
    }
  }

  // 7. Feedbacks: initialize or merge missing
  const storedFeedbacks = localStorage.getItem(KEYS.FEEDBACKS);
  if (!storedFeedbacks) {
    localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify(INITIAL_FEEDBACKS));
  } else {
    try {
      const parsedFeedbacks = JSON.parse(storedFeedbacks);
      const existingFeedbackIds = new Set(parsedFeedbacks.map((f) => f.id));
      const missingFeedbacks = INITIAL_FEEDBACKS.filter((f) => !existingFeedbackIds.has(f.id));
      if (missingFeedbacks.length > 0) {
        localStorage.setItem(KEYS.FEEDBACKS, JSON.stringify([...parsedFeedbacks, ...missingFeedbacks]));
      }
    } catch (e) {
      console.error('Failed to migrate feedbacks', e);
    }
  }

  const storedStockHistory = localStorage.getItem(KEYS.STOCK_HISTORY);
  if (!storedStockHistory) {
    localStorage.setItem(KEYS.STOCK_HISTORY, JSON.stringify(INITIAL_STOCK_HISTORY));
  } else {
    try {
      const parsedHistory = JSON.parse(storedStockHistory);
      if (!Array.isArray(parsedHistory) || parsedHistory.length === 0) {
        localStorage.setItem(KEYS.STOCK_HISTORY, JSON.stringify(INITIAL_STOCK_HISTORY));
      } else {
        const existingIds = new Set(parsedHistory.map((h) => h.id));
        const missing = INITIAL_STOCK_HISTORY.filter((h) => !existingIds.has(h.id));
        if (missing.length > 0) {
          localStorage.setItem(KEYS.STOCK_HISTORY, JSON.stringify([...parsedHistory, ...missing]));
        }
      }
    } catch (e) {
      localStorage.setItem(KEYS.STOCK_HISTORY, JSON.stringify(INITIAL_STOCK_HISTORY));
    }
  }

  if (!localStorage.getItem(KEYS.ALERTS)) {
    localStorage.setItem(KEYS.ALERTS, JSON.stringify({}));
  }
  if (!localStorage.getItem(KEYS.SETTINGS)) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify({
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
    }));
  }
  if (!localStorage.getItem(KEYS.AUDIT_TRAIL) || JSON.parse(localStorage.getItem(KEYS.AUDIT_TRAIL) || '[]').length === 0) {
    const seedAudit = [
      {
        id: 'audit-seed-1',
        timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
        action: 'HOSPITAL_APPROVED',
        entityType: 'Hospitals',
        module: 'Hospitals',
        adminName: 'Super Administrator',
        adminUser: 'Super Administrator',
        description: 'Admin approved City Care Hospital',
        summary: 'Admin approved City Care Hospital',
        status: 'Verified',
        hospitalName: 'City Care Hospital',
      },
      {
        id: 'audit-seed-2',
        timestamp: new Date(Date.now() - 110 * 60000).toISOString(),
        action: 'MEDICINE_ADDED',
        entityType: 'Medicines',
        module: 'Medicines',
        adminName: 'Super Administrator',
        adminUser: 'Super Administrator',
        description: 'Admin added Paracetamol (Batch #PCM-2024-91)',
        summary: 'Admin added Paracetamol',
        status: 'Active',
        hospitalName: 'Apollo Hospital',
      },
      {
        id: 'audit-seed-3',
        timestamp: new Date(Date.now() - 240 * 60000).toISOString(),
        action: 'ORDER_STATUS_UPDATED',
        entityType: 'Orders',
        module: 'Orders',
        adminName: 'Super Administrator',
        adminUser: 'Super Administrator',
        description: 'Admin updated Order #MED1024',
        summary: 'Admin updated Order #MED1024 to Shipped',
        status: 'Shipped',
        hospitalName: 'Fortis Memorial Research Institute',
      },
      {
        id: 'audit-seed-4',
        timestamp: new Date(Date.now() - 360 * 60000).toISOString(),
        action: 'FEEDBACK_RESOLVED',
        entityType: 'Feedback',
        module: 'Feedback',
        adminName: 'Super Administrator',
        adminUser: 'Super Administrator',
        description: 'Admin resolved hospital feedback from Apollo Hospital',
        summary: 'Admin resolved hospital feedback',
        status: 'Resolved',
        hospitalName: 'Apollo Hospital',
      },
      {
        id: 'audit-seed-5',
        timestamp: new Date(Date.now() - 520 * 60000).toISOString(),
        action: 'HOSPITAL_SUSPENDED',
        entityType: 'Hospitals',
        module: 'Hospitals',
        adminName: 'Super Administrator',
        adminUser: 'Super Administrator',
        description: 'Admin suspended a hospital account for regulatory compliance review',
        summary: 'Admin suspended a hospital account',
        status: 'Suspended',
        hospitalName: 'Metro General Hospital',
      }
    ];
    localStorage.setItem(KEYS.AUDIT_TRAIL, JSON.stringify(seedAudit));
  }
};

/**
 * Defensively retrieves and validates stored JSON data from localStorage.
 * Automatically recovers from corrupted data, wrong types, or syntax errors.
 */
export const getStoredItem = (key, fallback = []) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;

    const parsed = JSON.parse(item);

    // Schema & type validation to prevent downstream runtime exceptions
    if (Array.isArray(fallback)) {
      if (!Array.isArray(parsed)) {
        // Corrupted shape: expected array but found non-array. Heal storage.
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return parsed;
    }

    if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        // Corrupted shape: expected object but found invalid type. Heal storage.
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return parsed;
    }

    // Special validation for authentication session
    if (key === KEYS.AUTH) {
      if (!parsed || typeof parsed !== 'object') {
        localStorage.removeItem(KEYS.AUTH);
        return null;
      }
      const { user, token } = parsed;
      if (!user || typeof user !== 'object' || typeof token !== 'string' || !token.trim()) {
        localStorage.removeItem(KEYS.AUTH);
        return null;
      }
      if (!['admin', 'hospital'].includes(user.role)) {
        localStorage.removeItem(KEYS.AUTH);
        return null;
      }
      // Guarantee no password or raw secrets in user object
      if (user.password) {
        delete user.password;
      }
      return parsed;
    }

    return parsed;
  } catch {
    // Gracefully handle JSON parse error or storage access violation without crashing
    try {
      if (fallback !== undefined) {
        localStorage.setItem(key, JSON.stringify(fallback));
      }
    } catch {
      // Ignore write errors in restricted/private modes
    }
    return fallback;
  }
};

/**
 * Defensively serializes and persists an item to localStorage.
 * Sanitizes sensitive fields before writing and handles QuotaExceeded errors safely.
 */
export const setStoredItem = (key, value) => {
  try {
    // Strip sensitive fields if writing auth session
    let safeValue = value;
    if (key === KEYS.AUTH && value && typeof value === 'object') {
      const userCopy = value.user ? { ...value.user } : {};
      delete userCopy.password;
      delete userCopy.confirmPassword;
      delete userCopy.secret;
      safeValue = {
        ...value,
        user: userCopy,
        _isDemoSession: true,
        _disclaimer: 'DEMO AUTHENTICATION ONLY - Authoritative backend auth required for production',
      };
    }

    localStorage.setItem(key, JSON.stringify(safeValue));
  } catch (e) {
    // Handle QuotaExceededError or private browsing restrictions
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Clean up excess audit trail or non-essential cache if full
      try {
        const trail = JSON.parse(localStorage.getItem(KEYS.AUDIT_TRAIL) || '[]');
        if (trail.length > 50) {
          localStorage.setItem(KEYS.AUDIT_TRAIL, JSON.stringify(trail.slice(0, 50)));
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // Fallback silently without breaking UI
      }
    }
  }
};

export const isHospitalSuspended = (hospitalId) => {
  const hospitals = getStoredItem(KEYS.HOSPITALS, []);
  return hospitals.some((hospital) => hospital.id === hospitalId && hospital.status?.toLowerCase() === 'suspended');
};

export const getLiveHospitalRecord = (hospitalId) => {
  if (!hospitalId) return null;
  const hospitals = getStoredItem(KEYS.HOSPITALS, []);
  return hospitals.find((h) => h.id === hospitalId || h.email?.toLowerCase() === hospitalId?.toLowerCase()) || null;
};

/**
 * Authoritative helper for retrieving the currently authenticated hospital identity.
 * Enforces strict tenant isolation: Hospital portal components must only use this identity.
 */
export const getAuthenticatedHospital = () => {
  const session = getStoredItem(KEYS.AUTH, null);
  if (!session?.user || session.user.role !== 'hospital') {
    return null;
  }
  const hospitalId = session.user.hospitalId || session.user.id;
  const liveRecord = getLiveHospitalRecord(hospitalId);
  return liveRecord ? { ...session.user, ...liveRecord } : session.user;
};

export const isHospitalOperational = (hospitalId) => {
  if (!hospitalId) return false;
  const hospitals = getStoredItem(KEYS.HOSPITALS, []);
  const hosp = hospitals.find((h) => h.id === hospitalId || h.email?.toLowerCase() === hospitalId?.toLowerCase());
  return hosp ? hosp.status === 'verified' : false;
};

export const MANDATORY_DOCUMENTS = [
  {
    type: 'Registration Certificate',
    label: 'Hospital Registration Certificate',
    description: 'Clinical Establishment Act or State Health Authority Registration',
    required: true,
  },
  {
    type: 'Drug License',
    label: 'Pharmacy Drug License (Form 20B/21B)',
    description: 'State Drug Controller Form 20B/21B retail & wholesale permit',
    required: true,
  },
  {
    type: 'GST Certificate',
    label: 'GSTIN Registration Document',
    description: 'Valid Central/State GST compliance registration document',
    required: true,
  },
  {
    type: 'Authorization Letter',
    label: 'Director / Board Authorization Letter',
    description: 'Official Board resolution designating authorized pharmacy signatory',
    required: true,
  },
];

export const getHospitalDocumentChecklist = (hospitalDocuments = []) => {
  const docs = hospitalDocuments || [];

  const checklist = MANDATORY_DOCUMENTS.map((req) => {
    const match = docs.find((d) => {
      const dType = (d.documentType || d.type || '').toLowerCase();
      const dName = (d.documentName || d.name || '').toLowerCase();

      if (req.type === 'Registration Certificate') {
        return (
          dType.includes('registration') ||
          dType.includes('establishment') ||
          dType.includes('accreditation') ||
          dType.includes('charter') ||
          dName.includes('reg')
        );
      }
      if (req.type === 'Drug License') {
        return (
          dType.includes('drug') ||
          dType.includes('license') ||
          dType.includes('form20') ||
          dType.includes('form21') ||
          dName.includes('lic') ||
          dName.includes('drug')
        );
      }
      if (req.type === 'GST Certificate') {
        return dType.includes('gst') || dName.includes('gst');
      }
      if (req.type === 'Authorization Letter') {
        return (
          dType.includes('authoriz') ||
          dType.includes('resolution') ||
          dType.includes('attorney') ||
          dName.includes('authoriz') ||
          dName.includes('resolution')
        );
      }
      return dType.includes(req.type.toLowerCase()) || dName.includes(req.type.toLowerCase());
    });

    if (match) {
      return {
        id: match.id || `doc-${req.type.toLowerCase().replace(/\s+/g, '-')}`,
        documentType: req.type,
        label: req.label,
        documentName: match.documentName || match.name,
        name: match.name || match.documentName,
        size: match.size || '2.4 MB',
        uploadedAt: match.uploadedAt || '2024-01-15',
        documentUrl: match.documentUrl || `/documents/${match.name || 'document.pdf'}`,
        status: 'Submitted',
        submissionStatus: 'submitted',
        required: true,
        isSubmitted: true,
      };
    }

    return {
      id: `missing-${req.type.toLowerCase().replace(/\s+/g, '-')}`,
      documentType: req.type,
      label: req.label,
      documentName: req.label,
      name: req.label,
      size: null,
      uploadedAt: null,
      documentUrl: null,
      status: 'Missing',
      submissionStatus: 'missing',
      required: true,
      isSubmitted: false,
    };
  });

  const matchedDocNames = new Set(
    checklist.filter((c) => c.isSubmitted).map((c) => c.documentName)
  );
  const additionalDocs = docs
    .filter((d) => !matchedDocNames.has(d.documentName || d.name))
    .map((d, idx) => ({
      id: d.id || `doc-extra-${idx}`,
      documentType: d.documentType || d.type || 'Supporting Document',
      label: d.documentType || d.type || 'Supporting Document',
      documentName: d.documentName || d.name,
      name: d.name || d.documentName,
      size: d.size || '2.0 MB',
      uploadedAt: d.uploadedAt || '2024-01-15',
      documentUrl: d.documentUrl || `/documents/${d.name || 'document.pdf'}`,
      status: 'Submitted',
      submissionStatus: 'submitted',
      required: false,
      isSubmitted: true,
    }));

  const allItems = [...checklist, ...additionalDocs];
  const missingItems = checklist.filter((c) => !c.isSubmitted);
  const isComplete = missingItems.length === 0;

  return {
    items: allItems,
    checklist,
    additionalDocs,
    missingItems,
    isComplete,
    submittedCount: allItems.filter((i) => i.isSubmitted).length,
    totalRequired: MANDATORY_DOCUMENTS.length,
  };
};

/**
 * Retrieves all sale listings, optionally filtered by seller hospital ID.
 */
export const getSaleListings = (hospitalId = null) => {
  const listings = getStoredItem(KEYS.SALE_LISTINGS, []);
  if (!hospitalId) return listings;
  return listings.filter((l) => l.hospitalId === hospitalId || l.sellerHospitalId === hospitalId);
};

/**
 * Saves a new sale listing to localStorage.
 */
export const saveSaleListing = (listingData) => {
  const listings = getStoredItem(KEYS.SALE_LISTINGS, []);
  const newListing = {
    id: listingData.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...listingData,
    status: listingData.status || 'active',
    createdAt: listingData.createdAt || new Date().toISOString(),
    timestamp: listingData.timestamp || new Date().toISOString(),
  };
  listings.unshift(newListing);
  setStoredItem(KEYS.SALE_LISTINGS, listings);
  return newListing;
};

/**
 * Updates an existing sale listing in localStorage.
 */
export const updateSaleListing = (id, updates) => {
  const listings = getStoredItem(KEYS.SALE_LISTINGS, []);
  const index = listings.findIndex((l) => l.id === id);
  if (index === -1) return null;
  listings[index] = {
    ...listings[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setStoredItem(KEYS.SALE_LISTINGS, listings);
  return listings[index];
};

