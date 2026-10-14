BEGIN;
CREATE OR REPLACE FUNCTION public.inventory_edit_expiry(
 p_id uuid, p_batch_id uuid, p_expiry date, p_expected date,
 p_reason text, p_actor integer, p_confirm_reactivation boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.inventory_batches%ROWTYPE; a public.audit_logs%ROWTYPE;
 actor_name text; product integer;
BEGIN
 SELECT name INTO actor_name FROM public.admins
 WHERE id=p_actor AND status='active' FOR SHARE;
 IF actor_name IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT403', MESSAGE='Active administrator required.'; END IF;
 IF p_id IS NULL OR p_batch_id IS NULL OR p_expiry IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
  RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Batch, expiry date and a correction reason of 8 to 500 characters are required.';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO a FROM public.audit_logs WHERE id=p_id;
 IF FOUND THEN
  IF a.actor_id<>p_actor::text OR a.action<>'Edit batch expiry' OR a.entity_id<>p_batch_id::text
   OR a.details->>'new_expiry_date'<>p_expiry::text OR a.details->>'reason'<>trim(p_reason)
   OR (a.details->>'old_expiry_date')::date IS DISTINCT FROM p_expected THEN
   RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Request reference already used.';
  END IF;
  RETURN p_id;
 END IF;
 SELECT product_id INTO product FROM public.inventory_batches WHERE id=p_batch_id;
 PERFORM 1 FROM public.products WHERE id=product FOR UPDATE;
 SELECT * INTO b FROM public.inventory_batches WHERE id=p_batch_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Batch not found.'; END IF;
 IF b.expiry_date IS DISTINCT FROM p_expected THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Expiry changed. Refresh and review the batch again.'; END IF;
 IF b.expiry_date IS NOT DISTINCT FROM p_expiry THEN RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Choose a different expiry date.'; END IF;
 IF b.expiry_date < (now() AT TIME ZONE 'Asia/Manila')::date
  AND p_expiry >= (now() AT TIME ZONE 'Asia/Manila')::date AND NOT coalesce(p_confirm_reactivation,false) THEN
  RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Verify the printed batch expiry and explicitly confirm the correction before reactivating an expired batch.';
 END IF;
 UPDATE public.inventory_batches SET expiry_date=p_expiry WHERE id=p_batch_id;
 INSERT INTO public.audit_logs(id,actor_id,actor_name,actor_role,action,entity_type,entity_id,outcome,details,finished_at)
 VALUES(p_id,p_actor::text,actor_name,'admin','Edit batch expiry','Inventory',p_batch_id::text,'succeeded',
  jsonb_build_object('batch_code',b.batch_code,'product_id',b.product_id,'old_expiry_date',b.expiry_date,
   'new_expiry_date',p_expiry,'reason',trim(p_reason),'reactivation_confirmed',coalesce(p_confirm_reactivation,false)),now());
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.inventory_edit_expiry(uuid,uuid,date,date,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_edit_expiry(uuid,uuid,date,date,text,integer,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
