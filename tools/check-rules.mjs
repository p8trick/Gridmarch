// 规则引擎自动测试（0.33）：伤害公式、移动消耗、攻击 / 反击 / 间接火力、弹药、沼泽、回合与胜负、军队风格。
import assert from 'assert';
import {UNIT_IDS, UNITS, TERRAINS, TARGET_ORDER, DMG_PRIMARY, DMG_SECONDARY} from '../src/rules/data.js';
import {calcDamage, pickWeapon} from '../src/rules/combat.js';
import {createGame, addUnit, reachable, pathOf, move, attack, targetsOf, endTurn, wait, unitAt, produce, incomeOf} from '../src/rules/engine.js';

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

t('走位路线 pathOf：从单位出发、逐格相邻、花费 = 可达表、能穿过友军、到不了 = null', () => {
  const g = createGame({terrain: map(5, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 1, x: 3, y: 0}]});
  const u = g.units[0], p = pathOf(g, u, 2, 0);
  assert.deepEqual(p, [[0, 0], [1, 0], [2, 0]]);                                   // 穿过 (1,0) 的友军
  assert.equal(pathOf(g, u, 0, 0).length, 1);                                      // 原地 = 只有起点
  assert.equal(pathOf(g, u, 4, 0), null);                                          // 被敌人挡住
  const m2 = map(4, 3); m2[0][1] = 'mountain';                                     // 轮式进不了山：必须绕路
  const g2 = createGame({terrain: m2, units: [{type: 'recon', owner: 0, x: 0, y: 0}]});
  const p2 = pathOf(g2, g2.units[0], 2, 0), cost = reachable(g2, g2.units[0]).get('2,0');
  assert.equal(p2[0].join(), '0,0'); assert.equal(p2[p2.length - 1].join(), '2,0'); assert.equal(p2.length - 1, 4); assert.equal(cost, 8);   // 绕过山：下-右-右-上 = 4 格，轮式平原每格 2 点 = 8
  for (let i = 1; i < p2.length; i++) assert.equal(Math.abs(p2[i][0] - p2[i - 1][0]) + Math.abs(p2[i][1] - p2[i - 1][1]), 1);
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

// 经济场景：0 号方 = 总部(0,0) + 兵工厂(1,0) + 大城市(2,0)；1 号方 = 兵工厂(6,0) + 总部(7,0)；(3,0) 小城市中立
const econ = (o = {}) => {
  const m = map(8, 1); [m[0][0], m[0][1], m[0][2], m[0][3], m[0][6], m[0][7]] = ['hq', 'factory', 'city_large', 'city_small', 'factory', 'hq'];
  return createGame({terrain: m, owners: {'0,0': 0, '1,0': 0, '2,0': 0, '6,0': 1, '7,0': 1}, ...o});
};

t('收入：总部 1000 + 兵工厂 1000 + 大城市 1000（小城市 700）；开局第一回合就领收入', () => {
  const g = econ(); assert.equal(incomeOf(g, 0), 3000); assert.equal(incomeOf(g, 1), 2000);
  assert.equal(g.funds[0], 3000); assert.equal(g.funds[1], 0);
  endTurn(g); assert.equal(g.funds[1], 2000);                        // 1 号方轮到时领
  assert.equal(econ({config: {incomeMul: 2}}).funds[0], 6000);        // 整体倍率
});

t('小城市收入 700', () => {
  const m = map(3, 1); [m[0][0], m[0][1]] = ['hq', 'city_small'];
  assert.equal(incomeOf(createGame({terrain: m, owners: {'0,0': 0, '1,0': 0}}), 0), 1700);
});

t('生产：扣钱、新单位本回合不能动、每座兵工厂每回合 1 个', () => {
  const g = econ(); const r = produce(g, 1, 0, 'inf');
  assert(r.ok); assert.equal(g.funds[0], 2000); assert(r.unit.moved && r.unit.acted);
  assert(!produce(g, 1, 0, 'inf').ok);                                // 同一座本回合只能 1 个（也被占着）
  assert(!move(g, r.unit.id, 2, 0).ok);                               // 新单位不能动
  endTurn(g); endTurn(g); assert.equal(g.funds[0], 2000 + 3000);       // 下一个自己的回合：再领 3000
  assert.equal(r.unit.moved, false);
});

t('生产限制：钱不够、中立 / 对方兵工厂、非兵工厂、防空导弹暂不可生产', () => {
  const g = econ();
  assert.equal(produce(g, 1, 0, 'tank').err, '资金不足');             // 3000 < 7000
  assert.equal(produce(g, 6, 0, 'inf').err, '这里不是你的兵工厂');      // 对方的
  assert.equal(produce(g, 2, 0, 'inf').err, '这里不是你的兵工厂');      // 大城市不能造
  g.funds[0] = 99999; assert.equal(produce(g, 1, 0, 'missile').err, '这个单位暂不可生产');
  assert(produce(g, 1, 0, 'neotank').ok); assert.equal(g.funds[0], 99999 - 20000);
});

t('价格表：11 个单位都有造价（防空导弹以外都可生产）', () => {
  for (const id of UNIT_IDS) assert(UNITS[id].cost > 0, id);
  assert.deepEqual(UNIT_IDS.filter(i => UNITS[i].buildable === false), ['missile']);
});

console.log(`✓ 规则测试 ${n} 项全部通过`);
