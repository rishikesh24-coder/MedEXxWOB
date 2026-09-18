/**
 * Centralized Pricing & Concession Utilities for MedEx
 * 
 * Standardized across the application to delegate directly to
 * src/config/nearExpiryPolicy.js (Single Source of Truth).
 */

import {
  NEAR_EXPIRY_SCHEDULE,
  getRemainingShelfLife,
  getExpiryStatus,
  isExpiryAcceptable,
  getConcessionPercent,
  getConcessionAmount,
  getSellingPrice,
  getExpiryPricing,
  roundMoney
} from '../config/nearExpiryPolicy.js';

// Re-export central schedule and utilities for backwards compatibility
export {
  NEAR_EXPIRY_SCHEDULE as CONCESSION_TIERS,
  getRemainingShelfLife,
  getExpiryStatus,
  isExpiryAcceptable,
  getConcessionPercent,
  getConcessionAmount,
  getSellingPrice,
  getExpiryPricing,
  roundMoney
};

/**
 * Derives recommended concession percentage and tier label from expiry date.
 * Strictly adheres to the central Near-Expiry Concession Policy without manual override.
 * @param {string|Date} expiryDateStr 
 * @returns {{ concessionPercent: number, tierLabel: string, acceptable: boolean }}
 */
export const calculateShelfLifeConcession = (expiryDateStr) => {
  const pricing = getExpiryPricing(expiryDateStr, 100);
  return {
    concessionPercent: pricing.concessionPercent,
    tierLabel: pricing.tierLabel,
    acceptable: pricing.acceptable,
    status: pricing.expiryStatus,
  };
};

/**
 * Convenience helper returning just the numeric concession percent
 * @param {string|Date} expiryDateStr
 * @returns {number}
 */
export const calculateConcessionRate = (expiryDateStr) => {
  return getConcessionPercent(expiryDateStr);
};

/**
 * Calculates complete pricing breakdown for an order/requisition
 * @param {object} params
 * @param {number} params.unitOriginalPrice - MRP / Original catalog unit cost
 * @param {string} [params.expiryDate] - Expiration date string
 * @param {number} params.quantity - Number of units requested
 * @param {number} [params.distanceKm=15] - Distance in km between buyer and seller
 * @param {boolean} [params.isColdChain=false] - Whether medicine requires cold chain transport
 * @param {number} [params.gstRate=0.12] - Standard statutory GST rate (12% for pharma)
 * @returns {object}
 */
export const calculateOrderPricing = ({
  unitOriginalPrice = 0,
  expiryDate = null,
  quantity = 1,
  distanceKm = 15,
  isColdChain = false,
  gstRate = 0.12,
}) => {
  const originalUnit = Math.max(0, Number(unitOriginalPrice) || 0);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));

  // Derive dynamic pricing via central near-expiry policy
  const expiryPricing = getExpiryPricing(expiryDate, originalUnit, null, qty);

  const discountPct = expiryPricing.concessionPercent;
  const unitDiscount = expiryPricing.concessionAmountPerUnit;
  const unitSellingPrice = expiryPricing.sellingPricePerUnit;
  const concessionRate = unitSellingPrice; // Preserved for backwards compatibility

  // Subtotal for medicine units
  const originalSubtotal = expiryPricing.totalMRP;
  const totalSavings = expiryPricing.totalConcession;
  const medicineSubtotal = expiryPricing.finalSellingPrice;

  // Cold chain logistics fee calculation:
  // Base fee ₹200 + ₹12/km, plus ₹150 cryogenic insulated monitoring buffer if cold chain
  const dist = Math.max(1, Number(distanceKm) || 15);
  const baseLogistics = 200;
  const distanceFee = Math.round(dist * 12);
  const coldChainSurcharge = isColdChain ? 150 : 0;
  const logisticsFee = baseLogistics + distanceFee + coldChainSurcharge;

  // Statutory Tax (GST 12% on medicine exchange + logistics handling)
  const taxableTotal = roundMoney(medicineSubtotal + logisticsFee);
  const gstAmount = roundMoney(taxableTotal * gstRate);
  const totalPayable = roundMoney(taxableTotal + gstAmount);

  return {
    mrp: originalUnit,
    unitOriginalPrice: originalUnit,
    concessionPercent: discountPct,
    concessionRate,
    unitFinalPrice: concessionRate,
    unitSellingPrice,
    unitDiscount,
    concessionAmountPerUnit: unitDiscount,
    sellingPricePerUnit: unitSellingPrice,
    quantity: qty,
    originalSubtotal,
    totalMRP: originalSubtotal,
    totalSavings,
    totalConcession: totalSavings,
    medicineSubtotal,
    finalSellingPrice: medicineSubtotal,
    subtotal: originalSubtotal,
    concessionSavings: totalSavings,
    distanceKm: dist,
    isColdChain,
    logisticsFee,
    gstRate,
    gstAmount,
    totalPayable,
    tierLabel: expiryPricing.tierLabel,
    tierBadge: expiryPricing.tierBadge,
    acceptable: expiryPricing.acceptable,
    rejectionReason: expiryPricing.rejectionReason,
  };
};
