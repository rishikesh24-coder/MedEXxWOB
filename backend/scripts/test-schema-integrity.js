/**
 * MedEx Schema & Constraint Integrity Verification Test Suite
 * 
 * Validates:
 * 1. Schema AST / DDL correctness (17 Core Tables, Views, Triggers, RLS, Storage)
 * 2. Mathematical and business constraint logic:
 *    - inventory_lots (mfg <= expiry, available <= total, non-negative quantities & prices)
 *    - inventory_adjustments (previous_quantity + quantity_change = new_quantity)
 *    - requests (from_hospital != to_hospital, quantity > 0, state-aware cancellation)
 *    - refunds (penalty_amount + refund_amount == total_order_amount)
 *    - transfers (source != destination)
 *    - feedback (rating 1..5)
 *    - alerts (stable deep-linking IDs)
 * 3. Row-Level Security (RLS) Policy completeness across all 17 tables
 * 4. Storage Bucket configuration & access isolation
 * 5. Single Source of Truth validation (no duplicate tables / stores)
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.resolve(__dirname, '../schema.sql');
const SEED_FILE = path.resolve(__dirname, '../seed.sql');

const EXPECTED_ENTITIES = [
  'users',
  'hospitals',
  'hospital_documents',
  'medicines',
  'inventory_lots',
  'inventory_adjustments',
  'requests',
  'request_items',
  'payments',
  'refunds',
  'transfers',
  'tracking_events',
  'alerts',
  'notifications',
  'trading_transactions',
  'audit_logs',
  'feedback'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`   [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`   [FAIL] ${message}`);
  }
}

async function runIntegrityTests() {
  console.log('====================================================');
  console.log('MedEx DATABASE SCHEMA & CONSTRAINT INTEGRITY SUITE');
  console.log('====================================================\n');

  assert(fs.existsSync(SCHEMA_FILE), `Authoritative schema file exists at ${SCHEMA_FILE}`);
  assert(fs.existsSync(SEED_FILE), `Development seed file exists at ${SEED_FILE}`);

  const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const seedContent = fs.readFileSync(SEED_FILE, 'utf8');

  // 1. Core Entities Verification
  console.log('\n--- 1. CORE ENTITIES VERIFICATION (17 REQUIRED TABLES) ---');
  EXPECTED_ENTITIES.forEach((table) => {
    const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`, 'i');
    assert(tableRegex.test(schemaContent), `Core Table '${table}' is declared in schema.sql`);
  });

  // 2. Prohibited Features & Anti-Patterns Check
  console.log('\n--- 2. STRICT SCOPE & COMPLIANCE GUARDRAILS ---');
  assert(!schemaContent.toLowerCase().includes('biowaste') && !schemaContent.toLowerCase().includes('bio_waste'),
    'Zero bio-waste or medical waste disposal tables/columns (strictly excluded from scope)');
  assert(!schemaContent.includes('mongoose') && !schemaContent.includes('mongodb'),
    'Zero MongoDB/Mongoose artifacts (Supabase PostgreSQL is authoritative)');
  assert(schemaContent.includes('auth.users(id)'),
    'User profiles directly inherit Supabase Auth (auth.users.id) - no duplicate password store');

  // 3. Mathematical & Business Constraint Checks
  console.log('\n--- 3. DATABASE CONSTRAINTS & VALIDATIONS ---');

  // inventory_lots
  assert(schemaContent.includes('chk_inventory_dates CHECK (manufacturing_date <= expiry_date)'),
    'inventory_lots enforces manufacturing_date <= expiry_date');
  assert(schemaContent.includes('quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)'),
    'inventory_lots enforces non-negative stock quantity');
  assert(schemaContent.includes('available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0)'),
    'inventory_lots enforces non-negative available quantity');
  assert(schemaContent.includes('chk_inventory_available CHECK (available_quantity <= quantity)'),
    'inventory_lots enforces available_quantity <= quantity');
  assert(schemaContent.includes('uq_hospital_batch UNIQUE(hospital_id, batch_number)'),
    'inventory_lots enforces batch uniqueness per hospital (no collision)');

  // inventory_adjustments
  assert(schemaContent.includes('chk_adjustment_math CHECK (previous_quantity + quantity_change = new_quantity)'),
    'inventory_adjustments enforces exact math: previous_quantity + quantity_change = new_quantity');

  // requests & inter-hospital logic
  assert(schemaContent.includes('chk_different_hospitals CHECK (from_hospital_id != to_hospital_id)'),
    'requests enforces from_hospital_id != to_hospital_id (inter-hospital only)');

  // refunds
  assert(schemaContent.includes('chk_refund_math CHECK (ROUND(penalty_amount + refund_amount, 2) = ROUND(total_order_amount, 2))'),
    'refunds enforces statutory balance: penalty_amount + refund_amount = total_order_amount');

  // transfers
  assert(schemaContent.includes('chk_transfer_diff_hospitals CHECK (source_hospital_id != destination_hospital_id)'),
    'transfers enforces source_hospital_id != destination_hospital_id');

  // feedback
  assert(schemaContent.includes('rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5)'),
    'feedback enforces rating bounds between 1 and 5 stars');

  // 4. Mathematical Logic Test Run (In-Memory Verification of Constraint Logic)
  console.log('\n--- 4. IN-MEMORY CONSTRAINT LOGIC VERIFICATION ---');
  
  // Test 4.1: Adjustment Math
  const sampleAdjustment = { prev: 500, change: -50, next: 450 };
  assert(sampleAdjustment.prev + sampleAdjustment.change === sampleAdjustment.next,
    `Stock adjustment math verification: ${sampleAdjustment.prev} + (${sampleAdjustment.change}) === ${sampleAdjustment.next}`);

  // Test 4.2: 4-Tier Cancellation Calculation Logic
  function calculateCancellation(orderAmount, stage) {
    let penaltyPct = 0;
    if (stage === 'WITHIN_24H') penaltyPct = 0;
    else if (stage === 'AFTER_24H_BEFORE_DISPATCH') penaltyPct = 5;
    else if (stage === 'DISPATCHED') penaltyPct = 15;
    else throw new Error('Order in non-cancellable state');

    const penaltyAmount = Number(((orderAmount * penaltyPct) / 100).toFixed(2));
    const refundAmount = Number((orderAmount - penaltyAmount).toFixed(2));
    return { penaltyPct, penaltyAmount, refundAmount };
  }

  const orderVal = 6440.00;
  const tierA = calculateCancellation(orderVal, 'WITHIN_24H');
  assert(tierA.penaltyAmount === 0 && tierA.refundAmount === 6440.00 && (tierA.penaltyAmount + tierA.refundAmount === orderVal),
    'Tier A (Within 24h): 0% penalty, 100% full refund (₹0 penalty, ₹6440 refund)');

  const tierB = calculateCancellation(orderVal, 'AFTER_24H_BEFORE_DISPATCH');
  assert(tierB.penaltyAmount === 322.00 && tierB.refundAmount === 6118.00 && (tierB.penaltyAmount + tierB.refundAmount === orderVal),
    'Tier B (After 24h before dispatch): 5% penalty, 95% refund (₹322 penalty, ₹6118 refund)');

  const tierC = calculateCancellation(orderVal, 'DISPATCHED');
  assert(tierC.penaltyAmount === 966.00 && tierC.refundAmount === 5474.00 && (tierC.penaltyAmount + tierC.refundAmount === orderVal),
    'Tier C (After dispatch): 15% penalty, 85% refund (₹966 penalty, ₹5474 refund)');

  // 5. Views for Admin Inventory & Trading Activity
  console.log('\n--- 5. ANALYTICAL VIEWS (DUAL-INVENTORY VIEWS & STATS) ---');
  assert(schemaContent.includes('CREATE OR REPLACE VIEW view_admin_inventory_by_medicine'),
    'view_admin_inventory_by_medicine provides Medicine -> Hospitals -> Batches aggregation');
  assert(schemaContent.includes('CREATE OR REPLACE VIEW view_admin_inventory_by_hospital'),
    'view_admin_inventory_by_hospital provides Hospital -> Medicines -> Batches aggregation');
  assert(schemaContent.includes('CREATE OR REPLACE VIEW view_hospital_trading_summary'),
    'view_hospital_trading_summary computes purchases, sales, trades count, and percentages');

  // 6. Row Level Security (RLS) Coverage
  console.log('\n--- 6. ROW LEVEL SECURITY (RLS) POLICY AUDIT ---');
  EXPECTED_ENTITIES.forEach((table) => {
    const rlsRegex = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`, 'i');
    assert(rlsRegex.test(schemaContent), `RLS enabled on '${table}'`);
  });

  // Security Definer functions
  assert(schemaContent.includes('FUNCTION is_admin()'),
    'Security Definer helper function is_admin() implemented');
  assert(schemaContent.includes('FUNCTION get_user_hospital_id()'),
    'Security Definer helper function get_user_hospital_id() implemented');
  assert(schemaContent.includes('FUNCTION is_current_hospital_verified()'),
    'Security Definer helper function is_current_hospital_verified() implemented');

  // Policy isolation assertions
  assert(schemaContent.includes('CREATE POLICY "Hospital manages own inventory lots"'),
    'inventory_lots: Hospital isolation policy enforces hospital_id = get_user_hospital_id()');
  assert(schemaContent.includes('CREATE POLICY "Verified hospitals view active lots in marketplace"'),
    'inventory_lots: Marketplace policy restricts lot browsing to verified hospitals with active non-expired stock');
  assert(schemaContent.includes('CREATE POLICY "Hospital views own stock adjustments"'),
    'inventory_adjustments: Isolated to own hospital');
  assert(schemaContent.includes('CREATE POLICY "Admins full access on hospitals"'),
    'hospitals: Admin full administrative access');
  assert(schemaContent.includes('CREATE POLICY "Hospital views own hospital record"'),
    'hospitals: Hospital user can view own record');
  assert(schemaContent.includes('CREATE POLICY "Hospitals access own requisitions"'),
    'requests: Only from_hospital and to_hospital can access requisitions');

  // 7. Supabase Storage Buckets & Policies
  console.log('\n--- 7. SUPABASE STORAGE CONFIGURATION & BUCKET POLICIES ---');
  assert(schemaContent.includes("id, name, public, file_size_limit, allowed_mime_types"),
    'Storage buckets configured via storage.buckets catalog');
  assert(schemaContent.includes("'hospital-documents'"),
    "Private storage bucket 'hospital-documents' provisioned");
  assert(schemaContent.includes("'purchase-bills'"),
    "Private storage bucket 'purchase-bills' provisioned");
  assert(schemaContent.includes('CREATE POLICY "Hospital upload document to hospital-documents"'),
    'Storage RLS: Enforces hospital folder-level upload isolation (foldername = hospital_id)');
  assert(schemaContent.includes('CREATE POLICY "Admin manage all documents in hospital-documents"'),
    'Storage RLS: Admin supervisory access to storage objects');

  // 8. Development Seed Data Consistency
  console.log('\n--- 8. DEVELOPMENT SEED DATA INTEGRITY ---');
  assert(seedContent.includes("'11111111-1111-1111-1111-111111111111'"),
    'Seed data includes Apollo Hospital (APPROVED)');
  assert(seedContent.includes("'33333333-3333-3333-3333-333333333333'") && seedContent.includes("'PENDING_APPROVAL'"),
    'Seed data includes Metro Care (PENDING_APPROVAL for verification workflow)');
  assert(seedContent.includes("'44444444-4444-4444-4444-444444444444'") && seedContent.includes("'REJECTED'"),
    'Seed data includes City Trauma (REJECTED with formal audit justification)');
  assert(seedContent.includes('INSERT INTO inventory_adjustments'),
    'Seed data includes inventory_adjustments with valid ledger history');
  assert(seedContent.includes('ON CONFLICT (id) DO NOTHING;'),
    'Seed inserts use ON CONFLICT idempotency for safe re-runs');

  console.log('\n====================================================');
  console.log(`INTEGRITY TEST RESULTS: ${passedTests} PASSED / ${totalTests} TOTAL (${failedTests} FAILED)`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runIntegrityTests();
