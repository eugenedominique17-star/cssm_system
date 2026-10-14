-- Atomic sales: private backend calls only; no partial receipts or stock writes.
CREATE OR REPLACE FUNCTION public.create_sale_atomic(
  p_receipt_number text, p_user_id integer, p_staff_id integer,
  p_payment_method text, p_tendered_amount numeric, p_expected_total numeric,
  p_items jsonb, p_submission_id integer DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_items jsonb := p_items;
  v_submission public.pending_submissions%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_item record;
  v_total numeric := 0;
  v_transaction_id integer;
  v_today date := (statement_timestamp() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  IF p_submission_id IS NOT NULL THEN
    SELECT * INTO v_submission FROM public.pending_submissions
      WHERE id = p_submission_id FOR UPDATE;
    IF NOT FOUND OR v_submission.type <> 'walk_in_order' OR v_submission.status <> 'pending' THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'This order is no longer pending.';
    END IF;
    IF v_submission.submitted_by IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Order client does not match.';
    END IF;
    v_items := v_submission.data->'items';
  END IF;

  PERFORM 1 FROM public.staff WHERE id = p_staff_id AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT403', MESSAGE = 'An active staff account is required to record a sale.';
  END IF;
  PERFORM 1 FROM public.clients WHERE id = p_user_id AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'An active registered client account is required.';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'pos') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Payment method must be cash or pos.';
  END IF;
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Add at least one product.';
  END IF;
  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Add at least one product.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) AS e(item)
    WHERE jsonb_typeof(item) <> 'object'
      OR COALESCE(item->>'product_id', '') !~ '^[1-9][0-9]*$'
      OR COALESCE(item->>'quantity', '') !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Product IDs and quantities must be positive integers.';
  END IF;

  -- Lock in a stable order, then recheck availability using the locked rows.
  FOR v_item IN
    SELECT (item->>'product_id')::integer AS product_id,
           sum((item->>'quantity')::integer)::integer AS quantity
    FROM jsonb_array_elements(v_items) AS e(item)
    GROUP BY (item->>'product_id')::integer ORDER BY product_id
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'A selected product no longer exists.';
    END IF;
    IF v_product.status <> 'active' THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = format('Product "%s" is not available.', v_product.name);
    END IF;
    IF v_product.expiry_date < v_today THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = format('Product "%s" has expired and cannot be sold.', v_product.name);
    END IF;
    IF v_product.stock < v_item.quantity THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = format('Insufficient stock for "%s". Available: %s', v_product.name, v_product.stock);
    END IF;
    IF v_product.price < 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Product price cannot be negative.';
    END IF;
    v_total := v_total + v_product.price * v_item.quantity;
  END LOOP;

  IF p_expected_total IS NULL OR v_total <> round(p_expected_total, 2) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Prices changed. Refresh the order and try again.';
  END IF;
  IF p_payment_method = 'cash' AND p_tendered_amount IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Cash payment is required.';
  END IF;
  IF p_tendered_amount IS NOT NULL AND (
    p_tendered_amount::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_tendered_amount < v_total OR p_tendered_amount <> round(p_tendered_amount, 2)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Payment must cover the total and use at most two decimal places.';
  END IF;

  INSERT INTO public.transactions(receipt_number, user_id, staff_id, total_amount,
    payment_method, tendered_amount, change_amount)
  VALUES (p_receipt_number, p_user_id, p_staff_id, v_total, p_payment_method,
    p_tendered_amount, p_tendered_amount - v_total)
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.transaction_items(transaction_id, product_id, quantity, unit_price, subtotal)
  SELECT v_transaction_id, p.id, i.quantity, p.price, p.price * i.quantity
  FROM (
    SELECT (item->>'product_id')::integer AS product_id,
      sum((item->>'quantity')::integer)::integer AS quantity
    FROM jsonb_array_elements(v_items) AS e(item) GROUP BY (item->>'product_id')::integer
  ) i JOIN public.products p ON p.id = i.product_id;

  UPDATE public.products p SET stock = p.stock - i.quantity
  FROM public.transaction_items i
  WHERE i.transaction_id = v_transaction_id AND p.id = i.product_id;

  IF p_submission_id IS NOT NULL THEN
    UPDATE public.pending_submissions SET status = 'approved', reviewed_at = now(),
      admin_notes = 'Walk-in sale completed at the store counter.'
    WHERE id = p_submission_id;
  END IF;
  RETURN v_transaction_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_sale_atomic(text, integer, integer, text, numeric, numeric, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale_atomic(text, integer, integer, text, numeric, numeric, jsonb, integer)
  TO service_role;
NOTIFY pgrst, 'reload schema';
