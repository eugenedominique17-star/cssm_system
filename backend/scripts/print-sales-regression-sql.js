// Emit a self-contained rollback-only SQL regression test for Supabase SQL Editor.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261003184613_atomic_sales_and_expiry.sql'), 'utf8')
  .replaceAll('public.', 'cssm_sale_regression.')
  .replace("NOTIFY pgrst, 'reload schema';", '');
const fixture = fs.readFileSync(path.join(__dirname, '../tests/atomic-sales.sql'), 'utf8');
process.stdout.write(fixture.replace('-- INSERT_CURRENT_SALE_MIGRATION_HERE', migration));
