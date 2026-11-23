// 规则引擎自动测试（0.33）：伤害公式、移动消耗、攻击 / 反击 / 间接火力、弹药、沼泽、回合与胜负、军队风格。
import assert from 'assert';
import {UNIT_IDS, UNITS, TERRAINS, TARGET_ORDER, DMG_PRIMARY, DMG_SECONDARY} from '../src/rules/data.js';
import {calcDamage, pickWeapon} from '../src/rules/combat.js';
import {createGame, addUnit, capture, canCapture, reachable, pathOf, undoMove, canProduce, forecast, move, attack, targetsOf, endTurn, wait, unitAt, produce, incomeOf, join, joinTargetOf, canJoinInto, summaryOf} from '../src/rules/engine.js';

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

t('伤害预估 forecast：和真正的攻击结算一致，而且不改动对局', () => {
  const mk = () => createGame({terrain: map(4, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 1, y: 0}]});
  const g = mk(), a = g.units[0], d = g.units[1], snap = JSON.stringify(g), f = forecast(g, a.id, d.id);
  assert.equal(JSON.stringify(g), snap);                                           // 预估不改任何东西
  const g2 = mk(), out = attack(g2, g2.units[0].id, g2.units[1].id);
  assert.equal(f.damage, out.hit.damage); assert.equal(f.counter, out.counter ? out.counter.damage : 0);
  assert.equal(f.kill, g2.units.length === 1);                                     // 打死了目标就只剩攻击方
  const g3 = createGame({terrain: map(5, 1), units: [{type: 'arty', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 2, y: 0}]});
  const f3 = forecast(g3, g3.units[0].id, g3.units[1].id); assert.ok(f3.damage > 0); assert.equal(f3.counter, 0);   // 间接火力不挨反击
  assert.equal(forecast(g3, g3.units[1].id, g3.units[0].id), null);                // 不是自己回合 / 打不到 = null
});

t('攻击结果带开打前血量 hp0；攻击后不能再撤销移动', () => {
  const g = createGame({terrain: map(4, 1), units: [{type: 'inf', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 2, y: 0}]}), a = g.units[0], d = g.units[1];
  assert.equal(move(g, a.id, 1, 0).ok, true);
  const out = attack(g, a.id, d.id);
  assert.equal(out.ok, true); assert.deepEqual(out.hp0, {a: 100, d: 100}); assert.ok(out.hit.damage > 0);
  assert.equal(undoMove(g, a.id).ok, false);                                       // 打完不能撤
});

t('还能不能生产 canProduce：要有空的、本回合没造过的己方兵工厂，钱够最便宜的单位', () => {
  const mk = (funds, units = []) => { const g = createGame({terrain: [['factory', 'factory', 'plain']], owners: {'0,0': 0, '1,0': 1}, units}); g.funds = [...funds]; return g; };   // 开局会先结算一次收入，所以建完再直接写资金
  assert.equal(canProduce(mk([1000, 0])), true);                                   // 步兵 1000 刚好
  assert.equal(canProduce(mk([999, 0])), false);                                   // 钱不够任何单位
  assert.equal(canProduce(mk([5000, 5000]), 1), true);                             // 各算各的兵工厂
  const g = mk([5000, 0]); assert.equal(produce(g, 0, 0, 'inf').ok, true);
  assert.equal(canProduce(g), false);                                              // 唯一的兵工厂本回合造过了
  assert.equal(canProduce(mk([5000, 0], [{type: 'inf', owner: 0, x: 0, y: 0}])), false);   // 兵工厂上站着单位
  assert.equal(canProduce(mk([0, 5000]), 0), false);                               // 对方有钱有厂不算
});

t('撤销移动：走了没待命可撤（位置 / 燃料 / 已移动一起还原）；待命后、没走过、不是自己回合都不行', () => {
  const g = createGame({terrain: map(6, 1), units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 5, y: 0}]}), u = g.units[0], fuel0 = u.fuel;
  assert.equal(undoMove(g, u.id).ok, false);                                       // 没走过
  assert.equal(move(g, u.id, 3, 0).ok, true);
  assert.equal(undoMove(g, u.id).ok, true);
  assert.deepEqual([u.x, u.y, u.moved, u.fuel], [0, 0, false, fuel0]);
  assert.equal(move(g, u.id, 2, 0).ok, true);                                      // 撤销后能重新走
  assert.equal(wait(g, u.id).ok, true);
  assert.equal(undoMove(g, u.id).ok, false);                                       // 待命后不能撤
  assert.equal(u.x, 2);
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

