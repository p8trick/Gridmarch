// 规则引擎骨架（0.33）：地图 + 单位 + 回合。纯数据、纯函数，不依赖画面，方便自动测试和以后接 AI。
// 目前包含：移动（按地形消耗）、攻击与反击、回合切换、沼泽掉血、歼灭胜负。
// 0.77 加了占领（capture）。还没有：合流、补给燃料、修理、运输（后续里程碑）。
import {UNIT_IDS, UNITS, TERRAINS, CONFIG, DEFAULT_STYLE} from './data.js';
import {strike, dispHp} from './combat.js';

const key = (x, y) => x + ',' + y;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// terrain：二维数组 terrain[y][x]，值是 TERRAINS 里的 id；
// units：[{type, owner, x, y, hp?, ammo?, fuel?}]；players：[{style}]（默认两个均衡型军队）
// owners：{'x,y': 玩家序号}，产出建筑的归属（没写的是中立）；funds：各玩家开局资金（默认 0）
export function createGame({terrain, units = [], players, config = {}, owners = {}, funds}) {
  const g = {
    w: terrain[0].length, h: terrain.length, terrain,
    config: {...CONFIG, ...config},
    players: players || [{style: DEFAULT_STYLE}, {style: DEFAULT_STYLE}],
    units: [], turn: 0, day: 1, winner: null, nextId: 1,
    owners: {...owners}, funds: funds ? [...funds] : [], built: new Set(), everHad: [],
  };
  while (g.funds.length < g.players.length) g.funds.push(0);
  for (const u of units) addUnit(g, u);
  collectIncome(g);   // 第 1 天先手方也在回合开始领收入（开局资金 + 收入）
  return g;
}

export function addUnit(g, u) {
  const t = UNITS[u.type]; if (!t) throw Error('未知单位 ' + u.type);
  if (!TERRAINS[g.terrain[u.y]?.[u.x]]) throw Error('位置不在地图内 ' + u.x + ',' + u.y);
  const unit = {id: g.nextId++, type: u.type, owner: u.owner, x: u.x, y: u.y,
    hp: u.hp ?? 100, ammo: u.ammo ?? t.ammo, fuel: u.fuel ?? t.fuel, moved: false, acted: false};
  g.everHad[u.owner] = true; g.units.push(unit); return unit;
}

export const unitAt = (g, x, y) => g.units.find(u => u.x === x && u.y === y) || null;
export const getUnit = (g, id) => g.units.find(u => u.id === id) || null;

// ── 经济：回合开始领收入；只有自己的兵工厂能生产陆军，每座每回合 1 个 ──
export function incomeOf(g, player) {
  let sum = 0;
  for (const [k, o] of Object.entries(g.owners)) {
    if (o !== player) continue;
    const [x, y] = k.split(',').map(Number); sum += TERRAINS[g.terrain[y][x]].income || 0;
  }
  return Math.floor(sum * g.config.incomeMul);
}
function collectIncome(g) { g.funds[g.turn] += incomeOf(g, g.turn); g.built = new Set(); }

// 开打前的伤害预估（0.73）：在复制出来的单位上把真正的 attack 跑一遍，所以和实际结算一定一致，而且不改动 g。伤害是血量点数（0–100），counter = 反击伤害（0 = 不反击）
export function forecast(g, id, targetId) {
  const g2 = {...g, units: g.units.map(u => ({...u}))};
  const out = attack(g2, id, targetId); if (!out.ok) return null;
  const counter = out.counter ? out.counter.damage : 0;
  return {damage: out.hit.damage, counter, kill: out.hp0.d - out.hit.damage <= 0, counterKill: out.hp0.a - counter <= 0};
}

// 这一方现在还能不能生产（0.69）：有一座自己的、本回合没造过、上面没单位的兵工厂，并且钱够造最便宜的可生产单位。
// 战场用它判断「是不是真的无事可做」：单位全行动完但还能造兵 = 只脉冲提醒，不弹结束回合确认。
export function canProduce(g, player = g.turn) {
  const costs = UNIT_IDS.filter(id => UNITS[id].buildable !== false && UNITS[id].cost !== null).map(id => UNITS[id].cost);
  if (!costs.length || g.funds[player] < Math.min(...costs)) return false;
  return Object.keys(g.owners).some(k => {
    if (g.owners[k] !== player || g.built.has(k)) return false;
    const [x, y] = k.split(',').map(Number);
    return TERRAINS[g.terrain[y]?.[x]] === TERRAINS.factory && !unitAt(g, x, y);
  });
}

