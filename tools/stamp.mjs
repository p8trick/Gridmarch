// 页面启动脚本生成器。
//
// 背景：iOS 独立 PWA 没有 Service Worker 时会死缓存 js，而 ES 模块的 import 路径加不了 ?v=。
// 做法：每个页面里有一小段启动脚本，启动时读取网址里的 ?v=版本号，把 src/ 下每个 js 文件通过 importmap 映射到 "路径?v=版本号"，
// 然后再加载入口模块。版本号只在 index.html 里（主页带着 ?v= 跳进来）；直接打开页面没有 ?v= 时用时间戳，每次都拿最新。
// 这个工具负责维护那段脚本里的"文件清单"（新增 / 删除 / 重命名了 src/ 下的 js 之后运行一次）。清单漏了某个文件也不会坏，
// 只是那个文件不带版本号（可能吃到旧缓存）。
//
// 页面怎么接入：在 <head> 里写这两行注释，工具会在中间生成启动脚本（entry 是入口模块，css 是样式表，都相对仓库根目录）：
//   <!--GM-BOOT entry="src/app/main.js" css="src/app/ui.css"-->
// 主页 index.html 写 <!--GM-BOOT self="1"-->（无 entry）：版本号取自它自己的 GM_VERSION，只生成 importmap，战场模块由 home.js 按需 import()。
//   <!--/GM-BOOT-->
// 用法：node tools/stamp.mjs        （处理仓库根目录和 tests/ 下所有带标记的 html）
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const walk = d => fs.readdirSync(path.join(root, d), {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.posix.join(d, e.name)) : [path.posix.join(d, e.name)]);
const files = walk('src').filter(f => f.endsWith('.js')).sort();
const pages = [...fs.readdirSync(root), ...fs.readdirSync(path.join(root, 'tests')).map(f => 'tests/' + f)].filter(f => f.endsWith('.html'));
const bare = {three: 'src/vendor/three.module.js', palette: 'src/art/palette.js'};   // 裸名导入（美术模块里写 import 'three' / 'palette'）
const MARK = /<!--GM-BOOT([^>]*?)-->[\s\S]*?<!--\/GM-BOOT-->/;
let n = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8'), m = html.match(MARK); if (!m) continue;
  const attr = k => (m[1].match(new RegExp(k + '="([^"]*)"')) || [])[1] || '';
  const entry = attr('entry'), css = attr('css').split(/\s+/).filter(Boolean), self = attr('self') === '1';   // self="1"：主页（index.html）自己定义 GM_VERSION，不读网址；没有 entry：只生成 importmap（入口由主页 js 按需 import）
  for (const f of [entry, ...css, ...Object.values(bare)].filter(Boolean)) if (!fs.existsSync(path.join(root, f))) throw Error(page + '：' + f + ' 不存在');
  const base = path.posix.relative(path.posix.dirname(page), '.') || '.', B = base === '.' ? './' : base + '/';
  const script = `<!--GM-BOOT${m[1]}-->
<script>
/* 由 tools/stamp.mjs 生成，请勿手改。版本号只在 index.html 里：主页带 ?v=版本 跳进来；直接打开没有 v 时用时间戳（永远拿最新）。 */
(function () {
  var v = ${self ? "window.GM_VERSION || 'dev'" : "new URLSearchParams(location.search).get('v') || ('t' + Date.now())"}, B = ${JSON.stringify(B)}, im = {};
  var FILES = ${JSON.stringify(files.map(f => f.replace(/^src\//, '')))}, BARE = ${JSON.stringify(Object.fromEntries(Object.entries(bare).map(([k, f]) => [k, f.replace(/^src\//, '')])))};
  function u(f) { return B + 'src/' + f + (f.indexOf('vendor/') === 0 ? '' : '?v=' + v); }   // vendor（three.js）不随版本号变，永远走缓存
  FILES.forEach(function (f) { im[B + 'src/' + f] = u(f); });
  for (var k in BARE) im[k] = u(BARE[k]);
  window.GM_VERSION = v;
  document.write('<script type="importmap">' + JSON.stringify({imports: im}) + '<\\/script>');
${css.map(c => `  document.write('<link rel="stylesheet" href="' + u(${JSON.stringify(c.replace(/^src\//, ''))}) + '">');`).join('\n')}
${entry ? `  document.write('<script type="module" src="' + u(${JSON.stringify(entry.replace(/^src\//, ''))}) + '"><\\/script>');\n` : ''}})();
</script>
<!--/GM-BOOT-->`;
  fs.writeFileSync(path.join(root, page), html.replace(MARK, () => script)); n++;
  console.log(page, '→ 入口', entry, '，清单', files.length, '个文件');
}
if (!n) console.log('没有找到带 <!--GM-BOOT ...--> 标记的页面');
