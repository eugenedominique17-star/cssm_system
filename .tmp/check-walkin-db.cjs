const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const supabase = require('../backend/config/supabase');
(async () => {
  if (!supabase) throw new Error('Backend database credentials unavailable.');
  for (const [table, columns] of [
    ['transactions', 'id,user_id,staff_id,receipt_number,total_amount,payment_method,tendered_amount,change_amount,created_at'],
    ['transaction_items', 'id,transaction_id,product_id,quantity,unit_price,subtotal'],
    ['products', 'id,stock,price,status,expiry_date'],
    ['staff', 'id,name,status'], ['clients', 'id,name,status'],
  ]) {
    const { error, count } = await supabase.from(table).select(columns, { count: 'exact', head: true });
    console.log(JSON.stringify({ table, columns_present: !error, count, error: error?.message }));
  }
  // PostgREST's OpenAPI description is read-only; never print credentials or records.
  const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/', { headers: {
    apikey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    Accept: 'application/openapi+json',
  }});
  if (response.ok) {
    const spec = await response.json();
    console.log(JSON.stringify({ atomic_sale_rpc_exposed: Boolean(spec.paths?.['/rpc/create_sale_atomic']) }));
  } else console.log(JSON.stringify({ rpc_metadata_status: response.status }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
