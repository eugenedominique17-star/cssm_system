// Tests static routing only, with dummy credentials. No database requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.NODE_ENV='production';
process.env.SUPABASE_URL='https://deployment-test.supabase.co';
process.env.SUPABASE_SECRET_KEY='test-only-not-a-real-key';
process.env.JWT_SECRET='production-smoke-test-only-not-a-real-secret';
delete process.env.TRUST_PROXY;
const app=require('../server');
const server=app.listen(0,'127.0.0.1',async()=>{
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const route of ['/','/login','/admin/audit-logs','/change-password']) {
      const r=await fetch(base+route); assert.equal(r.status,200); assert.match(r.headers.get('content-type'),/html/); assert.match(await r.text(),/id="root"/);
    }
    const health=await fetch(base+'/api/health'); assert.equal((await health.json()).status,'ok');
    const missing=await fetch(base+'/api/missing'); assert.equal(missing.status,404); assert.equal((await missing.json()).message,'Route not found');
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../../frontend/build/asset-manifest.json')));
    const asset=await fetch(base+manifest.files['main.js']); assert.equal(asset.status,200);
    const source=await asset.text(); assert.ok(source.includes('PASSWORD_CHANGE_REQUIRED')); assert.ok(!source.includes('http://localhost:5000/api'));
    console.log('PASS: production frontend, nested refresh, same-origin API, health and JSON API 404');
  } catch(error) { console.error(error); process.exitCode=1; }
  finally { server.close(); }
});
