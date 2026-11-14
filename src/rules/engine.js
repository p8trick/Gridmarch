// 规则引擎骨架（0.33）：地图 + 单位 + 回合。纯数据、纯函数，不依赖画面，方便自动测试和以后接 AI。
// 目前包含：移动（按地形消耗）、攻击与反击、回合切换、沼泽掉血、歼灭胜负。
// 还没有：占领、生产、合流、补给燃料、修理、运输（后续里程碑）。
import {UNITS, TERRAINS, CONFIG, DEFAULT_STYLE} from './data.js';
import {strike, dispHp} from './combat.js';

const key = (x, y) => x + ',' + y;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// terrain：二维数组 terrain[y][x]，值是 TERRAINS 里的 id；
// units：[{type, owner, x, y, hp?, ammo?, fuel?}]；players：[{style}]（默认两个均衡型军队）
export function createGame({terrain, units = [], players, config = {}}) {
  const g = {
    w: terrain[0].length, h: terrain.length, terrain,
    config: {...CONFIG, ...config},
    players: players || [{style: DEFAULT_STYLE}, {style: DEFAULT_STYLE}],
    units: [], turn: 0, day: 1, winner: null, nextId: 1,
  };
  for (const u of units) addUnit(g, u);
  return g;
}

export function addUnit(g, u) {
  const t = UNITS[u.type]; if (!t) throw Error('未知单位 ' + u.type);
  if (!TERRAINS[g.terrain[u.y]?.[u.x]]) throw Error('位置不在地图内 ' + u.x + ',' + u.y);
  const unit = {id: g.nextId++, type: u.type, owner: u.owner, x: u.x, y: u.y,
    hp: u.hp ?? 100, ammo: u.ammo ?? t.ammo, fuel: u.fuel ?? t.fuel, moved: false, acted: false};
  g.units.push(unit); return unit;
}

export const unitAt = (g, x, y) => g.units.find(u => u.x === x && u.y === y) || null;
export const getUnit = (g, id) => g.units.find(u => u.id === id) || null;

// 可到达的格子：Map('x,y' → 已花的移动力）。敌方单位挡路；友方可穿过但不能停在上面。
export function reachable(g, unit) {
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
  for (const k of [...best.keys()]) { const [x, y] = k.split(',').map(Number), o = unitAt(g, x, y); if (o && o !== unit) best.delete(k); }
  return best;
}

export function move(g, id, x, y) {
  const u = getUnit(g, id);
  if (!u || u.owner !== g.turn || g.winner !== null) return {ok: false, err: '不能操作'};
  if (u.moved || u.acted) return {ok: false, err: '这个单位本回合已行动'};
  const r = reachable(g, u), c = r.get(key(x, y));
  if (c === undefined) return {ok: false, err: '到不了'};
  if (g.config.fuel) u.fuel -= c;
  u.x = x; u.y = y; u.moved = true; return {ok: true, cost: c};
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
  const out = {ok: true, hit: null, counter: null};
  const spend = (u, s) => { if (s.weapon === 'primary' && g.config.ammo) u.ammo--; };
  const s1 = strike(g, a, d); spend(a, s1); d.hp = Math.max(0, d.hp - s1.damage); out.hit = s1;
  if (d.hp > 0 && !UNITS[d.type].indirect && dist(a, d) === 1) {          // 活着的直瞄单位反击（间接火力不反击）
    const s2 = strike(g, d, a);
    if (s2) { spend(d, s2); a.hp = Math.max(0, a.hp - s2.damage); out.counter = s2; }
  }
  a.moved = a.acted = true;
  g.units = g.units.filter(u => u.hp > 0);
  checkWinner(g); return out;
}

export function wait(g, id) {
  const u = getUnit(g, id); if (!u || u.owner !== g.turn) return {ok: false, err: '不能操作'};
  u.moved = u.acted = true; return {ok: true};
}

function checkWinner(g) {
  const alive = g.players.map((_, i) => g.units.some(u => u.owner === i));
  const left = alive.map((a, i) => a ? i : -1).filter(i => i >= 0);
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
  for (const u of g.units) if (u.owner === g.turn) u.moved = u.acted = false;
  return {ok: true};
}

export {dispHp};
