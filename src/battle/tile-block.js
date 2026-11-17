import * as THREE from 'three';
import {PALETTE as P, MAT_TERRAIN, MAT_ACCENT} from 'palette';
import {boardGrass} from '../game/map-builder.js';
import {createSeaRegion} from '../art/water/sea-board-components.js';
import {createTreePine, createTreeBroad} from '../art/terrain/forest/forest-original.js';
import {createMountain} from '../art/terrain/mountain/terrain-mountain-performance.js';
import {createBuildingDisplay, setBuildingAccent, createAirport, createDockyard} from '../art/terrain/buildings-performance.js';
import {createDesertTile, createSwampTile} from '../art/terrain/desert-swamp/expansion-performance.js';
import {createRoadStraight} from '../art/terrain/terrain-nature.js';
import {createGrassTuft, createMtnRock, createPebble, createBush} from '../art/terrain/terrain-batch1.js';
import {createRiverBridgeRun} from '../art/terrain/bridges/bridge-performance.js';

// 厚地块（0.62，战场详细面板「地形盒」小窗用）：一块 2×2 的方块，顶面 y=0、底面 y=BASE_Y（和棋盘 / 深海切面同一个深度），没有底座。
//   · 侧面：陆地类用「地层截面」（草缘 / 土 / 砾石 / 土 / 岩，每层边界起伏——配色和分层沿用 world.js 的沙盘侧壁）；海用你做的深海切面（createBoardCutaway，单格四面）。
//     以后每种地块有了自己的侧面美术，只要在下面 SIDE 表里把那一行换成新的生成函数，其它不用动。
//   · 顶面 + 摆件：全部复用游戏里已有的美术（树 / 山 / 建筑 / 沙漠 / 沼泽 / 桥 / 路 / 岩石），没有现成的（河、浅滩、断崖）用顶面颜色 + 小摆件拼。
// 返回 Group（朝向固定，由小窗的转台旋转）；带 userData.own = 本模块自己造的几何体（关闭面板时可释放），工厂函数造的东西缓存复用，不释放（有些工厂内部共享几何体）。
export const BLOCK_BOTTOM = -1.6;
const ACCENT = {neutral: 0xc4c8cc, blue: 0x2368cb, red: 0xc4402f};
const accentMats = {};
const accentOf = o => accentMats[o] || (accentMats[o] = (m => (m.color.setHex(ACCENT[o]), m))(MAT_ACCENT.clone()));

// ── 确定性噪声 ──
const hash = (a, b) => { let h = Math.imul(Math.floor(a * 1000) * 374761393 + Math.floor(b * 1000) * 668265263, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, s = t => t * t * (3 - 2 * t), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return (a + (b - a) * s(fx)) + ((c + (d - c) * s(fx)) - (a + (b - a) * s(fx))) * s(fy); };
const fbm = (x, y) => vn(x, y) * .6 + vn(x * 2.1 + 7.3, y * 2.1 + 3.1) * .3 + vn(x * 4.3 + 1.7, y * 4.3 + 9.2) * .1;

// ── 几何累加器（顶点色）──
function acc() {
  const pos = [], col = [], c = new THREE.Color();
  const tri = (a, b, d, hex, n) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...d), nn = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    if (n && nn.dot(new THREE.Vector3(...n)) < 0) { pos.push(...a, ...d, ...b); } else pos.push(...a, ...b, ...d);
    c.set(hex); for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  const quad = (a, b, d, e, hex, n) => { tri(a, b, d, hex, n); tri(a, d, e, hex, n); };
  const done = name => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT_TERRAIN); m.name = name; m.receiveShadow = true; m.castShadow = true; m.userData.own = true; return m;
  };
  return {tri, quad, done};
}

