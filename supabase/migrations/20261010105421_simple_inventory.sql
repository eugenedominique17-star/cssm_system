-- PROPOSED: apply only after owner approval, during a brief checkout pause.
BEGIN;
LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.inventory_batches IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.products ADD COLUMN barcode text;
ALTER TABLE public.products ADD COLUMN minimum_stock integer NOT NULL DEFAULT 10 CHECK (minimum_stock >= 0);
CREATE UNIQUE INDEX products_barcode_unique ON public.products(lower(trim(barcode))) WHERE nullif(trim(barcode),'') IS NOT NULL;
CREATE INDEX products_inventory_identity ON public.products(lower(trim(name)),lower(trim(category)));
ALTER TABLE public.inventory_documents DROP CONSTRAINT inventory_documents_kind_check;
ALTER TABLE public.inventory_documents ADD CONSTRAINT inventory_documents_kind_check CHECK(kind IN
 ('delivery','transfer','adjustment','reversal','restock','correct','remove_expired','create_product','edit_product'));

-- Preserve every unit, including expired units, and keep the old movement ledger.
INSERT INTO public.inventory_movements(batch_id,kind,warehouse_delta,store_delta,warehouse_after,store_after)
 SELECT id,'consolidated',-warehouse_qty,warehouse_qty,0,store_qty+warehouse_qty
 FROM public.inventory_batches WHERE warehouse_qty>0;
UPDATE public.inventory_batches SET store_qty=store_qty+warehouse_qty,warehouse_qty=0 WHERE warehouse_qty>0;
SELECT set_config('inventory.stock_write','on',true);
UPDATE public.products p SET stock=(SELECT coalesce(sum(b.store_qty),0) FROM public.inventory_batches b WHERE b.product_id=p.id);

-- Protect identifiers even through existing product-management routes.
CREATE FUNCTION public.inventory_product_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.category IS NOT DISTINCT FROM OLD.category AND NEW.barcode IS NOT DISTINCT FROM OLD.barcode THEN RETURN NEW; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(trim(NEW.name))||'|'||lower(trim(NEW.category)),1));
 IF EXISTS(SELECT 1 FROM public.products p WHERE p.id<>NEW.id AND lower(trim(p.name))=lower(trim(NEW.name)) AND lower(trim(p.category))=lower(trim(NEW.category))) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This product already exists in this category. Use Restock instead.';
 END IF;
 NEW.barcode:=nullif(trim(NEW.barcode),'');
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_product_identity BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.inventory_product_identity();

