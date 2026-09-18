/**
 * Centralized Input Validation & Sanitization Engine
 * MedEx Platform
 * 
 * Provides defensive validation for all forms, medicine data, requisitions,
 * and user-supplied strings.
 * 
 * IMPORTANT: Frontend validation provides responsive UX and early error detection.
 * In production, authoritative validation MUST be repeated on the backend server.
 */

// Reasonable business boundaries
export const VALIDATION_LIMITS = {
  MAX_QUANTITY: 500000,
  MIN_QUANTITY: 1,
  MAX_UNIT_PRICE: 1000000,
  MIN_UNIT_PRICE: 0,
  MAX_CONCESSION_PERCENT: 90,
  MIN_CONCESSION_PERCENT: 0,
  MAX_STRING_LENGTH: 200,
  MAX_NOTES_LENGTH: 1000,
  MAX_BATCH_NO_LENGTH: 35,
  MIN_BATCH_NO_LENGTH: 2,
};

/**
 * Strips dangerous HTML injection vectors and control characters from text input.
 * All React JSX text rendering auto-escapes, but this provides defense-in-depth.
 * @param {*} value 
 * @param {number} maxLength 
 * @returns {string}
 */
export function sanitizeText(value, maxLength = VALIDATION_LIMITS.MAX_STRING_LENGTH) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  // Strip control characters except newline and tab
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned.slice(0, maxLength);
}

/**
 * Sanitizes search input strings
 * @param {*} query 
 * @returns {string}
 */
export function sanitizeSearchInput(query) {
  return sanitizeText(query, 100).toLowerCase();
}

/**
 * Validates a medicine quantity field
 * @param {*} value 
 * @param {number} maxLimit 
 * @returns {{ isValid: boolean, value: number, error: string|null }}
 */
export function validateQuantity(value, maxLimit = VALIDATION_LIMITS.MAX_QUANTITY) {
  const num = Number(value);

  if (value === '' || value === null || value === undefined || !Number.isFinite(num)) {
    return { isValid: false, value: 0, error: 'Quantity must be a valid number' };
  }

  if (!Number.isInteger(num)) {
    return { isValid: false, value: Math.floor(num), error: 'Quantity must be a whole integer' };
  }

  if (num < VALIDATION_LIMITS.MIN_QUANTITY) {
    return { isValid: false, value: num, error: 'Quantity must be greater than zero' };
  }

  if (num > maxLimit) {
    return { isValid: false, value: num, error: `Quantity cannot exceed ${maxLimit.toLocaleString('en-IN')}` };
  }

  return { isValid: true, value: num, error: null };
}

/**
 * Validates a unit price field (MRP or concession rate)
 * @param {*} value 
 * @param {number} maxLimit 
 * @returns {{ isValid: boolean, value: number, error: string|null }}
 */
export function validatePrice(value, maxLimit = VALIDATION_LIMITS.MAX_UNIT_PRICE) {
  const num = Number(value);

  if (value === '' || value === null || value === undefined || !Number.isFinite(num)) {
    return { isValid: false, value: 0, error: 'Price must be a valid numeric amount' };
  }

  if (num < VALIDATION_LIMITS.MIN_UNIT_PRICE) {
    return { isValid: false, value: 0, error: 'Price cannot be negative' };
  }

  if (num > maxLimit) {
    return { isValid: false, value: num, error: `Price cannot exceed ₹${maxLimit.toLocaleString('en-IN')}` };
  }

  return { isValid: true, value: Math.round(num * 100) / 100, error: null };
}

import { isExpiryAcceptable, getRemainingShelfLife, getExpiryPricing, getConcessionPercent } from '../config/nearExpiryPolicy.js';

/**
 * Validates Manufacturing Date vs Expiry Date consistency
 * Enforces the central Near-Expiry Concession Policy rejection rules.
 * @param {string|Date} mfgDate 
 * @param {string|Date} expiryDate 
 * @returns {{ isValid: boolean, error: string|null }}
 */
