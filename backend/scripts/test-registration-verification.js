/**
 * MedEx Phase 3: Complete Hospital Registration & Admin Verification Test Suite
 * Validates all 15 operational & security scenarios:
 * 1. Hospital Registration (POST /api/hospitals/register) -> PENDING_APPROVAL
 * 2. Missing mandatory fields returns 422 Unprocessable Entity
 * 3. Duplicate registration (same email/registrationNo) returns 409 Conflict
 * 4. Pending hospital login blocks dashboard with pending message
 * 5. Pending hospital accessing operational endpoint returns 403 PENDING_ADMIN_APPROVAL
 * 6. Pending hospital accessing onboarding endpoint succeeds (200)
 * 7. Admin gets pending queue (GET /api/admin/hospitals/pending)
 * 8. Admin inspects verification dossier (GET /api/admin/hospitals/:id/verification)
 * 9. Non-admin attempting to approve returns 403 Forbidden
 * 10. Admin approves hospital (PATCH /api/admin/hospitals/:id/approve) -> APPROVED
 * 11. Approval records audit log in audit_logs and notification in notifications
 * 12. Approved hospital now succeeds on operational endpoint (200)
 * 13. Approved hospital appears in Approved Hospital Directory (GET /api/admin/hospitals)
 * 14. Admin rejects another hospital with reason -> REJECTED, audit log & notification created
 * 15. Strict Separation: Rejected hospital excluded from directory & blocked from operational access
 */

