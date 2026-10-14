# Sales and access regression checks

The backend now requires SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy
SUPABASE_SERVICE_ROLE_KEY). Keep the secret key in backend/.env only.
The sale RPC is executable only by service_role; public/publishable keys cannot call it.

Apply supabase/migrations/20261003184613_atomic_sales_and_expiry.sql before
starting the updated backend. It adds one function, without changing existing records.
The existing separated clients/staff/admins schema, products.expiry_date and payment
columns are prerequisites. Transactions retain the existing staff foreign key:
an active staff account records sales.

Run the isolated backend tests:

    cd backend
    npm test

To run the database regression checks, emit the SQL and run the entire output
as one request in Supabase SQL Editor (not statement by statement):

    node backend/scripts/print-sales-regression-sql.js

The test creates cssm_sale_regression inside a transaction, runs the current
migration against that isolated schema and rolls everything back. No store records
or store sequences are used. Tests cover duplicate lines, stock shortages,
expiry including the current Philippine date, inactive products/staff, invalid
quantities, stale prices, underpayment, duplicate completion, cancelled orders,
function permissions, and rollback after a deliberately failed stock update.

Expiry dates remain valid through the printed date in Asia/Manila.
HTTP authentication rechecks the stored account status and role on every request.
SSE connections recheck on connection and on each 25-second heartbeat.

Concurrency protection uses a row lock on the pending order and product row locks
in ascending product-ID order. Cancellation updates only orders still pending.
Only send completion notifications after the atomic sale succeeds.
