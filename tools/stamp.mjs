// 缓存戳：iOS 独立 PWA 没有 Service Worker 时会死缓存 js，而 ES 模块的 import 路径加不了 ?v=。
// 办法：给页面的 importmap 列出 src/ 下每个文件，并把它映射到 "路径?v=内容哈希"。浏览器按解析后的完整地址查 importmap，
// 所以模块里的相对 import 也会被换成带哈希的地址；文件内容没变哈希就不变，缓存照用；改了哪个，只有那个重新下载。
// 用法：node tools/stamp.mjs [页面...]   （默认 battle.html test.html）。改了 src/ 下任何文件后重新运行一次再提交。
// 没有重新运行也不会坏——只是改动的文件可能还在用旧缓存。
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pages = process.argv.length > 2 ? process.argv.slice(2) : ['battle.html', 'test.html'];
const hash = f => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 8);
const walk = d => fs.readdirSync(path.join(root, d), {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.posix.join(d, e.name)) : [path.posix.join(d, e.name)]);
const files = walk('src').filter(f => /\.(js|css)$/.test(f)), H = Object.fromEntries(files.map(f => [f, hash(f)]));
const strip = u => u.replace(/\?.*$/, '');
for (const page of pages) {
  let html = fs.readFileSync(path.join(root, page), 'utf8');
  const m = html.match(/(<script type="importmap">)(.*?)(<\/script>)/s); if (!m) throw Error(page + ' 没有 importmap');
  const old = JSON.parse(m[2]).imports, imports = {};
  for (const [k, v] of Object.entries(old)) if (!k.startsWith('.')) { const f = path.posix.normalize(strip(v)); if (!H[f]) throw Error(k + ' → ' + f + ' 不存在'); imports[k] = './' + f + '?v=' + H[f]; }
  for (const f of files.filter(f => f.endsWith('.js'))) imports['./' + f] = './' + f + '?v=' + H[f];
  html = html.replace(m[0], m[1] + JSON.stringify({imports}) + m[3]);
  // 入口脚本与样式表的地址也带哈希
  html = html.replace(/(<script type="module" src=")(\.\/[^"?]+)(\?v=\w+)?(")/, (_, a, f, _v, d) => a + f + '?v=' + H[path.posix.normalize(f)] + d);
  html = html.replace(/(<link rel="stylesheet" href=")(\.\/[^"?]+)(\?v=\w+)?(")/g, (_, a, f, _v, d) => a + f + '?v=' + H[path.posix.normalize(f)] + d);
  const build = crypto.createHash('sha1').update(Object.values(H).join()).digest('hex').slice(0, 6);   // 整体版本号：战场页左下角显示，用来确认手机拿到的是不是新版
  html = html.replace(/(<meta name="gm-build" content=")[^"]*(")/, '$1' + build + '$2');
  fs.writeFileSync(path.join(root, page), html);
  console.log(page, '→', Object.keys(imports).length, '个映射，build', build);
}