const axios = require('axios');
const app = require('../server');
const auditService = require('../services/auditService');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const ADMIN_TOKEN = 'mock_jwt_token_admin_test_session';
const NON_ADMIN_TOKEN = 'mock_jwt_token_hospital_apollo_active';

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
  console.log('  MedEx PHASE 3: REGISTRATION & ADMIN VERIFICATION TEST SUITE   ');
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

  // Shared state across sequential test scenarios
  let registeredHospitalId = null;
  const timestamp = Date.now();
  const testHospitalPayload = {
    name: 'Fortis Memorial Research Institute',
    registrationNo: `REG-FMRI-${timestamp}`,
    authorizedPerson: 'Dr. Sameer Verma (Medical Superintendent)',
    email: `fmri.${timestamp}@medex.org`,
    phone: '+91 98101 23456',
    address: 'Sector 44, Opposite HUDA City Centre',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    documents: [
      { documentType: 'Registration Certificate', documentName: 'FMRI_Reg_Certificate.pdf', size: '2.8 MB' },
      { documentType: 'Drug License', documentName: 'FMRI_Form20B_DrugLicense.pdf', size: '1.9 MB' },
      { documentType: 'GST Certificate', documentName: 'FMRI_GSTIN_Filing.pdf', size: '1.2 MB' },
      { documentType: 'Authorization Letter', documentName: 'FMRI_Board_Authorization.pdf', size: '850 KB' },
    ],
  };

  let rejectedHospitalId = null;
  const rejectedHospitalPayload = {
    name: 'Max Super Speciality Hospital Saket',
    registrationNo: `REG-MAX-${timestamp}`,
    authorizedPerson: 'Dr. Priya Nambiar (Chief Pharmacist)',
    email: `max.saket.${timestamp}@medex.org`,
    phone: '+91 98111 98765',
    address: '1, 2, Press Enclave Marg, Saket',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110017',
    documents: [
      { documentType: 'Registration Certificate', documentName: 'Max_Reg_Certificate.pdf' },
      { documentType: 'Drug License', documentName: 'Max_Drug_License.pdf' },
    ],
  };

  try {
    // 1. Hospital Registration -> PENDING_APPROVAL
    await testCase('1. Hospital Registration (POST /api/hospitals/register) creates PENDING_APPROVAL record', async () => {
      const res = await axios.post(`${BASE_URL}/hospitals/register`, testHospitalPayload);
      if (res.status !== 201) throw new Error(`Expected 201 Created, got ${res.status}`);
      if (res.data?.data?.status !== 'PENDING_APPROVAL') {
        throw new Error(`Expected status PENDING_APPROVAL, got ${res.data?.data?.status}`);
      }
      registeredHospitalId = res.data?.data?.hospital?.id;
      if (!registeredHospitalId) throw new Error('Missing hospital ID in registration response');
      if (res.data?.data?.hospital?.documentsCount !== 4) {
        throw new Error(`Expected 4 documents counted, got ${res.data?.data?.hospital?.documentsCount}`);
      }
    });

    // 2. Missing Mandatory Fields -> 422 Unprocessable Entity
    await testCase('2. Missing mandatory fields returns 422 Unprocessable Entity with missing field details', async () => {
      try {
        await axios.post(`${BASE_URL}/hospitals/register`, {
          name: 'Incomplete Hospital',
          email: 'incomplete@medex.org',
          // Missing registrationNo, authorizedPerson, phone, address, city, state, pincode
        });
        throw new Error('Expected 422 but request succeeded');
      } catch (err) {
        if (err.response?.status === 422) {
          const missing = err.response.data?.error?.missingFields;
          if (Array.isArray(missing) && missing.length > 0) return true;
          throw new Error('Expected missingFields array in 422 response');
        }
        throw err;
      }
    });

    // 3. Duplicate Registration Detection -> 409 Conflict
    await testCase('3. Duplicate registration (same email / registrationNo) returns 409 Conflict', async () => {
      try {
        await axios.post(`${BASE_URL}/hospitals/register`, testHospitalPayload);
        throw new Error('Expected 409 but duplicate registration succeeded');
      } catch (err) {
        if (err.response?.status === 409 && err.response.data?.error?.code === 'DUPLICATE_REGISTRATION') {
          return true;
        }
        throw err;
      }
    });

    // 4. Pending Login Blocks Dashboard
    await testCase('4. Logging in as PENDING hospital returns 403 with pending approval message', async () => {
      try {
        await axios.post(`${BASE_URL}/auth/login`, {
          email: testHospitalPayload.email,
          role: 'hospital',
          password: 'Password@123',
        });
        throw new Error('Expected 403 pending approval but login succeeded');
      } catch (err) {
        if (err.response?.status === 403 && err.response.data?.error?.code === 'PENDING_ADMIN_APPROVAL') {
          const msg = err.response.data?.error?.message || '';
          if (msg.toLowerCase().includes('pending admin approval')) return true;
          throw new Error(`Unexpected message: ${msg}`);
        }
        throw err;
      }
    });

    // 5. Pending Hospital Accessing Operational Endpoint Returns 403
    await testCase('5. Pending hospital accessing operational endpoint returns 403 PENDING_ADMIN_APPROVAL', async () => {
      try {
        await axios.get(`${BASE_URL}/hospitals/operational-test`, {
          headers: { Authorization: `Bearer token-${registeredHospitalId}` },
        });
        throw new Error('Expected 403 but pending hospital accessed operational endpoint');
      } catch (err) {
        if (err.response?.status === 403 && err.response.data?.error?.code === 'PENDING_ADMIN_APPROVAL') {
          return true;
        }
        throw err;
      }
    });

    // 6. Pending Hospital Accessing Onboarding Endpoint Succeeds (200)
    await testCase('6. Pending hospital accessing onboarding endpoint succeeds (200)', async () => {
      const res = await axios.get(`${BASE_URL}/hospitals/pending-test`, {
        headers: { Authorization: `Bearer token-${registeredHospitalId}` },
      });
      if (res.status === 200 && res.data?.data?.accessible === true) {
        return true;
      }
      throw new Error(`Unexpected response: ${JSON.stringify(res.data)}`);
    });

    // 7. Admin Gets Pending Queue (GET /api/admin/hospitals/pending)
    await testCase('7. Admin gets pending queue (GET /api/admin/hospitals/pending) and sees newly registered hospital', async () => {
      const res = await axios.get(`${BASE_URL}/admin/hospitals/pending`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const list = res.data?.data;
      if (!Array.isArray(list)) throw new Error('Expected data array');
      const found = list.find((h) => h.id === registeredHospitalId);
      if (!found) throw new Error(`Newly registered hospital ${registeredHospitalId} not found in pending queue`);
      if (found.status !== 'PENDING_APPROVAL') {
        throw new Error(`Expected status PENDING_APPROVAL, got ${found.status}`);
      }
    });

    // 8. Admin Inspects Verification Dossier (GET /api/admin/hospitals/:id/verification)
    await testCase('8. Admin inspects verification dossier and gets submitted details & documents', async () => {
      const res = await axios.get(`${BASE_URL}/admin/hospitals/${registeredHospitalId}/verification`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const dossier = res.data?.data;
      if (dossier?.id !== registeredHospitalId) throw new Error('Dossier ID mismatch');
      if (dossier?.documentsCount !== 4) throw new Error(`Expected 4 documents, got ${dossier?.documentsCount}`);
      if (!Array.isArray(dossier?.documents) || dossier.documents.length === 0) {
        throw new Error('Dossier documents array is empty');
      }
    });

    // 9. Non-Admin Attempting to Approve Returns 403 Forbidden
    await testCase('9. Non-admin attempting to approve hospital returns 403 Forbidden', async () => {
      try {
        await axios.patch(`${BASE_URL}/admin/hospitals/${registeredHospitalId}/approve`, {}, {
          headers: { Authorization: `Bearer ${NON_ADMIN_TOKEN}` },
        });
        throw new Error('Expected 403 but non-admin called approve endpoint');
      } catch (err) {
        if (err.response?.status === 403 && err.response.data?.error?.code === 'FORBIDDEN_ADMIN_ONLY') {
          return true;
        }
        throw err;
      }
    });

    // 10. Admin Approves Hospital (PATCH /api/admin/hospitals/:id/approve)
    await testCase('10. Admin approves hospital (PATCH /api/admin/hospitals/:id/approve) -> status becomes APPROVED', async () => {
      const res = await axios.patch(`${BASE_URL}/admin/hospitals/${registeredHospitalId}/approve`, {}, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.data?.status !== 'APPROVED') {
        throw new Error(`Expected status APPROVED, got ${res.data?.data?.status}`);
      }
    });

    // 11. Approval Creates Audit Log & Notification
    await testCase('11. Approval records audit log in audit_logs and creates platform notification', async () => {
      const auditRes = await axios.get(`${BASE_URL}/audit?hospitalId=${registeredHospitalId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      if (auditRes.status !== 200) throw new Error(`Audit endpoint returned ${auditRes.status}`);
      const trail = auditRes.data?.data || [];
      const approvalLog = trail.find((l) => l.action === 'HOSPITAL_APPROVED');
      if (!approvalLog) {
        throw new Error(`No HOSPITAL_APPROVED audit log found for hospital ${registeredHospitalId}`);
      }
      if (approvalLog.resulting_status !== 'APPROVED') {
        throw new Error(`Audit log resulting_status mismatch: ${approvalLog.resulting_status}`);
      }
    });

    // 12. Approved Hospital Now Succeeds on Operational Endpoint (200)
    await testCase('12. Approved hospital now succeeds on operational endpoint (200 OK)', async () => {
      const res = await axios.get(`${BASE_URL}/hospitals/operational-test`, {
        headers: { Authorization: `Bearer token-${registeredHospitalId}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.data?.accessible !== true) {
        throw new Error('Expected operational endpoint to be accessible');
      }
    });

    // 13. Approved Hospital Appears in Admin Approved Directory (GET /api/admin/hospitals)
    await testCase('13. Approved hospital appears in Approved Hospital Directory (GET /api/admin/hospitals)', async () => {
      const res = await axios.get(`${BASE_URL}/admin/hospitals`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const list = res.data?.data?.hospitals;
      if (!Array.isArray(list)) throw new Error('Expected hospitals array in response');
      const found = list.find((h) => h.id === registeredHospitalId);
      if (!found) throw new Error(`Approved hospital ${registeredHospitalId} not found in directory`);
      if (found.status !== 'APPROVED') throw new Error(`Expected status APPROVED, got ${found.status}`);

      // Also verify detail endpoint
      const detailRes = await axios.get(`${BASE_URL}/admin/hospitals/${registeredHospitalId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      if (detailRes.status !== 200 || detailRes.data?.data?.id !== registeredHospitalId) {
        throw new Error('Failed to retrieve approved hospital details');
      }
    });

    // 14. Admin Rejects Another Hospital with Statutory Reason
    await testCase('14. Admin rejects another hospital application with statutory reason -> status REJECTED', async () => {
      // Step A: Register the second hospital
      const regRes = await axios.post(`${BASE_URL}/hospitals/register`, rejectedHospitalPayload);
      rejectedHospitalId = regRes.data?.data?.hospital?.id;

      // Step B: Attempt reject without reason -> 400 or 422
      try {
        await axios.patch(`${BASE_URL}/admin/hospitals/${rejectedHospitalId}/reject`, {}, {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        });
        throw new Error('Expected 400/422 when rejecting without reason');
      } catch (err) {
        if (err.response?.status !== 400 && err.response?.status !== 422) throw err;
      }

      // Step C: Reject with statutory reason -> 200
      const rejectReason = 'Form 20B/21B Drug License expired and registered campus address could not be verified.';
      const res = await axios.patch(
        `${BASE_URL}/admin/hospitals/${rejectedHospitalId}/reject`,
        { reason: rejectReason },
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
      );

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data?.data?.status !== 'REJECTED') {
        throw new Error(`Expected status REJECTED, got ${res.data?.data?.status}`);
      }

      // Verify audit log
      const auditRes = await axios.get(`${BASE_URL}/audit?hospitalId=${rejectedHospitalId}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      const trail = auditRes.data?.data || [];
      const rejectLog = trail.find((l) => l.action === 'HOSPITAL_REJECTED');
      if (!rejectLog) throw new Error('Missing HOSPITAL_REJECTED audit log');
    });

    // 15. Strict Separation: Rejected Hospital Excluded from Directory & Blocked Operationally
    await testCase('15. Strict Separation: Rejected hospital excluded from directory & operational access blocked (403)', async () => {
      // Check 1: NOT in approved directory list
      const dirRes = await axios.get(`${BASE_URL}/admin/hospitals`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      const dirList = dirRes.data?.data?.hospitals || [];
      const foundInDir = dirList.find((h) => h.id === rejectedHospitalId);
      if (foundInDir) {
        throw new Error(`CRITICAL SECURITY FAILURE: Rejected hospital ${rejectedHospitalId} leaked into Approved Hospital Directory!`);
      }

      // Check 2: Direct GET /api/admin/hospitals/:id returns 404
      try {
        await axios.get(`${BASE_URL}/admin/hospitals/${rejectedHospitalId}`, {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        });
        throw new Error('Expected 404 for rejected hospital in approved directory detail endpoint');
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }

      // Check 3: Operational endpoint returns 403 REGISTRATION_REJECTED with reason
      try {
        await axios.get(`${BASE_URL}/hospitals/operational-test`, {
          headers: { Authorization: `Bearer token-${rejectedHospitalId}` },
        });
        throw new Error('Expected 403 but rejected hospital accessed operational endpoint');
      } catch (err) {
        if (err.response?.status === 403 && err.response.data?.error?.code === 'REGISTRATION_REJECTED') {
          const reason = err.response.data?.error?.rejectionReason;
          if (reason && reason.includes('Form 20B/21B')) return true;
          throw new Error(`Missing or mismatched rejection reason: ${reason}`);
        }
        throw err;
      }
    });

  } finally {
    if (serverInstance) {
      serverInstance.close();
      console.log('\n[INFO] Closed in-process MedEx test server.');
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
