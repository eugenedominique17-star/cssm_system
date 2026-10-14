-- Proposed: owner review required. Existing logs and stock remain unchanged.
BEGIN;
CREATE FUNCTION public.inventory_audit_product_state(p_product integer) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'price',p.price,
  'barcode',p.barcode,'minimum_stock',p.minimum_stock,'physical_quantity',p.stock,
  'available_quantity',coalesce((SELECT sum(b.store_qty) FROM public.inventory_batches b WHERE b.product_id=p.id
   AND (b.expiry_date IS NULL OR b.expiry_date>(statement_timestamp() AT TIME ZONE 'Asia/Manila')::date)),0))
 FROM public.products p WHERE p.id=p_product
$$;

CREATE FUNCTION public.inventory_audited_command(p_audit_id uuid,p_id uuid,p_kind text,p_payload jsonb,p_actor integer,p_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.audit_logs%ROWTYPE; old_doc public.inventory_documents%ROWTYPE; doc public.inventory_documents%ROWTYPE;
 old_batch public.inventory_batches%ROWTYPE; batch public.inventory_batches%ROWTYPE;
 pid integer; bid uuid; before_state jsonb; after_state jsonb; changes jsonb:='[]'::jsonb;
 key text; label text; reviewer text; old_status text; new_status text; replayed boolean; result uuid; message text;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('restock','correct','remove_expired','create_product','edit_product','approve_restock','reject_restock') THEN
  RAISE EXCEPTION USING ERRCODE='PT400',MESSAGE='Invalid audited inventory action.';
 END IF;
 IF p_role IS NULL OR p_role NOT IN ('admin','staff') OR (p_kind<>'restock' AND p_role<>'admin') THEN
  RAISE EXCEPTION USING ERRCODE='PT403',MESSAGE='Admin access required for this action.';
 END IF;
 SELECT * INTO a FROM public.audit_logs WHERE id=p_audit_id FOR UPDATE;
 IF NOT FOUND OR a.actor_id IS DISTINCT FROM p_actor::text OR a.actor_role IS DISTINCT FROM p_role
  OR a.entity_type<>'Inventory' OR a.action IS DISTINCT FROM ('Inventory '||p_kind) OR a.outcome<>'pending' THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='A matching pending audit record is required.';
 END IF;
 -- Match the underlying operations' lock order, keeping both snapshots and
 -- the stock mutation in one transaction. Sales also lock the product row.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO old_doc FROM public.inventory_documents WHERE id=p_id FOR UPDATE;
 pid:=(p_payload->>'product_id')::integer;
 bid:=(p_payload->>'batch_id')::uuid;
 IF bid IS NOT NULL THEN SELECT product_id INTO pid FROM public.inventory_batches WHERE id=bid; END IF;
 IF pid IS NULL AND old_doc.id IS NOT NULL THEN
  SELECT product_id,batch_id INTO pid,bid FROM public.inventory_document_items WHERE document_id=p_id ORDER BY id LIMIT 1;
  IF pid IS NULL THEN SELECT b.product_id,b.id INTO pid,bid FROM public.inventory_movements m JOIN public.inventory_batches b ON b.id=m.batch_id WHERE m.document_id=p_id ORDER BY m.id LIMIT 1; END IF;
 END IF;
 IF pid IS NOT NULL THEN PERFORM 1 FROM public.products WHERE id=pid FOR UPDATE; END IF;
 before_state:=public.inventory_audit_product_state(pid);
 SELECT * INTO old_batch FROM public.inventory_batches WHERE id=bid;
 replayed:=old_doc.id IS NOT NULL AND (p_kind NOT IN ('approve_restock','reject_restock') OR old_doc.status<>'pending');
 IF p_kind IN ('approve_restock','reject_restock') THEN
  result:=public.inventory_review_restock(p_id,p_kind='approve_restock',coalesce(p_payload->>'reason',''),p_actor);
 ELSE result:=public.inventory_simple_command(p_id,p_kind,p_payload,p_actor,p_role);
 END IF;
 SELECT * INTO doc FROM public.inventory_documents WHERE id=p_id;
 IF pid IS NULL THEN
  SELECT b.product_id,b.id INTO pid,bid FROM public.inventory_movements m JOIN public.inventory_batches b ON b.id=m.batch_id WHERE m.document_id=p_id ORDER BY m.id LIMIT 1;
 END IF;
 IF bid IS NULL THEN SELECT batch_id INTO bid FROM public.inventory_document_items WHERE document_id=p_id ORDER BY id LIMIT 1; END IF;
 SELECT * INTO batch FROM public.inventory_batches WHERE id=bid;
 after_state:=public.inventory_audit_product_state(pid);
 IF p_kind IN ('edit_product','create_product') THEN
  FOREACH key IN ARRAY ARRAY['name','category','price','barcode','minimum_stock'] LOOP
   IF (before_state->key) IS DISTINCT FROM (after_state->key) THEN
    label:=CASE key WHEN 'name' THEN 'Product name' WHEN 'category' THEN 'Category' WHEN 'price' THEN 'Selling price (PHP)' WHEN 'barcode' THEN 'Barcode / SKU' ELSE 'Minimum stock level' END;
    changes:=changes||jsonb_build_array(jsonb_build_object('field',key,'label',label,'before',before_state->key,'after',after_state->key));
   END IF;
  END LOOP;
 END IF;
 IF p_kind<>'edit_product' THEN
  changes:=changes||jsonb_build_array(
   jsonb_build_object('field','available_quantity','label','Available stock (units)','before',coalesce((before_state->>'available_quantity')::integer,0),'after',(after_state->>'available_quantity')::integer),
   jsonb_build_object('field','physical_quantity','label','Total physical stock (units)','before',coalesce((before_state->>'physical_quantity')::integer,0),'after',(after_state->>'physical_quantity')::integer));
 END IF;
 IF p_kind IN ('correct','remove_expired') THEN
  changes:=changes||jsonb_build_array(jsonb_build_object('field','batch_quantity','label','Selected batch (units)','before',old_batch.store_qty,'after',batch.store_qty));
 END IF;
 IF doc.actor_role='staff' AND doc.kind='restock' THEN
  old_status:=CASE old_doc.status WHEN 'completed' THEN 'Approved' WHEN 'pending' THEN 'Pending' WHEN 'rejected' THEN 'Rejected' ELSE 'Not submitted' END;
  new_status:=CASE doc.status WHEN 'completed' THEN 'Approved' WHEN 'pending' THEN 'Pending' ELSE 'Rejected' END;
  changes:=changes||jsonb_build_array(jsonb_build_object('field','request_status','label','Request status','before',old_status,'after',new_status));
 END IF;
 IF doc.reviewed_by IS NOT NULL THEN SELECT name INTO reviewer FROM public.admins WHERE id=doc.reviewed_by; END IF;
 message:=CASE WHEN replayed THEN 'This request was already processed. No additional changes were made.'
  WHEN p_kind='restock' AND p_role='staff' THEN 'Stock request submitted. Available stock is unchanged until admin approval.'
  WHEN p_kind='approve_restock' THEN 'Stock request approved. The requested quantity was added once.'
  WHEN p_kind='reject_restock' THEN 'Stock request rejected. Available stock is unchanged.'
  WHEN p_kind='restock' THEN 'Stock added successfully.' WHEN p_kind='correct' THEN 'Stock corrected to the actual counted quantity.'
  WHEN p_kind='remove_expired' THEN 'Expired stock removed. Unexpired batches were preserved.'
  WHEN p_kind='create_product' THEN 'Product created with its initial stock.' ELSE 'Product details updated.' END;
 UPDATE public.audit_logs SET outcome='succeeded',entity_id=p_id::text,finished_at=clock_timestamp(),
  details=jsonb_build_object('snapshot_version',1,'product',jsonb_build_object('id',pid,'name',after_state->>'name'),
   'changes',changes,'replayed',replayed,'result',message,'reason',doc.reason,
   'batch_code',batch.batch_code,'expiry_date',coalesce(batch.expiry_date,(doc.request_payload->>'expiry_date')::date),
   'quantity_requested',CASE WHEN doc.kind='restock' THEN (doc.request_payload->>'quantity')::integer ELSE NULL END,
   'requested_by',jsonb_build_object('id',doc.actor_id,'name',doc.actor_name,'role',doc.actor_role),
   'reviewed_by',CASE WHEN doc.reviewed_by IS NOT NULL THEN jsonb_build_object('id',doc.reviewed_by,'name',reviewer,'role','admin') ELSE NULL END)
 WHERE id=p_audit_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.inventory_audit_product_state(integer),public.inventory_audited_command(uuid,uuid,text,jsonb,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_audit_product_state(integer),public.inventory_audited_command(uuid,uuid,text,jsonb,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
