/**
 * Test RLS and Database constraints
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function testRlsSecurity() {
  console.log('Testing RLS Security Enforcement on MedEx Tables...\n');

  // Test 1: Anonymous attempt to insert hospital directly without auth
  console.log('Test 1: Unauthenticated attempt to insert into `hospitals` table:');
  const { data: hospData, error: hospError } = await supabase
    .from('hospitals')
    .insert([{
      name: 'Malicious Bypass Hospital',
      registration_no: 'HACK-001',
      authorized_person: 'Attacker',
      email: 'hacker@evil.com',
      phone: '1234567890',
      address: 'Unknown',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      status: 'APPROVED'
    }]);

  if (hospError) {
    console.log(`[PASS] RLS blocked unauthorized insert: ${hospError.message} (code: ${hospError.code})`);
  } else {
    console.log('[FAIL] RLS allowed unauthorized insert!');
  }

  // Test 2: Unauthenticated attempt to insert inventory lot
  console.log('\nTest 2: Unauthenticated attempt to insert into `inventory_lots`:');
  const { data: invData, error: invError } = await supabase
    .from('inventory_lots')
    .insert([{
      hospital_id: '11111111-1111-1111-1111-111111111111',
      medicine_name: 'Fake Med',
      generic_name: 'Fake Generic',
      category: 'General',
      dosage: '500mg',
      manufacturer: 'Fake Pharma',
      batch_number: 'FAKE-01',
      batch_no: 'FAKE-01',
      quantity: 1000,
      manufacturing_date: '2024-01-01',
      mfg_date: '2024-01-01',
      expiry_date: '2025-01-01'
    }]);

  if (invError) {
    console.log(`[PASS] RLS blocked unauthorized inventory insert: ${invError.message} (code: ${invError.code})`);
  } else {
    console.log('[FAIL] RLS allowed unauthorized inventory insert!');
  }

  // Test 3: Unauthenticated attempt to read audit logs
  console.log('\nTest 3: Unauthenticated attempt to read `audit_logs`:');
  const { data: auditData, error: auditError } = await supabase
    .from('audit_logs')
    .select('*');

  if (auditError) {
    console.log(`[PASS] RLS blocked unauthorized audit logs read: ${auditError.message}`);
  } else if (!auditData || auditData.length === 0) {
    console.log('[PASS] RLS returned 0 rows for unauthenticated read of audit logs.');
  } else {
    console.log('[FAIL] RLS exposed audit logs to unauthorized caller!');
  }

  console.log('\nRLS validation check completed successfully.');
}

testRlsSecurity();
