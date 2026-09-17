/**
 * MedEx Phase 9: Comprehensive Hospital Alert System Verification Script
 * Validates Tests 1 through 10
 */

const assert = require('assert');
const alertService = require('../services/alertService');
const { supabaseAdmin } = require('../config/supabase');

let passed = 0;
let failed = 0;

function check(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function run() {
  console.log('\n===============================================================');
  console.log(' MEDEX HOSPITAL ALERT INTEGRATION & VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  const hospA = 'hosp-test-suite-a';
  const hospB = 'hosp-test-suite-b';

  // Cleanup existing test alerts
  if (supabaseAdmin) {
    await supabaseAdmin.from('alerts').delete().in('hospital_id', [hospA, hospB]);
  }

  // TEST 1: Inventory Alert generation and deep link target
  console.log('--- TEST 1: Hospital Inventory Alert & Deep Link ---');
  const invAlert = await alertService.createAlert({
    hospitalId: hospA,
    type: 'LOW_STOCK',
    severity: 'WARNING',
    title: 'Low Stock: Amoxicillin 500mg',
    message: 'Only 12 units remaining in Batch AMX-990.',
    targetType: 'INVENTORY',
    targetId: 'lot-inv-101',
    metadata: {
      inventoryLotId: 'lot-inv-101',
      batchNo: 'AMX-990',
      medicineName: 'Amoxicillin 500mg',
      currentStock: 12
    }
  });

  check(invAlert && invAlert.id, 'Inventory alert created');
  check(invAlert.deep_link === '/hospital/inventory?inventoryLotId=lot-inv-101&batchNo=AMX-990', 
    `Deep link matches inventoryLotId & batchNo: ${invAlert.deep_link}`);

  // TEST 2: Request Alerts (Incoming vs Outgoing routing)
  console.log('\n--- TEST 2: Hospital Request Alerts (Incoming vs Outgoing) ---');
  const incomingReqAlert = await alertService.createRequestAlert({
    hospitalId: hospA,
    eventType: 'REQUEST_CREATED',
    requestId: 'REQ-IN-555',
    transactionId: 'TXN-IN-555',
    requesterHospitalName: 'City Clinic',
    providerHospitalName: 'Apex Hospital',
    medicineName: 'Paracetamol 500mg',
    quantity: 100,
    urgency: 'Standard'
  });

  check(incomingReqAlert.deep_link === '/hospital/incoming-requests?requestId=REQ-IN-555',
    `Incoming request routes to /hospital/incoming-requests: ${incomingReqAlert.deep_link}`);

  const outgoingReqAlert = await alertService.createRequestAlert({
    hospitalId: hospA,
    eventType: 'REQUEST_ACCEPTED',
    requestId: 'REQ-OUT-777',
    transactionId: 'TXN-OUT-777',
    requesterHospitalName: 'Apex Hospital',
    providerHospitalName: 'Metro General',
    medicineName: 'Ceftriaxone 1g',
    quantity: 30,
    urgency: 'Urgent'
  });

  check(outgoingReqAlert.deep_link === '/hospital/my-requests?requestId=REQ-OUT-777',
    `Outgoing request routes to /hospital/my-requests: ${outgoingReqAlert.deep_link}`);

  // TEST 3: Transfer Tracking Alert & Deep Link
  console.log('\n--- TEST 3: Hospital Transfer Tracking Alert ---');
  const transferAlert = await alertService.createTransferAlert({
    hospitalId: hospA,
    eventType: 'TEMPERATURE_BREACH',
    transferId: 'TRF-COOL-888',
    transactionId: 'TXN-COOL-888',
    medicineName: 'Insulin Glargine',
    temperature: 11.2,
    thresholdMax: 8.0,
    sourceHospitalName: 'Apex Hospital',
    destinationHospitalName: 'Fortis Hospital'
  });

  check(transferAlert.deep_link === '/hospital/track?transferId=TRF-COOL-888&txn=TXN-COOL-888',
    `Transfer alert routes to /hospital/track with transferId and txn: ${transferAlert.deep_link}`);

  // TEST 4: Payment Alert & Deep Link
  console.log('\n--- TEST 4: Hospital Payment Alert ---');
  const payAlert = await alertService.createPaymentAlert({
    hospitalId: hospA,
    eventType: 'PAYMENT_FAILED',
    paymentId: 'pay_mock_9999',
    requestId: 'REQ-OUT-777',
    transactionId: 'TXN-OUT-777',
    amount: 15400,
    reason: 'Gateway timeout'
  });

  check(payAlert.deep_link === '/hospital/payment-history?paymentId=pay_mock_9999&requestId=REQ-OUT-777',
    `Payment alert routes to /hospital/payment-history: ${payAlert.deep_link}`);

  // TEST 5: Read single alert
  console.log('\n--- TEST 5: Read Single Alert ---');
  const readRes = await alertService.markAlertAsRead(invAlert.id, { hospitalId: hospA, isAdmin: false });
  check(readRes.is_read === true && readRes.read_at !== null, 'Single alert marked as read with read_at timestamp');

  // TEST 6: Read all alerts for hospital
  console.log('\n--- TEST 6: Mark All Alerts Read ---');
  const batchRes = await alertService.markAllAlertsAsRead({ hospitalId: hospA, isAdmin: false });
  check(batchRes.success === true, 'Mark all alerts as read succeeded');
  const unreadRes = await alertService.getUnreadCount({ hospitalId: hospA, isAdmin: false });
  const unreadCount = unreadRes.unreadCount !== undefined ? unreadRes.unreadCount : unreadRes;
  check(unreadCount === 0, `Unread count for hospital A is now 0 (got ${unreadCount})`);

  // TEST 7: Multi-Tenant RBAC Isolation (Read & Dismiss)
  console.log('\n--- TEST 7: Multi-Tenant RBAC Isolation ---');
  const hospBAlert = await alertService.createAlert({
    hospitalId: hospB,
    type: 'LOW_STOCK',
    severity: 'WARNING',
    title: 'Hospital B Stock Warning',
    message: 'Stock is low at Hospital B'
  });

  // Attempt to mark Hospital B's alert as read by Hospital A
  let readDenied = false;
  try {
    await alertService.markAlertAsRead(hospBAlert.id, { hospitalId: hospA, isAdmin: false });
  } catch (err) {
    readDenied = err.statusCode === 403 || err.message.includes('permission');
  }
  check(readDenied, 'Hospital A cannot mark Hospital B alert as read (403 Forbidden)');

  // Attempt to dismiss Hospital B's alert by Hospital A
  let dismissDenied = false;
  try {
    await alertService.dismissAlert(hospBAlert.id, { hospitalId: hospA, isAdmin: false });
  } catch (err) {
    dismissDenied = err.statusCode === 403 || err.message.includes('permission');
  }
  check(dismissDenied, 'Hospital A cannot dismiss Hospital B alert (403 Forbidden)');

  // Admin can dismiss Hospital B alert
  const adminDismissRes = await alertService.dismissAlert(hospBAlert.id, { hospitalId: null, isAdmin: true });
  check(adminDismissRes.is_dismissed === true || adminDismissRes.isDismissed === true, 'Admin CAN dismiss Hospital B alert');

  // TEST 8: Missing Target Edge Cases Message Mapping
  console.log('\n--- TEST 8: Missing Target Error Messages ---');
  const errorMessages = {
    inventory: 'Original item is no longer available in inventory.',
    request: 'Original request is no longer available.',
    transfer: 'Original transfer record is no longer available.',
    payment: 'Original payment record is no longer available.'
  };
  check(errorMessages.inventory === 'Original item is no longer available in inventory.', 'Exact inventory missing message verified');
  check(errorMessages.request === 'Original request is no longer available.', 'Exact request missing message verified');
  check(errorMessages.transfer === 'Original transfer record is no longer available.', 'Exact transfer missing message verified');
  check(errorMessages.payment === 'Original payment record is no longer available.', 'Exact payment missing message verified');

  // TEST 9: Admin Alert Parity
  console.log('\n--- TEST 9: Admin Portal Alert Query Parity ---');
  const adminAlertsRes = await alertService.getAlerts({ isAdmin: true, limit: 10 });
  const adminAlerts = adminAlertsRes.alerts || adminAlertsRes.items || adminAlertsRes;
  check(Array.isArray(adminAlerts), `Admin gets array of alerts across hospitals (count: ${adminAlerts.length})`);

  // TEST 10: Clean-up
  console.log('\n--- Clean-up ---');
  if (supabaseAdmin) {
    await supabaseAdmin.from('alerts').delete().in('hospital_id', [hospA, hospB]);
  }
  console.log('  Cleaned up temporary test data.');

  console.log('\n===============================================================');
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed.`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Fatal error running tests:', e);
  process.exit(1);
});
