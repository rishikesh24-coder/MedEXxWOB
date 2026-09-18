/**
 * Centralized Near-Expiry Concession Policy for MedEx
 * 
 * SINGLE SOURCE OF TRUTH across the entire project for:
 * - Medicine shelf life calculation
 * - Stock acceptance eligibility (Intake / Inventory / Requisitions)
 * - Near-expiry concession percentage & amounts
 * - Selling prices and marketplace valuations
 * 
 * BUSINESS POLICY STANDARD:
 * - Expired (diff <= 0)                  -> REJECT (acceptable: false)
 * - Expiry <= 1 month (diff <= 30 days)  -> REJECT (acceptable: false, HARD REJECTION)
 * - Expiry > 1 month and <= 2 months    -> 30% concession (acceptable: true)
 * - Expiry > 2 months and <= 3 months   -> 20% concession (acceptable: true)
 * - Expiry > 3 months and <= 4 months   -> 15% concession (acceptable: true)
 * - Expiry > 4 months and <= 5 months   -> 10% concession (acceptable: true)
 * - Expiry > 5 months and <= 6 months   -> 5% concession (acceptable: true)
 * - Expiry > 6 months                   -> 0% concession (acceptable: true)
 */

export const DAYS_PER_MONTH = 30;

export const NEAR_EXPIRY_SCHEDULE = [
  {
    minMonths: 0,
    maxMonths: 1,
    minDays: 0,
    maxDays: 30,
    concessionPercent: 0,
    acceptable: false,
    status: 'critical_rejection',
    label: 'Critical / Non-Acceptable (<= 1 Month)',
    badge: 'Rejection Threshold',
    rejectionReason: 'Stock cannot be accepted because the medicine expires within 1 month.',
  },
  {
    minMonths: 1,
    maxMonths: 2,
    minDays: 31,
    maxDays: 60,
    concessionPercent: 30,
    acceptable: true,
    status: 'near_expiry_tier_1',
    label: 'Near Expiry (1 - 2 Months)',
    badge: '30% Concession',
    rejectionReason: null,
  },
  {
    minMonths: 2,
    maxMonths: 3,
    minDays: 61,
    maxDays: 90,
    concessionPercent: 20,
    acceptable: true,
    status: 'near_expiry_tier_2',
    label: 'Near Expiry (2 - 3 Months)',
    badge: '20% Concession',
    rejectionReason: null,
  },
  {
    minMonths: 3,
    maxMonths: 4,
    minDays: 91,
    maxDays: 120,
    concessionPercent: 15,
    acceptable: true,
    status: 'near_expiry_tier_3',
    label: 'Moderate Surplus (3 - 4 Months)',
    badge: '15% Concession',
    rejectionReason: null,
  },
  {
    minMonths: 4,
    maxMonths: 5,
    minDays: 121,
    maxDays: 150,
    concessionPercent: 10,
    acceptable: true,
    status: 'near_expiry_tier_4',
    label: 'Standard Surplus (4 - 5 Months)',
    badge: '10% Concession',
    rejectionReason: null,
  },
  {
    minMonths: 5,
    maxMonths: 6,
    minDays: 151,
    maxDays: 180,
    concessionPercent: 5,
    acceptable: true,
    status: 'near_expiry_tier_5',
    label: 'Monitored Shelf Life (5 - 6 Months)',
    badge: '5% Concession',
    rejectionReason: null,
  },
  {
    minMonths: 6,
    maxMonths: Infinity,
    minDays: 181,
    maxDays: Infinity,
    concessionPercent: 0,
    acceptable: true,
    status: 'healthy',
    label: 'Full Shelf Life (> 6 Months)',
    badge: 'Full Shelf Life',
    rejectionReason: null,
  },
];

/**
 * Normalizes a date input to a clean Date instance at start of day (midnight UTC)
 * @param {string|Date|number} dateInput
 * @returns {Date|null}
 */
