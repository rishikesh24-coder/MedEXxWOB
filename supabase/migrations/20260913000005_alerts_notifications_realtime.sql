-- ====================================================================
-- MedEx — Phase 9: Alerts + Notifications + Real-Time Events
-- Database Migration for Supabase PostgreSQL
-- ====================================================================

-- 1. Upgrade ALERTS Table
DO $$ BEGIN
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(100);
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message TEXT;
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(255);
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN null; END $$;

-- Populate message from description if null
UPDATE alerts SET message = description WHERE message IS NULL AND description IS NOT NULL;
UPDATE alerts SET alert_type = category WHERE alert_type IS NULL AND category IS NOT NULL;

-- Ensure severity check constraint supports Phase 9 enums
DO $$ BEGIN
  ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
  ALTER TABLE alerts ADD CONSTRAINT alerts_severity_check
    CHECK (severity IN ('CRITICAL', 'WARNING', 'ACTION', 'INFO', 'critical', 'warning', 'action', 'info'));
EXCEPTION WHEN others THEN null; END $$;

-- Add UNIQUE constraint on dedup_key for deterministic alert deduplication
DO $$ BEGIN
  ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_dedup_key_unique;
  ALTER TABLE alerts ADD CONSTRAINT alerts_dedup_key_unique UNIQUE (dedup_key);
EXCEPTION WHEN others THEN null; END $$;

-- Indexes for high-performance alert querying
CREATE INDEX IF NOT EXISTS idx_alerts_recipient ON alerts(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_hospital_read ON alerts(hospital_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_lot ON alerts(inventory_lot_id);
CREATE INDEX IF NOT EXISTS idx_alerts_req ON alerts(request_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup ON alerts(dedup_key);

-- 2. Upgrade NOTIFICATIONS Table
DO $$ BEGIN
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN others THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_hosp_read ON notifications(hospital_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(recipient_user_id, is_read);

-- 3. Row-Level Security (RLS) Policies for Multi-Tenancy

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Alerts Policies: Hospitals view and update their own alerts; Admins view all
DROP POLICY IF EXISTS hospital_own_alerts ON alerts;
CREATE POLICY hospital_own_alerts ON alerts
  FOR ALL
  USING (
    hospital_id IS NULL OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.hospital_id = alerts.hospital_id OR users.role = 'ADMIN')
    )
  );

DROP POLICY IF EXISTS service_role_alerts ON alerts;
CREATE POLICY service_role_alerts ON alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Notifications Policies
DROP POLICY IF EXISTS user_own_notifications ON notifications;
CREATE POLICY user_own_notifications ON notifications
  FOR ALL
  USING (
    recipient_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.hospital_id = notifications.hospital_id OR users.role = 'ADMIN')
    )
  );

DROP POLICY IF EXISTS service_role_notifications ON notifications;
CREATE POLICY service_role_notifications ON notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Enable Supabase Realtime Replication on alerts and notifications
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN others THEN null; END $$;
