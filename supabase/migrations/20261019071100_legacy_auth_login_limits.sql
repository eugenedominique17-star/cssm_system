BEGIN;

CREATE TABLE IF NOT EXISTS public.auth_migration_login_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);

CREATE INDEX IF NOT EXISTS auth_migration_login_limits_window_idx
  ON public.auth_migration_login_limits (window_started_at);

ALTER TABLE public.auth_migration_login_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_migration_login_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_auth_migration_login(
  p_key_hash text,
  p_limit integer DEFAULT 20,
  p_window_seconds integer DEFAULT 900
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt_count integer;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid login limit request.';
  END IF;

  DELETE FROM public.auth_migration_login_limits
  WHERE window_started_at < statement_timestamp() - interval '1 day';

  INSERT INTO public.auth_migration_login_limits AS limits (key_hash, window_started_at, attempts)
  VALUES (p_key_hash, statement_timestamp(), 1)
  ON CONFLICT (key_hash) DO UPDATE
    SET window_started_at = CASE
          WHEN limits.window_started_at <= statement_timestamp() - make_interval(secs => p_window_seconds)
          THEN statement_timestamp()
          ELSE limits.window_started_at
        END,
        attempts = CASE
          WHEN limits.window_started_at <= statement_timestamp() - make_interval(secs => p_window_seconds)
          THEN 1
          ELSE limits.attempts + 1
        END
  RETURNING attempts INTO attempt_count;

  RETURN attempt_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_migration_login(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_migration_login(text, integer, integer)
  TO service_role;

COMMIT;
