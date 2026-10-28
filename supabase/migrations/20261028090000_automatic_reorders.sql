-- Create a single automatic reorder when a sale brings stock to exactly 10.
-- The order is marked ordered immediately, but stock is added only on receipt.
BEGIN;

CREATE TABLE IF NOT EXISTS public.reorder_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer NOT NULL REFERENCES public.products(id),
  reorder_threshold integer NOT NULL DEFAULT 10 CHECK (reorder_threshold = 10),
  quantity integer NOT NULL DEFAULT 50 CHECK (quantity > 0),
  triggered_stock integer NOT NULL DEFAULT 10 CHECK (triggered_stock = 10),
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'received', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  received_by integer,
  receive_document_id uuid,
  CONSTRAINT reorder_receive_consistency CHECK (
    (status = 'received' AND received_at IS NOT NULL AND received_by IS NOT NULL)
    OR status <> 'received'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS reorder_orders_active_product
  ON public.reorder_orders(product_id)
  WHERE status = 'ordered';
CREATE INDEX IF NOT EXISTS reorder_orders_status_created
  ON public.reorder_orders(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_automatic_reorder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.stock > 10 AND NEW.stock = 10 THEN
    INSERT INTO public.reorder_orders(product_id, reorder_threshold, quantity, triggered_stock)
    VALUES (NEW.id, 10, 50, 10)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_automatic_reorder ON public.products;
CREATE TRIGGER products_automatic_reorder
AFTER UPDATE OF stock ON public.products
FOR EACH ROW
WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
EXECUTE FUNCTION public.create_automatic_reorder();

ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_kind_check;
ALTER TABLE public.inventory_documents ADD CONSTRAINT inventory_documents_kind_check CHECK(kind IN
 ('delivery','transfer','adjustment','reversal','restock','correct','remove_expired','create_product','edit_product','reorder_receive'));

CREATE OR REPLACE FUNCTION public.inventory_reorder_orders()
RETURNS TABLE (
  id uuid,
  product_id integer,
  product_name text,
  quantity integer,
  triggered_stock integer,
  status text,
  created_at timestamptz,
  received_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT r.id, r.product_id, p.name, r.quantity, r.triggered_stock, r.status, r.created_at, r.received_at
  FROM public.reorder_orders r
  JOIN public.products p ON p.id = r.product_id
  ORDER BY r.created_at DESC, r.id DESC
$$;

CREATE OR REPLACE FUNCTION public.inventory_receive_reorder(
  p_id uuid,
  p_expiry_date date,
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
  IF p_role = 'admin' THEN
    SELECT a.name INTO actor_name FROM public.admins a WHERE a.id = p_actor AND a.status = 'active' FOR SHARE;
  ELSIF p_role = 'staff' THEN
    SELECT s.name INTO actor_name FROM public.staff s WHERE s.id = p_actor AND s.status = 'active' FOR SHARE;
  END IF;
  IF actor_name IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT403', MESSAGE = 'Active staff or admin account required.';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'A reorder is required.';
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
    'Automatic reorder received.', jsonb_build_object('reorder_id', p_id, 'quantity', r.quantity, 'expiry_date', p_expiry_date));
  INSERT INTO public.inventory_batches(product_id, batch_code, expiry_date, store_qty)
  VALUES (r.product_id, 'REORDER-' || p_id::text, p_expiry_date, r.quantity)
  RETURNING * INTO b;
  PERFORM set_config('inventory.stock_write', 'on', true);
  UPDATE public.products SET stock = stock + r.quantity WHERE id = r.product_id;
  INSERT INTO public.inventory_document_items(document_id, product_id, batch_id, quantity, batch_code, expiry_date)
  VALUES (doc_id, r.product_id, b.id, r.quantity, b.batch_code, b.expiry_date);
  INSERT INTO public.inventory_movements(batch_id, document_id, actor_id, kind, warehouse_delta, store_delta, warehouse_after, store_after)
  VALUES (b.id, doc_id, p_actor, 'reorder_receive', 0, r.quantity, 0, r.quantity);
  UPDATE public.reorder_orders
  SET status = 'received', received_at = now(), received_by = p_actor, receive_document_id = doc_id
  WHERE id = p_id;
  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_reorder_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inventory_receive_reorder(uuid, date, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_reorder_orders() TO service_role;
GRANT EXECUTE ON FUNCTION public.inventory_receive_reorder(uuid, date, integer, text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