export function validateDates(mfgDate, expiryDate) {
  if (!expiryDate) {
    return { isValid: false, error: 'Expiry date is strictly mandatory' };
  }

  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) {
    return { isValid: false, error: 'Expiry date is invalid' };
  }

  const shelfLife = getRemainingShelfLife(expiryDate);
  if (shelfLife.isExpired) {
    return { isValid: false, error: 'Stock cannot be accepted because the medicine is expired' };
  }
  if (!isExpiryAcceptable(expiryDate)) {
    return { isValid: false, error: 'Stock cannot be accepted because the medicine expires within 1 month.' };
  }

  if (mfgDate) {
    const mfg = new Date(mfgDate);
    if (isNaN(mfg.getTime())) {
      return { isValid: false, error: 'Manufacturing date is invalid' };
    }

    // Manufacturing date cannot be after expiry date
    if (mfg > exp) {
      return {
        isValid: false,
        error: 'Manufacturing date cannot be later than Expiry date',
      };
    }

    // Manufacturing date cannot be unreasonably far in the future
    const now = new Date();
    // Allow up to 1 day clock skew
    const maxFutureMfg = new Date(now.getTime() + 86400000);
    if (mfg > maxFutureMfg) {
      return {
        isValid: false,
        error: 'Manufacturing date cannot be in the future',
      };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validates a batch identification number
 * @param {*} batchNo 
 * @returns {{ isValid: boolean, value: string, error: string|null }}
 */
export function validateBatchNumber(batchNo) {
  const cleaned = sanitizeText(batchNo, VALIDATION_LIMITS.MAX_BATCH_NO_LENGTH);

  if (!cleaned || cleaned.length < VALIDATION_LIMITS.MIN_BATCH_NO_LENGTH) {
    return {
      isValid: false,
      value: cleaned,
      error: `Batch number must be at least ${VALIDATION_LIMITS.MIN_BATCH_NO_LENGTH} characters`,
    };
  }

  // Common alphanumeric batch pattern (letters, numbers, hyphens, slashes)
  const batchPattern = /^[A-Za-z0-9\-_/]+$/;
  if (!batchPattern.test(cleaned)) {
    return {
      isValid: false,
      value: cleaned,
      error: 'Batch number should contain only alphanumeric characters, hyphens, or slashes',
    };
  }

  return { isValid: true, value: cleaned, error: null };
}

/**
 * Validates complete Medicine Add/Edit form submission
 * @param {object} formData 
 * @returns {{ isValid: boolean, errors: object, sanitizedData: object }}
 */
export function validateMedicineForm(formData) {
  const errors = {};

  const brandName = sanitizeText(formData.brandName || formData.medicineName, 120);
  if (!brandName || brandName.length < 2) {
    errors.brandName = 'Medicine/Brand Name must be at least 2 characters';
  }

  const genericName = sanitizeText(formData.genericName, 120);
  const power = sanitizeText(formData.power, 60);
  if (!power) {
    errors.power = 'Strength / Dosage specification is required (e.g. 500mg, 10mg/ml)';
  }

  const qtyResult = validateQuantity(formData.quantity);
  if (!qtyResult.isValid) {
    errors.quantity = qtyResult.error;
  }

  const priceResult = validatePrice(formData.unitOriginalPrice);
  if (!priceResult.isValid) {
    errors.unitOriginalPrice = priceResult.error;
  }

  const minStockResult = validateQuantity(formData.minStockLevel ?? 20, 100000);
  if (!minStockResult.isValid) {
    errors.minStockLevel = minStockResult.error;
  }

  const dateResult = validateDates(formData.mfgDate, formData.expiryDate);
  if (!dateResult.isValid) {
    errors.dates = dateResult.error;
    errors.expiryDate = dateResult.error;
  }

  // Derive policy-governed concession from batch expiry date (no manual override)
  const policyPricing = getExpiryPricing(formData.expiryDate, priceResult.value || 100);
  const safeConcession = policyPricing.concessionPercent;
  const concessionRate = policyPricing.sellingPricePerUnit;

  const batchResult = validateBatchNumber(formData.batchNo || 'BATCH-01');
  if (!batchResult.isValid) {
    errors.batchNo = batchResult.error;
  }

  const notes = sanitizeText(formData.notes, VALIDATION_LIMITS.MAX_NOTES_LENGTH);
  const manufacturer = sanitizeText(formData.manufacturer, 100);

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    sanitizedData: {
      ...formData,
      brandName,
      medicineName: brandName,
      genericName: genericName || brandName,
      power,
      quantity: qtyResult.value,
      unitOriginalPrice: priceResult.value,
      minStockLevel: minStockResult.value,
      concessionPercent: safeConcession,
      mfgDate: formData.mfgDate ? String(formData.mfgDate).trim() : '',
      expiryDate: formData.expiryDate ? String(formData.expiryDate).trim() : '',
      batchNo: batchResult.value,
      manufacturer: manufacturer || 'Authorized Pharmaceutical Manufacturer',
      shelfLocation: sanitizeText(formData.shelfLocation, 100) || 'Rack A - Shelf 3',
      packing: sanitizeText(formData.packing || formData.packSize, 80) || '15 Tablets / Strip',
      packSize: sanitizeText(formData.packSize || formData.packing, 80) || '15 Tablets / Strip',
      numberOfPacks: Number(formData.numberOfPacks) > 0 ? Number(formData.numberOfPacks) : Math.max(1, Math.ceil((qtyResult.value || 1) / (Number(formData.unitsPerPack) || 15))),
      unitsPerPack: Number(formData.unitsPerPack) > 0 ? Number(formData.unitsPerPack) : 15,
      totalUnits: qtyResult.value,
      totalQuantity: qtyResult.value,
      availableQuantity: qtyResult.value,
      mrp: priceResult.value,
      concessionRate,
      costRate: Number(formData.costRate) > 0 ? Number(formData.costRate) : Math.round((priceResult.value || 0) * 0.85),
      notes,
    },
  };
}

/**
 * Validates a requisition order before submission
 * @param {object} reqData 
 * @param {object} targetMedicine 
 * @param {string} buyerHospitalId 
 * @returns {{ isValid: boolean, error: string|null, sanitizedData: object }}
 */
export function validateRequisition(reqData, targetMedicine, buyerHospitalId) {
  if (!targetMedicine) {
    return { isValid: false, error: 'Target medicine does not exist', sanitizedData: null };
  }

  if (targetMedicine.hospitalId && buyerHospitalId && targetMedicine.hospitalId === buyerHospitalId) {
    return { isValid: false, error: 'You cannot request medicine from your own hospital inventory', sanitizedData: null };
  }

  // Check expiration
  if (targetMedicine.expiryDate) {
    const exp = new Date(targetMedicine.expiryDate);
    if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return { isValid: false, error: 'This medicine batch has expired and cannot be requisitioned', sanitizedData: null };
    }
  }

  const availableStock = Number(targetMedicine.quantity) || 0;
  if (availableStock <= 0) {
    return { isValid: false, error: 'Medicine is currently out of stock', sanitizedData: null };
  }

  const requestedQtyResult = validateQuantity(reqData.quantity, availableStock);
  if (!requestedQtyResult.isValid) {
    return {
      isValid: false,
      error: requestedQtyResult.value > availableStock
        ? `Requested quantity (${requestedQtyResult.value}) exceeds available inventory (${availableStock} units)`
        : requestedQtyResult.error,
      sanitizedData: null,
    };
  }

  const notes = sanitizeText(reqData.notes, VALIDATION_LIMITS.MAX_NOTES_LENGTH);

  return {
    isValid: true,
    error: null,
    sanitizedData: {
      ...reqData,
      quantity: requestedQtyResult.value,
      notes,
    },
  };
}