export function normalizeDate(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Calculates remaining shelf life in days, fractional months, and human-readable formatting
 * @param {string|Date} expiryDate - Actual batch expiry date
 * @param {string|Date} [referenceDate] - Comparison reference date (defaults to current date)
 * @returns {{ days: number, months: number, formatted: string, isExpired: boolean }}
 */
export function getRemainingShelfLife(expiryDate, referenceDate = null) {
  const exp = normalizeDate(expiryDate);
  const ref = normalizeDate(referenceDate) || normalizeDate(new Date());

  if (!exp) {
    return {
      days: 0,
      months: 0,
      formatted: 'Unknown Expiry Date',
      isExpired: true,
    };
  }

  const diffMs = exp.getTime() - ref.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = diffDays <= 0;

  if (isExpired) {
    const pastDays = Math.abs(diffDays);
    return {
      days: diffDays,
      months: 0,
      formatted: pastDays === 0 ? 'Expires Today' : `Expired ${pastDays} day${pastDays === 1 ? '' : 's'} ago`,
      isExpired: true,
    };
  }

  // Fractional months with 1 decimal place (standard 30 days per month)
  const fractionalMonths = Math.round((diffDays / DAYS_PER_MONTH) * 10) / 10;
  
  let formatted = '';
  if (diffDays <= DAYS_PER_MONTH) {
    formatted = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
  } else {
    formatted = `${fractionalMonths} month${fractionalMonths === 1 ? '' : 's'} (${diffDays} days)`;
  }

  return {
    days: diffDays,
    months: fractionalMonths,
    formatted,
    isExpired: false,
  };
}

/**
 * Resolves expiry status key and label according to policy
 * @param {string|Date} expiryDate
 * @param {string|Date} [referenceDate]
 * @returns {'expired'|'critical_rejection'|'near_expiry_tier_1'|'near_expiry_tier_2'|'near_expiry_tier_3'|'near_expiry_tier_4'|'near_expiry_tier_5'|'healthy'}
 */
export function getExpiryStatus(expiryDate, referenceDate = null) {
  const shelfLife = getRemainingShelfLife(expiryDate, referenceDate);
  if (shelfLife.isExpired) {
    return 'expired';
  }

  const matched = NEAR_EXPIRY_SCHEDULE.find((tier) => shelfLife.days <= tier.maxDays);
  return matched ? matched.status : 'healthy';
}

/**
 * Hard Acceptance Rule Evaluation:
 * - Expired -> REJECT
 * - Expiry <= 1 month from reference date (<= 30 days) -> REJECT
 * - Expiry > 1 month -> eligible for acceptance
 * 
 * @param {string|Date} expiryDate
 * @param {string|Date} [referenceDate]
 * @returns {boolean}
 */
export function isExpiryAcceptable(expiryDate, referenceDate = null) {
  const shelfLife = getRemainingShelfLife(expiryDate, referenceDate);
  if (shelfLife.isExpired) return false;
  return shelfLife.days > DAYS_PER_MONTH;
}

/**
 * Derives exact concession percentage from batch expiry date
 * @param {string|Date} expiryDate
 * @param {string|Date} [referenceDate]
 * @returns {number} Concession percentage (0, 5, 10, 15, 20, or 30)
 */
export function getConcessionPercent(expiryDate, referenceDate = null) {
  const shelfLife = getRemainingShelfLife(expiryDate, referenceDate);
  if (shelfLife.isExpired || shelfLife.days <= DAYS_PER_MONTH) {
    return 0; // Rejected stock has no applicable concession
  }

  const matched = NEAR_EXPIRY_SCHEDULE.find((tier) => shelfLife.days <= tier.maxDays);
  return matched ? matched.concessionPercent : 0;
}

/**
 * Standard 2-decimal money rounding: round(value * 100) / 100
 * @param {number} value
 * @returns {number}
 */
export function roundMoney(value) {
  const num = Number(value) || 0;
  return Math.round(num * 100) / 100;
}

/**
 * Calculates concession amount per unit in ₹
 * concessionAmountPerUnit = MRP * concessionPercent / 100
 * @param {number} mrp - Maximum Retail Price (unit price)
 * @param {string|Date} expiryDate
 * @param {string|Date} [referenceDate]
 * @returns {number}
 */
export function getConcessionAmount(mrp, expiryDate, referenceDate = null) {
  const unitMRP = Math.max(0, Number(mrp) || 0);
  const percent = getConcessionPercent(expiryDate, referenceDate);
  return roundMoney((unitMRP * percent) / 100);
}

/**
 * Calculates selling price per unit in ₹
 * sellingPricePerUnit = MRP - concessionAmountPerUnit
 * @param {number} mrp
 * @param {string|Date} expiryDate
 * @param {string|Date} [referenceDate]
 * @returns {number}
 */
export function getSellingPrice(mrp, expiryDate, referenceDate = null) {
  const unitMRP = Math.max(0, Number(mrp) || 0);
  const concessionAmount = getConcessionAmount(unitMRP, expiryDate, referenceDate);
  return roundMoney(unitMRP - concessionAmount);
}

/**
 * Complete deterministic pricing breakdown for a batch
 * @param {string|Date} expiryDate
 * @param {number} mrp
 * @param {string|Date} [referenceDate]
 * @param {number} [quantity=1]
 * @returns {{
 *   expiryDate: string,
 *   remainingShelfLife: { days: number, months: number, formatted: string, isExpired: boolean },
 *   expiryStatus: string,
 *   acceptable: boolean,
 *   concessionPercent: number,
 *   concessionAmountPerUnit: number,
 *   sellingPricePerUnit: number,
 *   rejectionReason: string|null,
 *   quantity: number,
 *   totalMRP: number,
 *   totalConcession: number,
 *   finalSellingPrice: number,
 *   tierLabel: string,
 *   tierBadge: string
 * }}
 */
export function getExpiryPricing(expiryDate, mrp = 100, referenceDate = null, quantity = 1) {
  const shelfLife = getRemainingShelfLife(expiryDate, referenceDate);
  const unitMRP = Math.max(0, Number(mrp) || 0);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));

  let acceptable = false;
  let expiryStatus = 'expired';
  let rejectionReason = null;
  let tierLabel = 'Expired';
  let tierBadge = 'Expired';
  let concessionPercent = 0;

  if (shelfLife.isExpired) {
    acceptable = false;
    expiryStatus = 'expired';
    rejectionReason = 'Stock cannot be accepted because the medicine is expired.';
    tierLabel = 'Expired';
    tierBadge = 'Expired';
    concessionPercent = 0;
  } else if (shelfLife.days <= DAYS_PER_MONTH) {
    acceptable = false;
    expiryStatus = 'critical_rejection';
    rejectionReason = 'Stock cannot be accepted because the medicine expires within 1 month.';
    tierLabel = 'Critical Expiry (<= 1 Month)';
    tierBadge = 'Cannot Accept / List';
    concessionPercent = 0;
  } else {
    acceptable = true;
    const matched = NEAR_EXPIRY_SCHEDULE.find((tier) => shelfLife.days <= tier.maxDays) || NEAR_EXPIRY_SCHEDULE[NEAR_EXPIRY_SCHEDULE.length - 1];
    expiryStatus = matched.status;
    concessionPercent = matched.concessionPercent;
    tierLabel = matched.label;
    tierBadge = matched.badge;
    rejectionReason = null;
  }

  const concessionAmountPerUnit = roundMoney((unitMRP * concessionPercent) / 100);
  const sellingPricePerUnit = roundMoney(unitMRP - concessionAmountPerUnit);

  const totalMRP = roundMoney(unitMRP * qty);
  const totalConcession = roundMoney(concessionAmountPerUnit * qty);
  const finalSellingPrice = roundMoney(sellingPricePerUnit * qty);

  return {
    expiryDate: typeof expiryDate === 'string' ? expiryDate : (expiryDate instanceof Date ? expiryDate.toISOString().split('T')[0] : ''),
    remainingShelfLife: shelfLife,
    expiryStatus,
    acceptable,
    concessionPercent,
    concessionAmountPerUnit,
    sellingPricePerUnit,
    rejectionReason,
    quantity: qty,
    totalMRP,
    totalConcession,
    finalSellingPrice,
    tierLabel,
    tierBadge,
  };
}
