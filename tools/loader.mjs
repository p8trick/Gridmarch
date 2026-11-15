// Node 测试用的模块解析器：把裸名 three / palette 映射到仓库里的文件（浏览器里由 index.html 的 importmap 做同样的事）。
// 用法：node --no-warnings --loader ./tools/loader.mjs tools/check-layout.mjs
const map = {three: '../src/vendor/three.module.js', palette: '../src/art/palette.js'};
export async function resolve(s, c, n) {
  if (map[s]) return {url: new URL(map[s], import.meta.url).href, shortCircuit: true};
  return n(s, c);
}
