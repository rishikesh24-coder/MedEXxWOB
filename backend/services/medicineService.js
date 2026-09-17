const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const auditService = require('./auditService');
const {
  computeCanonicalCompositionKey,
  normalizeDosageForm,
  normalizeRoute,
  getDaysUntilExpiry,
} = require('../utils/inventoryUtils');
const logger = require('../utils/logger');

// Initial in-memory Master Formulary Seed Data (Sync with backend/seed.sql)
const devMasterMedicines = [
  {
    id: 'a0000001-0000-0000-0000-000000000001',
    code: 'MED-AMOX-625',
    name: 'Augmentin 625 Duo',
    brandName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin + Clavulanic Acid',
    composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    brand: 'Augmentin',
    strength: '625mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Antibiotics & Anti-Infectives',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd.',
    packaging: '10 Tablets / Strip',
    packing: '10 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 10,
    shelfLifeMonths: 24,
    canonicalCompositionKey: 'amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral',
    canonical_composition_key: 'amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000002-0000-0000-0000-000000000002',
    code: 'MED-AMOX-375',
    name: 'Augmentin 375mg',
    brandName: 'Augmentin 375mg',
    genericName: 'Amoxicillin + Clavulanic Acid',
    composition: 'Amoxicillin 250mg + Clavulanic Acid 125mg',
    brand: 'Augmentin',
    strength: '375mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Antibiotics & Anti-Infectives',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd.',
    packaging: '10 Tablets / Strip',
    packing: '10 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 10,
    shelfLifeMonths: 24,
    canonicalCompositionKey: 'amoxicillin:250:mg+clavulanic acid:125:mg|Tablet|Oral',
    canonical_composition_key: 'amoxicillin:250:mg+clavulanic acid:125:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000003-0000-0000-0000-000000000003',
    code: 'MED-CLAVAM-625',
    name: 'Clavam 625',
    brandName: 'Clavam 625',
    genericName: 'Amoxicillin + Clavulanic Acid',
    composition: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    brand: 'Clavam',
    strength: '625mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Antibiotics & Anti-Infectives',
    manufacturer: 'Alkem Laboratories Ltd.',
    packaging: '10 Tablets / Strip',
    packing: '10 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 10,
    shelfLifeMonths: 24,
    canonicalCompositionKey: 'amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral',
    canonical_composition_key: 'amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000004-0000-0000-0000-000000000004',
    code: 'MED-PARA-500',
    name: 'Dolo 500',
    brandName: 'Dolo 500',
    genericName: 'Paracetamol',
    composition: 'Paracetamol 500mg',
    brand: 'Dolo',
    strength: '500mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Analgesics & Antipyretics',
    manufacturer: 'Micro Labs Ltd.',
    packaging: '15 Tablets / Strip',
    packing: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    shelfLifeMonths: 36,
    canonicalCompositionKey: 'paracetamol:500:mg|Tablet|Oral',
    canonical_composition_key: 'paracetamol:500:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000005-0000-0000-0000-000000000005',
    code: 'MED-PARA-650',
    name: 'Dolo 650',
    brandName: 'Dolo 650',
    genericName: 'Paracetamol',
    composition: 'Paracetamol 650mg',
    brand: 'Dolo',
    strength: '650mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Analgesics & Antipyretics',
    manufacturer: 'Micro Labs Ltd.',
    packaging: '15 Tablets / Strip',
    packing: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    shelfLifeMonths: 36,
    canonicalCompositionKey: 'paracetamol:650:mg|Tablet|Oral',
    canonical_composition_key: 'paracetamol:650:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000006-0000-0000-0000-000000000006',
    code: 'MED-MERO-1000',
    name: 'Meronem 1g IV',
    brandName: 'Meronem 1g IV',
    genericName: 'Meropenem',
    composition: 'Meropenem Trihydrate 1000mg',
    brand: 'Meronem',
    strength: '1g',
    dosageForm: 'Injection',
    form: 'Injection',
    route: 'Intravenous',
    category: 'Critical Care & Antibiotics',
    manufacturer: 'Pfizer India Ltd.',
    packaging: '1 Vial with Diluent',
    packing: '1 Vial with Diluent',
    unit: 'Vial',
    unitsPerPack: 1,
    shelfLifeMonths: 24,
    canonicalCompositionKey: 'meropenem:1000:mg|Injection|Intravenous',
    canonical_composition_key: 'meropenem:1000:mg|Injection|Intravenous',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000007-0000-0000-0000-000000000007',
    code: 'MED-PANTO-40',
    name: 'Pan 40',
    brandName: 'Pan 40',
    genericName: 'Pantoprazole',
    composition: 'Pantoprazole Sodium 40mg',
    brand: 'Pan',
    strength: '40mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Gastrointestinal',
    manufacturer: 'Alkem Laboratories Ltd.',
    packaging: '15 Tablets / Strip',
    packing: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    shelfLifeMonths: 24,
    canonicalCompositionKey: 'pantoprazole:40:mg|Tablet|Oral',
    canonical_composition_key: 'pantoprazole:40:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'a0000008-0000-0000-0000-000000000008',
    code: 'MED-ATORV-20',
    name: 'Atorva 20',
    brandName: 'Atorva 20',
    genericName: 'Atorvastatin',
    composition: 'Atorvastatin Calcium 20mg',
    brand: 'Atorva',
    strength: '20mg',
    dosageForm: 'Tablet',
    form: 'Tablet',
    route: 'Oral',
    category: 'Cardiovascular',
    manufacturer: 'Zydus Healthcare',
    packaging: '15 Tablets / Strip',
    packing: '15 Tablets / Strip',
    unit: 'Tablet',
    unitsPerPack: 15,
    shelfLifeMonths: 36,
    canonicalCompositionKey: 'atorvastatin:20:mg|Tablet|Oral',
    canonical_composition_key: 'atorvastatin:20:mg|Tablet|Oral',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
];

const medicineService = {
  getDevMasterMedicines() {
    return devMasterMedicines;
  },

  /**
   * Lists medicine master items with search, category/form filters, and pagination
   */
  async listMedicines({ search = '', category = 'all', dosageForm = 'all', page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let items = [];
    let total = 0;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        let query = client.from('medicines').select('*', { count: 'exact' });

        if (category && category !== 'all') {
          query = query.ilike('category', `%${category}%`);
        }
        if (dosageForm && dosageForm !== 'all') {
          query = query.ilike('dosage_form', `%${dosageForm}%`);
        }
        if (search) {
          const q = search.trim();
          query = query.or(
            `name.ilike.%${q}%,brand_name.ilike.%${q}%,generic_name.ilike.%${q}%,composition.ilike.%${q}%,strength.ilike.%${q}%,code.ilike.%${q}%`
          );
        }

        const { data, count, error } = await query
          .order('name')
          .range(offset, offset + limitNum - 1);

        if (!error && data && data.length > 0) {
          items = data.map(this.normalizeMedicineRecord);
          total = count || items.length;
          return { items, total, page: pageNum, limit: limitNum };
        }
      } catch (err) {
        logger.warn('Supabase query in listMedicines failed, falling back to local master catalogue:', err.message);
      }
    }

    // Fallback in-memory list
    let filtered = [...devMasterMedicines];

    if (category && category !== 'all') {
      filtered = filtered.filter(
        (m) => (m.category || '').toLowerCase().includes(category.toLowerCase())
      );
    }
    if (dosageForm && dosageForm !== 'all') {
      filtered = filtered.filter(
        (m) => (m.dosageForm || m.form || '').toLowerCase().includes(dosageForm.toLowerCase())
      );
    }
    if (search) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.brandName || '').toLowerCase().includes(q) ||
          (m.genericName || '').toLowerCase().includes(q) ||
          (m.composition || '').toLowerCase().includes(q) ||
          (m.strength || '').toLowerCase().includes(q) ||
          (m.code || '').toLowerCase().includes(q)
      );
    }

    total = filtered.length;
    items = filtered.slice(offset, offset + limitNum).map(this.normalizeMedicineRecord);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
    };
  },

  /**
   * Retrieves single medicine by ID or unique code
   */
  async getMedicineById(id) {
    if (!id) {
      const err = new Error('Medicine ID or code is required.');
      err.statusCode = 400;
      throw err;
    }

    let medicine = null;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('medicines')
          .select('*')
          .or(`id.eq.${id},code.eq.${id}`)
          .limit(1)
          .single();

        if (!error && data) {
          medicine = this.normalizeMedicineRecord(data);
        }
      } catch (err) {
        // Fall through to memory check
      }
    }

    if (!medicine) {
      const match = devMasterMedicines.find(
        (m) => m.id === id || m.code === id || (m.code && m.code.toLowerCase() === id.toLowerCase())
      );
      if (match) medicine = this.normalizeMedicineRecord(match);
    }

    if (!medicine) {
      const err = new Error(`Medicine record '${id}' not found in master catalogue.`);
      err.statusCode = 404;
      throw err;
    }

    return medicine;
  },

  /**
   * Registers a new medicine in the master catalogue
   */
  async createMedicine(data, reqUser = { role: 'admin', name: 'Master Formulary Admin' }) {
    // 1. Mandatory validation
    const name = (data.name || data.brandName || '').trim();
    const genericName = (data.genericName || '').trim();
    const composition = (data.composition || data.genericName || name).trim();
    const strength = (data.strength || data.dosage || data.power || '').trim();
    const rawForm = data.dosageForm || data.form || 'Tablet';
    const rawRoute = data.route || 'Oral';
    const category = (data.category || 'General Therapeutics').trim();
    const manufacturer = (data.manufacturer || 'Authorized Manufacturer').trim();

    if (!name) {
      const err = new Error('Validation Error: Medicine brand name is mandatory.');
      err.statusCode = 422;
      throw err;
    }
    if (!genericName) {
      const err = new Error('Validation Error: Active generic molecule name is mandatory.');
      err.statusCode = 422;
      throw err;
    }
    if (!strength) {
      const err = new Error('Validation Error: Formulation strength / dosage is mandatory.');
      err.statusCode = 422;
      throw err;
    }

    const dosageForm = normalizeDosageForm(rawForm);
    const route = normalizeRoute(rawRoute, dosageForm);

    // 2. Canonical Composition Key calculation
    const canonicalKey = computeCanonicalCompositionKey({
      genericName,
      strength,
      dosageForm,
      route,
      composition,
      activeIngredients: data.activeIngredients,
    });

    // 3. Unique formulation constraint check
    const existingDev = devMasterMedicines.find(
      (m) =>
        m.genericName.toLowerCase() === genericName.toLowerCase() &&
        m.strength.toLowerCase() === strength.toLowerCase() &&
        (m.dosageForm || m.form || '').toLowerCase() === dosageForm.toLowerCase() &&
        (m.route || 'Oral').toLowerCase() === route.toLowerCase()
    );

    if (existingDev) {
      const err = new Error(
        `Formulation Conflict: A medicine with generic '${genericName}' (${strength} ${dosageForm} ${route}) is already registered (${existingDev.name} - ${existingDev.code}).`
      );
      err.statusCode = 409;
      err.code = 'DUPLICATE_FORMULATION';
      throw err;
    }

    const medicineId = data.id || uuidv4();
    let code = data.code;
    if (!code) {
      const cleanPrefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'MED';
      const cleanNum = strength.replace(/[^0-9]/g, '') || '100';
      code = `MED-${cleanPrefix}-${cleanNum}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const newRecord = {
      id: medicineId,
      code,
      name,
      brandName: name,
      brand: data.brand || name,
      genericName,
      composition,
      strength,
      dosageForm,
      form: dosageForm,
      route,
      category,
      manufacturer,
      packaging: data.packaging || data.packing || '10 Tablets / Strip',
      packing: data.packing || data.packaging || '10 Tablets / Strip',
      unit: data.unit || 'Tablet',
      unitsPerPack: Number(data.unitsPerPack || 10),
      shelfLifeMonths: Number(data.shelfLifeMonths || 24),
      storageCondition: data.storageCondition || 'Room Temperature (15°C - 25°C)',
      imageUrl: data.imageUrl || data.image || null,
      description: data.description || 'Master clinical catalogue medicine formulation.',
      canonicalCompositionKey: canonicalKey,
      canonical_composition_key: canonicalKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isConfigured && supabaseAdmin) {
      try {
        const { error: insertErr } = await supabaseAdmin.from('medicines').insert([{
          id: newRecord.id,
          code: newRecord.code,
          name: newRecord.name,
          brand_name: newRecord.brandName,
          generic_name: newRecord.genericName,
          composition: newRecord.composition,
          brand: newRecord.brand,
          strength: newRecord.strength,
          dosage_form: newRecord.dosageForm,
          route: newRecord.route,
          category: newRecord.category,
          manufacturer: newRecord.manufacturer,
          packaging: newRecord.packaging,
          packing: newRecord.packing,
          unit: newRecord.unit,
          units_per_pack: newRecord.unitsPerPack,
          shelf_life_months: newRecord.shelfLifeMonths,
          storage_condition: newRecord.storageCondition,
          image_url: newRecord.imageUrl,
          description: newRecord.description,
          canonical_composition_key: newRecord.canonicalCompositionKey,
        }]);

        if (insertErr) {
          logger.warn('Supabase insert warning for medicine master:', insertErr.message);
        }
      } catch (dbEx) {
        logger.warn('Supabase exception in createMedicine:', dbEx.message);
      }
    }

    devMasterMedicines.unshift(newRecord);

    await auditService.logEvent({
      action: 'MEDICINE_CREATED',
      entityType: 'MEDICINE',
      entityId: newRecord.id,
      actorRole: reqUser?.role || 'admin',
      summary: `Registered new medicine formulation "${newRecord.name}" (${newRecord.code}) with canonical key ${canonicalKey}.`,
      resultingStatus: 'active',
      metadata: { code: newRecord.code, canonicalCompositionKey: canonicalKey },
    });

    return this.normalizeMedicineRecord(newRecord);
  },

  /**
   * Updates an existing medicine master catalogue record
   */
  async updateMedicine(id, updateData, reqUser = { role: 'admin', name: 'Master Formulary Admin' }) {
    const existing = await this.getMedicineById(id);

    const updated = {
      ...existing,
      ...updateData,
      name: updateData.name || updateData.brandName || existing.name,
      brandName: updateData.brandName || updateData.name || existing.brandName,
      genericName: updateData.genericName || existing.genericName,
      strength: updateData.strength || existing.strength,
      dosageForm: updateData.dosageForm ? normalizeDosageForm(updateData.dosageForm) : existing.dosageForm,
      route: updateData.route ? normalizeRoute(updateData.route) : existing.route,
      storageCondition: updateData.storageCondition || updateData.storageType || existing.storageCondition,
      storageType: updateData.storageType || updateData.storageCondition || existing.storageType,
      status: updateData.status || existing.status || 'active',
      updatedAt: new Date().toISOString(),
    };

    // Recompute canonical composition key if clinical parameters changed
    updated.canonicalCompositionKey = computeCanonicalCompositionKey(updated);
    updated.canonical_composition_key = updated.canonicalCompositionKey;

    const idx = devMasterMedicines.findIndex((m) => m.id === id || m.code === id);
    if (idx !== -1) {
      devMasterMedicines[idx] = updated;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('medicines').update({
          name: updated.name,
          brand_name: updated.brandName,
          generic_name: updated.genericName,
          composition: updated.composition,
          strength: updated.strength,
          dosage_form: updated.dosageForm,
          route: updated.route,
          category: updated.category,
          manufacturer: updated.manufacturer,
          packaging: updated.packaging,
          packing: updated.packing,
          canonical_composition_key: updated.canonicalCompositionKey,
          updated_at: updated.updatedAt,
        }).eq('id', existing.id);
      } catch (dbEx) {
        logger.warn('Supabase exception in updateMedicine:', dbEx.message);
      }
    }

    await auditService.logEvent({
      action: 'MEDICINE_UPDATED',
      entityType: 'MEDICINE',
      entityId: existing.id,
      actorRole: reqUser?.role || 'admin',
      summary: `Updated master formulary formulation for "${updated.name}" (${updated.code}).`,
      resultingStatus: 'active',
      metadata: { code: updated.code, canonicalCompositionKey: updated.canonicalCompositionKey },
    });

    return this.normalizeMedicineRecord(updated);
  },

  /**
   * Deactivates a master medicine catalogue record
   */
  async deleteMedicine(id, reqUser = { role: 'admin', name: 'Master Formulary Admin' }) {
    const existing = await this.getMedicineById(id);
    const updated = {
      ...existing,
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    };

    const idx = devMasterMedicines.findIndex((m) => m.id === id || m.code === id);
    if (idx !== -1) {
      devMasterMedicines[idx] = updated;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('medicines').update({ is_active: false }).eq('id', existing.id);
      } catch (err) {
        // Fall through
      }
    }

    await auditService.logEvent({
      action: 'MEDICINE_DEACTIVATED',
      entityType: 'MEDICINE',
      entityId: existing.id,
      actorRole: reqUser?.role || 'admin',
      summary: `Deactivated master medicine formulation "${existing.name}" (${existing.code}).`,
      resultingStatus: 'inactive',
    });

    return this.normalizeMedicineRecord(updated);
  },

  /**
   * Clinical-grade exact composition alternative matching
   * Strict criteria:
   * 1. Active ingredient / composition match
   * 2. Strength match
   * 3. Dosage form match
   * 4. Route match
   * Never treats different strength or different formulation as exact alternatives.
   */
  async getAlternatives(medicineId, { currentHospitalId = null } = {}) {
    const targetMedicine = await this.getMedicineById(medicineId);
    const targetKey = targetMedicine.canonicalCompositionKey || targetMedicine.canonical_composition_key;

    if (!targetKey) {
      return {
        targetMedicine,
        targetKey: '',
        alternatives: [],
        count: 0,
        explanation: 'No valid canonical formulation key available for target medicine.',
      };
    }

    // 1. Query candidate medicines with the exact same canonical key from master catalogue
    const equivalentMasterMedicines = devMasterMedicines.filter(
      (m) =>
        m.id !== targetMedicine.id &&
        (m.canonicalCompositionKey === targetKey || m.canonical_composition_key === targetKey)
    );

    // 2. Query available stock from inventory lots that share this exact canonical key
    const inventoryService = require('./inventoryService');
    const allLots = await inventoryService.getMarketplaceInventory({ currentHospitalId });

    const matches = [];

    allLots.forEach((lot) => {
      // Exclude caller hospital's own inventory
      if (currentHospitalId && (lot.hospital_id === currentHospitalId || lot.hospitalId === currentHospitalId)) {
        return;
      }

      // Compute lot canonical key
      const lotKey = computeCanonicalCompositionKey(lot);

      if (lotKey === targetKey) {
        const lotPrice = Number(lot.concession_rate || lot.unit_price || lot.unitPrice || 100);
        const targetPrice = Number(targetMedicine.unitPrice || targetMedicine.mrp || 120);
        const priceDiff = Math.round((targetPrice - lotPrice) * 100) / 100;
        const savingsPercent = targetPrice > 0 ? Math.max(0, Math.round((priceDiff / targetPrice) * 100)) : 0;
        const daysLeft = getDaysUntilExpiry(lot.expiry_date || lot.expiryDate);

        matches.push({
          lotId: lot.id,
          medicineId: lot.medicine_id || lot.medicineId,
          medicineName: lot.medicine_name || lot.medicineName || lot.brandName,
          genericName: lot.generic_name || lot.genericName,
          strength: lot.strength || targetMedicine.strength,
          dosageForm: lot.dosage_form || lot.dosageForm || targetMedicine.dosageForm,
          route: targetMedicine.route,
          batchNo: lot.batch_number || lot.batch_no || lot.batchNo,
          availableQuantity: Number(lot.available_quantity !== undefined ? lot.available_quantity : (lot.availableQuantity || lot.quantity || 0)),
          unitPrice: lotPrice,
          originalPrice: targetPrice,
          savingsPercent,
          priceDifference: priceDiff,
          shelfLifeDays: daysLeft,
          isCheaper: priceDiff > 0,
          hospitalId: lot.hospital_id || lot.hospitalId,
          hospitalName: lot.hospital_name || lot.hospitalName || lot.hospitals?.name || 'Verified Hospital Partner',
          hospitalCity: lot.hospitals?.city || lot.hospitalCity || 'Metro Pharmacy',
          expiryDate: lot.expiry_date || lot.expiryDate,
          daysUntilExpiry: daysLeft,
          matchType: 'EXACT_CLINICAL_FORMULATION',
          reasons: [
            `Exact active ingredient match: ${targetMedicine.genericName}`,
            `Identical strength: ${targetMedicine.strength}`,
            `Same dosage form: ${targetMedicine.dosageForm}`,
            `Same administration route: ${targetMedicine.route}`,
            `Verified partner hospital stock available for inter-hospital transfer`,
          ],
        });
      }
    });

    // 3. Always include other brands registered in master catalogue that share exact canonical key
    equivalentMasterMedicines.forEach((alt) => {
      const alreadyInMatches = matches.some(
        (m) => m.medicineId === alt.id || m.medicineName.toLowerCase() === alt.name.toLowerCase()
      );
      if (!alreadyInMatches) {
        const targetPrice = Number(targetMedicine.unitPrice || targetMedicine.mrp || 120);
        matches.push({
          lotId: null,
          medicineId: alt.id,
          medicineName: alt.name,
          genericName: alt.genericName,
          strength: alt.strength,
          dosageForm: alt.dosageForm,
          route: alt.route,
          manufacturer: alt.manufacturer,
          batchNo: null,
          availableQuantity: 0,
          unitPrice: targetPrice,
          originalPrice: targetPrice,
          priceDifference: 0,
          savingsPercent: 0,
          shelfLifeDays: (alt.shelfLifeMonths || 24) * 30,
          isCheaper: false,
          matchType: 'EXACT_CATALOGUE_ALTERNATIVE',
          reasons: [
            `Same active ingredient: ${alt.genericName}`,
            `Same strength: ${alt.strength}`,
            `Same dosage form: ${alt.dosageForm}`,
            `Same route: ${alt.route}`,
            `Formulary equivalent manufactured by ${alt.manufacturer}`,
          ],
        });
      }
    });

    // Sort: cheaper first, then higher available stock
    matches.sort((a, b) => {
      if (b.isCheaper !== a.isCheaper) return (b.isCheaper ? 1 : 0) - (a.isCheaper ? 1 : 0);
      if (b.savingsPercent !== a.savingsPercent) return b.savingsPercent - a.savingsPercent;
      return b.availableQuantity - a.availableQuantity;
    });

    return {
      targetMedicine,
      canonicalCompositionKey: targetKey,
      alternatives: matches,
      count: matches.length,
    };
  },

  normalizeMedicineRecord(m) {
    const key = m.canonical_composition_key || m.canonicalCompositionKey;
    const storage = m.storage_condition || m.storageCondition || m.storageType || 'Room Temperature (15°C - 25°C)';
    return {
      id: m.id,
      code: m.code,
      medicineCode: m.code,
      name: m.name || m.brand_name || m.brandName,
      brandName: m.brand_name || m.brandName || m.name,
      genericName: m.generic_name || m.genericName,
      composition: m.composition || m.generic_name || m.genericName,
      brand: m.brand || m.brand_name || m.name,
      strength: m.strength,
      dosageForm: m.dosage_form || m.dosageForm || 'Tablet',
      form: m.dosage_form || m.dosageForm || 'Tablet',
      route: m.route || 'Oral',
      category: m.category,
      manufacturer: m.manufacturer,
      packaging: m.packaging || m.packing || '10 Tablets / Strip',
      packing: m.packing || m.packaging || '10 Tablets / Strip',
      unit: m.unit || 'Tablet',
      unitsPerPack: m.units_per_pack || m.unitsPerPack || 10,
      shelfLifeMonths: m.shelf_life_months || m.shelfLifeMonths || 24,
      storageCondition: storage,
      storageType: storage,
      imageUrl: m.image_url || m.imageUrl || null,
      description: m.description || '',
      canonicalCompositionKey: key,
      canonical_composition_key: key,
      status: m.status || 'active',
      createdAt: m.created_at || m.createdAt,
      updatedAt: m.updated_at || m.updatedAt,
    };
  },
};

module.exports = medicineService;