CREATE FUNCTION public.inventory_simple_command(p_id uuid,p_kind text,p_payload jsonb,p_actor integer,p_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor_name text; doc public.inventory_documents%ROWTYPE; b public.inventory_batches%ROWTYPE;
 pid integer; bid uuid; qty integer; delta integer; exp date; reason text; productrow public.products%ROWTYPE;
 today date:=(statement_timestamp() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
 IF p_role='admin' THEN SELECT a.name INTO actor_name FROM public.admins a WHERE id=p_actor AND status='active' FOR SHARE;
 ELSIF p_role='staff' THEN SELECT s.name INTO actor_name FROM public.staff s WHERE id=p_actor AND status='active' FOR SHARE;
 END IF;
 IF actor_name IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='Active staff or admin account required.'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('create_product','edit_product','restock','correct','remove_expired') OR p_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Invalid inventory request.';
 END IF;
 IF p_kind<>'restock' AND p_role<>'admin' THEN RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='Admin access required.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO doc FROM public.inventory_documents WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF doc.actor_id<>p_actor OR doc.actor_role<>p_role OR doc.kind<>p_kind OR doc.request_payload<>p_payload THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This reference was already used with different details.';
  END IF;
  RETURN p_id;
 END IF;
 reason:=trim(coalesce(p_payload->>'reason',''));
 IF p_kind IN ('correct','remove_expired') AND length(reason)<3 THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Enter a reason.'; END IF;
 IF p_kind IN ('create_product','edit_product') THEN
  IF length(trim(coalesce(p_payload->>'name','')))<2 OR length(trim(coalesce(p_payload->>'category','')))<2
   OR coalesce((p_payload->>'price')::numeric,0)<=0 OR coalesce((p_payload->>'minimum_stock')::integer,-1)<0 THEN
   RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Product name, category, price and minimum stock are required.';
  END IF;
 END IF;
 IF p_kind='create_product' THEN
  INSERT INTO public.products(name,category,price,stock,status,created_by,barcode,minimum_stock)
   VALUES(trim(p_payload->>'name'),trim(p_payload->>'category'),(p_payload->>'price')::numeric,0,'active',p_actor,nullif(trim(p_payload->>'barcode'),''),(p_payload->>'minimum_stock')::integer) RETURNING id INTO pid;
 ELSE
  pid:=(p_payload->>'product_id')::integer;
  IF p_kind IN ('correct','remove_expired') THEN
   bid:=(p_payload->>'batch_id')::uuid;
   SELECT product_id INTO pid FROM public.inventory_batches WHERE id=bid;
  END IF;
 END IF;
 SELECT * INTO productrow FROM public.products WHERE id=pid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='Product not found.'; END IF;
 INSERT INTO public.inventory_documents(id,kind,status,actor_id,actor_name,actor_role,reason,request_payload)
 VALUES(p_id,p_kind,'completed',p_actor,actor_name,p_role,reason,p_payload);
 IF p_kind='edit_product' THEN
  UPDATE public.products SET name=trim(p_payload->>'name'),category=trim(p_payload->>'category'),price=(p_payload->>'price')::numeric,
   barcode=nullif(trim(p_payload->>'barcode'),''),minimum_stock=(p_payload->>'minimum_stock')::integer WHERE id=pid;
  RETURN p_id;
 ELSIF p_kind IN ('create_product','restock') THEN
  qty:=(p_payload->>'quantity')::integer; exp:=(p_payload->>'expiry_date')::date;
  IF qty IS NULL OR qty<0 OR qty>1000000 OR (p_kind='restock' AND qty=0) THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Enter a valid quantity.'; END IF;
  IF productrow.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Only active products can be restocked.'; END IF;
  IF exp<=today THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Expiration must be later than today.'; END IF;
  INSERT INTO public.inventory_batches(product_id,batch_code,expiry_date,store_qty)
   VALUES(pid,'STOCK-'||p_id::text,exp,qty) RETURNING * INTO b;
  bid:=b.id; delta:=qty;
 ELSE
  SELECT * INTO b FROM public.inventory_batches WHERE id=bid FOR UPDATE;
  IF b.store_qty IS DISTINCT FROM (p_payload->>'expected_quantity')::integer THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Stock changed. Close this form, refresh and count again.';
  END IF;
  IF p_kind='remove_expired' THEN
   IF b.expiry_date IS NULL OR b.expiry_date>today OR b.store_qty=0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Select expired stock with remaining units.'; END IF;
   qty:=0;
  ELSE qty:=(p_payload->>'actual_quantity')::integer;
  END IF;
  IF qty IS NULL OR qty<0 OR qty>1000000 THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Enter a valid actual count.'; END IF;
  delta:=qty-b.store_qty;
  IF delta=0 THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='The actual count already matches.'; END IF;
  UPDATE public.inventory_batches SET store_qty=qty WHERE id=bid;
 END IF;
 PERFORM set_config('inventory.stock_write','on',true);
 UPDATE public.products SET stock=stock+delta WHERE id=pid;
 IF delta<>0 THEN
  INSERT INTO public.inventory_document_items(document_id,product_id,batch_id,quantity,batch_code,expiry_date)
   VALUES(p_id,pid,bid,abs(delta),b.batch_code,b.expiry_date);
 END IF;
 INSERT INTO public.inventory_movements(batch_id,document_id,actor_id,kind,warehouse_delta,store_delta,warehouse_after,store_after)
 VALUES(bid,p_id,p_actor,p_kind,0,delta,0,qty);
 RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.inventory_available_stock() RETURNS TABLE(product_id integer, available_stock bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT product_id,coalesce(sum(store_qty) FILTER(WHERE expiry_date IS NULL OR expiry_date>(statement_timestamp() AT TIME ZONE 'Asia/Manila')::date),0)
 FROM public.inventory_batches GROUP BY product_id
$$;
CREATE OR REPLACE FUNCTION public.inventory_allocate_sale() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b record; remaining integer:=NEW.quantity; take integer; actor integer;
BEGIN
 PERFORM 1 FROM public.products WHERE id=NEW.product_id FOR UPDATE;
 SELECT staff_id INTO actor FROM public.transactions WHERE id=NEW.transaction_id;
 FOR b IN SELECT * FROM public.inventory_batches WHERE product_id=NEW.product_id AND store_qty>0
  AND (expiry_date IS NULL OR expiry_date>(statement_timestamp() AT TIME ZONE 'Asia/Manila')::date)
  ORDER BY expiry_date NULLS LAST,created_at,id FOR UPDATE
 LOOP
  take:=least(remaining,b.store_qty);
  UPDATE public.inventory_batches SET store_qty=store_qty-take WHERE id=b.id;
  INSERT INTO public.inventory_movements(batch_id,transaction_id,actor_id,kind,warehouse_delta,store_delta,warehouse_after,store_after)
   VALUES(b.id,NEW.transaction_id,actor,'sale',0,-take,0,b.store_qty-take);
  remaining:=remaining-take; EXIT WHEN remaining=0;
 END LOOP;
 IF remaining>0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Insufficient available stock. Restock this product in Inventory.'; END IF;
 PERFORM set_config('inventory.stock_write','on',true);
 RETURN NEW;
END $$;
-- Retain historical documents while disabling obsolete stock-writing workflows.
CREATE OR REPLACE FUNCTION public.inventory_command(p_id uuid,p_kind text,p_payload jsonb,p_actor integer,p_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Use Inventory Restock or Correct Stock. Delivery and transfer actions are retired.'; END $$;
CREATE FUNCTION public.inventory_simple_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.inventory_simple_command(uuid,text,jsonb,integer,text),public.inventory_simple_ready(),public.inventory_product_identity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_simple_command(uuid,text,jsonb,integer,text),public.inventory_simple_ready(),public.inventory_product_identity() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