export function produce(g, x, y, type) {
  const t = UNITS[type], tr = TERRAINS[g.terrain[y]?.[x]];
  if (!t || !tr || g.winner !== null) return {ok: false, err: '不能操作'};
  if (tr !== TERRAINS.factory || g.owners[key(x, y)] !== g.turn) return {ok: false, err: '这里不是你的兵工厂'};
  if (t.buildable === false || t.cost === null) return {ok: false, err: '这个单位暂不可生产'};
  if (g.built.has(key(x, y))) return {ok: false, err: '这座兵工厂本回合已经生产过'};
  if (unitAt(g, x, y)) return {ok: false, err: '兵工厂上有单位'};
  if (g.funds[g.turn] < t.cost) return {ok: false, err: '资金不足'};
  g.funds[g.turn] -= t.cost; g.built.add(key(x, y));
  const u = addUnit(g, {type, owner: g.turn, x, y}); u.moved = u.acted = true;   // 新单位本回合不能行动
  return {ok: true, unit: u};
}

// 移动力花费表（含只能穿过、不能停的友军格）：Map('x,y' → 已花的移动力）。敌方单位挡路。
function costMap(g, unit) {
  const t = UNITS[unit.type], budget = g.config.fuel ? Math.min(t.move, unit.fuel) : t.move;
  const best = new Map([[key(unit.x, unit.y), 0]]), todo = [[unit.x, unit.y]];
  while (todo.length) {
    const [x, y] = todo.shift(), base = best.get(key(x, y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, tr = TERRAINS[g.terrain[ny]?.[nx]];
      if (!tr) continue;
      const c = tr.cost[t.mt]; if (c === null || c === undefined) continue;
      const other = unitAt(g, nx, ny); if (other && other.owner !== unit.owner) continue;
      const total = base + c; if (total > budget) continue;
      if (!best.has(key(nx, ny)) || total < best.get(key(nx, ny))) { best.set(key(nx, ny), total); todo.push([nx, ny]); }
    }
  }
  return best;
}

// 可到达（能停下）的格子：Map('x,y' → 已花的移动力）。友方可穿过但不能停在上面。
export function reachable(g, unit) {
  const best = costMap(g, unit);
  for (const k of [...best.keys()]) { const [x, y] = k.split(',').map(Number), o = unitAt(g, x, y); if (o && o !== unit) best.delete(k); }
  return best;
}

// 走到 (x, y) 的最省路线：[[x, y], ...]，第一格是单位现在的位置、最后一格是目的地；到不了 = null（0.67，给战场走位动画用；规则以 reachable 为准）
export function pathOf(g, unit, x, y) {
  const best = costMap(g, unit), t = UNITS[unit.type];
  if (!best.has(key(x, y))) return null;
  const path = [[x, y]]; let cur = [x, y];
  while (cur[0] !== unit.x || cur[1] !== unit.y) {
    const kc = best.get(key(cur[0], cur[1])), c = TERRAINS[g.terrain[cur[1]][cur[0]]].cost[t.mt];
    const prev = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cur[0] + dx, cur[1] + dy]).find(n => best.has(key(n[0], n[1])) && best.get(key(n[0], n[1])) + c === kc);
    if (!prev) return null; path.push(prev); cur = prev;
  }
  return path.reverse();
}

export function move(g, id, x, y) {
  const u = getUnit(g, id);
  if (!u || u.owner !== g.turn || g.winner !== null) return {ok: false, err: '不能操作'};
  if (u.moved || u.acted) return {ok: false, err: '这个单位本回合已行动'};
  const r = reachable(g, u), c = r.get(key(x, y));
  if (c === undefined) return {ok: false, err: '到不了'};
  u.origin = {x: u.x, y: u.y, fuel: u.fuel, cap: u.cap || 0};   // 0.68：走完、选「待命」之前可以撤销（0.77：占领进度一起还原）
  if (g.config.fuel) u.fuel -= c;
  if (x !== u.x || y !== u.y) u.cap = 0;   // 0.77：离开这一格 = 占领进度清零
  u.x = x; u.y = y; u.moved = true; return {ok: true, cost: c};
}

// 撤销移动（0.68）：只在「已经走了、还没待命 / 攻击」时可以，退回原位、燃料和「已移动」一起还原
export function undoMove(g, id) {
  const u = getUnit(g, id);
  if (!u || u.owner !== g.turn || g.winner !== null) return {ok: false, err: '不能操作'};
  if (!u.moved || u.acted || !u.origin) return {ok: false, err: '现在不能撤销'};
  u.x = u.origin.x; u.y = u.origin.y; u.fuel = u.origin.fuel; u.cap = u.origin.cap; u.moved = false; delete u.origin; return {ok: true};
}