t('沼泽（0.84）：自己结束回合不扣，等对方也结束、轮回自己时才掉 1 格血，会致死', () => {
  const m = map(3, 1); m[0][1] = 'swamp';
  const g = createGame({terrain: m, units: [{type: 'inf', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 0, x: 0, y: 0, hp: 100}, {type: 'inf', owner: 1, x: 2, y: 0}]});
  endTurn(g); assert.equal(unitAt(g, 1, 0).hp, 100);   // 蓝军结束回合：不扣
  endTurn(g); assert.equal(g.turn, 0); assert.equal(unitAt(g, 1, 0).hp, 90);   // 红军也结束、轮回蓝军：这时才扣
  const g2 = createGame({terrain: m, units: [{type: 'inf', owner: 0, x: 1, y: 0, hp: 10}, {type: 'inf', owner: 1, x: 2, y: 0}]});
  endTurn(g2); assert.equal(g2.winner, null); endTurn(g2); assert.equal(g2.winner, 1);   // 轮回自己时被扣死 → 红军获胜
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

const hqMap = () => { const m = map(8, 1); m[0][0] = 'hq'; m[0][1] = 'city_small'; m[0][2] = 'city_large'; m[0][7] = 'hq'; return m; };

t('占领：血量格数累加，满 20 点易主；第 1 回合 10 血步兵占小城市 → 2 次占下', () => {
  const g = createGame({terrain: hqMap(), owners: {'0,0': 0, '7,0': 1}, units: [{type: 'inf', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 1, x: 6, y: 0}]});
  assert(canCapture(g, unitAt(g, 1, 0)));
  const r = capture(g, 1); assert(r.ok && !r.done); assert.equal(r.gain, 10); assert.equal(r.cap, 10); assert.equal(r.need, 20); assert.equal(g.owners['1,0'], undefined);
  assert.equal(capture(g, 1).err, '不能占领');   // 本回合已行动
  endTurn(g); endTurn(g);
  const r2 = capture(g, 1); assert(r2.done); assert.equal(g.owners['1,0'], 0); assert.equal(unitAt(g, 1, 0).cap, 0);
  assert.equal(incomeOf(g, 0), 1000 + 700);
});

t('占领：残血只累加显示格数（血 41 → 5 点）；走开进度清零；撤销移动进度还原', () => {
  const g = createGame({terrain: hqMap(), units: [{type: 'inf', owner: 0, x: 2, y: 0, hp: 41}, {type: 'inf', owner: 1, x: 6, y: 0}]});
  assert.equal(capture(g, 1).cap, 5); endTurn(g); endTurn(g);
  assert.equal(unitAt(g, 2, 0).cap, 5);
  move(g, 1, 3, 0); assert.equal(unitAt(g, 3, 0).cap, 0);
  undoMove(g, 1); assert.equal(unitAt(g, 2, 0).cap, 5);
  move(g, 1, 2, 0); assert.equal(unitAt(g, 2, 0).cap, 5);   // 原地「移动」不清零
});

t('占领：只有步兵类能占；己方建筑 / 平地 / 对方回合不能占；占敌方城市易主', () => {
  const g = createGame({terrain: hqMap(), owners: {'1,0': 1, '2,0': 0}, units: [{type: 'tank', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 0, x: 2, y: 0}, {type: 'inf', owner: 0, x: 3, y: 0}, {type: 'mech', owner: 1, x: 4, y: 0}]});
  assert(!canCapture(g, unitAt(g, 1, 0)));   // 坦克
  assert(!canCapture(g, unitAt(g, 2, 0)));   // 自己的建筑
  assert(!canCapture(g, unitAt(g, 3, 0)));   // 平地
  assert(!canCapture(g, unitAt(g, 4, 0)));   // 对方回合
  const g2 = createGame({terrain: hqMap(), owners: {'1,0': 1}, units: [{type: 'inf', owner: 0, x: 1, y: 0}, {type: 'inf', owner: 1, x: 7, y: 0}]});
  capture(g2, 1); endTurn(g2); endTurn(g2); assert(capture(g2, 1).done); assert.equal(g2.owners['1,0'], 0);
});

t('占领总部 = 获胜（hqWin），关掉后只易主', () => {
  const mk = cfg => createGame({terrain: hqMap(), owners: {'0,0': 0, '7,0': 1}, config: cfg, units: [{type: 'inf', owner: 0, x: 7, y: 0}, {type: 'inf', owner: 1, x: 5, y: 0}]});
  const g = mk(); capture(g, 1); endTurn(g); endTurn(g); assert(capture(g, 1).done); assert.equal(g.winner, 0);
  const g2 = mk({hqWin: false}); capture(g2, 1); endTurn(g2); endTurn(g2); capture(g2, 1); assert.equal(g2.winner, null); assert.equal(g2.owners['7,0'], 0);
});

t('修理（0.81）：回合开始先收入再修理；己方城市上的残血陆军 +20 点、按造价比例扣钱；弹药补满', () => {
  const mk = (extra = {}) => createGame({terrain: map(6, 1, 'plain').map(r => { r[1] = 'city_small'; r[2] = 'city_small'; r[3] = 'hq'; return r; }),
    owners: {'1,0': 1, '2,0': 0, '3,0': 1}, funds: [0, 0],
    units: [{type: 'tank', owner: 1, x: 1, y: 0, hp: 50, ammo: 2}, {type: 'inf', owner: 1, x: 4, y: 0, hp: 40}, {type: 'inf', owner: 1, x: 2, y: 0, hp: 40}, {type: 'inf', owner: 0, x: 5, y: 0}], ...extra});
  const g = mk(); const r = endTurn(g);
  assert.equal(r.income, 1700); assert.equal(r.fundsBefore, 0);   // 红军：1 座小城市 700 + 总部 1000
  assert.deepEqual(r.repairs.map(q => [q.id, q.heal, q.cost]), [[1, 20, 1400]]);   // 轻坦 7000 × 20%；平地上的步兵、站在对方城市上的步兵都不修
  assert.equal(r.repairCost, 1400); assert.equal(g.funds[1], 300); assert.equal(unitAt(g, 1, 0).hp, 70); assert.equal(unitAt(g, 1, 0).ammo, 9);
  assert.equal(unitAt(g, 4, 0).hp, 40); assert.equal(unitAt(g, 2, 0).hp, 40);
});

t('修理：只回到 100（回复点数按实际算价）；钱不够的单位跳过；config.repair 可关', () => {
  const mk = cfg => createGame({terrain: map(4, 1).map(r => { r[1] = 'city_small'; r[2] = 'city_small'; return r; }), owners: {'1,0': 1, '2,0': 1}, funds: [0, 0], config: cfg,
    units: [{type: 'tank', owner: 1, x: 1, y: 0, hp: 95}, {type: 'neotank', owner: 1, x: 2, y: 0, hp: 40}, {type: 'inf', owner: 0, x: 3, y: 0}]});
  const g = mk(); const r = endTurn(g);   // 收入 1400：轻坦回 5 点 = 350；重坦要 4000 → 钱不够，跳过
  assert.equal(r.income, 1400); assert.deepEqual(r.repairs.map(q => [q.id, q.heal, q.cost]), [[1, 5, 350]]);
  assert.equal(unitAt(g, 1, 0).hp, 100); assert.equal(unitAt(g, 2, 0).hp, 40); assert.equal(g.funds[1], 1050);
  const g2 = mk({repair: false}); assert.equal(endTurn(g2).repairs.length, 0); assert.equal(unitAt(g2, 2, 0).hp, 40);
});

t('断崖 / 浅滩（0.82）：全部陆军单位都能走上去（消耗 1），标了 noNaval（海军以后不能进）', () => {
  for (const id of ['cliff', 'shoal']) assert(TERRAINS[id].noNaval);
  for (const type of ['inf', 'mech', 'recon', 'apc', 'tank', 'mdtank', 'neotank', 'arty', 'rocket', 'aa']) {
    const g = createGame({terrain: [['plain', 'cliff', 'shoal', 'plain']], units: [{type, owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 3, y: 0}]});
    const r = reachable(g, unitAt(g, 0, 0)); assert(r.has('1,0') && r.has('2,0'), type + ' 应能站上断崖 / 浅滩');
  }
});

t('沼泽掉血清单（0.83 / 0.84）：轮回自己那次 endTurn 返回 swamp [{id, damage, dead}]，战场据此演飘字 / 倒下', () => {
  const mk = hp => { const g = createGame({terrain: map(4, 1).map(r => { r[1] = 'swamp'; return r; }), units: [{type: 'inf', owner: 0, x: 1, y: 0, hp}, {type: 'inf', owner: 0, x: 0, y: 0, hp: 50}, {type: 'inf', owner: 1, x: 3, y: 0}]}); endTurn(g); return g; };   // 先让蓝军结束一次，下面那次 endTurn（红军结束）才轮回蓝军
  let g = mk(50), r = endTurn(g);
  assert.deepEqual(r.swamp, [{id: 1, damage: 10, dead: false}]); assert.equal(unitAt(g, 1, 0).hp, 40);   // 平地上的单位不在清单里
  g = mk(10); r = endTurn(g); assert.deepEqual(r.swamp, [{id: 1, damage: 10, dead: true}]); assert.equal(unitAt(g, 1, 0), undefined);
  g = mk(5); r = endTurn(g); assert.deepEqual(r.swamp, [{id: 1, damage: 5, dead: true}]);   // 只剩 5 点：实际只掉 5
  g = createGame({terrain: map(4, 1).map(r2 => { r2[1] = 'swamp'; return r2; }), config: {swampKills: false}, units: [{type: 'inf', owner: 0, x: 1, y: 0, hp: 5}, {type: 'inf', owner: 1, x: 3, y: 0}]});
  endTurn(g); r = endTurn(g); assert.deepEqual(r.swamp, [{id: 1, damage: 4, dead: false}]); assert.equal(unitAt(g, 1, 0).hp, 1);   // 不致死：留 1 点，实际掉 4
});

t('歼灭只在「生产出第一个单位之后」才生效（0.87）：零单位开局双方都不会被判；某一方造出单位后被全歼才出局', () => {
  const g = createGame({terrain: [['plain', 'factory', 'plain', 'factory', 'plain']], owners: {'1,0': 0, '3,0': 1}, funds: [3000, 3000]});
  assert.equal(g.winner, null); endTurn(g); endTurn(g); endTurn(g); assert.equal(g.winner, null);   // 双方一个单位都没造过：怎么过回合都不判
  while (g.turn !== 0) endTurn(g);
  const b = produce(g, 1, 0, 'inf'); assert(b.ok); assert.equal(g.winner, null);   // 蓝军有了单位，红军还没造过 → 红军不算被歼灭
  endTurn(g); const r = produce(g, 3, 0, 'inf'); assert(r.ok); r.unit.hp = 5; assert.equal(g.winner, null);   // 红军造出第一个单位
  endTurn(g); assert(move(g, b.unit.id, 2, 0).ok); assert(attack(g, b.unit.id, r.unit.id).ok);
  assert.equal(g.winner, 0);   // 红军造过单位、现在一个不剩 → 蓝军胜
});

t('单位上限（0.88）：每方 40 个，到上限不能再生产（兵工厂提示），canProduce 为 false；红方不受影响', () => {
  const mk = n => createGame({terrain: [['factory', ...Array(n + 2).fill('plain')]], owners: {'0,0': 0}, funds: [9000, 9000],
    units: [...Array.from({length: n}, (_, i) => ({type: 'inf', owner: 0, x: i + 1, y: 0})), {type: 'inf', owner: 1, x: n + 1, y: 0}]});
  let g = mk(40); const f0 = g.funds[0]; assert.equal(g.config.maxUnits, 40); assert(!canProduce(g)); const r = produce(g, 0, 0, 'inf');
  assert(!r.ok && r.err.includes('上限'), r.err); assert.equal(g.funds[0], f0);   // 没扣钱
  g = mk(39); assert(canProduce(g)); assert(produce(g, 0, 0, 'inf').ok);   // 39 个 → 还能造第 40 个
});

t('合流（0.89 / 0.90）：走到残血同类型友军格上才能合流；血量相加、超出折成资金、弹药相加；合流后行动结束', () => {
  const mk = (extra = {}) => createGame({terrain: map(5, 1), funds: [0, 0], units: [{type: 'tank', owner: 0, x: 0, y: 0, hp: 60, ammo: 3}, {type: 'tank', owner: 0, x: 2, y: 0, hp: 70, ammo: 4}, {type: 'inf', owner: 0, x: 1, y: 0, hp: 30}, {type: 'tank', owner: 1, x: 4, y: 0}], ...extra});
  const g = mk(), a = unitAt(g, 0, 0), b = unitAt(g, 2, 0), f0 = g.funds[0];
  const r = reachable(g, a); assert(r.has('2,0'), '残血同类型友军格可到达'); assert(!r.has('1,0'), '不同类型友军格仍不能停');   // 步兵格（不同类型）可穿过不可停
  assert(move(g, a.id, 2, 0).ok); assert.equal(joinTargetOf(g, a), b); assert(!wait(g, a.id).ok, '合流格上不能待命');
  const j = join(g, a.id); assert(j.ok); assert.equal(j.targetId, b.id); assert.equal(j.gained, 30); assert.equal(j.over, 30);   // 60 + 70 = 130 → 100，超出 30
  assert.equal(j.refund, 2100); assert.equal(g.funds[0], f0 + 2100);   // 轻坦 7000 × 30%
  assert.equal(b.hp, 100); assert.equal(b.ammo, 7); assert(!g.units.includes(a)); assert.equal(g.units.filter(u => u.type === 'tank' && u.owner === 0).length, 1);
  assert.equal(b.acted, true); assert.equal(b.moved, true);   // 0.90：合流后的单位本回合行动结束（高战规则），不管它合流前有没有行动过
});

t('合流：满血目标 / 不同类型 / 敌军 / config.join=false 都不行；停在合流格上结束回合 = 自动退回原位', () => {
  const g = createGame({terrain: map(4, 1), funds: [0, 0], units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 0, x: 2, y: 0, hp: 100}, {type: 'tank', owner: 1, x: 3, y: 0, hp: 50}]});
  assert(!reachable(g, unitAt(g, 0, 0)).has('2,0'), '满血友军不能合流');
  const h = createGame({terrain: map(4, 1), funds: [0, 0], units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 0, x: 2, y: 0, hp: 50}, {type: 'inf', owner: 1, x: 3, y: 0}]});
  assert(canJoinInto(h, unitAt(h, 0, 0), unitAt(h, 2, 0)));
  const a = unitAt(h, 0, 0), b = unitAt(h, 2, 0); assert(move(h, a.id, 2, 0).ok);
  endTurn(h); assert.equal(a.x, 0); assert.equal(a.moved, false); assert.equal(b.hp, 50); assert.equal(h.units.length, 3);   // 退回原位，谁也没变
  const k = createGame({terrain: map(4, 1), funds: [0, 0], config: {join: false}, units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 0, x: 2, y: 0, hp: 50}, {type: 'inf', owner: 1, x: 3, y: 0}]});
  assert(!reachable(k, unitAt(k, 0, 0)).has('2,0'));
  const e = createGame({terrain: map(4, 1), funds: [0, 0], units: [{type: 'tank', owner: 0, x: 0, y: 0}, {type: 'tank', owner: 1, x: 2, y: 0, hp: 50}]});
  assert(!reachable(e, unitAt(e, 0, 0)).has('2,0'), '敌军不能合流');
});

