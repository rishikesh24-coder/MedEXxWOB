const axios = require('axios');
const app = require('../server');
const inventoryService = require('../services/inventoryService');
const requestService = require('../services/requestService');
const refundService = require('../services/refundService');
const auditService = require('../services/auditService');

async function runPhase6Tests() {
  console.log('\n===============================================================');
  console.log('  MEDEX PHASE 5 & 6 BACKEND AUTOMATED VERIFICATION TEST SUITE');
  console.log('  Marketplace, Order Lifecycle, Race Conditions, Refunds');
  console.log('===============================================================\n');

  const testPort = 5099;
  const server = app.listen(testPort);
  const baseURL = `http://localhost:${testPort}/api`;

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      console.error(`✗ FAIL: ${name} ->`, errMsg);
      if (err.response?.data) {
        console.error('   Details:', JSON.stringify(err.response.data));
      }
      failed++;
    }
  };

  // Auth tokens
  const buyerToken = 'mock_jwt_token_apollo_buyer';       // hospitalId: 11111111-1111-1111-1111-111111111111
  const sellerToken = 'mock_jwt_token_fortis_seller';     // hospitalId: 22222222-2222-2222-2222-222222222222
  const thirdPartyToken = 'mock_jwt_token_other_hosp';   // hospitalId: 11111111...
  const adminToken = 'mock_jwt_token_admin_super';

  const buyerHeaders = { Authorization: `Bearer ${buyerToken}` };
  const sellerHeaders = { Authorization: `Bearer ${sellerToken}` };
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  let testLotId = null;
  let testMedicineId = null;
  let createdRequestId = null;

  try {
    // ----------------------------------------------------------------
    // SECTION 1: MARKETPLACE & FORMULARY APIS (PHASE 5)
    // ----------------------------------------------------------------
    console.log('\n--- Section 1: Marketplace APIs & Inventory Queries ---');

    await test('1.1 GET /api/marketplace returns active lots and filters own hospital', async () => {
      const res = await axios.get(`${baseURL}/marketplace`, { headers: buyerHeaders });
      if (!res.data.success || !res.data.data) {
        throw new Error('Failed to retrieve marketplace');
      }
      const items = res.data.data.items || res.data.data;
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Marketplace returned empty listings');
      }
      // Verify buyer's own hospital lots (11111111-1111...) are NOT listed
      const hasOwnStock = items.some((i) => i.hospitalId === '11111111-1111-1111-1111-111111111111');
      if (hasOwnStock) {
        throw new Error('Marketplace exposed requesting hospital own inventory lots');
      }
      // Select a target seller lot for subsequent request tests
      const sellerLot = items.find((i) => i.hospitalId === '22222222-2222-2222-2222-222222222222' && i.availableQuantity >= 20);
      if (!sellerLot) {
        throw new Error('Could not find seller lot with >= 20 units');
      }
      testLotId = sellerLot.id;
      testMedicineId = sellerLot.medicineId;
    });

    await test('1.2 GET /api/marketplace/:id returns specific listing details', async () => {
      const res = await axios.get(`${baseURL}/marketplace/${testLotId}`, { headers: buyerHeaders });
      if (!res.data.success || res.data.data.id !== testLotId) {
        throw new Error('Listing detail ID mismatch');
      }
      if (!res.data.data.medicineName || !res.data.data.batchNo) {
        throw new Error('Listing detail missing medicineName or batchNo');
      }
    });

    await test('1.3 GET /api/marketplace/:id/alternatives returns clinical formulation matches', async () => {
      const res = await axios.get(`${baseURL}/marketplace/${testLotId}/alternatives`, { headers: buyerHeaders });
      if (!res.data.success || !res.data.data) {
        throw new Error('Failed to fetch marketplace alternatives');
      }
      if (!res.data.data.canonicalCompositionKey) {
        throw new Error('Missing canonicalCompositionKey in alternatives');
      }
    });

    // ----------------------------------------------------------------
    // SECTION 2: REQUEST ORDER CREATION & ATOMIC STOCK RESERVATION
    // ----------------------------------------------------------------
    console.log('\n--- Section 2: Request Creation & Stock Reservation ---');

    let initialAvailable = 0;
    let initialReserved = 0;

    await test('2.1 Inspect initial stock before reservation', async () => {
      const lot = await inventoryService.getBatchDetail(testLotId);
      initialAvailable = lot.availableQuantity;
      initialReserved = lot.reservedQuantity;
      if (initialAvailable < 20) {
        throw new Error(`Insufficient initial stock: ${initialAvailable}`);
      }
    });

    await test('2.2 POST /api/requests reserves stock atomically and creates line snapshot', async () => {
      const res = await axios.post(
        `${baseURL}/requests`,
        {
          inventoryLotId: testLotId,
          medicineId: testMedicineId,
          quantity: 10,
          priority: 'urgent',
          deliveryAddress: 'ICU Ward 3, Apollo Mumbai',
          notes: 'Urgent transfer request for inpatient therapy',
        },
        { headers: buyerHeaders }
      );

      if (!res.data.success || !res.data.data.id) {
        throw new Error('Failed to create request');
      }
      createdRequestId = res.data.data.id;

      const req = res.data.data;
      if (req.status !== 'pending') {
        throw new Error(`Expected status pending, got ${req.status}`);
      }
      if (req.quantity !== 10) {
        throw new Error(`Expected quantity 10, got ${req.quantity}`);
      }
      if (!req.totalAmount || Number(req.totalAmount) <= 0) {
        throw new Error('Missing or invalid snapshot totalAmount');
      }

      // Verify seller stock reservation
      const updatedLot = await inventoryService.getBatchDetail(testLotId);
      if (updatedLot.availableQuantity !== initialAvailable - 10) {
        throw new Error(`Available quantity did not decrease by 10. Was ${initialAvailable}, now ${updatedLot.availableQuantity}`);
      }
      if (updatedLot.reservedQuantity !== initialReserved + 10) {
        throw new Error(`Reserved quantity did not increase by 10. Was ${initialReserved}, now ${updatedLot.reservedQuantity}`);
      }
    });

    await test('2.3 POST /api/requests blocks request if requesting own hospital inventory', async () => {
      try {
        await axios.post(
          `${baseURL}/requests`,
          {
            inventoryLotId: testLotId,
            quantity: 2,
          },
          { headers: sellerHeaders } // Seller trying to request their own stock
        );
        throw new Error('Should have rejected own inventory request');
      } catch (err) {
        if (err.response?.status !== 400 && err.response?.status !== 403) {
          throw new Error(`Unexpected status code: ${err.response?.status}`);
        }
      }
    });

    await test('2.4 POST /api/requests blocks request if quantity exceeds available stock', async () => {
      try {
        await axios.post(
          `${baseURL}/requests`,
          {
            inventoryLotId: testLotId,
            quantity: 999999, // Exceeds available
          },
          { headers: buyerHeaders }
        );
        throw new Error('Should have rejected excessive quantity request');
      } catch (err) {
        if (err.response?.status !== 400 && err.response?.status !== 409) {
          throw new Error(`Unexpected status code: ${err.response?.status}`);
        }
      }
    });

    // ----------------------------------------------------------------
    // SECTION 3: CONCURRENCY & RACE-CONDITION PROTECTION
    // ----------------------------------------------------------------
    console.log('\n--- Section 3: Concurrency & Double-Reservation Defense ---');

    await test('3.1 Concurrent requests competing for remaining stock -> exactly one succeeds', async () => {
      const currentLot = await inventoryService.getBatchDetail(testLotId);
      const remainingAvail = currentLot.availableQuantity;
      // Request remainingAvail + 1 divided into two concurrent requests
      const reqQty = Math.ceil(remainingAvail * 0.75); // Each requests 75% of remaining

      const promise1 = axios.post(
        `${baseURL}/requests`,
        { inventoryLotId: testLotId, quantity: reqQty },
        { headers: buyerHeaders }
      ).then((r) => ({ ok: true, data: r.data })).catch((e) => ({ ok: false, error: e }));

      const promise2 = axios.post(
        `${baseURL}/requests`,
        { inventoryLotId: testLotId, quantity: reqQty },
        { headers: buyerHeaders }
      ).then((r) => ({ ok: true, data: r.data })).catch((e) => ({ ok: false, error: e }));

      const [res1, res2] = await Promise.all([promise1, promise2]);

      const successCount = (res1.ok ? 1 : 0) + (res2.ok ? 1 : 0);
      const failCount = (!res1.ok ? 1 : 0) + (!res2.ok ? 1 : 0);

      if (successCount !== 1 || failCount !== 1) {
        throw new Error(`Race condition failed: Expected 1 success and 1 fail, got ${successCount} successes and ${failCount} failures`);
      }

      // Check that stock never dropped below 0
      const lotAfterRace = await inventoryService.getBatchDetail(testLotId);
      if (lotAfterRace.availableQuantity < 0) {
        throw new Error(`Negative stock detected after race condition: ${lotAfterRace.availableQuantity}`);
      }
    });

    // ----------------------------------------------------------------
    // SECTION 4: SELLER ACCEPTANCE & REJECTION WORKFLOW
    // ----------------------------------------------------------------
    console.log('\n--- Section 4: Request Acceptance & Rejection ---');

    let rejectTestReqId = null;

    await test('4.1 Create auxiliary request for rejection test', async () => {
      const res = await axios.post(
        `${baseURL}/requests`,
        { inventoryLotId: testLotId, quantity: 2 },
        { headers: buyerHeaders }
      );
      rejectTestReqId = res.data.data.id;
    });

    await test('4.2 PATCH /api/requests/:id/reject releases reserved stock back to seller', async () => {
      const lotBefore = await inventoryService.getBatchDetail(testLotId);

      const res = await axios.patch(
        `${baseURL}/requests/${rejectTestReqId}/reject`,
        { reason: 'Clinical allocation reserve prioritised internally' },
        { headers: sellerHeaders }
      );

      if (!res.data.success || res.data.data.status !== 'rejected') {
        throw new Error('Failed to reject request');
      }

      const lotAfter = await inventoryService.getBatchDetail(testLotId);
      if (lotAfter.availableQuantity !== lotBefore.availableQuantity + 2) {
        throw new Error(`Stock not released on rejection. Expected ${lotBefore.availableQuantity + 2}, got ${lotAfter.availableQuantity}`);
      }
      if (lotAfter.reservedQuantity !== lotBefore.reservedQuantity - 2) {
        throw new Error(`Reserved stock not decremented on rejection. Expected ${lotBefore.reservedQuantity - 2}, got ${lotAfter.reservedQuantity}`);
      }
    });

    await test('4.3 PATCH /api/requests/:id/accept moves request to accepted state', async () => {
      const res = await axios.patch(
        `${baseURL}/requests/${createdRequestId}/accept`,
        {},
        { headers: sellerHeaders }
      );

      if (!res.data.success || res.data.data.status !== 'accepted') {
        throw new Error('Failed to accept request');
      }
    });

    // ----------------------------------------------------------------
    // SECTION 5: CANCELLATION POLICY TIERS & RESTRICTIONS (PHASE 6)
    // ----------------------------------------------------------------
    console.log('\n--- Section 5: Authoritative 4-Tier Cancellation Policy ---');

    await test('5.1 GET /api/requests/:id/cancellation-policy returns 0% fee / 100% refund within 24h', async () => {
      const res = await axios.get(`${baseURL}/requests/${createdRequestId}/cancellation-policy`, { headers: buyerHeaders });
      if (!res.data.success) throw new Error('Policy check failed');

      const policy = res.data.data;
      if (!policy.canCancel) throw new Error('Should be cancellable within 24h');
      if (policy.penaltyPercent !== 0 || policy.refundPercent !== 100) {
        throw new Error(`Expected 0% fee / 100% refund, got fee=${policy.penaltyPercent}%, refund=${policy.refundPercent}%`);
      }
      if (policy.stageCode !== 'WITHIN_24H') {
        throw new Error(`Expected stageCode WITHIN_24H, got ${policy.stageCode}`);
      }
    });

    await test('5.2 Policy evaluation returns 5% fee for > 24h pre-dispatch request', async () => {
      // Simulate aged request (created 30 hours ago)
      const agedDate = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
      const mockAgedReq = {
        id: 'mock-aged-req',
        status: 'accepted',
        requestDate: agedDate,
        totalAmount: 10000,
      };
      const { evaluateCancellationPolicy } = require('../utils/cancellationPolicy');
      const policy = evaluateCancellationPolicy(mockAgedReq);

      if (!policy.canCancel || policy.penaltyPercent !== 5 || policy.refundPercent !== 95) {
        throw new Error(`Expected 5% fee / 95% refund, got fee=${policy.penaltyPercent}%, refund=${policy.refundPercent}%`);
      }
      if (policy.stageCode !== 'AFTER_24H_BEFORE_DISPATCH') {
        throw new Error(`Expected stageCode AFTER_24H_BEFORE_DISPATCH, got ${policy.stageCode}`);
      }
      if (policy.penaltyAmount !== 500 || policy.refundAmount !== 9500) {
        throw new Error(`Financial math mismatch: penalty=${policy.penaltyAmount}, refund=${policy.refundAmount}`);
      }
    });

    await test('5.3 Policy evaluation returns 15% fee for dispatched / in transit request', async () => {
      const mockDispatchedReq = {
        id: 'mock-dispatched-req',
        status: 'in_transit',
        requestDate: new Date().toISOString(),
        totalAmount: 10000,
      };
      const { evaluateCancellationPolicy } = require('../utils/cancellationPolicy');
      const policy = evaluateCancellationPolicy(mockDispatchedReq);

      if (!policy.canCancel || policy.penaltyPercent !== 15 || policy.refundPercent !== 85) {
        throw new Error(`Expected 15% fee / 85% refund, got fee=${policy.penaltyPercent}%, refund=${policy.refundPercent}%`);
      }
      if (policy.stageCode !== 'DISPATCHED') {
        throw new Error(`Expected stageCode DISPATCHED, got ${policy.stageCode}`);
      }
      if (policy.penaltyAmount !== 1500 || policy.refundAmount !== 8500) {
        throw new Error(`Financial math mismatch: penalty=${policy.penaltyAmount}, refund=${policy.refundAmount}`);
      }
    });

    await test('5.4 Policy evaluation rejects cancellation for delivered request', async () => {
      const mockDeliveredReq = {
        id: 'mock-delivered-req',
        status: 'delivered',
        requestDate: new Date().toISOString(),
        totalAmount: 10000,
      };
      const { evaluateCancellationPolicy } = require('../utils/cancellationPolicy');
      const policy = evaluateCancellationPolicy(mockDeliveredReq);

      if (policy.canCancel !== false) {
        throw new Error('Delivered requests must NOT be cancellable');
      }
      if (policy.stageCode !== 'DELIVERED') {
        throw new Error(`Expected stageCode DELIVERED, got ${policy.stageCode}`);
      }
    });

    // ----------------------------------------------------------------
    // SECTION 6: CANCELLATION EXECUTION, STOCK RELEASE, REFUND CREATION
    // ----------------------------------------------------------------
    console.log('\n--- Section 6: Cancellation Execution & Refund Ledger ---');

    await test('6.1 Unauthorized hospital cannot cancel Buyer request (403 Forbidden)', async () => {
      try {
        await axios.post(
          `${baseURL}/requests/${createdRequestId}/cancel`,
          { reason: 'Malicious cancellation attempt' },
          { headers: sellerHeaders } // Seller trying to cancel Buyer's requisition
        );
        throw new Error('Should have blocked unauthorized cancellation');
      } catch (err) {
        if (err.response?.status !== 403) {
          throw new Error(`Expected 403 Forbidden, got ${err.response?.status}`);
        }
      }
    });

    let refundRecordId = null;

    await test('6.2 Buyer cancels accepted request -> releases stock & creates pending refund', async () => {
      const lotBefore = await inventoryService.getBatchDetail(testLotId);

      const res = await axios.post(
        `${baseURL}/requests/${createdRequestId}/cancel`,
        { reason: 'Inpatient discharged, medicine no longer required', notes: 'Ward doctor signature verified' },
        { headers: buyerHeaders }
      );

      if (!res.data.success || res.data.data.request.status !== 'cancelled') {
        throw new Error('Failed to cancel request');
      }

      // 1. Check stock release
      const lotAfter = await inventoryService.getBatchDetail(testLotId);
      if (lotAfter.availableQuantity !== lotBefore.availableQuantity + 10) {
        throw new Error(`Stock not restored: was ${lotBefore.availableQuantity}, expected ${lotBefore.availableQuantity + 10}, got ${lotAfter.availableQuantity}`);
      }
      if (lotAfter.reservedQuantity !== lotBefore.reservedQuantity - 10) {
        throw new Error(`Reserved stock not decremented: was ${lotBefore.reservedQuantity}, expected ${lotBefore.reservedQuantity - 10}, got ${lotAfter.reservedQuantity}`);
      }

      // 2. Check refund record created with pending status
      const refund = res.data.data.refund;
      if (!refund) {
        throw new Error('No refund object returned in cancellation payload');
      }
      if (refund.status !== 'pending') {
        throw new Error(`Refund status must be pending, got ${refund.status}`);
      }
      if (refund.refundPercent !== 100 || refund.penaltyPercent !== 0) {
        throw new Error(`Expected 100% refund / 0% penalty within 24h, got refund=${refund.refundPercent}%, penalty=${refund.penaltyPercent}%`);
      }
      refundRecordId = refund.id;
    });

    await test('6.3 Cancel already-cancelled request returns 400 Bad Request (Idempotency)', async () => {
      try {
        await axios.post(
          `${baseURL}/requests/${createdRequestId}/cancel`,
          { reason: 'Duplicate cancellation attempt' },
          { headers: buyerHeaders }
        );
        throw new Error('Should have rejected second cancellation');
      } catch (err) {
        if (err.response?.status !== 400 && err.response?.status !== 409) {
          throw new Error(`Expected 400/409 for repeated cancellation, got ${err.response?.status}`);
        }
      }
    });

    // ----------------------------------------------------------------
    // SECTION 7: REFUND QUERY APIS
    // ----------------------------------------------------------------
    console.log('\n--- Section 7: Refund Retrieval & Admin Auditing ---');

    await test('7.1 GET /api/refunds/my returns buyer refunds', async () => {
      const res = await axios.get(`${baseURL}/refunds/my`, { headers: buyerHeaders });
      const refunds = res.data.data.refunds || res.data.data;
      if (!res.data.success || !Array.isArray(refunds)) {
        throw new Error('Failed to retrieve buyer refunds');
      }
      const myRefund = refunds.find((r) => r.id === refundRecordId || r.requestId === createdRequestId || r.request_id === createdRequestId);
      if (!myRefund) {
        throw new Error('Created refund record not present in /api/refunds/my');
      }
    });

    await test('7.2 GET /api/refunds/:id returns refund details', async () => {
      const res = await axios.get(`${baseURL}/refunds/${refundRecordId}`, { headers: buyerHeaders });
      if (!res.data.success || res.data.data.id !== refundRecordId) {
        throw new Error('Failed to retrieve single refund by ID');
      }
      if (res.data.data.status !== 'pending') {
        throw new Error(`Refund status mismatch: ${res.data.data.status}`);
      }
    });

    await test('7.3 GET /api/refunds/admin returns all system refunds for administrator', async () => {
      const res = await axios.get(`${baseURL}/refunds/admin`, { headers: adminHeaders });
      const refunds = res.data.data.refunds || res.data.data;
      if (!res.data.success || !Array.isArray(refunds)) {
        throw new Error('Admin refund retrieval failed');
      }
      const found = refunds.some((r) => r.id === refundRecordId);
      if (!found) {
        throw new Error('Admin refunds did not include newly created cancellation refund');
      }
    });

    await test('7.4 Non-admin is forbidden from accessing /api/refunds/admin (403)', async () => {
      try {
        await axios.get(`${baseURL}/refunds/admin`, { headers: buyerHeaders });
        throw new Error('Should have blocked non-admin from admin refunds');
      } catch (err) {
        if (err.response?.status !== 403) {
          throw new Error(`Expected 403 Forbidden, got ${err.response?.status}`);
        }
      }
    });

    // ----------------------------------------------------------------
    // SECTION 8: NOTIFICATIONS & AUDIT TRAILS
    // ----------------------------------------------------------------
    console.log('\n--- Section 8: In-App Notifications & Audit Logs ---');

    await test('8.1 In-app notification created for cancellation and refund', async () => {
      const notifService = require('../services/notificationService');
      const buyerNotifs = await notifService.getNotificationsForHospital('11111111-1111-1111-1111-111111111111');
      const sellerNotifs = await notifService.getNotificationsForHospital('22222222-2222-2222-2222-222222222222');
      const devNotifs = notifService.getDevNotifications ? notifService.getDevNotifications() : [];

      const allNotifs = [...buyerNotifs, ...sellerNotifs, ...devNotifs];
      const hasCancelNotif = allNotifs.some(
        (n) => n.notification_type === 'REQUEST_CANCELLED' || n.type === 'REQUEST_CANCELLED' || n.notificationType === 'REQUEST_CANCELLED'
      );
      if (!hasCancelNotif) {
        throw new Error('REQUEST_CANCELLED notification not logged');
      }

      const hasRefundNotif = allNotifs.some(
        (n) => n.notification_type === 'REFUND_PENDING' || n.type === 'REFUND_PENDING' || n.notificationType === 'REFUND_PENDING'
      );
      if (!hasRefundNotif) {
        throw new Error('REFUND_PENDING notification not logged');
      }
    });

    await test('8.2 Audit logs recorded with stable entity IDs', async () => {
      const logs = await auditService.getAuditTrail({ entityType: 'REQUEST', entityId: createdRequestId });
      if (!Array.isArray(logs) || logs.length === 0) {
        throw new Error('No audit logs recorded for request');
      }
      const actions = logs.map((l) => l.action);
      if (!actions.includes('REQUEST_CREATED')) {
        throw new Error('Missing REQUEST_CREATED in audit log');
      }
      if (!actions.includes('REQUEST_CANCELLED')) {
        throw new Error('Missing REQUEST_CANCELLED in audit log');
      }
    });

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
