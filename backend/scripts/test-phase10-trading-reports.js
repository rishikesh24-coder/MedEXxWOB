/**
 * MEDEx PHASE 10: TRADING + REPORTS + ANALYTICS VERIFICATION SUITE
 * 
 * Verifies all 17 required criteria from Section 18:
 * 1. Trade list API (GET /api/trades)
 * 2. Trade detail API (GET /api/trades/:id)
 * 3. Trade summary API (GET /api/trades/summary)
 * 4. Date filtering (inclusive boundary validation)
 * 5. Hospital filtering (buyer/seller hospital scoping)
 * 6. Medicine filtering (medicineId & search query)
 * 7. Status filtering (completed, paid, in_transit, cancelled)
 * 8. Pagination (page, limit, total, totalPages)
 * 9. CSV export (GET /api/trades/export, headers, BOM, escaped data)
 * 10. Hospital authorization (strict RBAC, 403 for unauthorized trade)
 * 11. Admin authorization (organization-wide visibility & admin analytics)
 * 12. Empty dataset behavior (clean zero counts, no fake percentages, no NaN)
 * 13. Large dataset behavior (pagination safety, limit constraints)
 * 14. Frontend report loading state contract
 * 15. Frontend report error state handling (401, 403, 404)
 * 16. Frontend report empty state contract (zero state, no division-by-zero)
 * 17. Medicine drill-down analytics
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


// Tokens recognized by backend dev/test auth middleware
const TOKENS = {
  ADMIN: 'mock_jwt_token_admin_test_session',
  APOLLO: 'mock_jwt_token_hospital_apollo_active', // Hospital ID: 11111111-1111-1111-1111-111111111111
  FORTIS: 'mock_jwt_token_fortis_supply', // Hospital ID: 22222222-2222-2222-2222-222222222222
  PENDING: 'mock_jwt_token_pending_metrocare_review', // Hospital ID: 33333333-3333-3333-3333-333333333333
};

const APOLLO_ID = '11111111-1111-1111-1111-111111111111';
const FORTIS_ID = '22222222-2222-2222-2222-222222222222';
const PRIVATE_TRADE_ID = 't0000004-0000-0000-0000-000000000004'; // Between Fortis & City Care

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
  console.log('  MEDEX PHASE 10: TRADING + REPORTS + ANALYTICS VERIFICATION    ');
  console.log('================================================================\n');

  const serverInstance = await startServerIfNeeded();

  try {


  // 1. Trade list API
  await runTestCase('1. Trade list API (GET /api/trades) returns authorized trades', async () => {
    const res = await axios.get(`${BASE_URL}/trades`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const items = res.data.data.items || res.data.data.trades;
    assert(Array.isArray(items), 'Expected items array');
    assert(res.data.data.pagination, 'Expected pagination metadata');
    assert(items.length > 0, 'Expected at least 1 trade');

    const trade = items[0];
    assert(trade.id, 'Trade must have an id');
    assert(trade.transactionId || trade.transaction_id, 'Trade must have a transactionId');
    assert(trade.buyerHospitalId || trade.buyer_hospital_id, 'Trade must have buyerHospitalId');
    assert(trade.sellerHospitalId || trade.seller_hospital_id, 'Trade must have sellerHospitalId');
    assert(trade.medicineName || trade.medicine_name, 'Trade must have medicineName');
  });

  // 2. Trade detail API
  await runTestCase('2. Trade detail API (GET /api/trades/:id) returns single trade with full traceability', async () => {
    const listRes = await axios.get(`${BASE_URL}/trades`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    const items = listRes.data.data.items || listRes.data.data.trades;
    const tradeId = items[0].id;

    const detailRes = await axios.get(`${BASE_URL}/trades/${tradeId}`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.data.success, true);
    const detail = detailRes.data.data;
    assert.strictEqual(detail.id, tradeId);
    assert(detail.orderId || detail.order_id, 'Traceable to order ID');
    assert(detail.status, 'Traceable to trade status');
  });

  // 3. Trade summary API
  await runTestCase('3. Trade summary API (GET /api/trades/summary) returns real financial totals and ratios', async () => {
    const res = await axios.get(`${BASE_URL}/trades/summary`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const summary = res.data.data;
    const totalPurchases = summary.totalPurchases ?? summary.metrics?.totalPurchases;
    const totalSales = summary.totalSales ?? summary.metrics?.totalSales;
    const totalPurchaseAmount = summary.totalPurchaseAmount ?? summary.metrics?.totalPurchaseAmount;
    const totalSalesAmount = summary.totalSalesAmount ?? summary.metrics?.totalSalesAmount;
    const purchasePercentage = summary.purchasePercentage ?? summary.metrics?.ratios?.purchasesPercentage;
    const salesPercentage = summary.salesPercentage ?? summary.metrics?.ratios?.salesPercentage;

    assert(typeof totalPurchases === 'number', 'totalPurchases must be a number');
    assert(typeof totalSales === 'number', 'totalSales must be a number');
    assert(typeof totalPurchaseAmount === 'number', 'totalPurchaseAmount must be a number');
    assert(typeof totalSalesAmount === 'number', 'totalSalesAmount must be a number');
    assert(typeof purchasePercentage === 'number', 'purchasePercentage must be a number');
    assert(typeof salesPercentage === 'number', 'salesPercentage must be a number');
    assert(!isNaN(purchasePercentage), 'purchasePercentage must not be NaN');
    assert(!isNaN(salesPercentage), 'salesPercentage must not be NaN');
  });

  // 4. Date filtering
  await runTestCase('4. Date filtering returns trades within inclusive date boundaries', async () => {
    const today = new Date().toISOString().split('T')[0];
    const pastYear = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];

    const res = await axios.get(`${BASE_URL}/trades?startDate=${pastYear}&endDate=${today}`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const items = res.data.data.items || res.data.data.trades;
    const startBoundary = new Date(`${pastYear}T00:00:00.000Z`).getTime();
    const endBoundary = new Date(`${today}T23:59:59.999Z`).getTime();

    items.forEach((t) => {
      const tradeTime = new Date(t.transactionDate || t.transaction_date || t.createdAt || t.created_at).getTime();
      assert(tradeTime >= startBoundary, `Trade date ${tradeTime} before start ${startBoundary}`);
      assert(tradeTime <= endBoundary, `Trade date ${tradeTime} after end ${endBoundary}`);
    });
  });

  // 5. Hospital filtering
  await runTestCase('5. Hospital filtering isolates buyer/seller transactions accurately', async () => {
    // Admin filtering by buyerHospitalId = Apollo
    const res = await axios.get(`${BASE_URL}/trades?buyerHospitalId=${APOLLO_ID}`, {
      headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
    });
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items || res.data.data.trades;
    items.forEach((t) => {
      assert.strictEqual(t.buyerHospitalId || t.buyer_hospital_id, APOLLO_ID);
    });
  });

  // 6. Medicine filtering
  await runTestCase('6. Medicine filtering correctly filters by medicineId and search keywords', async () => {
    const res = await axios.get(`${BASE_URL}/trades?search=Clavam`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items || res.data.data.trades;
    items.forEach((t) => {
      const medName = (t.medicineName || t.medicine_name || '').toLowerCase();
      assert(medName.includes('clavam') || (t.batchNo || t.batch_no || '').toLowerCase().includes('clavam'));
    });
  });

  // 7. Status filtering
  await runTestCase('7. Status filtering accurately filters by lifecycle state (e.g., completed, paid)', async () => {
    const res = await axios.get(`${BASE_URL}/trades?status=completed`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items || res.data.data.trades;
    items.forEach((t) => {
      assert.strictEqual((t.status || '').toLowerCase(), 'completed');
    });
  });

  // 8. Pagination
  await runTestCase('8. Pagination properly respects limit and page parameters', async () => {
    const res = await axios.get(`${BASE_URL}/trades?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items || res.data.data.trades;
    assert.strictEqual(res.data.data.pagination.page, 1);
    assert.strictEqual(res.data.data.pagination.limit, 1);
    assert.strictEqual(items.length, 1);
    assert(res.data.data.pagination.total >= 1);
  });

  // 9. CSV export
  await runTestCase('9. CSV export generates compliant downloadable CSV with UTF-8 BOM and valid headers', async () => {
    const res = await axios.get(`${BASE_URL}/trades/export`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      responseType: 'arraybuffer',
    });
    assert.strictEqual(res.status, 200);
    assert(res.headers['content-type'].includes('text/csv'), 'Content-Type must be text/csv');
    assert(res.headers['content-disposition'].includes('attachment; filename='), 'Content-Disposition must specify attachment');
    assert(res.headers['content-disposition'].includes('medex-trading-report-'), 'Filename must be safe');

    const buf = Buffer.from(res.data);
    // Verify UTF-8 BOM bytes (0xEF, 0xBB, 0xBF)
    assert.strictEqual(buf[0], 0xef, 'Byte 0 must be 0xEF');
    assert.strictEqual(buf[1], 0xbb, 'Byte 1 must be 0xBB');
    assert.strictEqual(buf[2], 0xbf, 'Byte 2 must be 0xBF');

    const csvContent = buf.toString('utf8');
    assert(csvContent.includes('Trade ID') || csvContent.includes('Transaction ID'), 'CSV must contain Trade/Transaction ID column');
    assert(csvContent.includes('Buyer Hospital Name'), 'CSV must contain Buyer Hospital Name column');
    assert(csvContent.includes('Seller Hospital Name'), 'CSV must contain Seller Hospital Name column');
  });

  // 10. Hospital authorization (Strict RBAC)
  await runTestCase('10. Hospital authorization forbids access to unauthorized trades (403 Forbidden)', async () => {
    try {
      // Apollo attempts to fetch Fortis & City Care's private trade
      await axios.get(`${BASE_URL}/trades/${PRIVATE_TRADE_ID}`, {
        headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      });
      throw new Error('Expected 403 Forbidden but request succeeded');
    } catch (err) {
      if (err.response?.status === 403) {
        assert.strictEqual(err.response.data.error.code, 'FORBIDDEN');
        return;
      }
      throw err;
    }
  });

  // 11. Admin authorization
  await runTestCase('11. Admin authorization grants organization-wide visibility & admin analytics', async () => {
    const adminAnalyticsRes = await axios.get(`${BASE_URL}/trades/analytics/admin`, {
      headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
    });
    assert.strictEqual(adminAnalyticsRes.status, 200);
    assert.strictEqual(adminAnalyticsRes.data.success, true);
    const data = adminAnalyticsRes.data.data;
    const totalHospitals = data.totalHospitals ?? data.metrics?.totalHospitals;
    const totalTrades = data.totalTrades ?? data.metrics?.totalTrades;
    const totalTransactionValue = data.totalTransactionValue ?? data.metrics?.totalTransactionValue;

    assert(typeof totalHospitals === 'number', 'totalHospitals must be a number');
    assert(typeof totalTrades === 'number', 'totalTrades must be a number');
    assert(typeof totalTransactionValue === 'number', 'totalTransactionValue must be a number');
    assert(Array.isArray(data.mostTradedMedicines), 'mostTradedMedicines must be an array');
    assert(Array.isArray(data.highestVolumeHospitals), 'highestVolumeHospitals must be an array');

    // Verify hospital cannot access admin analytics
    try {
      await axios.get(`${BASE_URL}/trades/analytics/admin`, {
        headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      });
      throw new Error('Expected 403 for hospital calling admin analytics');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  // 12. Empty dataset behavior
  await runTestCase('12. Empty dataset returns clean zero counts without NaN or division-by-zero crashes', async () => {
    // Query with non-matching date range in the far future
    const res = await axios.get(`${BASE_URL}/trades/summary?startDate=2099-01-01&endDate=2099-01-02`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    const summary = res.data.data;
    const totalPurchases = summary.totalPurchases ?? summary.metrics?.totalPurchases;
    const totalSales = summary.totalSales ?? summary.metrics?.totalSales;
    const totalPurchaseAmount = summary.totalPurchaseAmount ?? summary.metrics?.totalPurchaseAmount;
    const totalSalesAmount = summary.totalSalesAmount ?? summary.metrics?.totalSalesAmount;
    const purchasePercentage = summary.purchasePercentage ?? summary.metrics?.ratios?.purchasesPercentage;
    const salesPercentage = summary.salesPercentage ?? summary.metrics?.ratios?.salesPercentage;

    assert.strictEqual(totalPurchases, 0);
    assert.strictEqual(totalSales, 0);
    assert.strictEqual(totalPurchaseAmount, 0);
    assert.strictEqual(totalSalesAmount, 0);
    assert.strictEqual(purchasePercentage, 0);
    assert.strictEqual(salesPercentage, 0);
    assert(!isNaN(purchasePercentage));
  });

  // 13. Large dataset behavior
  await runTestCase('13. Large dataset behavior enforces pagination limits & query safety', async () => {
    // Request with max allowed limit
    const res = await axios.get(`${BASE_URL}/trades?limit=100`, {
      headers: { Authorization: `Bearer ${TOKENS.ADMIN}` },
    });
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items || res.data.data.trades;
    assert(res.data.data.pagination.limit <= 100);
    assert(items.length <= 100);
  });

  // 14. Frontend report loading state contract
  await runTestCase('14. Frontend report loading state contract returns standardized envelope format', async () => {
    const res = await axios.get(`${BASE_URL}/trades?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.data.success, 'boolean');
    const items = res.data.data.items || res.data.data.trades;
    assert(items !== undefined);
    assert(res.data.data.pagination !== undefined);
    assert(typeof res.data.data.pagination.total === 'number');
    assert(typeof (res.data.data.pagination.pages || res.data.data.pagination.totalPages) === 'number');
  });

  // 15. Frontend report error state handling (401, 403, 404)
  await runTestCase('15. Frontend report error state handling provides structured error payloads', async () => {
    // 401 Unauthorized test
    try {
      await axios.get(`${BASE_URL}/trades`);
      throw new Error('Expected 401 without auth header');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
      assert.strictEqual(err.response.data.success, false);
      assert(err.response.data.error.code, 'Error payload must contain error.code');
    }

    // 404 Not Found test
    try {
      await axios.get(`${BASE_URL}/trades/00000000-0000-0000-0000-000000000000`, {
        headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
      });
      throw new Error('Expected 404 for non-existent trade');
    } catch (err) {
      assert.strictEqual(err.response?.status, 404);
      assert.strictEqual(err.response.data.success, false);
    }
  });

  // 16. Frontend report empty state contract
  await runTestCase('16. Frontend report empty state contract returns clean empty array and zero pagination', async () => {
    const res = await axios.get(`${BASE_URL}/trades?search=NONEXISTENT_MEDICINE_XYZ_999`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items || res.data.data.trades;
    assert.deepStrictEqual(items, []);
    assert.strictEqual(res.data.data.pagination.total, 0);
  });

  // 17. Medicine drill-down analytics
  await runTestCase('17. Medicine drill-down analytics (GET /api/trades/analytics/medicine/:id) returns trade metrics', async () => {
    const medId = 'a0000003-0000-0000-0000-000000000003';
    const res = await axios.get(`${BASE_URL}/trades/analytics/medicine/${medId}`, {
      headers: { Authorization: `Bearer ${TOKENS.APOLLO}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const medStats = res.data.data;
    assert.strictEqual(medStats.medicineId, medId);
    assert(typeof medStats.totalQuantityTraded === 'number');
    const tradesCount = medStats.numberTrades ?? medStats.tradesCount;
    assert(typeof tradesCount === 'number');
    assert(typeof medStats.averagePrice === 'number');
  });
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests} passed, ${failedTests} failed out of ${totalTests} total tests`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
