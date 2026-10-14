# Simple inventory: review before deployment

Status: code and proposed migration prepared. Live schema/data changes require owner approval.

Migration: `supabase/migrations/20261010105421_simple_inventory.sql`.

## Changes to approve

- Add optional product barcode/SKU and a minimum-stock setting (default 10).
- Keep existing products, batches, users, roles, receipts and historical documents.
- Combine every existing warehouse quantity into the existing store quantity once, recording a `consolidated` stock movement. Recalculate the physical product balance from batches. Read-only inspection found 50 warehouse units at preparation time; the migration uses actual balances at execution time.
- No supplier fields in the new UI. Retain old supplier/delivery records for historical integrity. Old pending deliveries are NOT received automatically, and old delivery/transfer write operations are retired. Actual goods not yet counted must be restocked once after review.
- Add one atomic, backend-only command for product creation/edit, restock, batch correction and expired removal. Retry references are bound to the actor, role, action and exact payload.
- Admin creates/edits directly and corrects/removes expired stock. Staff can restock; existing staff product submission/approval pages remain in use, reached through Inventory's Add Product/Edit buttons. Initial quantities, barcode and minimum-stock setup are available in the Admin Inventory form; approved staff products can subsequently be configured/restocked.
- Each restock creates a batch. This preserves separate expirations and history even when the same product is restocked repeatedly.
- Admin can open a product's View Details and use Set expiry / Edit expiry for existing batches, including missing or past dates. This reuses the already-installed expiry correction function and Admin Audit Log, so it remains available before the new migration. Reactivation requires an explicit checkbox confirmation.
- Expiration policy for the new Inventory and POS: a batch is unavailable from 00:00 Asia/Manila on its printed expiration date. This intentionally changes the old expiry-day-inclusive policy. Warning window is the next 7 days. Unexpired batches remain available.
- Existing POS transaction allocation remains atomic and uses earliest expiration first. Checkout now retains a request reference across retries to avoid a second receipt/stock deduction. Existing receipts are checked for matching user, staff, payment and item quantities before replay.
- No authentication changes, public browser grants, deleted records or dropped tables. Existing inventory RLS remains enabled. New functions use security invoker and explicit service-role-only execution grants.

## Rollout

1. Review and approve the migration above. Do not run an unattended database push.
2. Back up the database and briefly pause checkout/stock changes.
3. Apply the proposed migration once, after the existing inventory/expiry migrations. It is a single transaction; any failure rolls back its changes.
4. Deploy/restart the updated backend and frontend together, then resume checkout.
5. Verify physical totals against prior warehouse + store balances, test an authorized restock/correction, and check POS quantities and stock history.

Before approval/application, the new UI still reads existing stock but disables new stock mutations. The setup notice is explicit; nothing silently pretends to save. Legacy documents are retained, while their write workflows intentionally stop after migration.

## Verification

- `npm test --prefix backend`
- `node backend/tests/simple-inventory-sql.cjs` (disposable PGlite database; uses the existing `.tmp/inventory-check` test dependency)
- `npm run build --prefix frontend` (use a separate BUILD_PATH to avoid overwriting existing build artifacts)

The SQL regression covers preserved balances, duplicate restock retries, cross-role reference conflicts, duplicate products/barcodes, FEFO deductions, duplicate receipts, insufficient-stock rollback, stale count rejection, expired removal, zero-stock creation, edits and anonymous permission denial. It never connects to the live database.

To recover after production use, prefer a reviewed forward fix. Do not restore an old database snapshot over newer sales; the existing warehouse/store columns and old history remain available for reconciliation.
