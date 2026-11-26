// 语言包自检（1.02）：zh / en 的键必须一一对应；单位 / 地形 / 风格 id 都有词条；占位符 {x} 两边一致；顺带报告战斗界面里还剩多少写死的中文（进度条，不算失败）。
import assert from 'assert'; import fs from 'fs'; import path from 'path';
import {DICT, t, setLang, getLang} from '../src/i18n/index.js';
import {UNITS, TERRAINS, STYLES} from '../src/rules/data.js';
import {unitTip, terrainTip, unitDefault, terrainDefault, UNIT_BLURB, terrainNote} from '../src/battle/explain.js';
import {weaponHtml} from '../src/battle/unit-info.js';
import {createGame, produce} from '../src/rules/engine.js';
const zh = DICT.zh, en = DICT.en; let n = 0; const ok = (name, f) => { f(); n++; console.log('PASS', name); };
ok('zh / en 键一一对应', () => { const a = Object.keys(zh).filter(k => !(k in en)), b = Object.keys(en).filter(k => !(k in zh)); assert.deepStrictEqual([a, b], [[], []], '英文缺：' + a + ' / 中文缺：' + b); });
ok('英文短名不超过 12 个字符（兵工厂卡片放得下）、图标字不超过 2 个字符', () => { for (const id of Object.keys(UNITS)) { assert(en['unit.' + id].length <= 12, '英文短名太长 ' + id); assert(en['glyph.' + id].length <= 2 && zh['glyph.' + id].length === 1, '图标字长度 ' + id); } });
ok('没有空词条', () => { for (const l of [zh, en]) for (const [k, v] of Object.entries(l)) assert(typeof v === 'string' && v.trim(), '空词条 ' + k); });
ok('占位符两边一致', () => { const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(); for (const k of Object.keys(zh)) assert.strictEqual(ph(zh[k]), ph(en[k]), '占位符不一致 ' + k); });
ok('每个单位 / 地形 / 风格 id 都有词条，且英文不含中文', () => {
  for (const [tb, g] of [[UNITS, 'unit'], [TERRAINS, 'terrain'], [STYLES, 'style']]) for (const id of Object.keys(tb)) { assert(zh[g + '.' + id] && en[g + '.' + id], '缺词条 ' + g + '.' + id); if (g === 'unit') for (const x of ['.full', ''].map(e => g + '.' + id + e).concat('glyph.' + id)) assert(zh[x] && en[x], '缺词条 ' + x); assert(!/[\u4e00-\u9fff]/.test(en[g + '.' + id]), '英文里有中文 ' + id); }
});
ok('name getter 随语言切换', () => { setLang('en'); assert.strictEqual(UNITS.tank.name, 'Light Tank'); assert.strictEqual(UNITS.mech.name, 'Anti-Tank'); assert.strictEqual(UNITS.mech.fullName, 'Anti-Tank Infantry'); assert.strictEqual(TERRAINS.city_large.name, 'Large City'); setLang('zh'); assert.strictEqual(UNITS.tank.name, '轻坦'); assert.strictEqual(getLang(), 'zh'); });
ok('t() 参数替换 / 缺词退回', () => { const w = console.warn; console.warn = () => {}; try { zh['x.test'] = '共 {n} 个'; en['x.test'] = '{n} in total'; assert.strictEqual(t('x.test', {n: 3}), '共 3 个'); delete en['x.test']; delete zh['x.test']; assert.strictEqual(t('x.nope'), 'x.nope'); } finally { console.warn = w; } });
ok('详细面板说明：中英文每一项都能生成，英文里不含中文', () => {
  const cfg = {fuel: true, ammo: true, swampDamage: 20, swampKills: true}, bad = [];
  const chk = (o, tag) => { if (!o) return; for (const v of [o.t, o.d]) { assert(typeof v === 'string' && v.trim(), '空说明 ' + tag); if (/[\u4e00-\u9fff]/.test(v)) bad.push(tag + ': ' + v); } };
  setLang('en');
  for (const id of Object.keys(UNITS)) {
    for (const k of ['hp', 'status', 'move', 'vision', 'range', 'mt', 'fuel', 'ammo', 'primary', 'secondary', 'cat:foot', 'cat:veh']) chk(unitTip(k, {type: id, eu: {hp: 73, acted: false, ammo: 3, fuel: 40, cap: 0}, cfg}), id + '/' + k);
    chk(unitDefault(id), id + '/default'); assert(!/[\u4e00-\u9fff]/.test(weaponHtml(id)), '兵工厂武器块里有中文 ' + id);
  }
  for (const id of Object.keys(TERRAINS)) {
    for (const k of ['stars', 'income', 'capture', 'owner', 'hazard', 'cost:foot', 'cost:mech', 'cost:tread', 'cost:wheel']) chk(terrainTip(k, {tid: id, owner: undefined, cfg}), id + '/' + k);
    chk(terrainDefault(id, null), id + '/def'); chk(terrainDefault(id, {type: 'tank', hp: 55}), id + '/def2'); assert(!/[\u4e00-\u9fff]/.test(terrainNote(id)), '地形简介里有中文 ' + id);
  }
  setLang('zh'); assert.deepStrictEqual(bad, [], '英文说明里还有中文：\n' + bad.join('\n'));
  assert.strictEqual(unitTip('hp', {type: 'inf', eu: {hp: 73}, cfg}).d.includes('格数越少'), true); assert.strictEqual(UNIT_BLURB.inf, '最便宜的单位，山地、河流都能翻越，可以占领建筑。');
});
ok('引擎提示（兵工厂等）随语言，中文与原文一致', () => {
  const mk = () => { const g = createGame({terrain: [['factory', 'factory', 'plain']], owners: {'0,0': 0, '1,0': 1}, units: []}); g.funds = [0, 0]; return g; };
  assert.strictEqual(produce(mk(), 0, 0, 'tank').err, '资金不足'); assert.strictEqual(produce(mk(), 1, 0, 'inf').err, '这里不是你的兵工厂');
  setLang('en'); const a = produce(mk(), 0, 0, 'tank').err, b = produce(mk(), 1, 0, 'inf').err; setLang('zh');
  assert.strictEqual(a, 'Not enough funds'); assert.strictEqual(b, 'This is not your factory');
});
ok('战报 / 引擎 err.* 词条齐全且英文无中文', () => { for (const k of Object.keys(zh).filter(k => /^(res|err|map)\./.test(k))) assert(en[k] && !/[\u4e00-\u9fff]/.test(en[k]), '词条 ' + k); });
// 进度：还剩多少写死的中文字符串（只统计 src/ 下战斗相关 js，不含 art / vendor / i18n；注释不算）
let left = 0; const walk = d => { for (const f of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!/vendor|art|i18n/.test(f.name)) walk(p); } else if (p.endsWith('.js')) { for (const l of fs.readFileSync(p, 'utf8').split('\n')) left += (l.split('//')[0].match(/(['"`])(?:(?!\1).)*[\u4e00-\u9fff](?:(?!\1).)*\1/g) || []).length; } } };
walk(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src'));
console.log(`✓ ${n} 项通过；词条 ${Object.keys(zh).length} 条；src 里还剩约 ${left} 处写死的中文字符串待迁移`);
