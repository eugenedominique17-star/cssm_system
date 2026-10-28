-- Record Admin-only damaged stock and supplier returns using actual batch cost.
BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_loss_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('damage', 'supplier_return')),
  product_id integer NOT NULL REFERENCES public.products(id),
  batch_id uuid NOT NULL REFERENCES public.inventory_batches(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost > 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  supplier_reference text,
  actor_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_loss_records_created ON public.inventory_loss_records(created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_loss_records_kind ON public.inventory_loss_records(kind, created_at DESC);
ALTER TABLE public.inventory_loss_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_loss_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.inventory_loss_records TO authenticated;
DROP POLICY IF EXISTS "Admins can read inventory loss records" ON public.inventory_loss_records;
CREATE POLICY "Admins can read inventory loss records" ON public.inventory_loss_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admins a
    WHERE a.auth_user_id = (SELECT auth.uid()) AND a.status = 'active'
  ));

ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_kind_check;
ALTER TABLE public.inventory_documents ADD CONSTRAINT inventory_documents_kind_check CHECK(kind IN
 ('delivery','transfer','adjustment','reversal','restock','correct','remove_expired','create_product','edit_product','reorder_receive','damage','supplier_return'));

CREATE OR REPLACE FUNCTION public.inventory_record_loss(
  p_id uuid, p_kind text, p_payload jsonb, p_actor integer, p_role text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  b public.inventory_batches%ROWTYPE;
  p public.products%ROWTYPE;
  actor_name text;
  doc_id uuid := gen_random_uuid();
  prior public.inventory_loss_records%ROWTYPE;
  qty integer := (p_payload->>'quantity')::integer;
  cost numeric := (p_payload->>'unit_cost')::numeric;
  reason text := trim(coalesce(p_payload->>'reason',''));
  supplier_ref text := nullif(trim(p_payload->>'supplier_reference'),'');
BEGIN
  IF p_role <> 'admin' THEN RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='Admin access required.'; END IF;
  SELECT a.name INTO actor_name FROM public.admins a WHERE a.id=p_actor AND a.status='active' FOR SHARE;
  IF actor_name IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='Active admin account required.'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('damage','supplier_return') OR p_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR qty IS NULL OR qty <= 0 OR cost IS NULL OR cost <= 0 OR cost <> round(cost,2)
    OR length(reason) < 3 THEN
    RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Enter a valid quantity, actual batch cost, and reason.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  SELECT * INTO prior FROM public.inventory_loss_records WHERE request_id=p_id FOR UPDATE;
  IF FOUND THEN
    IF prior.kind<>p_kind OR prior.batch_id<>(p_payload->>'batch_id')::uuid OR prior.quantity<>qty
      OR prior.unit_cost<>cost OR prior.reason<>reason OR prior.supplier_reference IS DISTINCT FROM supplier_ref
      OR prior.actor_id<>p_actor THEN
      RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This inventory reference was already used with different details.';
    END IF;
    RETURN p_id;
  END IF;
  SELECT * INTO b FROM public.inventory_batches WHERE id=(p_payload->>'batch_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='Stock batch not found.'; END IF;
  IF qty > b.store_qty THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Quantity exceeds available batch stock.'; END IF;
  IF b.purchase_price IS NOT NULL AND cost <> b.purchase_price THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Unit cost must match the actual cost recorded for this batch.';
  END IF;
  SELECT * INTO p FROM public.products WHERE id=b.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='Product not found.'; END IF;
  INSERT INTO public.inventory_documents(id,kind,status,actor_id,actor_name,actor_role,reason,request_payload)
  VALUES(doc_id,p_kind,'completed',p_actor,actor_name,p_role,reason,p_payload);
  INSERT INTO public.inventory_loss_records(request_id,kind,product_id,batch_id,quantity,unit_cost,reason,supplier_reference,actor_id)
  VALUES(p_id,p_kind,b.product_id,b.id,qty,cost,reason,supplier_ref,p_actor);
  PERFORM set_config('inventory.stock_write','on',true);
  UPDATE public.inventory_batches SET store_qty=store_qty-qty WHERE id=b.id;
  UPDATE public.products SET stock=stock-qty WHERE id=p.id;
  INSERT INTO public.inventory_document_items(document_id,product_id,batch_id,quantity,batch_code,expiry_date)
  VALUES(doc_id,p.id,b.id,qty,b.batch_code,b.expiry_date);
  INSERT INTO public.inventory_movements(batch_id,document_id,actor_id,kind,warehouse_delta,store_delta,warehouse_after,store_after)
  VALUES(b.id,doc_id,p_actor,p_kind,0,-qty,0,b.store_qty-qty);
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.inventory_loss_report(p_start date, p_end date)
RETURNS TABLE(id uuid, kind text, product_id integer, product_name text, batch_code text, quantity integer, total_cost numeric, reason text, supplier_reference text, created_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT r.id,r.kind,r.product_id,p.name,b.batch_code,r.quantity,
    (r.quantity*r.unit_cost)::numeric(14,2),r.reason,r.supplier_reference,r.created_at
  FROM public.inventory_loss_records r
  JOIN public.products p ON p.id=r.product_id
  JOIN public.inventory_batches b ON b.id=r.batch_id
  WHERE r.created_at >= (p_start::timestamp AT TIME ZONE 'Asia/Manila')
    AND r.created_at < ((p_end + 1)::timestamp AT TIME ZONE 'Asia/Manila')
  ORDER BY r.created_at DESC,r.id DESC
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='inventory_loss_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_loss_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.inventory_record_loss(uuid,text,jsonb,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.inventory_loss_report(date,date) FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.inventory_loss_records TO service_role;
GRANT EXECUTE ON FUNCTION public.inventory_record_loss(uuid,text,jsonb,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.inventory_loss_report(date,date) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
