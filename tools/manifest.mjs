// 给当前仓库状态拍一张"文件指纹快照"：docs/manifests/<版本>.json（每个文件的 md5）。
// 用途：用户的 GitHub 停在哪个版本，就用那个版本的快照和现在对比，得到精确的"需要更新的文件"清单（见 tools/pack.mjs），
// 不用靠人工比对，也不怕跳版本。每次交付都要拍一张。
// 用法：node tools/manifest.mjs <版本，如 v8 或 0.20>
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKIP = f => /^(\.git|node_modules|dist)(\/|$)/.test(f) || f.startsWith('docs/manifests/') || f.endsWith('.DS_Store');
export function snapshot(dir = root) {   // dir：要拍快照的目录（默认当前仓库；也可以指向解压出来的旧版本）
  const out = {}, walk = d => { for (const e of fs.readdirSync(path.join(dir, d), {withFileTypes: true})) { const p = d ? d + '/' + e.name : e.name; if (SKIP(p)) continue; e.isDirectory() ? walk(p) : out[p] = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, p))).digest('hex'); } };
  walk(''); return Object.fromEntries(Object.entries(out).sort());
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const v = process.argv[2], dir = process.argv[3] ? path.resolve(process.argv[3]) : root;   // 第二个参数可选：给某个旧版本解压目录拍快照
  if (!v) { console.log('用法：node tools/manifest.mjs <版本> [目录]'); process.exit(1); }
  const files = snapshot(dir); fs.mkdirSync(path.join(root, 'docs/manifests'), {recursive: true});
  fs.writeFileSync(path.join(root, 'docs/manifests', v + '.json'), JSON.stringify({version: v, files}, null, 1));
  console.log('已写入 docs/manifests/' + v + '.json，', Object.keys(files).length, '个文件');
}
