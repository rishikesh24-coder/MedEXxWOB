-- ====================================================================
-- MedEx — Phase 6: Cancellation & Refund Management
-- Database Migration for Supabase PostgreSQL
-- ====================================================================

-- 1. Ensure refunds table allows all valid Phase 6 statuses and cancellation stages
DO $$ BEGIN
  ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_status_check;
  ALTER TABLE refunds ADD CONSTRAINT refunds_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'processed', 'failed', 'not_required', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED'));
EXCEPTION WHEN undefined_table THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_cancellation_stage_check;
  ALTER TABLE refunds ADD CONSTRAINT refunds_cancellation_stage_check
    CHECK (cancellation_stage IN ('WITHIN_24H', 'AFTER_24H_BEFORE_DISPATCH', 'DISPATCHED', 'WINDOW_A', 'WINDOW_B', 'WINDOW_C', 'PREPARING'));
EXCEPTION WHEN undefined_table THEN null; END $$;

-- 2. Make processed_at nullable for pending refunds
DO $$ BEGIN
  ALTER TABLE refunds ALTER COLUMN processed_at DROP NOT NULL;
EXCEPTION WHEN others THEN null; END $$;

-- 3. Atomic stock reservation and release PL/pgSQL functions
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

  -- Row-level lock on the target lot
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
    RAISE EXCEPTION 'Insufficient available stock: requested %, available %', p_quantity, v_lot.available_quantity;
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
    'new_available', v_new_available,
    'new_reserved', v_new_reserved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    RETURN jsonb_build_object('success', false, 'message', 'Release quantity must be positive');
  END IF;

  SELECT * INTO v_lot
  FROM inventory_lots
  WHERE id = p_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lot not found');
  END IF;

  -- Ensure we do not decrement reserved quantity below 0
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
    'new_available', v_new_available,
    'new_reserved', v_new_reserved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Atomic request cancellation with stock release
CREATE OR REPLACE FUNCTION cancel_request_and_release_stock(
  p_request_id UUID,
  p_cancelled_by UUID,
  p_reason TEXT,
  p_penalty_pct NUMERIC,
  p_penalty_amt NUMERIC,
  p_refund_pct NUMERIC,
  p_refund_amt NUMERIC,
  p_stage TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_refund_id UUID := gen_random_uuid();
  v_refund_num TEXT := 'REF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6);
BEGIN
  SELECT * INTO v_req
  FROM requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  IF v_req.status IN ('cancelled', 'delivered', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Request in status "%" cannot be cancelled', v_req.status;
  END IF;

  -- 1. Update Request
  UPDATE requests
  SET status = 'cancelled',
      cancelled_by = p_cancelled_by,
      cancelled_at = v_now,
      cancellation_reason = p_reason,
      cancellation_stage = p_stage,
      cancellation_penalty_percent = p_penalty_pct,
      cancellation_penalty_amount = p_penalty_amt,
      cancellation_refund_percent = p_refund_pct,
      cancellation_refund_amount = p_refund_amt,
      cancellation = jsonb_build_object(
        'cancelledAt', v_now,
        'cancelledBy', p_cancelled_by,
        'reason', p_reason,
        'stage', p_stage,
        'penaltyPercent', p_penalty_pct,
        'penaltyAmount', p_penalty_amt,
        'refundPercent', p_refund_pct,
        'refundAmount', p_refund_amt,
        'totalAmount', v_req.total_amount
      ),
      updated_at = v_now
  WHERE id = p_request_id;

  -- 2. Release reserved stock if applicable
  IF v_req.inventory_lot_id IS NOT NULL THEN
    PERFORM release_reserved_stock(v_req.inventory_lot_id, v_req.quantity);
  END IF;

  -- 3. Insert into refunds table
  INSERT INTO refunds (
    id,
    refund_number,
    request_id,
    transaction_id,
    buyer_hospital_id,
    seller_hospital_id,
    total_order_amount,
    cancellation_stage,
    penalty_percentage,
    penalty_amount,
    refund_percentage,
    refund_amount,
    reason,
    status,
    created_at
  ) VALUES (
    v_refund_id,
    v_refund_num,
    p_request_id,
    v_req.transaction_id,
    v_req.from_hospital_id,
    v_req.to_hospital_id,
    v_req.total_amount,
    p_stage,
    p_penalty_pct,
    p_penalty_amt,
    p_refund_pct,
    p_refund_amt,
    p_reason,
    'pending',
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'refund_id', v_refund_id,
    'refund_number', v_refund_num,
    'refund_amount', p_refund_amt,
    'penalty_amount', p_penalty_amt
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
