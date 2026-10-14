const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const req = Module.createRequire(path.resolve('frontend/package.json'));
const babel = req('@babel/core');
function compile(file) {
 const result = babel.transformFileSync(path.resolve(file), { babelrc:false, configFile:false, presets:[req.resolve('@babel/preset-react')], plugins:[req.resolve('@babel/plugin-transform-modules-commonjs')] });
 return result.code;
}
for (const role of ['Staff', 'Client']) compile(`frontend/src/pages/admin/${role}Approvals.jsx`);
const file = path.resolve('frontend/src/components/AccountApprovalCards.jsx');
const mod = new Module(file); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); mod._compile(compile(file), file);
const React = req('react');
const markup = req('react-dom/server').renderToString(React.createElement(mod.exports.default, { accounts:[{id:1000008, name:'Eugene Dominique Entrealgo', email:'a-very-long-email-address-for-testing@example.com', phone:'09515200688', created_at:'2026-10-11'}], role:'client', onApprove:()=>{}, onReject:()=>{} }));
fs.writeFileSync('.tmp/approval-preview.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;font-family:Arial}*{box-sizing:border-box}</style>'+markup+`<script>onload=()=>{const errors=[];for(const el of document.querySelectorAll('article,button,dd,h2')){const r=el.getBoundingClientRect();if(r.right>innerWidth||r.left<0||el.scrollWidth>el.clientWidth+1)errors.push(el.textContent)}document.body.insertAdjacentHTML('beforeend','<pre id="result">'+JSON.stringify(errors)+'</pre>')}</script>`);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
for(const width of [560,1280]) {
 const result = require('node:child_process').spawnSync(edge,['--headless','--disable-gpu','--no-first-run','--dump-dom','--window-size='+width+',900','--user-data-dir='+path.resolve('.tmp/approval-edge'),'file:///'+path.resolve('.tmp/approval-preview.html').replaceAll('\\','/')],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8000000});
 const match=result.stdout?.match(/<pre id="result">([^<]*)<\/pre>/);
 if(!match || match[1]!=='[]') throw Error('Layout failure '+width+': '+match?.[1]);
 console.log('Approval cards layout passed at window width '+width);
}
console.log('Both approval pages compile successfully.');
