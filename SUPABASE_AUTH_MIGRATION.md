# Supabase Auth migration status

This work adds a staged login bridge; it does not finish the Express-to-Supabase
migration. Express remains the API for existing workflows and must remain
available during this phase.

## Added in this phase

- Additive `auth_user_id` columns for the existing `clients`, `staff`, and
  `admins` tables. Existing rows and numeric account IDs are preserved.
- `legacy-auth-migrate` verifies a legacy bcrypt password on the server, creates
  a Supabase Auth identity, and links it to the existing account. This legacy
  password check is required even when an unlinked account has a matching email
  in Supabase Auth. Already-linked accounts authenticate only with their
  Supabase Auth password.
- Public client registration can create a pending client profile and Auth user
  together while preserving the existing client ID and formatted user ID.
- Public staff registration is also supported through `legacy-auth-migrate`,
  creating the pending staff profile and Auth identity together and preserving
  the existing staff ID format. It has no current React registration screen.
- An RPC-backed limit of 20 login attempts per 15 minutes per account identifier
  and, when provided by the gateway, source IP. The HMAC key prevents raw
  identifiers/IP addresses from being stored in the limiter table.
- Express continues accepting its existing custom JWTs and can also verify
  linked Supabase Auth tokens.
- Password changes and direct admin password resets synchronize both password
  systems with compensating behavior if a database write fails.
- Staff-requested password resets synchronize Supabase Auth when approved;
  failed Auth updates restore the previous legacy password and withhold the
  generated temporary password.
- Client order-status events can be published on private Supabase Realtime
  channels. The existing SSE connection remains as a compatibility path for
  legacy sessions during staged rollout.
- Public homepage and authenticated product/promo catalog reads can use the
  `catalog-read` Edge Function in Supabase Auth mode. Admin product/promo
  create/update/delete and staff submission-for-approval writes can use
  `catalog-mutate`; Express remains the fallback when Supabase Auth mode is off.
- Staff point-of-sale receipt creation, a client's own transaction history, and
  authorized receipt detail reads can use `sales-api`. Staff/admin transaction
  lists are also routed through this function. Direct point-of-sale and
  pending walk-in receipt completion both use the existing atomic
  `create_sale_atomic` database function. Client/staff walk-in request creation,
  client and staff request listing, cancellation, and staff pending/cancelled
  queues can also use `sales-api`.
- Staff/admin inventory overview, history, stock requests, and inventory
  commands can use the `inventory-api` Edge Function. It resolves the linked
  active role server-side and calls the existing inventory RPCs; audited stock
  changes still require the atomic `inventory_audited_command` RPC. The Express
  API remains the fallback when Supabase Auth mode is off.
- The React integration is opt-in through `REACT_APP_AUTH_PROVIDER=supabase`.
  The production config has intentionally not been switched.
- The public homepage catalog can be routed independently through
  `catalog-read` by setting `REACT_APP_HOMEPAGE_CATALOG_PROVIDER=supabase` at
  frontend build time. This enables only the unauthenticated homepage catalog;
  it does not switch the rest of the app from Express or enable Supabase Auth.
- Admin pending-submission review and staff submission history can use the
  `submission-api` Edge Function. Product/promo/account submissions use the
  existing atomic `review_submission_atomic` RPC. Approved staff password-reset
  requests update the existing bcrypt hash and linked Supabase Auth password
  server-side; temporary credentials are returned only in a no-store admin
  response.
- Admin account listing, create/update/delete, approval/rejection/deactivation,
  direct password resets, and dashboard summary, as well as staff-created
  account lists and password-reset requests, can use `account-admin-api`.
  Signed-in users can also load/update their profile and change their password
  through this function; clients can edit their names, birthdate, gender,
  address, and phone number while their registered email remains fixed.
  Account and profile writes are audited before mutation, and account IDs and
  existing role tables are preserved.
- Admin reports and paginated activity-history reads can use `admin-data-api`.
  It validates report/audit filters, enforces active-admin access on the server,
  preserves Philippine-time date boundaries, and retains saved inventory/order
  audit-detail enrichment.

