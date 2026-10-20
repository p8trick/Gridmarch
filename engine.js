// engine.js — 纯规则,不碰 DOM、不出现像素。手机和 Node.js 共用。
// 状态 s;血量内部 0-100(显示 1-10);所有函数确定性,无随机。
import { UNITS, TERRAIN, DMG, CONFIG, CAPT, PROP, MAP } from './data.js';

const K = (x, y) => x + ',' + y;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const mk = (s, t, o, x, y) => ({ id: s.nid++, t, o, x, y, hp: 100, md: false, dp: false, ac: false, cp: false, cargo: null });

export function newGame(m = MAP) {
  const tiles = m.rows.map(r => [...r]), h = tiles.length, w = tiles[0].length;
  const s = { w, h, tiles, own: {}, cap: {}, units: [], funds: [...CONFIG.startFunds], turn: 0, day: 1, win: null, nid: 1 };
  tiles.forEach((r, y) => r.forEach((c, x) => {
    if (CAPT.includes(c)) s.own[K(x, y)] = y < 4 ? 1 : y >= h - 4 ? 0 : -1;
  }));
  m.units.forEach(u => s.units.push(mk(s, u.t, u.o, u.x, u.y)));
  return s;
}
export const clone = s => structuredClone(s);
export const unitAt = (s, x, y) => s.units.find(u => u.x === x && u.y === y);
export const adjacent = (u, x, y) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1;
const canLoad = (a, u) => UNITS[a.t].carry && !a.cargo && UNITS[u.t].foot && a.o === u.o && a !== u;
// 合并:同类同阵营、目标未满血、双方都没载货
const canJoin = (a, u) => a !== u && a.t === u.t && a.o === u.o && a.hp < 100 && !a.cargo && !u.cargo;

// 可到达格子:Map<"x,y", 消耗>。敌方单位阻挡;友军可穿过,但只能停在可装载的运输车上。
export function reach(s, u) {
  const D = UNITS[u.t], res = new Map([[K(u.x, u.y), 0]]), q = [[0, u.x, u.y]];
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [c, x, y] = q.shift();
    if (c > res.get(K(x, y))) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      const tc = TERRAIN[s.tiles[ny][nx]].c[D.mt];
      if (tc == null) continue;
      const o = unitAt(s, nx, ny);
      if (o && o.o !== u.o) continue;
      const nc = c + tc;
      if (nc > D.mv) continue;
      const k = K(nx, ny);
      if (res.has(k) && res.get(k) <= nc) continue;
      res.set(k, nc); q.push([nc, nx, ny]);
    }
  }
  for (const k of [...res.keys()]) {
    const [x, y] = k.split(',').map(Number), o = unitAt(s, x, y);
    if (o && o !== u && !canLoad(o, u) && !canJoin(o, u)) res.delete(k);
  }
  return res;
}

// 伤害(内部 0-100 点)= 基础 × 攻方血量比例 × (1 - 守方地形防御)
export function dmg(s, a, d) {
  const b = (DMG[a.t] || [])[UNITS[d.t].cls] || 0;
  return b ? Math.round(b * a.hp / 100 * (1 - TERRAIN[s.tiles[d.y][d.x]].d / 100)) : 0;
}
export function targets(s, u) {
  const D = UNITS[u.t];
  if (u.ac || !D.r[1] || (D.ind && u.dp)) return [];
  return s.units.filter(e => e.o !== u.o && dist(u, e) >= D.r[0] && dist(u, e) <= D.r[1] && dmg(s, u, e) > 0);
}
// 预览:[我方造成伤害, 对方反击伤害]。只有双方都是直射才会反击。
export function preview(s, a, d) {
  const x = dmg(s, a, d), hp = Math.max(0, d.hp - x);
  const c = hp > 0 && !UNITS[a.t].ind && !UNITS[d.t].ind ? dmg(s, { ...d, hp }, a) : 0;
  return [x, c];
}
const kill = (s, u) => { const i = s.units.indexOf(u); if (i >= 0) s.units.splice(i, 1); };
const check = s => { for (const p of [0, 1]) if (s.win == null && !s.units.some(u => u.o === p)) s.win = 1 - p; };

