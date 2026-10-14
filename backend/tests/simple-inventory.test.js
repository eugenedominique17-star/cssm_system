const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
function load(relative, mocks) {
 const filename = path.resolve(__dirname, '..', relative); const local = Module.createRequire(filename);
 const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
 mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : local(name);
 mod._compile(fs.readFileSync(filename, 'utf8'), filename); return mod.exports;
}
const response = () => ({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('restock uses verified staff identity; admin tools cannot be called by staff', async () => {
 const api = load('controllers/inventory.controller.js', {'../config/supabase':{rpc:async (name,args) => {
  assert.equal(name,'inventory_submit_restock'); assert.equal(args.p_actor,2); assert.equal(args.p_role,'staff'); return {data:args.p_id};
 }}});
 const req = kind => ({params:{kind},user:{id:2,role:'staff'},body:{id:'123e4567-e89b-42d3-a456-426614174000',payload:{product_id:1,quantity:2,expiry_date:null}}});
 const res=response(); await api.command(req('restock'),res); assert.equal(res.statusCode,200); assert.match(res.body.message,/admin approval/);
 for(const kind of ['approve_restock','reject_restock','correct','remove_expired','create_product','edit_product']) {const res=response();await api.command(req(kind),res);assert.equal(res.statusCode,403);}
 const invalid=req('restock'); invalid.body.payload.quantity=1.5;
 const bad=response(); await api.command(invalid,bad); assert.equal(bad.statusCode,400);
});
test('stock approval validates rejection reason and passes verified admin identity', async () => {
 let calls=0;
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,args)=>{
  calls++;assert.equal(name,'inventory_review_restock');assert.equal(args.p_actor,1);assert.equal(args.p_approve,false);assert.equal(args.p_reason,'Wrong quantity');return {data:args.p_id};
 }}});
 const req={params:{kind:'reject_restock'},user:{id:1,role:'admin'},body:{id:'123e4567-e89b-42d3-a456-426614174000',payload:{reason:'Wrong quantity'}}};
 const good=response();await api.command(req,good);assert.equal(good.statusCode,200);
 req.body.payload.reason='';const bad=response();await api.command(req,bad);assert.equal(bad.statusCode,400);assert.equal(calls,1);
});
test('staff request list is scoped to their verified account', async () => {
 const filters=[];const query={select(){return this;},eq(...args){filters.push(args);return this;},or(){return this;},order(){return this;},async range(){return {data:[],count:0};}};
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{from:()=>query}});
 const res=response();await api.requests({query:{status:'pending',actor_id:1},user:{id:2,role:'staff'}},res);
 assert.equal(res.statusCode,200);assert.ok(filters.some(([key,value])=>key==='actor_id'&&value===2));assert.ok(filters.some(([key,value])=>key==='actor_role'&&value==='staff'));
 const bad=response();await api.requests({query:{status:'other'},user:{id:2,role:'staff'}},bad);assert.equal(bad.statusCode,400);
});
test('checkout replay must match staff, client, payment and normalized items', async () => {
 const prior={id:4,staff_id:2,user_id:3,payment_method:'cash',tendered_amount:100,transaction_items:[{product_id:1,quantity:3}]};
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:prior};}};
 const model=load('models/transaction.model.js',{'../config/db':{db:{}},'../config/supabase':{from:()=>query}});
 const body={user_id:3,payment_method:'cash',tendered_amount:100,items:[{product_id:1,quantity:1},{product_id:1,quantity:2}]};
 assert.equal((await model.findReplay('REC-test',2,body)).id,4);
 await assert.rejects(()=>model.findReplay('REC-test',9,body),/already used/);
 await assert.rejects(()=>model.findReplay('REC-test',2,{...body,items:[{product_id:1,quantity:4}]}),/already used/);
 await assert.rejects(()=>model.findReplay('REC-test',2,{...body,user_id:8}),/already used/);
});
test('inventory quantities separate expired batches and respect minimum/7-day boundaries', async () => {
 const { inventoryRows } = await import('../../frontend/src/utils/inventory.mjs');
 const products = [{id:1,name:'Coffee',minimum_stock:5},{id:2,name:'Tea',minimum_stock:0},{id:3,name:'Milk',minimum_stock:5}];
 const batch = (id,qty,expiry) => ({product_id:id,store_qty:qty,warehouse_qty:0,expiry_date:expiry});
 const rows = inventoryRows(products,[batch(1,10,'2026-10-10'),batch(1,3,'2026-10-17'),batch(1,2,null),batch(2,1,'2026-10-18')],'2026-10-10');
 assert.equal(rows[0].available,5); assert.equal(rows[0].expired,10); assert.equal(rows[0].soon,3); assert.equal(rows[0].stockStatus,'low');
 assert.equal(rows[1].stockStatus,'in'); assert.equal(rows[1].soon,0); assert.equal(rows[2].stockStatus,'out');
 assert.equal(inventoryRows(products,[batch(1,10,'2026-10-10')],'2026-10-10',false)[0].available,10);
});
