const fs=require('fs'),path=require('path');
for (const d of fs.readdirSync('frontend').filter(d=>d.startsWith('build-') && d!=='build-walkin-check')) {
 const folder=path.join('frontend',d,'static/js'); if(!fs.existsSync(folder))continue;
 for(const f of fs.readdirSync(folder).filter(f=>f.endsWith('.map'))){
 const m=JSON.parse(fs.readFileSync(path.join(folder,f),'utf8'));
 for(const name of ['OrderManagement.jsx','Checkout.jsx','ReceiptManagement.jsx','Reports.jsx','Homepage.jsx']){
 const i=m.sources.findIndex(s=>s.endsWith('/'+name)); if(i>=0){ const target='.tmp/undo-'+d+'-'+name; fs.writeFileSync(target,m.sourcesContent[i]); console.log(d,name,m.sourcesContent[i].length,fs.statSync(path.join(folder,f)).mtime.toISOString()); }
 }
 }
}
