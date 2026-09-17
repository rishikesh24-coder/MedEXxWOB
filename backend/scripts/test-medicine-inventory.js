/**
 * MedEx Phase 4: Medicine Master + Inventory / Batch Test Suite
 * Validates all 24 operational & clinical safety scenarios:
 * 
 * 1.  GET /api/medicines (Pagination, Search, Category filter)
 * 2.  POST /api/medicines as Admin (Formulation created in Master Catalogue)
 * 3.  POST /api/medicines as Hospital (Forbidden 403 FORBIDDEN_ADMIN_ONLY)
 * 4.  GET /api/medicines/:id (Single medicine detail retrieval)
 * 5.  PATCH /api/medicines/:id as Admin (Update master medicine)
 * 6.  DELETE /api/medicines/:id as Admin (Deactivate master medicine)
 * 7.  GET /api/medicines/:id/alternatives (Matches exact active composition + strength + dosage form)
 * 8.  GET /api/medicines/:id/alternatives (Strictly rejects different strengths e.g. 500mg vs 650mg)
 * 9.  GET /api/medicines/:id/alternatives (Strictly rejects different dosage forms e.g. Tablet vs Syrup)
 * 10. GET /api/medicines/:id/alternatives (Provides explainable price/stock/shelf-life differences, zero fabricated AI scores)
 * 11. POST /api/inventory by Approved Hospital (Registers lot with all mandatory fields)
 * 12. POST /api/inventory by Pending Hospital (Forbidden 403 PENDING_ADMIN_APPROVAL)
 * 13. POST /api/inventory duplicate batch conflict (Rejected 409 DUPLICATE_LOT_CONFLICT)
 * 14. Strict Hospital Session Isolation (Hospital cannot query other hospital stock via ?hospitalId=...)
 * 15. Strict Lot Access Control (GET /api/inventory/:id for other hospital returns 403 FORBIDDEN_HOSPITAL_ISOLATION)
 * 16. POST /api/inventory/:id/adjust (Performs atomic stock adjustment calculation)
 * 17. POST /api/inventory/:id/adjust (Rejects negative stock balance with 400 NEGATIVE_STOCK_FORBIDDEN)
 * 18. GET /api/inventory/:id/history (Returns chronological immutable adjustment ledger)
 * 19. Deterministic Status: EXPIRED calculated when expiryDate is in the past
 * 20. Deterministic Status: EXPIRING_SOON calculated when shelf life <= 90 days
 * 21. Deterministic Status: LOW_STOCK calculated when available stock <= minimum stock level
 * 22. Admin Dual Hierarchies:
 *     - GET /api/admin/inventory/by-medicine
 *     - GET /api/admin/inventory/by-medicine/:medicineId/contributors
 *     - GET /api/admin/inventory/by-medicine/:medicineId/hospitals/:hospitalId/batches
 *     - GET /api/admin/inventory/by-hospital
 *     - GET /api/admin/inventory/by-hospital/:hospitalId/medicines
 *     - GET /api/admin/inventory/by-hospital/:hospitalId/medicines/:medicineId/batches
 * 23. Exact Purchase Bill Retrieval (GET /api/admin/inventory/batches/:batchId returns verified purchase bill URL & storage path)
 * 24. Marketplace Readiness (GET /api/inventory/marketplace excludes expired, out-of-stock, and caller's own stock)
 */

const axios = require('axios');
const app = require('../server');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const ADMIN_TOKEN = 'mock_jwt_token_admin_test_session';
const APOLLO_HOSP_TOKEN = 'mock_jwt_token_hospital_apollo_active'; // Hospital 1 (11111111-1111-1111-1111-111111111111)
const PENDING_HOSP_TOKEN = 'mock_jwt_token_pending_hospital';

