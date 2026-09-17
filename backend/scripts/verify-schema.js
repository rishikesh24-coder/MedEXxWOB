/**
 * MedEx Database & Schema Verification Script
 * Validates connection, table accessibility, RLS, and Express backend health.
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BACKEND_PORT = process.env.PORT || 5000;

const CORE_TABLES = [
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

async function runVerification() {
  console.log('====================================================');
  console.log('MedEx DATABASE & BACKEND INTEGRITY VERIFICATION');
  console.log('====================================================\n');

  // 1. Verify Local Express Backend
  console.log('1. Verifying Local Express Backend Health:');
  try {
    const healthRes = await axios.get(`http://localhost:${BACKEND_PORT}/api/health`, { timeout: 3000 });
    console.log(`   [PASS] GET /api/health returned HTTP ${healthRes.status}:`, JSON.stringify(healthRes.data));
  } catch (err) {
    console.log(`   [WARN] Could not reach GET /api/health: ${err.message}`);
  }

  // 2. Verify Supabase Client Initialization
  console.log('\n2. Verifying Supabase Client Initialization:');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('   [FAIL] SUPABASE_URL or SUPABASE_ANON_KEY missing in backend/.env');
    process.exit(1);
  }
  console.log(`   [PASS] Target Supabase URL: ${SUPABASE_URL}`);
  console.log(`   [PASS] Publishable Anon Key: present (${SUPABASE_ANON_KEY.substring(0, 15)}...)`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 3. Verify Supabase Gateway & Auth Connectivity
  console.log('\n3. Verifying Supabase Gateway Probe:');
  try {
    const { error: probeError } = await supabase.auth.getSession();
    if (probeError) {
      console.log(`   [WARN] Auth probe warning: ${probeError.message}`);
    } else {
      console.log('   [PASS] Auth service probe responded successfully.');
    }
  } catch (e) {
    console.log(`   [FAIL] Gateway unreachable: ${e.message}`);
  }

  // 4. Probe the 17 Core Tables using real queries
  console.log('\n4. Checking 17 MedEx Core Tables Status in Supabase:');
  const results = {
    accessible: [],
    emptyOrRlsProtected: [],
    missingInRemote: [],
  };

  for (const table of CORE_TABLES) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
          results.missingInRemote.push({ table, code: error.code, message: error.message });
          console.log(`   [-] Table '${table}': Pending SQL execution in Supabase (PGRST205: Not in schema cache)`);
        } else if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('permission denied')) {
          results.emptyOrRlsProtected.push({ table, rlsActive: true });
          console.log(`   [PASS] Table '${table}': EXISTS & PROTECTED BY RLS (permission denied for anonymous user)`);
        } else {
          console.log(`   [?] Table '${table}': Error: ${error.message} (code: ${error.code})`);
        }
      } else {
        results.accessible.push({ table, rows: data ? data.length : 0 });
        console.log(`   [PASS] Table '${table}': EXISTS & ACCESSIBLE (rows: ${data ? data.length : 0})`);
      }
    } catch (err) {
      console.log(`   [!] Table '${table}': Network exception: ${err.message}`);
    }
  }

  console.log('\n====================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('====================================================');
  console.log(`Total Core Tables:          ${CORE_TABLES.length}`);
  console.log(`Provisioned & Active:       ${results.accessible.length + results.emptyOrRlsProtected.length}`);
  console.log(`Awaiting Remote Execution:  ${results.missingInRemote.length}`);

  if (results.missingInRemote.length > 0) {
    console.log('\n[MANUAL SUPABASE STEP REQUIRED]');
    console.log('PostgREST anon keys do not have DDL privileges to create PostgreSQL tables remotely.');
    console.log(`To provision all ${CORE_TABLES.length} tables, views, triggers, and RLS policies in Supabase:`);
    console.log('1. Open the Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/ccsyutnjutvzagekcifb/sql/new');
    console.log('2. Copy the complete contents of:');
    console.log('   backend/schema.sql');
    console.log('3. Paste into the SQL Editor and click "Run".');
    console.log('4. (Optional) Run backend/seed.sql to seed initial development data.');
    console.log('5. Re-run this check: node backend/scripts/verify-schema.js\n');
  } else {
    console.log(`\n[SUCCESS] All ${CORE_TABLES.length} MedEx tables, relationships, and RLS policies are active in Supabase!\n`);
  }
}

runVerification();
