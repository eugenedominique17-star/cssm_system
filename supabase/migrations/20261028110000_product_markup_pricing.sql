BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_price numeric(10,2)
    CHECK (purchase_price IS NULL OR purchase_price > 0),
  ADD COLUMN IF NOT EXISTS selling_markup_percent numeric(7,2)
    CHECK (selling_markup_percent IS NULL OR selling_markup_percent BETWEEN 0 AND 10000);

CREATE OR REPLACE FUNCTION public.products_calculate_selling_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  calculated_price numeric(10,2);
BEGIN
  IF NEW.purchase_price IS NULL AND NEW.selling_markup_percent IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.purchase_price IS NULL
    OR NEW.selling_markup_percent IS NULL
    OR NEW.purchase_price <= 0
    OR NEW.selling_markup_percent < 0
    OR NEW.selling_markup_percent > 10000 THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Purchase price and markup percentage are both required.';
  END IF;

  calculated_price := round(NEW.purchase_price * (1 + NEW.selling_markup_percent / 100), 2);
  IF calculated_price <= 0 OR calculated_price > 99999999 THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Calculated selling price is outside the allowed range.';
  END IF;

  NEW.price := calculated_price;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_calculate_selling_price ON public.products;
CREATE TRIGGER products_calculate_selling_price
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_calculate_selling_price();

DO $$
DECLARE
  function_definition text;
  old_fragment text;
BEGIN
  function_definition := pg_get_functiondef(
    'public.review_submission_atomic(integer,text,text,integer,text)'::regprocedure
  );
  old_fragment := $old$INSERT INTO public.products(name,description,price,stock,category,image_url,expiry_date,status,created_by)$old$;
  IF position(old_fragment IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate product creation statement in review_submission_atomic.';
  END IF;
  function_definition := replace(
    function_definition,
    old_fragment,
    'INSERT INTO public.products(name,description,price,purchase_price,selling_markup_percent,stock,category,image_url,expiry_date,status,created_by)'
  );

  old_fragment := $old$VALUES(d->>'name',d->>'description',(d->>'price')::numeric,0,d->>'category',nullif(d->>'image_url',''),NULL,'active',s.submitted_by);$old$;
  IF position(old_fragment IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate product values in review_submission_atomic.';
  END IF;
  function_definition := replace(
    function_definition,
    old_fragment,
    $new$VALUES(d->>'name',d->>'description',(d->>'price')::numeric,(d->>'purchase_price')::numeric,(d->>'selling_markup_percent')::numeric,0,d->>'category',nullif(d->>'image_url',''),NULL,'active',s.submitted_by);$new$
  );

  old_fragment := $old$price=CASE WHEN d ? 'price' THEN (d->>'price')::numeric ELSE price END,$old$;
  IF position(old_fragment IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate product update price in review_submission_atomic.';
  END IF;
  function_definition := replace(
    function_definition,
    old_fragment,
    $new$price=CASE WHEN d ? 'price' THEN (d->>'price')::numeric ELSE price END,
          purchase_price=CASE WHEN d ? 'purchase_price' THEN (d->>'purchase_price')::numeric ELSE purchase_price END,
          selling_markup_percent=CASE WHEN d ? 'selling_markup_percent' THEN (d->>'selling_markup_percent')::numeric ELSE selling_markup_percent END,$new$
  );
  EXECUTE function_definition;
END;
$$;

DO $$
DECLARE
  function_definition text;
  old_fragment text;
BEGIN
  function_definition := pg_get_functiondef(
    'public.inventory_simple_command(uuid,text,jsonb,integer,text)'::regprocedure
  );
  old_fragment := $old$INSERT INTO public.products(name,category,price,stock,status,created_by,barcode,minimum_stock)$old$;
  IF position(old_fragment IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate product creation statement in inventory_simple_command.';
  END IF;
  function_definition := replace(
    function_definition,
    old_fragment,
    'INSERT INTO public.products(name,category,price,purchase_price,selling_markup_percent,stock,status,created_by,barcode,minimum_stock)'
  );

  old_fragment := $old$VALUES(trim(p_payload->>'name'),trim(p_payload->>'category'),(p_payload->>'price')::numeric,0,'active',p_actor,nullif(trim(p_payload->>'barcode'),''),(p_payload->>'minimum_stock')::integer) RETURNING id INTO pid;$old$;
  IF position(old_fragment IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate product values in inventory_simple_command.';
  END IF;
  function_definition := replace(
    function_definition,
    old_fragment,
    $new$VALUES(trim(p_payload->>'name'),trim(p_payload->>'category'),(p_payload->>'price')::numeric,(p_payload->>'purchase_price')::numeric,(p_payload->>'selling_markup_percent')::numeric,0,'active',p_actor,nullif(trim(p_payload->>'barcode'),''),(p_payload->>'minimum_stock')::integer) RETURNING id INTO pid;$new$
  );

  old_fragment := $old$category=trim(p_payload->>'category'),price=(p_payload->>'price')::numeric,$old$;
  IF position(old_fragment IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate product update price in inventory_simple_command.';
  END IF;
  function_definition := replace(
    function_definition,
    old_fragment,
    $new$category=trim(p_payload->>'category'),price=(p_payload->>'price')::numeric,
   purchase_price=(p_payload->>'purchase_price')::numeric,selling_markup_percent=(p_payload->>'selling_markup_percent')::numeric,$new$
  );
  EXECUTE function_definition;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
