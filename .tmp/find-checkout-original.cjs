const fs=require('fs');
const f='C:/Users/LENOVO/.codex/sessions/2026/10/06/rollout-2026-10-06T20-52-27-01a11145-bab4-76e3-95f5-2eeb4322c933.jsonl';
for(const line of fs.readFileSync(f,'utf8').split('\n')){
 if(!line)continue;const p=JSON.parse(line).payload;
 const v=JSON.stringify(p);if(v?.includes('Checkout')) console.log(v.slice(0,1000));
}