// 能打到的敌人（间接火力：移动过就不能开火；最近射程之内打不到）
export function targetsOf(g, u) {
  const t = UNITS[u.type];
  if (u.acted || (t.indirect && u.moved)) return [];
  return g.units.filter(e => e.owner !== u.owner && dist(u, e) >= t.range[0] && dist(u, e) <= t.range[1] && strike(g, u, e));
}

export function attack(g, id, targetId) {
  const a = getUnit(g, id), d = getUnit(g, targetId);
  if (!a || !d || a.owner !== g.turn || g.winner !== null) return {ok: false, err: '不能操作'};
  if (!targetsOf(g, a).includes(d)) return {ok: false, err: '打不到'};
  const out = {ok: true, hit: null, counter: null, hp0: {a: a.hp, d: d.hp}};   // hp0：开打前双方血量（战场飘伤害数字用）
  const spend = (u, s) => { if (s.weapon === 'primary' && g.config.ammo) u.ammo--; };
  const s1 = strike(g, a, d); spend(a, s1); d.hp = Math.max(0, d.hp - s1.damage); out.hit = s1;
  if (d.hp > 0 && !UNITS[d.type].indirect && dist(a, d) === 1) {          // 活着的直瞄单位反击（间接火力不反击）
    const s2 = strike(g, d, a);
    if (s2) { spend(d, s2); a.hp = Math.max(0, a.hp - s2.damage); out.counter = s2; }
  }
  a.moved = a.acted = true; delete a.origin;
  g.units = g.units.filter(u => u.hp > 0);
  checkWinner(g); return out;
}

// ── 占领（0.77，高战规则）──
// 步兵 / 反坦克兵站在不属于自己的建筑上选「占领」：每次累加「显示血量格数」（1–10）的占领点，累计到建筑的占领点数（20）就易主；
// 站着不动、下回合继续占才会接着累加；走开（或被打死）进度清零；占领完毕进度也清零。占领这个动作 = 本回合行动结束。
// 占领对方总部 = 直接获胜（CONFIG.hqWin）。
export function canCapture(g, u) {
  const tr = TERRAINS[g.terrain[u.y]?.[u.x]];
  return !!(UNITS[u.type].capture && tr?.property && g.owners[key(u.x, u.y)] !== u.owner && u.owner === g.turn && !u.acted && g.winner === null);
}
export function capture(g, id) {
  const u = getUnit(g, id); if (!u || !canCapture(g, u)) return {ok: false, err: '不能占领'};
  const k = key(u.x, u.y), tr = TERRAINS[g.terrain[u.y][u.x]], prev = g.owners[k], gain = dispHp(u.hp);
  u.cap = (u.cap || 0) + gain; u.moved = u.acted = true; delete u.origin;
  const out = {ok: true, key: k, terrain: g.terrain[u.y][u.x], prev, gain, cap: u.cap, need: tr.capture, done: false};
  if (u.cap >= tr.capture) {
    g.owners[k] = u.owner; u.cap = 0; out.done = true; out.cap = tr.capture;
    if (g.config.hqWin && g.terrain[u.y][u.x] === 'hq') g.winner = u.owner;
  }
  return out;
}

export function wait(g, id) {
  const u = getUnit(g, id); if (!u || u.owner !== g.turn) return {ok: false, err: '不能操作'};
  u.moved = u.acted = true; delete u.origin; return {ok: true};
}

// 歼灭：曾经有过单位、现在一个不剩的玩家出局（一开始就没有单位的不算，比如只测经济的场景）
function checkWinner(g) {
  const left = g.players.map((_, i) => i).filter(i => !g.everHad[i] || g.units.some(u => u.owner === i));
  if (left.length === 1) g.winner = left[0]; else if (left.length === 0) g.winner = -1;   // -1 = 同归于尽
}

// 结束当前玩家的回合：沼泽掉血 → 换人 → 对方单位恢复行动
export function endTurn(g) {
  if (g.winner !== null) return {ok: false, err: '游戏已结束'};
  if (g.config.swampDamage) {
    for (const u of g.units) if (u.owner === g.turn && TERRAINS[g.terrain[u.y][u.x]].hazard) u.hp -= g.config.swampDamage;
    g.units = g.units.filter(u => u.hp > 0 || !g.config.swampKills);
    for (const u of g.units) if (u.hp < 1) u.hp = 1;                // 不致死时至少留 1 点
    checkWinner(g); if (g.winner !== null) return {ok: true};
  }
  g.turn = (g.turn + 1) % g.players.length; if (g.turn === 0) g.day++;
  for (const u of g.units) if (u.owner === g.turn) { u.moved = u.acted = false; delete u.origin; }
  collectIncome(g);
  return {ok: true};
}

export {dispHp};
