const fs=require('fs');
const file='C:/Users/LENOVO/.codex/sessions/2026/10/12/rollout-2026-10-12T10-31-47-01a12df3-a376-7be2-87cb-39e00b974870.jsonl';
let n=0;
for(const line of fs.readFileSync(file,'utf8').split('\n')){
 if(!line)continue; const e=JSON.parse(line); const p=e.payload;
 if(e.type==='response_item'&&/tool_call_output|function_call_output/.test(p?.type)){
  const s=typeof p.output==='string'?p.output:JSON.stringify(p.output);
  if(s.includes('const Checkout =')||s.includes('const OrderManagement =')||s.includes('const Reports =')||s.includes('const ReceiptManagement =')){
   fs.writeFileSync('.tmp/session-original-'+n+'.txt',s);console.log(n,s.length,s.slice(0,100)); n++;
  }
 }
}
