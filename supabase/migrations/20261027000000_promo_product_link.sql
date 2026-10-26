ALTER TABLE public.promos
  ADD COLUMN IF NOT EXISTS product_id integer REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promos_product_id ON public.promos(product_id);
