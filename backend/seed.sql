-- ====================================================================
-- MedEx — Inter-Hospital Medicine Exchange & Healthcare Logistics
-- DEVELOPMENT-ONLY SEED DATA (Supabase PostgreSQL)
-- 
-- NOTE: This file is strictly for local and staging development environments.
-- Do not run in production. All credentials, tokens, and keys are demo mock data.
-- ====================================================================

-- 1. SEED HOSPITALS (Covering all workflow states: APPROVED, PENDING_APPROVAL, REJECTED)
INSERT INTO hospitals (
  id, name, registration_no, authorized_person, email, phone, address, city, state, pincode, status, rejection_reason, registered_date, verified_date
) VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  'Apollo Hospital & Multi-Specialty Centre',
  'REG-DL-2023-0891',
  'Dr. Rajeshwar Rao, Medical Superintendent',
  'procurement@apollo-demo.org',
  '+91 11 2692 5858',
  'Sarita Vihar, Delhi Mathura Road',
  'New Delhi',
  'Delhi',
  '110076',
  'APPROVED',
  NULL,
  '2024-01-15',
  '2024-01-18'
),
(
  '22222222-2222-2222-2222-222222222222',
  'Fortis Memorial Research Institute',
  'REG-HR-2023-1044',
  'Dr. Ananya Deshmukh, Chief Pharmacist',
  'pharmacy@fortis-demo.org',
  '+91 124 4962200',
  'Sector 44, Opposite HUDA City Centre',
  'Gurugram',
  'Haryana',
  '122002',
  'APPROVED',
  NULL,
  '2024-02-10',
  '2024-02-14'
),
(
  '33333333-3333-3333-3333-333333333333',
  'Metro Care Daycare & Community Clinic',
  'REG-UP-2024-5512',
  'Dr. Sunil K. Verma, Director',
  'admin@metrocare-demo.org',
  '+91 120 4567890',
  'B-14 Sector 62, Institutional Area',
  'Noida',
  'Uttar Pradesh',
  '201309',
  'PENDING_APPROVAL',
  NULL,
  CURRENT_DATE - 3,
  NULL
),
(
  '44444444-4444-4444-4444-444444444444',
  'City Trauma & Emergency Centre',
  'REG-RJ-2024-9901',
  'Ramesh Chandra Sharma, Liaison Officer',
  'liaison@citytrauma-demo.org',
  '+91 141 2789012',
  'M.I. Road, Near Government Dispensary',
  'Jaipur',
  'Rajasthan',
  '302001',
  'REJECTED',
  'Drug License Form 20B/21B expired and NABH compliance document unverified.',
  CURRENT_DATE - 14,
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- 2. SEED HOSPITAL COMPLIANCE DOCUMENTS
INSERT INTO hospital_documents (
  id, hospital_id, document_type, document_name, storage_path, file_path, file_size, submission_status, document_status, verification_status, uploaded_by
) VALUES
(
  'd1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Drug License (Form 20B/21B)',
  'Apollo_Drug_License_20B_21B.pdf',
  '11111111-1111-1111-1111-111111111111/Apollo_Drug_License_20B_21B.pdf',
  '/uploads/demo/Apollo_Drug_License.pdf',
  '3.2 MB',
  'verified',
  'approved',
  'verified',
  'Dr. Rajeshwar Rao'
),
(
  'd2222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'NABH Accreditation Certificate',
  'Fortis_NABH_Accreditation_Certificate.pdf',
  '22222222-2222-2222-2222-222222222222/Fortis_NABH_Accreditation.pdf',
  '/uploads/demo/Fortis_NABH.pdf',
  '1.8 MB',
  'verified',
  'approved',
  'verified',
  'Dr. Ananya Deshmukh'
),
(
  'd3333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'Clinical Establishment Act Certificate',
  'MetroCare_CEA_Certificate.pdf',
  '33333333-3333-3333-3333-333333333333/MetroCare_CEA_Certificate.pdf',
  '/uploads/demo/MetroCare_CEA.pdf',
  '2.4 MB',
  'submitted',
  'pending',
  'pending',
  'Dr. Sunil K. Verma'
)
ON CONFLICT (id) DO NOTHING;

-- 3. SEED MASTER MEDICINES (Formulations distinguished by composition, strength, dosage form, route)
INSERT INTO medicines (
  id, code, brand_name, generic_name, composition, strength, dosage_form, route, manufacturer, category, packing, unit, units_per_pack, shelf_life_months, canonical_composition_key
) VALUES
(
  'a0000001-0000-0000-0000-000000000001',
  'MED-AMOX-625',
  'Augmentin 625 Duo',
  'Amoxicillin + Clavulanic Acid',
  'Amoxicillin 500mg + Clavulanic Acid 125mg',
  '625mg',
  'Tablet',
  'Oral',
  'GlaxoSmithKline Pharmaceuticals Ltd.',
  'Antibiotics & Anti-Infectives',
  '10 Tablets / Strip',
  'Tablet',
  10,
  24,
  'amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral'
),
(
  'a0000002-0000-0000-0000-000000000002',
  'MED-AMOX-375',
  'Augmentin 375mg',
  'Amoxicillin + Clavulanic Acid',
  'Amoxicillin 250mg + Clavulanic Acid 125mg',
  '375mg',
  'Tablet',
  'Oral',
  'GlaxoSmithKline Pharmaceuticals Ltd.',
  'Antibiotics & Anti-Infectives',
  '10 Tablets / Strip',
  'Tablet',
  10,
  24,
  'amoxicillin:250:mg+clavulanic acid:125:mg|Tablet|Oral'
),
(
  'a0000003-0000-0000-0000-000000000003',
  'MED-CLAVAM-625',
  'Clavam 625',
  'Amoxicillin + Clavulanic Acid',
  'Amoxicillin 500mg + Clavulanic Acid 125mg',
  '625mg',
  'Tablet',
  'Oral',
  'Alkem Laboratories Ltd.',
  'Antibiotics & Anti-Infectives',
  '10 Tablets / Strip',
  'Tablet',
  10,
  24,
  'amoxicillin:500:mg+clavulanic acid:125:mg|Tablet|Oral'
),
(
  'a0000004-0000-0000-0000-000000000004',
  'MED-PARA-500',
  'Dolo 500',
  'Paracetamol',
  'Paracetamol 500mg',
  '500mg',
  'Tablet',
  'Oral',
  'Micro Labs Ltd.',
  'Analgesics & Antipyretics',
  '15 Tablets / Strip',
  'Tablet',
  15,
  36,
  'paracetamol:500:mg|Tablet|Oral'
),
(
  'a0000005-0000-0000-0000-000000000005',
  'MED-PARA-650',
  'Dolo 650',
  'Paracetamol',
  'Paracetamol 650mg',
  '650mg',
  'Tablet',
  'Oral',
  'Micro Labs Ltd.',
  'Analgesics & Antipyretics',
  '15 Tablets / Strip',
  'Tablet',
  15,
  36,
  'paracetamol:650:mg|Tablet|Oral'
),
(
  'a0000006-0000-0000-0000-000000000006',
  'MED-MERO-1000',
  'Meronem 1g IV',
  'Meropenem',
  'Meropenem Trihydrate 1000mg',
  '1g',
  'Injection',
  'Intravenous',
  'Pfizer India Ltd.',
  'Critical Care & Antibiotics',
  '1 Vial with Diluent',
  'Vial',
  1,
  24,
  'meropenem:1000:mg|Injection|Intravenous'
),
(
  'a0000007-0000-0000-0000-000000000007',
  'MED-PANTO-40',
  'Pan 40',
  'Pantoprazole',
  'Pantoprazole Sodium 40mg',
  '40mg',
  'Tablet',
  'Oral',
  'Alkem Laboratories Ltd.',
  'Gastrointestinal',
  '15 Tablets / Strip',
  'Tablet',
  15,
  24,
  'pantoprazole:40:mg|Tablet|Oral'
),
(
  'a0000008-0000-0000-0000-000000000008',
  'MED-ATORV-20',
  'Atorva 20',
  'Atorvastatin',
  'Atorvastatin Calcium 20mg',
  '20mg',
  'Tablet',
  'Oral',
  'Zydus Healthcare',
  'Cardiovascular',
  '15 Tablets / Strip',
  'Tablet',
  15,
  36,
  'atorvastatin:20:mg|Tablet|Oral'
)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED INVENTORY LOTS (Hospital -> Medicine -> Batch/Lot)
INSERT INTO inventory_lots (
  id, hospital_id, medicine_id, medicine_name, generic_name, category, dosage_form, dosage, strength,
  manufacturer, batch_number, batch_no, quantity, total_quantity, reserved_quantity, available_quantity,
  minimum_stock, min_stock_level, reorder_level, manufacturing_date, mfg_date, expiry_date, unit_price, mrp,
  concession_rate, concession_percent, cost_rate, status
) VALUES
(
  'b0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'a0000001-0000-0000-0000-000000000001',
  'Augmentin 625 Duo',
  'Amoxicillin + Clavulanic Acid',
  'Antibiotics & Anti-Infectives',
  'Tablet',
  '625mg Tablets',
  '625mg',
  'GlaxoSmithKline Pharmaceuticals Ltd.',
  'AUG-24-0981',
  'AUG-24-0981',
  450,
  450,
  0,
  450,
  50,
  50,
  50,
  CURRENT_DATE - 180,
  CURRENT_DATE - 180,
  CURRENT_DATE + 185,
  160.00,
  200.00,
  140.00,
  12.50,
  130.00,
  'active'
),
(
  'b0000002-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'a0000006-0000-0000-0000-000000000006',
  'Meronem 1g IV',
  'Meropenem',
  'Critical Care & Antibiotics',
  'Injection',
  '1g Injection (IV)',
  '1g',
  'Pfizer India Ltd.',
  'MER-24-1102',
  'MER-24-1102',
  120,
  120,
  20,
  100,
  20,
  20,
  25,
  CURRENT_DATE - 120,
  CURRENT_DATE - 120,
  CURRENT_DATE + 240,
  1850.00,
  2450.00,
  1650.00,
  10.81,
  1550.00,
  'active'
),
(
  'b0000003-0000-0000-0000-000000000003',
  '22222222-2222-2222-2222-222222222222',
  'a0000003-0000-0000-0000-000000000003',
  'Clavam 625',
  'Amoxicillin + Clavulanic Acid',
  'Antibiotics & Anti-Infectives',
  'Tablet',
  '625mg Tablets',
  '625mg',
  'Alkem Laboratories Ltd.',
  'CLV-23-8874',
  'CLV-23-8874',
  300,
  300,
  0,
  300,
  40,
  40,
  40,
  CURRENT_DATE - 300,
  CURRENT_DATE - 300,
  CURRENT_DATE + 65, -- Near-expiry concession
  150.00,
  195.00,
  115.00,
  23.33,
  110.00,
  'active'
),
(
  'b0000004-0000-0000-0000-000000000004',
  '22222222-2222-2222-2222-222222222222',
  'a0000005-0000-0000-0000-000000000005',
  'Dolo 650',
  'Paracetamol',
  'Analgesics & Antipyretics',
  'Tablet',
  '650mg Tablets',
  '650mg',
  'Micro Labs Ltd.',
  'DL-650-9921',
  'DL-650-9921',
  800,
  800,
  0,
  800,
  100,
  100,
  100,
  CURRENT_DATE - 90,
  CURRENT_DATE - 90,
  CURRENT_DATE + 640,
  28.00,
  34.00,
  25.00,
  10.71,
  22.00,
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- 5. SEED INVENTORY ADJUSTMENTS (Stock History & Ledger Auditability)
INSERT INTO inventory_adjustments (
  id, inventory_lot_id, hospital_id, previous_quantity, quantity_change, new_quantity,
  reason, action_type, adjusted_by_name, timestamp
) VALUES
(
  'adj00001-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  500,
  -50,
  450,
  'Monthly physical verification stock reconciliation - damage during storage',
  'STOCK_RECONCILIATION',
  'Dr. Rajeshwar Rao',
  NOW() - INTERVAL '5 days'
),
(
  'adj00002-0000-0000-0000-000000000002',
  'b0000002-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  100,
  20,
  120,
  'Emergency receipt from central distributor',
  'RESTOCK',
  'Dr. Rajeshwar Rao',
  NOW() - INTERVAL '2 days'
),
(
  'adj00003-0000-0000-0000-000000000003',
  'b0000003-0000-0000-0000-000000000003',
  '22222222-2222-2222-2222-222222222222',
  350,
  -50,
  300,
  'Reserved for inter-hospital requisition REQ-2024-8841',
  'REQUISITION_RESERVATION',
  'Dr. Ananya Deshmukh',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- 6. SEED SAMPLE REQUISITION (Requests & Request Items)
INSERT INTO requests (
  id, transaction_id, order_id, from_hospital_id, from_hospital_name, to_hospital_id, to_hospital_name,
  inventory_lot_id, medicine_name, generic_name, batch_no, quantity, unit_final_price, total_amount, gst_amount,
  final_amount, status, payment_status, request_date
) VALUES
(
  'c0000001-0000-0000-0000-000000000001',
  'REQ-2024-8841',
  'ORD-8841-DL',
  '11111111-1111-1111-1111-111111111111',
  'Apollo Hospital & Multi-Specialty Centre',
  '22222222-2222-2222-2222-222222222222',
  'Fortis Memorial Research Institute',
  'b0000003-0000-0000-0000-000000000003',
  'Clavam 625',
  'Amoxicillin + Clavulanic Acid',
  'CLV-23-8874',
  50,
  115.00,
  5750.00,
  690.00,
  6440.00,
  'paid',
  'paid',
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO request_items (
  id, request_id, inventory_lot_id, medicine_id, medicine_name, generic_name, batch_number, quantity, unit_price, subtotal, gst_percent, gst_amount, total_price
) VALUES
(
  'ci000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'b0000003-0000-0000-0000-000000000003',
  'a0000003-0000-0000-0000-000000000003',
  'Clavam 625',
  'Amoxicillin + Clavulanic Acid',
  'CLV-23-8874',
  50,
  115.00,
  5750.00,
  12.00,
  690.00,
  6440.00
)
ON CONFLICT (id) DO NOTHING;

-- 7. SEED PAYMENT (Escrow settlement simulation)
INSERT INTO payments (
  id, transaction_id, request_id, medicine_name, quantity, amount, gst_amount, total_paid, payment_status,
  buyer_hospital_id, buyer_hospital_name, seller_hospital_id, seller_hospital_name, is_demo_simulation
) VALUES
(
  'p0000001-0000-0000-0000-000000000001',
  'REQ-2024-8841',
  'c0000001-0000-0000-0000-000000000001',
  'Clavam 625',
  50,
  5750.00,
  690.00,
  6440.00,
  'paid',
  '11111111-1111-1111-1111-111111111111',
  'Apollo Hospital & Multi-Specialty Centre',
  '22222222-2222-2222-2222-222222222222',
  'Fortis Memorial Research Institute',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 8. SEED TRADING TRANSACTIONS (Feeding Trading Activity for Admin -> Hospitals)
INSERT INTO trading_transactions (
  id, transaction_id, request_id, buyer_hospital_id, seller_hospital_id, medicine_id, medicine_name, batch_no, quantity, unit_price, total_amount, transaction_type, status
) VALUES
(
  't0000001-0000-0000-0000-000000000001',
  'REQ-2024-8841',
  'c0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'a0000003-0000-0000-0000-000000000003',
  'Clavam 625',
  'CLV-23-8874',
  50,
  115.00,
  6440.00,
  'purchase',
  'completed'
),
(
  't0000002-0000-0000-0000-000000000002',
  'REQ-2024-8841',
  'c0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'a0000003-0000-0000-0000-000000000003',
  'Clavam 625',
  'CLV-23-8874',
  50,
  115.00,
  6440.00,
  'sale',
  'completed'
)
ON CONFLICT (id) DO NOTHING;

-- 9. SEED ALERTS (With exact deep-linking stable IDs)
INSERT INTO alerts (
  id, hospital_id, group_type, severity, category, title, description, link, action_text, urgent,
  target_type, inventory_id, lot_id, batch_no, medicine_id
) VALUES
(
  'alert-exp-demo-001',
  '22222222-2222-2222-2222-222222222222',
  'action',
  'WARNING',
  'EXPIRING_SOON',
  'Expiring Soon: Clavam 625 (Batch CLV-23-8874)',
  '300 units reach statutory expiration in 65 days. Active concession rate applied for inter-hospital redistribution.',
  '/hospital/inventory?inventoryId=b0000003-0000-0000-0000-000000000003&batchNo=CLV-23-8874',
  'View in Inventory',
  false,
  'inventory',
  'b0000003-0000-0000-0000-000000000003',
  'b0000003-0000-0000-0000-000000000003',
  'CLV-23-8874',
  'a0000003-0000-0000-0000-000000000003'
)
ON CONFLICT (id) DO NOTHING;

-- 10. SEED AUDIT LOG (Immutable trail, zero credentials stored)
INSERT INTO audit_logs (
  id, action, entity_type, entity_id, actor_role, hospital_id, hospital_name, summary, resulting_status, metadata
) VALUES
(
  'e0000001-0000-0000-0000-000000000001',
  'HOSPITAL_APPROVED',
  'HOSPITAL',
  '11111111-1111-1111-1111-111111111111',
  'admin',
  '11111111-1111-1111-1111-111111111111',
  'Apollo Hospital & Multi-Specialty Centre',
  'Supervisory administrator verified Drug License Form 20B/21B and approved hospital registration.',
  'APPROVED',
  '{"verifiedBy": "Supervisory Administrator", "complianceCheck": "NABH_VERIFIED"}'::JSONB
)
ON CONFLICT (id) DO NOTHING;

-- 11. SEED FEEDBACK
INSERT INTO feedback (
  id, hospital_id, hospital_name, rating, category, feedback_text, admin_reply, replied_date, status
) VALUES
(
  'f0000001-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'Fortis Memorial Research Institute',
  5,
  'Logistics & Cold-Chain',
  'The cold chain validation and real-time temperature loggers on MedEx are extraordinary. Saved over ₹3.4 Lakhs on near-expiry oncology supplies.',
  'Thank you Dr. Deshmukh. Our temperature telemetry integration ensures zero spoilage during transport.',
  '2024-08-28',
  'resolved'
)
ON CONFLICT (id) DO NOTHING;
