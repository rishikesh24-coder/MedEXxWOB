/**
 * Centralized Pricing & Concession Utilities for MedEx
 * Enforces dynamic concessions based on remaining shelf life, transparent itemized fees,
 * and strict non-negative boundary conditions.
 */

// Shelf-life concession tiers (the closer the expiry, the greater the concession)
export const CONCESSION_TIERS = [
  { maxDays: 0, discountPercent: 0, label: 'Expired (Unavailable)' },
  { maxDays: 30, discountPercent: 60, label: 'Critical Expiry (< 30d)' },
  { maxDays: 60, discountPercent: 45, label: 'Urgent Allocation (< 60d)' },
  { maxDays: 90, discountPercent: 35, label: 'Near Expiry (< 90d)' },
  { maxDays: 180, discountPercent: 20, label: 'Moderate Shelf Life (< 6m)' },
  { maxDays: 365, discountPercent: 10, label: 'Standard Surplus (< 1y)' },
  { maxDays: Infinity, discountPercent: 5, label: 'Long Shelf Life (> 1y)' },
];

/**
 * Derives recommended concession percentage from expiry date.
 * If user or medicine specified a manual concession, it respects it while enforcing boundaries.
 * @param {string|Date} expiryDateStr 
 * @param {number|null} manualConcession 
 * @returns {{ concessionPercent: number, tierLabel: string }}
 */
export const calculateShelfLifeConcession = (expiryDateStr, manualConcession = null) => {
  if (manualConcession !== null && manualConcession !== undefined && manualConcession !== '') {
    const parsed = Math.max(0, Math.min(90, Number(manualConcession) || 0));
    return {
      concessionPercent: parsed,
      tierLabel: 'Custom Partner Concession',
    };
  }

  if (!expiryDateStr) {
    return { concessionPercent: 10, tierLabel: 'Standard Inventory Concession' };
  }

  const now = new Date();
  const expDate = new Date(expiryDateStr);
  const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { concessionPercent: 0, tierLabel: 'Expired (Unavailable for Purchase)' };
  }

  const matchedTier = CONCESSION_TIERS.find((tier) => diffDays <= tier.maxDays) || CONCESSION_TIERS[CONCESSION_TIERS.length - 1];
  return {
    concessionPercent: matchedTier.discountPercent,
    tierLabel: matchedTier.label,
  };
};

/**
 * Convenience helper returning just the numeric concession percent
 */
export const calculateConcessionRate = (expiryDateStr) => {
  return calculateShelfLifeConcession(expiryDateStr).concessionPercent;
};

/**
 * Calculates complete pricing breakdown for an order/requisition
 * @param {object} params
 * @param {number} params.unitOriginalPrice - MRP / Original catalog unit cost
 * @param {string} [params.expiryDate] - Expiration date string
 * @param {number} [params.concessionPercent] - Optional override concession percentage
 * @param {number} params.quantity - Number of units requested
 * @param {number} [params.distanceKm] - Distance in km between buyer and seller
 * @param {boolean} [params.isColdChain] - Whether medicine requires 2°C - 8°C cold chain transport
 * @param {number} [params.gstRate=0.12] - Standard statutory GST rate (12% for pharma)
 * @returns {object}
 */
export const calculateOrderPricing = ({
  unitOriginalPrice = 0,
  expiryDate = null,
  concessionPercent = null,
  quantity = 1,
  distanceKm = 15,
  isColdChain = false,
  gstRate = 0.12,
}) => {
  const originalUnit = Math.max(0, Number(unitOriginalPrice) || 0);
  const qty = Math.max(1, Number(quantity) || 1);

  // Derive concession
  const concessionInfo = calculateShelfLifeConcession(expiryDate, concessionPercent);
  const discountPct = concessionInfo.concessionPercent;

  // Concession Rate (Offered MedEx Rate, Never negative)
  const unitDiscount = (originalUnit * discountPct) / 100;
  const concessionRate = Math.max(0, Math.round((originalUnit - unitDiscount) * 100) / 100);
  const unitSellingPrice = concessionRate; // Preserved for backwards compatibility

  // Subtotal for medicine units
  const originalSubtotal = Math.round(originalUnit * qty * 100) / 100;
  const totalSavings = Math.round(unitDiscount * qty * 100) / 100;
  const medicineSubtotal = Math.max(0, Math.round(concessionRate * qty * 100) / 100);

  // Cold chain logistics fee calculation:
  // Base fee ₹200 + ₹12/km, plus ₹150 cryogenic insulated monitoring buffer if cold chain
  const dist = Math.max(1, Number(distanceKm) || 15);
  const baseLogistics = 200;
  const distanceFee = Math.round(dist * 12);
  const coldChainSurcharge = isColdChain ? 150 : 0;
  const logisticsFee = baseLogistics + distanceFee + coldChainSurcharge;

  // Statutory Tax (GST 12% on medicine exchange + logistics handling)
  const taxableTotal = medicineSubtotal + logisticsFee;
  const gstAmount = Math.round(taxableTotal * gstRate);
  const totalPayable = taxableTotal + gstAmount;

  return {
    mrp: originalUnit,
    unitOriginalPrice: originalUnit,
    concessionPercent: discountPct,
    concessionRate,
    unitFinalPrice: concessionRate,
    unitSellingPrice,
    unitDiscount,
    quantity: qty,
    originalSubtotal,
    totalSavings,
    medicineSubtotal,
    distanceKm: dist,
    isColdChain,
    logisticsFee,
    gstRate,
    gstAmount,
    totalPayable,
    tierLabel: concessionInfo.tierLabel,
  };
};
