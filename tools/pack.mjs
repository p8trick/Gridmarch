// 生成"升级包"：对比 docs/manifests/<from>.json 和当前仓库，只打包新增 / 修改的文件，并写好升级说明。
// 用户的 GitHub 在哪个版本都行（只要有那个版本的快照），所以可以跳版本。
// 用法：node tools/pack.mjs <from版本> <to版本> [notes.json] [输出.zip]
//   notes.json：可选，{"文件路径": "一句话原因"}，写进升级说明
import fs from 'fs'; import path from 'path'; import {execSync} from 'child_process'; import os from 'os';
import {root, snapshot} from './manifest.mjs';
const [from, to, notesFile, outArg] = process.argv.slice(2);
if (!from || !to) { console.log('用法：node tools/pack.mjs <from> <to> [notes.json] [输出.zip]'); process.exit(1); }
const base = JSON.parse(fs.readFileSync(path.join(root, 'docs/manifests', from + '.json'), 'utf8')).files, cur = snapshot();
const add = Object.keys(cur).filter(f => !(f in base)), mod = Object.keys(cur).filter(f => f in base && base[f] !== cur[f]), rem = Object.keys(base).filter(f => !(f in cur));
const notes = notesFile && fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
const mfDir = path.join(root, 'docs/manifests'), snaps = fs.existsSync(mfDir) ? fs.readdirSync(mfDir).filter(f => f.endsWith('.json')).map(f => 'docs/manifests/' + f) : [];   // 版本快照不参与比对，但每次都放进包里（以后生成升级包要靠它们）
const line = f => '- `' + f + '`' + (notes[f] ? '：' + notes[f] : '');
let md = `# 升级说明：${from} → ${to}\n\n你的 GitHub 现在是 ${from}。覆盖下面的文件即可升到 ${to}（目录结构保持原样）。\n\n`;
if (add.length) md += '## 新增\n\n' + add.map(line).join('\n') + '\n\n';
if (mod.length) md += '## 修改（同名覆盖）\n\n' + mod.map(line).join('\n') + '\n\n';
md += '## 版本快照（每次都覆盖 / 放入）\n\n' + snaps.map(f => '- `' + f + '`').join('\n') + '\n\n';
md += '## 删除\n\n' + (rem.length ? '请在仓库里删掉：\n\n' + rem.map(f => '- `' + f + '`').join('\n') : '- 无') + '\n\n';
const runtime = [...add, ...mod].some(f => /^src\//.test(f) || /\.html$/.test(f));   // 运行文件有变化才需要刷新缓存
md += '## 更新后\n\n' + (runtime ? '- 这次改动了运行文件：把 `index.html` 里的 `GM_VERSION` 加一位（避开手机旧缓存）。\n' : '- 这次只改了文档 / 工具，不需要改 `GM_VERSION`。\n');
const out = path.resolve(outArg || path.join(root, 'dist', `升级包_${from}到${to}.zip`)); fs.mkdirSync(path.dirname(out), {recursive: true}); if (fs.existsSync(out)) fs.unlinkSync(out);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-')); fs.writeFileSync(path.join(tmp, '升级说明.md'), md); fs.writeFileSync(path.join(tmp, 'list.txt'), [...add, ...mod, ...snaps].join('\n'));
if (add.length + mod.length + snaps.length) execSync(`zip -q "${out}" -@ < "${path.join(tmp, 'list.txt')}"`, {cwd: root, shell: '/bin/bash'});
execSync(`zip -q -j "${out}" "${path.join(tmp, '升级说明.md')}"`);
console.log(`${from} → ${to}：新增 ${add.length}，修改 ${mod.length}，删除 ${rem.length} → ${out}`);