## Not ready to enable in production

Do not set `REACT_APP_AUTH_PROVIDER=supabase` in production yet. Other existing
APIs still depend on Express, the Edge Functions have not been deployed or
integration-tested against the database, and the table RLS policies still need
to be replaced and tested before direct browser database access is enabled.
The account and admin-data functions have not yet been deployed or semantically
type-checked with Deno. Other Express-only endpoints not listed above remain
to be mapped before production migration.

## Staging-only activation checklist

1. Back up the staging database and verify that `clients`, `staff`, and `admins`
   exist and the earlier inventory/audit migrations are already installed,
   especially `20261006134908_audit_logs.sql` and
   `20261018120749_atomic_submission_reviews.sql`. Apply
   `20261019070000_auth_identity_linkage.sql`,
   `20261019071100_legacy_auth_login_limits.sql`, and then
   `20261019080100_order_status_realtime_policy.sql`. These files have not been
   executed here.
2. Confirm `20261003184613_atomic_sales_and_expiry.sql` is installed; the
   `sales-api` function requires its `create_sale_atomic` RPC. Also confirm
   `20261010105421_simple_inventory.sql`,
   `20261010114642_staff_restock_approval.sql`,
   `20261010120728_inventory_audit_details.sql`, and
   `20261007112720_batch_expiry_monitor.sql` are installed before testing
   inventory operations. Deploy
   `supabase/functions/legacy-auth-migrate`,
   `supabase/functions/catalog-read`, `supabase/functions/sales-api`,
   `supabase/functions/inventory-api`, and
   `supabase/functions/catalog-mutate`,
   `supabase/functions/submission-api`, and
   `supabase/functions/account-admin-api` and
   `supabase/functions/admin-data-api` to a staging Supabase project.
3. Set the `legacy-auth-migrate` function secret `AUTH_MIGRATION_RATE_SECRET`
   to a randomly generated value of at least 32 characters. Set `APP_ORIGIN` on
   all deployed functions to the exact staging frontend origin. Supabase supplies
   its project URL, anon key, and service role key to each function runtime.
   For the public homepage-only catalog path, deploy `catalog-read` and set
   `REACT_APP_HOMEPAGE_CATALOG_PROVIDER=supabase`,
   `REACT_APP_SUPABASE_URL`, and `REACT_APP_SUPABASE_ANON_KEY` in the frontend
   build environment. Keep `REACT_APP_AUTH_PROVIDER` unset to leave the other
   workflows on Express. Never put the service-role key in frontend settings.
4. Configure the staging React build with:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_AUTH_PROVIDER=supabase`
   - `REACT_APP_API_URL` pointing to the still-running staging Express API
5. Test the public homepage catalog, anonymous rejection of private catalog
   reads, role-appropriate product/promo reads, and email and
   `C...` / `S...` / `A...` login. Also test pending/inactive accounts, public
   client registration, first-login password change, logout, token refresh,
   direct and staff-requested admin password resets, private order-status
   Realtime delivery, client/staff walk-in request creation, own/pending/
   cancelled request lists, client/staff cancellation, direct and pending
   walk-in sale completion, checkout
   request replay and stock conflicts, client transaction history/detail
   authorization, admin product/promo changes, staff product/promo submissions,
   admin submission approve/reject and staff submission history, linked and
   unlinked password-reset approval,
   staff/admin inventory reads and writes, staff restock request
   approval/rejection, audit log entries, account CRUD and approval flows,
   profile changes, ordinary and first-login password changes, staff-created
   account listing/reset requests, and Express API authorization with the
   Supabase token. Verify report aggregation for weekly/monthly/custom date
   ranges, pagination/filtering and Manila-time date boundaries in activity
   history, and saved order/inventory audit details.
6. Do not enable this mode for production until the rest of the protected API
   surface has replacements and role-specific RLS policies have passed
   anon/authenticated-role tests.

The anon key is public configuration. Never put a Supabase service-role key,
password hash, or other server secret in the React build.