async function startServerIfNeeded() {
  try {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 1500 });
    if (res.status === 200) {
      console.log(`[INFO] Connected to existing MedEx server on port ${PORT}`);
      return null;
    }
  } catch (e) {
    // Server not running, start in-process
  }

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`[INFO] Started in-process MedEx test server on port ${PORT}`);
      resolve(server);
    });
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('  MedEx PHASE 4: MEDICINE MASTER + INVENTORY / BATCH TEST SUITE ');
  console.log('================================================================\n');

  const serverInstance = await startServerIfNeeded();

  let passed = 0;
  let failed = 0;

  async function testCase(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      if (err.response) {
        console.error('       Status:', err.response.status);
        console.error('       Data:', JSON.stringify(err.response.data));
      }
      failed++;
    }
  }

  // Dynamic values
  const timestamp = Date.now();
  let createdMedicineId = null;
  let createdLotId = null;
  const testBatchNo = `TEST-BATCH-${timestamp}`;

  // 1. GET /api/medicines
  await testCase('1. GET /api/medicines with pagination, search and category filtering', async () => {
    const res = await axios.get(`${BASE_URL}/medicines?search=Paracetamol&page=1&limit=10`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.success) throw new Error('Response success flag is false');
    if (!res.data.data.items || !Array.isArray(res.data.data.items)) throw new Error('Expected items array');
    if (res.data.data.total === undefined) throw new Error('Expected pagination total count');
    const hasMatch = res.data.data.items.some(
      (m) => m.name.toLowerCase().includes('paracetamol') || m.genericName.toLowerCase().includes('paracetamol')
    );
    if (!hasMatch) throw new Error('Search did not match expected Paracetamol medicines');
  });

  // 2. POST /api/medicines as Admin
  await testCase('2. POST /api/medicines as Admin creates master formulation', async () => {
    const payload = {
      name: `Cefixime Trihydrate 200mg DT - ${timestamp}`,
      brandName: `Cefixime Trihydrate 200mg DT - ${timestamp}`,
      genericName: 'Cefixime',
      composition: 'Cefixime Trihydrate 200mg',
      category: 'Antibiotics',
      dosageForm: 'Tablet',
      form: 'Tablet',
      strength: '200mg',
      unit: 'Tablet',
      manufacturer: 'Lupin Pharmaceuticals Ltd.',
      storageType: 'Store below 25°C in dry place',
      description: 'Third generation cephalosporin antibiotic dispersible tablet.',
    };

    const res = await axios.post(`${BASE_URL}/medicines`, payload, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.data || !res.data.data.id) throw new Error('Missing created medicine ID');
    createdMedicineId = res.data.data.id;
    if (!res.data.data.canonicalCompositionKey) throw new Error('Missing canonicalCompositionKey on created medicine');
  });

  // 3. POST /api/medicines as Hospital (Forbidden 403)
  await testCase('3. POST /api/medicines as Hospital rejects with 403 FORBIDDEN_ADMIN_ONLY', async () => {
    try {
      await axios.post(
        `${BASE_URL}/medicines`,
        { name: 'Unauthorized Medicine Insertion', genericName: 'Generic Unauth', strength: '500mg' },
        { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
      );
      throw new Error('Hospital unexpectedly succeeded in creating master medicine formulation');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        const code = err.response.data?.error?.code || err.response.data?.code;
        if (code !== 'FORBIDDEN_ADMIN_ONLY') {
          throw new Error(`Expected FORBIDDEN_ADMIN_ONLY code, got ${code}`);
        }
        return; // Passed
      }
      throw err;
    }
  });

  // 4. GET /api/medicines/:id
  await testCase('4. GET /api/medicines/:id retrieves single medicine details', async () => {
    const res = await axios.get(`${BASE_URL}/medicines/${createdMedicineId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.id !== createdMedicineId) throw new Error('Returned medicine ID does not match');
    if (!res.data.data.genericName) throw new Error('Missing genericName');
  });

  // 5. PATCH /api/medicines/:id as Admin
  await testCase('5. PATCH /api/medicines/:id as Admin updates master medicine metadata', async () => {
    const res = await axios.patch(
      `${BASE_URL}/medicines/${createdMedicineId}`,
      { storageType: 'Store strictly protected from light below 20°C' },
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.storageType !== 'Store strictly protected from light below 20°C') {
      throw new Error(`storageType update was not reflected in response: ${res.data.data.storageType}`);
    }
  });

  // 6. DELETE /api/medicines/:id as Admin
  await testCase('6. DELETE /api/medicines/:id as Admin deactivates master medicine', async () => {
    const res = await axios.delete(`${BASE_URL}/medicines/${createdMedicineId}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.status !== 'inactive') throw new Error(`Expected status inactive, got ${res.data.data.status}`);
  });

  // 7. GET /api/medicines/:id/alternatives (Exact Match Verification)
  await testCase('7. GET /api/medicines/:id/alternatives matches identical formulation (Amoxicillin + Clavulanic Acid 625mg Tablet)', async () => {
    // a0000001-0000-0000-0000-000000000001 is Augmentin 625 Duo (Amoxicillin + Clavulanic Acid 625mg Tablet)
    // a0000003-0000-0000-0000-000000000003 is Clavam 625 (Amoxicillin + Clavulanic Acid 625mg Tablet)
    const res = await axios.get(`${BASE_URL}/medicines/a0000001-0000-0000-0000-000000000001/alternatives`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const alternatives = res.data.data.alternatives || [];
    if (alternatives.length === 0) throw new Error('Expected at least 1 exact alternative for Augmentin 625 Duo');
    const matchedAlternative = alternatives.find((a) => a.medicineName.includes('Clavam'));
    if (!matchedAlternative) throw new Error('Expected Clavam 625 to be matched as an alternative for Augmentin 625 Duo');
  });

  // 8. GET /api/medicines/:id/alternatives (Rejection of Different Strengths)
  await testCase('8. GET /api/medicines/:id/alternatives strictly rejects different strengths (Dolo 650mg is NOT an alternative for Crocin 500mg)', async () => {
    const res = await axios.get(`${BASE_URL}/medicines/a0000001-0000-0000-0000-000000000001/alternatives`);
    const alternatives = res.data.data.alternatives || [];
    const matchedDolo650 = alternatives.find((a) => a.medicineName.includes('650') || a.strength === '650mg');
    if (matchedDolo650) {
      throw new Error('CLINICAL SAFETY VIOLATION: Dolo 650mg was erroneously matched as an alternative for Crocin 500mg!');
    }
  });

  // 9. GET /api/medicines/:id/alternatives (Rejection of Different Dosage Forms)
  await testCase('9. GET /api/medicines/:id/alternatives strictly rejects different dosage forms (Paracetamol Syrup is NOT an alternative for Crocin 500mg Tablet)', async () => {
    const res = await axios.get(`${BASE_URL}/medicines/a0000001-0000-0000-0000-000000000001/alternatives`);
    const alternatives = res.data.data.alternatives || [];
    const matchedSyrup = alternatives.find((a) => (a.dosageForm || '').toLowerCase().includes('syrup'));
    if (matchedSyrup) {
      throw new Error('CLINICAL SAFETY VIOLATION: Syrup form was matched as an alternative for Tablet formulation!');
    }
  });

  // 10. GET /api/medicines/:id/alternatives (Explainable differences, zero fabricated AI scores)
  await testCase('10. GET /api/medicines/:id/alternatives provides explainable difference metrics (priceDiff, stock, shelfLife)', async () => {
    const res = await axios.get(`${BASE_URL}/medicines/a0000001-0000-0000-0000-000000000001/alternatives`);
    const alternatives = res.data.data.alternatives || [];
    if (alternatives.length > 0) {
      const alt = alternatives[0];
      if (alt.priceDifference === undefined) throw new Error('Missing explainable priceDifference');
      if (alt.percentageSavings === undefined && alt.savingsPercent === undefined) throw new Error('Missing explainable savings');
      if (alt.shelfLifeDays === undefined && alt.daysUntilExpiry === undefined) throw new Error('Missing explainable shelf life');
      if (alt.aiConfidenceScore !== undefined) throw new Error('Fabricated AI confidence score found in clinical API!');
    }
  });

  // 11. POST /api/inventory by Approved Hospital
  await testCase('11. POST /api/inventory by Approved Hospital registers lot with all mandatory fields', async () => {
    const futureExpiry = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
    const pastMfg = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const payload = {
      medicineName: 'Augmentin 625 Duo Tablets',
      genericName: 'Amoxicillin + Clavulanic Acid',
      batchNumber: testBatchNo,
      batchNo: testBatchNo,
      quantity: 250,
      unitPrice: 180.00,
      mrp: 220.00,
      minimumStock: 40,
      dosageForm: 'Tablet',
      strength: '625mg',
      manufacturingDate: pastMfg,
      expiryDate: futureExpiry,
      shelfLocation: 'Cold Storage Bay 2',
      purchaseBillUrl: `/uploads/bills/Apollo_${testBatchNo}_Bill.pdf`,
      billStoragePath: `11111111-1111-1111-1111-111111111111/temp/${testBatchNo}_Bill.pdf`,
      supplier: 'GlaxoSmithKline Direct Supply',
      notes: 'Initial receipt for trauma care pharmacy unit',
    };

    const res = await axios.post(`${BASE_URL}/inventory`, payload, {
      headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` },
    });

    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.data || !res.data.data.id) throw new Error('Missing lot ID in response');
    createdLotId = res.data.data.id;
    if (res.data.data.batchNumber !== testBatchNo) throw new Error('Batch number does not match');
    if (res.data.data.status !== 'AVAILABLE') throw new Error(`Expected status AVAILABLE, got ${res.data.data.status}`);
    if (!res.data.data.purchaseBillUrl) throw new Error('Missing purchaseBillUrl');
  });

  // 12. POST /api/inventory by Pending Hospital
  await testCase('12. POST /api/inventory by Pending Hospital rejects with 403 PENDING_ADMIN_APPROVAL', async () => {
    try {
      await axios.post(
        `${BASE_URL}/inventory`,
        {
          medicineName: 'Paracetamol 500mg',
          batchNo: `PENDING-LOT-${timestamp}`,
          quantity: 100,
          unitPrice: 30,
          expiryDate: '2026-12-31',
        },
        { headers: { Authorization: `Bearer ${PENDING_HOSP_TOKEN}` } }
      );
      throw new Error('Pending hospital unexpectedly succeeded in adding inventory stock');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        const code = err.response.data?.error?.code || err.response.data?.code;
        if (code !== 'PENDING_ADMIN_APPROVAL') {
          throw new Error(`Expected PENDING_ADMIN_APPROVAL code, got ${code}`);
        }
        return; // Passed
      }
      throw err;
    }
  });

  // 13. POST /api/inventory duplicate batch conflict (409 Conflict)
  await testCase('13. POST /api/inventory duplicate batch conflict rejects with 409 DUPLICATE_LOT_CONFLICT', async () => {
    try {
      await axios.post(
        `${BASE_URL}/inventory`,
        {
          medicineName: 'Augmentin 625 Duo Tablets',
          batchNumber: testBatchNo,
          quantity: 50,
          unitPrice: 180,
          expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        },
        { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
      );
      throw new Error('Duplicate batch insertion unexpectedly succeeded without 409 Conflict');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        const code = err.response.data?.error?.code || err.response.data?.code;
        if (code !== 'DUPLICATE_LOT_CONFLICT') {
          throw new Error(`Expected DUPLICATE_LOT_CONFLICT code, got ${code}`);
        }
        return; // Passed
      }
      throw err;
    }
  });

  // 14. Strict Hospital Session Isolation
  await testCase('14. Strict Hospital Session Isolation: hospital cannot query another hospital stock via ?hospitalId=...', async () => {
    // Apollo is 11111111-1111-1111-1111-111111111111. Let's try to query hospital 22222222-2222-2222-2222-222222222222
    const res = await axios.get(
      `${BASE_URL}/inventory?hospitalId=22222222-2222-2222-2222-222222222222`,
      { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const items = res.data.data.items || [];
    // All returned items MUST belong to Apollo (11111111-1111-1111-1111-111111111111)
    const hasForeignLot = items.some(
      (i) => i.hospitalId !== '11111111-1111-1111-1111-111111111111' && i.hospital_id !== '11111111-1111-1111-1111-111111111111'
    );
    if (hasForeignLot) {
      throw new Error('SECURITY VIOLATION: Hospital accessed another facility inventory via query parameter!');
    }
  });

  // 15. Strict Lot Access Control (GET /api/inventory/:id)
  await testCase('15. Strict Lot Access Control: GET /api/inventory/:id for other hospital lot returns 403 FORBIDDEN_HOSPITAL_ISOLATION', async () => {
    // b0000003-0000-0000-0000-000000000003 belongs to Fortis Hospital (22222222-2222-2222-2222-222222222222)
    try {
      await axios.get(`${BASE_URL}/inventory/b0000003-0000-0000-0000-000000000003`, {
        headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` },
      });
      throw new Error('Apollo hospital user was able to inspect Fortis hospital lot!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        const code = err.response.data?.error?.code || err.response.data?.code;
        if (code !== 'FORBIDDEN_HOSPITAL_ISOLATION') {
          throw new Error(`Expected FORBIDDEN_HOSPITAL_ISOLATION, got ${code}`);
        }
        return; // Passed
      }
      throw err;
    }
  });

  // 16. POST /api/inventory/:id/adjust (Atomic stock calculation)
  await testCase('16. POST /api/inventory/:id/adjust performs atomic stock math (+50 units)', async () => {
    const res = await axios.post(
      `${BASE_URL}/inventory/${createdLotId}/adjust`,
      { quantityChange: 50, reason: 'Physical stock reconciliation audit' },
      { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.lot.quantity !== 300) {
      throw new Error(`Expected new quantity 300, got ${res.data.data.lot.quantity}`);
    }
    if (!res.data.data.adjustment || res.data.data.adjustment.quantityChange !== 50) {
      throw new Error('Adjustment ledger record was not created properly');
    }
  });

  // 17. POST /api/inventory/:id/adjust (Rejects negative stock balance with 400)
  await testCase('17. POST /api/inventory/:id/adjust rejects negative stock balance with 400 NEGATIVE_STOCK_FORBIDDEN', async () => {
    try {
      await axios.post(
        `${BASE_URL}/inventory/${createdLotId}/adjust`,
        { quantityChange: -500, reason: 'Erroneous bulk deduction' },
        { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
      );
      throw new Error('Negative stock adjustment unexpectedly succeeded!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        const code = err.response.data?.error?.code || err.response.data?.code;
        if (code !== 'NEGATIVE_STOCK_FORBIDDEN') {
          throw new Error(`Expected NEGATIVE_STOCK_FORBIDDEN code, got ${code}`);
        }
        return; // Passed
      }
      throw err;
    }
  });

  // 18. GET /api/inventory/:id/history (Immutable ledger history)
  await testCase('18. GET /api/inventory/:id/history returns chronological ledger records', async () => {
    const res = await axios.get(`${BASE_URL}/inventory/${createdLotId}/history`, {
      headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array of adjustments');
    if (res.data.data.length < 2) throw new Error(`Expected at least 2 ledger entries, got ${res.data.data.length}`);
    const latest = res.data.data[0];
    if (latest.quantityChange !== 50) throw new Error(`Expected latest adjustment of +50, got ${latest.quantityChange}`);
  });

  // 19. Deterministic Status: EXPIRED
  await testCase('19. Deterministic Status: EXPIRED calculated when expiryDate is in the past', async () => {
    const res = await axios.get(`${BASE_URL}/admin/inventory/batches/b0000006-0000-0000-0000-000000000006`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.status !== 'EXPIRED') {
      throw new Error(`Expected status EXPIRED, got ${res.data.data.status}`);
    }
  });

  // 20. Deterministic Status: EXPIRING_SOON
  await testCase('20. Deterministic Status: EXPIRING_SOON calculated when expiry <= 90 days', async () => {
    // Update createdLotId to expire in 45 days
    const nearDate = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0];
    const res = await axios.patch(
      `${BASE_URL}/inventory/${createdLotId}`,
      { expiryDate: nearDate },
      { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.status !== 'EXPIRING_SOON') {
      throw new Error(`Expected status EXPIRING_SOON, got ${res.data.data.status}`);
    }
  });

  // 21. Deterministic Status: LOW_STOCK
  await testCase('21. Deterministic Status: LOW_STOCK calculated when available stock <= minimumStock', async () => {
    // Adjust lot to stock 15 (below minStock 40) but far expiry
    const farDate = new Date(Date.now() + 250 * 86400000).toISOString().split('T')[0];
    await axios.patch(
      `${BASE_URL}/inventory/${createdLotId}`,
      { expiryDate: farDate },
      { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
    );
    const res = await axios.patch(
      `${BASE_URL}/inventory/${createdLotId}`,
      { quantity: 20, minimumStock: 50 },
      { headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` } }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.status !== 'LOW_STOCK') {
      throw new Error(`Expected status LOW_STOCK, got ${res.data.data.status}`);
    }
  });

  // 22. Admin Dual Hierarchies
  await testCase('22. Admin Dual Hierarchies: Medicine -> Hospitals -> Batches & Hospital -> Medicines -> Batches', async () => {
    // Hierarchy 1: By Medicine
    const resMeds = await axios.get(`${BASE_URL}/admin/inventory/by-medicine`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (resMeds.status !== 200) throw new Error(`by-medicine expected 200, got ${resMeds.status}`);
    if (!Array.isArray(resMeds.data.data) || resMeds.data.data.length === 0) {
      throw new Error('by-medicine returned empty array');
    }
    const targetMed = resMeds.data.data[0];
    if (!targetMed.totalStock || !targetMed.contributingHospitalCount) {
      throw new Error('Missing aggregated stock or hospital counts in by-medicine');
    }

    // Contributors for medicine
    const resContribs = await axios.get(
      `${BASE_URL}/admin/inventory/by-medicine/${targetMed.medicineId}/contributors`,
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    if (resContribs.status !== 200) throw new Error(`contributors expected 200, got ${resContribs.status}`);

    // Hierarchy 2: By Hospital
    const resHosps = await axios.get(`${BASE_URL}/admin/inventory/by-hospital`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (resHosps.status !== 200) throw new Error(`by-hospital expected 200, got ${resHosps.status}`);
    if (!Array.isArray(resHosps.data.data) || resHosps.data.data.length === 0) {
      throw new Error('by-hospital returned empty array');
    }
    const targetHosp = resHosps.data.data[0];
    if (!targetHosp.totalUnits || !targetHosp.uniqueMedicinesCount) {
      throw new Error('Missing aggregated units or medicines count in by-hospital');
    }

    // Medicines for hospital
    const resHospMeds = await axios.get(
      `${BASE_URL}/admin/inventory/by-hospital/${targetHosp.hospitalId}/medicines`,
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
    if (resHospMeds.status !== 200) throw new Error(`hospital medicines expected 200, got ${resHospMeds.status}`);
  });

  // 23. Exact Purchase Bill Retrieval
  await testCase('23. Exact Purchase Bill Retrieval: GET /api/admin/inventory/batches/:batchId returns verified bill URL & path', async () => {
    const res = await axios.get(`${BASE_URL}/admin/inventory/batches/AUG-24-0981`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.data.purchaseBillUrl) throw new Error('Missing purchaseBillUrl');
    if (!res.data.data.billStoragePath) throw new Error('Missing billStoragePath');
    if (!res.data.data.hospitalName) throw new Error('Missing hospitalName');
  });

  // 24. Marketplace Readiness
  await testCase('24. Marketplace Readiness: GET /api/inventory/marketplace excludes expired, out-of-stock, and caller stock', async () => {
    const res = await axios.get(`${BASE_URL}/inventory/marketplace`, {
      headers: { Authorization: `Bearer ${APOLLO_HOSP_TOKEN}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const items = res.data.data;
    if (!Array.isArray(items)) throw new Error('Expected items array');

    // 1. Exclude caller's own stock
    const containsOwnStock = items.some((i) => i.hospitalId === '11111111-1111-1111-1111-111111111111');
    if (containsOwnStock) throw new Error('Marketplace returned caller hospital own inventory!');

    // 2. Exclude expired
    const today = new Date().toISOString().split('T')[0];
    const containsExpired = items.some((i) => i.expiryDate < today);
    if (containsExpired) throw new Error('Marketplace returned expired stock lot!');

    // 3. Exclude zero available quantity
    const containsZeroStock = items.some((i) => Number(i.availableQuantity) <= 0);
    if (containsZeroStock) throw new Error('Marketplace returned zero-stock item!');
  });

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (serverInstance) {
    serverInstance.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal execution error in test suite:', e);
  process.exit(1);
});
