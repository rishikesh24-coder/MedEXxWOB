/**
 * Centralized Defensive Formatting & Data Normalization Helpers
 * MedEx Platform
 * 
 * Ensures the application NEVER crashes on undefined, null, NaN, or malformed data.
 */

/**
 * Defensively formats a currency value in Indian Rupees (₹)
 * @param {*} value - Number or string representation of an amount
 * @param {boolean} [showDecimals=true]
 * @returns {string} e.g. "₹1,240.00"
 */
export function formatCurrency(value, showDecimals = true) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return showDecimals ? '₹0.00' : '₹0';
  }

  const fractionDigits = showDecimals ? 2 : 0;
  return `₹${Math.max(0, number).toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * Defensively formats an integer or count with Indian thousands separators
 * @param {*} value 
 * @param {number} fallback 
 * @returns {string} e.g. "1,250"
 */
export function formatNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const fb = Number(fallback);
    return Number.isFinite(fb) ? fb.toLocaleString('en-IN') : '0';
  }
  return number.toLocaleString('en-IN');
}

/**
 * Defensively formats decimal percentages or numbers
 * @param {*} value 
 * @param {number} fractionDigits 
 * @returns {string}
 */
export function formatDecimal(value, fractionDigits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(fractionDigits) : '0.00';
}

/**
 * Defensively formats dates into human-readable string without throwing
 * @param {string|Date} dateVal 
 * @param {string} fallback 
 * @returns {string}
 */
export function formatDate(dateVal, fallback = 'Not recorded') {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal) || fallback;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fallback;
  }
}

/**
 * Safely returns a trimmed non-empty string or fallback
 * @param {*} str 
 * @param {string} fallback 
 * @returns {string}
 */
export function safeString(str, fallback = 'N/A') {
  if (str === null || str === undefined) return fallback;
  const trimmed = String(str).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Normalizes any medicine object to guarantee all required fields exist
 * and prevents downstream crashes across Inventory, Marketplace, Drawer, and Cart.
 * @param {object|null} med 
 * @returns {object|null}
 */
export function normalizeMedicine(med) {
  if (!med || typeof med !== 'object') return null;

  const rawPrice = med.unitOriginalPrice ?? med.price ?? med.unitPrice ?? 0;
  const numPrice = Number(rawPrice);
  const safePrice = Number.isFinite(numPrice) ? Math.max(0, numPrice) : 0;

  const rawQty = med.quantity ?? med.availableQuantity ?? med.stock ?? 0;
  const numQty = Number(rawQty);
  const safeQty = Number.isFinite(numQty) ? Math.max(0, Math.floor(numQty)) : 0;

  const rawMinStock = med.minStockLevel ?? med.reorder_level ?? med.reorderLevel ?? med.minStockThreshold ?? 0;
  const numMinStock = Number(rawMinStock);
  const safeMinStock = Number.isFinite(numMinStock) ? Math.max(0, Math.floor(numMinStock)) : 0;

  const rawConcession = med.concessionPercent ?? med.discountPercent ?? 0;
  const numConcession = Number(rawConcession);
  const safeConcession = Number.isFinite(numConcession) ? Math.max(0, Math.min(100, numConcession)) : 0;

  const rawDistance = med.distanceKm ?? med.distance ?? 12;
  const numDistance = Number(rawDistance);
  const safeDistance = Number.isFinite(numDistance) ? Math.max(0, numDistance) : 12;

  const brand = safeString(med.brandName || med.medicineName || med.name, 'Pharmaceutical Formulation');
  const generic = safeString(med.genericName || med.composition, brand);
  const power = safeString(med.power || med.strength || med.dosage, 'Standard Dosage');
  const form = safeString(med.dosageForm || med.form, 'Tablet');
  const rawBatch = med.batchNo ?? med.batch_number ?? med.batchNumber ?? med.batch;
  const batchNo = rawBatch ? String(rawBatch).trim() : 'BAT-UNREGISTERED';
  const hospital = safeString(med.hospitalName || med.hospital || med.seller, 'Authorized Hospital Node');
  const rawExpiry = med.expiryDate ?? med.expiry_date ?? med.expiry;
  const expiryDate = rawExpiry ? String(rawExpiry).trim() : '2025-12-31';
  const rawStorage = med.storageType ?? med.storage_location ?? med.storageLocation ?? med.storageCondition;
  const storageType = safeString(rawStorage, 'Room Temperature (15°C - 25°C)');

  return {
    ...med,
    id: med.id || `med-fallback-${Math.random().toString(36).substr(2, 9)}`,
    brandName: brand,
    medicineName: brand,
    genericName: generic,
    power,
    dosageForm: form,
    form,
    route: safeString(med.route, 'Oral'),
    hospitalId: med.hospitalId || med.hospital_id || null,
    hospitalName: hospital,
    location: safeString(med.location || med.city, 'Mumbai, Maharashtra'),
    distanceKm: safeDistance,
    batchNo,
    batchNumber: batchNo,
    batch_number: batchNo,
    mfgDate: med.mfgDate || med.manufacturingDate || '2024-01-01',
    expiryDate,
    expiry_date: expiryDate,
    manufacturer: safeString(med.manufacturer, 'Standard Pharma Industries'),
    packSize: safeString(med.packSize || med.unit, '10 x 10 Blister'),
    storageType,
    storageLocation: med.storage_location || med.storageLocation || storageType,
    storage_location: med.storage_location || med.storageLocation || storageType,
    category: safeString(med.category, 'General Formulation'),
    quantity: safeQty,
    availableQuantity: safeQty,
    stock: safeQty,
    minStockLevel: safeMinStock,
    reorderLevel: safeMinStock,
    reorder_level: safeMinStock,
    unitOriginalPrice: safePrice,
    price: safePrice,
    unitPrice: safePrice,
    concessionPercent: safeConcession,
    status: med.status || 'active',
  };
}
