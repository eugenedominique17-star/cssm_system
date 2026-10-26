BEGIN;

DO $$
BEGIN
  IF to_regclass('public.clients') IS NULL
     OR to_regclass('public.staff') IS NULL
     OR to_regclass('public.admins') IS NULL THEN
    RAISE EXCEPTION 'Auth identity linkage requires the existing clients, staff, and admins tables.';
  END IF;
END;
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_auth_user_id_uidx
  ON public.clients (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_auth_user_id_uidx
  ON public.staff (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admins_auth_user_id_uidx
  ON public.admins (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

COMMIT;