// ── 陆地侧面：地层截面（颜色表和 world.js 沙盘侧壁一致）──
const LB_COL = [0x6fa83a, 0x8b6b3e, 0xb59a66, 0x7a5c34, 0x6e6a74, 0x5a5662], LB_ALT = [0x86b94a, 0x9f7d49, 0xcdb27a, 0x8f6d40, 0x857f8d, 0x6c6775];
const AMP = [0, .13, .1, .11, .17, .2, 0];
function strataSides(top, seed = 1) {   // top(side, u)：顶边高度（河那样顶面有缺口时随之变化）；side 0..3 = -x +x -z +z，u = -1..1 沿边
  const A = acc(), c3 = new THREE.Color(), alt = new THREE.Color(), N = 8, BASE = BLOCK_BOTTOM;
  const defs = [{n: [-1, 0, 0], fx: -1, along: 'z'}, {n: [1, 0, 0], fx: 1, along: 'z'}, {n: [0, 0, -1], fz: -1, along: 'x'}, {n: [0, 0, 1], fz: 1, along: 'x'}];
  defs.forEach((sd, si) => {
    const P3 = (u, y, off) => sd.along === 'z' ? [sd.fx * (1 + off), y, u] : [u, y, sd.fz * (1 + off)];
    const bounds = (u, h) => {
      const nz = (f, k) => (fbm(u * f + si * 17.3 + seed * 3, k * 5.1 + si * 3.7) - .5) * 2;
      const b = [h, h - (.1 + .13 * fbm(u * 1.3 + si * 9, 2.2)), -.5 + .2 * nz(.55, 1)];
      b.push(b[2] - (.06 + .07 * fbm(u * 2 + si, 3.3)), -.98 + .22 * nz(.5, 2), -1.3 + .18 * nz(.6, 3), BASE);
      for (let i = 1; i < 6; i++) b[i] = Math.max(Math.min(b[i], b[i - 1] - .08), BASE + (6 - i) * .08);
      return b;
    };
    const V = (u, i, b) => { const taper = Math.min(1, (1 - Math.abs(u)) * 4); const off = i === 0 || i === 6 ? 0 : ((fbm(u * 2.4 + i * 13.7 + si * 5, i * 3.1 + si * 2.9) - .5) * AMP[i] + (i === 1 ? .07 : 0)) * taper; return P3(u, b[i], off); };
    const colorOf = (i, u, jit) => { c3.set(LB_COL[i]); alt.set(LB_ALT[i]); c3.lerp(alt, fbm(u * 1.8 + i * 7, i * 5.3 + si * 2)); return c3.multiplyScalar(1 + (hash(u * 9.1 + i * 17 + jit, si * 3 + i) - .5) * .17).getHex(); };
    let prev = null;
    for (let j = 0; j <= N; j++) {
      const u = -1 + j * 2 / N, cur = {u, b: bounds(u, top(si, u))};
      if (prev) for (let i = 0; i < 6; i++) {
        const p0 = V(prev.u, i, prev.b), p1 = V(u, i, cur.b), p2 = V(u, i + 1, cur.b), p3 = V(prev.u, i + 1, prev.b), um = (prev.u + u) / 2;
        A.tri(p0, p1, p2, colorOf(i, um, 0), sd.n); A.tri(p0, p2, p3, colorOf(i, um, 3.7), sd.n);
      }
      prev = cur;
    }
  });
  return A.done('block_sides');
}
const flatTop = () => 0;

// 侧面表：地形 id → 生成侧面的函数（返回要加进 Group 的东西）。以后每种地块有了自己的侧面美术，在这里换一行
const SIDE = {
  default: top => strataSides(top || flatTop),
};

// ── 顶面 ──
function grassTop(hex, y = 0) { const A = acc(); A.quad([-1, y, -1], [-1, y, 1], [1, y, 1], [1, y, -1], hex, [0, 1, 0]); return A.done('block_top'); }
const place = (o, x, z, y = 0, s = 1, r = 0) => { o.position.set(x, y, z); o.scale.setScalar(s); o.rotation.y = r; return o; };
const tryMake = f => { try { return f(); } catch (e) { console.warn('tile-block prop failed', e); return null; } };

function riverTop(withBridge) {   // 河：东西向河道，中间水面 y=-0.1，两岸斜坡（采样点正好落在 ±.5 / ±.75）
  const g = new THREE.Group(), A = acc(), W = 0x2f8fd6, W2 = 0x4fb0ec, S = 0xd9c78f;
  const B = h => (h ? P.grass : P.grassAlt);
  A.quad([-1, 0, -1], [-1, 0, -.75], [1, 0, -.75], [1, 0, -1], P.grass, [0, 1, 0]);
  A.quad([-1, 0, .75], [-1, 0, 1], [1, 0, 1], [1, 0, .75], P.grassAlt, [0, 1, 0]);
  A.quad([-1, 0, -.75], [-1, -.1, -.5], [1, -.1, -.5], [1, 0, -.75], S, [0, 1, 0]);
  A.quad([-1, -.1, .5], [-1, 0, .75], [1, 0, .75], [1, -.1, .5], S, [0, 1, 0]);
  for (let i = 0; i < 4; i++) A.quad([-1 + i * .5, -.1, -.5], [-1 + i * .5, -.1, .5], [-.5 + i * .5, -.1, .5], [-.5 + i * .5, -.1, -.5], i & 1 ? W : W2, [0, 1, 0]);
  g.add(A.done('river_top'));
  if (withBridge) { const br = tryMake(() => createRiverBridgeRun({cells: [[0, 0]], rotation: 0})); if (br) g.add(br); }
  return g;
}
const RIVER_TOP = (side, u) => { if (side > 1) return 0; const a = Math.abs(u); return a <= .5 ? -.1 : a < .75 ? -.1 * (1 - (a - .5) / .25) : 0; };   // 河道缺口：只在 ±x 两面（沿 z 的边）

