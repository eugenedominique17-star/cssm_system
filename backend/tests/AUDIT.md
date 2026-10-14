# Audit activity log

Setup: run `supabase/migrations/20261006134908_audit_logs.sql` in the project's SQL Editor before starting this backend version. Restart the backend and open **Admin → Audit Log**. No old history is fabricated or backfilled.

Coverage: authenticated account, product, promotion, order and approval mutation requests, including profile and password changes. Login, public registrations, browser-only favorites, direct SQL edits and external database changes are not captured. Passwords, tokens, customer contact details and full request/response bodies are never copied to audit metadata.

Each request first creates a durable pending row. If logging cannot start, the mutation is blocked with HTTP 503. The row is finalized before the API response is sent. If finalization fails or the process stops, the row remains **Unconfirmed**; the successful business response is preserved to avoid duplicating a sale through retries. Investigate unconfirmed records before repeating operations.

This is an API activity trail, not a transactional before/after database ledger. “Succeeded” reflects the controller's HTTP result. Requested fields are labeled as such, and staff submissions are explicitly identified as submissions awaiting approval. There are no browser read grants or edit/delete API routes. The service role can insert/read and update only completion fields; actor identity and creation time cannot be edited through it. Database owners retain administrative access.

Verification: `npm --prefix backend test` includes audit privacy, submission semantics, permissions, failure behavior and filter validation. Run a real authorized product submission, check its actor and submission reference in the admin page, then approve it and verify the separate administrator entry. Staff/client requests to `GET /api/admin/audit-logs` must return 403. Test data-changing flows only in a test environment.
