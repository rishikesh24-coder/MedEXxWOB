-- ====================================================================
-- MEDEX PHASE 10: TRADING, REPORTS & ANALYTICS SCHEMA MIGRATION
-- Migration: 20260914000001_trading_reports_analytics.sql
-- Ensures completed hospital-to-hospital trades are fully traceable:
-- buyer, seller, medicine, lot/batch, quantity, unit price, total amount,
-- request/order ID, payment ID, transfer ID, status, created_at, completed_at.
-- ====================================================================

-- 1. Extend trading_transactions with full lifecycle traceability columns
ALTER TABLE trading_transactions
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transfer_id UUID REFERENCES transfers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Update status constraint to encompass the complete trade lifecycle
ALTER TABLE trading_transactions
  DROP CONSTRAINT IF EXISTS trading_transactions_status_check;

ALTER TABLE trading_transactions
  ADD CONSTRAINT trading_transactions_status_check
  CHECK (status IN (
    'requested',
    'accepted',
    'payment_pending',
    'paid',
    'transfer_created',
    'in_transit',
    'delivered',
    'completed',
    'cancelled',
    'refund_pending',
    'refunded',
    'in_progress'
  ));

-- 3. Optimized indexes for high-throughput reporting, aggregation & filtering
CREATE INDEX IF NOT EXISTS idx_trading_completed ON trading_transactions(status, completed_at);
CREATE INDEX IF NOT EXISTS idx_trading_medicine ON trading_transactions(medicine_id);
CREATE INDEX IF NOT EXISTS idx_trading_lot ON trading_transactions(inventory_lot_id);
CREATE INDEX IF NOT EXISTS idx_trading_buyer_seller ON trading_transactions(buyer_hospital_id, seller_hospital_id);
CREATE INDEX IF NOT EXISTS idx_trading_date ON trading_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_trading_status ON trading_transactions(status);
CREATE INDEX IF NOT EXISTS idx_trading_order_id ON trading_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_trading_payment_id ON trading_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_trading_transfer_id ON trading_transactions(transfer_id);

-- 4. Verify RLS policies on trading_transactions
-- Admins have platform-wide access, hospitals strictly view their own trades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trading_transactions' AND policyname = 'Admins full access on trading_transactions'
  ) THEN
    CREATE POLICY "Admins full access on trading_transactions"
    ON trading_transactions FOR ALL
    TO authenticated
    USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trading_transactions' AND policyname = 'Hospitals view own trading transactions'
  ) THEN
    CREATE POLICY "Hospitals view own trading transactions"
    ON trading_transactions FOR SELECT
    TO authenticated
    USING (
      buyer_hospital_id = get_user_hospital_id() OR
      seller_hospital_id = get_user_hospital_id()
    );
  END IF;
END $$;
