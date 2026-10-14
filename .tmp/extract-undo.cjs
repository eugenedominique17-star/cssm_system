const fs=require('fs');
for(let n=0;n<6;n++){
 const blocks=JSON.parse(fs.readFileSync('.tmp/session-original-'+n+'.txt','utf8'));
 for(let j=0;j<blocks.length;j++){
  let t=blocks[j].text;if(!t)continue;
  try { const v=JSON.parse(t);t=v.value?.output||v.output||t; } catch{}
  const names=['OrderManagement','Checkout','Reports','ReceiptManagement'];
  const found=names.filter(x=>t.includes('const '+x+' ='));
  if(found.length){fs.writeFileSync(`.tmp/recovered-${n}-${j}.txt`,t);console.log(n,j,found,t.length,t.startsWith('import'), t.includes('tokens truncated'));}
 }
}
