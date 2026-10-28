# TODO - UI Enhancements (Modern + Accessible for Elderly & Young)

## Goal
Make the UI more pleasing to the eyes and easy to use for both elderly and young users, WITHOUT breaking existing functionality.

## Steps
- [x] 1. Update `frontend/src/theme.js` - calm, minimalist color palette (Serene Teal + Slate), softer buttons/cards/tables/textfields
- [x] 2. Update `frontend/src/App.css` - calmer bg, stat cards, homepage banner, greeting/page header gradients, stock badges, promo banner, empty states
- [x] 3. Update `frontend/src/components/Navbar.jsx` - elegant slate-to-teal header, mint active indicator
- [x] 4. Update `frontend/src/components/Footer.jsx` - clean minimalist footer
- [x] 5. Add Stock Health Alert banner to `frontend/src/pages/staff/Dashboard.jsx` (out-of-stock / low-stock)
- [x] 6. Add Printable (thermal-style) Receipt to Staff `ReceiptManagement.jsx` and Client `OrderHistory.jsx`
- [x] 8. Add Quick Product Search + Stock Filter (All/Low/Out) to Staff `ProductManagement.jsx` (frontend-only, safe)
- [x] 9. Expiry Date Tracker: SQL migration (`backend/scripts/add-expiry-date.sql`), backend model/controller/admin flow, staff form field + expiry badges in `ProductManagement.jsx`
- [x] 10. Expiry Health Alert banner (expired / expiring within 7 days) to Staff `Dashboard.jsx`
- [x] 12. Password Management (Option A): admin-only reset w/ simple pattern (`client123`/`staff123`), forced first-login change, staff reset requests need admin approval, in-app dashboard notifications
  - SQL: `backend/scripts/add-must-change-password.sql` (run in Supabase!)
  - Backend: user.model/auth.controller/user.controller/admin.controller/users.routes
  - Frontend: new `ChangePassword.jsx` + routes, AccountManagement "Reset Password", UserManagement "Request Reset", SubmissionApprovals + Admin Dashboard banners
- [x] 13. Admin Account Creation: full personal info form (first/middle/last name, birthdate, gender, contact, address, staff contract details) — composes `name` on save (backward-compatible)
- [x] 14. Admin Product Monitor: new `/admin/product-monitor` page + Quick Action card — stock health summary bar, search/category/status filters, stock badges, bulk status actions (reuses PUT /products/:id), CSV export. Frontend-only, no backend changes.
- [ ] 15. Run both SQL migrations in Supabase, restart backend, test flows
- [x] 16. Automatic reorder workflow: create a 50-unit order when stock reaches exactly 10; receive action adds stock atomically
- [x] 17. Actual purchase/selling price separation: admin-only purchase cost per received reorder batch
- [x] 18. Realtime Admin-only damage/write-off and supplier-return records with separate report totals
</content>
