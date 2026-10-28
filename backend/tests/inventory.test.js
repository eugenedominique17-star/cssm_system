const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
function load(relative,mocks){const filename=path.resolve(__dirname,'..',relative);const local=Module.createRequire(filename);const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:local(name);mod._compile(fs.readFileSync(filename,'utf8'),filename);return mod.exports;}
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const id='123e4567-e89b-42d3-a456-426614174000';
const req=(kind,payload,role='staff')=>({params:{kind},user:{id:2,role},body:{id,payload}});
test('inventory uses authenticated actor and accepts only a validated request payload',async()=>{
 let args;
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,fields)=>{assert.equal(name,'inventory_command');args=fields;return {data:id};}}});
 const res=response();await api.command(req('transfer',{batch_id:id,quantity:30}),res);
 assert.equal(res.statusCode,200);assert.equal(args.p_actor,2);assert.equal(args.p_role,'staff');assert.equal(args.p_payload.quantity,30);
 const invalid=req('transfer',{batch_id:id,quantity:30});invalid.body.actor_id=1;
 await api.command(invalid,response().status(200));
 assert.equal(args.p_actor,2);
});
test('staff cannot approve, reverse, or adjust inventory',async()=>{
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:()=>assert.fail('Unauthorized write')}});
 for(const kind of ['approve','reject','adjustment','reversal','expiry']){const res=response();await api.command(req(kind,{}),res);assert.equal(res.statusCode,403);}
});
test('invalid transfer quantities and client-selected actor fields are rejected before RPC',async()=>{
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:()=>assert.fail('Invalid write')}});
 for(const quantity of [0,-1,1.5,1000001,'NaN']){const res=response();await api.command(req('transfer',{batch_id:id,quantity}),res);assert.equal(res.statusCode,400);}
 const forged=req('transfer',{batch_id:id,quantity:1});forged.body.actor_id=1;
 const res=response();await api.command(forged,res);assert.equal(res.statusCode,400);
});
test('delivery requires accepted line items, supplier and receipt',async()=>{
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:()=>assert.fail('Invalid delivery')}});
 for(const payload of [{supplier:'ABC',receipt_number:'R1',items:[]},{supplier:'ABC',items:[{product_id:1,quantity:5,batch_code:'LOT',expiry_date:null}]}]){const res=response();await api.command(req('delivery',payload),res);assert.equal(res.statusCode,400);}
});
test('database conflict and setup failures return useful HTTP statuses',async()=>{
 for(const [code,status] of [['PT409',409],['23505',409],['PGRST202',503]]){const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async()=>({error:{code,message:'Conflict'}})}});const res=response();await api.command(req('transfer',{batch_id:id,quantity:1}),res);assert.equal(res.statusCode,status);}
});
test('legacy product updates cannot overwrite stock',async()=>{
 const api=load('controllers/product.controller.js',{'../models/product.model':{getById:async()=>({id:1,stock:20}),update:()=>assert.fail('Must not overwrite')},'../models/submission.model':{create:()=>assert.fail('Must not submit old stock path')}});
 const res=response();await api.update({params:{id:1},user:{id:2,role:'staff'},body:{stock:50}},res);assert.equal(res.statusCode,409);
});
test('staff cannot edit product prices',async()=>{
 const api=load('controllers/product.controller.js',{'../models/product.model':{getById:async()=>({id:1,stock:20}),update:()=>assert.fail('Must not update price')},'../models/submission.model':{create:()=>assert.fail('Must not submit price change')}});
 const res=response();await api.update({params:{id:1},user:{id:2,role:'staff'},body:{name:'Milk',description:'',price:99,category:'Dairy'}},res);
 assert.equal(res.statusCode,403);
 assert.equal(res.body.message,'Only admins can edit product prices.');
});
test('only admins can receive reorder deliveries with an actual purchase price',async()=>{
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,args)=>{assert.equal(name,'inventory_receive_reorder');assert.equal(args.p_purchase_price,35.5);return {data:id};}}});
 const denied=response();await api.receiveReorder({params:{id},user:{id:2,role:'staff'},body:{purchase_price:35.5}},denied);assert.equal(denied.statusCode,403);
 const allowed=response();await api.receiveReorder({params:{id},user:{id:1,role:'admin'},body:{purchase_price:35.5}},allowed);assert.equal(allowed.statusCode,200);
});
test('damage and supplier return are admin-only inventory actions',async()=>{
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async()=>({data:id})}});
 for(const kind of ['damage','supplier_return']){
  const res=response();await api.command(req(kind,{batch_id:id,quantity:1,unit_cost:35,reason:'Verified count'},'staff'),res);assert.equal(res.statusCode,403);
 }
});
test('admin damage and supplier return use atomic loss RPC with validated actual cost',async()=>{
 let calls=0;
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,args)=>{calls++;assert.equal(name,'inventory_record_loss');assert.equal(args.p_role,'admin');assert.equal(args.p_payload.unit_cost,35);return {data:id};}}});
 for(const kind of ['damage','supplier_return']){
  const res=response();await api.command(req(kind,{batch_id:id,quantity:1,unit_cost:35,reason:'Verified supplier issue'},'admin'),res);assert.equal(res.statusCode,200);
 }
 assert.equal(calls,2);
 const invalid=response();await api.command(req('damage',{batch_id:id,quantity:1,unit_cost:0,reason:'bad'},'admin'),invalid);assert.equal(invalid.statusCode,400);
});
test('product lists and low-stock alerts exclude expired store quantities while preserving physical totals',async()=>{
 const model=load('models/product.model.js',{'../config/db':{db:{products:{getAll:async()=>[{id:1,name:'Milk',stock:20,status:'active'}]}}},'../config/supabase':{rpc:async()=>({data:[{product_id:1,available_stock:3}]})}});
 const products=await model.getAll(true);
 assert.equal(products[0].stock,3);assert.equal(products[0].physical_store_stock,20);
 assert.equal((await model.getLowStock(5)).length,1);
});
test('availability errors do not silently advertise expired stock as sellable',async()=>{
 const model=load('models/product.model.js',{'../config/db':{db:{products:{getAll:async()=>[{id:1,stock:20}]}}},'../config/supabase':{rpc:async()=>({error:{code:'08006'}})}});
 await assert.rejects(()=>model.getAll());
});
test('expiry corrections use the admin identity and a dedicated atomic audit RPC',async()=>{
 let called=false;
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:async(name,args)=>{
  called=true;assert.equal(name,'inventory_edit_expiry');assert.equal(args.p_actor,2);assert.equal(args.p_expected,null);assert.equal(args.p_confirm_reactivation,false);return {data:id};
 }}});
 const res=response();await api.command(req('expiry',{batch_id:id,expiry_date:'2027-02-01',expected_expiry:null,reason:'Verified supplier label'},'admin'),res);
 assert.equal(res.statusCode,200);assert.equal(called,true);
});
test('expiry corrections cannot erase the date or omit a meaningful reason',async()=>{
 const api=load('controllers/inventory.controller.js',{'../config/supabase':{rpc:()=>assert.fail('Invalid correction')}});
 for(const extra of [{expiry_date:null},{reason:'fix'},{expected_expiry:undefined}]){
  const res=response();await api.command(req('expiry',{batch_id:id,expiry_date:'2027-02-01',expected_expiry:null,reason:'Verified supplier label',...extra},'admin'),res);assert.equal(res.statusCode,400);
 }
});
