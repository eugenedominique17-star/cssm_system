# Hostinger deployment

## Static React hosting (Supabase backend)

Hostinger PHP/shared hosting cannot run this repository's Express server. It can
serve the compiled React app as static files, while Supabase Auth, Edge
Functions, PostgreSQL, and Realtime provide the backend after the migration is
complete. The React build includes `frontend/public/.htaccess` so direct
navigation to client-side routes resolves to `index.html`; `/api` is deliberately
not rewritten to the app.

Do not publish the static build as a complete replacement until all frontend
API calls are routed to deployed Supabase functions and the staging workflow,
RLS, and rollback tests have passed. Until then, workflows that still use
Express will fail on static-only hosting.

For a static deployment:

1. Configure the frontend build with `REACT_APP_SUPABASE_URL` and
   `REACT_APP_SUPABASE_ANON_KEY` (publishable/anon key only). Never put a
   service-role/secret key in a `REACT_APP_` variable.
2. Build the frontend from the repository using `npm run build`.
3. Upload the **contents** of `frontend/build` to Hostinger's website document
   root (usually `public_html`), including the generated `.htaccess` file.
4. Confirm the domain points to that document root and test both `/` and a
   nested React route after deployment.

Do not set `REACT_APP_AUTH_PROVIDER=supabase` for production until every
protected endpoint is migrated and staging verification is complete.

## Express-hosted deployment

Use a Node.js-capable hosting plan if the Express backend must remain available.
This repository runs one Express process serving both the React build and `/api`,
so the browser uses the same HTTPS origin. The visual design has not been changed.

## Settings

- Project root: repository root (not `frontend` or `backend`).
- Node: 22 LTS or 24 LTS.
- Install: `npm ci` (postinstall installs both child packages from lockfiles).
- Build: `npm run build` (uses one build worker and a 768 MB Node old-space limit).
  `npm run build:low-memory` also uses these settings.
- Start: `npm start` (entry point `backend/server.js`).
- Set `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or
  `SUPABASE_SERVICE_ROLE_KEY`), a random `JWT_SECRET` of at least 32 characters,
  and `AUDIT_SECRET_KEY` (a randomly generated 32-byte key encoded as 64 hex
  characters). Keep `AUDIT_SECRET_KEY` server-side; never expose it through a
  `REACT_APP_` variable. Password changes remain disabled until this key is
  configured because successful changes store the previous password only as
  encrypted audit data.
- Build environment: `REACT_APP_API_URL=/api`. Do not override this with localhost.
- Use the port supplied by the hosting platform; the app reads `PORT`.
- Set `TRUST_PROXY` only after confirming the hosting proxy topology. A value of
  `1` is appropriate only when exactly one trusted proxy separates clients from
  the app and direct access to the app is blocked. Trusted proxy IP/CIDR lists
  are also supported. Never use `true` to trust arbitrary forwarding headers.
- Keep one application instance: login throttling and SSE currently use local
  memory. Multiple instances require a shared limiter store and event broker.

## Database prerequisite

Use a separate staging database with the existing separated account tables and
all repository migrations applied in order. Apply
`supabase/migrations/20261018120749_atomic_submission_reviews.sql` before deploying
this backend. It adds a service-role-only RPC; approval fails closed if missing.
Also apply `supabase/migrations/20261028090000_automatic_reorders.sql`. It creates
one automatic 50-unit reorder when a successful stock write brings a product to
exactly 10 units. The order is marked `ordered`, but stock is increased only
when an admin or staff member marks the delivery as received.
Do not run old setup/reset scripts against production. Historical SQL scripts
include permissive policies; review actual live RLS and grants before launch.

The new RPC locks the submission row and applies its effect and review together.
Failed operations roll back; already reviewed submissions return 409. It does not
rewrite historical reviews. Random reset credentials appear only in the admin's
successful response and existing notification; they are never saved as plaintext.
If that response is lost, use Account Management's password-reset action again.

## Staging verification and launch gate

1. Run `npm test --prefix backend` and `npm run build`.
   The isolated SQL regression is `node backend/tests/submission-review-sql.cjs`;
   it uses the existing local PGlite installation under `.tmp/inventory-check`.
   On low-memory machines, use `node --liftoff-only --no-wasm-tier-up
   --wasm-lazy-compilation --wasm-num-compilation-tasks=1 backend/tests/submission-review-sql.cjs`.
2. Check `/api/health`, `/login`, and refresh a nested browser route. Unknown API
   paths must remain JSON 404 responses.
   Local smoke check after building: `node backend/tests/production-smoke.cjs`.
3. Test each role using staging-only accounts: login, forced password change,
   account approval/rejection, products, inventory, sales, receipt and audit log.
4. Review one submission twice and concurrently; only one change should persist.
5. Confirm login attempts produce 429 after 20 failures within 15 minutes and
   independent client IPs are not grouped by the reverse proxy.
6. Verify HTTPS, realtime notifications, actual database permissions, environment
   configuration and dependency audit results.
7. Before public launch, fix the deferred account-list password-hash exposure.
   This remains intentionally deferred by the user; this is not a production sign-off.
8. Take a database backup and verify restoration before launch. Keep the previous
   deployment available for rollback. The new migration is additive.

No Hostinger deployment, live database migration or live backup was performed by
the local preparation work. These require the intended hosting/staging target.

## Local verification (18 October 2026)

- 60 backend tests passed, including login throttling, mandatory password change,
  failed writes and audit logging.
- Isolated PostgreSQL checks passed for review serialization, duplicate prevention,
  rollback, promo edits, password resets and function permissions.
- Production build and local HTTP routing checks passed; localhost is absent from
  the compiled API URL. No visual layout or styling was changed.
- Root and backend production dependency audits: zero reported vulnerabilities.
- Compatible frontend dependency updates removed the critical findings, but the
  frontend audit still reports 101 findings (63 high, 35 moderate, 3 low), including
  the React Scripts/Router dependency trees. Backend development tooling also has
  unresolved findings. Review these before public launch; no forced major upgrades
  were made as part of this preparation.
- Live staging role/workflow tests, database permission checks, backup/restore and
  the deferred password-hash exposure fix are still outstanding.