// 执行动作。成功返回 null,失败返回原因字符串。
export function act(s, a) {
  const p = s.turn, u = a.id != null ? s.units.find(x => x.id === a.id) : null;
  if (s.win != null) return '游戏已结束';
  if (a.t !== 'end' && a.t !== 'build' && (!u || u.o !== p || u.ac)) return '该单位不能行动';
  switch (a.t) {
    case 'move': {
      if (u.md) return '已移动';
      if (!reach(s, u).has(K(a.x, a.y))) return '不可到达';
      const o = unitAt(s, a.x, a.y);
      u.cp = false; u.md = true;
      if (o && o !== u) {
        if (canJoin(o, u)) { // 合并:超出满血的部分按造价折成资金
          const sum = o.hp + u.hp, over = Math.max(0, sum - 100);
          o.hp = Math.min(100, sum); o.ac = true; s.funds[p] += Math.round(over / 100 * UNITS[u.t].cost * CONFIG.joinRefund); kill(s, u);
        } else { o.cargo = u; kill(s, u); u.x = o.x; u.y = o.y; u.ac = true; } // 上车
        return null;
      }
      u.dp = a.x !== u.x || a.y !== u.y; u.x = a.x; u.y = a.y; return null;
    }
    case 'attack': {
      const e = s.units.find(x => x.id === a.tid);
      if (!e || !targets(s, u).includes(e)) return '目标无效';
      const [x, c] = preview(s, u, e);
      e.hp -= x; if (e.hp <= 0) kill(s, e);
      if (c && e.hp > 0) { u.hp -= c; if (u.hp <= 0) kill(s, u); }
      u.ac = true; check(s); return null;
    }
    case 'capture': {
      const k = K(u.x, u.y), c = s.tiles[u.y][u.x];
      if (!UNITS[u.t].cap || !CAPT.includes(c) || s.own[k] === p) return '不能占领';
      s.cap[k] = (s.cap[k] ?? CONFIG.capPts) - Math.ceil(u.hp / 10); u.cp = true; u.ac = true;
      if (s.cap[k] <= 0) { s.own[k] = p; delete s.cap[k]; u.cp = false; if (c === 'H') s.win = p; }
      return null;
    }
    case 'unload': {
      const c = u.cargo;
      if (!c || !adjacent(u, a.x, a.y) || unitAt(s, a.x, a.y)) return '无法卸载';
      const t = TERRAIN[s.tiles[a.y]?.[a.x]];
      if (!t || t.c[UNITS[c.t].mt] == null) return '无法卸载到此处';
      c.x = a.x; c.y = a.y; c.ac = true; c.md = true; s.units.push(c); u.cargo = null; u.ac = true; return null;
    }
    case 'wait': u.ac = true; return null;
    case 'build': {
      const t = UNITS[a.type], k = K(a.x, a.y);
      if (!t || s.tiles[a.y]?.[a.x] !== 'F' || s.own[k] !== p || unitAt(s, a.x, a.y)) return '无法建造';
      if (s.funds[p] < t.cost) return '资金不足';
      s.funds[p] -= t.cost;
      const n = mk(s, a.type, p, a.x, a.y); n.ac = n.md = true; s.units.push(n); return null;
    }
    case 'end': return endTurn(s);
  }
  return '未知动作';
}

function endTurn(s) {
  const p = s.turn;
  for (const u of [...s.units]) if (u.o === p && s.tiles[u.y][u.x] === 'w') { u.hp -= 10; if (u.hp <= 0) kill(s, u); } // 沼泽
  for (const k in s.cap) { const [x, y] = k.split(',').map(Number), u = unitAt(s, x, y); if (!u || !u.cp) delete s.cap[k]; }
  check(s); if (s.win != null) return null;
  s.turn = 1 - p; if (s.turn === 0) s.day++;
  const n = s.turn;
  for (const [k, o] of Object.entries(s.own)) if (o === n) { const [x, y] = k.split(',').map(Number); s.funds[n] += PROP[s.tiles[y][x]].inc; }
  for (const u of s.units) if (u.o === n) {
    u.md = u.dp = u.ac = false;
    if (s.own[K(u.x, u.y)] === n) u.hp = Math.min(100, u.hp + PROP[s.tiles[u.y][u.x]].rep); // 己方建筑修复,大城更多
  }
  return null;
}
