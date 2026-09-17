/**
 * MEDEX PHASE 12: LOGISTICS & COLD-CHAIN TELEMETRY + FEEDBACK RESOLUTION
 * Comprehensive Test Suite for Inter-Hospital Transfers, Cold-Chain Compliance,
 * Real-time Tracking, Institutional Feedback, and ABDM Gateway Readiness.
 */

const assert = require('assert');
const axios = require('axios');
const app = require('../server');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function startServerIfNeeded() {
  try {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 1500 });
    if (res.status === 200) {
      return null;
    }
  } catch (e) {
    // Server not running, start in-process
  }

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      resolve(server);
    });
  });
}

const TOKENS = {
  ADMIN: 'mock_jwt_token_admin_test_session',
  APOLLO: 'mock_jwt_token_hospital_apollo_active',
  FORTIS: 'mock_jwt_token_fortis_supply',
  PENDING: 'mock_jwt_token_pending_metrocare_review',
};

const APOLLO_ID = '11111111-1111-1111-1111-111111111111';
const FORTIS_ID = '22222222-2222-2222-2222-222222222222';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTestCase(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err.message}`);
    if (err.response?.data) {
      console.error('         Response data:', JSON.stringify(err.response.data));
    }
    failedTests++;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('  MEDEX PHASE 12: LOGISTICS + FEEDBACK + ABDM VERIFICATION       ');
  console.log('================================================================\n');

  const serverInstance = await startServerIfNeeded();

  try {
    // =========================================================================
    // SECTION 1: TRANSFERS & COLD-CHAIN TELEMETRY (POST /api/transfers)
    // =========================================================================
    console.log('--- Section 1: Transfers & Cold-Chain Telemetry ---');

    let createdTransfer = null;

    await runTestCase('POST /api/transfers - Create transfer with valid cold-chain temperature (4.5°C)', async () => {
      const res = await axios.post(
        `${BASE_URL}/transfers`,
        {
          destinationHospitalId: FORTIS_ID,
          medicineName: 'Remdesivir 100mg Lyophilized Vials',
          batchNumber: 'REM-2026-B9',
          quantity: 50,
          currentTemp: 4.5,
          storageCondition: 'Refrigerated (2°C - 8°C)',
          courierPartner: 'BlueDart LifeSciences TempControl',
        },
        { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
      );

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.id);
      assert.strictEqual(res.data.data.medicineName, 'Remdesivir 100mg Lyophilized Vials');
      assert.strictEqual(res.data.data.tempBreach, false);
      assert.strictEqual(res.data.data.status, 'DISPATCHED');
      createdTransfer = res.data.data;
    });

    await runTestCase('POST /api/transfers - Validation error when medicineName or quantity is missing', async () => {
      try {
        await axios.post(
          `${BASE_URL}/transfers`,
          {
            destinationHospitalId: FORTIS_ID,
            quantity: 0,
          },
          { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
        );
        assert.fail('Should have failed with 400 Bad Request');
      } catch (err) {
        assert.strictEqual(err.response.status, 400);
        assert.strictEqual(err.response.data.success, false);
      }
    });

    await runTestCase('POST /api/transfers - Cold-chain temperature breach detected (> 8.0°C)', async () => {
      const res = await axios.post(
        `${BASE_URL}/transfers`,
        {
          destinationHospitalId: FORTIS_ID,
          medicineName: 'Trastuzumab 440mg Monoclonal Vials',
          batchNumber: 'TRZ-BREACH-01',
          quantity: 20,
          currentTemp: 11.2, // Exceeds 8°C CDSCO limit
          storageCondition: 'Refrigerated (2°C - 8°C)',
        },
        { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
      );

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.tempBreach, true);
      assert.strictEqual(res.data.data.currentTemp, 11.2);
    });

    // =========================================================================
    // SECTION 2: TRANSFER LISTING & TENANT ISOLATION (GET /api/transfers)
    // =========================================================================
    console.log('\n--- Section 2: Transfer Listing & RBAC / Tenant Isolation ---');

    await runTestCase('GET /api/transfers - Hospital sees transfers where it is sender or recipient', async () => {
      const res = await axios.get(`${BASE_URL}/transfers`, {
        headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      const hasCreated = res.data.data.some((t) => t.id === createdTransfer.id);
      assert.ok(hasCreated, 'Apollo should see its created transfer');
    });

    await runTestCase('GET /api/transfers - Admin has organization-wide visibility across all facilities', async () => {
      const res = await axios.get(`${BASE_URL}/transfers`, {
        headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(res.data.data.length >= 2, 'Admin should see multiple transfers across all hospitals');
    });

    // =========================================================================
    // SECTION 3: REAL-TIME TRACKING & TELEMETRY (GET /api/tracking/:txnId)
    // =========================================================================
    console.log('\n--- Section 3: Real-Time Tracking & Telemetry Telematics ---');

    await runTestCase('GET /api/tracking/:txnId - Lookup active consignment by transaction ID', async () => {
      const txnId = createdTransfer.transactionId;
      const res = await axios.get(`${BASE_URL}/tracking/${txnId}`, {
        headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.transactionId, txnId);
      assert.strictEqual(res.data.data.medicineName, createdTransfer.medicineName);
      assert.ok(Array.isArray(res.data.data.timeline));
      assert.ok(Array.isArray(res.data.data.telemetryHistory));
    });

    await runTestCase('GET /api/tracking/:txnId - Returns 404 for nonexistent transaction ID', async () => {
      try {
        await axios.get(`${BASE_URL}/tracking/TXN-NONEXISTENT-9999`, {
          headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
        });
        assert.fail('Should have failed with 404 Not Found');
      } catch (err) {
        assert.strictEqual(err.response.status, 404);
        assert.strictEqual(err.response.data.success, false);
      }
    });

    await runTestCase('PATCH /api/transfers/:id/status - Update milestone to IN_TRANSIT with new telemetry', async () => {
      const res = await axios.patch(
        `${BASE_URL}/transfers/${createdTransfer.id}/status`,
        {
          status: 'IN_TRANSIT',
          currentTemp: 4.8,
          location: 'Delhi-Jaipur Expressway Hub',
          note: 'Consignment entered National Highway corridor under continuous cold-chain log',
        },
        { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.status, 'IN_TRANSIT');
      assert.strictEqual(res.data.data.currentTemp, 4.8);
      assert.strictEqual(res.data.data.tempBreach, false);
    });

    // =========================================================================
    // SECTION 4: INSTITUTIONAL FEEDBACK & RESOLUTION (POST & GET /api/feedback)
    // =========================================================================
    console.log('\n--- Section 4: Institutional Feedback & Moderation Workflow ---');

    let createdFeedback = null;

    await runTestCase('POST /api/feedback - Hospital submits high-rated institutional feedback', async () => {
      const res = await axios.post(
        `${BASE_URL}/feedback`,
        {
          rating: 5,
          category: 'Logistics / Cold Chain',
          feedbackText: 'Exceptional temperature monitoring. Zero breach across 50 vials of high-value oncology supplies.',
        },
        { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
      );

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.id);
      assert.strictEqual(res.data.data.rating, 5);
      assert.strictEqual(res.data.data.category, 'Logistics / Cold Chain');
      assert.strictEqual(res.data.data.status, 'new');
      createdFeedback = res.data.data;
    });

    await runTestCase('POST /api/feedback - Validation error when rating is invalid (< 1 or > 5)', async () => {
      try {
        await axios.post(
          `${BASE_URL}/feedback`,
          {
            rating: 6,
            feedbackText: 'Invalid rating test',
          },
          { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
        );
        assert.fail('Should have failed with 400 Bad Request');
      } catch (err) {
        assert.strictEqual(err.response.status, 400);
        assert.strictEqual(err.response.data.success, false);
      }
    });

    await runTestCase('GET /api/feedback - Hospital only sees its own submitted feedback', async () => {
      const res = await axios.get(`${BASE_URL}/feedback`, {
        headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      const hasFeedback = res.data.data.some((f) => f.id === createdFeedback.id);
      assert.ok(hasFeedback, 'Apollo should see its submitted feedback');
    });

    await runTestCase('GET /api/feedback - Admin can view all feedback and filter by rating', async () => {
      const res = await axios.get(`${BASE_URL}/feedback?rating=5`, {
        headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(res.data.data.every((f) => Number(f.rating) === 5));
    });

    await runTestCase('PATCH /api/feedback/:id/reply - Admin replies to feedback and marks under_review', async () => {
      const res = await axios.patch(
        `${BASE_URL}/feedback/${createdFeedback.id}/reply`,
        { replyText: 'Thank you for your feedback! MedEx temperature telemetry operates under CDSCO Schedule M compliance.' },
        { headers: { Authorization: `Bearer ${TOKENS.ADMIN}` } }
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.adminReply, 'Thank you for your feedback! MedEx temperature telemetry operates under CDSCO Schedule M compliance.');
      assert.strictEqual(res.data.data.status, 'under_review');
    });

    await runTestCase('PATCH /api/feedback/:id/reply - Non-admin receives 403 Forbidden', async () => {
      try {
        await axios.patch(
          `${BASE_URL}/feedback/${createdFeedback.id}/reply`,
          { replyText: 'Unauthorized reply attempt' },
          { headers: { Authorization: `Bearer ${TOKENS.APOLLO}` } }
        );
        assert.fail('Should have failed with 403 Forbidden');
      } catch (err) {
        assert.strictEqual(err.response.status, 403);
        assert.strictEqual(err.response.data.success, false);
      }
    });

    await runTestCase('PATCH /api/feedback/:id/status - Admin resolves feedback status', async () => {
      const res = await axios.patch(
        `${BASE_URL}/feedback/${createdFeedback.id}/status`,
        { status: 'resolved' },
        { headers: { Authorization: `Bearer ${TOKENS.ADMIN}` } }
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.status, 'resolved');
    });

    // =========================================================================
    // SECTION 5: ABDM GATEWAY READINESS (GET /api/abdm/status)
    // =========================================================================
    console.log('\n--- Section 5: ABDM Gateway Readiness & Health ---');

    await runTestCase('GET /api/abdm/status - Returns health and gateway readiness parameters', async () => {
      const res = await axios.get(`${BASE_URL}/abdm/status`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.gatewayStatus, 'OPERATIONAL');
      assert.strictEqual(res.data.data.facilityRegistry, 'ACTIVE');
      assert.ok(Array.isArray(res.data.data.milestones));
    });

  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n================================================================');
  console.log(`  PHASE 12 VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.log(`  FAILURES: ${failedTests}`);
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log('  STATUS: ALL TESTS PASSED SUCCESSFULLY');
    console.log('================================================================\n');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
