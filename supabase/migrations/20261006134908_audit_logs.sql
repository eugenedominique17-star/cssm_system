-- Backend-only API activity history. Accounts use the application's JWT auth,
-- not Supabase Auth; browsers must never access this table directly.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  actor_name text not null,
  actor_role text not null check (actor_role in ('admin', 'staff', 'client')),
  action text not null,
  entity_type text not null,
  entity_id text,
  outcome text not null default 'pending' check (outcome in ('pending', 'succeeded', 'failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index audit_logs_created_idx on public.audit_logs (created_at desc, id desc);
create index audit_logs_role_created_idx on public.audit_logs (actor_role, created_at desc);
create index audit_logs_outcome_created_idx on public.audit_logs (outcome, created_at desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated, service_role;
grant select, insert on public.audit_logs to service_role;
grant update (outcome, details, finished_at, entity_id, action) on public.audit_logs to service_role;
comment on table public.audit_logs is 'Authenticated API mutation attempts and outcomes, starting at feature activation. Pending means completion was not confirmed; succeeded means API success, not an atomic database change ledger.';
