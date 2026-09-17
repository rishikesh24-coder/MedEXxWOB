/**
 * MEDEx — PHASE 9: ALERTS + NOTIFICATIONS + REAL-TIME EVENTS
 * Comprehensive Automated Verification Suite (25+ Tests)
 */

const assert = require('assert');
const alertService = require('../services/alertService');
const notificationService = require('../services/notificationService');

let passedTests = 0;
let failedTests = 0;

function runTest(description, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ PASS: ${description}`);
      passedTests++;
    })
    .catch((err) => {
      console.error(`  ✗ FAIL: ${description}`);
      console.error(`    Error: ${err.message}`);
      failedTests++;
    });
}

async function runAllTests() {
  console.log('===============================================================');
  console.log(' MEDEx PHASE 9: ALERTS, NOTIFICATIONS & REAL-TIME EVENT TESTS ');
  console.log('===============================================================\n');

  const hospA = 'hosp-alpha-999';
  const hospB = 'hosp-beta-888';
  const lot1 = 'lot-p9-001';
  const lot2 = 'lot-p9-002';
  const lot3 = 'lot-p9-003';

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Core Inventory Alert Generation & Deduplication
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Inventory Alerts & Deduplication ---');

  await runTest('1. Should generate LOW_STOCK alert with stable references', async () => {
    const alert = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      title: 'Low Stock: Amoxicillin 500mg',
      message: 'Reserve is at 12 units (minimum: 30).',
      inventoryLotId: lot1,
      medicineId: 'med-amox-500',
      batchNo: 'AMX-2026-A',
      actionText: 'Inspect Lot',
    });

    assert(alert.id, 'Alert should have an ID');
    assert.strictEqual(alert.hospital_id || alert.hospitalId, hospA);
    assert.strictEqual(alert.severity, 'WARNING');
    assert.strictEqual(alert.alert_type || alert.category, 'LOW_STOCK');
    assert.strictEqual(alert.inventory_lot_id || alert.inventoryLotId, lot1);
    assert.strictEqual(alert.is_read || alert.isRead, false);
    assert(alert.link.includes('inventoryLotId=' + lot1), 'Link must include inventoryLotId');
  });

  await runTest('2. Deduplication: Creating same active LOW_STOCK alert returns existing without duplicate', async () => {
    const duplicateAttempt = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      title: 'Low Stock: Amoxicillin 500mg',
      message: 'Reserve is at 12 units (minimum: 30).',
      inventoryLotId: lot1,
      medicineId: 'med-amox-500',
      batchNo: 'AMX-2026-A',
    });

    const list = await alertService.getAlerts({ hospitalId: hospA, alertType: 'LOW_STOCK' });
    const matching = (list.items || list).filter((a) => (a.inventory_lot_id || a.inventoryLotId) === lot1 && (a.alert_type || a.category) === 'LOW_STOCK');
    assert.strictEqual(matching.length, 1, 'Only one active alert should exist for same dedup_key');
  });

  await runTest('3. Should generate EXPIRING_SOON alert (<60 days shelf life)', async () => {
    const alert = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'EXPIRING_SOON',
      severity: 'WARNING',
      title: 'Expiring Soon: Paracetamol 650mg',
      message: 'Batch PCM-99 expires in 34 days.',
      inventoryLotId: lot2,
      medicineId: 'med-pcm-650',
      batchNo: 'PCM-99',
    });

    assert.strictEqual(alert.severity, 'WARNING');
    assert.strictEqual(alert.alert_type || alert.category, 'EXPIRING_SOON');
    assert.strictEqual(alert.inventory_lot_id || alert.inventoryLotId, lot2);
  });

  await runTest('4. Should generate EXPIRED stock alert with CRITICAL severity', async () => {
    const alert = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'EXPIRED',
      severity: 'CRITICAL',
      title: 'Expired Stock Alert: Ceftriaxone 1g',
      message: 'Batch CEF-2023 expired. Immediate quarantine required.',
      inventoryLotId: lot3,
      medicineId: 'med-cef-1g',
      batchNo: 'CEF-2023',
    });

    assert.strictEqual(alert.severity, 'CRITICAL');
    assert.strictEqual(alert.alert_type || alert.category, 'EXPIRED');
    assert(alert.urgent, 'Critical alerts must be marked urgent');
  });

  await runTest('5. Dismissed alert allows new alert generation on subsequent scan', async () => {
    const alerts = await alertService.getAlerts({ hospitalId: hospA, alertType: 'EXPIRED' });
    const expiredAlert = (alerts.items || alerts).find((a) => (a.inventory_lot_id || a.inventoryLotId) === lot3);
    assert(expiredAlert, 'Expired alert should exist');

    await alertService.dismissAlert(expiredAlert.id);

    // Re-create after dismissal
    const freshAlert = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'EXPIRED',
      severity: 'CRITICAL',
      title: 'Expired Stock Alert: Ceftriaxone 1g',
      message: 'Batch CEF-2023 expired. Immediate quarantine required.',
      inventoryLotId: lot3,
    });

    assert(freshAlert.id, 'Fresh alert should be created after dismissal');
    assert.strictEqual(freshAlert.is_dismissed || freshAlert.isDismissed, false);
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Event-Driven Lifecycle Alerts (Requests, Payments, Logistics)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Event-Driven Alerts ---');

  await runTest('6. Should create authoritative alert for REQUEST_CANCELLED', async () => {
    const alert = await alertService.createRequestAlert({
      hospitalId: hospA,
      requestId: 'req-test-999',
      status: 'CANCELLED',
      medicineName: 'Azithromycin 500mg',
      reason: 'Buyer requisition was cancelled by clinical director.',
    });

    assert.strictEqual(alert.alert_type || alert.category, 'REQUEST_CANCELLED');
    assert.strictEqual(alert.request_id || alert.requestId, 'req-test-999');
    assert(alert.link.includes('req-test-999'), 'Link must reference request ID');
  });

  await runTest('7. Should create authoritative alert for PAID escrow verification', async () => {
    const alert = await alertService.createPaymentAlert({
      hospitalId: hospA,
      paymentId: 'pay-test-111',
      requestId: 'req-test-999',
      status: 'PAID',
      amount: 45000,
    });

    assert.strictEqual(alert.alert_type || alert.category, 'PAYMENT_RECEIVED');
    assert.strictEqual(alert.payment_id || alert.paymentId, 'pay-test-111');
    assert(alert.message.includes('45,000') || alert.message.includes('45000'));
  });

  await runTest('8. Should create CRITICAL alert for PAYMENT FAILED', async () => {
    const alert = await alertService.createPaymentAlert({
      hospitalId: hospA,
      paymentId: 'pay-test-222',
      requestId: 'req-test-888',
      status: 'FAILED',
      amount: 15000,
    });

    assert.strictEqual(alert.severity, 'CRITICAL');
    assert.strictEqual(alert.alert_type || alert.category, 'PAYMENT_FAILED');
  });

  await runTest('9. Should create CRITICAL alert for TRANSFER temperature breach / failure', async () => {
    const alert = await alertService.createTransferAlert({
      hospitalId: hospA,
      transferId: 'TRK-2026-001',
      status: 'FAILED',
      medicineName: 'Insulin Glargine',
      temperature: 14.5,
      issue: 'Temperature breach > 8°C logged during transit.',
    });

    assert.strictEqual(alert.severity, 'CRITICAL');
    assert.strictEqual(alert.transfer_id || alert.transferId, 'TRK-2026-001');
    assert(alert.link.includes('TRK-2026-001'), 'Link must reference transfer tracking number');
  });

  await runTest('10. Should create hospital accreditation status alerts', async () => {
    const alert = await alertService.createHospitalAlert({
      hospitalId: hospA,
      status: 'VERIFIED',
      hospitalName: 'Alpha Super Specialty',
    });

    assert.strictEqual(alert.alert_type || alert.category, 'HOSPITAL_VERIFIED');
    assert.strictEqual(alert.severity, 'INFO');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Multi-Tenant RBAC & Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Multi-Tenant RBAC Isolation ---');

  await runTest('11. Hospital A cannot see Hospital B alerts', async () => {
    // Create alert for Hospital B
    await alertService.createAlert({
      hospitalId: hospB,
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      title: 'Hospital B Secret Low Stock',
      message: 'Private inventory data',
      inventoryLotId: 'lot-secret-b',
    });

    const hospAAlerts = await alertService.getAlerts({ hospitalId: hospA });
    const leaked = (hospAAlerts.items || hospAAlerts).find((a) => a.hospital_id === hospB || a.hospitalId === hospB);
    assert(!leaked, 'Hospital A must NOT receive any alerts belonging to Hospital B');
  });

  await runTest('12. Hospital B receives its own alerts', async () => {
    const hospBAlerts = await alertService.getAlerts({ hospitalId: hospB });
    const items = hospBAlerts.items || hospBAlerts;
    assert(items.length > 0, 'Hospital B should retrieve its alerts');
    assert(items.every((a) => (a.hospital_id || a.hospitalId) === hospB), 'All items must belong to Hospital B');
  });

  await runTest('13. Admin can view alerts across all hospitals', async () => {
    const adminAlerts = await alertService.getAlerts({ isAdmin: true });
    const items = adminAlerts.items || adminAlerts;
    const hasHospA = items.some((a) => (a.hospital_id || a.hospitalId) === hospA);
    const hasHospB = items.some((a) => (a.hospital_id || a.hospitalId) === hospB);
    assert(hasHospA && hasHospB, 'Admin view must include alerts from all hospitals');
  });

  await runTest('14. Admin can filter alerts by specific hospitalId', async () => {
    const filtered = await alertService.getAlerts({ isAdmin: true, hospitalId: hospA });
    const items = filtered.items || filtered;
    assert(items.length > 0);
    assert(items.every((a) => (a.hospital_id || a.hospitalId) === hospA), 'Filtered view must strictly contain Hospital A items');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Read / Unread State Management
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Read/Unread State Management ---');

  await runTest('15. Accurately calculates unread count for a hospital', async () => {
    const unread = await alertService.getUnreadCount({ hospitalId: hospA });
    assert(typeof unread.unreadCount === 'number', 'Unread count must be a number');
    assert(unread.unreadCount > 0, 'Unread count should be > 0 before marking read');
  });

  await runTest('16. Marks single alert as read and timestamps read_at', async () => {
    const alerts = await alertService.getAlerts({ hospitalId: hospA, isRead: false });
    const target = (alerts.items || alerts)[0];
    assert(target, 'Unread alert must exist to test markRead');

    const updated = await alertService.markAlertRead(target.id, { hospitalId: hospA });
    assert.strictEqual(updated.is_read || updated.isRead, true);
    assert(updated.read_at || updated.readAt, 'read_at must be set');
  });

  await runTest('17. Unauthorized hospital cannot mark another hospital alert as read', async () => {
    const alertsB = await alertService.getAlerts({ hospitalId: hospB });
    const targetB = (alertsB.items || alertsB)[0];
    assert(targetB, 'Alert for Hospital B must exist');

    let threw = false;
    try {
      await alertService.markAlertRead(targetB.id, { hospitalId: hospA, isAdmin: false });
    } catch (err) {
      threw = true;
    }
    assert(threw, 'Should throw error when hospital attempts to mark peer hospital alert as read');
  });

  await runTest('18. Batch marks all alerts as read for current hospital', async () => {
    const result = await alertService.markAllAlertsRead({ hospitalId: hospA });
    assert(result.success, 'markAllAlertsRead must return success: true');

    const unreadAfter = await alertService.getUnreadCount({ hospitalId: hospA });
    assert.strictEqual(unreadAfter.unreadCount, 0, 'All alerts for Hospital A must now be read');

    // Hospital B unread count must be untouched
    const unreadB = await alertService.getUnreadCount({ hospitalId: hospB });
    assert(unreadB.unreadCount > 0, 'Hospital B unread alerts must not be marked by Hospital A batch operation');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: In-App Notification Service
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: In-App Notifications ---');

  await runTest('19. Should create in-app notification with entity linkage', async () => {
    const notif = await notificationService.createNotification({
      hospitalId: hospA,
      userId: 'user-hosp-alpha-admin',
      notificationType: 'ORDER_DISPATCHED',
      type: 'info',
      title: 'Consignment Dispatched',
      message: 'Requisition #REQ-2026-901 has been dispatched.',
      relatedEntityType: 'request',
      relatedEntityId: 'req-2026-901',
      link: '/hospital/requests',
    });

    assert(notif.id, 'Notification must have ID');
    assert.strictEqual(notif.hospital_id, hospA);
    assert.strictEqual(notif.related_entity_id, 'req-2026-901');
    assert.strictEqual(notif.is_read, false);
  });

  await runTest('20. Notification pagination with limit and offset', async () => {
    // Add 3 more notifications
    for (let i = 1; i <= 3; i++) {
      await notificationService.createNotification({
        hospitalId: hospA,
        title: `Test Notification ${i}`,
        message: `Message ${i}`,
      });
    }

    const page1 = await notificationService.getNotifications({ hospitalId: hospA, limit: 2, offset: 0 });
    assert.strictEqual(page1.items.length, 2, 'Page 1 must contain exactly 2 items');
    assert.strictEqual(page1.limit, 2);
    assert.strictEqual(page1.offset, 0);

    const page2 = await notificationService.getNotifications({ hospitalId: hospA, limit: 2, offset: 2 });
    assert(page2.items.length >= 1, 'Page 2 must contain next items');
    assert.notStrictEqual(page1.items[0].id, page2.items[0].id, 'Page 1 and Page 2 items must not overlap');
  });

  await runTest('21. Notification unread count and mark all read', async () => {
    const unread = await notificationService.getUnreadCount({ hospitalId: hospA });
    assert(unread.unreadCount > 0, 'Unread count should be > 0');

    await notificationService.markAllRead({ hospitalId: hospA });

    const unreadAfter = await notificationService.getUnreadCount({ hospitalId: hospA });
    assert.strictEqual(unreadAfter.unreadCount, 0, 'All notifications for Hospital A must be read');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Server-Side Inventory Scanner & Real-Time SSE
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Inventory Alert Scanner & SSE ---');

  await runTest('22. Server-side inventory scanner detects lots and returns summary', async () => {
    const scanResult = await alertService.scanInventoryAlerts(null); // System-wide scan
    assert(scanResult, 'Scanner must return result');
    assert(typeof scanResult.scannedLotsCount === 'number', 'Must report scanned lot count');
    assert(typeof scanResult.newAlertsCreatedCount === 'number', 'Must report newly created alerts');
    assert(Array.isArray(scanResult.details), 'Must include scan details array');
  });

  await runTest('23. SSE client registration and real-time event broadcasting', async () => {
    const receivedEvents = [];
    const mockRes = {
      write: (str) => {
        receivedEvents.push(str);
      },
    };

    const client = alertService.addSseClient(mockRes, { hospitalId: hospA, isAdmin: false });
    assert(client, 'SSE client registered');

    // Trigger an alert
    await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      title: 'Real-Time SSE Test Alert',
      message: 'Broadcasting live alert over SSE',
      inventoryLotId: 'lot-live-sse-01',
    });

    alertService.removeSseClient(client);

    assert(receivedEvents.length > 0, 'SSE client must have received dispatched event');
    const matched = receivedEvents.some((ev) => ev.includes('Real-Time SSE Test Alert'));
    assert(matched, 'Dispatched SSE payload must contain alert title');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Exact Deep-Linking & Missing Target Resilience
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Deep Link Integrity & Resilience ---');

  await runTest('24. Generated deep links contain exact stable IDs', async () => {
    const alert = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'EXPIRING_SOON',
      severity: 'WARNING',
      title: 'Deep Link Test',
      message: 'Test URL format',
      inventoryLotId: 'b0000001-0000-0000-0000-000000000001',
    });

    assert(alert.link, 'Alert must have deep link');
    assert(alert.link.includes('inventoryLotId=b0000001-0000-0000-0000-000000000001'), 'Deep link must match ?inventoryLotId=...');
  });

  await runTest('25. Alert metadata preserves clinical and transaction details', async () => {
    const alert = await alertService.createAlert({
      hospitalId: hospA,
      alertType: 'LOW_STOCK',
      title: 'Clinical Formulation Check',
      message: 'Paracetamol 650mg tablet check',
      inventoryLotId: 'lot-p9-meta-001',
      medicineId: 'med-01',
      batchNo: 'BATCH-XYZ',
      metadata: {
        currentQuantity: 5,
        minStockLevel: 25,
        unitMRP: 120,
      },
    });

    assert(alert.metadata, 'Alert metadata must be preserved');
    assert.strictEqual(alert.metadata.batchNo, 'BATCH-XYZ');
    assert.strictEqual(alert.metadata.currentQuantity, 5);
  });

  // Summary
  console.log('\n===============================================================');
  console.log(` TEST EXECUTION COMPLETE: ${passedTests} Passed, ${failedTests} Failed.`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
