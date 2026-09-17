-- ====================================================================
-- MEDEX PHASE 11 STEP 5: HORIZONTAL SCALING & CONCURRENCY HARDENING
-- Migration: 20260914000002_concurrency_hardening.sql
-- Provides database-enforced atomicity, uniqueness constraints,
-- row-level locking functions, and idempotent state transitions
-- across multiple backend Node.js instances.
-- ====================================================================

-- 1. Unique index on refunds(request_id)
-- Guarantees that two concurrent cancellation/refund requests can never
-- generate duplicate refund records in the database.
CREATE UNIQUE INDEX IF NOT EXISTS uq_refunds_request 
  ON refunds(request_id);

-- 2. Unique index on payments(provider_order_id)
-- Prevents duplicate payment creation records for the same provider order token.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_order 
  ON payments(provider_order_id) 
  WHERE provider_order_id IS NOT NULL;

-- 3. Unique index on trading_transactions(request_id)
-- Enforces strict 1:1 relationship between a requisition and its trading ledger row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trading_request 
  ON trading_transactions(request_id) 
  WHERE request_id IS NOT NULL;

-- 4. Reaffirm inventory_lots integrity constraints
-- Ensures no concurrent decrement can drive stock below zero.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_available_nonneg'
  ) THEN
    ALTER TABLE inventory_lots 
      ADD CONSTRAINT chk_inventory_available_nonneg CHECK (available_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_reserved_nonneg'
  ) THEN
    ALTER TABLE inventory_lots 
      ADD CONSTRAINT chk_inventory_reserved_nonneg CHECK (reserved_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_available_lte_total'
  ) THEN
    ALTER TABLE inventory_lots 
      ADD CONSTRAINT chk_inventory_available_lte_total CHECK (available_quantity <= quantity);
  END IF;
EXCEPTION WHEN others THEN null;
END $$;

-- 5. Row-level locked stock reservation function
-- Eliminates reliance on single-process Node.js mutexes for multi-instance deployments.
CREATE OR REPLACE FUNCTION reserve_stock_for_request(
  p_lot_id UUID,
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_lot RECORD;
  v_new_available INTEGER;
  v_new_reserved INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Reservation quantity must be strictly positive';
  END IF;

  -- Enforce row-level lock (FOR UPDATE) across all database transactions
  SELECT * INTO v_lot
  FROM inventory_lots
  WHERE id = p_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory lot % not found', p_lot_id;
  END IF;

  IF v_lot.status NOT IN ('active', 'AVAILABLE', 'LOW_STOCK') THEN
    RAISE EXCEPTION 'Inventory lot is not active for reservation (status: %)', v_lot.status;
  END IF;

  IF v_lot.expiry_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Inventory lot is expired (expiry: %)', v_lot.expiry_date;
  END IF;

  IF v_lot.available_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock: Only % units available, but % requested', 
      v_lot.available_quantity, p_quantity;
  END IF;

  v_new_available := v_lot.available_quantity - p_quantity;
  v_new_reserved := v_lot.reserved_quantity + p_quantity;

  UPDATE inventory_lots
  SET available_quantity = v_new_available,
      reserved_quantity = v_new_reserved,
      updated_at = NOW()
  WHERE id = p_lot_id;

  RETURN jsonb_build_object(
    'success', true,
    'lot_id', p_lot_id,
    'previous_available', v_lot.available_quantity,
    'available_quantity', v_new_available,
    'reserved_quantity', v_new_reserved,
    'total_quantity', v_lot.quantity,
    'medicine_id', v_lot.medicine_id,
    'medicine_name', v_lot.medicine_name,
    'batch_number', v_lot.batch_number,
    'hospital_id', v_lot.hospital_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Row-level locked stock release function
CREATE OR REPLACE FUNCTION release_reserved_stock(
  p_lot_id UUID,
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_lot RECORD;
  v_new_available INTEGER;
  v_new_reserved INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No quantity to release');
  END IF;

  SELECT * INTO v_lot
  FROM inventory_lots
  WHERE id = p_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lot not found');
  END IF;

  v_new_reserved := GREATEST(0, v_lot.reserved_quantity - p_quantity);
  v_new_available := LEAST(v_lot.quantity, v_lot.available_quantity + p_quantity);

  UPDATE inventory_lots
  SET available_quantity = v_new_available,
      reserved_quantity = v_new_reserved,
      updated_at = NOW()
  WHERE id = p_lot_id;

  RETURN jsonb_build_object(
    'success', true,
    'lot_id', p_lot_id,
    'available_quantity', v_new_available,
    'reserved_quantity', v_new_reserved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
