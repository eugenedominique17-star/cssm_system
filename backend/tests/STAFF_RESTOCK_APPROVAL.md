# Staff restock approval

Prepared migration: `supabase/migrations/20261010114642_staff_restock_approval.sql`.
Apply only after the owner reviews/approves it. The previous simple-inventory migration must already be installed. Do not rerun the previous migration.

## Behavior

- Staff selects Restock, enters quantity and optional expiry, then Submit for Approval.
- Pending requests create a document and requested line item only: no batch, movement or stock increase.
- Staff sees only their own requests in Inventory → My Requests, with Pending, Approved or Rejected status and the rejection reason.
- Admin uses Inventory → Stock Requests to review product, quantity, expiry and requester. Confirmation is required; rejection also requires a reason.
- Approval locks the request and product, rechecks active-product/expiry conditions, then creates one batch, updates stock and logs one movement atomically. Repeated approval does not add stock twice. An opposite decision after review is rejected.
- Admin's own Restock still adds stock immediately after confirmation.
- Existing quantities and historical completed restocks remain unchanged. Old direct staff restocks are not retroactively converted into requests.

## Database changes

Replaces the simple command's staff-restock branch; adds a dedicated restock entry point, review function, readiness function and request-list index. Reuses existing inventory documents/items/batches/movements and review fields. No tables, columns, accounts, roles or records are deleted. New RPCs are backend-only; existing RLS remains enabled.

Before application, the updated backend fails closed on Restock because the dedicated entry point is absent. The UI displays an update notice and disables Restock until the readiness check succeeds. Other inventory operations remain available. Apply the new migration and refresh Inventory to activate.

## Verification

- `npm test --prefix backend`: covers actor identity, forbidden staff review, rejection validation and staff request scoping.
- `node --wasm-num-compilation-tasks=1 --liftoff-only backend/tests/simple-inventory-sql.cjs`: disposable PostgreSQL regression including migration preservation, pending balances, retries, approval/rejection, inactive/expired stock and RLS. Low-memory flags reduce compilation memory on this workstation.
- Frontend production build and JSX parsing.

Live database changes have not been applied by the agent.
