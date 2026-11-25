// 语言包自检（1.02）：zh / en 的键必须一一对应；单位 / 地形 / 风格 id 都有词条；占位符 {x} 两边一致；顺带报告战斗界面里还剩多少写死的中文（进度条，不算失败）。
import assert from 'assert'; import fs from 'fs'; import path from 'path';
import {DICT, t, setLang, getLang} from '../src/i18n/index.js';
import {UNITS, TERRAINS, STYLES} from '../src/rules/data.js';
const zh = DICT.zh, en = DICT.en; let n = 0; const ok = (name, f) => { f(); n++; console.log('PASS', name); };
ok('zh / en 键一一对应', () => { const a = Object.keys(zh).filter(k => !(k in en)), b = Object.keys(en).filter(k => !(k in zh)); assert.deepStrictEqual([a, b], [[], []], '英文缺：' + a + ' / 中文缺：' + b); });
ok('没有空词条', () => { for (const l of [zh, en]) for (const [k, v] of Object.entries(l)) assert(typeof v === 'string' && v.trim(), '空词条 ' + k); });
ok('占位符两边一致', () => { const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(); for (const k of Object.keys(zh)) assert.strictEqual(ph(zh[k]), ph(en[k]), '占位符不一致 ' + k); });
ok('每个单位 / 地形 / 风格 id 都有词条，且英文不含中文', () => {
  for (const [tb, g] of [[UNITS, 'unit'], [TERRAINS, 'terrain'], [STYLES, 'style']]) for (const id of Object.keys(tb)) { assert(zh[g + '.' + id] && en[g + '.' + id], '缺词条 ' + g + '.' + id); assert(!/[\u4e00-\u9fff]/.test(en[g + '.' + id]), '英文里有中文 ' + id); }
});
ok('name getter 随语言切换', () => { setLang('en'); assert.strictEqual(UNITS.tank.name, 'Light Tank'); assert.strictEqual(TERRAINS.city_large.name, 'Large City'); setLang('zh'); assert.strictEqual(UNITS.tank.name, '轻坦'); assert.strictEqual(getLang(), 'zh'); });
ok('t() 参数替换 / 缺词退回', () => { const w = console.warn; console.warn = () => {}; try { zh['x.test'] = '共 {n} 个'; en['x.test'] = '{n} in total'; assert.strictEqual(t('x.test', {n: 3}), '共 3 个'); delete en['x.test']; delete zh['x.test']; assert.strictEqual(t('x.nope'), 'x.nope'); } finally { console.warn = w; } });
// 进度：还剩多少写死的中文字符串（只统计 src/ 下战斗相关 js，不含 art / vendor / i18n；注释不算）
let left = 0; const walk = d => { for (const f of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!/vendor|art|i18n/.test(f.name)) walk(p); } else if (p.endsWith('.js')) { for (const l of fs.readFileSync(p, 'utf8').split('\n')) left += (l.split('//')[0].match(/(['"`])(?:(?!\1).)*[\u4e00-\u9fff](?:(?!\1).)*\1/g) || []).length; } } };
walk(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src'));
console.log(`✓ ${n} 项通过；词条 ${Object.keys(zh).length} 条；src 里还剩约 ${left} 处写死的中文字符串待迁移`);
