import {
  getRemainingShelfLife,
  getExpiryStatus,
  isExpiryAcceptable,
  getConcessionPercent,
  getConcessionAmount,
  getSellingPrice,
  getExpiryPricing,
  DAYS_PER_MONTH
} from '../src/config/nearExpiryPolicy.js';

console.log('=== RUNNING NEAR-EXPIRY CONCESSION POLICY TESTS ===\n');

const refDate = '2026-09-18';
const refTime = new Date('2026-09-18T00:00:00.000Z').getTime();

// Helper to make date with exact day offset from refDate
function dateOffsetDays(days) {
  const d = new Date(refTime + days * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

const boundaryCases = [
  { name: 'expired (-5 days)', days: -5, expectedAcceptable: false, expectedPct: 0 },
  { name: 'expired (today / 0 days)', days: 0, expectedAcceptable: false, expectedPct: 0 },
  { name: '20 days remaining', days: 20, expectedAcceptable: false, expectedPct: 0 },
  { name: 'exactly 1 month (30 days)', days: 30, expectedAcceptable: false, expectedPct: 0 },
  { name: 'just over 1 month (31 days)', days: 31, expectedAcceptable: true, expectedPct: 30 },
  { name: '1.5 months (45 days)', days: 45, expectedAcceptable: true, expectedPct: 30 },
  { name: 'exactly 2 months (60 days)', days: 60, expectedAcceptable: true, expectedPct: 30 },
  { name: 'just over 2 months (61 days)', days: 61, expectedAcceptable: true, expectedPct: 20 },
  { name: '2.5 months (75 days)', days: 75, expectedAcceptable: true, expectedPct: 20 },
  { name: 'exactly 3 months (90 days)', days: 90, expectedAcceptable: true, expectedPct: 20 },
  { name: '3.5 months (105 days)', days: 105, expectedAcceptable: true, expectedPct: 15 },
  { name: 'exactly 4 months (120 days)', days: 120, expectedAcceptable: true, expectedPct: 15 },
  { name: '4.5 months (135 days)', days: 135, expectedAcceptable: true, expectedPct: 10 },
  { name: 'exactly 5 months (150 days)', days: 150, expectedAcceptable: true, expectedPct: 10 },
  { name: '5.5 months (165 days)', days: 165, expectedAcceptable: true, expectedPct: 5 },
  { name: 'exactly 6 months (180 days)', days: 180, expectedAcceptable: true, expectedPct: 5 },
  { name: 'greater than 6 months (181 days)', days: 181, expectedAcceptable: true, expectedPct: 0 },
  { name: 'greater than 6 months (240 days)', days: 240, expectedAcceptable: true, expectedPct: 0 },
];

let failed = 0;

console.log('--- 1. Boundary Cases Verification ---');
boundaryCases.forEach((tc) => {
  const expDate = dateOffsetDays(tc.days);
  const pricing = getExpiryPricing(expDate, 100, refDate);
  const acceptable = isExpiryAcceptable(expDate, refDate);
  const pct = getConcessionPercent(expDate, refDate);

  const passAcceptable = (acceptable === tc.expectedAcceptable) && (pricing.acceptable === tc.expectedAcceptable);
  const passPct = (pct === tc.expectedPct) && (pricing.concessionPercent === tc.expectedPct);

  if (passAcceptable && passPct) {
    console.log(`✓ PASS: ${tc.name} -> acceptable: ${acceptable}, concession: ${pct}%, status: ${pricing.expiryStatus}`);
  } else {
    console.error(`✗ FAIL: ${tc.name} -> expected acceptable: ${tc.expectedAcceptable} (got ${acceptable}), expected pct: ${tc.expectedPct} (got ${pct})`);
    failed++;
  }
});

console.log('\n--- 2. Price Calculations at MRP ₹100 ---');
const priceTests = [
  { days: 200, expectedPrice: 100, expectedDiscount: 0, pct: 0 },
  { days: 165, expectedPrice: 95, expectedDiscount: 5, pct: 5 },
  { days: 135, expectedPrice: 90, expectedDiscount: 10, pct: 10 },
  { days: 105, expectedPrice: 85, expectedDiscount: 15, pct: 15 },
  { days: 75, expectedPrice: 80, expectedDiscount: 20, pct: 20 },
  { days: 45, expectedPrice: 70, expectedDiscount: 30, pct: 30 },
];

priceTests.forEach((pt) => {
  const expDate = dateOffsetDays(pt.days);
  const discountAmt = getConcessionAmount(100, expDate, refDate);
  const sellingPrice = getSellingPrice(100, expDate, refDate);
  const pricing = getExpiryPricing(expDate, 100, refDate);

  const pass = (discountAmt === pt.expectedDiscount) && (sellingPrice === pt.expectedPrice) && (pricing.sellingPricePerUnit === pt.expectedPrice);
  if (pass) {
    console.log(`✓ PASS: ${pt.pct}% Concession -> Discount: ₹${discountAmt}, Selling Price: ₹${sellingPrice}`);
  } else {
    console.error(`✗ FAIL: ${pt.pct}% Concession -> Expected price ₹${pt.expectedPrice}, got ₹${sellingPrice}`);
    failed++;
  }
});

console.log('\n--- 3. Quantity Multiplier & Rounding Tests (MRP ₹100, Qty 10, Concession 20%) ---');
const exp20pct = dateOffsetDays(75);
const pricing10 = getExpiryPricing(exp20pct, 100, refDate, 10);

const qPass = pricing10.totalMRP === 1000 &&
              pricing10.totalConcession === 200 &&
              pricing10.finalSellingPrice === 800;

if (qPass) {
  console.log(`✓ PASS: Total MRP: ₹${pricing10.totalMRP}, Total Concession: ₹${pricing10.totalConcession}, Final Selling Price: ₹${pricing10.finalSellingPrice}`);
} else {
  console.error(`✗ FAIL: Qty pricing mismatch:`, pricing10);
  failed++;
}

console.log('\n--- 4. Decimal Rounding Check (MRP ₹149.50, Concession 15%, Qty 3) ---');
const exp15pct = dateOffsetDays(105);
const decimalPricing = getExpiryPricing(exp15pct, 149.50, refDate, 3);
// 149.50 * 0.15 = 22.425 -> 22.43
// selling = 149.50 - 22.43 = 127.07
// totalMRP = 149.50 * 3 = 448.50
// totalConcession = 22.43 * 3 = 67.29
// finalSelling = 127.07 * 3 = 381.21
console.log(`concessionAmountPerUnit: ₹${decimalPricing.concessionAmountPerUnit} (expected 22.43)`);
console.log(`sellingPricePerUnit: ₹${decimalPricing.sellingPricePerUnit} (expected 127.07)`);
console.log(`totalMRP: ₹${decimalPricing.totalMRP} (expected 448.5)`);
console.log(`totalConcession: ₹${decimalPricing.totalConcession} (expected 67.29)`);
console.log(`finalSellingPrice: ₹${decimalPricing.finalSellingPrice} (expected 381.21)`);

if (decimalPricing.concessionAmountPerUnit === 22.43 && decimalPricing.sellingPricePerUnit === 127.07 && decimalPricing.finalSellingPrice === 381.21) {
  console.log('✓ PASS: Decimal rounding strictly preserves 2 decimal places without drift.');
} else {
  console.error('✗ FAIL: Decimal rounding mismatch.');
  failed++;
}

console.log(`\nTEST SUMMARY: ${failed === 0 ? 'ALL TESTS PASSED (0 failures)' : `${failed} TESTS FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
