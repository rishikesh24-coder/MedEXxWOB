import { getStoredItem, setStoredItem, KEYS, isHospitalSuspended, saveSaleListing, getSaleListings as getStoredSaleListings, updateSaleListing as updateStoredSaleListing } from './storage.js';
import { HOSPITAL_ANALYTICS } from './mockData.js';
import { calculateMedicineExpiry, calculateRequestExpiry, processExpiredRequests } from '../utils/expiryUtils.js';
import { calculateOrderPricing } from '../utils/pricingUtils.js';
import { isExpiryAcceptable, getExpiryPricing, getConcessionPercent } from '../config/nearExpiryPolicy.js';
import { auditService } from './auditService.js';
import { findAlternatives } from './medicineAlternativeService.js';
import { getCancellationPolicy, calculateRefundAmounts } from '../utils/cancellationPolicy.js';
import { API_BASE_URL } from '../config/api.js';

const SUSPENDED_HOSPITAL_ERROR = 'Your hospital account is currently suspended. You cannot perform transactions or operational activities.';

/**
 * Ensures caller is authorized and hospital is not suspended
 * @param {string} requestedHospitalId 
 */
const assertHospitalActive = (requestedHospitalId) => {
  const session = getStoredItem(KEYS.AUTH, null);
  const authenticatedHospitalId = session?.user?.role === 'hospital' ? session.user.id : requestedHospitalId;
  if (session?.user?.role === 'hospital' && requestedHospitalId && authenticatedHospitalId !== requestedHospitalId) {
    throw new Error('You are not authorized to act for this hospital');
  }
  if (isHospitalSuspended(authenticatedHospitalId)) {
    throw new Error(SUSPENDED_HOSPITAL_ERROR);
  }
};

/**
 * Resolves current hospital ID strictly enforcing tenant isolation:
 * - For a hospital-role user, ALWAYS returns the authenticated hospital ID.
 *   Arbitrary hospitalId parameters passed by callers are strictly ignored to prevent tenant leakage.
 * - For an admin-role user, allows supervisory inspection of hospitalIdParam.
 */
const resolveHospitalId = (hospitalIdParam) => {
  const session = getStoredItem(KEYS.AUTH, null);
  const user = session?.user;
  const authHospitalId = user?.hospitalId || user?.id;

  if (user?.role === 'hospital') {
    return authHospitalId || null;
  }

  if (user?.role === 'admin') {
    return hospitalIdParam || authHospitalId || null;
  }

  return authHospitalId || hospitalIdParam || null;
};

