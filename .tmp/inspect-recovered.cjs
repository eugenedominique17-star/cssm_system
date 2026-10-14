const fs=require('fs');
for(const f of ['.tmp/recovered-1-1.txt','.tmp/recovered-2-1.txt','.tmp/recovered-3-2.txt']){
 const s=fs.readFileSync(f,'utf8');console.log(f,s.slice(0,200));
 for(const name of ['OrderManagement','Checkout','ReceiptManagement']) console.log(name,s.indexOf('const '+name+' ='),s.indexOf('export default '+name));
}
