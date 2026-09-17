-- ====================================================================
-- MedEx — Phase 7: Payments & Payment Webhooks
-- Database Migration for Supabase PostgreSQL
-- ====================================================================

-- 1. Ensure payments table has all required columns and constraints for Phase 7
DO $$ BEGIN
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(100);
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(100);
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_signature VARCHAR(255);
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
  ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
EXCEPTION WHEN others THEN null; END $$;

-- Update constraints on payments.status and payment_status
DO $$ BEGIN
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
  ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN (
      'CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED',
      'created', 'pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded',
      'escrow_locked', 'released_to_seller'
    ));
EXCEPTION WHEN others THEN null; END $$;

-- 2. Indexes for payments queries
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_prov_order ON payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_prov_payment ON payments(provider_payment_id);

-- 3. Create Webhook Events Ledger Table for Idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL DEFAULT 'razorpay',
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  provider_payment_id VARCHAR(100),
  provider_order_id VARCHAR(100),
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_result VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment ON webhook_events(payment_id);

-- 4. Enable Row Level Security (RLS) on webhook_events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all webhook events; service role can insert/update
DROP POLICY IF EXISTS admin_all_webhook_events ON webhook_events;
CREATE POLICY admin_all_webhook_events ON webhook_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

DROP POLICY IF EXISTS service_role_webhook_events ON webhook_events;
CREATE POLICY service_role_webhook_events ON webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
