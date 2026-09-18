import { isExpiryAcceptable, getRemainingShelfLife, DAYS_PER_MONTH } from '../config/nearExpiryPolicy.js';

// Configurable thresholds in days
export const EXPIRY_THRESHOLDS = {
  CRITICAL_DAYS: DAYS_PER_MONTH, // <= 1 month is a HARD rejection
  NEAR_EXPIRY_DAYS: 90,
  MONITORED_DAYS: 180,
  LOW_STOCK_MIN_UNITS: 25,
  REQUEST_SLA_HOURS: 48,
};

/**
 * Calculates standardized expiry status, shelf-life metrics, and UI display properties
 * @param {string|Date} expiryDateStr 
 * @param {string|Date} mfgDateStr 
 * @param {number} quantity 
 * @param {number} minStockThreshold 
 * @returns {object}
 */
export const calculateMedicineExpiry = (
  expiryDateStr,
  mfgDateStr = null,
  quantity = 0,
  minStockThreshold = EXPIRY_THRESHOLDS.LOW_STOCK_MIN_UNITS
) => {
  // Support polymorphic calls where quantity is passed as 2nd parameter
  let actualMfg = mfgDateStr;
  let actualQty = quantity;
  if (typeof mfgDateStr === 'number') {
    actualQty = mfgDateStr;
    actualMfg = null;
  }

  const qty = Number(actualQty) || 0;

  if (!expiryDateStr) {
    return {
      status: 'healthy',
      statusKey: 'healthy',
      label: 'ACTIVE STOCK',
      badge: 'Unrestricted',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      daysRemaining: 999,
      monthsRemaining: 36,
      isExpired: false,
      isNearExpiry: false,
      isCritical: false,
      isLowStock: qty <= minStockThreshold,
      canBeListed: true,
      canBeDisposed: false,
    };
  }

  const now = new Date();
  const expDate = new Date(expiryDateStr);
  const diffMs = expDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30));

  if (daysRemaining <= 0) {
    return {
      status: 'expired',
      statusKey: 'expired',
      label: 'EXPIRED',
      badge: `${Math.abs(daysRemaining)}d past expiry`,
      color: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      daysRemaining,
      monthsRemaining: 0,
      isExpired: true,
      isNearExpiry: false,
      isCritical: true,
      isLowStock: qty <= minStockThreshold,
      canBeListed: false, // Expired medicine CANNOT be listed or purchased
      canBeDisposed: true, // Eligible for quarantine / removal
    };
  }

  if (daysRemaining <= EXPIRY_THRESHOLDS.CRITICAL_DAYS) {
    return {
      status: 'critical',
      statusKey: 'critical',
      label: 'CRITICAL EXPIRY',
      badge: `${daysRemaining}d remaining`,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      daysRemaining,
      monthsRemaining,
      isExpired: false,
      isNearExpiry: true,
      isCritical: true,
      isLowStock: qty <= minStockThreshold,
      canBeListed: false, // HARD REJECTION: Stock expiring within 1 month cannot be listed or purchased
      canBeDisposed: true,
      acceptable: false,
      rejectionReason: 'Stock cannot be accepted because the medicine expires within 1 month.',
    };
  }

  if (daysRemaining <= EXPIRY_THRESHOLDS.NEAR_EXPIRY_DAYS) {
    return {
      status: 'near-expiry',
      statusKey: 'near-expiry',
      label: 'NEAR EXPIRY',
      badge: `${monthsRemaining}m shelf life`,
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      daysRemaining,
      monthsRemaining,
      isExpired: false,
      isNearExpiry: true,
      isCritical: false,
      isLowStock: qty <= minStockThreshold,
      canBeListed: true,
      canBeDisposed: false,
    };
  }

  if (qty <= minStockThreshold) {
    return {
      status: 'low-stock',
      statusKey: 'low-stock',
      label: 'LOW STOCK',
      badge: 'Reorder Buffer',
      color: 'bg-orange-50 text-orange-700 border-orange-200',
      daysRemaining,
      monthsRemaining,
      isExpired: false,
      isNearExpiry: false,
      isCritical: false,
      isLowStock: true,
      canBeListed: true,
      canBeDisposed: false,
    };
  }

  return {
    status: 'healthy',
    statusKey: 'healthy',
    label: 'HEALTHY',
    badge: `${monthsRemaining}m shelf`,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    daysRemaining,
    monthsRemaining,
    isExpired: false,
    isNearExpiry: false,
    isCritical: false,
    isLowStock: false,
    canBeListed: true,
    canBeDisposed: false,
  };
};

/**
 * Derives request expiry time (48 hours from requestDate) and checks active SLA
 * @param {string|Date} requestDateStr 
 * @param {number} slaHours 
 * @returns {object}
 */
export const calculateRequestExpiry = (
  requestDateStr,
  slaHours = EXPIRY_THRESHOLDS.REQUEST_SLA_HOURS
) => {
  if (!requestDateStr) {
    return {
      expiryDate: new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString(),
      isExpired: false,
      hoursRemaining: slaHours,
      minutesRemaining: 0,
      formattedTimeLeft: `${slaHours}h 00m`,
    };
  }

  const reqDate = new Date(requestDateStr);
  const expiryDate = new Date(reqDate.getTime() + slaHours * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      expiryDate: expiryDate.toISOString(),
      isExpired: true,
      hoursRemaining: 0,
      minutesRemaining: 0,
      formattedTimeLeft: 'Expired (48h elapsed)',
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hoursRemaining = Math.floor(totalMinutes / 60);
  const minutesRemaining = totalMinutes % 60;

  return {
    expiryDate: expiryDate.toISOString(),
    isExpired: false,
    hoursRemaining,
    minutesRemaining,
    formattedTimeLeft: `${hoursRemaining}h ${minutesRemaining.toString().padStart(2, '0')}m`,
  };
};

/**
 * Convenience helper returning remaining time and formatted label
 */
export const getRequestRemainingTime = (requestDateStr, expiryDateStr) => {
  const result = calculateRequestExpiry(requestDateStr);
  return {
    ...result,
    formattedRemaining: result.formattedTimeLeft
  };
};

/**
 * Iterates through requests and transitions pending requests past 48h to 'expired'
 * Returns updated array and flags if any changes occurred.
 * @param {Array} requests 
 * @returns {{ requests: Array, hasExpiredChanges: boolean, expiredCount: number }}
 */
export const processExpiredRequests = (requests = []) => {
  if (!Array.isArray(requests)) return { requests: [], hasExpiredChanges: false, expiredCount: 0 };

  let hasExpiredChanges = false;
  let expiredCount = 0;
  const now = new Date();

  const updatedRequests = requests.map((req) => {
    // Only pending requests are eligible for auto-expiration
    if (req.status === 'pending') {
      const { expiryDate, isExpired } = calculateRequestExpiry(req.requestDate);
      if (isExpired) {
        hasExpiredChanges = true;
        expiredCount += 1;
        return {
          ...req,
          status: 'expired',
          expiryDate: req.expiryDate || expiryDate,
          rejectReason: req.rejectReason || 'Automated SLA: Requisition expired after 48 hours without seller confirmation.',
          expiredAt: now.toISOString(),
        };
      }
      // Ensure expiryDate is populated
      if (!req.expiryDate) {
        return {
          ...req,
          expiryDate,
        };
      }
    }
    return req;
  });

  return {
    requests: updatedRequests,
    hasExpiredChanges,
    expiredCount,
  };
};
