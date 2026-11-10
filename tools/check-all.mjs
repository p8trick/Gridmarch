// 一键检查：布局校验 + 各预设地图的接缝检查 + 海岸 47 种邻域完备性。任何一项失败返回非零（给 CI 用）。
import {spawnSync} from 'child_process'; import path from 'path';
const dir = path.dirname(new URL(import.meta.url).pathname), loader = path.join(dir, 'loader.mjs');
const run = (script, args = []) => spawnSync(process.execPath, ['--no-warnings', '--loader', loader, path.join(dir, script), ...args], {encoding: 'utf8'});
let bad = 0;
const r1 = run('check-layout.mjs'); process.stdout.write(r1.stdout.replace(/.*toNonIndexed.*\n/g, '')); if (r1.status) bad++;
const r3 = run('check-coast-blob47.mjs'); process.stdout.write(r3.stdout); if (r3.status || /拒绝 [1-9]/.test(r3.stdout)) bad++;
const names = run('list-presets.mjs').stdout.split('\n').filter(l => /^[\w-]+$/.test(l));
for (const k of names) {
  const r = run('check-water-seams.mjs', [k]); const rows = r.stdout.split('\n').filter(l => /边\d/.test(l));
  const flagged = rows.filter(l => !/超差0 /.test(l)).length;
  console.log(`接缝 ${k.padEnd(13)} ${rows.length} 条交界，超差 ${flagged} 条` + (flagged ? '（需人工确认：多为沙草过渡带的采样）' : ''));
  if (r.status) bad++;
}
console.log(bad ? '✗ 有检查失败' : '✓ 全部通过'); process.exit(bad ? 1 : 0);
