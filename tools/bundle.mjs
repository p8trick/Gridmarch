// 单文件离线测试页：从 index.html 的入口出发自动追依赖（按 importmap 解析裸名），拓扑排序后内联成一个 HTML。
// 源码仍是分散的模块文件（给 GitHub / 浏览器直接按模块加载用）；这个只是方便手机上直接打开的测试产物。
// 用法：node tools/bundle.mjs [页面，默认 battle.html]   →   dist/<页面名>_offline.html
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const page = process.argv[2] || 'battle.html', strip = u => u.replace(/\?.*$/, '');
let html = fs.readFileSync(path.join(root, page), 'utf8');
const importmap = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
const entry = path.posix.normalize(strip(html.match(/<script type="module" src="([^"]+)"><\/script>/)[1]));
const bare = Object.fromEntries(Object.entries(importmap).filter(([k]) => !k.startsWith('.')).map(([k, v]) => [k, path.posix.normalize(strip(v))]));
const src = {}, deps = {};
const load = f => {
  if (src[f] !== undefined) return;
  src[f] = fs.readFileSync(path.join(root, f), 'utf8'); deps[f] = {};
  for (const m of src[f].matchAll(/(?:from\s*|import\s*)(['"])([^'"]+)\1/g)) {
    const spec = m[2];
    const t = spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(f), spec)) : bare[spec];
    if (!t) throw Error(f + ' -> ' + spec + ' 无法解析（importmap 里没有）');
    deps[f][spec] = t; load(t);
  }
};
load(entry);
const order = [], seen = new Set();
const visit = f => { if (seen.has(f)) return; seen.add(f); for (const t of Object.values(deps[f])) visit(t); order.push(f); };
visit(entry);
const b64 = Object.fromEntries(order.map(f => [f, Buffer.from(src[f], 'utf8').toString('base64')]));
const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => fs.readFileSync(path.join(root, strip(m[1])), 'utf8')).join('\n');
html = html.replace(/<script type="importmap">.*?<\/script>\s*/s, '').replace(/<link rel="stylesheet" href="[^"]+">/g, '<style>' + css + '</style>').replace(/<script type="module" src="[^"]+"><\/script>/, '');
const runtime = `(async()=>{try{
const FILES=${JSON.stringify(b64)},ORDER=${JSON.stringify(order)},DEPS=${JSON.stringify(deps)};
const dec=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
const urls={};
for(const id of ORDER){
  let s=dec(FILES[id]);
  s=s.replace(/((?:from|import)\\s*)(['"])([^'"]+)\\2/g,(m,pre,q,spec)=>DEPS[id][spec]?pre+q+urls[DEPS[id][spec]]+q:m);
  urls[id]=URL.createObjectURL(new Blob([s],{type:'text/javascript'}));
}
await import(urls[${JSON.stringify(entry)}]);
}catch(e){const el=document.getElementById('err');el.style.display='block';el.textContent='加载失败：'+(e&&e.message||e);}})();`;
fs.mkdirSync(path.join(root, 'dist'), {recursive: true});
const out = html.replace('</body>', '<script>' + runtime + '</script>\n</body>');
const outName = 'dist/' + page.replace(/\.html$/, '') + '_offline.html'; fs.writeFileSync(path.join(root, outName), out);
console.log('模块', order.length, '个；单文件', (out.length / 1e6).toFixed(2) + 'MB → ' + outName);
