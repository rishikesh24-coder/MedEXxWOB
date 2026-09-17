const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const auditService = require('./auditService');
const medicineService = require('./medicineService');
const {
  calculateLotStatus,
  isLotExpired,
  getDaysUntilExpiry,
  computeCanonicalCompositionKey,
  normalizeDosageForm,
} = require('../utils/inventoryUtils');
const logger = require('../utils/logger');

class LotMutex {
  constructor() {
    this.locks = new Map();
  }
  async acquire(key) {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock;
    const promise = new Promise((res) => { resolveLock = res; });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      resolveLock();
    };
  }
}
const lotMutex = new LotMutex();

// Authoritative Development / Offline Inventory Store (Synchronized with backend/seed.sql)
const devInventory = [
  {
    id: 'b0000001-0000-0000-0000-000000000001',
    hospitalId: '11111111-1111-1111-1111-111111111111',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    hospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    hospitalCity: 'New Delhi',
    hospitalState: 'Delhi',
    medicineId: 'a0000001-0000-0000-0000-000000000001',
    medicine_id: 'a0000001-0000-0000-0000-000000000001',
    medicineName: 'Augmentin 625 Duo',
    brandName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin + Clavulanic Acid',
    composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    category: 'Antibiotics & Anti-Infectives',
    dosageForm: 'Tablet',
    form: 'Tablet',
    dosage: '625mg Tablets',
    strength: '625mg',
    packing: '10 Tablets / Strip',
    packSize: '10 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 10,
    numberOfPacks: 45,
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd.',
    batchNumber: 'AUG-24-0981',
    batchNo: 'AUG-24-0981',
    quantity: 450,
    totalQuantity: 450,
    reservedQuantity: 0,
    availableQuantity: 450,
    minimumStock: 50,
    minStockLevel: 50,
    reorderLevel: 50,
    shelfLocation: 'Rack A - Shelf 3',
    manufacturingDate: '2024-02-01',
    mfgDate: '2024-02-01',
    expiryDate: new Date(Date.now() + 185 * 86400000).toISOString().split('T')[0],
    unitPrice: 160.00,
    mrp: 200.00,
    concessionRate: 140.00,
    concessionPercent: 12.50,
    costRate: 130.00,
    acquisitionCost: 130.00,
    status: 'AVAILABLE',
    purchaseBillUrl: '/uploads/bills/Apollo_AUG24_Invoice.pdf',
    billStoragePath: '11111111-1111-1111-1111-111111111111/b0000001/Apollo_AUG24_Invoice.pdf',
    createdAt: '2024-02-05T00:00:00.000Z',
    updatedAt: '2024-02-05T00:00:00.000Z',
  },
  {
    id: 'b0000002-0000-0000-0000-000000000002',
    hospitalId: '11111111-1111-1111-1111-111111111111',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    hospitalName: 'Apollo Hospital & Multi-Specialty Centre',
    hospitalCity: 'New Delhi',
    hospitalState: 'Delhi',
    medicineId: 'a0000006-0000-0000-0000-000000000006',
    medicine_id: 'a0000006-0000-0000-0000-000000000006',
    medicineName: 'Meronem 1g IV',
    brandName: 'Meronem 1g IV',
    genericName: 'Meropenem',
    composition: 'Meropenem Trihydrate 1000mg',
    category: 'Critical Care & Antibiotics',
    dosageForm: 'Injection',
    form: 'Injection',
    dosage: '1g Injection (IV)',
    strength: '1g',
    packing: '1 Vial with Diluent',
    packSize: '1 Vial with Diluent',
    unit: 'Vial',
    unitsPerPack: 1,
    numberOfPacks: 120,
    manufacturer: 'Pfizer India Ltd.',
    batchNumber: 'MER-24-1102',
    batchNo: 'MER-24-1102',
    quantity: 120,
    totalQuantity: 120,
    reservedQuantity: 20,
    availableQuantity: 100,
    minimumStock: 25,
    minStockLevel: 25,
    reorderLevel: 25,
    shelfLocation: 'Cold Storage Vault C-2',
    manufacturingDate: '2024-03-01',
    mfgDate: '2024-03-01',
    expiryDate: new Date(Date.now() + 240 * 86400000).toISOString().split('T')[0],
    unitPrice: 1850.00,
    mrp: 2450.00,
    concessionRate: 1650.00,
    concessionPercent: 10.81,
    costRate: 1550.00,
    acquisitionCost: 1550.00,
    status: 'AVAILABLE',
    purchaseBillUrl: '/uploads/bills/Apollo_MER24_Invoice.pdf',
    billStoragePath: '11111111-1111-1111-1111-111111111111/b0000002/Apollo_MER24_Invoice.pdf',
    createdAt: '2024-03-05T00:00:00.000Z',
    updatedAt: '2024-03-05T00:00:00.000Z',
  },
  {
    id: 'b0000003-0000-0000-0000-000000000003',
    hospitalId: '22222222-2222-2222-2222-222222222222',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    hospitalName: 'Fortis Memorial Research Institute',
    hospitalCity: 'Gurugram',
    hospitalState: 'Haryana',
    medicineId: 'a0000003-0000-0000-0000-000000000003',
    medicine_id: 'a0000003-0000-0000-0000-000000000003',
    medicineName: 'Clavam 625',
    brandName: 'Clavam 625',
    genericName: 'Amoxicillin + Clavulanic Acid',
    composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    category: 'Antibiotics & Anti-Infectives',
    dosageForm: 'Tablet',
    form: 'Tablet',
    dosage: '625mg Tablets',
    strength: '625mg',
    packing: '10 Tablets / Strip',
    packSize: '10 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 10,
    numberOfPacks: 30,
    manufacturer: 'Alkem Laboratories Ltd.',
    batchNumber: 'CLV-23-8874',
    batchNo: 'CLV-23-8874',
    quantity: 300,
    totalQuantity: 300,
    reservedQuantity: 0,
    availableQuantity: 300,
    minimumStock: 40,
    minStockLevel: 40,
    reorderLevel: 40,
    shelfLocation: 'Rack B - Shelf 1',
    manufacturingDate: '2023-10-15',
    mfgDate: '2023-10-15',
    expiryDate: new Date(Date.now() + 65 * 86400000).toISOString().split('T')[0], // Near expiry (<90 days)
    unitPrice: 150.00,
    mrp: 195.00,
    concessionRate: 115.00,
    concessionPercent: 23.33,
    costRate: 110.00,
    acquisitionCost: 110.00,
    status: 'EXPIRING_SOON',
    purchaseBillUrl: '/uploads/bills/Fortis_CLV23_Invoice.pdf',
    billStoragePath: '22222222-2222-2222-2222-222222222222/b0000003/Fortis_CLV23_Invoice.pdf',
    createdAt: '2023-10-20T00:00:00.000Z',
    updatedAt: '2023-10-20T00:00:00.000Z',
  },
  {
    id: 'b0000004-0000-0000-0000-000000000004',
    hospitalId: '22222222-2222-2222-2222-222222222222',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    hospitalName: 'Fortis Memorial Research Institute',
    hospitalCity: 'Gurugram',
    hospitalState: 'Haryana',
    medicineId: 'a0000005-0000-0000-0000-000000000005',
    medicine_id: 'a0000005-0000-0000-0000-000000000005',
    medicineName: 'Dolo 650',
    brandName: 'Dolo 650',
    genericName: 'Paracetamol',
    composition: 'Paracetamol 650mg',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    form: 'Tablet',
    dosage: '650mg Tablets',
    strength: '650mg',
    packing: '15 Tablets / Strip',
    packSize: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    numberOfPacks: 53,
    manufacturer: 'Micro Labs Ltd.',
    batchNumber: 'DL-650-9921',
    batchNo: 'DL-650-9921',
    quantity: 800,
    totalQuantity: 800,
    reservedQuantity: 0,
    availableQuantity: 800,
    minimumStock: 100,
    minStockLevel: 100,
    reorderLevel: 100,
    shelfLocation: 'Rack A - Shelf 2',
    manufacturingDate: '2024-01-10',
    mfgDate: '2024-01-10',
    expiryDate: new Date(Date.now() + 640 * 86400000).toISOString().split('T')[0],
    unitPrice: 28.00,
    mrp: 34.00,
    concessionRate: 25.00,
    concessionPercent: 10.71,
    costRate: 22.00,
    acquisitionCost: 22.00,
    status: 'AVAILABLE',
    purchaseBillUrl: '/uploads/bills/Fortis_DL650_Invoice.pdf',
    billStoragePath: '22222222-2222-2222-2222-222222222222/b0000004/Fortis_DL650_Invoice.pdf',
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'b0000005-0000-0000-0000-000000000005',
    hospitalId: '22222222-2222-2222-2222-222222222222',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    hospitalName: 'Fortis Memorial Research Institute',
    hospitalCity: 'Gurugram',
    hospitalState: 'Haryana',
    medicineId: 'a0000002-0000-0000-0000-000000000002',
    medicine_id: 'a0000002-0000-0000-0000-000000000002',
    medicineName: 'Calpol 500mg Tablets',
    brandName: 'Calpol 500mg Tablets',
    genericName: 'Paracetamol',
    composition: 'Paracetamol 500mg',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    form: 'Tablet',
    dosage: '500mg Tablets',
    strength: '500mg',
    packing: '15 Tablets / Strip',
    packSize: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    numberOfPacks: 40,
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd.',
    batchNumber: 'CAL-500-2411',
    batchNo: 'CAL-500-2411',
    quantity: 600,
    totalQuantity: 600,
    reservedQuantity: 0,
    availableQuantity: 600,
    minimumStock: 50,
    minStockLevel: 50,
    reorderLevel: 50,
    shelfLocation: 'Rack A - Shelf 4',
    manufacturingDate: '2024-02-10',
    mfgDate: '2024-02-10',
    expiryDate: new Date(Date.now() + 300 * 86400000).toISOString().split('T')[0],
    unitPrice: 20.00,
    mrp: 25.00,
    concessionRate: 18.00,
    concessionPercent: 10.00,
    costRate: 15.00,
    acquisitionCost: 15.00,
    status: 'AVAILABLE',
    purchaseBillUrl: '/uploads/bills/Fortis_CAL500_Invoice.pdf',
    billStoragePath: '22222222-2222-2222-2222-222222222222/b0000005/Fortis_CAL500_Invoice.pdf',
    createdAt: '2024-02-15T00:00:00.000Z',
    updatedAt: '2024-02-15T00:00:00.000Z',
  },
  {
    id: 'b0000006-0000-0000-0000-000000000006',
    hospitalId: '22222222-2222-2222-2222-222222222222',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    hospitalName: 'Fortis Memorial Research Institute',
    hospitalCity: 'Gurugram',
    hospitalState: 'Haryana',
    medicineId: 'a0000005-0000-0000-0000-000000000005',
    medicine_id: 'a0000005-0000-0000-0000-000000000005',
    medicineName: 'Dolo 650 - Expired Batch',
    brandName: 'Dolo 650 - Expired Batch',
    genericName: 'Paracetamol',
    composition: 'Paracetamol 650mg',
    category: 'Analgesics & Antipyretics',
    dosageForm: 'Tablet',
    form: 'Tablet',
    dosage: '650mg Tablets',
    strength: '650mg',
    packing: '15 Tablets / Strip',
    packSize: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    numberOfPacks: 10,
    manufacturer: 'Micro Labs Ltd.',
    batchNumber: 'DL-650-EXP23',
    batchNo: 'DL-650-EXP23',
    quantity: 150,
    totalQuantity: 150,
    reservedQuantity: 0,
    availableQuantity: 150,
    minimumStock: 100,
    minStockLevel: 100,
    reorderLevel: 100,
    shelfLocation: 'Quarantine Rack - Expired',
    manufacturingDate: '2022-01-10',
    mfgDate: '2022-01-10',
    expiryDate: '2023-12-31',
    unitPrice: 28.00,
    mrp: 34.00,
    concessionRate: 25.00,
    concessionPercent: 10.71,
    costRate: 22.00,
    acquisitionCost: 22.00,
    status: 'EXPIRED',
    purchaseBillUrl: '/uploads/bills/Fortis_EXP23_Invoice.pdf',
    billStoragePath: '22222222-2222-2222-2222-222222222222/b0000006/Fortis_EXP23_Invoice.pdf',
    createdAt: '2022-01-15T00:00:00.000Z',
    updatedAt: '2022-01-15T00:00:00.000Z',
  }
];

