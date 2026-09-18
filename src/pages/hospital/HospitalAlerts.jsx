import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  RefreshCw,
  ExternalLink,
  Package,
  Hospital,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Inbox,
  Boxes,
  CheckCheck,
  Activity,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PortalHistoryNavigation } from '../../components/common/PortalHistoryNavigation';
import { getStoredItem, setStoredItem, KEYS } from '../../services/storage';
import {
  calculateMedicineExpiry,
  calculateRequestExpiry,
  processExpiredRequests,
  EXPIRY_THRESHOLDS
} from '../../utils/expiryUtils';
import {
  getConcessionPercent,
  isExpiryAcceptable,
  DAYS_PER_MONTH
} from '../../config/nearExpiryPolicy';
import { formatDate } from '../../utils/formatters';

export const HospitalAlerts = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Strict Tenant Isolation: hospital accounts only access their own data
  const session = getStoredItem(KEYS.AUTH, null);
  const currentHospitalId = user?.hospitalId || user?.id || session?.user?.hospitalId || session?.user?.id;

  // Primary Alert Center: 'INVENTORY' | 'REQUESTS'
  const [activeCenter, setActiveCenter] = useState('INVENTORY');

  // Sub-filters for My Inventory Alerts
  // 'ALL' | 'CRITICAL' | 'EXPIRING_SOON' | 'EXPIRED' | 'LOW_STOCK'
  const [inventoryFilter, setInventoryFilter] = useState('ALL');

  // Sub-filters for Incoming Requests
  // 'PENDING' (default: active actionable) | 'ALL' | 'EXPIRING_SOON' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  const [requestFilter, setRequestFilter] = useState('PENDING');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Local data states
  const [medicines, setMedicines] = useState([]);
  const [requests, setRequests] = useState([]);
  const [hospitalsMap, setHospitalsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Load and dynamically evaluate real existing inventory & request data
   */
  const loadAlertData = useCallback(() => {
    if (!currentHospitalId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Resolve Hospitals Map for Requester Names
      const storedHospitals = getStoredItem(KEYS.HOSPITALS, []);
      const hMap = {};
      if (Array.isArray(storedHospitals)) {
        storedHospitals.forEach((h) => {
          if (h?.id) hMap[h.id] = h;
        });
      }
      setHospitalsMap(hMap);

      // 2. Strict Tenant Isolation: Only medicines belonging to THIS authenticated hospital
      const allMedicines = getStoredItem(KEYS.MEDICINES, []);
      const myMedicines = Array.isArray(allMedicines)
        ? allMedicines.filter((m) => m.hospitalId === currentHospitalId)
        : [];
      setMedicines(myMedicines);

      // 3. Strict 48-Hour SLA Expiration: Process requests before loading
      const allRequests = getStoredItem(KEYS.REQUESTS, []);
      const { requests: refreshedRequests, hasExpiredChanges } = processExpiredRequests(allRequests);
      if (hasExpiredChanges) {
        setStoredItem(KEYS.REQUESTS, refreshedRequests);
      }

      // 4. Strict Tenant Isolation: Only requests directed TO THIS hospital from others
      const myIncomingRequests = Array.isArray(refreshedRequests)
        ? refreshedRequests.filter((r) => r.toHospitalId === currentHospitalId)
        : [];
      setRequests(myIncomingRequests);
    } catch (err) {
      console.error('Error evaluating hospital alerts:', err);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [currentHospitalId]);

  useEffect(() => {
    loadAlertData();

    // Listen to realtime alert and requisition events
    const handleSync = () => loadAlertData();
    window.addEventListener('medex-alert-event', handleSync);
    window.addEventListener('medex-requisition-updated', handleSync);

    return () => {
      window.removeEventListener('medex-alert-event', handleSync);
      window.removeEventListener('medex-requisition-updated', handleSync);
    };
  }, [loadAlertData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 400));
    loadAlertData();
    setIsRefreshing(false);
    toast.success('Alerts refreshed');
  };

  /* ==========================================================================
     1. MY INVENTORY ALERTS LOGIC (CENTRALIZED POLICY)
     ========================================================================== */
  const inventoryAlerts = useMemo(() => {
    if (!medicines || medicines.length === 0) return [];

    const list = [];

    medicines.forEach((med) => {
      const expDate = med.expiryDate;
      const mfgDate = med.mfgDate;
      const qty = Number(med.quantity ?? med.usableStock ?? 0);
      const medName = med.brandName || med.medicineName || med.name || 'Medicine Lot';
      const batchNo = med.batchNo || med.batch || 'N/A';
      const exp = calculateMedicineExpiry(expDate, mfgDate, qty);

      // Policy concession calculation (single source of truth)
      const concessionPercent = getConcessionPercent(expDate);

      // Categorization per Near-Expiry Policy & Alert requirements:
      // Category A: EXPIRED (diff <= 0)
      if (exp.isExpired) {
        list.push({
          id: `inv-exp-${med.id}`,
          inventoryLotId: med.id,
          medicineName: medName,
          batchNo,
          quantity: qty,
          expiryDate: expDate,
          formattedExpiryDate: formatDate(expDate),
          daysRemaining: exp.daysRemaining,
          remainingShelfLife: `${Math.abs(exp.daysRemaining)} days past statutory expiry`,
          alertCategory: 'EXPIRED',
          severity: 'CRITICAL',
          badgeText: 'EXPIRED STOCK',
          badgeColor: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
          explanation: `${medName} — expired ${Math.abs(exp.daysRemaining)} days ago. Batch ${batchNo} has ${qty} units remaining. Immediate quarantine and disposal required.`,
          actionRelevant: 'Inspect Quarantine',
          actionLink: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(batchNo)}`,
          priorityOrder: 2,
        });
      }
      // Category B: CRITICAL EXPIRED / <= 1 MONTH (diff <= 30 days)
      else if (exp.isCritical) {
        list.push({
          id: `inv-crit-${med.id}`,
          inventoryLotId: med.id,
          medicineName: medName,
          batchNo,
          quantity: qty,
          expiryDate: expDate,
          formattedExpiryDate: formatDate(expDate),
          daysRemaining: exp.daysRemaining,
          remainingShelfLife: `${exp.daysRemaining} days remaining`,
          alertCategory: 'CRITICAL',
          severity: 'CRITICAL',
          badgeText: 'CRITICAL EXIRY (≤1M)',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
          concessionBadge: 'Rejection Window (Unacceptable)',
          explanation: `${medName} — expires in ${exp.daysRemaining} days. Batch ${batchNo} has ${qty} units remaining. Stock is within the ≤1 month rejection window and cannot be listed or transferred.`,
          actionRelevant: 'View Inventory',
          actionLink: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(batchNo)}`,
          priorityOrder: 1,
        });
      }
      // Category C: EXPIRING SOON (diff > 30 and <= 90 days, or policy schedule concession)
      else if (exp.isNearExpiry) {
        const concessionText = concessionPercent > 0
          ? `${concessionPercent}% Concession Active`
          : 'Near Expiry';

        list.push({
          id: `inv-near-${med.id}`,
          inventoryLotId: med.id,
          medicineName: medName,
          batchNo,
          quantity: qty,
          expiryDate: expDate,
          formattedExpiryDate: formatDate(expDate),
          daysRemaining: exp.daysRemaining,
          remainingShelfLife: `${exp.daysRemaining} days (${exp.monthsRemaining} months) remaining`,
          alertCategory: 'EXPIRING_SOON',
          severity: 'WARNING',
          badgeText: 'EXPIRING SOON',
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
          concessionBadge: concessionText,
          explanation: `${medName} — expires in ${exp.daysRemaining} days. Batch ${batchNo} has ${qty} units remaining. Shelf-life concession active to prioritize redistribution to partner hospitals.`,
          actionRelevant: 'View in Inventory',
          actionLink: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(batchNo)}`,
          priorityOrder: 3,
        });
      }

      // Category D: LOW STOCK (qty <= 25 units and not expired)
      if (exp.isLowStock && !exp.isExpired) {
        list.push({
          id: `inv-low-${med.id}`,
          inventoryLotId: med.id,
          medicineName: medName,
          batchNo,
          quantity: qty,
          expiryDate: expDate,
          formattedExpiryDate: formatDate(expDate),
          daysRemaining: exp.daysRemaining,
          remainingShelfLife: `${exp.daysRemaining} days shelf life`,
          alertCategory: 'LOW_STOCK',
          severity: 'ACTION',
          badgeText: 'LOW STOCK',
          badgeColor: 'bg-orange-50 text-orange-700 border-orange-200 font-medium',
          explanation: `Batch ${batchNo} reserve is ${qty} units (below safety threshold of ${EXPIRY_THRESHOLDS.LOW_STOCK_MIN_UNITS}). Replenish from peer hospitals.`,
          actionRelevant: 'Replenish / View',
          actionLink: `/hospital/inventory?inventoryLotId=${encodeURIComponent(med.id)}&batchNo=${encodeURIComponent(batchNo)}`,
          priorityOrder: 4,
        });
      }
    });

    // Alert Priority: Critical (≤1M) -> Expired -> Expiring Soon -> Low Stock
    return list.sort((a, b) => {
      if (a.priorityOrder !== b.priorityOrder) return a.priorityOrder - b.priorityOrder;
      return a.daysRemaining - b.daysRemaining;
    });
  }, [medicines]);

  // Dynamic counts for My Inventory
  const inventoryCounts = useMemo(() => {
    let critical = 0;
    let expiringSoon = 0;
    let expired = 0;
    let lowStock = 0;

    inventoryAlerts.forEach((a) => {
      if (a.alertCategory === 'CRITICAL') critical++;
      else if (a.alertCategory === 'EXPIRING_SOON') expiringSoon++;
      else if (a.alertCategory === 'EXPIRED') expired++;
      else if (a.alertCategory === 'LOW_STOCK') lowStock++;
    });

    return {
      all: inventoryAlerts.length,
      critical,
      expiringSoon,
      expired,
      lowStock,
    };
  }, [inventoryAlerts]);

  // Filtered My Inventory Alerts based on selected sub-filter and search
  const filteredInventoryAlerts = useMemo(() => {
    return inventoryAlerts.filter((item) => {
      // Sub-filter
      if (inventoryFilter === 'CRITICAL' && item.alertCategory !== 'CRITICAL') return false;
      if (inventoryFilter === 'EXPIRING_SOON' && item.alertCategory !== 'EXPIRING_SOON') return false;
      if (inventoryFilter === 'EXPIRED' && item.alertCategory !== 'EXPIRED') return false;
      if (inventoryFilter === 'LOW_STOCK' && item.alertCategory !== 'LOW_STOCK') return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const mName = (item.medicineName || '').toLowerCase();
        const bNo = (item.batchNo || '').toLowerCase();
        const expl = (item.explanation || '').toLowerCase();
        return mName.includes(q) || bNo.includes(q) || expl.includes(q);
      }
      return true;
    });
  }, [inventoryAlerts, inventoryFilter, searchQuery]);

  /* ==========================================================================
     2. INCOMING REQUESTS LOGIC (48-HOUR SLA & STATUS AUDIT)
     ========================================================================== */
  const incomingRequestAlerts = useMemo(() => {
    if (!requests || requests.length === 0) return [];

    return requests.map((req) => {
      const rawStatus = (req.status || 'pending').toLowerCase();
      const reqDateStr = req.requestDate || req.createdAt || req.requestedDate || new Date().toISOString();
      const sla = calculateRequestExpiry(reqDateStr, EXPIRY_THRESHOLDS.REQUEST_SLA_HOURS);

      // Terminal state determination
      const isAccepted = rawStatus === 'accepted' || rawStatus === 'approved';
      const isRejected = rawStatus === 'rejected' || rawStatus === 'declined' || rawStatus === 'cancelled';
      const isExpired = rawStatus === 'expired' || sla.isExpired;

      // Active actionable status: ONLY pending requests within the 48h SLA
      const isActionable = !isAccepted && !isRejected && !isExpired;

      // Expiring soon: pending requests with <= 12 hours remaining on 48h SLA
      const isExpiringSoon = isActionable && sla.hoursRemaining <= 12 && !sla.isExpired;

      // Normalized status for UI
      let normalizedStatus = 'Pending';
      if (isAccepted) normalizedStatus = 'Accepted';
      else if (isRejected) normalizedStatus = 'Rejected';
      else if (isExpired) normalizedStatus = 'Expired';

      // Requesting Hospital Name resolution
      const hosp = hospitalsMap[req.fromHospitalId] || {};
      const requestingHospital = req.fromHospitalName || hosp.name || req.requesterHospital || 'Peer Hospital';

      // Medicine details
      const medicineName = req.medicineName || req.brandName || 'Medicine Lot';
      const quantity = Number(req.quantity || 0);
      const unit = req.unit || 'units';

      // Formatted request creation time
      let formattedRequestedAt = 'Recently';
      try {
        const d = new Date(reqDateStr);
        if (!isNaN(d.getTime())) {
          formattedRequestedAt = `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }
      } catch (e) {}

      // SLA Countdown Label
      let slaCountdownLabel = '';
      let slaColor = 'text-slate-600 bg-slate-100 border-slate-200';
      if (isExpired) {
        slaCountdownLabel = 'Request expired';
        slaColor = 'text-slate-500 bg-slate-100 border-slate-200';
      } else if (isExpiringSoon) {
        slaCountdownLabel = `Expires in ${sla.formattedTimeLeft} (Urgent)`;
        slaColor = 'text-amber-700 bg-amber-50 border-amber-300 font-semibold animate-pulse';
      } else {
        slaCountdownLabel = `Expires in ${sla.formattedTimeLeft}`;
        slaColor = 'text-sky-700 bg-sky-50 border-sky-200 font-medium';
      }

      // Priority ordering for sorting:
      // 1. Actionable & Expiring Soon (urgent)
      // 2. Actionable Pending
      // 3. Non-actionable history (expired -> accepted -> rejected)
      let priorityOrder = 2;
      if (isExpiringSoon) priorityOrder = 1;
      else if (isActionable) priorityOrder = 2;
      else if (isExpired) priorityOrder = 3;
      else if (isAccepted) priorityOrder = 4;
      else priorityOrder = 5;

      return {
        id: req.id,
        requestId: req.id,
        orderId: req.orderId || req.id,
        requestingHospital,
        requestingHospitalCode: hosp.code || (req.fromHospitalId ? req.fromHospitalId.toUpperCase() : 'HOSP'),
        medicineName,
        genericName: req.genericName || '',
        quantity,
        unit,
        requestDate: reqDateStr,
        formattedRequestedAt,
        sla,
        slaCountdownLabel,
        slaColor,
        status: normalizedStatus,
        rawStatus,
        isActionable,
        isExpiringSoon,
        isAccepted,
        isRejected,
        isExpired,
        priorityOrder,
        actionLink: `/hospital/incoming-requests?requestId=${encodeURIComponent(req.id)}`,
      };
    }).sort((a, b) => {
      if (a.priorityOrder !== b.priorityOrder) return a.priorityOrder - b.priorityOrder;
      // For pending requests, sort by fewest hours remaining (closest to deadline first)
      if (a.isActionable && b.isActionable) {
        return (a.sla?.hoursRemaining * 60 + a.sla?.minutesRemaining) - (b.sla?.hoursRemaining * 60 + b.sla?.minutesRemaining);
      }
      return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
    });
  }, [requests, hospitalsMap]);

  // Dynamic counts for Incoming Requests
  const requestCounts = useMemo(() => {
    let pending = 0;
    let expiringSoon = 0;
    let expired = 0;
    let accepted = 0;
    let rejected = 0;

    incomingRequestAlerts.forEach((r) => {
      if (r.isActionable) {
        pending++;
        if (r.isExpiringSoon) expiringSoon++;
      }
      if (r.isExpired) expired++;
      if (r.isAccepted) accepted++;
      if (r.isRejected) rejected++;
    });

    return {
      all: incomingRequestAlerts.length,
      pending,
      expiringSoon,
      expired,
      accepted,
      rejected,
    };
  }, [incomingRequestAlerts]);

  // Filtered Incoming Requests based on selected sub-filter and search
  const filteredIncomingRequests = useMemo(() => {
    return incomingRequestAlerts.filter((item) => {
      // Sub-filter:
      // 'PENDING' -> ONLY active actionable requests! Accepted, rejected, and expired requests MUST NOT appear here.
      if (requestFilter === 'PENDING') {
        if (!item.isActionable) return false;
      } else if (requestFilter === 'EXPIRING_SOON') {
        if (!item.isExpiringSoon) return false;
      } else if (requestFilter === 'ACCEPTED') {
        if (!item.isAccepted) return false;
      } else if (requestFilter === 'REJECTED') {
        if (!item.isRejected) return false;
      } else if (requestFilter === 'EXPIRED') {
        if (!item.isExpired) return false;
      }
      // 'ALL' shows all, with non-actionables clearly labeled

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hName = (item.requestingHospital || '').toLowerCase();
        const mName = (item.medicineName || '').toLowerCase();
        const rId = (item.requestId || '').toLowerCase();
        return hName.includes(q) || mName.includes(q) || rId.includes(q);
      }

      return true;
    });
  }, [incomingRequestAlerts, requestFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header & Breadcrumbs / Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PortalHistoryNavigation portal="hospital" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Alerts</h1>
            <p className="text-sm text-slate-500 font-medium">
              Stay informed about inventory risks and medicine requests.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* =========================================================================
          TWO PRIMARY ALERT CATEGORIES (TOP LARGE SELECTABLE CARDS)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: MY INVENTORY ALERTS */}
        <button
          type="button"
          id="tab-my-inventory-alerts"
          onClick={() => {
            setActiveCenter('INVENTORY');
            setSearchQuery('');
          }}
          className={`relative p-5 sm:p-6 rounded-2xl text-left transition-all duration-200 border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            activeCenter === 'INVENTORY'
              ? 'bg-white text-slate-900 border-teal-600 ring-2 ring-teal-600/20 shadow-md shadow-teal-900/5'
              : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
          }`}
        >
          {/* Top Row: Icon + Eyebrow & Active Badge */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  activeCenter === 'INVENTORY'
                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <Package className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  activeCenter === 'INVENTORY' ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                Internal Stock Telemetry
              </span>
            </div>

            {activeCenter === 'INVENTORY' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-300 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
                Active Center
              </span>
            )}
          </div>

          {/* Main Title */}
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-3">
            MY INVENTORY ALERTS
          </h2>

          {/* Description */}
          <p
            className={`mt-1.5 text-xs leading-relaxed ${
              activeCenter === 'INVENTORY' ? 'text-slate-600' : 'text-slate-500'
            }`}
          >
            Real-time shelf-life tracking, statutory expiry compliance, and buffer depletion warnings for your hospital's stock.
          </p>

          {/* Compact Counts Summary */}
          <div
            className={`mt-4 pt-3.5 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${
              activeCenter === 'INVENTORY'
                ? 'border-slate-200 text-slate-700'
                : 'border-slate-100 text-slate-600'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <strong className="text-rose-700 font-bold">{inventoryCounts.critical}</strong> Critical (≤1M)
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <strong className="text-amber-700 font-bold">{inventoryCounts.expiringSoon}</strong> Expiring Soon
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <strong className="text-slate-700 font-bold">{inventoryCounts.expired}</strong> Expired
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
              <strong className="text-orange-700 font-bold">{inventoryCounts.lowStock}</strong> Low Stock
            </span>
          </div>
        </button>

        {/* Card 2: INCOMING REQUESTS */}
        <button
          type="button"
          id="tab-incoming-requests"
          onClick={() => {
            setActiveCenter('REQUESTS');
            setSearchQuery('');
          }}
          className={`relative p-5 sm:p-6 rounded-2xl text-left transition-all duration-200 border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            activeCenter === 'REQUESTS'
              ? 'bg-white text-slate-900 border-sky-600 ring-2 ring-sky-600/20 shadow-md shadow-sky-900/5'
              : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
          }`}
        >
          {/* Top Row: Icon + Eyebrow & Active Badge */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  activeCenter === 'REQUESTS'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <Hospital className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  activeCenter === 'REQUESTS' ? 'text-sky-700' : 'text-slate-500'
                }`}
              >
                Inter-Hospital Requests
              </span>
            </div>

            {activeCenter === 'REQUESTS' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-300 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
                Active Center
              </span>
            )}
          </div>

          {/* Main Title */}
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-3">
            INCOMING REQUESTS
          </h2>

          {/* Description */}
          <p
            className={`mt-1.5 text-xs leading-relaxed ${
              activeCenter === 'REQUESTS' ? 'text-slate-600' : 'text-slate-500'
            }`}
          >
            Medicine requests submitted by peer hospitals to your facility. Actionable for strictly 48 hours before automated SLA expiration.
          </p>

          {/* Compact Counts Summary */}
          <div
            className={`mt-4 pt-3.5 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${
              activeCenter === 'REQUESTS'
                ? 'border-slate-200 text-slate-700'
                : 'border-slate-100 text-slate-600'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <strong className="text-emerald-700 font-bold">{requestCounts.pending}</strong> New Pending
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <strong className="text-amber-700 font-bold">{requestCounts.expiringSoon}</strong> Expiring Soon (≤12h)
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <strong className="text-slate-700 font-bold">{requestCounts.expired}</strong> Expired
            </span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          CONTROLS: SUB-FILTERS & SEARCH BAR
         ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Sub-Filters: My Inventory Alerts */}
          {activeCenter === 'INVENTORY' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInventoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inventoryFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Alerts ({inventoryCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('CRITICAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inventoryFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                Critical ≤1 Month ({inventoryCounts.critical})
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('EXPIRING_SOON')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inventoryFilter === 'EXPIRING_SOON'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                Expiring Soon ({inventoryCounts.expiringSoon})
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inventoryFilter === 'EXPIRED'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Expired Stock ({inventoryCounts.expired})
              </button>
              <button
                type="button"
                onClick={() => setInventoryFilter('LOW_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  inventoryFilter === 'LOW_STOCK'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200/60'
                }`}
              >
                Low Stock ({inventoryCounts.lowStock})
              </button>
            </div>
          )}

          {/* Sub-Filters: Incoming Requests */}
          {activeCenter === 'REQUESTS' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRequestFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  requestFilter === 'PENDING'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60'
                }`}
              >
                New / Pending ({requestCounts.pending})
              </button>
              <button
                type="button"
                onClick={() => setRequestFilter('EXPIRING_SOON')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  requestFilter === 'EXPIRING_SOON'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                Expiring Soon ≤12h ({requestCounts.expiringSoon})
              </button>
              <button
                type="button"
                onClick={() => setRequestFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  requestFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Incoming ({requestCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setRequestFilter('ACCEPTED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  requestFilter === 'ACCEPTED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                Accepted History ({requestCounts.accepted})
              </button>
              <button
                type="button"
                onClick={() => setRequestFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  requestFilter === 'REJECTED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                Rejected ({requestCounts.rejected})
              </button>
              <button
                type="button"
                onClick={() => setRequestFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  requestFilter === 'EXPIRED'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Expired ({requestCounts.expired})
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="relative min-w-[240px] max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeCenter === 'INVENTORY'
                  ? 'Search medicine, batch, details...'
                  : 'Search hospital, medicine, ID...'
              }
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONTENT SECTION: CENTER 1 OR CENTER 2
         ========================================================================= */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Evaluating hospital telemetry & alerts...</p>
        </div>
      ) : activeCenter === 'INVENTORY' ? (
        /* ---------------------------------------------------------------------
           CENTER 1: MY INVENTORY ALERTS FEED
           --------------------------------------------------------------------- */
        <div className="space-y-4">
          {filteredInventoryAlerts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No inventory alerts</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {searchQuery
                  ? 'No inventory stock matched your search criteria.'
                  : 'Your current medicine inventory has no alerts requiring attention.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredInventoryAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all hover:shadow-md ${
                    alert.severity === 'CRITICAL'
                      ? 'border-rose-200/90 hover:border-rose-300'
                      : alert.alertCategory === 'EXPIRING_SOON'
                      ? 'border-amber-200/90 hover:border-amber-300'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        {alert.severity === 'CRITICAL' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            {alert.badgeText}
                          </span>
                        ) : alert.alertCategory === 'EXPIRING_SOON' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            {alert.badgeText}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
                            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                            {alert.badgeText}
                          </span>
                        )}

                        {alert.concessionBadge && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {alert.concessionBadge}
                          </span>
                        )}
                      </div>

                      {/* Medicine Name & Details */}
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          {alert.medicineName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium mt-1">
                          <span>
                            Batch: <strong className="font-mono text-slate-800">{alert.batchNo}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Quantity:{' '}
                            <strong className="text-slate-900 font-bold">{alert.quantity} units</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Expiry Date:{' '}
                            <strong className="text-slate-900">{alert.formattedExpiryDate}</strong>
                          </span>
                          <span>•</span>
                          <span
                            className={
                              alert.severity === 'CRITICAL'
                                ? 'text-rose-600 font-bold'
                                : 'text-amber-700 font-semibold'
                            }
                          >
                            {alert.remainingShelfLife}
                          </span>
                        </div>
                      </div>

                      {/* Understandable Message / Action Context */}
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                        {alert.explanation}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 flex items-center sm:self-center">
                      <button
                        type="button"
                        onClick={() => navigate(alert.actionLink)}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-teal-700 hover:bg-teal-800 text-white'
                        }`}
                      >
                        <span>{alert.actionRelevant}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ---------------------------------------------------------------------
           CENTER 2: INCOMING REQUESTS FEED
           --------------------------------------------------------------------- */
        <div className="space-y-4">
          {filteredIncomingRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">
                {requestFilter === 'EXPIRING_SOON'
                  ? 'No requests approaching deadline'
                  : 'No incoming medicine requests'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {requestFilter === 'EXPIRING_SOON'
                  ? 'No requests are approaching their 48-hour deadline.'
                  : searchQuery
                  ? 'No incoming requests matched your search criteria.'
                  : 'No hospitals are currently waiting for a response from your hospital.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredIncomingRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all hover:shadow-md ${
                    req.isExpiringSoon
                      ? 'border-amber-300 ring-1 ring-amber-200/50 bg-amber-50/10'
                      : req.isActionable
                      ? 'border-teal-200/90'
                      : 'border-slate-200 opacity-90'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2.5 flex-1">
                      {/* WHO REQUESTED IT (VERY PROMINENT) */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
                            <Hospital className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Requester Hospital
                            </span>
                            <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                              {req.requestingHospital}
                            </h4>
                          </div>
                        </div>

                        {/* Status & SLA Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Current Status */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              req.status === 'Pending'
                                ? 'bg-teal-50 text-teal-800 border-teal-200'
                                : req.status === 'Accepted'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : req.status === 'Rejected'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {req.status === 'Pending' && <Clock className="w-3 h-3" />}
                            {req.status === 'Accepted' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {req.status === 'Rejected' && <XCircle className="w-3 h-3 text-rose-600" />}
                            {req.status === 'Expired' && <AlertCircle className="w-3 h-3 text-slate-500" />}
                            {req.status === 'Pending' ? 'Pending Review' : req.status}
                          </span>

                          {/* 48-Hour SLA Countdown */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${req.slaColor}`}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            {req.slaCountdownLabel}
                          </span>
                        </div>
                      </div>

                      {/* WHAT MEDICINE & HOW MUCH */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <div className="text-xs text-slate-500 font-medium">Requisition Details</div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-base font-bold text-slate-900">{req.medicineName}</span>
                          <span className="text-sm font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            {req.quantity} {req.unit}
                          </span>
                        </div>
                      </div>

                      {/* WHEN REQUESTED & REQUEST ID */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Requisition ID: <strong className="font-mono text-slate-700">{req.requestId}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Requested on: <strong className="text-slate-700">{req.formattedRequestedAt}</strong>
                        </span>
                      </div>
                    </div>

                    {/* WHAT ACTION CAN MY HOSPITAL TAKE? */}
                    <div className="shrink-0 flex items-center md:self-center">
                      <button
                        type="button"
                        onClick={() => navigate(req.actionLink)}
                        className={`w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                          req.isActionable
                            ? 'bg-sky-600 hover:bg-sky-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>{req.isActionable ? 'Review Request' : 'View Requisition'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HospitalAlerts;
