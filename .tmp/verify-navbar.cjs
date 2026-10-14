const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const requireFrontend = Module.createRequire(path.join(root, 'frontend/package.json'));
const React = requireFrontend('react');
const { renderToString } = requireFrontend('react-dom/server');
const { ThemeProvider, CssBaseline } = requireFrontend('@mui/material');
const babel = requireFrontend('@babel/core');
function compile(file, mocks = {}) {
  const local = Module.createRequire(file); const mod = new Module(file);
  mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : local(name);
  const result = babel.transformSync(fs.readFileSync(file, 'utf8'), { babelrc: false, configFile: false,
    presets: [[requireFrontend.resolve('@babel/preset-react'), { runtime: 'classic' }]],
    plugins: [requireFrontend.resolve('@babel/plugin-transform-modules-commonjs')] });
  mod._compile(result.code, file); return mod.exports.default;
}
const theme = compile(path.join(root, 'frontend/src/theme.js'));
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!edge) throw new Error('Edge is unavailable for layout verification');
const folder = path.join(__dirname, 'navbar-layout'); fs.mkdirSync(folder, { recursive: true });
for (const role of ['staff', 'admin', 'client']) {
  const Nav = compile(path.join(root, 'frontend/src/components/Navbar.jsx'), {
    '../contexts/AuthContext': { useAuth: () => ({ user: { name: 'A Long Account Name For Layout', role }, isAuthenticated: true, isAdmin: role === 'admin', isStaff: role === 'staff', isClient: role === 'client', logout() {} }) },
    'react-router-dom': { useNavigate: () => () => {}, useLocation: () => ({ pathname: '/' }) },
  });
  const markup = renderToString(React.createElement(ThemeProvider, { theme }, React.createElement(React.Fragment, null, React.createElement(CssBaseline), React.createElement(Nav, { homepage: true }))));
  const check = `<script>addEventListener('load',()=>{
    const nav=document.querySelector('nav');const rect=nav.getBoundingClientRect();const buttons=[...nav.querySelectorAll('button')];const errors=[];
    const visible=rect.width>0&&rect.height>0;
    if(visible){for(const button of buttons){const b=button.getBoundingClientRect();if(b.left<rect.left-1||b.right>rect.right+1)errors.push('outside nav: '+button.textContent);const icon=button.querySelector('.MuiButton-startIcon');const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(n.textContent.trim()&&!n.parentElement.closest('style')){const r=document.createRange();r.selectNodeContents(n);if(icon&&icon.getBoundingClientRect().right>r.getBoundingClientRect().left+1)errors.push('icon overlaps: '+button.textContent);break;}}}
    for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i].getBoundingClientRect(),b=buttons[j].getBoundingClientRect();if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)errors.push('buttons overlap');}}
    else {const menu=document.querySelector('[aria-label="Open navigation menu"]');if(!menu||!menu.getBoundingClientRect().width)errors.push('mobile menu missing');}
    if(document.documentElement.scrollWidth>innerWidth+1)errors.push('horizontal page overflow');
    const pre=document.createElement('pre');pre.id='nav-check';pre.textContent=JSON.stringify({width:innerWidth,desktop:visible,links:buttons.length,errors});document.body.append(pre);
  });</script>`;
  const html = path.join(folder, role + '.html');
  fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + fs.readFileSync(path.join(root, 'frontend/src/App.css'), 'utf8') + '</style></head><body>' + markup + check + '</body></html>');
  for (const width of [375, 1200, 1440]) {
    const args = ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--dump-dom', '--window-size=' + width + ',800', '--user-data-dir=' + path.join(folder, 'browser-profile'), 'file:///' + html.replaceAll('\\', '/')];
    const run = spawnSync(edge, args, { windowsHide: true, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
    const match = run.stdout?.match(/<pre id="nav-check">([^<]+)<\/pre>/);
    if (!match) throw new Error('No layout result for ' + role + '/' + width + ': ' + (run.error?.message || run.stderr?.slice(-500)));
    const result = JSON.parse(match[1].replaceAll('&amp;', '&')); console.log(role, result);
    if (result.errors.length) process.exitCode = 1;
  }
}