const BUILD = {hq: 'bld_hq', city_large: 'bld_city_large', city_small: 'bld_city_small', factory: 'bld_factory'};

// 各地形的内容；owner：0 蓝 / 1 红 / undefined 中立（只影响建筑军队色）
function build(tid, owner) {
  const g = new THREE.Group(); g.name = 'tile_' + tid;
  const ownKey = owner === 0 ? 'blue' : owner === 1 ? 'red' : 'neutral';
  const grass = boardGrass(0, 0);
  if (tid === 'sea') { const r = tryMake(() => createSeaRegion([[0, 0]], {neighbors: [], cutaway: true, relief: 0, seed: 7, bottom: BLOCK_BOTTOM})); if (r) { g.add(r.group); return g; } g.add(grassTop(0x2f8fd6)); g.add(SIDE.default()); return g; }
  let top = flatTop, topObj = null, props = [];
  switch (tid) {
    case 'plain': topObj = grassTop(grass); [[-.55, -.4, 0], [.5, .45, 1], [.1, -.7, 0], [-.3, .6, 1]].forEach(([x, z, v], i) => { const t = tryMake(() => createGrassTuft(v, i + 1)); if (t) props.push(place(t, x, z, 0, 1.3)); }); { const b = tryMake(() => createBush(0, 2)); if (b) props.push(place(b, .55, -.45, 0, 1.1)); } break;
    case 'forest': { topObj = grassTop(0x4c8a2c); [[-.5, -.45], [.45, -.5], [-.1, .1], [.5, .45], [-.55, .5]].forEach(([x, z], i) => { const t = tryMake(() => i % 2 ? createTreeBroad(i, i + 3) : createTreePine(i, i + 3)); if (t) props.push(place(t, x, z, 0, 1.15, i * 1.7)); }); break; }
    case 'mountain': topObj = grassTop(grass); { const m = tryMake(() => createMountain('A', 1)); if (m) props.push(m); } break;
    case 'desert': { const t = tryMake(() => createDesertTile({cell: [0, 0], variant: 'varied', heightScale: .6, seed: 3})); if (t) { topObj = t; } else topObj = grassTop(0xe3cf8f); break; }
    case 'swamp': { const t = tryMake(() => createSwampTile({cell: [0, 0], variant: 'standard', seed: 3, propVariant: () => 'standard'})); topObj = t || grassTop(0x5f7a3c); break; }
    case 'road': topObj = grassTop(grass); { const r = tryMake(() => createRoadStraight()); if (r) props.push(r); } break;
    case 'river': top = RIVER_TOP; topObj = riverTop(false); break;
    case 'bridge': top = RIVER_TOP; topObj = riverTop(true); break;
    case 'shoal': topObj = grassTop(0xe6d6a0, -.04); [[-.4, .3, 0], [.45, -.35, 1]].forEach(([x, z, v], i) => { const t = tryMake(() => createPebble(v, i + 2)); if (t) props.push(place(t, x, z, -.04, 1.4)); }); break;
    case 'cliff': topObj = grassTop(P.rock); [[-.35, -.2, 3], [.4, .35, 2], [.05, .1, 5]].forEach(([x, z, v], i) => { const t = tryMake(() => createMtnRock(v, i + 1)); if (t) props.push(place(t, x, z, 0, 1)); }); break;
    case 'hq': case 'city_large': case 'city_small': case 'factory': {
      topObj = grassTop(0xb9b7a0);
      const v = tryMake(() => { const b = createBuildingDisplay(BUILD[tid]); setBuildingAccent(b, accentOf(ownKey)); return b; }); if (v) props.push(v); break; }
    case 'airport': topObj = grassTop(0xb9b7a0); { const v = tryMake(() => createAirport()); if (v) props.push(v); } break;
    case 'port': topObj = grassTop(0xb9b7a0); { const v = tryMake(() => createDockyard()); if (v) props.push(v); } break;
    default: topObj = grassTop(grass);
  }
  g.add(SIDE.default(top)); if (topObj) g.add(topObj); props.forEach(p => g.add(p));
  return g;
}

const cache = new Map();   // 'tid|owner' → Group
export function getTileBlock(tid, owner) {
  const k = tid + '|' + (owner === undefined ? 'n' : owner);
  if (!cache.has(k)) { let g; try { g = build(tid, owner); } catch (e) { console.error(e); g = new THREE.Group(); } cache.set(k, g); }
  return cache.get(k);
}