t('统计表（0.91）：击毁 / 损失 / 反击击毁 / 生产 / 收入 / 军费 / 占领；预估不改统计；歼灭有 winReason', () => {
  const g = createGame({terrain: map(5, 1), units: [{type: 'tank', owner: 0, x: 1, y: 0, hp: 100}, {type: 'inf', owner: 1, x: 2, y: 0, hp: 20}, {type: 'inf', owner: 1, x: 4, y: 0}]});
  forecast(g, 1, 2); assert.deepEqual(g.stats[0], {built: 0, lost: 0, killed: 0, captured: 0, income: 0, spent: 0});
  attack(g, 1, 2);
  assert.equal(g.stats[0].killed, 1); assert.equal(g.stats[1].lost, 1); assert.equal(g.winner, null);
  const s = summaryOf(g); assert.equal(s.sides[0].units, 1); assert.equal(s.sides[1].units, 1); assert.equal(s.neutral, 0);
});

t('统计表（0.91）：生产记 built / spent，收入累计，占领总部记 captured + winReason hq + winCell', () => {
  const terrain = map(4, 1); terrain[0][0] = 'hq'; terrain[0][3] = 'hq'; terrain[0][1] = 'factory';
  const g = createGame({terrain, owners: {'0,0': 0, '3,0': 1, '1,0': 0}, funds: [5000, 0], units: [{type: 'inf', owner: 0, x: 0, y: 0}, {type: 'inf', owner: 1, x: 3, y: 0}]});
  assert.equal(g.stats[0].income, 2000);   // 开局先手方领一次收入（总部 + 兵工厂）
  const cost = UNITS.inf.cost; assert(produce(g, 1, 0, 'inf').ok);
  assert.equal(g.stats[0].built, 1); assert.equal(g.stats[0].spent, cost);
  endTurn(g); assert.equal(g.stats[1].income, 1000);
  const u = unitAt(g, 3, 0), blue = unitAt(g, 0, 0); blue.x = 2; u.x = 0;   // 把红步兵挪到蓝总部上、蓝步兵让开（只测统计）
  assert(capture(g, u.id).ok); assert(capture(g, u.id).ok === false);
  endTurn(g); endTurn(g);
  const u2 = unitAt(g, 0, 0); assert(u2 && u2.owner === 1); capture(g, u2.id);
  assert.equal(g.winner, 1); assert.equal(g.winReason, 'hq'); assert.deepEqual(g.winCell, [0, 0]); assert.equal(g.stats[1].captured, 1);
});

console.log(`✓ 规则测试 ${n} 项全部通过`);
