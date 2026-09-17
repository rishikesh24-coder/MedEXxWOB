-- ====================================================================
-- MedEx — Inter-Hospital Medicine Exchange & Healthcare Logistics
-- Database Schema for Supabase PostgreSQL (Phase 2 Authoritative)
-- 17 Core Relational Entities + Constraints + Views + RLS Policies
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 2. ENUM TYPES
-- ====================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'hospital');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE hospital_status AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'REGISTERED',
    'SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'pending',
    'under_review',
    'verified',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE requisition_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'paid',
    'preparing',
    'dispatched',
    'in transit',
    'delivered',
    'completed',
    'cancelled',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending',
    'escrow_locked',
    'paid',
    'released_to_seller',
    'refunded',
    'partially_refunded',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ====================================================================
-- ENTITY 1: HOSPITALS
-- Workflow: REGISTERED -> PENDING_APPROVAL -> ADMIN REVIEW -> APPROVED / REJECTED
-- Approved hospitals appear in Admin -> Hospitals
-- Pending/rejected hospitals appear in Admin -> Hospital Verification
-- ====================================================================
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  registration_no VARCHAR(100) UNIQUE NOT NULL,
  authorized_person VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL' 
    CHECK (status IN ('REGISTERED', 'PENDING_APPROVAL', 'ADMIN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'pending', 'under_review', 'verified', 'rejected', 'suspended', 'approved')),
  rejection_reason TEXT,
  review_notes TEXT,
  registered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  verified_date DATE,
  suspended_date DATE,
  suspension_reason TEXT,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_status ON hospitals(status);
CREATE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_hospitals_state ON hospitals(state);
CREATE INDEX IF NOT EXISTS idx_hospitals_registration_no ON hospitals(registration_no);

-- ====================================================================
-- ENTITY 2: USERS / PROFILES (LINKED TO auth.users)
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'hospital',
  department VARCHAR(255),
  phone VARCHAR(50),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_hospital_id ON users(hospital_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Link hospital approved_by / rejected_by back to users
DO $$ BEGIN
  ALTER TABLE hospitals ADD CONSTRAINT fk_hospitals_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE hospitals ADD CONSTRAINT fk_hospitals_rejected_by FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ====================================================================
-- ENTITY 3: HOSPITAL_DOCUMENTS
-- Statutory compliance dossier (Files kept private in Supabase Storage)
-- ====================================================================
CREATE TABLE IF NOT EXISTS hospital_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  document_type VARCHAR(150) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  file_path TEXT,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  file_size VARCHAR(50) DEFAULT '2.4 MB',
  file_size_bytes BIGINT,
  submission_status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  document_status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (document_status IN ('pending', 'under_review', 'verified', 'approved', 'rejected')),
  rejection_reason TEXT,
  uploaded_by VARCHAR(255),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospital_docs_hospital_id ON hospital_documents(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_docs_status ON hospital_documents(document_status);
CREATE INDEX IF NOT EXISTS idx_hospital_docs_type ON hospital_documents(document_type);

-- ====================================================================
-- ENTITY 4: MEDICINES (MASTER CLINICAL CATALOGUE)
-- Distinguishable by: composition, strength, dosage form, route
-- ====================================================================
CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255) NOT NULL,
  composition TEXT NOT NULL,
  brand VARCHAR(255),
  strength VARCHAR(100) NOT NULL,
  dosage_form VARCHAR(100) NOT NULL DEFAULT 'Tablet',
  route VARCHAR(100) NOT NULL DEFAULT 'Oral',
  category VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(255) NOT NULL,
  packaging VARCHAR(100) NOT NULL DEFAULT '10 Tablets / Strip',
  packing VARCHAR(100) NOT NULL DEFAULT '10 Tablets / Strip',
  unit VARCHAR(50) NOT NULL DEFAULT 'Tablet',
  units_per_pack INTEGER NOT NULL DEFAULT 10,
  shelf_life_months INTEGER DEFAULT 24,
  storage_condition VARCHAR(150) DEFAULT 'Room Temperature (15°C - 25°C)',
  image_url TEXT,
  description TEXT,
  canonical_composition_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_medicine_formulation UNIQUE(generic_name, strength, dosage_form, route)
);

CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_brand ON medicines(brand_name);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_code ON medicines(code);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_canonical_key ON medicines(canonical_composition_key);

-- Backward-compatibility view for any legacy components referencing master_medicines
CREATE OR REPLACE VIEW master_medicines AS SELECT * FROM medicines;

-- ====================================================================
-- ENTITY 5: INVENTORY_LOTS (HOSPITAL + MEDICINE + BATCH)
-- Underpins both:
-- Admin Inventory -> By Medicine (Medicine -> Hospitals -> Batches)
-- Admin Inventory -> By Hospital (Hospital -> Medicines -> Batches)
-- ====================================================================
CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  medicine_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  dosage_form VARCHAR(100) NOT NULL DEFAULT 'Tablet',
  dosage VARCHAR(100) NOT NULL,
  strength VARCHAR(100),
  packing VARCHAR(100) NOT NULL DEFAULT '15 Tablets',
  unit VARCHAR(50) NOT NULL DEFAULT 'Tablet',
  units_per_pack INTEGER DEFAULT 15,
  number_of_packs INTEGER DEFAULT 1,
  manufacturer VARCHAR(255) NOT NULL,
  batch_number VARCHAR(100) NOT NULL,
  batch_no VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  total_quantity INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 20 CHECK (minimum_stock >= 0),
  min_stock_level INTEGER NOT NULL DEFAULT 20 CHECK (min_stock_level >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 20 CHECK (reorder_level >= 0),
  shelf_location VARCHAR(100) DEFAULT 'Rack A - Shelf 3',
  manufacturing_date DATE NOT NULL,
  mfg_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 100.00 CHECK (unit_price >= 0),
  mrp NUMERIC(12, 2) NOT NULL DEFAULT 100.00 CHECK (mrp >= 0),
  concession_rate NUMERIC(12, 2) NOT NULL DEFAULT 90.00 CHECK (concession_rate >= 0),
  concession_percent NUMERIC(5, 2) DEFAULT 10.00 CHECK (concession_percent >= 0 AND concession_percent <= 100),
  cost_rate NUMERIC(12, 2) NOT NULL DEFAULT 85.00 CHECK (cost_rate >= 0),
  acquisition_cost NUMERIC(12, 2) NOT NULL DEFAULT 85.00 CHECK (acquisition_cost >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'quarantined', 'reserved', 'depleted', 'expired', 'recalled')),
  purchase_bill_url TEXT,
  document_url TEXT,
  invoice_url TEXT,
  bill_storage_path TEXT,
  source VARCHAR(100) DEFAULT 'Direct Procurement',
  supplier VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hospital_batch UNIQUE(hospital_id, batch_number),
  CONSTRAINT chk_inventory_dates CHECK (manufacturing_date <= expiry_date),
  CONSTRAINT chk_inventory_available CHECK (available_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_inventory_hospital_id ON inventory_lots(hospital_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_id ON inventory_lots(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batch_number ON inventory_lots(batch_number);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory_lots(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_lots(status);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON inventory_lots(available_quantity);

-- ====================================================================
-- ENTITY 6: INVENTORY_ADJUSTMENTS
-- Immutable historical stock ledger & adjustment records
-- ====================================================================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_lot_id UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
  quantity_change INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
  reason TEXT NOT NULL,
  action_type VARCHAR(100) NOT NULL DEFAULT 'MANUAL_ADJUSTMENT',
  adjusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  adjusted_by_name VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_adjustment_math CHECK (previous_quantity + quantity_change = new_quantity)
);

CREATE INDEX IF NOT EXISTS idx_adj_inventory_lot ON inventory_adjustments(inventory_lot_id);
CREATE INDEX IF NOT EXISTS idx_adj_hospital ON inventory_adjustments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_adj_timestamp ON inventory_adjustments(timestamp);

-- ====================================================================
-- ENTITY 7: REQUESTS (INTER-HOSPITAL REQUISITIONS)
-- Lifecycle: PENDING -> ACCEPTED -> PREPARING -> DISPATCHED -> IN_TRANSIT -> DELIVERED
-- Supports state-aware cancellation & refund tracking
-- ====================================================================
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  order_id VARCHAR(100),
  from_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  from_hospital_name VARCHAR(255) NOT NULL,
  to_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  to_hospital_name VARCHAR(255) NOT NULL,
  inventory_lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  medicine_id VARCHAR(100),
  medicine_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  batch_no VARCHAR(100),
  mfg_date DATE,
  medicine_expiry_date DATE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_original_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_original_price >= 0),
  unit_final_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_final_price >= 0),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  gst_amount NUMERIC(12, 2) DEFAULT 0 CHECK (gst_amount >= 0),
  final_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
  urgency VARCHAR(50) DEFAULT 'Standard Routine',
  notes TEXT,
  requirement_group_id VARCHAR(100),
  status requisition_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  auto_declined BOOLEAN DEFAULT false,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_id VARCHAR(100),
  paid_date TIMESTAMPTZ,
  payment_failure_reason TEXT,
  cancellation_stage VARCHAR(50)
    CHECK (cancellation_stage IS NULL OR cancellation_stage IN ('WITHIN_24H', 'AFTER_24H_BEFORE_DISPATCH', 'DISPATCHED', 'DELIVERED', 'INVALID')),
  cancellation_penalty_percent NUMERIC(5, 2) DEFAULT 0,
  cancellation_penalty_amount NUMERIC(12, 2) DEFAULT 0,
  cancellation_refund_percent NUMERIC(5, 2) DEFAULT 0,
  cancellation_refund_amount NUMERIC(12, 2) DEFAULT 0,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation JSONB,
  timeline JSONB NOT NULL DEFAULT '[]'::JSONB,
  stock_dispatched_logged BOOLEAN DEFAULT false,
  stock_received_by_buyer BOOLEAN DEFAULT false,
  requested_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  in_transit_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_different_hospitals CHECK (from_hospital_id != to_hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_requests_from_hosp ON requests(from_hospital_id);
CREATE INDEX IF NOT EXISTS idx_requests_to_hosp ON requests(to_hospital_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_transaction_id ON requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_requests_req_group ON requests(requirement_group_id);
CREATE INDEX IF NOT EXISTS idx_requests_date ON requests(request_date);

-- ====================================================================
-- ENTITY 8: REQUEST_ITEMS (LINE-ITEMS)
-- ====================================================================
CREATE TABLE IF NOT EXISTS request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  inventory_lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  medicine_id UUID REFERENCES medicines(id) ON DELETE RESTRICT,
  medicine_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  batch_number VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  gst_percent NUMERIC(5, 2) DEFAULT 12.00 CHECK (gst_percent >= 0),
  gst_amount NUMERIC(12, 2) DEFAULT 0 CHECK (gst_amount >= 0),
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_req_items_request ON request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_req_items_lot ON request_items(inventory_lot_id);
CREATE INDEX IF NOT EXISTS idx_req_items_medicine ON request_items(medicine_id);

-- ====================================================================
-- ENTITY 9: PAYMENTS & ESCROW
-- Zero credit card credentials stored
-- ====================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100) NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  medicine_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  gst_amount NUMERIC(12, 2) DEFAULT 0 CHECK (gst_amount >= 0),
  total_paid NUMERIC(12, 2) NOT NULL CHECK (total_paid >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  provider VARCHAR(100) NOT NULL DEFAULT 'Razorpay Mock Escrow',
  provider_transaction_id VARCHAR(100),
  provider_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_order_id VARCHAR(100),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('pending', 'escrow_locked', 'paid', 'released_to_seller', 'refunded', 'failed')),
  payment_method VARCHAR(100) NOT NULL DEFAULT 'Demo B2B Escrow Transfer',
  buyer_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  buyer_hospital_name VARCHAR(255) NOT NULL,
  seller_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  seller_hospital_name VARCHAR(255) NOT NULL,
  is_demo_simulation BOOLEAN NOT NULL DEFAULT true,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  escrow_locked_at TIMESTAMPTZ,
  escrow_released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_buyer ON payments(buyer_hospital_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller ON payments(seller_hospital_id);
CREATE INDEX IF NOT EXISTS idx_payments_txn ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(request_id);

-- ====================================================================
-- ENTITY 10: REFUNDS
-- State-aware penalty calculation & refund settlements
-- Rules:
-- Tier A (Within 24h before dispatch): 0% penalty, 100% refund
-- Tier B (After 24h before dispatch): 5% penalty, 95% refund
-- Tier C (After dispatch): 15% penalty, 85% refund
-- Tier D (After delivery): Non-cancellable
-- ====================================================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number VARCHAR(100) UNIQUE NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
  transaction_id VARCHAR(100) NOT NULL,
  buyer_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  seller_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  total_order_amount NUMERIC(12, 2) NOT NULL CHECK (total_order_amount >= 0),
  cancellation_stage VARCHAR(50) NOT NULL
    CHECK (cancellation_stage IN ('WITHIN_24H', 'AFTER_24H_BEFORE_DISPATCH', 'DISPATCHED')),
  penalty_percentage NUMERIC(5, 2) NOT NULL CHECK (penalty_percentage >= 0 AND penalty_percentage <= 100),
  penalty_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (penalty_amount >= 0),
  refund_percentage NUMERIC(5, 2) NOT NULL CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  refund_amount NUMERIC(12, 2) NOT NULL CHECK (refund_amount >= 0),
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'processed'
    CHECK (status IN ('pending', 'processed', 'failed')),
  provider_refund_reference VARCHAR(100),
  razorpay_refund_id VARCHAR(100),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_refund_math CHECK (ROUND(penalty_amount + refund_amount, 2) = ROUND(total_order_amount, 2))
);

CREATE INDEX IF NOT EXISTS idx_refunds_request ON refunds(request_id);
CREATE INDEX IF NOT EXISTS idx_refunds_buyer ON refunds(buyer_hospital_id);
CREATE INDEX IF NOT EXISTS idx_refunds_seller ON refunds(seller_hospital_id);
CREATE INDEX IF NOT EXISTS idx_refunds_number ON refunds(refund_number);

-- ====================================================================
-- ENTITY 11: TRANSFERS
-- Inter-hospital stock movement & direct transfers
-- ====================================================================
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100) UNIQUE NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  inventory_lot_id UUID REFERENCES inventory_lots(id) ON DELETE RESTRICT,
  medicine_id UUID REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_no VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  source_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  destination_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  target_hospital_id UUID REFERENCES hospitals(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'dispatched', 'in_transit', 'delivered', 'cancelled')),
  tracking_reference VARCHAR(100),
  note TEXT,
  initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_transfer_diff_hospitals CHECK (source_hospital_id != destination_hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_source ON transfers(source_hospital_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON transfers(destination_hospital_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_txn ON transfers(transaction_id);

-- ====================================================================
-- ENTITY 12: TRACKING_EVENTS
-- Logistics telemetry & cold-chain temperature logs
-- ====================================================================
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100) NOT NULL,
  tracking_number VARCHAR(100) UNIQUE NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  transfer_id UUID REFERENCES transfers(id) ON DELETE SET NULL,
  sender_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  sender_hospital VARCHAR(255) NOT NULL,
  receiver_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  receiver_hospital VARCHAR(255) NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(100) NOT NULL DEFAULT 'In Preparation'
    CHECK (status IN ('In Preparation', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Delayed', 'Exception', 'Cancelled')),
  location VARCHAR(255),
  current_location VARCHAR(255),
  destination VARCHAR(255),
  eta VARCHAR(100),
  courier_name VARCHAR(150) DEFAULT 'MediCold Logistics Express Ltd.',
  courier_contact VARCHAR(50),
  vehicle_no VARCHAR(100),
  temperature VARCHAR(50) DEFAULT '3.8°C (Compliant)',
  temperature_celsius NUMERIC(5, 2) DEFAULT 3.8,
  is_cold_chain_compliant BOOLEAN NOT NULL DEFAULT true,
  is_demo_simulation BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  timeline JSONB NOT NULL DEFAULT '[]'::JSONB,
  coordinates JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_txn ON tracking_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tracking_number ON tracking_events(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_transfer ON tracking_events(transfer_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sender ON tracking_events(sender_hospital_id);
CREATE INDEX IF NOT EXISTS idx_tracking_receiver ON tracking_events(receiver_hospital_id);

-- ====================================================================
-- ENTITY 13: ALERTS
-- Real-time notification center with stable deep-linking references
-- ====================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(100) PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  group_type VARCHAR(50) NOT NULL CHECK (group_type IN ('critical', 'action', 'info')),
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'ACTION', 'INFO')),
  category VARCHAR(100) NOT NULL,
  alert_type VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  link TEXT,
  action_text VARCHAR(100),
  urgent BOOLEAN NOT NULL DEFAULT false,
  source_id VARCHAR(100),
  target_type VARCHAR(100) CHECK (target_type IN ('inventory', 'request', 'transfer', 'verification', 'system')),
  inventory_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  inventory_lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  batch_id VARCHAR(100),
  batch_no VARCHAR(100),
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  transfer_id UUID REFERENCES transfers(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_hospital ON alerts(hospital_id);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_inventory_lot_id ON alerts(inventory_lot_id);
CREATE INDEX IF NOT EXISTS idx_alerts_batch_no ON alerts(batch_no);

-- ====================================================================
-- ENTITY 14: NOTIFICATIONS
-- In-app notifications for hospital personnel and administrators
-- ====================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL DEFAULT 'INFO',
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(100),
  related_entity_id VARCHAR(100),
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_hospital ON notifications(hospital_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read) WHERE is_read = false;

-- ====================================================================
-- ENTITY 15: TRADING_TRANSACTIONS
-- Tracks purchase and sales transactions for Admin -> Hospitals -> Trading Activity
-- Supports computing: purchase count, sales count, total trades, percentages, units
-- ====================================================================
CREATE TABLE IF NOT EXISTS trading_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100) NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  buyer_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  seller_hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  inventory_lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  medicine_name VARCHAR(255) NOT NULL,
  batch_no VARCHAR(100),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'purchase', 'sale')),
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_buyer ON trading_transactions(buyer_hospital_id);
CREATE INDEX IF NOT EXISTS idx_trading_seller ON trading_transactions(seller_hospital_id);
CREATE INDEX IF NOT EXISTS idx_trading_txn ON trading_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_trading_type_date ON trading_transactions(transaction_type, transaction_date);

-- ====================================================================
-- ENTITY 16: AUDIT_LOGS
-- Immutable statutory audit trail (Zero password/secret storage)
-- ====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  actor_role VARCHAR(50) NOT NULL DEFAULT 'hospital' CHECK (actor_role IN ('admin', 'hospital', 'system')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  hospital_name VARCHAR(255),
  partner_hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  partner_hospital_name VARCHAR(255),
  summary TEXT NOT NULL,
  resulting_status VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_hospital ON audit_logs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_partner_hospital ON audit_logs(partner_hospital_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- ====================================================================
-- ENTITY 17: FEEDBACK
-- Institutional feedback from hospital network & admin resolution
-- ====================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  hospital_name VARCHAR(255) NOT NULL,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  transaction_id VARCHAR(100),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category VARCHAR(100) NOT NULL DEFAULT 'General Service',
  comment TEXT,
  feedback_text TEXT NOT NULL,
  admin_reply TEXT,
  replied_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_hospital ON feedback(hospital_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- ====================================================================
-- 18. AUTOMATIC TIMESTAMP TRIGGERS
-- ====================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_hospitals
  BEFORE UPDATE ON hospitals
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_hospital_documents
  BEFORE UPDATE ON hospital_documents
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_medicines
  BEFORE UPDATE ON medicines
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_inventory_lots
  BEFORE UPDATE ON inventory_lots
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_requests
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_request_items
  BEFORE UPDATE ON request_items
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_payments
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_transfers
  BEFORE UPDATE ON transfers
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_tracking_events
  BEFORE UPDATE ON tracking_events
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_alerts
  BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_timestamp_feedback
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ====================================================================
-- 19. VIEWS FOR ADMIN INVENTORY DRILL-DOWN & TRADING SUMMARY
-- ====================================================================

-- View 1: Medicine -> Hospitals -> Batches
CREATE OR REPLACE VIEW view_admin_inventory_by_medicine AS
SELECT 
  m.id AS medicine_id,
  m.code,
  m.name AS medicine_name,
  m.brand_name,
  m.generic_name,
  m.category,
  m.dosage_form,
  m.strength,
  m.route,
  m.manufacturer,
  m.canonical_composition_key,
  COUNT(DISTINCT l.hospital_id) AS total_contributing_hospitals,
  COUNT(l.id) AS total_batches_count,
  COALESCE(SUM(l.quantity), 0) AS total_units_in_network,
  COALESCE(SUM(l.available_quantity), 0) AS total_available_units,
  COALESCE(SUM(l.reserved_quantity), 0) AS total_reserved_units,
  MIN(l.expiry_date) AS earliest_expiry_date
FROM medicines m
LEFT JOIN inventory_lots l ON m.id = l.medicine_id
GROUP BY m.id;

-- View 2: Hospital -> Medicines -> Batches
CREATE OR REPLACE VIEW view_admin_inventory_by_hospital AS
SELECT 
  h.id AS hospital_id,
  h.name AS hospital_name,
  h.city,
  h.state,
  h.status AS hospital_status,
  COUNT(DISTINCT l.medicine_id) AS total_distinct_medicines,
  COUNT(l.id) AS total_batches_count,
  COALESCE(SUM(l.quantity), 0) AS total_stock_units,
  COALESCE(SUM(l.available_quantity), 0) AS total_available_units,
  COALESCE(SUM(l.quantity * l.unit_price), 0) AS total_inventory_valuation_inr
FROM hospitals h
LEFT JOIN inventory_lots l ON h.id = l.hospital_id
GROUP BY h.id;

-- View 3: Trading Activity Summary per Hospital (Admin -> Hospitals -> Trading Activity)
CREATE OR REPLACE VIEW view_hospital_trading_summary AS
WITH purchases AS (
  SELECT 
    from_hospital_id AS hospital_id,
    COUNT(*) AS purchases_count,
    COALESCE(SUM(quantity), 0) AS purchased_units,
    COALESCE(SUM(total_amount), 0) AS total_purchases_amount
  FROM requests
  WHERE status IN ('accepted', 'paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed')
  GROUP BY from_hospital_id
),
sales AS (
  SELECT 
    to_hospital_id AS hospital_id,
    COUNT(*) AS sales_count,
    COALESCE(SUM(quantity), 0) AS sold_units,
    COALESCE(SUM(total_amount), 0) AS total_sales_amount
  FROM requests
  WHERE status IN ('accepted', 'paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed')
  GROUP BY to_hospital_id
)
SELECT 
  h.id AS hospital_id,
  h.name AS hospital_name,
  h.status AS hospital_status,
  COALESCE(p.purchases_count, 0) AS purchases_count,
  COALESCE(s.sales_count, 0) AS sales_count,
  (COALESCE(p.purchases_count, 0) + COALESCE(s.sales_count, 0)) AS total_trades_count,
  CASE 
    WHEN (COALESCE(p.purchases_count, 0) + COALESCE(s.sales_count, 0)) > 0 
    THEN ROUND((COALESCE(p.purchases_count, 0)::NUMERIC / (COALESCE(p.purchases_count, 0) + COALESCE(s.sales_count, 0))) * 100)
    ELSE 0 
  END AS purchase_percentage,
  CASE 
    WHEN (COALESCE(p.purchases_count, 0) + COALESCE(s.sales_count, 0)) > 0 
    THEN 100 - ROUND((COALESCE(p.purchases_count, 0)::NUMERIC / (COALESCE(p.purchases_count, 0) + COALESCE(s.sales_count, 0))) * 100)
    ELSE 0 
  END AS sales_percentage,
  COALESCE(p.purchased_units, 0) AS purchased_units,
  COALESCE(s.sold_units, 0) AS sold_units,
  COALESCE(p.total_purchases_amount, 0) AS total_purchases_amount,
  COALESCE(s.total_sales_amount, 0) AS total_sales_amount
FROM hospitals h
LEFT JOIN purchases p ON h.id = p.hospital_id
LEFT JOIN sales s ON h.id = s.hospital_id;

-- ====================================================================
-- 20. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all 17 tables
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- HELPER FUNCTIONS FOR RLS POLICIES (SECURITY DEFINER)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_hospital_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT hospital_id FROM users
    WHERE id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_current_hospital_verified()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM hospitals h
    JOIN users u ON u.hospital_id = h.id
    WHERE u.id = auth.uid() AND u.is_active = true 
      AND h.status IN ('APPROVED', 'verified')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- RLS POLICIES: 1. HOSPITALS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on hospitals"
ON hospitals FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospital views own hospital record"
ON hospitals FOR SELECT
TO authenticated
USING (id = get_user_hospital_id());

CREATE POLICY "Verified hospitals view approved peer directory"
ON hospitals FOR SELECT
TO authenticated
USING (
  (status IN ('APPROVED', 'verified')) AND is_current_hospital_verified()
);

CREATE POLICY "Hospital updates own contact details"
ON hospitals FOR UPDATE
TO authenticated
USING (id = get_user_hospital_id())
WITH CHECK (
  id = get_user_hospital_id() AND
  status = (SELECT status FROM hospitals WHERE id = get_user_hospital_id())
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 2. USERS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on users"
ON users FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Users read own profile"
ON users FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users update own profile"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = (SELECT role FROM users WHERE id = auth.uid()));

-- --------------------------------------------------------------------
-- RLS POLICIES: 3. HOSPITAL_DOCUMENTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on hospital_documents"
ON hospital_documents FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospitals view own documents"
ON hospital_documents FOR SELECT
TO authenticated
USING (hospital_id = get_user_hospital_id());

CREATE POLICY "Hospitals upload own documents"
ON hospital_documents FOR INSERT
TO authenticated
WITH CHECK (hospital_id = get_user_hospital_id());

CREATE POLICY "Hospitals delete own pending documents"
ON hospital_documents FOR DELETE
TO authenticated
USING (
  hospital_id = get_user_hospital_id() AND 
  document_status IN ('pending', 'rejected')
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 4. MEDICINES
-- --------------------------------------------------------------------
CREATE POLICY "All authenticated users view medicines"
ON medicines FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage medicines"
ON medicines FOR ALL
TO authenticated
USING (is_admin());

-- --------------------------------------------------------------------
-- RLS POLICIES: 5. INVENTORY_LOTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on inventory_lots"
ON inventory_lots FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospital manages own inventory lots"
ON inventory_lots FOR ALL
TO authenticated
USING (hospital_id = get_user_hospital_id() AND is_current_hospital_verified())
WITH CHECK (hospital_id = get_user_hospital_id() AND is_current_hospital_verified());

CREATE POLICY "Verified hospitals view active lots in marketplace"
ON inventory_lots FOR SELECT
TO authenticated
USING (
  is_current_hospital_verified()
  AND status = 'active'
  AND available_quantity > 0
  AND expiry_date > CURRENT_DATE
  AND EXISTS (
    SELECT 1 FROM hospitals h
    WHERE h.id = inventory_lots.hospital_id AND h.status IN ('APPROVED', 'verified')
  )
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 6. INVENTORY_ADJUSTMENTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on inventory_adjustments"
ON inventory_adjustments FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospital views own stock adjustments"
ON inventory_adjustments FOR SELECT
TO authenticated
USING (hospital_id = get_user_hospital_id());

CREATE POLICY "Verified hospital creates stock adjustments"
ON inventory_adjustments FOR INSERT
TO authenticated
WITH CHECK (
  hospital_id = get_user_hospital_id() AND
  is_current_hospital_verified()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 7. REQUESTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins view all requests"
ON requests FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospitals access own requisitions"
ON requests FOR SELECT
TO authenticated
USING (
  from_hospital_id = get_user_hospital_id() OR
  to_hospital_id = get_user_hospital_id()
);

CREATE POLICY "Verified hospitals create requisitions"
ON requests FOR INSERT
TO authenticated
WITH CHECK (
  from_hospital_id = get_user_hospital_id() AND
  is_current_hospital_verified()
);

CREATE POLICY "Requisition participants update request state"
ON requests FOR UPDATE
TO authenticated
USING (
  from_hospital_id = get_user_hospital_id() OR
  to_hospital_id = get_user_hospital_id()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 8. REQUEST_ITEMS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on request_items"
ON request_items FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Requisition participants view items"
ON request_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_items.request_id AND
    (r.from_hospital_id = get_user_hospital_id() OR r.to_hospital_id = get_user_hospital_id())
  )
);

CREATE POLICY "Buyer inserts request items"
ON request_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_items.request_id AND
    r.from_hospital_id = get_user_hospital_id() AND
    is_current_hospital_verified()
  )
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 9. PAYMENTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on payments"
ON payments FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Parties view own payments"
ON payments FOR SELECT
TO authenticated
USING (
  buyer_hospital_id = get_user_hospital_id() OR
  seller_hospital_id = get_user_hospital_id()
);

CREATE POLICY "Buyer inserts payment record"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  buyer_hospital_id = get_user_hospital_id() AND
  is_current_hospital_verified()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 10. REFUNDS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on refunds"
ON refunds FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Parties view own refunds"
ON refunds FOR SELECT
TO authenticated
USING (
  buyer_hospital_id = get_user_hospital_id() OR
  seller_hospital_id = get_user_hospital_id()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 11. TRANSFERS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on transfers"
ON transfers FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Parties view transfers"
ON transfers FOR SELECT
TO authenticated
USING (
  source_hospital_id = get_user_hospital_id() OR
  destination_hospital_id = get_user_hospital_id() OR
  target_hospital_id = get_user_hospital_id()
);

CREATE POLICY "Source hospital creates transfer"
ON transfers FOR INSERT
TO authenticated
WITH CHECK (
  source_hospital_id = get_user_hospital_id() AND
  is_current_hospital_verified()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 12. TRACKING_EVENTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on tracking_events"
ON tracking_events FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Parties view tracking events"
ON tracking_events FOR SELECT
TO authenticated
USING (
  sender_hospital_id = get_user_hospital_id() OR
  receiver_hospital_id = get_user_hospital_id()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 13. ALERTS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on alerts"
ON alerts FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospitals view own alerts"
ON alerts FOR SELECT
TO authenticated
USING (hospital_id = get_user_hospital_id());

CREATE POLICY "Hospitals update own alert read status"
ON alerts FOR UPDATE
TO authenticated
USING (hospital_id = get_user_hospital_id())
WITH CHECK (hospital_id = get_user_hospital_id());

-- --------------------------------------------------------------------
-- RLS POLICIES: 14. NOTIFICATIONS
-- --------------------------------------------------------------------
CREATE POLICY "Users view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid() OR user_id = auth.uid() OR hospital_id = get_user_hospital_id());

CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (recipient_user_id = auth.uid() OR user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Admins full access on notifications"
ON notifications FOR ALL
TO authenticated
USING (is_admin());

-- --------------------------------------------------------------------
-- RLS POLICIES: 15. TRADING_TRANSACTIONS
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on trading_transactions"
ON trading_transactions FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospitals view own trading transactions"
ON trading_transactions FOR SELECT
TO authenticated
USING (
  buyer_hospital_id = get_user_hospital_id() OR
  seller_hospital_id = get_user_hospital_id()
);

-- --------------------------------------------------------------------
-- RLS POLICIES: 16. AUDIT_LOGS
-- --------------------------------------------------------------------
CREATE POLICY "Admins view all audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Hospitals view relevant audit events"
ON audit_logs FOR SELECT
TO authenticated
USING (
  hospital_id = get_user_hospital_id() OR
  partner_hospital_id = get_user_hospital_id()
);

CREATE POLICY "Authenticated users can append audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- --------------------------------------------------------------------
-- RLS POLICIES: 17. FEEDBACK
-- --------------------------------------------------------------------
CREATE POLICY "Admins full access on feedback"
ON feedback FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Hospitals view own feedback"
ON feedback FOR SELECT
TO authenticated
USING (hospital_id = get_user_hospital_id());

CREATE POLICY "Hospitals submit feedback"
ON feedback FOR INSERT
TO authenticated
WITH CHECK (hospital_id = get_user_hospital_id());

-- ====================================================================
-- 21. SUPABASE STORAGE BUCKETS
-- Private buckets for sensitive statutory and business documents
-- ====================================================================

-- Bucket 1: Statutory hospital registration documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hospital-documents',
  'hospital-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Bucket 2: Inventory purchase bills and invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-bills',
  'purchase-bills',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Storage RLS: Hospital uploads into own folder in hospital-documents
CREATE POLICY "Hospital upload document to hospital-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hospital-documents' AND
  (storage.foldername(name))[1] = get_user_hospital_id()::text
);

-- Storage RLS: Hospital reads own documents
CREATE POLICY "Hospital read own documents in hospital-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'hospital-documents' AND
  ((storage.foldername(name))[1] = get_user_hospital_id()::text OR is_admin())
);

-- Storage RLS: Admin full access to hospital-documents bucket
CREATE POLICY "Admin manage all documents in hospital-documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'hospital-documents' AND is_admin()
);

-- Storage RLS: Hospital uploads into purchase-bills
CREATE POLICY "Hospital upload bill to purchase-bills"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'purchase-bills' AND
  (storage.foldername(name))[1] = get_user_hospital_id()::text
);

-- Storage RLS: Hospital reads own purchase bills
CREATE POLICY "Hospital read own bills in purchase-bills"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'purchase-bills' AND
  ((storage.foldername(name))[1] = get_user_hospital_id()::text OR is_admin())
);

-- Storage RLS: Admin full access to purchase-bills
CREATE POLICY "Admin manage all bills in purchase-bills"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'purchase-bills' AND is_admin()
);
