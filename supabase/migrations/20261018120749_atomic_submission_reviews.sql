-- Backend-only, atomic review. The row lock serializes competing reviewers.
CREATE OR REPLACE FUNCTION public.review_submission_atomic(
  p_id integer, p_status text, p_notes text, p_actor_id integer, p_password_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  s public.pending_submissions%ROWTYPE;
  saved public.pending_submissions%ROWTYPE;
  d jsonb;
  requester text;
  target integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id=p_actor_id AND status='active') THEN
    RAISE EXCEPTION USING ERRCODE='PT403', MESSAGE='An active admin is required.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected') OR length(p_notes)>2000 THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Invalid submission review.';
  END IF;
  SELECT * INTO s FROM public.pending_submissions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Submission not found.'; END IF;
  IF s.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='This submission has already been reviewed.';
  END IF;
  d := s.data;
  IF s.type='walk_in_order' THEN
    RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Review walk-in orders through Order Management.';
  END IF;
  IF p_status='approved' THEN
    IF (s.type='stock_update' AND d ? 'stock') OR (s.type='product' AND coalesce((d->>'stock')::numeric,0)<>0) THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Use Inventory for stock changes.';
    END IF;
    CASE s.type
      WHEN 'product' THEN
        INSERT INTO public.products(name,description,price,stock,category,image_url,expiry_date,status,created_by)
        VALUES(d->>'name',d->>'description',(d->>'price')::numeric,0,d->>'category',nullif(d->>'image_url',''),NULL,'active',s.submitted_by);
      WHEN 'promo' THEN
        IF d ? 'promo_id' THEN
          UPDATE public.promos SET
            title=CASE WHEN d ? 'title' THEN d->>'title' ELSE title END,
            description=CASE WHEN d ? 'description' THEN d->>'description' ELSE description END,
            discount_type=CASE WHEN d ? 'discount_type' THEN d->>'discount_type' ELSE discount_type END,
            discount_value=CASE WHEN d ? 'discount_value' THEN (d->>'discount_value')::numeric ELSE discount_value END,
            start_date=CASE WHEN d ? 'start_date' THEN (d->>'start_date')::timestamptz ELSE start_date END,
            end_date=CASE WHEN d ? 'end_date' THEN (d->>'end_date')::timestamptz ELSE end_date END,
            product_id=CASE WHEN d ? 'product_id' THEN NULLIF(d->>'product_id','')::integer ELSE product_id END,
            status='active'
          WHERE id=(d->>'promo_id')::integer;
          IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Promo not found.'; END IF;
        ELSE
          INSERT INTO public.promos(title,description,discount_type,discount_value,start_date,end_date,product_id,status,created_by)
          VALUES(d->>'title',d->>'description',d->>'discount_type',(d->>'discount_value')::numeric,
            (d->>'start_date')::timestamptz,(d->>'end_date')::timestamptz,NULLIF(d->>'product_id','')::integer,'active',s.submitted_by);
        END IF;
      WHEN 'stock_update' THEN
        UPDATE public.products SET
          name=CASE WHEN d ? 'name' THEN d->>'name' ELSE name END,
          description=CASE WHEN d ? 'description' THEN d->>'description' ELSE description END,
          price=CASE WHEN d ? 'price' THEN (d->>'price')::numeric ELSE price END,
          category=CASE WHEN d ? 'category' THEN d->>'category' ELSE category END,
          image_url=CASE WHEN d ? 'image_url' THEN d->>'image_url' ELSE image_url END
        WHERE id=(d->>'product_id')::integer;
        IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Product not found.'; END IF;
      WHEN 'password_reset' THEN
        IF p_password_hash IS NULL OR p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
          RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='A generated password hash is required.';
        END IF;
        target := (d->>'target_user_id')::integer;
        IF EXISTS(SELECT 1 FROM public.admins WHERE id=target) THEN
          RAISE EXCEPTION USING ERRCODE='PT403', MESSAGE='Admin passwords cannot be reset through submissions.';
        END IF;
        UPDATE public.clients SET password=p_password_hash,must_change_password=true WHERE id=target;
        IF NOT FOUND THEN
          UPDATE public.staff SET password=p_password_hash,must_change_password=true WHERE id=target;
          IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Account not found.'; END IF;
        END IF;
      ELSE RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Unsupported submission type.';
    END CASE;
  END IF;
  UPDATE public.pending_submissions SET status=p_status,admin_notes=coalesce(p_notes,admin_notes),reviewed_at=now()
  WHERE id=p_id RETURNING * INTO saved;
  SELECT name INTO requester FROM (
    SELECT name FROM public.staff WHERE id=s.submitted_by
    UNION ALL SELECT name FROM public.clients WHERE id=s.submitted_by
  ) people LIMIT 1;
  -- Never return submission payloads or password hashes into audit metadata.
  RETURN jsonb_build_object(
    'before',jsonb_build_object('id',s.id,'type',s.type,'status',s.status,'admin_notes',s.admin_notes,
      'submitted_by',s.submitted_by,'submitted_by_name',requester),
    'after',jsonb_build_object('status',saved.status,'admin_notes',saved.admin_notes)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.review_submission_atomic(integer,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_submission_atomic(integer,text,text,integer,text) TO service_role;
