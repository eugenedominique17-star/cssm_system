# Bodega inventory rollout

Expiry monitoring: apply `supabase/migrations/20261007112720_batch_expiry_monitor.sql` after the bodega and audit migrations. The new **Expiry Monitor** tab filters stocked batches by Philippine calendar date (expired, today, 7/15/30 days, missing expiry) and location. Only admins can correct expiry dates. Corrections require the previous date, a reason, and explicit verification when changing an expired batch to an unexpired date. The database saves exact old/new dates in the audit log atomically, with retry protection and stale-edit rejection. Stock quantities are unchanged. This does not implement disposal approval.

1. Pause sales and stock edits during setup. Back up the database.
2. Apply the complete `supabase/migrations/20261007105249_bodega_inventory.sql` file once in the Supabase SQL Editor. It is transactional: errors roll back all changes. It assumes the existing `create_sale_atomic` migration is installed.
3. Restart the backend and refresh the frontend. Open **Bodega & Store** as staff/admin.
4. Existing quantities are preserved as `LEGACY-STORE-*` batches, with original expiry dates. Bodega starts at zero. Admin records physical opening counts with **Opening Count / Adjustment**, choosing a new bodega batch and a reason. Do not enter existing shelf stock again.
5. Staff submits accepted delivery quantities and batches. Admin reviews the items and approves/rejects. Keep pending deliveries physically separate.
6. Staff transfers a specific unexpired batch to store. Both balances change atomically. A repeated request ID does not repeat the movement.
7. Counter sales consume unexpired store batches in earliest-expiry order. Existing `products.stock` remains the physical store total; product lists report available unexpired store stock. Expired batches are visible separately in the inventory page.
8. Admin may record a count correction (signed difference) with the expected current balance and a reason. Concurrent changes reject stale counts. Admin may reverse a transfer once, only when the same batch still has enough store stock. Physically move the goods back too.

Legacy pending stock-add requests must be rejected and replaced with receiving/transfer records. Product metadata changes still use existing approval screens; new products start at zero. Products with inventory history should be deactivated instead of deleted. No customer ordering features were added.

Safety: all new tables use RLS with no browser grants. RPCs are backend-only and check active staff/admin identity again. Audit events track inventory API actions; inventory movement rows contain exact batch deltas and resulting balances. Supplier/receipt uniqueness prevents duplicate active delivery receipts. Pending approval adds no stock. Opening counts and adjustments can record expired goods, but expired batches cannot transfer to store or be sold. Expiry today is allowed, matching existing sale policy.

Validation:

```
npm --prefix backend test
npm install --prefix .tmp/inventory-check --no-save --package-lock=false @electric-sql/pglite@0.5.8
node backend/tests/inventory-sql.cjs
```

The SQL test uses an isolated PostgreSQL runtime and synthetic accounts/products, never live stock. It covers stock preservation, receiving approval/rejection, duplicate requests, insufficient stock, FEFO sales, reversal, expiry, stale counts, rollback, permissions, and conservation. PGlite serializes requests; run simultaneous transfer/sale checks against a staging Postgres database before a high-volume rollout. Live migration verification requires access to the target database after the SQL is applied.
