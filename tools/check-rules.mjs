// 规则引擎自动测试（0.33）：伤害公式、移动消耗、攻击 / 反击 / 间接火力、弹药、沼泽、回合与胜负、军队风格。
import assert from 'assert';
import {UNIT_IDS, UNITS, TERRAINS, TARGET_ORDER, DMG_PRIMARY, DMG_SECONDARY} from '../src/rules/data.js';
import {calcDamage, pickWeapon} from '../src/rules/combat.js';
import {createGame, addUnit, reachable, move, attack, targetsOf, endTurn, wait, unitAt} from '../src/rules/engine.js';

let n = 0; const t = (name, f) => { f(); n++; console.log('PASS', name); };
const map = (w, h, fill = 'plain') => Array.from({length: h}, () => Array(w).fill(fill));

t('数据完整：11 个单位，伤害表里的数字都在 1–125', () => {
  assert.equal(UNIT_IDS.length, 11);
  for (const tbl of [DMG_PRIMARY, DMG_SECONDARY]) for (const [a, r] of Object.entries(tbl)) {
    assert(UNITS[a], a); for (const d of TARGET_ORDER) { const v = r[d]; assert(v === null || (v >= 1 && v <= 125), a + '→' + d); }
  }
  for (const [k, v] of Object.entries(TERRAINS)) for (const m of ['foot', 'mech', 'tread', 'wheel']) assert('cost' in v && m in v.cost, k + ' ' + m);
});

t('伤害公式：轻坦打轻坦（平原）= 49，反击 29', () => {
  const g = createGame({terrain: map(4, 1), units: [{type: 'tank', owner: 0, x: 1, y: 0}, {type: 'tank', owner: 1, x: 2, y: 0}]});
  const r = attack(g, 1, 2);
  assert.equal(r.hit.damage, 49); assert.equal(unitAt(g, 2, 0).hp, 51);
  assert.equal(r.counter.damage, 29); assert.equal(unitAt(g, 1, 0).hp, 71);
});

t('地形防御：步兵在山地（4 星）被轻坦打 = 45；公式底层', () => {
  assert.equal(calcDamage({base: 75, attackerHp: 100, defenderHp: 100, stars: 4}), 45);
  assert.equal(calcDamage({base: 55, attackerHp: 50, defenderHp: 100, stars: 0}), 27);   // 攻方 5 格血：55×0.5
});

t('选武器：伤害高者；同样高用副武器；弹药打光只能用机枪', () => {
  assert.equal(pickWeapon({type: 'tank', ammo: 9}, 'inf').weapon, 'secondary');     // 25 对 75
  assert.equal(pickWeapon({type: 'tank', ammo: 9}, 'tank').weapon, 'primary');      // 55 对 6
  assert.equal(pickWeapon({type: 'tank', ammo: 0}, 'tank').base, 6);
  assert.equal(pickWeapon({type: 'arty', ammo: 0}, 'inf'), null);
  assert.equal(pickWeapon({type: 'missile', ammo: 6}, 'inf'), null);                // 防空导弹打不了陆军
});

t('移动消耗：轻坦进不了山，步兵山地花 2，轮式进树林花 3', () => {
  const m = map(6, 1); m[0][1] = 'mountain';
  let g = createGame({terrain: m, units: [{type: 'tank', owner: 0, x: 0, y: 0}]});
  assert(!reachable(g, g.units[0]).has('1,0') && !reachable(g, g.units[0]).has('2,0'));
  g = createGame({terrain: m, units: [{type: 'inf', owner: 0, x: 0, y: 0}]});
  assert.equal(reachable(g, g.units[0]).get('1,0'), 2); assert.equal(reachable(g, g.units[0]).get('2,0'), 3);
  const f = map(6, 1); f[0][1] = 'forest';
  g = createGame({terrain: f, units: [{type: 'recon', owner: 0, x: 0, y: 0}]});
  assert.equal(reachable(g, g.units[0]).get('1,0'), 3);
});

t('移动：敌人挡路、友军可穿过但不能停', () => {
  const g = createGame({terrain: map(5, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 1, x: 3, y: 0}]});
  const r = reachable(g, g.units[0]);
  assert(r.has('2,0') && !r.has('1,0') && !r.has('3,0') && !r.has('4,0'));
  assert(!move(g, 1, 4, 0).ok); assert(move(g, 1, 2, 0).ok); assert(!move(g, 1, 0, 0).ok);   // 已移动过
});

t('间接火力：不能打相邻、不能移动后开火、不被反击', () => {
  const g = createGame({terrain: map(8, 1), units: [{type: 'arty', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 1, x: 1, y: 0}, {type: 'tank', owner: 1, x: 2, y: 0}]});
  const a = g.units[0];
  assert.deepEqual(targetsOf(g, a).map(u => u.x), [2]);
  const r = attack(g, a.id, g.units[2].id); assert(r.ok && r.counter === null); assert.equal(a.hp, 100);
  const g2 = createGame({terrain: map(8, 1), units: [{type: 'arty', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 1, x: 3, y: 0}]});
  move(g2, 1, 1, 0); assert.equal(targetsOf(g2, g2.units[0]).length, 0);
});

t('弹药：主武器每次出手消耗 1，机枪不耗', () => {
  const g = createGame({terrain: map(3, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 1, x: 1, y: 0}, {type: 'inf', owner: 1, x: 2, y: 0}]});
  attack(g, 1, 2); assert.equal(g.units[0].ammo, 8);
  const g2 = createGame({terrain: map(2, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 1, y: 0}]});
  attack(g2, 1, 2); assert.equal(g2.units[0].ammo, 9);
});

t('沼泽：回合结束掉 1 格血，会致死', () => {
  const m = map(3, 1); m[0][1] = 'swamp';
  const g = createGame({terrain: m, units: [{type: 'inf', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 0, x: 0, y: 0, hp: 100}, {type: 'inf', owner: 1, x: 2, y: 0}]});
  endTurn(g); assert.equal(unitAt(g, 1, 0).hp, 90);
  const g2 = createGame({terrain: m, units: [{type: 'inf', owner: 0, x: 1, y: 0, hp: 10}, {type: 'inf', owner: 1, x: 2, y: 0}]});
  endTurn(g2); assert.equal(g2.winner, 1);
});

t('回合与胜负：换人、日期、行动重置；歼灭取胜', () => {
  const g = createGame({terrain: map(3, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 1, y: 0, hp: 5}]});
  assert(!attack(g, 2, 1).ok);                       // 不是他的回合
  wait(g, 1); endTurn(g); assert.equal(g.turn, 1); endTurn(g); assert.equal(g.turn, 0); assert.equal(g.day, 2);
  assert(!g.units[0].acted);
  attack(g, 1, 2); assert.equal(g.winner, 0); assert(!endTurn(g).ok);
});

t('军队风格：攻 +10% / 守 −10% 会改变伤害；默认均衡型 = 1', () => {
  const mk = style => createGame({terrain: map(2, 1), players: [{style}, {style: 'balanced'}], units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 1, x: 1, y: 0}]});
  assert.equal(attack(mk('balanced'), 1, 2).hit.damage, 49);
  assert.equal(calcDamage({base: 55, attackerHp: 100, defenderHp: 100, stars: 1, atkMul: 1.1, defMul: 0.9}), Math.floor(55 * 1.1 * ((200 - 90 - 10) / 100)));
});

console.log(`✓ 规则测试 ${n} 项全部通过`);
