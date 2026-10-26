BEGIN;

CREATE TABLE public.audit_previous_passwords (
  audit_event_id uuid PRIMARY KEY REFERENCES public.audit_logs(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  ciphertext text NOT NULL,
  auth_tag text NOT NULL,
  retention_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_previous_passwords_retention_idx
  ON public.audit_previous_passwords (retention_expires_at);
ALTER TABLE public.audit_previous_passwords ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_previous_passwords FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_previous_passwords TO service_role;
COMMENT ON TABLE public.audit_previous_passwords IS 'Encrypted previous passwords for successful self-service password-change audit events only. The encryption key is held outside the database; retention_expires_at is enforced by application reads and cleanup jobs.';

COMMIT;