export const hospitalService = {
  /**
   * Retrieves current authenticated hospital profile via GET /api/hospitals/me
   */
  async getCurrentHospital() {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/hospitals/me`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          return json.data;
        }
      }
    } catch (e) {
      // offline fallback
    }

    const session = getStoredItem(KEYS.AUTH, null);
    const hospitalId = session?.user?.hospitalId || session?.user?.id;
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    return hospitals.find((h) => h.id === hospitalId) || session?.user || null;
  },

  // ==========================================
  // 1. DASHBOARD ANALYTICS (Fully Derived)
  // ==========================================
  async getDashboard(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 200));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) {
      throw new Error('Hospital identity not specified');
    }

    // Refresh expired requests first
    const allRequests = getStoredItem(KEYS.REQUESTS, []);
    const { requests: refreshedRequests, hasExpiredChanges } = processExpiredRequests(allRequests);
    if (hasExpiredChanges) {
      setStoredItem(KEYS.REQUESTS, refreshedRequests);
    }

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const myMeds = medicines.filter((m) => m.hospitalId === hospitalId);
    const myIncoming = refreshedRequests.filter((r) => r.toHospitalId === hospitalId);
    const myOutgoing = refreshedRequests.filter((r) => r.fromHospitalId === hospitalId);
    const trackingList = getStoredItem(KEYS.TRACKING, []);
    const myTransfers = trackingList.filter((t) => t.senderHospitalId === hospitalId || t.receiverHospitalId === hospitalId);

    // Phase 10: Query authoritative trading summary from backend
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    let apiSummary = null;

    if (token) {
      try {
        const summaryRes = await fetch(`${API_BASE_URL}/trades/summary?hospitalId=${encodeURIComponent(hospitalId)}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }
        });
        if (summaryRes.ok) {
          const body = await summaryRes.json();
          apiSummary = body?.data;
        }
      } catch (err) {
        // Fall back to local calculation
      }
    }

    // Calculate monthly financial values from actual fulfilled transactions
    const monthlySales = apiSummary?.metrics?.totalSalesAmount !== undefined
      ? apiSummary.metrics.totalSalesAmount
      : myIncoming
          .filter((r) => ['accepted', 'paid', 'dispatched', 'delivered'].includes(r.status))
          .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);

    const monthlyPurchases = apiSummary?.metrics?.totalPurchaseAmount !== undefined
      ? apiSummary.metrics.totalPurchaseAmount
      : myOutgoing
          .filter((r) => ['accepted', 'paid', 'dispatched', 'delivered'].includes(r.status))
          .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);

    const profitabilityPercent = apiSummary?.metrics?.ratios?.salesPercentage !== undefined
      ? apiSummary.metrics.ratios.salesPercentage
      : (monthlySales > 0 
          ? Math.round(((monthlySales - monthlyPurchases) / monthlySales) * 100 * 10) / 10
          : 0);

    const pendingRequestsCount = apiSummary?.metrics?.pendingTrades !== undefined
      ? apiSummary.metrics.pendingTrades
      : myIncoming.filter((r) => r.status === 'pending').length;
    const activeShipmentsCount = myTransfers.filter((t) => !['Delivered', 'Cancelled'].includes(t.status)).length;

    const calculatedStats = {
      totalMedicines: myMeds.reduce((acc, m) => acc + Number(m.quantity || 0), 0),
      activeSkus: myMeds.filter((m) => m.quantity > 0 && !calculateMedicineExpiry(m.expiryDate).isExpired).length,
      monthlyPurchases,
      monthlySales,
      profitabilityPercent,
      pendingRequestsCount,
      activeShipmentsCount,
      isDemoSimulation: false,
    };

    // Convert real backend timeSeries into chart formats
    let purchasesMonthly = [];
    let salesMonthly = [];
    let profitabilityTrend = [];

    if (apiSummary?.timeSeries && apiSummary.timeSeries.length > 0) {
      purchasesMonthly = apiSummary.timeSeries.map((t) => ({
        month: t.month,
        amount: t.purchases,
        units: t.purchaseUnits,
      }));
      salesMonthly = apiSummary.timeSeries.map((t) => ({
        month: t.month,
        amount: t.sales,
        units: t.saleUnits,
      }));
      profitabilityTrend = apiSummary.timeSeries.map((t) => ({
        month: t.month,
        revenue: t.sales,
        cost: t.purchases,
        marginPercent: t.sales > 0 ? Math.round(((t.sales - t.purchases) / t.sales) * 1000) / 10 : 0,
      }));
    } else {
      // Clean zero dataset for empty states (no fake fallback numbers)
      purchasesMonthly = [{ month: 'Current', amount: monthlyPurchases, units: 0 }];
      salesMonthly = [{ month: 'Current', amount: monthlySales, units: 0 }];
      profitabilityTrend = [{ month: 'Current', revenue: monthlySales, cost: monthlyPurchases, marginPercent: profitabilityPercent }];
    }

    const allHospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hospRecord = allHospitals.find((h) => h.id === hospitalId) || null;

    return {
      hospitalId,
      hospital: hospRecord,
      stats: calculatedStats,
      purchasesMonthly,
      salesMonthly,
      profitabilityTrend,
    };
  },

  // ==========================================
  // 2. INVENTORY MANAGEMENT (Isolated CRUD)
  // ==========================================
  async getInventory(hospitalIdParam) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        let url = `${API_BASE_URL}/inventory?limit=200`;
        if (hospitalIdParam && session?.user?.role === 'admin') {
          url += `&hospitalId=${encodeURIComponent(hospitalIdParam)}`;
        }
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          const items = Array.isArray(json.data) ? json.data : (json.data.items || []);
          if (items.length > 0) {
            return items.map((m) => ({
              ...m,
              brandName: m.medicineName || m.brandName,
              power: m.strength || m.power || m.dosage,
              unitOriginalPrice: m.mrp || m.unitPrice,
              unitFinalPrice: m.concessionRate || m.unitPrice,
            }));
          }
        }
      }
    } catch (e) {
      // offline / mock fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) return [];

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    // STRICT HOSPITAL ISOLATION: Never include hosp-1 as a fallback!
    let isolatedMedicines = medicines.filter((m) => m.hospitalId === hospitalId);

    // If hospital has no inventory at all, initialize default sample inventory specifically for this hospital
    if (isolatedMedicines.length === 0) {
      const hospitals = getStoredItem(KEYS.HOSPITALS, []);
      const hosp = hospitals.find((h) => h.id === hospitalId);
      if (hosp) {
        const defaultSample = [
          {
            id: `med-${hospitalId}-101`,
            brandName: 'Amoxicillin + Clavulanic Acid 625mg',
            genericName: 'Augmentin Broad-Spectrum',
            power: '625mg Tablets',
            category: 'Antibiotics',
            storageType: 'Room Temperature (15°C - 25°C)',
            mfgDate: '2024-02-01',
            expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
            batchNo: `AMX-${hospitalId.slice(-4)}-01`,
            manufacturer: 'GlaxoSmithKline Pharma',
            quantity: 120,
            unitOriginalPrice: 220,
            concessionPercent: 15,
            hospitalId: hospitalId,
            hospitalName: hosp.name,
            location: `${hosp.city}, ${hosp.state}`,
            distanceKm: 8.5,
            dateAdded: new Date().toISOString().split('T')[0],
            status: 'active',
            notes: 'Essential antibacterial stock for outpatient pharmacy.',
          },
          {
            id: `med-${hospitalId}-102`,
            brandName: 'Paracetamol IV 100ml Infusion',
            genericName: 'Acetaminophen Sterile Infusion',
            power: '10mg/ml (100ml)',
            category: 'Analgesics / Antipyretic',
            storageType: 'Room Temperature (<30°C)',
            mfgDate: '2023-11-01',
            expiryDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0], // Near expiry
            batchNo: `PCM-${hospitalId.slice(-4)}-02`,
            manufacturer: 'Intas Pharmaceuticals',
            quantity: 45,
            unitOriginalPrice: 65,
            concessionPercent: 45,
            hospitalId: hospitalId,
            hospitalName: hosp.name,
            location: `${hosp.city}, ${hosp.state}`,
            distanceKm: 8.5,
            dateAdded: new Date().toISOString().split('T')[0],
            status: 'active',
            notes: 'Near-term surplus batch eligible for priority inter-hospital discount.',
          }
        ];
        medicines.push(...defaultSample);
        setStoredItem(KEYS.MEDICINES, medicines);
        isolatedMedicines = defaultSample;
      }
    }

    // Map and return isolated inventory with comprehensive, consistent medical stock data
    return isolatedMedicines.map((m) => {
      const tot = Number(m.totalQuantity ?? m.quantity ?? 0);
      const res = Number(m.reservedQuantity ?? 0);
      const avail = Math.max(0, Number(m.availableQuantity ?? (tot - res)));
      const reorder = Number(m.reorderLevel ?? m.minStockLevel ?? m.minimumStock ?? 20);
      const mrpVal = Number(m.mrp ?? m.unitOriginalPrice ?? 100);
      const conRate = Number(m.concessionRate ?? m.unitFinalPrice ?? Math.round(mrpVal * (1 - (m.concessionPercent || 15) / 100)));
      const costRateVal = Number(m.costRate ?? m.acquisitionCost ?? Math.round(mrpVal * 0.85));

      const uPerPack = Number(m.unitsPerPack) > 0 ? Number(m.unitsPerPack) : 15;
      const numPacks = m.numberOfPacks !== undefined && Number(m.numberOfPacks) > 0 
        ? Number(m.numberOfPacks) 
        : Math.max(1, Math.ceil(tot / uPerPack));
      const totalU = Number(m.totalUnits) > 0 ? Number(m.totalUnits) : tot;
      const storageCond = m.storageCondition || m.storageType || 'Room Temperature (15°C - 25°C)';
      const pSize = m.packSize || m.packing || `${uPerPack} Units / Strip`;
      const medCode = m.medicineCode || m.masterMedicineId || m.medicineId || ('MED-' + (m.id ? m.id.slice(-4) : 'CAT'));

      return {
        ...m,
        totalQuantity: tot,
        quantity: tot,
        reservedQuantity: res,
        availableQuantity: avail,
        reorderLevel: reorder,
        minStock: reorder,
        minStockLevel: reorder,
        shelfLocation: m.shelfLocation || 'Rack A - Shelf 3',
        packing: pSize,
        packSize: pSize,
        numberOfPacks: numPacks,
        unitsPerPack: uPerPack,
        totalUnits: totalU,
        storageCondition: storageCond,
        storageType: storageCond,
        medicineCode: medCode,
        unit: m.unit || 'Tablet',
        dosage: m.dosage || m.power || m.strength || 'Standard formulation',
        dosageForm: m.dosageForm || m.form || 'Tablet',
        mrp: mrpVal,
        unitOriginalPrice: mrpVal,
        concessionRate: conRate,
        unitFinalPrice: conRate,
        costRate: costRateVal,
        acquisitionCost: costRateVal,
      };
    });
  },

  async addMedicine(medicineData) {
    assertHospitalActive(medicineData.hospitalId);

    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/inventory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(medicineData),
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          const medicines = getStoredItem(KEYS.MEDICINES, []);
          medicines.unshift(json.data);
          setStoredItem(KEYS.MEDICINES, medicines);
          return json.data;
        } else if (response.status === 409 || response.status === 403 || response.status === 422) {
          throw new Error(json?.message || 'Inventory intake rejected');
        }
      }
    } catch (apiErr) {
      if (apiErr.message && !apiErr.message.includes('fetch')) {
        throw apiErr;
      }
    }

    await new Promise((r) => setTimeout(r, 250));

    const qty = Number(medicineData.quantity);
    const unitPrice = Number(medicineData.unitOriginalPrice || medicineData.mrp || 100);

    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Inventory quantity must be greater than zero');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Unit price cannot be negative');

    // Date consistency & near-expiry policy acceptance guards
    if (medicineData.expiryDate) {
      if (!isExpiryAcceptable(medicineData.expiryDate)) {
        throw new Error('Stock cannot be accepted because the medicine expires within 1 month.');
      }
      const exp = calculateMedicineExpiry(medicineData.expiryDate, qty);
      if (exp.isExpired) {
        throw new Error('Stock cannot be accepted because the medicine is expired.');
      }
    }
    if (medicineData.mfgDate && medicineData.expiryDate) {
      const mfg = new Date(medicineData.mfgDate);
      const exp = new Date(medicineData.expiryDate);
      if (mfg > exp) {
        throw new Error('Manufacturing date cannot be later than Expiry date');
      }
    }

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === medicineData.hospitalId) || { name: medicineData.hospitalName || 'Hospital' };

    const batchToMatch = (medicineData.batchNo || medicineData.batchNumber || '').trim().toLowerCase();
    const medNameToMatch = (medicineData.brandName || medicineData.medicineName || '').trim().toLowerCase();

    // Link with master medicine catalogue if medicineId not explicitly supplied
    let targetMedicineId = medicineData.medicineId;
    if (!targetMedicineId && medNameToMatch) {
      const masterMeds = getStoredItem(KEYS.MASTER_MEDICINES, []);
      const masterMatch = masterMeds.find(
        (m) =>
          (m.medicineName || '').trim().toLowerCase() === medNameToMatch ||
          (m.brandName || '').trim().toLowerCase() === medNameToMatch
      );
      if (masterMatch) {
        targetMedicineId = masterMatch.id;
      }
    }

    // DUPLICATE STOCK RULE: Check Same Hospital + Same Medicine + Same Batch
    const existingIndex = medicines.findIndex((m) => {
      if (m.hospitalId !== medicineData.hospitalId) return false;
      const existingBatch = (m.batchNo || m.batchNumber || '').trim().toLowerCase();
      if (!existingBatch || existingBatch !== batchToMatch) return false;

      if (targetMedicineId && m.medicineId && m.medicineId === targetMedicineId) {
        return true;
      }
      const existingMedName = (m.brandName || m.medicineName || '').trim().toLowerCase();
      return existingMedName === medNameToMatch && existingMedName.length > 0;
    });

    const mrpRate = Number(medicineData.mrp || unitPrice || 100);
    const policyPricing = getExpiryPricing(medicineData.expiryDate, mrpRate);
    const concRate = policyPricing.sellingPricePerUnit;
    const concPercent = policyPricing.concessionPercent;
    const acqCost = Number(medicineData.costRate || medicineData.acquisitionCost || Math.round(mrpRate * 0.85));
    const reorder = Number(medicineData.reorderLevel || medicineData.minStockLevel || medicineData.minimumStockLevel || 20);

    if (existingIndex !== -1) {
      // DUPLICATE MATCH: Add new quantity to existing quantity instead of creating a new row
      const existing = medicines[existingIndex];
      const previousQty = Number(existing.quantity || existing.totalQuantity || 0);
      const newTotal = previousQty + qty;
      existing.quantity = newTotal;
      existing.totalQuantity = newTotal;
      const reserved = Number(existing.reservedQuantity || 0);
      existing.availableQuantity = Math.max(0, newTotal - reserved);
      existing.updatedAt = new Date().toISOString();
      if (unitPrice > 0) {
        existing.unitOriginalPrice = mrpRate;
        existing.mrp = mrpRate;
      }
      if (medicineData.concessionRate) existing.concessionRate = concRate;
      if (medicineData.costRate) {
        existing.costRate = acqCost;
        existing.acquisitionCost = acqCost;
      }
      const uPerPack = Number(medicineData.unitsPerPack) > 0 ? Number(medicineData.unitsPerPack) : (existing.unitsPerPack || 15);
      const addPacks = Number(medicineData.numberOfPacks) > 0 ? Number(medicineData.numberOfPacks) : Math.max(1, Math.ceil(qty / uPerPack));
      const prevPacks = Number(existing.numberOfPacks) || Math.ceil(previousQty / uPerPack);
      existing.numberOfPacks = prevPacks + addPacks;
      existing.unitsPerPack = uPerPack;
      existing.totalUnits = newTotal;
      existing.packSize = medicineData.packSize || existing.packSize || existing.packing || `${uPerPack} Units / Strip`;
      existing.packing = existing.packSize;
      existing.storageCondition = medicineData.storageCondition || existing.storageCondition || existing.storageType || 'Room Temperature (15°C - 25°C)';
      existing.storageType = existing.storageCondition;
      if (medicineData.medicineCode) existing.medicineCode = medicineData.medicineCode;
      if (medicineData.shelfLocation) existing.shelfLocation = medicineData.shelfLocation;
      if (medicineData.unit) existing.unit = medicineData.unit;
      if (medicineData.reorderLevel) {
        existing.reorderLevel = reorder;
        existing.minStockLevel = reorder;
      }
      existing.concessionPercent = concPercent;
      existing.concessionRate = concRate;
      if (medicineData.notes) {
        existing.notes = existing.notes
          ? `${existing.notes} | Stock increment: +${qty} units`
          : medicineData.notes;
      }
      if (targetMedicineId && !existing.medicineId) {
        existing.medicineId = targetMedicineId;
      }

      setStoredItem(KEYS.MEDICINES, medicines);

      // Record in Stock History
      const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
      stockHist.unshift({
        id: 'sh-hosp-' + Date.now(),
        medicineId: existing.id,
        medicineName: existing.brandName || existing.medicineName,
        batchNo: existing.batchNo,
        hospitalId: existing.hospitalId,
        hospitalName: existing.hospitalName,
        action: 'Purchase',
        actionType: 'Purchase',
        movementType: 'Purchase',
        quantityDelta: qty,
        previousStock: previousQty,
        resultingStock: newTotal,
        performedBy: existing.hospitalName + ' Staff',
        shelfLocation: existing.shelfLocation,
        supplier: medicineData.supplier || 'Hospital Direct Procurement',
        acquisitionCost: acqCost,
        mrp: mrpRate,
        concessionRate: concRate,
        reason: medicineData.notes || 'Hospital batch intake procurement',
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });
      setStoredItem(KEYS.STOCK_HISTORY, stockHist);

      auditService.logEvent({
        action: 'INVENTORY_MERGED',
        entityType: 'INVENTORY',
        entityId: existing.id,
        actorRole: 'hospital',
        hospitalId: existing.hospitalId,
        hospitalName: existing.hospitalName,
        summary: `Incremented existing stock for ${existing.brandName} (Batch ${existing.batchNo}) by +${qty} units. Previous: ${previousQty}, New Total: ${existing.quantity}.`,
        resultingStatus: existing.status || 'active',
        metadata: {
          addedQuantity: qty,
          previousQuantity: previousQty,
          totalQuantity: existing.quantity,
          batchNo: existing.batchNo,
        },
      });

      return existing;
    }

    const uPerPack = Number(medicineData.unitsPerPack) > 0 ? Number(medicineData.unitsPerPack) : 15;
    const numPacks = Number(medicineData.numberOfPacks) > 0 ? Number(medicineData.numberOfPacks) : Math.max(1, Math.ceil(qty / uPerPack));
    const resolvedPackSize = medicineData.packSize || medicineData.packing || `${uPerPack} Units / Strip`;
    const resolvedStorage = medicineData.storageCondition || medicineData.storageType || 'Room Temperature (15°C - 25°C)';
    const medCode = medicineData.medicineCode || targetMedicineId || ('MED-' + Math.floor(1000 + Math.random() * 9000));

    // NEW INVENTORY RECORD: Create separate row for new batch / new hospital
    const newMed = {
      id: 'med-' + Date.now(),
      medicineId: targetMedicineId || null,
      ...medicineData,
      brandName: medicineData.brandName || medicineData.medicineName || 'Medicine',
      medicineName: medicineData.brandName || medicineData.medicineName || 'Medicine',
      genericName: medicineData.genericName || '',
      dosage: medicineData.dosage || medicineData.power || '',
      power: medicineData.power || medicineData.dosage || '',
      strength: medicineData.power || medicineData.dosage || '',
      dosageForm: medicineData.dosageForm || medicineData.form || 'Tablet',
      form: medicineData.form || medicineData.dosageForm || 'Tablet',
      packing: resolvedPackSize,
      packSize: resolvedPackSize,
      numberOfPacks: numPacks,
      unitsPerPack: uPerPack,
      totalUnits: qty,
      storageCondition: resolvedStorage,
      storageType: resolvedStorage,
      medicineCode: medCode,
      unit: medicineData.unit || 'Tablet',
      batchNo: medicineData.batchNo || 'BAT-' + Math.floor(10000 + Math.random() * 90000),
      batchNumber: medicineData.batchNo || 'BAT-' + Math.floor(10000 + Math.random() * 90000),
      mfgDate: medicineData.mfgDate || new Date().toISOString().split('T')[0],
      expiryDate: medicineData.expiryDate,
      hospitalName: hosp.name,
      quantity: qty,
      totalQuantity: qty,
      reservedQuantity: 0,
      availableQuantity: qty,
      reorderLevel: reorder,
      minStockLevel: reorder,
      shelfLocation: medicineData.shelfLocation || 'Rack A - Shelf 3',
      mrp: mrpRate,
      unitOriginalPrice: mrpRate,
      concessionRate: concRate,
      unitFinalPrice: concRate,
      costRate: acqCost,
      acquisitionCost: acqCost,
      supplier: medicineData.supplier || 'Hospital Direct Procurement',
      purchaseDate: medicineData.purchaseDate || new Date().toISOString().split('T')[0],
      source: 'Purchase',
      concessionPercent: concPercent,
      dateAdded: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: medicineData.status || 'active',
      distanceKm: Number(medicineData.distanceKm) || 12,
    };

    medicines.unshift(newMed);
    setStoredItem(KEYS.MEDICINES, medicines);

    // Record in Stock History
    const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
    stockHist.unshift({
      id: 'sh-hosp-' + Date.now(),
      medicineId: newMed.id,
      medicineName: newMed.brandName,
      batchNo: newMed.batchNo,
      hospitalId: newMed.hospitalId,
      hospitalName: newMed.hospitalName,
      action: 'Purchase',
      actionType: 'Purchase',
      movementType: 'Purchase',
      quantityDelta: qty,
      previousStock: 0,
      resultingStock: qty,
      performedBy: newMed.hospitalName + ' Staff',
      shelfLocation: newMed.shelfLocation,
      supplier: newMed.supplier,
      acquisitionCost: acqCost,
      mrp: mrpRate,
      concessionRate: concRate,
      reason: medicineData.notes || 'Hospital initial batch procurement',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    });
    setStoredItem(KEYS.STOCK_HISTORY, stockHist);

    // Audit trail logging
    auditService.logEvent({
      action: 'INVENTORY_ADDED',
      entityType: 'INVENTORY',
      entityId: newMed.id,
      actorRole: 'hospital',
      hospitalId: newMed.hospitalId,
      hospitalName: newMed.hospitalName,
      summary: `Added ${newMed.brandName} (${newMed.quantity} units, Batch: ${newMed.batchNo}) to hospital inventory.`,
      resultingStatus: 'active',
      metadata: { quantity: newMed.quantity, batchNo: newMed.batchNo, unitOriginalPrice: newMed.unitOriginalPrice },
    });

    return newMed;
  },

  async getMasterMedicines() {
    return getStoredItem(KEYS.MASTER_MEDICINES, []);
  },

  async updateMedicine(id, updatedData) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedData),
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          const medicines = getStoredItem(KEYS.MEDICINES, []);
          const idx = medicines.findIndex((m) => m.id === id);
          if (idx !== -1) {
            medicines[idx] = { ...medicines[idx], ...json.data };
            setStoredItem(KEYS.MEDICINES, medicines);
          }
          return json.data;
        }
      }
    } catch (apiErr) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const index = medicines.findIndex((m) => m.id === id);
    if (index === -1) throw new Error('Medicine not found');
    const authHospitalId = resolveHospitalId();
    const session = getStoredItem(KEYS.AUTH, null);
    if (session?.user?.role === 'hospital' && medicines[index].hospitalId !== authHospitalId) {
      throw new Error('Unauthorized: You can only update medicines in your own hospital inventory');
    }
    assertHospitalActive(medicines[index].hospitalId);

    // Guard: Disposed medicine cannot be edited or reactivated
    if (medicines[index].status === 'disposed') {
      throw new Error('Cannot update or reactivate a permanently disposed medicine batch');
    }

    const updatedQty = updatedData.quantity !== undefined ? Number(updatedData.quantity) : Number(medicines[index].quantity || medicines[index].totalQuantity || 0);
    const updatedPrice = updatedData.unitOriginalPrice !== undefined ? Number(updatedData.unitOriginalPrice) : Number(medicines[index].unitOriginalPrice || medicines[index].mrp || 0);

    if (!Number.isFinite(updatedQty) || updatedQty < 0) throw new Error('Quantity cannot be negative');
    if (!Number.isFinite(updatedPrice) || updatedPrice < 0) throw new Error('Price cannot be negative');

    // Date consistency check
    const mfgDate = updatedData.mfgDate || medicines[index].mfgDate;
    const expDate = updatedData.expiryDate || medicines[index].expiryDate;
    if (mfgDate && expDate) {
      if (new Date(mfgDate) > new Date(expDate)) {
        throw new Error('Manufacturing date cannot be later than Expiry date');
      }
    }

    if (expDate && !isExpiryAcceptable(expDate)) {
      throw new Error('Stock cannot be accepted because the medicine expires within 1 month.');
    }

    const prevTotal = Number(medicines[index].quantity || medicines[index].totalQuantity || 0);
    const reserved = Number(medicines[index].reservedQuantity || 0);
    const newTotal = updatedQty;
    const newAvailable = Math.max(0, newTotal - reserved);
    const reorderVal = updatedData.reorderLevel !== undefined ? Number(updatedData.reorderLevel) : (medicines[index].reorderLevel || medicines[index].minStockLevel || 20);

    const policyPricing = getExpiryPricing(expDate, updatedPrice);

    medicines[index] = {
      ...medicines[index],
      ...updatedData,
      quantity: newTotal,
      totalQuantity: newTotal,
      availableQuantity: newAvailable,
      totalUnits: newTotal,
      numberOfPacks: updatedData.numberOfPacks !== undefined ? Number(updatedData.numberOfPacks) : (medicines[index].numberOfPacks || Math.ceil(newTotal / (updatedData.unitsPerPack || medicines[index].unitsPerPack || 15))),
      unitsPerPack: updatedData.unitsPerPack !== undefined ? Number(updatedData.unitsPerPack) : (medicines[index].unitsPerPack || 15),
      packSize: updatedData.packSize || updatedData.packing || medicines[index].packSize || medicines[index].packing || '15 Tablets / Strip',
      packing: updatedData.packSize || updatedData.packing || medicines[index].packSize || medicines[index].packing || '15 Tablets / Strip',
      storageCondition: updatedData.storageCondition || updatedData.storageType || medicines[index].storageCondition || medicines[index].storageType || 'Room Temperature (15°C - 25°C)',
      storageType: updatedData.storageCondition || updatedData.storageType || medicines[index].storageCondition || medicines[index].storageType || 'Room Temperature (15°C - 25°C)',
      medicineCode: updatedData.medicineCode || medicines[index].medicineCode || ('MED-' + (id.slice(-4))),
      unitOriginalPrice: updatedPrice,
      mrp: Number(updatedData.mrp || updatedPrice),
      concessionRate: policyPricing.sellingPricePerUnit,
      unitFinalPrice: policyPricing.sellingPricePerUnit,
      costRate: Number(updatedData.costRate || medicines[index].costRate || Math.round(updatedPrice * 0.85)),
      acquisitionCost: Number(updatedData.acquisitionCost || updatedData.costRate || medicines[index].acquisitionCost || Math.round(updatedPrice * 0.85)),
      shelfLocation: updatedData.shelfLocation || medicines[index].shelfLocation || 'Rack A - Shelf 3',
      unit: updatedData.unit || medicines[index].unit || 'Tablet',
      reorderLevel: reorderVal,
      minStockLevel: reorderVal,
      concessionPercent: policyPricing.concessionPercent,
    };

    setStoredItem(KEYS.MEDICINES, medicines);

    // If stock quantity was adjusted, record a Stock Adjustment in history
    if (newTotal !== prevTotal) {
      const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
      stockHist.unshift({
        id: 'sh-adj-' + Date.now(),
        medicineId: medicines[index].id,
        medicineName: medicines[index].brandName || medicines[index].medicineName,
        batchNo: medicines[index].batchNo,
        hospitalId: medicines[index].hospitalId,
        hospitalName: medicines[index].hospitalName,
        action: 'Stock Adjustment',
        actionType: 'Stock Adjustment',
        movementType: 'Stock Adjustment',
        quantityDelta: newTotal - prevTotal,
        previousStock: prevTotal,
        resultingStock: newTotal,
        availableStock: newAvailable,
        performedBy: medicines[index].hospitalName + ' Staff',
        shelfLocation: medicines[index].shelfLocation,
        reason: updatedData.notes || 'Hospital staff inventory audit reconciliation',
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });
      setStoredItem(KEYS.STOCK_HISTORY, stockHist);
    }

    auditService.logEvent({
      action: 'INVENTORY_UPDATED',
      entityType: 'INVENTORY',
      entityId: medicines[index].id,
      actorRole: 'hospital',
      hospitalId: medicines[index].hospitalId,
      hospitalName: medicines[index].hospitalName,
      summary: `Updated inventory record for ${medicines[index].brandName}.`,
      resultingStatus: medicines[index].status || 'active',
      metadata: { quantity: medicines[index].quantity, batchNo: medicines[index].batchNo },
    });

    return medicines[index];
  },

  async disposeMedicine({ hospitalId: hospitalIdParam, medicineId, reason, facilityName }) {
    await new Promise((r) => setTimeout(r, 200));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const medIdx = medicines.findIndex((m) => m.id === medicineId);
    if (medIdx === -1) throw new Error('Medicine not found in inventory');

    const med = medicines[medIdx];
    if (med.status === 'disposed') {
      throw new Error('This medicine batch has already been certified as disposed');
    }
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === hospitalId) || { name: med.hospitalName || 'Hospital Pharmacy' };

    // Format current date/time
    const now = new Date();
    const formattedDateTime = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Calculate days expired
    const daysExpired = med.expiryDate 
      ? Math.max(1, Math.ceil((Date.now() - new Date(med.expiryDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // 1. Mark as disposed in single source of truth (Inventory)
    medicines[medIdx] = {
      ...med,
      status: 'disposed',
      disposedDate: formattedDateTime,
      usableQuantity: 0,
    };
    setStoredItem(KEYS.MEDICINES, medicines);

    // 2. Append to Disposal History
    const disposals = getStoredItem(KEYS.DISPOSALS, []);
    const disposalCentre = facilityName || 'GreenBio Medical Waste Centre';
    const newDisposal = {
      id: 'disp-' + Date.now(),
      hospitalId: hospitalId || med.hospitalId,
      hospitalName: hosp.name || med.hospitalName,
      medicineId: med.id,
      medicineName: med.brandName,
      brandName: med.brandName,
      genericName: med.genericName || '',
      power: med.power || '',
      form: med.form || 'Tablet',
      batchNo: med.batchNo || 'BAT-EXP-01',
      quantity: med.quantity,
      unit: 'units',
      expiryDate: med.expiryDate,
      daysExpired,
      wasteCategory: 'Expired Pharmaceuticals (Bio-Medical Waste)',
      reason: reason || 'Statutory Expiration Safe Bio-Disposal',
      facilityName: disposalCentre,
      bioCentreName: disposalCentre,
      bioCentreAddress: 'Plot G-14, Medical Waste Treatment Zone, Taloja MIDC, Navi Mumbai 410208',
      treatmentMethod: 'High-Temperature Thermal Incineration (1100°C)',
      status: 'Disposed',
      disposalDate: formattedDateTime,
      certificateId: 'CPCB-DISP-' + Math.floor(100000 + Math.random() * 900000),
      manifestNumber: 'GBW-BMW-' + Math.floor(10000 + Math.random() * 90000),
      isDemoSimulation: true,
    };

    disposals.unshift(newDisposal);
    setStoredItem(KEYS.DISPOSALS, disposals);

    // 3. Log audit event
    auditService.logEvent({
      action: 'BIO_WASTE_DISPOSED',
      entityType: 'WASTE',
      entityId: newDisposal.id,
      hospitalId: newDisposal.hospitalId,
      hospitalName: newDisposal.hospitalName,
      summary: `Disposed ${newDisposal.quantity} units of expired ${newDisposal.medicineName} (Batch: ${newDisposal.batchNo}) at ${disposalCentre}.`,
      resultingStatus: 'Disposed',
      metadata: { medicineId: med.id, batchNo: newDisposal.batchNo, quantity: newDisposal.quantity }
    });

    return { updatedMedicine: medicines[medIdx], newDisposal };
  },

  async deleteMedicine(id) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success) {
          const medicines = getStoredItem(KEYS.MEDICINES, []);
          const filtered = medicines.filter((m) => m.id !== id);
          setStoredItem(KEYS.MEDICINES, filtered);
          return true;
        }
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const medicine = medicines.find((m) => m.id === id);
    if (!medicine) throw new Error('Medicine not found');
    const authHospitalId = resolveHospitalId();
    const session = getStoredItem(KEYS.AUTH, null);
    if (session?.user?.role === 'hospital' && medicine.hospitalId !== authHospitalId) {
      throw new Error('Unauthorized: You can only delete medicines from your own hospital inventory');
    }
    assertHospitalActive(medicine.hospitalId);

    const filtered = medicines.filter((m) => m.id !== id);
    setStoredItem(KEYS.MEDICINES, filtered);

    auditService.logEvent({
      action: 'INVENTORY_DELETED',
      entityType: 'INVENTORY',
      entityId: medicine.id,
      hospitalId: medicine.hospitalId,
      hospitalName: medicine.hospitalName,
      summary: `Removed ${medicine.brandName} from verified inventory.`,
      resultingStatus: 'removed',
      metadata: { brandName: medicine.brandName, batchNo: medicine.batchNo },
    });

    return true;
  },

  async adjustStock(id, { quantityChange, reason }) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}/adjust`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ quantityChange, reason }),
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          return json.data;
        } else if (response.status === 400 || response.status === 422 || response.status === 403) {
          throw new Error(json?.message || 'Stock adjustment rejected');
        }
      }
    } catch (apiErr) {
      if (apiErr.message && !apiErr.message.includes('fetch')) throw apiErr;
    }
    return this.updateMedicine(id, { quantityChange, reason });
  },

  async getStockHistory(id) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}/history`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          return json.data;
        }
      }
    } catch (e) {
      // fallback
    }
    const history = getStoredItem(KEYS.STOCK_HISTORY, []);
    return history.filter((h) => h.medicineId === id);
  },

  async importInventoryBatch(hospitalIdParam, { itemsToCreate = [], itemsToUpdate = [], skippedCount = 0, stats = {} }) {
    await new Promise((r) => setTimeout(r, 300));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) throw new Error('Hospital identity not specified');
    assertHospitalActive(hospitalId);

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === hospitalId) || { name: 'Hospital Pharmacy', city: 'Mumbai', state: 'MH' };

    // 1. Process Updates
    itemsToUpdate.forEach((updateItem) => {
      const idx = medicines.findIndex((m) => 
        (updateItem.id && m.id === updateItem.id) ||
        (m.hospitalId === hospitalId && 
         m.brandName?.toLowerCase().trim() === updateItem.brandName?.toLowerCase().trim() && 
         m.batchNo?.toLowerCase().trim() === updateItem.batchNo?.toLowerCase().trim())
      );

      if (idx !== -1) {
        const currentMed = medicines[idx];
        const newQty = updateItem.quantity !== undefined ? Number(updateItem.quantity) : currentMed.quantity;
        const newPrice = updateItem.unitOriginalPrice !== undefined ? Number(updateItem.unitOriginalPrice) : currentMed.unitOriginalPrice;
        const exp = calculateMedicineExpiry(updateItem.expiryDate || currentMed.expiryDate, newQty);

        medicines[idx] = {
          ...currentMed,
          ...updateItem,
          id: currentMed.id,
          hospitalId: currentMed.hospitalId,
          hospitalName: currentMed.hospitalName,
          quantity: Math.max(0, newQty),
          unitOriginalPrice: Math.max(0, newPrice),
          status: exp.isExpired ? 'expired' : (currentMed.status === 'expired' ? 'active' : currentMed.status || 'active'),
          lastUpdated: new Date().toISOString().split('T')[0],
        };
      }
    });

    // 2. Process Creations
    const timestamp = Date.now();
    itemsToCreate.forEach((item, index) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitOriginalPrice) || 50);
      
      // Enforce hard near-expiry rejection rule
      if (!isExpiryAcceptable(item.expiryDate)) {
        return; // Do not import batches with <= 1 month shelf life or expired
      }

      const policyPricing = getExpiryPricing(item.expiryDate, unitPrice);
      const exp = calculateMedicineExpiry(item.expiryDate, qty);

      const newMedicine = {
        id: `med-${hospitalId}-${timestamp}-${index + 1}`,
        brandName: item.brandName.trim(),
        genericName: item.genericName || item.brandName.trim(),
        power: item.power || (item.category ? `${item.category}` : 'Formulation'),
        category: item.category || 'General Formulation',
        storageType: item.storageType || 'Room Temperature (15°C - 25°C)',
        mfgDate: item.mfgDate || new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0],
        expiryDate: item.expiryDate,
        batchNo: item.batchNo.trim(),
        manufacturer: item.manufacturer || 'Standard Pharma Corp',
        quantity: qty,
        unitOriginalPrice: unitPrice,
        mrp: unitPrice,
        concessionPercent: policyPricing.concessionPercent,
        concessionRate: policyPricing.sellingPricePerUnit,
        unitFinalPrice: policyPricing.sellingPricePerUnit,
        hospitalId: hospitalId,
        hospitalName: hosp.name,
        location: hosp.city && hosp.state ? `${hosp.city}, ${hosp.state}` : 'Hospital Pharmacy',
        distanceKm: Number(item.distanceKm) || 10,
        dateAdded: new Date().toISOString().split('T')[0],
        status: exp.isExpired ? 'expired' : 'active',
        minStockThreshold: Number(item.minStockThreshold) || 25,
        unit: item.unit || 'Units',
        notes: item.notes || 'Imported via Hospital CSV system.',
      };

      medicines.unshift(newMedicine);
    });

    // 3. Persist atomically
    setStoredItem(KEYS.MEDICINES, medicines);

    // 4. Log audit trail event
    auditService.logEvent({
      action: 'INVENTORY_IMPORTED_CSV',
      entityType: 'INVENTORY',
      entityId: `import-${timestamp}`,
      hospitalId: hospitalId,
      hospitalName: hosp.name,
      summary: `Imported ${itemsToCreate.length + itemsToUpdate.length} inventory records via CSV (${itemsToCreate.length} added, ${itemsToUpdate.length} updated, ${skippedCount} skipped).`,
      resultingStatus: 'completed',
      metadata: {
        totalRecords: itemsToCreate.length + itemsToUpdate.length + skippedCount,
        addedCount: itemsToCreate.length,
        updatedCount: itemsToUpdate.length,
        skippedCount: skippedCount,
        expiredCount: stats?.expiredCount || 0,
        nearExpiryCount: stats?.nearExpiryCount || 0,
        lowStockCount: stats?.lowStockCount || 0,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      addedCount: itemsToCreate.length,
      updatedCount: itemsToUpdate.length,
      skippedCount: skippedCount,
      totalHospitalInventory: medicines.filter((m) => m.hospitalId === hospitalId),
    };
  },

  // ==========================================
  // 3. MARKETPLACE (Only valid active listings)
  // ==========================================
  async getMarketplace(currentHospitalId, filters = {}) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const queryParams = new URLSearchParams();
        if (filters.search) queryParams.set('search', filters.search);
        if (filters.dosageForm && filters.dosageForm !== 'all') queryParams.set('dosageForm', filters.dosageForm);
        const response = await fetch(`${API_BASE_URL}/marketplace?${queryParams.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          const items = json.data.items || json.data.listings || json.data;
          if (Array.isArray(items) && items.length > 0) {
            return items;
          }
        }
      }
    } catch (e) {
      // offline fallback
    }

    await new Promise((r) => setTimeout(r, 200));
    const medicines = getStoredItem(KEYS.MEDICINES, []);

    // HIDE own hospital medicines, HIDE zero quantity, and HIDE expired medicines
    let results = medicines.filter((m) => {
      if (m.hospitalId === currentHospitalId) return false;
      if (Number(m.quantity) <= 0) return false;
      if (m.status === 'pending_disposal' || m.status === 'disposed') return false;

      // Policy Hard Acceptance Rule: Expired or <= 1 month medicines must NEVER appear in marketplace
      if (!isExpiryAcceptable(m.expiryDate)) return false;
      const exp = calculateMedicineExpiry(m.expiryDate);
      if (exp.isExpired) return false;

      return true;
    });

    // Medicine form / dosage search with composition-based alternative matching
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const directMatches = results.filter((m) =>
        m.brandName.toLowerCase().includes(q) ||
        m.genericName?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.power.toLowerCase().includes(q) ||
        m.hospitalName.toLowerCase().includes(q)
      );

      // Find exact composition alternatives for any direct matches
      const altIds = new Set();
      directMatches.forEach((directMed) => {
        const alts = findAlternatives(directMed, results);
        alts.forEach((alt) => altIds.add(alt.id));
      });

      const directList = results.filter((m) => directMatches.some((dm) => dm.id === m.id));
      const altList = results.filter((m) => !directMatches.some((dm) => dm.id === m.id) && altIds.has(m.id));
      results = [...directList, ...altList];
    }
    if (filters.power) {
      const p = filters.power.toLowerCase();
      results = results.filter((m) => m.power.toLowerCase().includes(p));
    }
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      results = results.filter((m) => m.location.toLowerCase().includes(loc));
    }
    if (filters.storageType) {
      results = results.filter((m) => m.storageType?.toLowerCase().includes(filters.storageType.toLowerCase()));
    }
    if (filters.dosageForm && filters.dosageForm !== 'all') {
      const form = filters.dosageForm.toLowerCase();
      results = results.filter((m) =>
        m.power.toLowerCase().includes(form) ||
        m.brandName.toLowerCase().includes(form) ||
        m.category.toLowerCase().includes(form)
      );
    }

    return results;
  },

  // ==========================================
  // 4. REQUESTS & 48-HOUR SLA & FIRST ACCEPTANCE WINS
  // ==========================================
  async createRequest(reqData) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            inventoryLotId: reqData.inventoryLotId || reqData.lotId || reqData.medicineId,
            medicineId: reqData.medicineId,
            quantity: Number(reqData.quantity),
            priority: reqData.priority || 'standard',
            deliveryAddress: reqData.deliveryAddress || '',
            notes: reqData.notes || '',
          }),
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          const created = json.data;
          const requests = getStoredItem(KEYS.REQUESTS, []);
          requests.unshift(created);
          setStoredItem(KEYS.REQUESTS, requests);
          return created;
        } else if (!response.ok && json?.error?.message) {
          throw new Error(json.error.message);
        }
      }
    } catch (e) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Failed to fetch')) {
        throw e;
      }
      // offline fallback
    }

    await new Promise((r) => setTimeout(r, 300));
    assertHospitalActive(reqData.fromHospitalId);

    const qty = Number(reqData.quantity);
    if (qty <= 0) throw new Error('Requisition quantity must be greater than zero');

    // Verify medicine stock available
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const targetMed = medicines.find((m) => m.id === reqData.medicineId);
    if (!targetMed) throw new Error('Target medicine listing not found');

    // Guard: Cannot request own hospital's inventory
    if (reqData.fromHospitalId && targetMed.hospitalId && reqData.fromHospitalId === targetMed.hospitalId) {
      throw new Error('Hospitals cannot submit requisitions for their own inventory items');
    }

    if (targetMed.quantity < qty) {
      throw new Error(`Requested quantity (${qty}) exceeds available stock (${targetMed.quantity})`);
    }

    // Check expiry under policy
    if (!isExpiryAcceptable(targetMed.expiryDate)) {
      throw new Error('Stock cannot be requested because the medicine expires within 1 month.');
    }
    const exp = calculateMedicineExpiry(targetMed.expiryDate);
    if (exp.isExpired) throw new Error('Cannot request an expired medicine');

    const requests = getStoredItem(KEYS.REQUESTS, []);
    const requestDate = new Date().toISOString();
    const expiryDate = calculateRequestExpiry(requestDate, 48).expiryDate;

    // Pricing calculation
    const isCold = targetMed.storageType?.toLowerCase().includes('cold');
    const pricing = calculateOrderPricing({
      unitOriginalPrice: targetMed.unitOriginalPrice,
      expiryDate: targetMed.expiryDate,
      concessionPercent: targetMed.concessionPercent,
      quantity: qty,
      distanceKm: targetMed.distanceKm || 15,
      isColdChain: isCold,
    });

    const newReq = {
      id: 'req-' + Date.now(),
      requirementGroupId: reqData.requirementGroupId || `req-grp-${reqData.fromHospitalId}-${targetMed.brandName.slice(0, 5)}-${qty}`,
      medicineId: reqData.medicineId,
      medicineName: `${targetMed.brandName} (${targetMed.power})`,
      power: targetMed.power,
      quantity: qty,
      unitOriginalPrice: pricing.unitOriginalPrice,
      concessionPercent: pricing.concessionPercent,
      unitFinalPrice: pricing.unitSellingPrice,
      logisticsFee: pricing.logisticsFee,
      gstAmount: pricing.gstAmount,
      totalAmount: pricing.totalPayable,
      fromHospitalId: reqData.fromHospitalId,
      fromHospitalName: reqData.fromHospitalName,
      toHospitalId: reqData.toHospitalId,
      toHospitalName: reqData.toHospitalName,
      requestDate,
      expiryDate,
      status: 'pending',
      rejectReason: null,
      transactionId: 'TXN-' + Math.floor(100000 + Math.random() * 900000),
      paymentId: null,
      paymentStatus: 'pending',
      notes: reqData.notes || '',
    };

    requests.unshift(newReq);
    setStoredItem(KEYS.REQUESTS, requests);

    auditService.logEvent({
      action: 'REQUEST_CREATED',
      entityType: 'REQUEST',
      entityId: newReq.id,
      hospitalId: newReq.fromHospitalId,
      hospitalName: newReq.fromHospitalName,
      partnerHospitalId: newReq.toHospitalId,
      partnerHospitalName: newReq.toHospitalName,
      summary: `Created requisition for ${newReq.quantity} units of ${newReq.medicineName} from ${newReq.toHospitalName}.`,
      resultingStatus: 'pending',
      metadata: { quantity: newReq.quantity, totalAmount: newReq.totalAmount, expiryDate: newReq.expiryDate },
    });

    return newReq;
  },

  async getOutgoingRequests(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) return [];

    const allRequests = getStoredItem(KEYS.REQUESTS, []);
    const { requests: refreshedRequests, hasExpiredChanges } = processExpiredRequests(allRequests);
    if (hasExpiredChanges) {
      setStoredItem(KEYS.REQUESTS, refreshedRequests);
    }

    return refreshedRequests.filter((r) => r.fromHospitalId === hospitalId);
  },

  async getIncomingRequests(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) return [];

    const allRequests = getStoredItem(KEYS.REQUESTS, []);
    const { requests: refreshedRequests, hasExpiredChanges } = processExpiredRequests(allRequests);
    if (hasExpiredChanges) {
      setStoredItem(KEYS.REQUESTS, refreshedRequests);
    }

    return refreshedRequests.filter((r) => r.toHospitalId === hospitalId);
  },

  /**
   * Responds to request: 'accept' or 'reject'.
   * Implements FIRST ACCEPTANCE WINS:
   * When accepted, reserves/deducts stock and automatically declines competing pending requests!
   */
  async handleRequest(requestId, action, reason = '', hospitalId) {
    await new Promise((r) => setTimeout(r, 300));
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) throw new Error('Requisition not found');

    const targetReq = requests[reqIndex];
    assertHospitalActive(hospitalId || targetReq.toHospitalId);

    // Guard: Expired requests cannot be accepted
    const sla = calculateRequestExpiry(targetReq.requestDate);
    if (targetReq.status === 'expired' || sla.isExpired) {
      targetReq.status = 'expired';
      targetReq.rejectReason = 'Automated 48-Hour SLA Expiration';
      setStoredItem(KEYS.REQUESTS, requests);
      throw new Error('Cannot accept requisition: 48-hour SLA has elapsed and request has expired.');
    }

    if (targetReq.status !== 'pending') {
      throw new Error(`Cannot process requisition: Current status is already "${targetReq.status}"`);
    }

    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const rejectedCompetingRequests = [];

    if (action === 'accept') {
      // 1. Stock Check & Reservation in Seller's Inventory (Total = Reserved + Available)
      const medIndex = medicines.findIndex((m) => m.id === targetReq.medicineId && m.hospitalId === targetReq.toHospitalId);
      if (medIndex === -1) {
        throw new Error('Associated medicine record not found in your inventory');
      }

      const totQty = Number(medicines[medIndex].totalQuantity || medicines[medIndex].quantity || 0);
      const curRes = Number(medicines[medIndex].reservedQuantity || 0);
      const availableQty = Math.max(0, totQty - curRes);

      if (availableQty < targetReq.quantity) {
        throw new Error(`Insufficient inventory stock: You only have ${availableQty} units available, but ${targetReq.quantity} were requested.`);
      }

      // Safe stock reservation (Prevent negative inventory)
      const newRes = curRes + Number(targetReq.quantity);
      medicines[medIndex].totalQuantity = totQty;
      medicines[medIndex].quantity = totQty;
      medicines[medIndex].reservedQuantity = newRes;
      medicines[medIndex].availableQuantity = Math.max(0, totQty - newRes);
      setStoredItem(KEYS.MEDICINES, medicines);

      // Log Stock History movement: Order Reservation
      const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
      stockHist.unshift({
        id: 'sh-res-' + Date.now(),
        medicineId: medicines[medIndex].id,
        medicineName: medicines[medIndex].brandName || medicines[medIndex].medicineName,
        batchNo: medicines[medIndex].batchNo,
        hospitalId: medicines[medIndex].hospitalId,
        hospitalName: medicines[medIndex].hospitalName,
        action: 'Order Reservation',
        actionType: 'Order Reservation',
        movementType: 'Order Reservation',
        orderId: targetReq.id,
        partnerHospitalId: targetReq.fromHospitalId,
        partnerHospitalName: targetReq.fromHospitalName,
        quantityDelta: 0,
        reservedDelta: Number(targetReq.quantity),
        previousStock: totQty,
        resultingStock: totQty,
        availableStock: medicines[medIndex].availableQuantity,
        concessionRate: targetReq.unitFinalPrice || targetReq.concessionRate,
        performedBy: medicines[medIndex].hospitalName + ' Staff',
        reason: `Reserved ${targetReq.quantity} units for Requisition #${targetReq.transactionId || targetReq.id}`,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });
      setStoredItem(KEYS.STOCK_HISTORY, stockHist);

      // 2. Mark this request as accepted
      targetReq.status = 'accepted';
      targetReq.paymentStatus = 'pending';
      targetReq.rejectReason = null;
      targetReq.acceptedAt = new Date().toISOString();

      // 3. FIRST ACCEPTANCE WINS: Find and decline competing pending requests from the same buyer
      // Deterministic requirement matching: Same buyer hospital AND (same requirementGroupId OR same medicineName and quantity)
      requests.forEach((r, idx) => {
        if (
          idx !== reqIndex &&
          r.status === 'pending' &&
          r.fromHospitalId === targetReq.fromHospitalId &&
          (
            (targetReq.requirementGroupId && r.requirementGroupId === targetReq.requirementGroupId) ||
            (r.medicineName === targetReq.medicineName && r.quantity === targetReq.quantity)
          )
        ) {
          r.status = 'rejected';
          r.rejectReason = `First-acceptance fulfilled: Requisition accepted by ${targetReq.toHospitalName}. Competing request automatically declined.`;
          r.autoDeclined = true;
          rejectedCompetingRequests.push(r);

          auditService.logEvent({
            action: 'COMPETING_REQUEST_REJECTED',
            entityType: 'REQUEST',
            entityId: r.id,
            hospitalId: r.fromHospitalId,
            hospitalName: r.fromHospitalName,
            partnerHospitalId: r.toHospitalId,
            partnerHospitalName: r.toHospitalName,
            summary: `Automated First-Acceptance: Declined competing request for ${r.medicineName} sent to ${r.toHospitalName}.`,
            resultingStatus: 'rejected',
            metadata: { winningRequestId: targetReq.id, winningHospital: targetReq.toHospitalName },
          });
        }
      });

      // Audit trail for accepted request
      auditService.logEvent({
        action: 'REQUEST_ACCEPTED',
        entityType: 'REQUEST',
        entityId: targetReq.id,
        hospitalId: targetReq.toHospitalId,
        hospitalName: targetReq.toHospitalName,
        partnerHospitalId: targetReq.fromHospitalId,
        partnerHospitalName: targetReq.fromHospitalName,
        summary: `Accepted requisition from ${targetReq.fromHospitalName} for ${targetReq.quantity} units of ${targetReq.medicineName}. Reserved inventory stock.`,
        resultingStatus: 'accepted',
        metadata: { quantity: targetReq.quantity, remainingStock: medicines[medIndex].quantity },
      });

    } else if (action === 'reject') {
      targetReq.status = 'rejected';
      targetReq.rejectReason = reason || 'Declined by providing hospital due to clinical inventory allocation.';

      auditService.logEvent({
        action: 'REQUEST_REJECTED',
        entityType: 'REQUEST',
        entityId: targetReq.id,
        hospitalId: targetReq.toHospitalId,
        hospitalName: targetReq.toHospitalName,
        partnerHospitalId: targetReq.fromHospitalId,
        partnerHospitalName: targetReq.fromHospitalName,
        summary: `Declined requisition for ${targetReq.medicineName} from ${targetReq.fromHospitalName}. Reason: ${targetReq.rejectReason}`,
        resultingStatus: 'rejected',
        metadata: { reason: targetReq.rejectReason },
      });
    }

    setStoredItem(KEYS.REQUESTS, requests);

    return {
      acceptedRequest: targetReq,
      rejectedRequests: rejectedCompetingRequests,
      updatedRequest: targetReq,
    };
  },

  /**
   * Retrieves authoritative cancellation policy from backend or computes locally
   */
  async getRequestCancellationPolicy(requestId) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/requests/${requestId}/cancellation-policy`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          return json.data;
        }
      }
    } catch (e) {
      // offline fallback
    }

    const requests = getStoredItem(KEYS.REQUESTS, []);
    const targetReq = requests.find((r) => r.id === requestId);
    if (!targetReq) return null;
    return getCancellationPolicy(targetReq);
  },

  /**
   * Cancels an active requisition with tiered refund policy rules.
   * Safely restores seller-reserved stock if accepted/packed prior to dispatch.
   */
  async cancelRequest({ requestId, reason = 'No longer required', note = '', hospitalId }) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/requests/${requestId}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason, notes: note }),
        });
        const json = await response.json().catch(() => null);
        if (response.ok && json?.success && json?.data) {
          const requests = getStoredItem(KEYS.REQUESTS, []);
          const reqIndex = requests.findIndex((r) => r.id === requestId);
          if (reqIndex !== -1) {
            requests[reqIndex] = { ...requests[reqIndex], ...json.data.request, status: 'cancelled' };
            setStoredItem(KEYS.REQUESTS, requests);
          }
          return json.data;
        } else if (!response.ok && json?.error?.message) {
          throw new Error(json.error.message);
        }
      }
    } catch (e) {
      if (e.message && !e.message.includes('fetch') && !e.message.includes('Failed to fetch')) {
        throw e;
      }
      // offline fallback
    }

    await new Promise((r) => setTimeout(r, 250));
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const reqIndex = requests.findIndex((r) => r.id === requestId);
    if (reqIndex === -1) throw new Error('Requisition not found');

    const targetReq = requests[reqIndex];
    assertHospitalActive(hospitalId || targetReq.fromHospitalId);

    if (targetReq.status === 'cancelled') {
      throw new Error('This requisition has already been cancelled.');
    }

    const policy = getCancellationPolicy(targetReq);
    if (!policy.canCancel) {
      throw new Error(policy.reason || 'This requisition cannot be cancelled at this stage.');
    }

    const { totalAmount, penaltyAmount, refundAmount } = calculateRefundAmounts(targetReq, policy);

    // Stock Safety: If accepted/reviewing/packed (stock was deducted from seller), and NOT dispatched,
    // restore the reserved quantity back to the seller's inventory lot in KEYS.MEDICINES!
    const normalizedStatus = (targetReq.status || '').toLowerCase().replace(/[\-_]/g, ' ');
    const isPreDispatchReserved = ['accepted', 'approved', 'reviewing', 'packed'].includes(normalizedStatus);
    const isDispatched = ['in transit', 'dispatched', 'shipped'].includes(normalizedStatus);

    if (isPreDispatchReserved && !isDispatched) {
      const medicines = getStoredItem(KEYS.MEDICINES, []);
      const medIndex = medicines.findIndex(
        (m) => m.id === targetReq.medicineId && m.hospitalId === targetReq.toHospitalId
      );
      if (medIndex !== -1) {
        const curRes = Number(medicines[medIndex].reservedQuantity || 0);
        const tot = Number(medicines[medIndex].totalQuantity || medicines[medIndex].quantity || 0);
        const relQty = Number(targetReq.quantity || 0);
        const newRes = Math.max(0, curRes - relQty);
        medicines[medIndex].reservedQuantity = newRes;
        medicines[medIndex].totalQuantity = tot;
        medicines[medIndex].quantity = tot;
        medicines[medIndex].availableQuantity = Math.max(0, tot - newRes);
        medicines[medIndex].lastUpdated = new Date().toISOString().split('T')[0];
        setStoredItem(KEYS.MEDICINES, medicines);

        // Record stock movement: Order Release
        const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
        stockHist.unshift({
          id: 'sh-rel-' + Date.now(),
          medicineId: medicines[medIndex].id,
          medicineName: medicines[medIndex].brandName || medicines[medIndex].medicineName,
          batchNo: medicines[medIndex].batchNo,
          hospitalId: medicines[medIndex].hospitalId,
          hospitalName: medicines[medIndex].hospitalName,
          action: 'Order Release',
          actionType: 'Order Release',
          movementType: 'Order Release',
          orderId: targetReq.id,
          partnerHospitalId: targetReq.fromHospitalId,
          partnerHospitalName: targetReq.fromHospitalName,
          quantityDelta: 0,
          releasedQuantity: relQty,
          previousStock: tot,
          resultingStock: tot,
          availableStock: medicines[medIndex].availableQuantity,
          concessionRate: targetReq.unitFinalPrice || targetReq.concessionRate,
          performedBy: 'System / Order Cancellation',
          reason: `Released reservation of ${relQty} units due to requisition cancellation`,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
        });
        setStoredItem(KEYS.STOCK_HISTORY, stockHist);
      }
    }

    // Update Requisition State
    const hadPaid = !!(targetReq.paidDate || targetReq.paymentStatus === 'paid' || targetReq.paymentStatus === 'success');
    targetReq.status = 'cancelled';
    if (hadPaid) {
      targetReq.paymentStatus = 'refunded';
    }
    targetReq.cancellation = {
      cancelledAt: new Date().toISOString(),
      cancelledBy: hospitalId || targetReq.fromHospitalId,
      cancelledByHospitalName: targetReq.fromHospitalName,
      reason: reason || 'Buyer requirement changed',
      note: note || '',
      stage: policy.stage,
      stageLabel: policy.stageLabel,
      penaltyPercent: policy.penaltyPercent,
      penaltyAmount,
      refundPercent: policy.refundPercent,
      refundAmount,
      totalAmount,
      isDemoRefund: true,
      refundStatus: 'Processed (Demo Escrow)',
    };

    setStoredItem(KEYS.REQUESTS, requests);

    // Update related tracking in KEYS.TRACKING if present
    const trackings = getStoredItem(KEYS.TRACKING, []);
    let trackingModified = false;
    const updatedTrackings = trackings.map((t) => {
      if (t.transactionId === targetReq.transactionId || t.trackingNumber === targetReq.trackingNumber) {
        trackingModified = true;
        return {
          ...t,
          status: 'Cancelled',
          cancellationReason: reason,
        };
      }
      return t;
    });
    if (trackingModified) {
      setStoredItem(KEYS.TRACKING, updatedTrackings);
    }

    // Audit Trail Logging
    auditService.logEvent({
      action: 'REQUEST_CANCELLED',
      entityType: 'REQUEST',
      entityId: targetReq.id,
      hospitalId: targetReq.fromHospitalId,
      hospitalName: targetReq.fromHospitalName,
      partnerHospitalId: targetReq.toHospitalId,
      partnerHospitalName: targetReq.toHospitalName,
      summary: `Cancelled requisition for ${targetReq.medicineName} (${targetReq.quantity} units). Reason: ${reason}. Refund: ₹${refundAmount.toLocaleString()} (${policy.refundPercent}%).`,
      resultingStatus: 'cancelled',
      metadata: {
        reason,
        penaltyPercent: policy.penaltyPercent,
        penaltyAmount,
        refundPercent: policy.refundPercent,
        refundAmount,
      },
    });

    return targetReq;
  },

  // ==========================================
  // 5. DEMO PAYMENT SIMULATOR & ESCROW RELEASE
  // ==========================================
  async processPayment({ requestId, paymentMethod = 'Razorpay Escrow Transfer', verification = null, deliveryCharge = 0, distanceKm = null, totalPayable = null }) {
    await new Promise((r) => setTimeout(r, 400));

    // 1. Authoritative backend payment flow
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    let backendPayment = verification?.payment || null;

    if (!backendPayment && token) {
      try {
        const createRes = await fetch(`${API_BASE_URL}/payments/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ requestId, deliveryCharge, distanceKm, totalPayable }),
        });
        const createData = await createRes.json();

        if (createRes.ok && createData?.success && createData?.data) {
          const order = createData.data;
          const providerPaymentId = 'pay_' + Math.random().toString(36).substring(2, 12);
          const providerSignature = `mock_sig_${order.providerOrderId}_${providerPaymentId}`;

          const verifyRes = await fetch(`${API_BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              paymentId: order.paymentId,
              providerOrderId: order.providerOrderId,
              providerPaymentId,
              providerSignature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData?.success && verifyData?.data?.payment) {
            backendPayment = verifyData.data.payment;
          }
        }
      } catch (apiErr) {
        // Fall through to local simulation fallback
      }
    }

    const requests = getStoredItem(KEYS.REQUESTS, []);
    const payments = getStoredItem(KEYS.PAYMENTS, []);
    const trackingList = getStoredItem(KEYS.TRACKING, []);

    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) throw new Error('Requisition not found');

    const req = requests[index];
    assertHospitalActive(req.fromHospitalId);

    if (req.status !== 'accepted') {
      throw new Error(`Cannot pay for requisition in "${req.status}" status. Requisition must be accepted first.`);
    }

    const paymentId = backendPayment?.id || ('pay_demo_' + Math.random().toString(36).substring(2, 11));
    const orderId = backendPayment?.providerOrderId || backendPayment?.provider_order_id || ('order_demo_' + Math.random().toString(36).substring(2, 10));

    // Derive authoritative final payment amounts
    const fee = Number(deliveryCharge || req.deliveryCharge || 0);
    const dist = (distanceKm !== null && distanceKm !== undefined) ? Number(distanceKm) : (req.distanceKm ?? null);
    const medAmount = Number(req.totalAmount || 0);
    const authoritativeTotal = Number(totalPayable || (medAmount + fee));

    // Update Request: Accepted -> Payment Successful -> Paid (Lifecycle Stage 3)
    req.status = 'paid';
    req.paymentId = paymentId;
    req.paymentStatus = 'paid';
    req.paidDate = new Date().toISOString();
    req.paymentCompletedAt = req.paidDate;
    req.deliveryCharge = fee;
    if (dist !== null) {
      req.distanceKm = dist;
    }
    req.finalTotalAmount = authoritativeTotal;

    if (!req.timeline) {
      req.timeline = [
        { step: 'Order Placed', timestamp: req.requestDate || new Date().toISOString(), completed: true },
        { step: 'Accepted by Provider', timestamp: req.acceptedAt || req.requestDate || new Date().toISOString(), completed: true },
      ];
    }
    req.timeline.push(
      { step: 'Payment Successful', timestamp: req.paidDate, completed: true, details: `Escrow Ref: ${paymentId}` }
    );

    setStoredItem(KEYS.REQUESTS, requests);

    // Record Payment
    const newPayment = {
      id: paymentId,
      transactionId: req.transactionId,
      requestId: req.id,
      medicineName: req.medicineName,
      quantity: req.quantity,
      amount: authoritativeTotal,
      medicineAmount: medAmount,
      deliveryCharge: fee,
      distanceKm: dist,
      gstAmount: req.gstAmount || Math.round(medAmount * 0.12),
      totalPaid: authoritativeTotal,
      paymentStatus: 'Paid',
      date: new Date().toLocaleString(),
      razorpayPaymentId: paymentId + ' (Demo Simulator)',
      razorpayOrderId: orderId,
      paymentMethod: paymentMethod + ' [Simulation]',
      buyerHospital: req.fromHospitalName,
      buyerHospitalId: req.fromHospitalId,
      sellerHospital: req.toHospitalName,
      sellerHospitalId: req.toHospitalId,
      isDemoSimulation: true,
    };
    payments.unshift(newPayment);
    setStoredItem(KEYS.PAYMENTS, payments);

    // Generate Stable Tracking record
    const newTracking = {
      transactionId: req.transactionId,
      trackingNumber: 'SMS-EXP-' + Math.floor(10000 + Math.random() * 90000),
      senderHospital: req.toHospitalName,
      senderHospitalId: req.toHospitalId,
      receiverHospital: req.fromHospitalName,
      receiverHospitalId: req.fromHospitalId,
      medicineName: req.medicineName,
      quantity: req.quantity,
      status: 'In Preparation',
      currentLocation: `${req.toHospitalName} Central Dispatch Dock`,
      destination: `${req.fromHospitalName} Inward Receiving Dock`,
      eta: 'Next Business Day, 04:00 PM',
      courierName: 'MediCold Logistics Express Ltd.',
      courierContact: '+91 91234 56789',
      vehicleNo: 'MH-04-AZ-9912 (Cold Chain)',
      temperature: '3.8°C (Compliant)',
      isDemoSimulation: true,
      timeline: [
        { step: 'Order Placed & Escrow Locked', date: new Date().toISOString(), completed: true },
        { step: 'Pharmacy Batch Preparation', date: 'Pending', completed: false },
        { step: 'Dispatched & Cold Seal Applied', date: 'Pending', completed: false },
        { step: 'In Transit with Active IoT GPS', date: 'Pending', completed: false },
        { step: 'Delivered to Receiving Hospital', date: 'Pending', completed: false },
      ],
      coordinates: {
        origin: [28.5273, 77.2155],
        current: [24.5854, 73.7125],
        destination: [19.0144, 73.0408],
      }
    };
    trackingList.unshift(newTracking);
    setStoredItem(KEYS.TRACKING, trackingList);

    auditService.logEvent({
      action: 'PAYMENT_COMPLETED',
      entityType: 'PAYMENT',
      entityId: newPayment.id,
      hospitalId: req.fromHospitalId,
      hospitalName: req.fromHospitalName,
      partnerHospitalId: req.toHospitalId,
      partnerHospitalName: req.toHospitalName,
      summary: `Escrow payment of ₹${req.totalAmount.toLocaleString()} completed for ${req.medicineName}. Order status moved to Paid.`,
      resultingStatus: 'paid',
      metadata: { paymentId, transactionId: req.transactionId, amount: req.totalAmount },
    });

    return { request: req, payment: newPayment, tracking: newTracking };
  },

  async failPayment({ requestId, reason = 'Card declined / Sandbox simulation failure' }) {
    await new Promise((r) => setTimeout(r, 400));

    // Attempt backend registration
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/payments/fail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentId: requestId,
            reason,
          }),
        });
      } catch (e) {
        // Fallback to local store
      }
    }

    const requests = getStoredItem(KEYS.REQUESTS, []);
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) throw new Error('Requisition not found');

    const req = requests[index];
    assertHospitalActive(req.fromHospitalId);

    // Keep order status at accepted, set payment status to failed
    req.paymentStatus = 'failed';
    req.paymentFailureReason = reason;
    req.paymentFailedAt = new Date().toISOString();
    setStoredItem(KEYS.REQUESTS, requests);

    auditService.logEvent({
      action: 'PAYMENT_FAILED',
      entityType: 'PAYMENT',
      entityId: req.id,
      hospitalId: req.fromHospitalId,
      hospitalName: req.fromHospitalName,
      partnerHospitalId: req.toHospitalId,
      partnerHospitalName: req.toHospitalName,
      summary: `Payment simulation failed for ${req.medicineName}. Order remains Accepted for payment retry.`,
      resultingStatus: 'accepted',
      metadata: { transactionId: req.transactionId, reason },
    });

    return { request: req };
  },

  async advanceOrderFulfillment({ requestId }) {
    await new Promise((r) => setTimeout(r, 200));
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const index = requests.findIndex((r) => r.id === requestId);
    if (index === -1) throw new Error('Requisition not found');

    const req = requests[index];
    const s = (req.status || '').toLowerCase().trim();

    // Guard: Order cannot advance to Preparing or beyond without successful payment!
    const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(String(req.paymentStatus || '').toLowerCase().trim());
    if (['accepted', 'pending', 'requested'].includes(s) && !isPaid) {
      throw new Error('Order cannot proceed to fulfillment until payment is successfully completed by the requesting hospital.');
    }

    const flowMap = {
      accepted: isPaid ? 'preparing' : 'accepted',
      paid: 'preparing',
      preparing: 'dispatched',
      dispatched: 'in transit',
      'in transit': 'delivered',
      delivered: 'completed',
    };

    const nextStatus = flowMap[s];
    if (!nextStatus || nextStatus === s) return { request: req, nextStatus: s };

    req.status = nextStatus;
    if (['preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(nextStatus)) {
      req.paymentStatus = 'paid';
    }
    if (!req.timeline) req.timeline = [];
    req.timeline.push({
      step: nextStatus === 'in transit' ? 'In Transit' : nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1),
      timestamp: new Date().toISOString(),
      completed: true,
    });

    // Requirement 15 & 16 Inventory Connection:
    // When dispatched, deduct from source hospital inventory and log Order Dispatch
    if (nextStatus === 'dispatched' && !req.stockDispatchedLogged) {
      const medicines = getStoredItem(KEYS.MEDICINES, []);
      const sourceIndex = medicines.findIndex((m) => m.id === req.medicineId && m.hospitalId === req.toHospitalId);
      if (sourceIndex !== -1) {
        const prevTotal = Number(medicines[sourceIndex].totalQuantity || medicines[sourceIndex].quantity || 0);
        const prevRes = Number(medicines[sourceIndex].reservedQuantity || 0);
        const dispatchQty = Number(req.quantity);
        const newTotal = Math.max(0, prevTotal - dispatchQty);
        const newRes = Math.max(0, prevRes - dispatchQty);
        medicines[sourceIndex].totalQuantity = newTotal;
        medicines[sourceIndex].quantity = newTotal;
        medicines[sourceIndex].reservedQuantity = newRes;
        medicines[sourceIndex].availableQuantity = Math.max(0, newTotal - newRes);
        medicines[sourceIndex].lastUpdated = new Date().toISOString().split('T')[0];
        setStoredItem(KEYS.MEDICINES, medicines);

        // Record stock movement: Order Dispatch
        const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
        stockHist.unshift({
          id: 'sh-disp-' + Date.now(),
          medicineId: medicines[sourceIndex].id,
          medicineName: medicines[sourceIndex].brandName || medicines[sourceIndex].medicineName,
          batchNo: medicines[sourceIndex].batchNo,
          hospitalId: medicines[sourceIndex].hospitalId,
          hospitalName: medicines[sourceIndex].hospitalName,
          action: 'Order Dispatch',
          actionType: 'Order Dispatch',
          movementType: 'Order Dispatch',
          orderId: req.id,
          partnerHospitalId: req.fromHospitalId,
          partnerHospitalName: req.fromHospitalName,
          quantityDelta: -dispatchQty,
          previousStock: prevTotal,
          resultingStock: newTotal,
          availableStock: medicines[sourceIndex].availableQuantity,
          concessionRate: req.unitFinalPrice || req.concessionRate,
          performedBy: req.toHospitalName + ' Staff',
          reason: `Dispatched ${dispatchQty} units for Requisition #${req.transactionId || req.id}`,
          timestamp: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
        });
        setStoredItem(KEYS.STOCK_HISTORY, stockHist);
      }
      req.stockDispatchedLogged = true;
      req.dispatchedAt = new Date().toISOString();
      req.dispatchDate = req.dispatchedAt;
    }

    // When delivered or completed, credit receiving hospital's inventory and log Order Received
    if ((nextStatus === 'delivered' || nextStatus === 'completed') && !req.stockReceivedByBuyer) {
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

      let buyerMedId;
      if (targetMedIndex !== -1) {
        const prevTot = Number(medicines[targetMedIndex].totalQuantity || medicines[targetMedIndex].quantity || 0);
        const newTot = prevTot + Number(req.quantity);
        medicines[targetMedIndex].totalQuantity = newTot;
        medicines[targetMedIndex].quantity = newTot;
        const res = Number(medicines[targetMedIndex].reservedQuantity || 0);
        medicines[targetMedIndex].availableQuantity = Math.max(0, newTot - res);
        medicines[targetMedIndex].lastUpdated = new Date().toISOString().split('T')[0];
        buyerMedId = medicines[targetMedIndex].id;
      } else {
        buyerMedId = 'med-' + Date.now() + '-rcv';
        medicines.unshift({
          id: buyerMedId,
          medicineId: req.medicineId || ('med-rcv-' + Date.now()),
          brandName: req.medicineName,
          medicineName: req.medicineName,
          genericName: req.genericName || 'Active Formulation',
          category: 'Essential Medicines',
          form: req.form || req.dosageForm || 'Tablet',
          dosageForm: req.dosageForm || req.form || 'Tablet',
          dosage: req.dosage || req.power || 'Standard',
          power: req.power || req.dosage || '',
          strength: req.power || req.dosage || '',
          packing: req.packing || '15 Tablets',
          unit: req.unit || 'Tablet',
          manufacturer: req.manufacturer || 'Approved Manufacturer',
          batchNo: req.batchNo || 'BAT-RCV-' + Date.now().toString().slice(-4),
          batchNumber: req.batchNo || 'BAT-RCV-' + Date.now().toString().slice(-4),
          quantity: Number(req.quantity),
          totalQuantity: Number(req.quantity),
          reservedQuantity: 0,
          availableQuantity: Number(req.quantity),
          minStockLevel: 20,
          reorderLevel: 20,
          shelfLocation: 'Rack A - Shelf 3',
          mfgDate: req.mfgDate || '2024-01-01',
          expiryDate: req.medicineExpiryDate || req.expiryDate || '2025-12-31',
          mrp: Number(req.unitOriginalPrice || req.mrp || 100),
          unitOriginalPrice: Number(req.unitOriginalPrice || req.mrp || 100),
          concessionRate: Number(req.unitFinalPrice || req.concessionRate || 95),
          unitFinalPrice: Number(req.unitFinalPrice || req.concessionRate || 95),
          costRate: Number(req.costRate || req.unitFinalPrice || 90),
          acquisitionCost: Number(req.costRate || req.unitFinalPrice || 90),
          hospitalId: buyerHospId,
          hospitalName: req.fromHospitalName,
          source: 'Hospital Transfer In',
          supplier: req.toHospitalName,
          purchaseDate: new Date().toISOString().split('T')[0],
          dateAdded: new Date().toISOString().split('T')[0],
          lastUpdated: new Date().toISOString().split('T')[0],
          notes: `Procured through inter-hospital requisition #${req.transactionId || req.id}`,
        });
      }
      setStoredItem(KEYS.MEDICINES, medicines);

      // Record stock movement: Order Received
      const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
      stockHist.unshift({
        id: 'sh-rcv-' + Date.now(),
        medicineId: buyerMedId,
        medicineName: req.medicineName,
        batchNo: req.batchNo || 'BAT-RCV',
        hospitalId: buyerHospId,
        hospitalName: req.fromHospitalName,
        partnerHospitalId: req.toHospitalId,
        partnerHospitalName: req.toHospitalName,
        action: 'Order Received',
        actionType: 'Order Received',
        movementType: 'Order Received',
        orderId: req.id,
        quantityDelta: Number(req.quantity),
        previousStock: 0,
        resultingStock: Number(req.quantity),
        concessionRate: req.unitFinalPrice || req.concessionRate,
        performedBy: req.fromHospitalName + ' Staff',
        reason: `Received order consignment #${req.transactionId || req.id} from ${req.toHospitalName}`,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      });
      setStoredItem(KEYS.STOCK_HISTORY, stockHist);

      req.stockReceivedByBuyer = true;
      req.deliveredAt = new Date().toISOString();
      req.receivedDate = req.deliveredAt;
    }

    setStoredItem(KEYS.REQUESTS, requests);

    const trackingList = getStoredItem(KEYS.TRACKING, []);
    const trkIdx = trackingList.findIndex((t) => t.transactionId === req.transactionId);
    if (trkIdx !== -1) {
      if (nextStatus === 'preparing') trackingList[trkIdx].status = 'In Preparation';
      if (nextStatus === 'dispatched') trackingList[trkIdx].status = 'Dispatched';
      if (nextStatus === 'in transit') trackingList[trkIdx].status = 'In Transit';
      if (nextStatus === 'delivered') trackingList[trkIdx].status = 'Delivered';
      if (nextStatus === 'completed') trackingList[trkIdx].status = 'Completed';
      setStoredItem(KEYS.TRACKING, trackingList);
    }

    return { request: req, nextStatus };
  },

  // ==========================================
  // 6. STABLE LOGISTICS & TRACKING
  // ==========================================
  async getTrackingByTxn(txnId) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token && txnId) {
        const response = await fetch(`${API_BASE_URL}/tracking/${encodeURIComponent(txnId.trim())}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const json = await response.json().catch(() => null);
          if (json?.success && json?.data) {
            return json.data;
          }
        }
      }
    } catch (e) {
      // fallback to offline / local storage
    }

    await new Promise((r) => setTimeout(r, 200));
    const trackingList = getStoredItem(KEYS.TRACKING, []);
    if (!txnId) return trackingList[0] || null;
    return trackingList.find((t) => t.transactionId?.toLowerCase() === txnId.trim().toLowerCase()) || trackingList[0] || null;
  },

  async getAllTracking() {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/transfers`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const json = await response.json().catch(() => null);
          if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
            return json.data;
          }
        }
      }
    } catch (e) {
      // fallback
    }

    await new Promise((r) => setTimeout(r, 150));
    return getStoredItem(KEYS.TRACKING, []);
  },

  // ==========================================
  // 7. SALES & PURCHASES HISTORY (Isolated)
  // ==========================================
  async getSalesHistory(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) return [];

    const requests = getStoredItem(KEYS.REQUESTS, []);
    return requests
      .filter((r) => r.toHospitalId === hospitalId && ['accepted', 'paid', 'dispatched', 'delivered'].includes(r.status))
      .map((r) => ({
        id: r.id,
        transactionId: r.transactionId,
        medicine: r.medicineName,
        partnerHospital: r.fromHospitalName,
        partnerHospitalId: r.fromHospitalId,
        quantity: r.quantity,
        amount: r.totalAmount,
        date: r.requestDate.split('T')[0],
        status: r.status,
      }));
  },

  async getPurchasesHistory(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) return [];

    const requests = getStoredItem(KEYS.REQUESTS, []);
    return requests
      .filter((r) => r.fromHospitalId === hospitalId && ['accepted', 'paid', 'dispatched', 'delivered', 'rejected', 'expired'].includes(r.status))
      .map((r) => ({
        id: r.id,
        transactionId: r.transactionId,
        medicine: r.medicineName,
        partnerHospital: r.toHospitalName,
        partnerHospitalId: r.toHospitalId,
        quantity: r.quantity,
        amount: r.totalAmount,
        date: r.requestDate.split('T')[0],
        status: r.status,
      }));
  },

  // ==========================================
  // 8. PAYMENT HISTORY (Strictly Isolated)
  // ==========================================
  async getPaymentHistory(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    const payments = getStoredItem(KEYS.PAYMENTS, []);
    if (!hospitalId) return [];

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === hospitalId);
    const hospName = hosp?.name?.toLowerCase();

    return payments.filter((p) => {
      if (p.buyerHospitalId === hospitalId || p.sellerHospitalId === hospitalId) return true;
      if (hospName && (p.buyerHospital?.toLowerCase().includes(hospName) || p.sellerHospital?.toLowerCase().includes(hospName))) return true;
      return false;
    });
  },

  // ==========================================
  // 9. HOSPITAL WASTE MANAGEMENT (Complete Flow)
  // ==========================================
  async getHospitalDisposals(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    if (!hospitalId) return [];

    const disposals = getStoredItem(KEYS.DISPOSALS, []);
    return disposals.filter((d) => d.hospitalId === hospitalId);
  },

  async createWasteRequest(wasteData) {
    await new Promise((r) => setTimeout(r, 250));
    const hospitalId = resolveHospitalId(wasteData.hospitalId);
    assertHospitalActive(hospitalId);

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === hospitalId) || { name: 'Hospital Facility', city: 'Mumbai' };

    const disposals = getStoredItem(KEYS.DISPOSALS, []);

    // Assign appropriate regional authorized bio-medical waste treatment plant
    let bioCentreName = 'Maharashtra Enviro Power Bio-Medical Waste Plant';
    let bioCentreAddress = 'Plot P-32, MIDC Taloja, Raigad, Maharashtra 410208';
    if (hosp.city?.toLowerCase().includes('delhi')) {
      bioCentreName = 'Delhi Central Bio-Medical Incinerator, Okhla';
      bioCentreAddress = 'Okhla Industrial Area Phase-I, New Delhi 110020';
    } else if (hosp.city?.toLowerCase().includes('gurgaon') || hosp.state?.toLowerCase().includes('haryana')) {
      bioCentreName = 'Haryana State Bio-Hazard Incineration Facility';
      bioCentreAddress = 'IMT Manesar Sector 8, Gurugram, Haryana 122051';
    } else if (hosp.city?.toLowerCase().includes('bangalore') || hosp.state?.toLowerCase().includes('karnataka')) {
      bioCentreName = 'Karnataka Common Bio-Medical Waste Treatment Facility';
      bioCentreAddress = 'Peenya Industrial Area, Bengaluru, Karnataka 560058';
    }

    const newDisposal = {
      id: 'disp-' + Date.now(),
      hospitalId,
      hospitalName: hosp.name,
      medicineId: wasteData.medicineId || null,
      medicineName: wasteData.medicineName,
      wasteCategory: wasteData.wasteCategory || 'Expired Pharmaceuticals',
      batchNo: wasteData.batchNo || 'N/A',
      quantity: wasteData.quantity,
      expiryDate: wasteData.expiryDate || null,
      reason: wasteData.reason || 'Statutory Expiration Disposal',
      preferredPickupDate: wasteData.preferredPickupDate || new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      pickupDate: null,
      bioCentreName,
      bioCentreAddress,
      vehicleNo: 'MH-04-GP-' + Math.floor(1000 + Math.random() * 9000),
      driverContact: '+91 98' + Math.floor(10000000 + Math.random() * 90000000) + ' (Authorized Driver)',
      currentLocation: 'Assigned Bio-Centre Dispatch Queue',
      eta: 'Pickup scheduled within 48h',
      status: 'Pending Assessment',
      certificateNo: null,
      certificateDate: null,
      treatmentMethod: 'High-Temperature Double-Chamber Incineration (1100°C) with Flue Gas Scrubber',
      manifestNumber: 'MPCB-BMW-MNF-' + Math.floor(10000 + Math.random() * 90000),
      createdDate: new Date().toISOString().split('T')[0],
      isDemoSimulation: true,
    };

    disposals.unshift(newDisposal);
    setStoredItem(KEYS.DISPOSALS, disposals);

    // If a specific medicine was linked, update its status to 'pending_disposal' in inventory
    if (wasteData.medicineId) {
      const medicines = getStoredItem(KEYS.MEDICINES, []);
      const medIdx = medicines.findIndex((m) => m.id === wasteData.medicineId);
      if (medIdx !== -1) {
        medicines[medIdx].status = 'pending_disposal';
        setStoredItem(KEYS.MEDICINES, medicines);
      }
    }

    auditService.logEvent({
      action: 'WASTE_REQUEST_CREATED',
      entityType: 'WASTE',
      entityId: newDisposal.id,
      hospitalId,
      hospitalName: hosp.name,
      summary: `Submitted bio-medical waste disposal request for ${newDisposal.medicineName} (${newDisposal.quantity}). Assigned to ${bioCentreName}.`,
      resultingStatus: 'Pending Assessment',
      metadata: { wasteCategory: newDisposal.wasteCategory, batchNo: newDisposal.batchNo },
    });

    return newDisposal;
  },

  // ==========================================
  // 10. FEEDBACK
  // ==========================================
  async submitFeedback(feedbackData) {
    const hospitalId = resolveHospitalId(feedbackData.hospitalId);
    let serverFeedback = null;
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const response = await fetch(`${API_BASE_URL}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rating: Number(feedbackData.rating),
            category: feedbackData.category || 'General Service',
            feedbackText: feedbackData.feedbackText,
          }),
        });
        if (response.ok) {
          const json = await response.json().catch(() => null);
          if (json?.success && json?.data) {
            serverFeedback = json.data;
          }
        }
      }
    } catch (e) {
      // fallback to offline
    }

    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);
    const newFb = serverFeedback || {
      id: 'fb-' + Date.now(),
      hospitalId: hospitalId || 'hosp-1',
      hospitalName: feedbackData.hospitalName || 'Hospital Facility',
      rating: Number(feedbackData.rating),
      category: feedbackData.category || 'General Service',
      feedbackText: feedbackData.feedbackText,
      date: new Date().toISOString().split('T')[0],
      adminReply: null,
      repliedDate: null,
    };
    feedbacks.unshift(newFb);
    setStoredItem(KEYS.FEEDBACKS, feedbacks);
    return newFb;
  },

  async getFeedbacks(hospitalIdParam) {
    try {
      const session = getStoredItem(KEYS.AUTH, null);
      const token = session?.token;
      if (token) {
        const hospitalId = resolveHospitalId(hospitalIdParam);
        let url = `${API_BASE_URL}/feedback`;
        if (hospitalId && session?.user?.role === 'admin') {
          url += `?hospitalId=${encodeURIComponent(hospitalId)}`;
        }
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const json = await response.json().catch(() => null);
          if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
            return json.data;
          }
        }
      }
    } catch (e) {
      // fallback to local storage
    }

    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    const feedbacks = getStoredItem(KEYS.FEEDBACKS, []);
    if (!hospitalId) return feedbacks;
    return feedbacks.filter((f) => f.hospitalId === hospitalId);
  },

  // ==========================================
  // 11. PHASE 10: TRADING & REPORTS
  // ==========================================
  async getTrades(params = {}) {
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.medicineId) query.append('medicineId', params.medicineId);

    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/trades?${query.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.data) return body.data;
        }
      } catch (err) {
        console.warn('Failed to fetch trades from backend:', err.message);
      }
    }

    // Client fallback
    const requests = getStoredItem(KEYS.REQUESTS, []);
    const hospitalId = resolveHospitalId(params.hospitalId);
    let filtered = requests.filter((r) => r.fromHospitalId === hospitalId || r.toHospitalId === hospitalId);
    if (params.status && params.status !== 'all') {
      filtered = filtered.filter((r) => (r.status || '').toLowerCase() === params.status.toLowerCase());
    }
    return {
      trades: filtered.map((r) => ({
        id: r.id,
        transactionId: r.transactionId,
        orderId: r.orderId,
        buyerHospitalId: r.fromHospitalId,
        buyerHospitalName: r.fromHospitalName,
        sellerHospitalId: r.toHospitalId,
        sellerHospitalName: r.toHospitalName,
        medicineName: r.medicineName,
        batchNo: r.batchNo,
        quantity: r.quantity,
        unitPrice: r.unitFinalPrice || r.unitOriginalPrice || 0,
        totalAmount: r.totalAmount,
        status: r.status,
        transactionDate: r.requestDate || r.createdAt,
      })),
      pagination: {
        total: filtered.length,
        page: Number(params.page) || 1,
        limit: Number(params.limit) || 20,
        pages: Math.ceil(filtered.length / (Number(params.limit) || 20)) || 1,
      }
    };
  },

  async getTradeById(id) {
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/trades/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.data) return body.data;
        }
      } catch (err) {
        console.warn('Failed to fetch trade detail from backend:', err.message);
      }
    }
    const trades = await this.getTrades({ limit: 100 });
    return (trades?.trades || []).find((t) => t.id === id || t.transactionId === id) || null;
  },

  async getTradingSummary(params = {}) {
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.hospitalId) query.append('hospitalId', params.hospitalId);

    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/trades/summary?${query.toString()}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          }
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.data) return body.data;
        }
      } catch (err) {
        console.warn('Failed to fetch trading summary:', err.message);
      }
    }

    return {
      metrics: {
        totalTrades: 0,
        totalPurchases: 0,
        totalSales: 0,
        totalQuantityPurchased: 0,
        totalQuantitySold: 0,
        totalPurchaseAmount: 0,
        totalSalesAmount: 0,
        completedTrades: 0,
        cancelledTrades: 0,
        pendingTrades: 0,
        ratios: { purchasesPercentage: 0, salesPercentage: 0 },
      },
      hasData: false,
      timeSeries: [],
    };
  },

  async exportTradesCSV(params = {}) {
    const session = getStoredItem(KEYS.AUTH, null);
    const token = session?.token;
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    const url = `${API_BASE_URL}/trades/export?${query.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });

    if (!res.ok) {
      throw new Error(`Export failed with HTTP status ${res.status}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `medex-trading-report-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  // ==========================================
  // 14. SELL MEDICINES & LISTINGS MANAGEMENT
  // ==========================================
  async createSaleListing(listingInput) {
    await new Promise((r) => setTimeout(r, 200));

    const hospitalId = resolveHospitalId(listingInput.sellerHospitalId || listingInput.hospitalId);
    if (!hospitalId) {
      throw new Error('Seller hospital identity could not be verified');
    }
    assertHospitalActive(hospitalId);

    const qty = Math.floor(Number(listingInput.quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Listing quantity must be a positive whole number');
    }

    const mrp = Number(listingInput.mrp || listingInput.unitOriginalPrice);
    if (!Number.isFinite(mrp) || mrp <= 0) {
      throw new Error('Valid batch MRP is required');
    }

    // Verify batch from seller hospital's existing inventory
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const batchIndex = medicines.findIndex((m) => {
      if (m.hospitalId !== hospitalId) return false;
      if (listingInput.batchId && m.id === listingInput.batchId) return true;
      const mBatch = (m.batchNo || m.batchNumber || '').trim().toLowerCase();
      const inBatch = (listingInput.batchNo || listingInput.batchNumber || '').trim().toLowerCase();
      const mName = (m.brandName || m.medicineName || '').trim().toLowerCase();
      const inName = (listingInput.brandName || listingInput.medicineName || '').trim().toLowerCase();
      return mBatch === inBatch && (mName === inName || m.id === listingInput.medicineId);
    });

    if (batchIndex === -1) {
      throw new Error('Selected batch not found in your hospital inventory');
    }

    const targetBatch = medicines[batchIndex];
    const targetExpiry = targetBatch.expiryDate || listingInput.expiryDate;

    // Hard Near-Expiry Policy Rejection Rule (<= 1 month cannot be listed)
    if (!isExpiryAcceptable(targetExpiry)) {
      throw new Error('Stock cannot be listed because the medicine expires within 1 month.');
    }

    const exp = calculateMedicineExpiry(targetExpiry);
    if (exp.isExpired) {
      throw new Error('Cannot list an expired medicine lot. Expired medicines must be quarantined.');
    }

    // Strictly derive pricing from the central Near-Expiry Concession Policy (No manual override)
    const policyPricing = getExpiryPricing(targetExpiry, mrp, null, qty);
    const concessionPercent = policyPricing.concessionPercent;
    const concessionAmountPerUnit = policyPricing.concessionAmountPerUnit;
    const sellingPricePerUnit = policyPricing.sellingPricePerUnit;
    const totalMRP = policyPricing.totalMRP;
    const totalConcession = policyPricing.totalConcession;
    const finalSellingPrice = policyPricing.finalSellingPrice;

    const totalBatchStock = Number(targetBatch.quantity || targetBatch.totalQuantity || 0);
    const existingReserved = Number(targetBatch.reservedQuantity || 0);
    const currentAvailable = targetBatch.availableQuantity !== undefined
      ? Number(targetBatch.availableQuantity)
      : Math.max(0, totalBatchStock - existingReserved);

    if (qty > currentAvailable) {
      throw new Error(`Listing quantity (${qty}) cannot exceed available batch stock (${currentAvailable})`);
    }

    // Resolve hospital details
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const hosp = hospitals.find((h) => h.id === hospitalId) || {
      id: hospitalId,
      name: listingInput.sellerHospitalName || targetBatch.hospitalName || 'Hospital Partner',
      location: targetBatch.location || 'Mumbai, Maharashtra',
    };

    const listingId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();

    const saleRecord = {
      id: listingId,
      listingId,
      // Seller hospital
      hospitalId: hosp.id,
      sellerHospitalId: hosp.id,
      sellerHospitalName: hosp.name,
      sellerHospitalLocation: hosp.location || targetBatch.location || 'India',
      sellerLocation: hosp.location || targetBatch.location || 'India',
      // Medicine details
      medicineId: targetBatch.medicineId || targetBatch.id,
      batchId: targetBatch.id,
      brandName: targetBatch.brandName || targetBatch.medicineName,
      medicineName: targetBatch.brandName || targetBatch.medicineName,
      genericName: targetBatch.genericName || targetBatch.composition || 'Active Pharmaceutical Ingredient',
      power: targetBatch.power || targetBatch.strength || targetBatch.dosage || 'Standard',
      dosageForm: targetBatch.dosageForm || targetBatch.form || 'Tablet',
      category: targetBatch.category || 'Pharmaceutical',
      storageType: targetBatch.storageType || targetBatch.storageCondition || 'Room Temperature (15°C - 25°C)',
      shelfLocation: targetBatch.shelfLocation || 'Main Pharmacy Rack',
      // Batch & Expiry
      batchNo: targetBatch.batchNo || targetBatch.batchNumber || listingInput.batchNo,
      batchNumber: targetBatch.batchNo || targetBatch.batchNumber || listingInput.batchNo,
      mfgDate: targetBatch.mfgDate || listingInput.mfgDate || '2024-01-01',
      expiryDate: targetBatch.expiryDate || listingInput.expiryDate,
      // Quantity
      quantity: qty,
      initialQuantity: qty,
      availableQuantity: qty,
      // Pricing
      mrp,
      unitOriginalPrice: mrp,
      concessionPercent,
      concessionPercentage: concessionPercent,
      concessionAmount: concessionAmountPerUnit,
      concessionAmountPerUnit,
      sellingPrice: sellingPricePerUnit,
      sellingPricePerUnit,
      unitFinalPrice: sellingPricePerUnit,
      totalMRP,
      totalConcession,
      finalSellingPrice,
      totalSellingPrice: finalSellingPrice,
      // Status & Timestamps
      listingStatus: 'active',
      status: 'active',
      timestamp,
      createdAt: timestamp,
      notes: listingInput.notes || `Listed for inter-hospital exchange with ${concessionPercent}% concession`
    };

    // 1. Persist sale listing in localStorage
    saveSaleListing(saleRecord);

    // 2. Reduce/reserve inventory according to the existing frontend inventory model
    const newReserved = existingReserved + qty;
    const newAvailable = Math.max(0, totalBatchStock - newReserved);
    medicines[batchIndex] = {
      ...targetBatch,
      reservedQuantity: newReserved,
      availableQuantity: newAvailable,
      concessionPercent: concessionPercent,
      concessionRate: sellingPricePerUnit,
      unitFinalPrice: sellingPricePerUnit,
      lastUpdated: timestamp,
    };
    setStoredItem(KEYS.MEDICINES, medicines);

    // 3. Record in Stock History
    const stockHist = getStoredItem(KEYS.STOCK_HISTORY, []);
    stockHist.unshift({
      id: `sh-sale-${Date.now()}`,
      medicineId: targetBatch.id,
      medicineName: targetBatch.brandName || targetBatch.medicineName,
      batchNo: targetBatch.batchNo,
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      action: 'Listed for Marketplace Sale',
      actionType: 'Stock Reservation',
      movementType: 'Marketplace Allocation',
      quantityDelta: -qty,
      previousStock: totalBatchStock,
      resultingStock: totalBatchStock,
      availableStock: newAvailable,
      performedBy: `${hosp.name} Pharmacy Team`,
      shelfLocation: targetBatch.shelfLocation,
      reason: `Allocated ${qty} units of batch #${targetBatch.batchNo} to MedEx Marketplace listing #${listingId}`,
      timestamp,
      date: timestamp.split('T')[0],
    });
    setStoredItem(KEYS.STOCK_HISTORY, stockHist);

    // 4. Audit Log
    try {
      auditService.logEvent({
        action: 'MEDICINE_LISTED_FOR_SALE',
        entityType: 'MARKETPLACE_LISTING',
        entityId: listingId,
        details: {
          hospitalId: hosp.id,
          hospitalName: hosp.name,
          medicine: saleRecord.brandName,
          batchNo: saleRecord.batchNo,
          quantity: qty,
          mrp,
          concessionPercent,
          sellingPricePerUnit,
          finalSellingPrice
        },
      });
    } catch (e) {
      // ignore
    }

    return saleRecord;
  },

  async getSaleListings(hospitalIdParam) {
    await new Promise((r) => setTimeout(r, 150));
    const hospitalId = resolveHospitalId(hospitalIdParam);
    return getStoredSaleListings(hospitalId);
  },

  async cancelSaleListing(listingId) {
    await new Promise((r) => setTimeout(r, 150));
    const listings = getStoredSaleListings();
    const listing = listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Sale listing not found');
    if (listing.status === 'cancelled') throw new Error('Listing is already cancelled');

    // Unreserve inventory
    const medicines = getStoredItem(KEYS.MEDICINES, []);
    const batchIndex = medicines.findIndex((m) => m.id === listing.batchId || (m.hospitalId === listing.hospitalId && m.batchNo === listing.batchNo));
    if (batchIndex !== -1) {
      const targetBatch = medicines[batchIndex];
      const curReserved = Number(targetBatch.reservedQuantity || 0);
      const newReserved = Math.max(0, curReserved - Number(listing.quantity || 0));
      const totalStock = Number(targetBatch.quantity || targetBatch.totalQuantity || 0);
      medicines[batchIndex] = {
        ...targetBatch,
        reservedQuantity: newReserved,
        availableQuantity: Math.max(0, totalStock - newReserved),
        lastUpdated: new Date().toISOString()
      };
      setStoredItem(KEYS.MEDICINES, medicines);
    }

    const updated = updateStoredSaleListing(listingId, { status: 'cancelled', listingStatus: 'cancelled' });
    return updated;
  }
};
