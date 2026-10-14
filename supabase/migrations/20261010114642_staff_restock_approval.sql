-- Proposed migration: review before applying. Existing stock/history remain unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.inventory_simple_command(p_id uuid,p_kind text,p_payload jsonb,p_actor integer,p_role text)
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
 VALUES(p_id,p_kind,CASE WHEN p_kind='restock' AND p_role='staff' THEN 'pending' ELSE 'completed' END,p_actor,actor_name,p_role,reason,p_payload);
 IF p_kind='edit_product' THEN
  UPDATE public.products SET name=trim(p_payload->>'name'),category=trim(p_payload->>'category'),price=(p_payload->>'price')::numeric,
   barcode=nullif(trim(p_payload->>'barcode'),''),minimum_stock=(p_payload->>'minimum_stock')::integer WHERE id=pid;
  RETURN p_id;
 ELSIF p_kind IN ('create_product','restock') THEN
  qty:=(p_payload->>'quantity')::integer; exp:=(p_payload->>'expiry_date')::date;
  IF qty IS NULL OR qty<0 OR qty>1000000 OR (p_kind='restock' AND qty=0) THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Enter a valid quantity.'; END IF;
  IF productrow.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Only active products can be restocked.'; END IF;
  IF exp<=today THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Expiration must be later than today.'; END IF;
  IF p_kind='restock' AND p_role='staff' THEN
   INSERT INTO public.inventory_document_items(document_id,product_id,quantity,batch_code,expiry_date)
    VALUES(p_id,pid,qty,'STOCK-'||p_id::text,exp);
   RETURN p_id;
  END IF;
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

-- Dedicated entry point: an updated backend cannot silently use the old
-- immediate staff-restock behavior when this migration is not installed.
CREATE FUNCTION public.inventory_submit_restock(p_id uuid,p_kind text,p_payload jsonb,p_actor integer,p_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_kind IS DISTINCT FROM 'restock' THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Restock action required.'; END IF;
 RETURN public.inventory_simple_command(p_id,p_kind,p_payload,p_actor,p_role);
END $$;

CREATE FUNCTION public.inventory_review_restock(p_id uuid,p_approve boolean,p_reason text,p_actor integer)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE doc public.inventory_documents%ROWTYPE; item public.inventory_document_items%ROWTYPE;
 bid uuid; balance integer; product_status text;
BEGIN
 PERFORM 1 FROM public.admins WHERE id=p_actor AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='Active admin access required.'; END IF;
 IF p_id IS NULL OR p_approve IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='A request and review decision are required.'; END IF;
 IF NOT p_approve AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Enter a rejection reason (3 to 500 characters).';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO doc FROM public.inventory_documents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR doc.kind<>'restock' OR doc.actor_role<>'staff' THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='Staff stock request not found.'; END IF;
 IF doc.status<>'pending' THEN
  IF doc.reviewed_by IS NOT NULL AND doc.status=(CASE WHEN p_approve THEN 'completed' ELSE 'rejected' END) THEN RETURN p_id; END IF;
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This stock request has already been reviewed.';
 END IF;
 IF p_approve THEN
  SELECT * INTO item FROM public.inventory_document_items WHERE document_id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Stock request details are missing.'; END IF;
  SELECT stock,status INTO balance,product_status FROM public.products WHERE id=item.product_id FOR UPDATE;
  IF NOT FOUND OR product_status<>'active' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This product is no longer active. Reject the request.'; END IF;
  IF item.expiry_date<=(statement_timestamp() AT TIME ZONE 'Asia/Manila')::date THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='The requested stock has expired. Reject it and ask staff to submit verified stock.';
  END IF;
  INSERT INTO public.inventory_batches(product_id,batch_code,expiry_date,store_qty)
   VALUES(item.product_id,item.batch_code,item.expiry_date,item.quantity) RETURNING id INTO bid;
  UPDATE public.inventory_document_items SET batch_id=bid WHERE id=item.id;
  PERFORM set_config('inventory.stock_write','on',true);
  UPDATE public.products SET stock=stock+item.quantity WHERE id=item.product_id;
  INSERT INTO public.inventory_movements(batch_id,document_id,actor_id,kind,warehouse_delta,store_delta,warehouse_after,store_after)
   VALUES(bid,p_id,p_actor,'restock',0,item.quantity,0,item.quantity);
 END IF;
 UPDATE public.inventory_documents SET status=CASE WHEN p_approve THEN 'completed' ELSE 'rejected' END,
  reviewed_by=p_actor,reviewed_at=now(),reason=CASE WHEN p_approve THEN reason ELSE trim(p_reason) END WHERE id=p_id;
 RETURN p_id;
END $$;

CREATE FUNCTION public.inventory_restock_approval_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT true $$;
CREATE INDEX inventory_staff_restock_requests ON public.inventory_documents(actor_role,actor_id,status,created_at DESC) WHERE kind='restock';
REVOKE ALL ON FUNCTION public.inventory_submit_restock(uuid,text,jsonb,integer,text),public.inventory_review_restock(uuid,boolean,text,integer),public.inventory_restock_approval_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_submit_restock(uuid,text,jsonb,integer,text),public.inventory_review_restock(uuid,boolean,text,integer),public.inventory_restock_approval_ready() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

