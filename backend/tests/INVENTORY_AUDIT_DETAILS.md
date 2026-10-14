# Inventory activity details

Prepared SQL: `supabase/migrations/20261010120728_inventory_audit_details.sql`.
Apply only after owner review, after the simple-inventory and staff-restock-approval migrations. Do not rerun the earlier migrations.

This update reuses `audit_logs.details`. It adds two backend-only functions; no table/column additions, record deletions, stock adjustments, or authentication changes are performed by the migration itself.

For Inventory restock, staff requests, approval/rejection, corrections, expired removal and product create/edit, the backend passes its own pending audit ID to a transactional wrapper. The wrapper locks the request and product, captures before values, executes the existing inventory operation, captures after values and marks the same audit row successful in that transaction. Browser-provided audit IDs are not accepted. An audit-write failure rolls the stock operation back. The normal middleware cannot overwrite an already-completed snapshot.

Details include product, requester/reviewer, quantity, batch expiry, reason, stock totals, selected-batch count and request status where applicable. Product edits show changed fields only. Retries explicitly state that the request was already processed and show no additional change. Expiration editing already records its old/new date atomically and now uses the same readable changes table.

Before this SQL is applied, existing inventory operations continue using their existing functions. Only a missing-function error permits this fallback; mutation errors are never retried through another write path. Exact snapshots start after migration activation.

Older inventory audit records can display linked request details, clearly labeled as such. Product names linked for old logs are current names. Historical before/after totals are never fabricated, and later rejection reasons are not attached to the earlier submission. Other legacy modules retain their recorded requested values; this change does not invent snapshots for historical product/order/account operations.

UI: readable action names, outcome-specific messages, product/request details, Before/After table, and a clear missing-history message. Approved actions no longer display the pending-approval disclaimer.

Validation: backend tests, disposable PostgreSQL migration/transaction tests, and frontend production build. No live data is mutated by tests.