// Immutable Historical Stock Adjustments Ledger (Sync with backend/seed.sql)
const devStockAdjustments = [
  {
    id: 'adj00001-0000-0000-0000-000000000001',
    inventory_lot_id: 'b0000001-0000-0000-0000-000000000001',
    inventoryLotId: 'b0000001-0000-0000-0000-000000000001',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    hospitalId: '11111111-1111-1111-1111-111111111111',
    previous_quantity: 500,
    previousQuantity: 500,
    quantity_change: -50,
    quantityChange: -50,
    new_quantity: 450,
    newQuantity: 450,
    reason: 'Monthly physical verification stock reconciliation - damage during storage',
    action_type: 'STOCK_RECONCILIATION',
    adjusted_by_name: 'Dr. Rajeshwar Rao',
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'adj00002-0000-0000-0000-000000000002',
    inventory_lot_id: 'b0000002-0000-0000-0000-000000000002',
    inventoryLotId: 'b0000002-0000-0000-0000-000000000002',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    hospitalId: '11111111-1111-1111-1111-111111111111',
    previous_quantity: 100,
    previousQuantity: 100,
    quantity_change: 20,
    quantityChange: 20,
    new_quantity: 120,
    newQuantity: 120,
    reason: 'Emergency receipt from central distributor',
    action_type: 'RESTOCK',
    adjusted_by_name: 'Dr. Rajeshwar Rao',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

const inventoryService = {
  getDevInventory() {
    return devInventory;
  },

  getDevStockAdjustments() {
    return devStockAdjustments;
  },

  /**
   * Retrieves inventory lots.
   * For HOSPITAL role: strictly returns authenticated hospital's own inventory.
   * For ADMIN role: returns all or filters by query hospitalId.
   */
  async getInventory({ reqUser = null, hospitalId = null, status = 'all', category = 'all', search = '', page = 1, limit = 50 } = {}) {
    let effectiveHospitalId = null;

    if (reqUser?.role === 'hospital') {
      // STRICT ISOLATION: Hospital can NEVER access another hospital's stock via client parameter
      effectiveHospitalId = reqUser.hospitalId || reqUser.id;
    } else if (reqUser?.role === 'admin') {
      effectiveHospitalId = (hospitalId && hospitalId !== 'all') ? hospitalId : null;
    } else if (hospitalId && hospitalId !== 'all') {
      effectiveHospitalId = hospitalId;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('inventory_lots').select('*, hospitals(name, city, state)', { count: 'exact' });

        if (effectiveHospitalId) {
          query = query.eq('hospital_id', effectiveHospitalId);
        }
        if (category && category !== 'all') {
          query = query.ilike('category', `%${category}%`);
        }
        if (search) {
          const q = search.trim();
          query = query.or(
            `medicine_name.ilike.%${q}%,generic_name.ilike.%${q}%,batch_number.ilike.%${q}%,batch_no.ilike.%${q}%`
          );
        }

        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limitNum - 1);

        if (!error && data && data.length > 0) {
          let items = data.map(this.normalizeLotRecord);

          if (status && status !== 'all') {
            const sNorm = status.toUpperCase().replace(/[\s_-]+/g, '');
            items = items.filter((item) => {
              const itemS = item.status.toUpperCase().replace(/[\s_-]+/g, '');
              return itemS === sNorm;
            });
          }

          return {
            items,
            total: count || items.length,
            page: pageNum,
            limit: limitNum,
          };
        }
      } catch (err) {
        logger.warn('Supabase query failed in getInventory, using memory fallback:', err.message);
      }
    }

    // In-memory fallback
    let results = [...devInventory];

    if (effectiveHospitalId) {
      results = results.filter(
        (i) => (i.hospitalId === effectiveHospitalId || i.hospital_id === effectiveHospitalId)
      );
    }

    if (category && category !== 'all') {
      results = results.filter((i) => (i.category || '').toLowerCase().includes(category.toLowerCase()));
    }

    if (search) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (i) =>
          (i.medicineName || i.medicine_name || '').toLowerCase().includes(q) ||
          (i.genericName || i.generic_name || '').toLowerCase().includes(q) ||
          (i.batchNo || i.batchNumber || i.batch_no || '').toLowerCase().includes(q)
      );
    }

    // Recalculate deterministic statuses
    let mappedResults = results.map(this.normalizeLotRecord);

    if (status && status !== 'all') {
      const sNorm = status.toUpperCase().replace(/[\s_-]+/g, '');
      mappedResults = mappedResults.filter((item) => {
        const itemS = item.status.toUpperCase().replace(/[\s_-]+/g, '');
        return itemS === sNorm;
      });
    }

    const total = mappedResults.length;
    const paginated = mappedResults.slice(offset, offset + limitNum);

    return {
      items: paginated,
      total,
      page: pageNum,
      limit: limitNum,
    };
  },

  /**
   * Retrieves single lot by ID with strict ownership validation
   */
  async getLotDetails(lotId, reqUser = null) {
    if (!lotId) {
      const err = new Error('Inventory lot ID is required.');
      err.statusCode = 400;
      throw err;
    }

    let lot = null;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('inventory_lots')
          .select('*, hospitals(name, city, state, email, phone)')
          .eq('id', lotId)
          .single();

        if (!error && data) {
          lot = this.normalizeLotRecord(data);
        }
      } catch (err) {
        // Fall through
      }
    }

    if (!lot) {
      const match = devInventory.find((i) => i.id === lotId);
      if (match) lot = this.normalizeLotRecord(match);
    }

    if (!lot) {
      const err = new Error(`Inventory lot '${lotId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Role-based authorization guard
    if (reqUser?.role === 'hospital') {
      const userHospId = reqUser.hospitalId || reqUser.id;
      if (lot.hospitalId !== userHospId) {
        const err = new Error('Access restricted: You cannot inspect inventory belonging to another healthcare facility.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_HOSPITAL_ISOLATION';
        throw err;
      }
    }

    return lot;
  },

  /**
   * Registers a new inventory lot for an approved hospital
   */
  async addInventoryLot(formData, reqUser) {
    // 1. Hospital Authorization & Approval Verification
    const hospitalId = reqUser?.role === 'hospital'
      ? (reqUser.hospitalId || reqUser.id)
      : (formData.hospitalId || reqUser?.hospitalId);

    if (!hospitalId) {
      const err = new Error('Hospital identity could not be resolved from authenticated session.');
      err.statusCode = 400;
      throw err;
    }

    let hospStatus = (reqUser?.hospital?.status || reqUser?.hospitalStatus || reqUser?.status || '').toUpperCase();
    if (!hospStatus) {
      const authService = require('./authService');
      const devHosp = authService.getDevHospitals().find((h) => h.id === hospitalId);
      if (devHosp) hospStatus = (devHosp.status || '').toUpperCase();
    }

    if (hospStatus === 'PENDING_APPROVAL' || hospStatus === 'PENDING' || hospStatus === 'UNDER_REVIEW') {
      const err = new Error('Your hospital registration is pending administrator approval. Operational stock intake is prohibited.');
      err.statusCode = 403;
      err.code = 'PENDING_ADMIN_APPROVAL';
      throw err;
    }
    if (hospStatus === 'REJECTED') {
      const err = new Error('Hospital registration was rejected. Stock operations are disabled.');
      err.statusCode = 403;
      err.code = 'REGISTRATION_REJECTED';
      throw err;
    }

    // 2. Mandatory field validations
    const medicineName = (formData.medicineName || formData.brandName || '').trim();
    const batchNo = (formData.batchNumber || formData.batchNo || '').trim().toUpperCase();

    if (!medicineName) {
      const err = new Error('Validation Error: Medicine name is mandatory.');
      err.statusCode = 422;
      throw err;
    }
    if (!batchNo) {
      const err = new Error('Validation Error: Batch / Lot number is mandatory.');
      err.statusCode = 422;
      throw err;
    }

    const rawQty = formData.quantity !== undefined ? formData.quantity : formData.totalQuantity;
    const qty = Number(rawQty);
    if (!Number.isFinite(qty) || qty < 0) {
      const err = new Error('Validation Error: Quantity cannot be negative.');
      err.statusCode = 422;
      throw err;
    }

    const rawUnitPrice = formData.unitPrice !== undefined ? formData.unitPrice : (formData.mrp || 100);
    const unitPrice = Number(rawUnitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      const err = new Error('Validation Error: Unit price cannot be negative.');
      err.statusCode = 422;
      throw err;
    }

    const rawMinStock = formData.minimumStock !== undefined ? formData.minimumStock : (formData.minStockLevel || 20);
    const minStock = Number(rawMinStock);
    if (!Number.isFinite(minStock) || minStock < 0) {
      const err = new Error('Validation Error: Minimum stock level cannot be negative.');
      err.statusCode = 422;
      throw err;
    }

    // Date consistency
    const mfgDate = formData.manufacturingDate || formData.mfgDate || new Date().toISOString().split('T')[0];
    const expiryDate = formData.expiryDate || formData.expiry_date;

    if (!expiryDate) {
      const err = new Error('Validation Error: Expiration date is mandatory for pharmaceutical inventory.');
      err.statusCode = 422;
      throw err;
    }

    const mfgTime = new Date(mfgDate).getTime();
    const expTime = new Date(expiryDate).getTime();

    if (mfgTime > expTime) {
      const err = new Error('Validation Error: Manufacturing date cannot be later than Expiry date.');
      err.statusCode = 422;
      throw err;
    }

    // 3. Duplicate Lot Protection: (hospital_id, batch_number)
    const duplicateInMem = devInventory.find(
      (l) =>
        (l.hospitalId === hospitalId || l.hospital_id === hospitalId) &&
        (l.batchNumber === batchNo || l.batchNo === batchNo)
    );

    if (duplicateInMem) {
      const err = new Error(
        `Duplicate Inventory Lot: Batch '${batchNo}' is already registered for this hospital (${duplicateInMem.medicineName}).`
      );
      err.statusCode = 409;
      err.code = 'DUPLICATE_LOT_CONFLICT';
      throw err;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        const { data: existingDbLot } = await supabaseAdmin
          .from('inventory_lots')
          .select('id, batch_number, medicine_name')
          .eq('hospital_id', hospitalId)
          .eq('batch_number', batchNo)
          .limit(1);

        if (existingDbLot && existingDbLot.length > 0) {
          const err = new Error(
            `Duplicate Inventory Lot: Batch '${batchNo}' is already registered for this hospital.`
          );
          err.statusCode = 409;
          err.code = 'DUPLICATE_LOT_CONFLICT';
          throw err;
        }
      } catch (checkEx) {
        if (checkEx.statusCode === 409) throw checkEx;
      }
    }

    // 4. Medicine Formulation Lookup / Linkage
    let linkedMedicineId = formData.medicineId;
    let genericName = formData.genericName || '';
    let category = formData.category || 'General Therapeutics';
    let dosageForm = normalizeDosageForm(formData.dosageForm || formData.form);
    let strength = formData.strength || formData.dosage || formData.power || 'Standard';

    if (linkedMedicineId) {
      try {
        const med = await medicineService.getMedicineById(linkedMedicineId);
        if (med) {
          genericName = med.genericName;
          category = med.category;
          dosageForm = med.dosageForm;
          strength = med.strength;
        }
      } catch (medErr) {
        // Fallback to submitted form parameters
      }
    } else {
      // Find candidate medicine by name
      const masterList = medicineService.getDevMasterMedicines();
      const matchedMaster = masterList.find(
        (m) =>
          m.name.toLowerCase() === medicineName.toLowerCase() ||
          m.brandName.toLowerCase() === medicineName.toLowerCase()
      );
      if (matchedMaster) {
        linkedMedicineId = matchedMaster.id;
        genericName = matchedMaster.genericName;
        category = matchedMaster.category;
        dosageForm = matchedMaster.dosageForm;
        strength = matchedMaster.strength;
      } else {
        linkedMedicineId = uuidv4();
      }
    }

    const lotId = formData.id || uuidv4();
    const nowIso = new Date().toISOString();
    const mrp = Number(formData.mrp || unitPrice || 100);
    const concessionPercent = Math.max(0, Math.min(90, Number(formData.concessionPercent || 10)));
    const concessionRate = Number(
      formData.concessionRate || Math.round(unitPrice * (1 - concessionPercent / 100) * 100) / 100
    );
    const costRate = Number(formData.costRate || formData.acquisitionCost || Math.round(unitPrice * 0.85));

    // Purchase bill references
    const billStoragePath = formData.billStoragePath || `${hospitalId}/${lotId}/${batchNo}_Bill.pdf`;
    const purchaseBillUrl = formData.purchaseBillUrl || `/uploads/bills/${batchNo}_Bill.pdf`;

    const newLot = {
      id: lotId,
      hospitalId,
      hospital_id: hospitalId,
      hospitalName: reqUser?.hospital?.name || formData.hospitalName || 'Authorized Hospital Partner',
      hospitalCity: reqUser?.hospital?.city || formData.hospitalCity || 'Metro Pharmacy',
      hospitalState: reqUser?.hospital?.state || formData.hospitalState || 'India',
      medicineId: linkedMedicineId,
      medicine_id: linkedMedicineId,
      medicineName,
      medicine_name: medicineName,
      brandName: medicineName,
      genericName,
      generic_name: genericName,
      composition: formData.composition || genericName,
      category,
      dosageForm,
      dosage_form: dosageForm,
      form: dosageForm,
      dosage: strength,
      strength,
      packing: formData.packing || formData.packaging || '10 Tablets / Strip',
      packSize: formData.packSize || formData.packing || '10 Tablets / Strip',
      unit: formData.unit || 'Tablet',
      unitsPerPack: Number(formData.unitsPerPack || 10),
      numberOfPacks: Number(formData.numberOfPacks || Math.ceil(qty / (formData.unitsPerPack || 10))),
      manufacturer: formData.manufacturer || 'Authorized Manufacturer',
      batchNumber: batchNo,
      batchNo,
      batch_number: batchNo,
      batch_no: batchNo,
      quantity: qty,
      totalQuantity: qty,
      total_quantity: qty,
      reservedQuantity: 0,
      reserved_quantity: 0,
      availableQuantity: qty,
      available_quantity: qty,
      minimumStock: minStock,
      minimum_stock: minStock,
      minStockLevel: minStock,
      min_stock_level: minStock,
      reorderLevel: minStock,
      reorder_level: minStock,
      shelfLocation: formData.shelfLocation || 'Rack A - Shelf 3',
      shelf_location: formData.shelfLocation || 'Rack A - Shelf 3',
      manufacturingDate: mfgDate,
      mfgDate,
      manufacturing_date: mfgDate,
      mfg_date: mfgDate,
      expiryDate,
      expiry_date: expiryDate,
      unitPrice,
      unit_price: unitPrice,
      mrp,
      concessionRate,
      concession_rate: concessionRate,
      concessionPercent,
      concession_percent: concessionPercent,
      costRate,
      cost_rate: costRate,
      acquisitionCost: costRate,
      acquisition_cost: costRate,
      status: calculateLotStatus({ expiryDate, availableQuantity: qty, minimumStock: minStock }),
      purchaseBillUrl,
      purchase_bill_url: purchaseBillUrl,
      billStoragePath,
      bill_storage_path: billStoragePath,
      supplier: formData.supplier || 'Hospital Direct Procurement',
      notes: formData.notes || '',
      createdAt: nowIso,
      updatedAt: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (isConfigured && supabaseAdmin) {
      try {
        const { error: lotInsertErr } = await supabaseAdmin.from('inventory_lots').insert([{
          id: newLot.id,
          hospital_id: newLot.hospital_id,
          medicine_id: newLot.medicine_id,
          medicine_name: newLot.medicine_name,
          generic_name: newLot.generic_name,
          category: newLot.category,
          dosage_form: newLot.dosage_form,
          dosage: newLot.dosage,
          strength: newLot.strength,
          packing: newLot.packing,
          unit: newLot.unit,
          units_per_pack: newLot.units_per_pack,
          number_of_packs: newLot.number_of_packs,
          manufacturer: newLot.manufacturer,
          batch_number: newLot.batch_number,
          batch_no: newLot.batch_no,
          quantity: newLot.quantity,
          total_quantity: newLot.total_quantity,
          reserved_quantity: 0,
          available_quantity: newLot.available_quantity,
          minimum_stock: newLot.minimum_stock,
          min_stock_level: newLot.min_stock_level,
          reorder_level: newLot.reorder_level,
          shelf_location: newLot.shelf_location,
          manufacturing_date: newLot.manufacturing_date,
          mfg_date: newLot.mfg_date,
          expiry_date: newLot.expiry_date,
          unit_price: newLot.unit_price,
          mrp: newLot.mrp,
          concession_rate: newLot.concession_rate,
          concession_percent: newLot.concession_percent,
          cost_rate: newLot.cost_rate,
          acquisition_cost: newLot.acquisition_cost,
          status: newLot.status,
          purchase_bill_url: newLot.purchase_bill_url,
          bill_storage_path: newLot.bill_storage_path,
          supplier: newLot.supplier,
          notes: newLot.notes,
        }]);

        if (lotInsertErr) {
          logger.warn('Supabase lot insertion warning:', lotInsertErr.message);
        }
      } catch (dbEx) {
        logger.warn('Supabase exception in addInventoryLot:', dbEx.message);
      }
    }

    devInventory.unshift(newLot);

    // Record initial ledger entry in adjustments
    const initialAdjustment = {
      id: uuidv4(),
      inventory_lot_id: newLot.id,
      inventoryLotId: newLot.id,
      hospital_id: newLot.hospitalId,
      hospitalId: newLot.hospitalId,
      previous_quantity: 0,
      previousQuantity: 0,
      quantity_change: qty,
      quantityChange: qty,
      new_quantity: qty,
      newQuantity: qty,
      reason: formData.notes || 'Initial verified stock intake registration',
      action_type: 'INITIAL_INTAKE',
      adjusted_by_name: reqUser?.name || 'Authorized Hospital Liaison',
      timestamp: nowIso,
    };
    devStockAdjustments.unshift(initialAdjustment);

    await auditService.logEvent({
      action: 'INVENTORY_LOT_CREATED',
      entityType: 'INVENTORY',
      entityId: newLot.id,
      actorRole: reqUser?.role || 'hospital',
      hospitalId: newLot.hospitalId,
      hospitalName: newLot.hospitalName,
      summary: `Registered lot ${newLot.batchNumber} of ${newLot.medicineName} (${qty} units) in hospital pharmacy inventory. Status: ${newLot.status}.`,
      resultingStatus: newLot.status,
      metadata: {
        batchNumber: newLot.batchNumber,
        quantity: qty,
        expiryDate: newLot.expiryDate,
        unitPrice: newLot.unitPrice,
      },
    });

    return this.normalizeLotRecord(newLot);
  },

  /**
   * Updates an existing authorized inventory lot
   */
  async updateInventoryLot(id, updateData, reqUser) {
    const lot = await this.getLotDetails(id, reqUser);

    const nowIso = new Date().toISOString();
    const updated = { ...lot, ...updateData };

    if (updateData.quantity !== undefined || updateData.totalQuantity !== undefined) {
      const newTotal = Number(updateData.quantity !== undefined ? updateData.quantity : updateData.totalQuantity);
      if (!Number.isFinite(newTotal) || newTotal < 0) {
        const err = new Error('Validation Error: Quantity cannot be negative.');
        err.statusCode = 422;
        throw err;
      }
      const reserved = Number(lot.reservedQuantity || 0);
      updated.totalQuantity = newTotal;
      updated.quantity = newTotal;
      updated.availableQuantity = Math.max(0, newTotal - reserved);
    }

    if (updateData.unitPrice !== undefined || updateData.mrp !== undefined) {
      const newPrice = Number(updateData.unitPrice !== undefined ? updateData.unitPrice : updateData.mrp);
      if (!Number.isFinite(newPrice) || newPrice < 0) {
        const err = new Error('Validation Error: Unit price cannot be negative.');
        err.statusCode = 422;
        throw err;
      }
      updated.unitPrice = newPrice;
      updated.mrp = newPrice;
    }

    if (updateData.minimumStock !== undefined || updateData.minStockLevel !== undefined) {
      const minS = Number(updateData.minimumStock !== undefined ? updateData.minimumStock : updateData.minStockLevel);
      if (!Number.isFinite(minS) || minS < 0) {
        const err = new Error('Validation Error: Minimum stock cannot be negative.');
        err.statusCode = 422;
        throw err;
      }
      updated.minimumStock = minS;
      updated.minStockLevel = minS;
      updated.reorderLevel = minS;
    }

    // Recalculate deterministic status
    updated.status = calculateLotStatus({
      expiryDate: updated.expiryDate,
      availableQuantity: updated.availableQuantity,
      minimumStock: updated.minimumStock,
    });
    updated.updatedAt = nowIso;
    updated.updated_at = nowIso;

    const idx = devInventory.findIndex((i) => i.id === id);
    if (idx !== -1) {
      devInventory[idx] = updated;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('inventory_lots').update({
          quantity: updated.quantity,
          total_quantity: updated.totalQuantity,
          available_quantity: updated.availableQuantity,
          minimum_stock: updated.minimumStock,
          min_stock_level: updated.minStockLevel,
          reorder_level: updated.reorderLevel,
          unit_price: updated.unitPrice,
          mrp: updated.mrp,
          concession_rate: updated.concessionRate,
          shelf_location: updated.shelfLocation,
          status: updated.status,
          updated_at: nowIso,
        }).eq('id', id);
      } catch (err) {
        logger.warn('Supabase update failed for lot:', err.message);
      }
    }

    await auditService.logEvent({
      action: 'INVENTORY_LOT_UPDATED',
      entityType: 'INVENTORY',
      entityId: id,
      actorRole: reqUser?.role || 'hospital',
      hospitalId: updated.hospitalId,
      hospitalName: updated.hospitalName,
      summary: `Updated lot ${updated.batchNumber} of ${updated.medicineName}. Stock: ${updated.quantity}, Status: ${updated.status}.`,
      resultingStatus: updated.status,
    });

    return this.normalizeLotRecord(updated);
  },

  /**
   * Deactivates / soft-deletes an inventory lot
   */
  async deleteInventoryLot(id, reqUser) {
    const lot = await this.getLotDetails(id, reqUser);

    const idx = devInventory.findIndex((i) => i.id === id);
    if (idx !== -1) {
      devInventory[idx].status = 'depleted';
      devInventory[idx].availableQuantity = 0;
      devInventory[idx].available_quantity = 0;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('inventory_lots').update({
          status: 'depleted',
          available_quantity: 0,
        }).eq('id', id);
      } catch (err) {
        logger.warn('Supabase lot deactivation warning:', err.message);
      }
    }

    await auditService.logEvent({
      action: 'INVENTORY_LOT_DEACTIVATED',
      entityType: 'INVENTORY',
      entityId: id,
      actorRole: reqUser?.role || 'hospital',
      hospitalId: lot.hospitalId,
      hospitalName: lot.hospitalName,
      summary: `Deactivated lot ${lot.batchNumber} of ${lot.medicineName} from operational inventory.`,
      resultingStatus: 'depleted',
    });

    return {
      id,
      status: 'depleted',
      message: `Lot ${lot.batchNumber} successfully removed from active inventory.`,
    };
  },

  /**
   * Performs an atomic stock adjustment with immutable ledger entry
   */
  async adjustStock(id, { quantityChange, reason }, reqUser) {
    if (quantityChange === undefined || quantityChange === null || !Number.isFinite(Number(quantityChange))) {
      const err = new Error('Validation Error: A numeric quantityChange is required.');
      err.statusCode = 422;
      throw err;
    }

    if (!reason || !String(reason).trim()) {
      const err = new Error('Validation Error: An audit reason is mandatory for stock adjustment.');
      err.statusCode = 422;
      throw err;
    }

    const lot = await this.getLotDetails(id, reqUser);

    const delta = Number(quantityChange);
    const previousQty = Number(lot.quantity || lot.totalQuantity || 0);
    const newQty = previousQty + delta;

    // Mathematical Guardrail: Never allow negative inventory balance
    if (newQty < 0) {
      const err = new Error(
        `Invalid Stock Adjustment: Stock cannot become negative. Current available: ${previousQty}, requested delta: ${delta}, resulting: ${newQty}.`
      );
      err.statusCode = 400;
      err.code = 'NEGATIVE_STOCK_FORBIDDEN';
      throw err;
    }

    const reserved = Number(lot.reservedQuantity || 0);
    const newAvailable = Math.max(0, newQty - reserved);
    const nowIso = new Date().toISOString();

    const newStatus = calculateLotStatus({
      expiryDate: lot.expiryDate,
      availableQuantity: newAvailable,
      minimumStock: lot.minimumStock,
    });

    // 1. Create immutable adjustment record
    const adjustmentRecord = {
      id: uuidv4(),
      inventory_lot_id: id,
      inventoryLotId: id,
      hospital_id: lot.hospitalId,
      hospitalId: lot.hospitalId,
      previous_quantity: previousQty,
      previousQuantity: previousQty,
      quantity_change: delta,
      quantityChange: delta,
      new_quantity: newQty,
      newQuantity: newQty,
      reason: String(reason).trim(),
      action_type: delta >= 0 ? 'RESTOCK' : 'STOCK_DEDUCTION',
      adjusted_by_name: reqUser?.name || 'Hospital Authorized Pharmacist',
      timestamp: nowIso,
    };

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('inventory_adjustments').insert([{
          id: adjustmentRecord.id,
          inventory_lot_id: id,
          hospital_id: lot.hospitalId,
          previous_quantity: previousQty,
          quantity_change: delta,
          new_quantity: newQty,
          reason: adjustmentRecord.reason,
          action_type: adjustmentRecord.action_type,
          adjusted_by_name: adjustmentRecord.adjusted_by_name,
          timestamp: nowIso,
        }]);

        await supabaseAdmin.from('inventory_lots').update({
          quantity: newQty,
          total_quantity: newQty,
          available_quantity: newAvailable,
          status: newStatus,
          updated_at: nowIso,
        }).eq('id', id);
      } catch (dbEx) {
        logger.warn('Supabase exception in adjustStock:', dbEx.message);
      }
    }

    // In-memory sync
    devStockAdjustments.unshift(adjustmentRecord);

    const idx = devInventory.findIndex((i) => i.id === id);
    if (idx !== -1) {
      devInventory[idx].quantity = newQty;
      devInventory[idx].totalQuantity = newQty;
      devInventory[idx].availableQuantity = newAvailable;
      devInventory[idx].status = newStatus;
      devInventory[idx].updatedAt = nowIso;
    }

    await auditService.logEvent({
      action: 'STOCK_ADJUSTED',
      entityType: 'INVENTORY',
      entityId: id,
      actorRole: reqUser?.role || 'hospital',
      hospitalId: lot.hospitalId,
      hospitalName: lot.hospitalName,
      summary: `Adjusted stock for ${lot.medicineName} (Batch ${lot.batchNumber}) by ${delta >= 0 ? '+' : ''}${delta} units. Previous: ${previousQty}, New Total: ${newQty}. Reason: ${adjustmentRecord.reason}`,
      resultingStatus: newStatus,
      metadata: {
        previousQuantity: previousQty,
        quantityChange: delta,
        newQuantity: newQty,
        reason: adjustmentRecord.reason,
      },
    });

    return {
      lot: this.normalizeLotRecord(devInventory[idx] || lot),
      adjustment: adjustmentRecord,
      message: `Stock successfully adjusted to ${newQty} units.`,
    };
  },

  /**
   * Retrieves historical adjustment ledger for an inventory lot
   */
  async getLotHistory(lotId, reqUser) {
    const lot = await this.getLotDetails(lotId, reqUser);

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('inventory_adjustments')
          .select('*')
          .eq('inventory_lot_id', lotId)
          .order('timestamp', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            inventoryLotId: d.inventory_lot_id,
            hospitalId: d.hospital_id,
            previousQuantity: d.previous_quantity,
            quantityChange: d.quantity_change,
            newQuantity: d.new_quantity,
            reason: d.reason,
            actionType: d.action_type,
            adjustedByName: d.adjusted_by_name,
            timestamp: d.timestamp,
          }));
        }
      } catch (err) {
        // Memory fallback
      }
    }

    return devStockAdjustments
      .filter((a) => a.inventoryLotId === lotId || a.inventory_lot_id === lotId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  /**
   * Marketplace Inventory Queries (Eligible available stock from partner hospitals)
   */
  async getMarketplaceInventory({ currentHospitalId = null, category = 'all', dosageForm = 'all', search = '', page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let items = [];

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client
          .from('inventory_lots')
          .select('*, hospitals!inner(id, name, city, state, status)')
          .in('hospitals.status', ['APPROVED', 'approved', 'verified'])
          .gt('available_quantity', 0)
          .gte('expiry_date', new Date().toISOString().split('T')[0]);

        if (currentHospitalId) {
          query = query.neq('hospital_id', currentHospitalId);
        }
        if (category && category !== 'all') {
          query = query.ilike('category', `%${category}%`);
        }
        if (dosageForm && dosageForm !== 'all') {
          query = query.ilike('dosage_form', `%${dosageForm}%`);
        }
        if (search) {
          const q = search.trim();
          query = query.or(
            `medicine_name.ilike.%${q}%,generic_name.ilike.%${q}%,category.ilike.%${q}%`
          );
        }

        const { data, error } = await query
          .order('expiry_date', { ascending: true })
          .range(offset, offset + limitNum - 1);

        if (!error && data && data.length > 0) {
          items = data.map((d) => ({
            id: d.id,
            hospitalId: d.hospital_id,
            hospitalName: d.hospitals?.name || 'Verified Hospital Partner',
            hospitalCity: d.hospitals?.city || 'District Central',
            hospitalState: d.hospitals?.state || 'India',
            medicineId: d.medicine_id,
            medicineName: d.medicine_name,
            genericName: d.generic_name,
            category: d.category,
            dosageForm: d.dosage_form,
            strength: d.strength,
            batchNumber: d.batch_number,
            availableQuantity: d.available_quantity,
            expiryDate: d.expiry_date,
            unitPrice: Number(d.concession_rate || d.unit_price),
            originalPrice: Number(d.mrp || d.unit_price),
            concessionPercent: Number(d.concession_percent || 10),
            shelfLifeStatus: getDaysUntilExpiry(d.expiry_date) <= 90 ? 'Expiring Soon' : 'Good',
          }));
          return items;
        }
      } catch (err) {
        logger.warn('Marketplace query fallback:', err.message);
      }
    }

    // In-memory fallback
    const authService = require('./authService');
    const approvedHospIds = new Set(
      authService.getDevHospitals()
        .filter((h) => ['APPROVED', 'approved', 'verified'].includes(h.status))
        .map((h) => h.id)
    );

    let filtered = devInventory.filter((lot) => {
      const hospId = lot.hospitalId || lot.hospital_id;
      // Approved hospital only
      if (!approvedHospIds.has(hospId)) return false;
      // Exclude caller hospital
      if (currentHospitalId && hospId === currentHospitalId) return false;
      // Exclude expired
      if (isLotExpired(lot.expiryDate || lot.expiry_date)) return false;
      // Exclude zero available stock
      const avail = Number(lot.availableQuantity !== undefined ? lot.availableQuantity : lot.quantity);
      if (avail <= 0) return false;

      return true;
    });

    if (category && category !== 'all') {
      filtered = filtered.filter((l) => (l.category || '').toLowerCase().includes(category.toLowerCase()));
    }
    if (dosageForm && dosageForm !== 'all') {
      filtered = filtered.filter(
        (l) => (l.dosageForm || l.form || '').toLowerCase().includes(dosageForm.toLowerCase())
      );
    }
    if (search) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          (l.medicineName || '').toLowerCase().includes(q) ||
          (l.genericName || '').toLowerCase().includes(q)
      );
    }

    return filtered.slice(offset, offset + limitNum).map((lot) => ({
      id: lot.id,
      hospitalId: lot.hospitalId,
      hospitalName: lot.hospitalName,
      hospitalCity: lot.hospitalCity,
      hospitalState: lot.hospitalState,
      medicineId: lot.medicineId,
      medicineName: lot.medicineName,
      genericName: lot.genericName,
      category: lot.category,
      dosageForm: lot.dosageForm,
      strength: lot.strength,
      batchNumber: lot.batchNumber,
      availableQuantity: lot.availableQuantity,
      expiryDate: lot.expiryDate,
      unitPrice: Number(lot.concessionRate || lot.unitPrice),
      originalPrice: Number(lot.mrp || lot.unitPrice),
      concessionPercent: Number(lot.concessionPercent || 10),
      shelfLifeStatus: getDaysUntilExpiry(lot.expiryDate) <= 90 ? 'Expiring Soon' : 'Good',
    }));
  },

  // =========================================================================
  // ADMIN INVENTORY DUAL HIERARCHIES (Medicine -> Hospital & Hospital -> Medicine)
  // =========================================================================

  /**
   * Admin Hierarchy 1 - Level 1: Aggregates inventory by unique Medicine identity
   */
  async getAdminInventoryByMedicine({ search = '', category = 'all', dosageForm = 'all' } = {}) {
    const { items: allLots } = await this.getInventory({ status: 'all', category, search, limit: 1000 });

    const medicineMap = new Map();

    allLots.forEach((lot) => {
      const medKey = lot.canonicalCompositionKey || lot.medicineId || lot.medicineName.toLowerCase();

      if (!medicineMap.has(medKey)) {
        medicineMap.set(medKey, {
          key: medKey,
          medicineId: lot.medicineId,
          medicineName: lot.medicineName,
          genericName: lot.genericName,
          category: lot.category,
          dosageForm: lot.dosageForm,
          strength: lot.strength,
          totalStock: 0,
          availableStock: 0,
          batchCount: 0,
          hospitalsSet: new Set(),
          earliestExpiry: lot.expiryDate,
          stockStatus: 'AVAILABLE',
        });
      }

      const entry = medicineMap.get(medKey);
      entry.totalStock += Number(lot.quantity || 0);
      entry.availableStock += Number(lot.availableQuantity || 0);
      entry.batchCount += 1;
      entry.hospitalsSet.add(lot.hospitalId);

      if (lot.expiryDate && (!entry.earliestExpiry || new Date(lot.expiryDate) < new Date(entry.earliestExpiry))) {
        entry.earliestExpiry = lot.expiryDate;
      }
    });

    return Array.from(medicineMap.values()).map((m) => {
      let status = 'AVAILABLE';
      if (isLotExpired(m.earliestExpiry)) status = 'EXPIRED';
      else if (getDaysUntilExpiry(m.earliestExpiry) <= 90) status = 'EXPIRING_SOON';
      else if (m.availableStock <= 0) status = 'OUT_OF_STOCK';
      else if (m.availableStock <= 50) status = 'LOW_STOCK';

      return {
        key: m.key,
        medicineId: m.medicineId,
        medicineName: m.medicineName,
        genericName: m.genericName,
        category: m.category,
        dosageForm: m.dosageForm,
        strength: m.strength,
        totalStock: m.totalStock,
        availableStock: m.availableStock,
        batchCount: m.batchCount,
        contributingHospitalCount: m.hospitalsSet.size,
        earliestExpiry: m.earliestExpiry,
        stockStatus: status,
      };
    }).sort((a, b) => a.medicineName.localeCompare(b.medicineName));
  },

  /**
   * Admin Hierarchy 1 - Level 2: Contributing Hospitals for a specific Medicine
   */
  async getMedicineContributors(medicineId) {
    const { items: allLots } = await this.getInventory({ status: 'all', limit: 1000 });
    const matchingLots = allLots.filter((l) => l.medicineId === medicineId || l.canonicalCompositionKey === medicineId);

    const totalUnits = matchingLots.reduce((acc, l) => acc + Number(l.quantity || 0), 0);
    const hospitalMap = new Map();

    matchingLots.forEach((lot) => {
      const hId = lot.hospitalId;
      if (!hospitalMap.has(hId)) {
        hospitalMap.set(hId, {
          hospitalId: hId,
          hospitalName: lot.hospitalName,
          hospitalCity: lot.hospitalCity,
          hospitalState: lot.hospitalState,
          contributedUnits: 0,
          batchCount: 0,
        });
      }
      const h = hospitalMap.get(hId);
      h.contributedUnits += Number(lot.quantity || 0);
      h.batchCount += 1;
    });

    return Array.from(hospitalMap.values()).map((h) => ({
      ...h,
      percentageOfTotalStock: totalUnits > 0 ? Math.round((h.contributedUnits / totalUnits) * 1000) / 10 : 0,
    })).sort((a, b) => b.contributedUnits - a.contributedUnits);
  },

  /**
   * Admin Hierarchy 1 - Level 3: Batches for a specific Medicine and Hospital
   */
  async getMedicineHospitalBatches(medicineId, hospitalId) {
    const { items: allLots } = await this.getInventory({ hospitalId, status: 'all', limit: 500 });
    return allLots
      .filter((l) => l.medicineId === medicineId || l.canonicalCompositionKey === medicineId)
      .map(this.normalizeLotRecord);
  },

  /**
   * Admin Hierarchy 2 - Level 1: Aggregates inventory by Hospital
   */
  async getAdminInventoryByHospital({ search = '', city = 'all' } = {}) {
    const { items: allLots } = await this.getInventory({ status: 'all', limit: 2000 });

    const hospitalMap = new Map();

    allLots.forEach((lot) => {
      const hId = lot.hospitalId;
      if (!hospitalMap.has(hId)) {
        hospitalMap.set(hId, {
          hospitalId: hId,
          hospitalName: lot.hospitalName,
          hospitalCity: lot.hospitalCity,
          hospitalState: lot.hospitalState,
          totalUnits: 0,
          availableUnits: 0,
          batchCount: 0,
          medicinesSet: new Set(),
        });
      }

      const h = hospitalMap.get(hId);
      h.totalUnits += Number(lot.quantity || 0);
      h.availableUnits += Number(lot.availableQuantity || 0);
      h.batchCount += 1;
      h.medicinesSet.add(lot.medicineId || lot.medicineName);
    });

    let list = Array.from(hospitalMap.values()).map((h) => ({
      hospitalId: h.hospitalId,
      hospitalName: h.hospitalName,
      hospitalCity: h.hospitalCity,
      hospitalState: h.hospitalState,
      totalUnits: h.totalUnits,
      availableUnits: h.availableUnits,
      uniqueMedicinesCount: h.medicinesSet.size,
      batchCount: h.batchCount,
    }));

    if (city && city !== 'all') {
      list = list.filter((h) => (h.hospitalCity || '').toLowerCase().includes(city.toLowerCase()));
    }
    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (h) => (h.hospitalName || '').toLowerCase().includes(q) || (h.hospitalCity || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.totalUnits - a.totalUnits);
  },

  /**
   * Admin Hierarchy 2 - Level 2: Medicines for a specific Hospital
   */
  async getHospitalMedicines(hospitalId) {
    const { items: allLots } = await this.getInventory({ hospitalId, status: 'all', limit: 500 });

    const medMap = new Map();

    allLots.forEach((lot) => {
      const key = lot.medicineId || lot.medicineName;
      if (!medMap.has(key)) {
        medMap.set(key, {
          medicineId: lot.medicineId,
          medicineName: lot.medicineName,
          genericName: lot.genericName,
          category: lot.category,
          dosageForm: lot.dosageForm,
          strength: lot.strength,
          totalUnits: 0,
          batchCount: 0,
        });
      }

      const entry = medMap.get(key);
      entry.totalUnits += Number(lot.quantity || 0);
      entry.batchCount += 1;
    });

    return Array.from(medMap.values()).sort((a, b) => a.medicineName.localeCompare(b.medicineName));
  },

  /**
   * Admin Hierarchy 2 - Level 3: Batches for a specific Hospital and Medicine
   */
  async getHospitalMedicineBatches(hospitalId, medicineId) {
    const { items: allLots } = await this.getInventory({ hospitalId, status: 'all', limit: 500 });
    return allLots
      .filter((l) => l.medicineId === medicineId || l.canonicalCompositionKey === medicineId)
      .map(this.normalizeLotRecord);
  },

  /**
   * Admin Level 4: Complete Lot/Batch Detail with exact Purchase Bill
   */
  async getBatchDetail(batchId) {
    let lot = null;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('inventory_lots')
          .select('*, hospitals(id, name, city, state, registration_no, email, phone)')
          .or(`id.eq.${batchId},batch_number.eq.${batchId},batch_no.eq.${batchId}`)
          .limit(1)
          .single();

        if (!error && data) lot = this.normalizeLotRecord(data);
      } catch (err) {
        // Memory fallback
      }
    }

    if (!lot) {
      const match = devInventory.find(
        (l) => l.id === batchId || l.batchNumber === batchId || l.batchNo === batchId
      );
      if (match) lot = this.normalizeLotRecord(match);
    }

    if (!lot) {
      const err = new Error(`Batch / Lot '${batchId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return lot;
  },

  /**
   * Thread-safe atomic stock reservation
   * Ensures two hospitals cannot reserve the same units simultaneously
   */
  async reserveStock(lotId, quantity) {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      const err = new Error('Requested reservation quantity must be greater than zero.');
      err.statusCode = 400;
      throw err;
    }

    const unlock = await lotMutex.acquire(lotId);
    try {
      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data, error } = await client.rpc('reserve_stock_for_request', {
              p_lot_id: lotId,
              p_quantity: qty,
            });
            if (!error && data?.success) {
              const devLot = devInventory.find((l) => l.id === lotId || l.batchNumber === lotId || l.batchNo === lotId);
              if (devLot) {
                devLot.available_quantity = data.available_quantity;
                devLot.availableQuantity = data.available_quantity;
                devLot.reserved_quantity = data.reserved_quantity;
                devLot.reservedQuantity = data.reserved_quantity;
              }
              return data;
            }
            if (error && (error.message.includes('Insufficient available stock') || error.message.includes('insufficient'))) {
              const err = new Error(error.message);
              err.statusCode = 409;
              err.code = 'INSUFFICIENT_STOCK';
              throw err;
            }
          } catch (dbErr) {
            if (dbErr.statusCode) throw dbErr;
          }

          // Direct Optimistic Concurrency Control (CAS) fallback on inventory_lots
          try {
            const { data: dbLot, error: fetchErr } = await client
              .from('inventory_lots')
              .select('*')
              .eq('id', lotId)
              .single();

            if (!fetchErr && dbLot) {
              const expDate = dbLot.expiry_date || dbLot.expiryDate;
              if (expDate && new Date(expDate) <= new Date()) {
                const err = new Error(`Cannot request expired lot (expired on ${expDate}).`);
                err.statusCode = 400;
                throw err;
              }

              const currentAvail = Number(dbLot.available_quantity);
              if (currentAvail < qty) {
                const err = new Error(`Insufficient available stock: Only ${currentAvail} units available, but ${qty} requested.`);
                err.statusCode = 409;
                err.code = 'INSUFFICIENT_STOCK';
                throw err;
              }

              const newAvail = currentAvail - qty;
              const newRes = Number(dbLot.reserved_quantity || 0) + qty;
              const { data: updatedRows, error: updateErr } = await client
                .from('inventory_lots')
                .update({
                  available_quantity: newAvail,
                  reserved_quantity: newRes,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lotId)
                .eq('available_quantity', currentAvail)
                .gte('available_quantity', qty)
                .select();

              if (!updateErr && updatedRows && updatedRows.length > 0) {
                const saved = updatedRows[0];
                return {
                  success: true,
                  lotId: saved.id,
                  availableQuantity: saved.available_quantity,
                  reservedQuantity: saved.reserved_quantity,
                  totalQuantity: saved.quantity,
                  unitPrice: Number(saved.concession_rate || saved.unit_price || 100),
                  medicineId: saved.medicine_id,
                  medicineName: saved.medicine_name,
                  genericName: saved.generic_name,
                  batchNumber: saved.batch_number,
                  hospitalId: saved.hospital_id,
                };
              }
              if (!updateErr && (!updatedRows || updatedRows.length === 0)) {
                const err = new Error('Concurrent stock reservation conflict. Insufficient stock available.');
                err.statusCode = 409;
                err.code = 'INSUFFICIENT_STOCK';
                throw err;
              }
            }
          } catch (casErr) {
            if (casErr.statusCode) throw casErr;
          }
        }
      }

      const lot = devInventory.find(
        (l) => l.id === lotId || l.batchNumber === lotId || l.batchNo === lotId
      );

      if (!lot) {
        const err = new Error(`Inventory lot '${lotId}' not found.`);
        err.statusCode = 404;
        throw err;
      }

      const rawExp = lot.expiry_date || lot.expiryDate;
      if (rawExp && new Date(rawExp) <= new Date()) {
        const err = new Error(`Cannot request expired lot (expired on ${rawExp}).`);
        err.statusCode = 400;
        throw err;
      }

      const available = Number(lot.available_quantity !== undefined ? lot.available_quantity : (lot.availableQuantity !== undefined ? lot.availableQuantity : lot.quantity));
      if (available < qty) {
        const err = new Error(`Insufficient available stock: Only ${available} units available, but ${qty} requested.`);
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_STOCK';
        throw err;
      }

      const curReserved = Number(lot.reserved_quantity || lot.reservedQuantity || 0);
      const newReserved = curReserved + qty;
      const newAvailable = available - qty;

      lot.available_quantity = newAvailable;
      lot.availableQuantity = newAvailable;
      lot.reserved_quantity = newReserved;
      lot.reservedQuantity = newReserved;
      lot.status = calculateLotStatus({
        expiryDate: rawExp,
        availableQuantity: newAvailable,
        minimumStock: lot.minimumStock || 20,
      });

      return {
        success: true,
        lotId: lot.id,
        availableQuantity: newAvailable,
        reservedQuantity: newReserved,
        totalQuantity: Number(lot.quantity || lot.totalQuantity || 0),
        unitPrice: Number(lot.concessionRate || lot.unitPrice || 100),
        medicineId: lot.medicineId,
        medicineName: lot.medicineName,
        genericName: lot.genericName,
        batchNumber: lot.batchNumber || lot.batchNo,
        hospitalId: lot.hospitalId,
        hospitalName: lot.hospitalName,
      };
    } finally {
      unlock();
    }
  },

  /**
   * Thread-safe atomic stock release
   * Restores available stock and decrements reserved stock
   */
  async releaseReservation(lotId, quantity) {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return { success: true };

    const unlock = await lotMutex.acquire(lotId);
    try {
      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data, error } = await client.rpc('release_reserved_stock', {
              p_lot_id: lotId,
              p_quantity: qty,
            });
            if (!error && data?.success) {
              const devLot = devInventory.find((l) => l.id === lotId || l.batchNumber === lotId || l.batchNo === lotId);
              if (devLot) {
                devLot.available_quantity = data.available_quantity;
                devLot.availableQuantity = data.available_quantity;
                devLot.reserved_quantity = data.reserved_quantity;
                devLot.reservedQuantity = data.reserved_quantity;
              }
              return data;
            }
          } catch (dbErr) {
            // Fall through to CAS update
          }

          try {
            const { data: dbLot, error: fetchErr } = await client
              .from('inventory_lots')
              .select('id, quantity, available_quantity, reserved_quantity')
              .eq('id', lotId)
              .single();

            if (!fetchErr && dbLot) {
              const curRes = Number(dbLot.reserved_quantity || 0);
              const curAvail = Number(dbLot.available_quantity || 0);
              const totalQty = Number(dbLot.quantity || 0);
              const newRes = Math.max(0, curRes - qty);
              const newAvail = Math.min(totalQty, curAvail + qty);

              await client
                .from('inventory_lots')
                .update({
                  available_quantity: newAvail,
                  reserved_quantity: newRes,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lotId);
            }
          } catch (casErr) {
            // Fall through
          }
        }
      }

      const lot = devInventory.find(
        (l) => l.id === lotId || l.batchNumber === lotId || l.batchNo === lotId
      );

      if (!lot) return { success: false, message: 'Lot not found' };

      const totalQty = Number(lot.quantity || lot.totalQuantity || 0);
      const curReserved = Number(lot.reserved_quantity || lot.reservedQuantity || 0);
      const curAvailable = Number(lot.available_quantity !== undefined ? lot.available_quantity : (lot.availableQuantity !== undefined ? lot.availableQuantity : totalQty));

      const newReserved = Math.max(0, curReserved - qty);
      const newAvailable = Math.min(totalQty, curAvailable + qty);

      lot.available_quantity = newAvailable;
      lot.availableQuantity = newAvailable;
      lot.reserved_quantity = newReserved;
      lot.reservedQuantity = newReserved;
      lot.status = calculateLotStatus({
        expiryDate: lot.expiry_date || lot.expiryDate,
        availableQuantity: newAvailable,
        minimumStock: lot.minimumStock || 20,
      });

      return {
        success: true,
        lotId: lot.id,
        availableQuantity: newAvailable,
        reservedQuantity: newReserved,
      };
    } finally {
      unlock();
    }
  },

  /**
   * Permanently deducts delivered stock from both total and reserved quantity
   */
  async commitStockDeduction(lotId, quantity) {
    const qty = Number(quantity);
    const unlock = await lotMutex.acquire(lotId);
    try {
      if (isConfigured) {
        const client = supabaseAdmin || supabaseAnon;
        if (client) {
          try {
            const { data: dbLot, error: fetchErr } = await client
              .from('inventory_lots')
              .select('id, quantity, reserved_quantity')
              .eq('id', lotId)
              .single();

            if (!fetchErr && dbLot) {
              const totalQty = Number(dbLot.quantity || 0);
              const curReserved = Number(dbLot.reserved_quantity || 0);
              const newTotal = Math.max(0, totalQty - qty);
              const newReserved = Math.max(0, curReserved - qty);

              await client
                .from('inventory_lots')
                .update({
                  quantity: newTotal,
                  total_quantity: newTotal,
                  reserved_quantity: newReserved,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lotId);
            }
          } catch (dbErr) {
            // Note error
          }
        }
      }

      const lot = devInventory.find((l) => l.id === lotId || l.batchNumber === lotId || l.batchNo === lotId);
      if (!lot) return { success: false };

      const totalQty = Number(lot.quantity || lot.totalQuantity || 0);
      const curReserved = Number(lot.reserved_quantity || lot.reservedQuantity || 0);

      const newTotal = Math.max(0, totalQty - qty);
      const newReserved = Math.max(0, curReserved - qty);

      lot.quantity = newTotal;
      lot.totalQuantity = newTotal;
      lot.reserved_quantity = newReserved;
      lot.reservedQuantity = newReserved;

      return { success: true, lotId: lot.id, totalQuantity: newTotal, reservedQuantity: newReserved };
    } finally {
      unlock();
    }
  },

  /**
   * Retrieves active, verified, non-expired marketplace listings
   */
  async getMarketplace({
    search,
    category,
    dosageForm,
    strength,
    route,
    composition,
    sellerHospitalId,
    minPrice,
    maxPrice,
    minStock,
    inStockOnly = true,
    minDaysToExpiry,
    notExpired = true,
    sortBy = 'relevance',
    page = 1,
    limit = 50,
    currentHospitalId = null,
    isAdmin = false,
  } = {}) {
    let lots = devInventory.map((l) => this.normalizeLotRecord(l));

    const now = new Date();

    // 1. Exclude expired lots
    if (notExpired) {
      lots = lots.filter((l) => {
        const exp = new Date(l.expiryDate);
        return !isNaN(exp) && exp > now;
      });
    }

    // 2. Exclude non-active and zero stock
    if (inStockOnly) {
      lots = lots.filter((l) => Number(l.availableQuantity) > 0 && l.status !== 'depleted' && l.status !== 'quarantined');
    }

    // 3. Exclude caller's own inventory unless admin
    if (!isAdmin && currentHospitalId) {
      lots = lots.filter((l) => l.hospitalId !== currentHospitalId);
    }

    // 4. Multi-parameter filtering
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      lots = lots.filter((l) =>
        (l.medicineName || '').toLowerCase().includes(q) ||
        (l.genericName || '').toLowerCase().includes(q) ||
        (l.brandName || '').toLowerCase().includes(q) ||
        (l.composition || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q) ||
        (l.strength || '').toLowerCase().includes(q) ||
        (l.hospitalName || '').toLowerCase().includes(q) ||
        (l.hospitalCity || '').toLowerCase().includes(q)
      );
    }

    if (category && category !== 'all') {
      lots = lots.filter((l) => (l.category || '').toLowerCase().includes(category.toLowerCase()));
    }

    if (dosageForm && dosageForm !== 'all') {
      lots = lots.filter((l) => (l.dosageForm || '').toLowerCase().includes(dosageForm.toLowerCase()));
    }

    if (strength) {
      lots = lots.filter((l) => (l.strength || '').toLowerCase().includes(strength.toLowerCase()));
    }

    if (sellerHospitalId && sellerHospitalId !== 'all') {
      lots = lots.filter((l) => l.hospitalId === sellerHospitalId);
    }

    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      lots = lots.filter((l) => l.unitPrice >= Number(minPrice));
    }

    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      lots = lots.filter((l) => l.unitPrice <= Number(maxPrice));
    }

    if (minStock !== undefined && minStock !== null && minStock !== '') {
      lots = lots.filter((l) => l.availableQuantity >= Number(minStock));
    }

    if (minDaysToExpiry) {
      lots = lots.filter((l) => (l.daysUntilExpiry || 0) >= Number(minDaysToExpiry));
    }

    // 5. Sorting
    switch (sortBy) {
      case 'price_asc':
        lots.sort((a, b) => a.unitPrice - b.unitPrice);
        break;
      case 'price_desc':
        lots.sort((a, b) => b.unitPrice - a.unitPrice);
        break;
      case 'stock':
      case 'stock_desc':
        lots.sort((a, b) => b.availableQuantity - a.availableQuantity);
        break;
      case 'stock_asc':
        lots.sort((a, b) => a.availableQuantity - b.availableQuantity);
        break;
      case 'expiry':
      case 'expiry_asc':
        lots.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        break;
      case 'expiry_desc':
        lots.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate));
        break;
      default:
        break;
    }

    const total = lots.length;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const offset = (pageNum - 1) * limitNum;
    const paginated = lots.slice(offset, offset + limitNum);

    // Sanitize public seller fields
    const sanitized = paginated.map((l) => ({
      id: l.id,
      medicineId: l.medicineId,
      medicineName: l.medicineName,
      brandName: l.brandName,
      genericName: l.genericName,
      composition: l.composition,
      strength: l.strength,
      power: l.strength,
      dosageForm: l.dosageForm,
      route: l.route || 'Oral',
      category: l.category,
      manufacturer: l.manufacturer,
      packaging: l.packaging || l.packing,
      packSize: l.packing || l.packSize,
      batchNumber: l.batchNumber,
      batchNo: l.batchNo,
      manufacturingDate: l.manufacturingDate,
      mfgDate: l.mfgDate,
      expiryDate: l.expiryDate,
      daysUntilExpiry: l.daysUntilExpiry,
      quantity: l.availableQuantity,
      availableQuantity: l.availableQuantity,
      unitPrice: l.unitPrice,
      unitOriginalPrice: l.mrp || l.unitPrice,
      concessionPercent: l.concessionPercent,
      concessionRate: l.concessionRate,
      status: l.status,
      purchaseBillUrl: l.purchaseBillUrl,
      billStoragePath: l.billStoragePath,
      seller: {
        id: l.hospitalId,
        hospitalId: l.hospitalId,
        name: l.hospitalName,
        hospitalName: l.hospitalName,
        city: l.hospitalCity,
        state: l.hospitalState,
      },
      hospitalId: l.hospitalId,
      hospitalName: l.hospitalName,
      location: `${l.hospitalCity}, ${l.hospitalState}`,
      distanceKm: 12,
    }));

    return {
      items: sanitized,
      listings: sanitized,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  },

  /**
   * Detail endpoint for a single marketplace lot
   */
  async getMarketplaceItem(lotId) {
    const lot = await this.getBatchDetail(lotId);
    return {
      id: lot.id,
      medicineId: lot.medicineId,
      name: lot.medicineName,
      medicineName: lot.medicineName,
      brandName: lot.brandName,
      genericName: lot.genericName,
      composition: lot.composition,
      strength: lot.strength,
      power: lot.strength,
      dosageForm: lot.dosageForm,
      route: lot.route || 'Oral',
      category: lot.category,
      manufacturer: lot.manufacturer,
      packaging: lot.packaging || lot.packing,
      packing: lot.packing,
      packSize: lot.packing,
      batchNumber: lot.batchNumber,
      batchNo: lot.batchNo,
      quantity: lot.availableQuantity,
      availableQuantity: lot.availableQuantity,
      reservedQuantity: lot.reservedQuantity,
      unitPrice: lot.unitPrice,
      mrp: lot.mrp,
      concessionRate: lot.concessionRate,
      concessionPercent: lot.concessionPercent,
      manufacturingDate: lot.manufacturingDate,
      mfgDate: lot.mfgDate,
      expiryDate: lot.expiryDate,
      daysUntilExpiry: lot.daysUntilExpiry,
      status: lot.status,
      purchaseBillUrl: lot.purchaseBillUrl,
      billStoragePath: lot.billStoragePath,
      seller: {
        id: lot.hospitalId,
        hospitalId: lot.hospitalId,
        name: lot.hospitalName,
        hospitalName: lot.hospitalName,
        city: lot.hospitalCity,
        state: lot.hospitalState,
      },
      hospitalId: lot.hospitalId,
      hospitalName: lot.hospitalName,
      location: `${lot.hospitalCity}, ${lot.hospitalState}`,
      distanceKm: 12,
    };
  },

  /**
   * Eligible inventory lots for alternatives calculation
   */
  async getMarketplaceInventory({ currentHospitalId = null } = {}) {
    return devInventory
      .filter((l) => {
        if (currentHospitalId && (l.hospital_id === currentHospitalId || l.hospitalId === currentHospitalId)) return false;
        const exp = new Date(l.expiry_date || l.expiryDate);
        return exp > new Date() && (l.available_quantity > 0 || l.availableQuantity > 0);
      })
      .map((l) => this.normalizeLotRecord(l));
  },

  normalizeLotRecord(l) {
    const rawExp = l.expiry_date || l.expiryDate;
    const rawMfg = l.manufacturing_date || l.mfg_date || l.mfgDate;
    const rawBatch = l.batch_number || l.batch_no || l.batchNumber || l.batchNo;
    const avail = Number(l.available_quantity !== undefined ? l.available_quantity : (l.availableQuantity !== undefined ? l.availableQuantity : l.quantity));
    const minS = Number(l.minimum_stock !== undefined ? l.minimum_stock : (l.min_stock_level !== undefined ? l.min_stock_level : 20));

    const computedStatus = calculateLotStatus({
      expiryDate: rawExp,
      availableQuantity: avail,
      minimumStock: minS,
    });

    const canonicalKey = computeCanonicalCompositionKey({
      genericName: l.generic_name || l.genericName,
      strength: l.strength || l.dosage,
      dosageForm: l.dosage_form || l.dosageForm || l.form,
      composition: l.composition || l.generic_name,
    });

    return {
      id: l.id,
      hospitalId: l.hospital_id || l.hospitalId,
      hospitalName: l.hospitals?.name || l.hospitalName || 'Authorized Hospital Partner',
      hospitalCity: l.hospitals?.city || l.hospitalCity || 'Metro Pharmacy',
      hospitalState: l.hospitals?.state || l.hospitalState || 'India',
      medicineId: l.medicine_id || l.medicineId,
      medicineName: l.medicine_name || l.medicineName || l.brandName,
      brandName: l.brandName || l.medicine_name || l.medicineName,
      genericName: l.generic_name || l.genericName,
      composition: l.composition || l.generic_name || l.genericName,
      category: l.category,
      dosageForm: l.dosage_form || l.dosageForm || l.form || 'Tablet',
      form: l.dosage_form || l.dosageForm || l.form || 'Tablet',
      dosage: l.dosage || l.strength || 'Standard',
      strength: l.strength || l.dosage || 'Standard',
      packing: l.packing || '10 Tablets / Strip',
      packSize: l.packSize || l.packing || '10 Tablets / Strip',
      unit: l.unit || 'Tablet',
      unitsPerPack: Number(l.units_per_pack || l.unitsPerPack || 10),
      numberOfPacks: Number(l.number_of_packs || l.numberOfPacks || 1),
      manufacturer: l.manufacturer || 'Authorized Manufacturer',
      batchNumber: rawBatch,
      batchNo: rawBatch,
      quantity: Number(l.quantity || 0),
      totalQuantity: Number(l.total_quantity || l.totalQuantity || l.quantity || 0),
      reservedQuantity: Number(l.reserved_quantity || l.reservedQuantity || 0),
      availableQuantity: avail,
      minimumStock: minS,
      minStockLevel: minS,
      reorderLevel: minS,
      shelfLocation: l.shelf_location || l.shelfLocation || 'Rack A - Shelf 3',
      manufacturingDate: rawMfg,
      mfgDate: rawMfg,
      expiryDate: rawExp,
      daysUntilExpiry: getDaysUntilExpiry(rawExp),
      unitPrice: Number(l.unit_price || l.unitPrice || 100),
      mrp: Number(l.mrp || l.unit_price || 100),
      concessionRate: Number(l.concession_rate || l.concessionRate || 90),
      concessionPercent: Number(l.concession_percent || l.concessionPercent || 10),
      costRate: Number(l.cost_rate || l.costRate || 85),
      acquisitionCost: Number(l.acquisition_cost || l.acquisitionCost || 85),
      status: computedStatus,
      stockStatus: computedStatus,
      purchaseBillUrl: l.purchase_bill_url || l.purchaseBillUrl || `/uploads/bills/${rawBatch}_Bill.pdf`,
      billStoragePath: l.bill_storage_path || l.billStoragePath || `${l.hospital_id || l.hospitalId}/${l.id}/${rawBatch}_Bill.pdf`,
      supplier: l.supplier || 'Hospital Direct Procurement',
      notes: l.notes || '',
      canonicalCompositionKey: canonicalKey,
      createdAt: l.created_at || l.createdAt,
      updatedAt: l.updated_at || l.updatedAt,
    };
  }
};

inventoryService.devInventory = devInventory;
module.exports = inventoryService;
