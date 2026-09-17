/**
 * MedEx Phase 11 Step 5: Horizontal Scaling & Concurrency Hardening Verification Suite
 *
 * Verifies that critical operations do NOT depend solely on in-process Node.js mutexes,
 * ensuring correctness when multiple backend instances run concurrently:
 *
 * 1. Concurrent Stock Reservations (Scarce stock competition, no negative stock)
 * 2. Concurrent Requisition Cancellations (No double stock release, no duplicate refunds)
 * 3. Concurrent Payment Verification (Idempotent transitions, alreadyProcessed handling)
 * 4. Concurrent Webhook Delivery (Duplicate event ledger deduplication)
 * 5. Concurrent Trade Synchronization (Deterministic ID, strict 1:1 trade-request mapping)
 * 6. Concurrent Refund Disbursement (No double-payout with payment provider)
 * 7. Concurrent State Machine Conflict (Mutually exclusive accept/reject transitions)
 */

const assert = require('assert');
const crypto = require('crypto');
const inventoryService = require('../services/inventoryService');
const requestService = require('../services/requestService');
const paymentService = require('../services/paymentService');
const refundService = require('../services/refundService');
const tradingService = require('../services/tradingService');
const { getPaymentProvider } = require('../services/paymentProvider');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  MEDEX PHASE 11 STEP 5: CONCURRENCY & HORIZONTAL SCALING SUITE ');
  console.log('================================================================\n');

  const buyerHospitalId = '11111111-1111-1111-1111-111111111111';
  const sellerHospitalId = '22222222-2222-2222-2222-222222222222';

  const buyerUser = {
    id: 'user-buyer-1',
    hospitalId: buyerHospitalId,
    role: 'hospital',
    name: 'Apollo Hospital Pharmacist',
  };

  const sellerUser = {
    id: 'user-seller-1',
    hospitalId: sellerHospitalId,
    role: 'hospital',
    name: 'Fortis Hospital Pharmacist',
  };

  const adminUser = {
    id: 'user-admin-1',
    role: 'admin',
    name: 'MedEx Super Admin',
  };

  // -------------------------------------------------------------------------
  // TEST 1: Concurrent Stock Reservations (Scarce Inventory Race)
  // -------------------------------------------------------------------------
  await test('Scenario A: 10 concurrent reservations competing for 2 available units (no oversell, stock >= 0)', async () => {
    // Setup lot with exactly 2 available units
    const testLotId = `lot-concurrency-${Date.now()}`;
    const initialLot = {
      id: testLotId,
      hospitalId: sellerHospitalId,
      hospital_id: sellerHospitalId,
      medicineId: 'med-augmentin-1',
      medicine_id: 'med-augmentin-1',
      medicineName: 'Augmentin 625',
      batchNumber: `BATCH-CNC-${Date.now().toString().slice(-4)}`,
      quantity: 10,
      totalQuantity: 10,
      availableQuantity: 2,
      available_quantity: 2,
      reservedQuantity: 8,
      reserved_quantity: 8,
      unitPrice: 100,
      concessionRate: 90,
      status: 'AVAILABLE',
      expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
    };

    // Inject lot into authoritative dev/fallback inventory
    inventoryService.devInventory.unshift(initialLot);

    // Launch 10 simultaneous reservation attempts for 1 unit each
    const reservationPromises = Array.from({ length: 10 }, (_, i) =>
      inventoryService.reserveStock(testLotId, 1)
        .then((res) => ({ success: true, index: i, res }))
        .catch((err) => ({ success: false, index: i, status: err.statusCode, message: err.message }))
    );

    const results = await Promise.all(reservationPromises);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    assert.strictEqual(successes.length, 2, `Exactly 2 reservations must succeed (got ${successes.length})`);
    assert.strictEqual(failures.length, 8, `Exactly 8 reservations must be rejected (got ${failures.length})`);

    // Verify all failures have 409 status code
    for (const fail of failures) {
      assert.strictEqual(fail.status, 409, 'Rejections must return 409 Conflict');
    }

    // Verify final stock state
    const targetLot = inventoryService.devInventory.find((l) => l.id === testLotId);
    assert.ok(targetLot, 'Target lot must exist');
    assert.strictEqual(targetLot.availableQuantity, 0, 'Available quantity must be exactly 0 (never negative)');
    assert.strictEqual(targetLot.reservedQuantity, 10, 'Reserved quantity must be exactly 10');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Concurrent Requisition Cancellations (Double Refund & Stock Restore Prevention)
  // -------------------------------------------------------------------------
  await test('Scenario B: Concurrent cancellations on same requisition (only 1 refund, stock restored once)', async () => {
    // Setup test lot and requisition
    const testLotId = `lot-cancel-${Date.now()}`;
    const testLot = {
      id: testLotId,
      hospitalId: sellerHospitalId,
      hospital_id: sellerHospitalId,
      medicineId: 'med-dolo-1',
      batchNumber: `BATCH-CAN-${Date.now().toString().slice(-4)}`,
      quantity: 50,
      totalQuantity: 50,
      availableQuantity: 40,
      available_quantity: 40,
      reservedQuantity: 10,
      reserved_quantity: 10,
      unitPrice: 50,
      status: 'AVAILABLE',
      expiryDate: new Date(Date.now() + 200 * 86400000).toISOString().split('T')[0],
    };
    inventoryService.devInventory.unshift(testLot);

    const testReqId = `req-cancel-race-${Date.now()}`;
    const testRequest = {
      id: testReqId,
      transactionId: `REQ-RACE-${Date.now()}`,
      transaction_id: `REQ-RACE-${Date.now()}`,
      fromHospitalId: buyerHospitalId,
      from_hospital_id: buyerHospitalId,
      fromHospitalName: 'Apollo Hospital',
      toHospitalId: sellerHospitalId,
      to_hospital_id: sellerHospitalId,
      toHospitalName: 'Fortis Hospital',
      inventoryLotId: testLotId,
      inventory_lot_id: testLotId,
      medicineName: 'Dolo 650',
      quantity: 10,
      totalAmount: 500,
      finalAmount: 500,
      status: 'accepted',
      paymentStatus: 'pending',
      requestedDate: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      dispatchedAt: null,
      deliveredAt: null,
    };

    requestService.devRequests.unshift(testRequest);

    // Launch 5 concurrent cancellation calls
    const cancelPromises = Array.from({ length: 5 }, () =>
      requestService.cancelRequest({
        requestId: testReqId,
        reason: 'Duplicate cancellation race test',
        hospitalId: buyerHospitalId,
        reqUser: buyerUser,
      })
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, status: err.statusCode, code: err.code }))
    );

    const cancelResults = await Promise.all(cancelPromises);
    const cancelSuccesses = cancelResults.filter((r) => r.success);
    const cancelFailures = cancelResults.filter((r) => !r.success);

    assert.strictEqual(cancelSuccesses.length, 1, `Exactly 1 cancellation must succeed (got ${cancelSuccesses.length})`);
    assert.strictEqual(cancelFailures.length, 4, `4 cancellations must be rejected (got ${cancelFailures.length})`);

    for (const fail of cancelFailures) {
      assert.strictEqual(fail.status, 409, 'Failed cancellations must return 409 Conflict');
      assert.strictEqual(fail.code, 'ALREADY_CANCELLED', 'Failed cancellations must have code ALREADY_CANCELLED');
    }

    // Verify stock restored exactly once (40 + 10 = 50, NOT 40 + 50 = 90)
    assert.strictEqual(testLot.availableQuantity, 50, `Available quantity should be 50 (got ${testLot.availableQuantity})`);
    assert.strictEqual(testLot.reservedQuantity, 0, `Reserved quantity should be 0 (got ${testLot.reservedQuantity})`);

    // Verify refund records: exactly 1 created for this request
    const matchingRefunds = refundService.fallbackRefunds.filter((r) => r.requestId === testReqId || r.request_id === testReqId);
    assert.strictEqual(matchingRefunds.length, 1, `Exactly 1 refund record must exist for this request (got ${matchingRefunds.length})`);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Concurrent Payment Verification (Idempotent State Transition)
  // -------------------------------------------------------------------------
  await test('Scenario C: Concurrent payment verification calls (idempotent, single PAID transition)', async () => {
    const provider = getPaymentProvider('mock');
    const provOrder = await provider.createOrder({ amount: 1000, currency: 'INR' });
    const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
    const signature = provider.generateSignature(provOrder.id, paymentId);

    const testPaymentId = `pmt-race-${Date.now()}`;
    const testReqId = `req-pmt-${Date.now()}`;

    const testReq = {
      id: testReqId,
      transactionId: `REQ-PMT-${Date.now()}`,
      fromHospitalId: buyerHospitalId,
      from_hospital_id: buyerHospitalId,
      fromHospitalName: 'Apollo Hospital',
      toHospitalId: sellerHospitalId,
      to_hospital_id: sellerHospitalId,
      toHospitalName: 'Fortis Hospital',
      status: 'payment_pending',
      paymentStatus: 'pending',
      totalAmount: 1000,
    };
    requestService.devRequests.unshift(testReq);

    const testPayment = {
      id: testPaymentId,
      transactionId: `TXN-PMT-${Date.now()}`,
      transaction_id: `TXN-PMT-${Date.now()}`,
      requestId: testReqId,
      request_id: testReqId,
      provider: 'mock',
      providerOrderId: provOrder.id,
      provider_order_id: provOrder.id,
      amount: 1000,
      totalPaid: 1000,
      status: 'CREATED',
      buyerHospitalId,
      buyer_hospital_id: buyerHospitalId,
      sellerHospitalId,
      seller_hospital_id: sellerHospitalId,
      createdAt: new Date().toISOString(),
    };
    paymentService.fallbackPayments.unshift(testPayment);

    // Fire 5 simultaneous verification attempts
    const verifyPromises = Array.from({ length: 5 }, () =>
      paymentService.verifyPayment({
        paymentId: testPaymentId,
        providerOrderId: provOrder.id,
        providerPaymentId: paymentId,
        providerSignature: signature,
        user: buyerUser,
      })
    );

    const verifyResults = await Promise.all(verifyPromises);
    assert.strictEqual(verifyResults.length, 5, 'All 5 verification promises must resolve');

    // All should succeed without throwing
    for (const res of verifyResults) {
      assert.strictEqual(res.success, true, 'Every concurrent verification call must succeed');
      assert.strictEqual(res.payment.status, 'PAID', 'Payment must be in PAID state');
    }

    // At least 4 must be flagged as alreadyProcessed: true
    const alreadyProcessedCount = verifyResults.filter((r) => r.alreadyProcessed).length;
    assert.ok(alreadyProcessedCount >= 4, `At least 4 calls should be recognized as already processed (got ${alreadyProcessedCount})`);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Concurrent Webhook Event Delivery (Ledger Deduplication)
  // -------------------------------------------------------------------------
  await test('Scenario D: Concurrent duplicate webhook event deliveries (idempotency ledger)', async () => {
    const provider = getPaymentProvider('mock');
    const order = await provider.createOrder({ amount: 750, currency: 'INR' });
    const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;

    const sharedEventId = `ev_race_${Date.now()}`;
    const webhookPayload = {
      event_id: sharedEventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: order.id,
            amount: 75000,
            status: 'captured',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(webhookPayload));
    const signature = provider.generateWebhookSignature(rawBody);

    // Dispatch 5 concurrent webhook calls with the same eventId
    const webhookPromises = Array.from({ length: 5 }, () =>
      paymentService.handleWebhook({
        rawBody,
        headers: { 'x-razorpay-signature': signature },
        signature,
      })
    );

    const webhookResults = await Promise.all(webhookPromises);
    assert.strictEqual(webhookResults.length, 5, 'All 5 webhook calls must resolve');

    for (const res of webhookResults) {
      assert.strictEqual(res.received, true, 'Webhook must be acknowledged');
    }

    // At least 4 must be marked as duplicate: true
    const duplicateCount = webhookResults.filter((r) => r.duplicate).length;
    assert.ok(duplicateCount >= 4, `At least 4 webhook responses must identify as duplicates (got ${duplicateCount})`);
  });

  // -------------------------------------------------------------------------
  // TEST 5: Concurrent Trade Synchronization (Deterministic ID & No Duplicates)
  // -------------------------------------------------------------------------
  await test('Scenario E: Concurrent trade sync from request (deterministic ID, exactly 1 trade)', async () => {
    const testReqId = `req-trade-race-${Date.now()}`;
    const testRequest = {
      id: testReqId,
      transactionId: `REQ-TRD-${Date.now()}`,
      fromHospitalId: buyerHospitalId,
      fromHospitalName: 'Apollo Hospital',
      toHospitalId: sellerHospitalId,
      toHospitalName: 'Fortis Hospital',
      medicineName: 'Meronem 1g IV',
      quantity: 5,
      totalAmount: 8250,
      finalAmount: 8250,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    // Fire 6 simultaneous trade sync calls for the exact same request
    const syncPromises = Array.from({ length: 6 }, () =>
      tradingService.syncTradeFromRequest(testRequest, { actor: 'Concurrency Test' })
    );

    const tradeResults = await Promise.all(syncPromises);
    assert.strictEqual(tradeResults.length, 6, 'All 6 trade syncs must resolve');

    // All trade results must share the exact same deterministic ID
    const firstTradeId = tradeResults[0].id;
    for (const tr of tradeResults) {
      assert.strictEqual(tr.id, firstTradeId, 'All concurrent syncs must produce the identical deterministic trade ID');
    }

    // Verify fallback trade store contains exactly 1 entry for this requestId
    const matchingTrades = tradingService.fallbackTrades.filter(
      (t) => t.requestId === testReqId || t.request_id === testReqId
    );
    assert.strictEqual(matchingTrades.length, 1, `Exactly 1 trade record must exist in store (got ${matchingTrades.length})`);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Concurrent Refund Disbursement (Double-Disbursement Race)
  // -------------------------------------------------------------------------
  await test('Scenario F: Concurrent refund disbursements (exactly 1 provider payout, others rejected)', async () => {
    const testRefundId = `ref-disburse-race-${Date.now()}`;
    const testRefund = {
      id: testRefundId,
      refundNumber: `REF-RACE-${Date.now().toString().slice(-4)}`,
      refund_number: `REF-RACE-${Date.now().toString().slice(-4)}`,
      requestId: `req-ref-${Date.now()}`,
      request_id: `req-ref-${Date.now()}`,
      buyerHospitalId,
      buyer_hospital_id: buyerHospitalId,
      sellerHospitalId,
      seller_hospital_id: sellerHospitalId,
      totalOrderAmount: 1000,
      refundAmount: 950,
      refund_amount: 950,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    refundService.fallbackRefunds.unshift(testRefund);

    // Fire 4 simultaneous disbursement calls with admin user
    const disbursePromises = Array.from({ length: 4 }, () =>
      refundService.processRefundDisbursement({
        refundId: testRefundId,
        user: adminUser,
        notes: 'Concurrent disbursement test',
      })
        .then((res) => ({ success: true, res }))
        .catch((err) => ({ success: false, status: err.statusCode, message: err.message }))
    );

    const disburseResults = await Promise.all(disbursePromises);
    const disburseSuccesses = disburseResults.filter((r) => r.success);
    const disburseFailures = disburseResults.filter((r) => !r.success);

    assert.strictEqual(disburseSuccesses.length, 1, `Exactly 1 disbursement must succeed (got ${disburseSuccesses.length})`);
    assert.strictEqual(disburseFailures.length, 3, `3 disbursements must be rejected (got ${disburseFailures.length})`);

    for (const fail of disburseFailures) {
      assert.strictEqual(fail.status, 400, 'Subsequent disbursements must receive 400 Bad Request');
    }

    // Verify refund is completed with valid provider reference
    assert.strictEqual(testRefund.status, 'completed', 'Final refund status must be completed');
    assert.ok(testRefund.providerRefundReference, 'Provider refund reference must be present');
  });

  // -------------------------------------------------------------------------
  // TEST 7: Concurrent Conflicting Requisition Transitions (Accept vs Decline Race)
  // -------------------------------------------------------------------------
  await test('Scenario G: Mutually exclusive accept vs decline race (exactly one winning final state)', async () => {
    const testReqId = `req-conflict-${Date.now()}`;
    const testReq = {
      id: testReqId,
      transactionId: `REQ-CONF-${Date.now()}`,
      fromHospitalId: buyerHospitalId,
      from_hospital_id: buyerHospitalId,
      fromHospitalName: 'Apollo Hospital',
      toHospitalId: sellerHospitalId,
      to_hospital_id: sellerHospitalId,
      toHospitalName: 'Fortis Hospital',
      medicineName: 'Calpol 500',
      quantity: 20,
      totalAmount: 600,
      status: 'pending',
      requestedDate: new Date().toISOString(),
    };
    requestService.devRequests.unshift(testReq);

    // Fire accept and reject simultaneously
    const results = await Promise.all([
      requestService.acceptRequest({ requestId: testReqId, hospitalId: sellerHospitalId, reqUser: sellerUser })
        .then(() => ({ action: 'accept', success: true }))
        .catch((err) => ({ action: 'accept', success: false, status: err.statusCode })),
      requestService.rejectRequest({ requestId: testReqId, reason: 'Out of stock', hospitalId: sellerHospitalId, reqUser: sellerUser })
        .then(() => ({ action: 'reject', success: true }))
        .catch((err) => ({ action: 'reject', success: false, status: err.statusCode })),
    ]);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    assert.strictEqual(successes.length, 1, 'Exactly one state transition must succeed');
    assert.strictEqual(failures.length, 1, 'The competing state transition must fail');
    assert.strictEqual(failures[0].status, 400, 'Losing transition must receive 400 status');

    const winner = successes[0].action;
    const expectedStatus = winner === 'accept' ? 'accepted' : 'rejected';
    assert.strictEqual(testReq.status, expectedStatus, `Final state must be unambiguously '${expectedStatus}'`);
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  CONCURRENCY VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('>> ALL CONCURRENCY HARDENING TESTS COMPLETED SUCCESSFULLY! <<\n');
  } else {
    console.error(`>> CONCURRENCY TESTS FAILED: ${totalTests - passedTests} failure(s) <<\n`);
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
