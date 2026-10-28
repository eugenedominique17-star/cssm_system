-- Store the actual supplier price for each reorder receipt.
BEGIN;

DROP FUNCTION IF EXISTS public.inventory_receive_reorder(uuid, date, integer, text);
ALTER TABLE public.reorder_orders
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2)
    CHECK (purchase_price IS NULL OR purchase_price > 0);

ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2)
    CHECK (purchase_price IS NULL OR purchase_price > 0);

CREATE OR REPLACE FUNCTION public.inventory_receive_reorder(
  p_id uuid,
  p_expiry_date date,
  p_purchase_price numeric,
  p_actor integer,
  p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  r public.reorder_orders%ROWTYPE;
  p public.products%ROWTYPE;
  b public.inventory_batches%ROWTYPE;
  doc_id uuid := gen_random_uuid();
  actor_name text;
BEGIN
  IF p_role <> 'admin' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT403', MESSAGE = 'Only admins can receive reorder deliveries and record purchase prices.';
  END IF;
  SELECT a.name INTO actor_name FROM public.admins a
    WHERE a.id = p_actor AND a.status = 'active' FOR SHARE;
  IF actor_name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT403', MESSAGE = 'Active admin account required.';
  END IF;
  IF p_id IS NULL OR p_purchase_price IS NULL OR p_purchase_price <= 0 OR p_purchase_price <> round(p_purchase_price, 2) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Enter the actual positive supplier purchase price.';
  END IF;
  SELECT * INTO r FROM public.reorder_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Reorder not found.';
  END IF;
  IF r.status <> 'ordered' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'This reorder was already received or cancelled.';
  END IF;
  SELECT * INTO p FROM public.products WHERE id = r.product_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'This product is no longer active.';
  END IF;
  IF p_expiry_date IS NOT NULL AND p_expiry_date <= (statement_timestamp() AT TIME ZONE 'Asia/Manila')::date THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Expiration must be later than today.';
  END IF;

  INSERT INTO public.inventory_documents(id, kind, status, actor_id, actor_name, actor_role, reason, request_payload)
  VALUES (doc_id, 'reorder_receive', 'completed', p_actor, actor_name, p_role,
    'Automatic reorder received.', jsonb_build_object(
      'reorder_id', p_id, 'quantity', r.quantity, 'expiry_date', p_expiry_date,
      'purchase_price', p_purchase_price, 'selling_price', p.price
    ));
  INSERT INTO public.inventory_batches(product_id, batch_code, expiry_date, purchase_price, store_qty)
  VALUES (r.product_id, 'REORDER-' || p_id::text, p_expiry_date, p_purchase_price, r.quantity)
  RETURNING * INTO b;
  PERFORM set_config('inventory.stock_write', 'on', true);
  UPDATE public.products SET stock = stock + r.quantity WHERE id = r.product_id;
  INSERT INTO public.inventory_document_items(document_id, product_id, batch_id, quantity, batch_code, expiry_date)
  VALUES (doc_id, r.product_id, b.id, r.quantity, b.batch_code, b.expiry_date);
  INSERT INTO public.inventory_movements(batch_id, document_id, actor_id, kind, warehouse_delta, store_delta, warehouse_after, store_after)
  VALUES (b.id, doc_id, p_actor, 'reorder_receive', 0, r.quantity, 0, r.quantity);
  UPDATE public.reorder_orders
  SET status = 'received', purchase_price = p_purchase_price, received_at = now(),
      received_by = p_actor, receive_document_id = doc_id
  WHERE id = p_id;
  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_receive_reorder(uuid, date, numeric, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_receive_reorder(uuid, date, numeric, integer, text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
