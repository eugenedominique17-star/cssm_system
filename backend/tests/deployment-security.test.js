const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const jwt = require('jsonwebtoken');
const express = require('express');
process.env.AUDIT_SECRET_KEY ||= '00'.repeat(32);
function load(relative, mocks) {
  const filename = path.resolve(__dirname,'..',relative);
  const localRequire = Module.createRequire(filename);
  const mod = new Module(filename); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks,name) ? mocks[name] : localRequire(name);
  mod._compile(fs.readFileSync(filename,'utf8'),filename); return mod.exports;
}
const response = () => ({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('temporary credentials are random and satisfy existing checks',()=>{
  const {generateTempPassword}=require('../utils/password');
  const values=Array.from({length:100},()=>generateTempPassword());
  assert.equal(new Set(values).size,100);
  for(const value of values) { assert.ok(value.length>=24); assert.match(value,/[A-Z]/); assert.match(value,/[a-z]/); assert.match(value,/[0-9]/); }
});
test('forced password change blocks API access but permits profile and change endpoint',async()=>{
  const original=process.env.JWT_SECRET; process.env.JWT_SECRET='test-only-secret';
  try {
    const {authenticate}=load('middleware/auth.js',{'../models/user.model':{findById:async()=>({id:2,role:'staff',status:'active',must_change_password:true})},'./audit':{auditMutation(){}},dotenv:{config(){}}});
    const headers={authorization:'Bearer '+jwt.sign({id:2,role:'staff'},process.env.JWT_SECRET)};
    for(const [method,baseUrl,url,allowed] of [['GET','/api/users','/',false],['POST','/api/auth','/change-password',true],['GET','/api/auth','/me',true],['PUT','/api/auth','/profile',false]]) {
      let called=false; const res=response();
      await authenticate({headers,method,baseUrl,path:url},res,()=>{called=true;});
      assert.equal(called,allowed); if(!allowed) assert.equal(res.body.code,'PASSWORD_CHANGE_REQUIRED');
    }
  } finally { if(original===undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET=original; }
});
test('failed account writes never return success or disclose a new credential',async()=>{
  const api=load('controllers/user.controller.js',{'../models/user.model':{findById:async()=>({role:'client'}),findByIdWithPassword:async()=>({id:3,role:'client'}),update:async()=>null,updateStatus:async()=>null,updatePassword:async()=>null,delete:async()=>false},'../models/submission.model':{}});
  for(const handler of ['update','deactivate','delete','resetPassword']) {
    const res=response(); await api[handler]({params:{id:3},body:{}},res);
    assert.equal(res.statusCode,500); assert.equal(res.body.credentials,undefined);
  }
});
test('password change failure preserves forced-change flag and same password is rejected',async()=>{
  const api=load('controllers/auth.controller.js',{'../models/user.model':{findByIdWithPassword:async()=>({password:'hash'}),updatePassword:async()=>null},bcryptjs:{compare:async()=>true,genSalt:async()=>'',hash:async()=>''}});
  for(const [password,status] of [['oldpass',400],['newpass',500]]) {
    const res=response(); await api.changePassword({user:{id:3},body:{currentPassword:'oldpass',newPassword:password}},res); assert.equal(res.statusCode,status);
  }
});
test('failed promo writes are reported as failures',async()=>{
  const api=load('controllers/promo.controller.js',{'../models/promo.model':{getById:async()=>({id:1}),update:async()=>null,delete:async()=>false},'../models/submission.model':{}});
  for(const handler of ['update','delete']) {
    const res=response(); await api[handler]({params:{id:1},user:{role:'admin'},body:{}},res); assert.equal(res.statusCode,500);
  }
});
test('submission RPC uses the verified admin and fails closed on missing migrations',async()=>{
  let args;
  const api=load('models/submission.model.js',{'../config/db':{db:{}},'../config/supabase':{rpc:async(name,params)=>{args={name,params};return {error:{code:'PGRST202',message:'not installed'}};}}});
  await assert.rejects(()=>api.reviewAtomic('42','approved','ok',7),{status:503});
  assert.equal(args.name,'review_submission_atomic'); assert.equal(args.params.p_actor_id,7); assert.equal(args.params.p_id,42);
});
test('login limiter blocks repeated failures with 429',async()=>{
  const app=express(); app.post('/login',require('../middleware/login-limit'),(_req,res)=>res.status(401).json({message:'Invalid'}));
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  try {
    const url=`http://127.0.0.1:${server.address().port}/login`;
    for(let i=0;i<20;i++) { const r=await fetch(url,{method:'POST'}); assert.equal(r.status,401); await r.text(); }
    const r=await fetch(url,{method:'POST'}); assert.equal(r.status,429); assert.ok(r.headers.get('retry-after')); await r.text();
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
