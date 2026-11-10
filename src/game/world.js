import * as THREE from 'three';
import {createTank, TRACK_GAUGE} from './units/tank-family.js';
import {createArtillery} from '../art/units/artillery-v2_0.js';
import {createInfantryActor, resetInfantryBatches, syncInfantryBatches, infantryTriCount} from './units/infantry-actors.js';
import {createTreePine, createTreeBroad} from '../art/terrain/forest/forest-original.js';   // 树林包 V1.0：与原树型逐面一致
import {createForestRegion, disposeForest} from '../art/terrain/forest/forest-performance.js';
import {createMountainRegion, createRoadStraight, createRoadBend, createRoadT, createRoadCross, createRoadEnd} from '../art/terrain/terrain-nature.js';
// 六建筑 V1.6 R3 双版本 + P1 性能版 + D1 港口地形接入（性能版：同一建筑的多个部件合成少量 Mesh；直接改部件 Group 的位置 / 可见性后要 syncBuildingPerformance）
import {createBuildingDisplay, setBuildingDisplayState, setBuildingAccent, getBuildingAccessories, createAirport, createDockyard, setDockyardState, syncBuildingPerformance, createDockyardTerrainSampler, mountDockyardOnTerrain} from '../art/terrain/buildings-index.js';
import {PALETTE as P, MAT_TERRAIN, MAT_ACCENT} from 'palette';
import {PRESETS, createWaterWorld, boardGrass, validateLayout, bridgeCellsOf} from './map-builder.js';
import {createRiverBridgeRun, createSeaBridgeHead, createSeaBridgeModule, BRIDGE_SPEC, seaBridgeHeadHeight, getBridgeSurfaceY} from '../art/terrain/bridges/bridge-performance.js';
import {createDesertRegion, createSwampRegion} from '../art/terrain/desert-swamp/expansion-performance.js';
import {desertSampler} from '../art/terrain/desert-swamp/expansion-terrain.js';
import {createMountain, setMountainHeight, setMountainOccupied, getMountainStandPoint} from '../art/terrain/mountain/terrain-mountain-performance.js';

// 方寸战线（Gridmarch）· 单位 × 地形 测试场景（无 DOM，可在 Node 里做结构检查）
export const S = 1.8 / 4.21;          // 备忘录里的统一缩放：步兵高 4.21 → 1.8
export const MTN_STAND = 0.61;        // 山格驻扎面高度（山定稿 A/B：驻扎顶面 Y=0.61，随山高系数缩放）
export const STAND_R = 0.8;           // 平地站位圈半径
export const ART_K = 0.88;            // 自行火炮相对统一缩放的系数：车体长/宽与轻坦对齐（轻坦车体 3.63×2.45，火炮 4.07×2.81）
export const CULL_R = 2.8;            // 单位级视锥剔除半径（备忘：阴影开时放宽到 2.8）
export const ART_ELEV = 50;           // 火炮默认仰角（原模型默认 30°，上限 65°）

// 道路网：由相邻关系自动选件（直 / 弯 / T / 十字 / 终点）并旋转
const DIRS = {E: [1, 0], N: [0, -1], W: [-1, 0], S: [0, 1]}, SEQ = ['E', 'N', 'W', 'S'];
const rotDir = (d, k) => SEQ[(SEQ.indexOf(d) + k) % 4];           // rotation.y = k·90° 时 d 落到哪个方向
export function roadPieces(cells) {
  const set = new Set(cells.map(c => c.join(',')));
  return cells.map(([cx, cz]) => {
    const conn = SEQ.filter(d => set.has((cx + DIRS[d][0]) + ',' + (cz + DIRS[d][1])));
    const match = (def) => { for (let k = 0; k < 4; k++) { const r = def.map(d => rotDir(d, k)); if (r.length === conn.length && r.every(d => conn.includes(d))) return k; } return -1; };
    let kind, k;
    if (conn.length === 4) { kind = 'cross'; k = 0; }
    else if (conn.length === 3) { kind = 't'; k = match(['W', 'E', 'S']); }
    else if (conn.length === 2 && conn[0] !== rotDir(conn[1], 2)) { kind = 'bend'; k = match(['S', 'E']); }
    else if (conn.length === 2) { kind = 'straight'; k = match(['E', 'W']); }
    else { kind = 'end'; k = conn.length ? match(['S']) : 0; }
    return {cx, cz, kind, k, conn};
  });
}
const ROAD_MAKE = {straight: createRoadStraight, bend: createRoadBend, t: createRoadT, cross: createRoadCross, end: createRoadEnd};
// 布局（山 / 路 / 林 / 建筑 / 单位）随地图预设变化，由 buildWorld(map) 开头的 useLayout 装入；数据在 water/water-map.js 的 PRESETS[*].layout
let DESERT = [], SWAMP = [], MOUNTAIN = [], ROAD_NET = [], FOREST = {x: [0, -1], z: [0, -1]}, FOREST_EXTRA = [], BUILD_LIST = [], UNITS = [], FOREST_SET = new Set(), SAND_SET = new Set(), SWAMP_SET = new Set();
function useLayout(L) {
  ({mountain: MOUNTAIN, roads: ROAD_NET, forest: FOREST, forestExtra: FOREST_EXTRA, buildings: BUILD_LIST, units: UNITS} = L);
  DESERT = L.desert || []; SWAMP = L.swamp || [];   // 沙漠 / 沼泽：整格地块，连片的格子一次交给模型生成（沙丘、水洼才连续）
  SAND_SET = new Set(DESERT.map(c => c.join(','))); SWAMP_SET = new Set(SWAMP.map(c => c.join(',')));
  FOREST_SET = new Set(FOREST_EXTRA.map(c => c.join(',')));
  for (let x = FOREST.x[0]; x <= FOREST.x[1]; x++) for (let z = FOREST.z[0]; z <= FOREST.z[1]; z++) FOREST_SET.add(x + ',' + z);
}
const isForest = (x, z) => FOREST_SET.has(x + ',' + z);
const forestNbrs = (x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => isForest(x + dx, z + dz)).length;
const TRUNK_R = .14;                                                                 // 树干半径：挤开只避让树干，树冠可以盖到单位
export const MAP = {x: [-4, 3], z: [-5, 4]};                       // 可玩棋盘（格坐标，含端点）
const WATER_Y = -0.3, BASE_Y = -1.6;
const ACCENT_COL = {neutral: 0xc4c8cc, blue: 0x2368cb, red: 0xc4402f};
const OWNER_NEXT = {neutral: 'blue', blue: 'red', red: 'neutral'};
export const TREE_LABELS = ['树木:现状', '树木:挤开', '树木:透视'];
export const SIZE_LABELS = ['尺寸:原始比例', '尺寸:战棋比例'];
export const CLS_DEFAULT = {inf: 1.3, light: 1.0, medium: .92, heavy: .8, art: 1.0};     // 战棋比例：各兵种独立缩放（不强求和坦克成比例）


function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function triCount(obj) {
  let n = 0;
  obj.traverse(o => { if (o.isMesh) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  return Math.round(n);
}

// 位置哈希噪声（确定性，边界处相邻段天然连续）
const hash2 = (a, b) => { let h = Math.imul(Math.floor(a * 1000) * 374761393 + Math.floor(b * 1000) * 668265263, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = t => t * t * (3 - 2 * t);
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, g = (i, j) => hash2(i, j) , u = smooth(xf), v = smooth(yf); const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1); const t0 = a + (b - a) * u, t1 = c + (d - c) * u; return t0 + (t1 - t0) * v; };
const fbm = (x, y) => vn(x, y) * .6 + vn(x * 2.1 + 7.3, y * 2.1 + 3.1) * .3 + vn(x * 4.3 + 1.7, y * 4.3 + 9.2) * .1;

// 棋盘：连续草地 + 海 + 岸壁；沙盘模式再加"地层截面"边缘与底座
function makeBoard(sandbox, sampleH, floorTint, water) {
  const pos = [], col = [], c3 = new THREE.Color();
  const tri = (a, b, c, color, out) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) { const t = b; b = c; c = t; }
    pos.push(...a, ...b, ...c); c3.set(color); for (let i = 0; i < 3; i++) col.push(c3.r, c3.g, c3.b);
  };
  const quad = (p0, p1, p2, p3, color, out) => { tri(p0, p1, p2, color, out); tri(p0, p2, p3, color, out); };
  const UP = [0, 1, 0];
  const x0c = MAP.x[0], x1c = MAP.x[1], z0c = MAP.z[0], z1c = MAP.z[1];   // 棋盘只画到 MAP 范围（水域组件按棋盘占格生成外缘）
  for (let cz = z0c; cz <= z1c; cz++) for (let cx = x0c; cx <= x1c; cx++) {
    if (water.typeAt(cx, cz) !== 'land') continue;           // 海 / 浅滩 / 断崖 / 河格的地表由各自组件生成（草色由 water-map 按棋盘色块统一）
    if (SAND_SET.has(cx + ',' + cz) || SWAMP_SET.has(cx + ',' + cz)) continue;   // 沙漠 / 沼泽格：地表由 art/terrain/desert-swamp 的模型生成
    const xa = cx * 2 - 1, xb = cx * 2 + 1, za = cz * 2 - 1, zb = cz * 2 + 1;
    let gc = boardGrass(cx, cz);
    if (floorTint) {
      const inF = isForest(cx, cz), inB = BUILD_LIST.some(b => b.cell[0] === cx && b.cell[1] === cz);
      if (inF) gc = c3.set(gc).lerp(new THREE.Color(0x3f7a28), .62).getHex(); else if (inB) gc = c3.set(gc).lerp(new THREE.Color(0xb9b7a0), .55).getHex();
    }
    quad([xa, 0, za], [xa, 0, zb], [xb, 0, zb], [xb, 0, za], gc, UP);
  }
  if (sandbox) {
    const X0 = MAP.x[0] * 2 - 1, X1 = MAP.x[1] * 2 + 1, Z0 = MAP.z[0] * 2 - 1, Z1 = MAP.z[1] * 2 + 1, STEP = .5;
    const LAND = [[-.12, 0x6fa83a], [-.55, 0x8b6b3e], [-.95, 0x7a5c34], [-1.3, 0x6e6a74], [BASE_Y, 0x5a5662]];
    const sides = [
      {out: [-1, 0, 0], n: MAP.z, fix: X0, cells: cz => MAP.x[0] + ',' + cz, along: 'z', cellOf: cz => [MAP.x[0], cz]},
      {out: [1, 0, 0], n: MAP.z, fix: X1, along: 'z', cellOf: cz => [MAP.x[1], cz]},
      {out: [0, 0, -1], n: MAP.x, fix: Z0, along: 'x', cellOf: cx => [cx, MAP.z[0]]},
      {out: [0, 0, 1], n: MAP.x, fix: Z1, along: 'x', cellOf: cx => [cx, MAP.z[1]]},
    ];
    // —— 陆地侧壁：不规则地层（每层边界随位置起伏、厚度变化、层内色彩渐变、嵌石、壁面凹凸、草缘悬垂）——
    const LB_COL = [0x6fa83a, 0x8b6b3e, 0xb59a66, 0x7a5c34, 0x6e6a74, 0x5a5662];   // 草缘 / 土1 / 砾石薄层 / 土2 / 岩1 / 岩2
    const LB_ALT = [0x86b94a, 0x9f7d49, 0xcdb27a, 0x8f6d40, 0x857f8d, 0x6c6775];
    const AMP = [0, .13, .1, .11, .17, .2, 0];
    const altC = new THREE.Color();
    const bounds = (u, h, sd) => {
      const n = (f, k) => (fbm(u * f + sd * 17.3, k * 5.1 + sd * 3.7) - .5) * 2;
      const b = [h, h - (.1 + .13 * fbm(u * 1.3 + sd * 9, 2.2)), -.5 + .2 * n(.55, 1)];
      b.push(b[2] - (.06 + .07 * fbm(u * 2 + sd, 3.3)), -.98 + .22 * n(.5, 2), -1.3 + .18 * n(.6, 3), BASE_Y);
      for (let i = 1; i < 6; i++) b[i] = Math.max(Math.min(b[i], b[i - 1] - .1), BASE_Y + (6 - i) * .08);
      return b;
    };
    const landWall = (sd, si, c) => {
      const P = (u, y, off) => sd.along === 'z' ? [sd.fix + sd.out[0] * off, y, u] : [u, y, sd.fix + sd.out[2] * off];
      const V = (u, i, b) => { const off = i === 0 || i === 6 ? 0 : (fbm(u * 2.4 + i * 13.7 + si * 5, i * 3.1 + si * 2.9) - .5) * AMP[i] + (i === 1 ? .07 : 0); return P(u, b[i], off); };
      const colorOf = (i, u, jit) => { c3.set(LB_COL[i]); altC.set(LB_ALT[i]); c3.lerp(altC, fbm(u * 1.8 + i * 7, i * 5.3 + si * 2)); return c3.multiplyScalar(1 + (hash2(u * 9.1 + i * 17 + jit, si * 3 + i) - .5) * .17).getHex(); };
      const lo = c * 2 - 1, N = 8, STP = 2 / N;
      let prev = null;
      for (let j = 0; j <= N; j++) {
        const u = lo + j * STP, pt = sd.along === 'z' ? [sd.fix - sd.out[0] * .02, u] : [u, sd.fix - sd.out[2] * .02];
        const h = sampleH(...pt), b = bounds(u, h, si), cur = {u, b};
        if (prev) for (let i = 0; i < 6; i++) {
          const p0 = V(prev.u, i, prev.b), p1 = V(u, i, b), p2 = V(u, i + 1, b), p3 = V(prev.u, i + 1, prev.b), um = (prev.u + u) / 2;
          tri(p0, p1, p2, colorOf(i, um, 0), sd.out); tri(p0, p2, p3, colorOf(i, um, 3.7), sd.out);
        }
        prev = cur;
      }
      // 嵌石：贴在土2/岩层里向外微凸的小石块
      for (let k = 0; k < 2; k++) {
        const key = si * 977 + c * 31 + k;
        if (hash2(key, 1.3) < .35) continue;
        const u = lo + .25 + hash2(key, 2.1) * 1.5, h = sampleH(...(sd.along === 'z' ? [sd.fix - sd.out[0] * .02, u] : [u, sd.fix - sd.out[2] * .02])), b = bounds(u, h, si);
        const y = b[4] + (b[5] - b[4]) * (.15 + .7 * hash2(key, 3.7)) + (hash2(key, 4.4) < .5 ? (b[3] - b[4]) * .5 : 0), r = .12 + .15 * hash2(key, 5.5), e = .08 + .09 * hash2(key, 6.6);
        const A = P(u - r, y - .3 * r, 0), B = P(u + r, y - .2 * r, 0), C = P(u + .1 * r, y + .9 * r, 0), D = P(u, y, e);
        const rc = () => { c3.set(0x7d7883).multiplyScalar(.85 + .3 * hash2(key, 7.7 + Math.random() * 0)); return c3.getHex(); };
        const base = rc(); tri(A, B, D, base, sd.out); tri(B, C, D, base, sd.out); tri(C, A, D, base, sd.out);
      }
    };
    let seg = 0;
    for (let si = 0; si < sides.length; si++) { const sd = sides[si];
      for (let c = sd.n[0]; c <= sd.n[1]; c++) {
        const [cx, cz] = sd.cellOf(c);
        if (water.typeAt(cx, cz) === 'land') landWall(sd, si, c);   // 水 / 海岸 / 河格的棋盘外缘由水域组件自己的切面负责
      }
    }
    // 底座：一圈略外扩的深色基台 + 顶面台阶
    const E = .2, XA = X0 - E, XB = X1 + E, ZA = Z0 - E, ZB = Z1 + E, DARK = 0x353a42, LEDGE = 0x4a505a, BY = BASE_Y - .3;
    quad([XA, BASE_Y, ZA], [XB, BASE_Y, ZA], [XB, BASE_Y, Z0], [XA, BASE_Y, Z0], LEDGE, UP);
    quad([XA, BASE_Y, Z1], [XB, BASE_Y, Z1], [XB, BASE_Y, ZB], [XA, BASE_Y, ZB], LEDGE, UP);
    quad([XA, BASE_Y, Z0], [X0, BASE_Y, Z0], [X0, BASE_Y, Z1], [XA, BASE_Y, Z1], LEDGE, UP);
    quad([X1, BASE_Y, Z0], [XB, BASE_Y, Z0], [XB, BASE_Y, Z1], [X1, BASE_Y, Z1], LEDGE, UP);
    quad([XA, BASE_Y, ZA], [XB, BASE_Y, ZA], [XB, BY, ZA], [XA, BY, ZA], DARK, [0, 0, -1]);
    quad([XA, BASE_Y, ZB], [XB, BASE_Y, ZB], [XB, BY, ZB], [XA, BY, ZB], DARK, [0, 0, 1]);
    quad([XA, BASE_Y, ZA], [XA, BASE_Y, ZB], [XA, BY, ZB], [XA, BY, ZA], DARK, [-1, 0, 0]);
    quad([XB, BASE_Y, ZA], [XB, BASE_Y, ZB], [XB, BY, ZB], [XB, BY, ZA], DARK, [1, 0, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, MAT_TERRAIN); m.receiveShadow = true; m.name = sandbox ? 'board_sandbox' : 'board_flat';
  return m;
}

// 步兵 V6.7：一个骨架原型 + 每队着色 + 共享几何的实例（units/soldier-instance.js）
function createUnitModel(spec, idx) {
  if (spec.k === 'tank') return createTank(spec.type, {faction: spec.team});
  if (spec.k === 'art') return createArtillery({faction: spec.team, batch: true, paint: true});
  return null;   // 步兵走 createInfantryActor（需要动画句柄）
}

const BADGE = {light: '轻', medium: '中', heavy: '重', art: '炮', inf: '兵', at: '反'};
function makeBadge(label, team) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = team === 'blue' ? '#2f5f9e' : '#a8403a'; x.strokeStyle = '#fff'; x.lineWidth = 6;
  x.beginPath(); x.roundRect(10, 10, 108, 108, 22); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 76px -apple-system,PingFang SC,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(label, 64, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthTest: false, transparent: true}));
  sp.scale.set(.62, .62, 1); sp.renderOrder = 20; return sp;
}

export function buildWorld({map = 'bay', preset = null} = {}) {
  const mapPreset = preset || PRESETS[map] || PRESETS.bay;   // preset：直接传入关卡预设（见 game/levels/）
  MAP.x = [...mapPreset.x]; MAP.z = [...mapPreset.z];        // 棋盘范围跟随预设（测试图都是 8×10，关卡可以更大）
  validateLayout(mapPreset); useLayout(mapPreset.layout);   // 先校验：建筑/林/山/路/单位不得与水或彼此重叠
  const scene = new THREE.Scene(); resetInfantryBatches(scene);   // 反坦克步兵的批量绘制根挂在场景根上
  scene.background = new THREE.Color('#26333c');
  const sun = new THREE.DirectionalLight(0xfff3d5, 3);
  sun.position.set(-8, 16, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 55});
  sun.shadow.bias = -.0003;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xe5efff, 0x67704f, 1.7));
  const SUN_OFF = [-8, 16, 9];
  // 阴影范围只有 ±18，大地图要让太阳跟着相机目标走；坐标取整到 1 个世界单位，避免阴影边缘随平移闪烁
  function setShadowRadius(r) { Object.assign(sun.shadow.camera, {left: -r, right: r, top: r, bottom: -r, far: 55 + (r - 18)}); sun.shadow.camera.updateProjectionMatrix(); }
  function sunFollow(x, z) { const sx = Math.round(x), sz = Math.round(z); sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_OFF[0], SUN_OFF[1], sz + SUN_OFF[2]); sun.target.updateMatrixWorld(); }

  const state = {infPose: 'idle', infGait: 'run', treeK: 1, mtnK: 1, unitK: 1, artK: ART_K, artElev: ART_ELEV, annexPush: true, rings: false, units: true, cull: true, idle: false, badges: false, selected: null, clsK: {...CLS_DEFAULT}, treeMode: 1, sizeMode: 0, floorTint: false, terrBadges: false, camA: 0, viewQuarter: 0, bldFollow: true, sandbox: true};

  const water = createWaterWorld(mapPreset, {cutaway: true}); scene.add(water.group);   // 海 / 浅滩 / 断崖 / 河（外缘切面随"沙盘边缘"开关）
  // 桥：A 型河桥（河格上）/ B 型跨海桥（两端桥头在海岸格里，中间在海格上）。桥是叠在水域上的附加模型，桥格对陆军可通行
  const bridgeGroup = new THREE.Group(); bridgeGroup.name = 'bridges'; scene.add(bridgeGroup);
  const bridgeInfo = new Map(), bridgeByCell = new Map();   // 桥格 → 备用站立高度；桥格 → 对应的桥梁 Group（用桥梁的 Height API 取真实桥面高度）
  for (const b of mapPreset.bridges || []) {
    if (b.type === 'A') { const g = createRiverBridgeRun({cells: b.cells, rotation: b.rotation}); bridgeGroup.add(g); for (const c of b.cells) { bridgeInfo.set(c.join(','), BRIDGE_SPEC.riverDeckY); bridgeByCell.set(c.join(','), g); } }
    else b.cells.forEach((c, i) => {
      const n = b.cells.length, head = i === 0 || i === n - 1;
      const g = head ? createSeaBridgeHead({cell: c, rotation: i === n - 1 ? (b.rotation + 2) % 4 : b.rotation}) : createSeaBridgeModule({cell: c, rotation: b.rotation});
      bridgeGroup.add(g); bridgeByCell.set(c.join(','), g);
      bridgeInfo.set(c.join(','), head ? seaBridgeHeadHeight(0) : BRIDGE_SPEC.seaDeckY);
    });
  }
  const roads = new THREE.Group(); roads.name = 'roads';
  for (const p of roadPieces([...ROAD_NET, ...bridgeCellsOf(mapPreset)]).filter(p => !bridgeInfo.has(p.cx + ',' + p.cz))) {   // 桥格参与相邻道路的连接判断，但自己的路面由桥模型负责
     const r = ROAD_MAKE[p.kind](); r.position.set(p.cx * 2, 0, p.cz * 2); r.rotation.y = p.k * Math.PI / 2; roads.add(r); }
  scene.add(roads);

  // 山：不再做相邻格自动融合。每格从 8 个面（A 单峰 / B 双峰 × 4 朝向）里随机挑一个，尽量与已摆好的左、上邻格不同；
  // 每格再带一点点固定的山高抖动（±MTN_JIT），整体山高由滑条在 0.90–1.10 内微调
  const mountain = new THREE.Group(); mountain.name = 'mountains'; scene.add(mountain);
  const MTN_JIT = .04, hills = new Map();
  for (const [cx, cz] of MOUNTAIN) {
    const nb = [[cx - 1, cz], [cx, cz - 1]].map(c => hills.get(c.join(','))?.face);
    let f = Math.floor(hash2(cx * 7.3 + cz * 3.1, 11.7) * 8) % 8;
    for (let i = 0; i < 8 && nb.includes(f); i++) f = (f + 1) % 8;
    const hill = createMountain(f < 4 ? 'A' : 'B', f % 4); hill.position.set(cx * 2, 0, cz * 2); mountain.add(hill);
    hills.set(cx + ',' + cz, {hill, face: f, jit: 1 + (hash2(cx * 5.1 - cz * 2.3, 3.9) - .5) * 2 * MTN_JIT, occ: false});
  }
  const applyMountainHeights = () => { for (const m of hills.values()) setMountainHeight(m.hill, Math.min(1.1, Math.max(.9, state.mtnK * m.jit))); mountain.updateMatrixWorld(true); };
  // 驻扎：有单位停在（或正在走向）的山格切成驻扎顶面，其余恢复自然山顶
  const syncMountains = () => {
    const occ = new Set();
    for (const u of units) { if (u.path) for (const c of u.path) occ.add(c.join(',')); else occ.add(u.cell.join(',')); }
    for (const [k, m] of hills) { const o = occ.has(k); if (o !== m.occ) { setMountainOccupied(m.hill, o); m.occ = o; } }
  };
  const mtnSet = new Set(MOUNTAIN.map(c => c.join(',')));
  // 沙漠 / 沼泽：整格地块，自带地表（沙丘最高 0.35，沼泽有浅水洼和芦苇）。连片的格子一次传入，沙丘和水洼才连续；
  // 沙漠取"半高沙丘"，让单位站在上面不会被沙丘埋住。模型本身是性能版：按 3×3 格分区合批。
  const dSeed = mapPreset.seed ?? 7;
  const sand = DESERT.length ? createDesertRegion(DESERT, {variant: 'low_dunes', seed: dSeed}) : null;
  const marsh = SWAMP.length ? createSwampRegion(SWAMP, {variant: 'standard', seed: dSeed}) : null;
  if (sand) { sand.name = 'desert'; scene.add(sand); }
  if (marsh) { marsh.name = 'swamp'; scene.add(marsh); }
  const sandH = DESERT.length ? desertSampler(DESERT, {variant: 'low_dunes', seed: dSeed}).sample : null;
  const bldMap = new Map(BUILD_LIST.map(b => [b.cell.join(','), b]));
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const sampleH = (x, z) => { rc.set(new THREE.Vector3(x, 5, z), down); const h = rc.intersectObject(mountain, true)[0]; return h ? Math.max(0, h.point.y) : 0; };
  let ground = null, lastMtnK = -1, lastSand = null, lastTint = false;
  function rebuildBoard() {
    if (ground) { scene.remove(ground); ground.geometry.dispose(); }
    applyMountainHeights();
    ground = makeBoard(state.sandbox, sampleH, state.floorTint, water); scene.add(ground); lastTint = state.floorTint; water.setCutaway(state.sandbox);
    scene.background.set(state.sandbox ? '#1b2227' : '#26333c');
    lastMtnK = state.mtnK; lastSand = state.sandbox;
  }
  rebuildBoard();
  // 浅滩/断崖格：格内一部分是水，单位站在格心会悬在水面上。把站位从"水侧"推向陆侧 COAST_SHIFT，高度取该处真实地表
  const COAST_SHIFT = .4, coastOff = new Map(), coastY = new Map();
  const coastOffset = (cx, cz) => {
    const k = cx + ',' + cz; let o = coastOff.get(k);
    if (!o) {
      let sx = 0, sz = 0;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const h = water.surfaceAt(cx * 2 + i * .4, cz * 2 + j * .4); if (h && h.y < -.28) { sx += i * .4; sz += j * .4; } }
      const L = Math.hypot(sx, sz); o = L > 1e-6 ? [-sx / L * COAST_SHIFT, -sz / L * COAST_SHIFT] : [0, 0]; coastOff.set(k, o);
    }
    return o;
  };
  const isCoast = (cx, cz) => { const t = water.typeAt(cx, cz); return t === 'shoal' || t === 'cliff'; };
  const WADE_DEPTH = .27;   // 涉水深度定稿：水面落在身高 27% 处（膝盖）；再深不好看
  const groundY = (cx, cz, u) => {
    { const k = cx + ',' + cz; if (bridgeInfo.has(k)) return getBridgeSurfaceY(bridgeByCell.get(k), cx * 2, cz * 2) ?? bridgeInfo.get(k); }   // 桥面高度（必须最先判断：桥格底下是河，否则会被当成涉水而陷进水里）：静止时取格心处的实际桥面
    { const m = hills.get(cx + ',' + cz); if (m) return getMountainStandPoint(m.hill).y; }
    if (sandH && SAND_SET.has(cx + ',' + cz)) return sandH(cx * 2, cz * 2);   // 沙漠：格心处的沙丘高度（半高沙丘 ≤ 0.35）
    if (water.typeAt(cx, cz) === 'river') return WATER_Y - WADE_DEPTH * (u?.topOff || 1.8);   // 河里没有河床几何：水面不透明，沉下去的下半身被水面遮住
    if (isCoast(cx, cz)) { const an = water.anchorAt?.(cx, cz); if (an) return an[1]; const k = cx + ',' + cz; if (!coastY.has(k)) { const o = coastOffset(cx, cz); coastY.set(k, water.surfaceAt(cx * 2 + o[0], cz * 2 + o[1])?.y ?? 0); } return coastY.get(k); }
    { const bb = bldMap.get(cx + ',' + cz); if (bb?.dockAnchor) return bb.dockAnchor.y; return bb?.y || 0; }
  };

  // 树：连片林按抖动网格铺满；孤立林格（周围无林）随机 2–3 棵，避免"只有一棵"的寒酸感
  const trees = [], rand = rng(11);
  const addTree = (x, z) => {
    const v = Math.floor(rand() * 3), sd = Math.floor(rand() * 9999);
    const pine = rand() < .6, t = (pine ? createTreePine : createTreeBroad)(v, sd), yaw = rand() * 6.28;
    t.position.set(x, 0, z); t.rotation.y = yaw; scene.add(t);
    trees.push({obj: t, x, z, cx: x, cz: z, hcx: Math.round(x / 2), hcz: Math.round(z / 2), faded: false, hidden: false, kind: pine ? 'pine' : 'broad', v, sd, yaw});
  };
  for (let x = MAP.x[0] * 2 - 1 + .4; x < MAP.x[1] * 2 + 1; x += .85) for (let z = MAP.z[0] * 2 - 1 + .4; z < MAP.z[1] * 2 + 1; z += .85) {
    const jx = x + (rand() - .5) * .35, jz = z + (rand() - .5) * .35, cx = Math.round(jx / 2), cz = Math.round(jz / 2);
    if (isForest(cx, cz) && forestNbrs(cx, cz) > 0) addTree(jx, jz);
  }
  for (const [cx, cz] of FOREST_EXTRA.concat([])) {
    if (forestNbrs(cx, cz) > 0) continue;
    const n = rand() < .5 ? 2 : 3, pts = [];
    for (let k = 0; k < 40 && pts.length < n; k++) {
      const px = cx * 2 + (rand() - .5) * 1.5, pz = cz * 2 + (rand() - .5) * 1.5;
      if (pts.every(q => Math.hypot(q[0] - px, q[1] - pz) > .8)) pts.push([px, pz]);
    }
    pts.forEach(q => addTree(q[0], q[1]));
  }

  const roadSet = new Set(ROAD_NET.map(c => c.join(','))), forestHas = isForest;

  // 建筑（按相机象限旋转；空置 = 完整街区，驻扎 = 主楼归位并露出站位锚点）
  const accentMats = {};
  const accentOf = o => accentMats[o] || (accentMats[o] = (m => (m.color.setHex(ACCENT_COL[o]), m))(MAT_ACCENT.clone()));
  // 主建筑正面（朝向系内 z 最大值）。驻军时主建筑会缩回，贴着正面的附件（台阶）要跟着缩
  const measureFront = display => {
    const body = display.getObjectByName('view_facing').getObjectByName('building'); body.updateMatrix();
    let zmax = -Infinity;
    body.traverse(o => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const m = new THREE.Matrix4(); for (let n = o; n && n !== body; n = n.parent) { n.updateMatrix(); m.premultiply(n.matrix); }
      m.premultiply(body.matrix);
      zmax = Math.max(zmax, o.geometry.boundingBox.clone().applyMatrix4(m).max.z);
    });
    return zmax;
  };
  const TRANSPORT_MAKE = {bld_airport: createAirport, bld_dockyard: createDockyard};
  const buildings = BUILD_LIST.map(b => {
    const tr = TRANSPORT_MAKE[b.type];
    let v, acc = [], dockAnchor = null;
    if (b.type === 'bld_dockyard') {   // 船坞 D1：贴着实际海岸地形安装（自动找能放下水池的朝向）；根对象直接放进场景，不能套在带平移的父级下
      v = tr(); v.userData.transport = true; v.userData.dock = true;   // 注意：不能改根对象的 name，D1 用它识别是不是船坞
      let placement = null, lastErr = null; const sampler = createDockyardTerrainSampler(water.group);
      for (const q of (b.quarter !== undefined ? [b.quarter] : [0, 1, 2, 3])) { try { placement = mountDockyardOnTerrain(v, {cell: b.cell, quarter: q, landY: 0, waterY: WATER_Y, sampleTerrain: sampler, autoFit: true, maxBerthShift: .70, allowNeighborOverhang: true}); break; } catch (e) { lastErr = e; } }
      if (!placement) throw Error('船坞放不下 @ ' + b.cell + '：' + (lastErr?.message || '') );
      const g = placement.anchors.ground; dockAnchor = {x: g.x ?? g[0], y: g.y ?? g[1], z: g.z ?? g[2]};
    }
    else if (tr) { v = new THREE.Group(); v.name = b.type + '_display'; v.add(tr()); v.userData.transport = true; }
    else { v = createBuildingDisplay(b.type); acc = getBuildingAccessories(v); for (const p of acc) p.userData.cur = [p.position.x, p.position.z], p.userData.tgt = [p.position.x, p.position.z]; }
    if (!dockAnchor) v.position.set(b.cell[0] * 2, 0, b.cell[1] * 2);
    v.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(v);
    return {...b, visual: v, acc, dockAnchor, front0: tr ? 0 : measureFront(v)};
  });
  const bq = () => state.bldFollow ? state.viewQuarter : 0;
  const bTheta = b => b.follow === false ? 0 : bq() * Math.PI / 2;
  // 海岸格站位：MT2 逐格给出实际陆面参考点（anchorAt）；旧海岸模块没有，退回 coastOffset 的推算
  const standPos = (cx, cz) => {
    const b = bldMap.get(cx + ',' + cz), mh = hills.get(cx + ',' + cz);
    if (mh) { const p = getMountainStandPoint(mh.hill); return [p.x, p.z]; }   // 山格：驻扎锚点（随朝向旋转，偏离格心一点）
    if (!b) { if (isCoast(cx, cz) && !bridgeInfo.has(cx + ',' + cz)) { const an = water.anchorAt?.(cx, cz); if (an) return [an[0], an[2]]; const o = coastOffset(cx, cz); return [cx * 2 + o[0], cz * 2 + o[1]]; } return [cx * 2, cz * 2]; }
    if (b.dockAnchor) return [b.dockAnchor.x, b.dockAnchor.z];   // 船坞：陆军站位用 D1 给的陆地锚点
    const th = bTheta(b), [lx, lz] = b.stand || [0, .45];
    return [cx * 2 + lx * Math.cos(th) + lz * Math.sin(th), cz * 2 - lx * Math.sin(th) + lz * Math.cos(th)];
  };

  // 单位
  const unitsGroup = new THREE.Group(); scene.add(unitsGroup);
  const rings = new THREE.Group(); rings.visible = false; scene.add(rings);
  const units = UNITS.map((spec, idx) => {
    const actors = spec.k === 'inf' ? [createInfantryActor(spec.team, spec.type)].map(a => { a.phase = (idx * .31) % 1; return a; }) : null;
    const model = actors ? actors[0].root : createUnitModel(spec, idx);
    const msz = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const holder = new THREE.Group(); holder.add(model); holder.rotation.y = spec.face; holder.name = spec.name;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    unitsGroup.add(holder);
    const ring = new THREE.Mesh(new THREE.RingGeometry(STAND_R - .02, STAND_R + .02, 48), new THREE.MeshBasicMaterial({color: 0xffeed0, side: THREE.DoubleSide}));
    ring.rotation.x = -Math.PI / 2; rings.add(ring);
    const label = BADGE[spec.k === 'tank' || spec.type === 'at' ? spec.type : spec.k];
    const badge = makeBadge(label, spec.team); if (badge) { badge.visible = false; scene.add(badge); }
    return {spec, holder, model, ring, badge, actors, msz, fw: 1, fl: 1, tbadge: null, phase: idx * 1.7, baseY: 0, baseScale: 1, cell: [...spec.c], yaw: spec.face, path: null, dist: 0, curY: 0, topOff: 1.5, x: spec.c[0] * 2, z: spec.c[1] * 2, tris: triCount(model)};
  });

  const ghostCache = new Map();
  const ghostOf = m => { let g = ghostCache.get(m); if (!g) { g = m.clone(); g.transparent = true; g.opacity = .5; g.depthWrite = false; ghostCache.set(m, g); } return g; };
  // 附楼规则（按建筑类型 × 附件类型）：attach = 驻军时跟着主建筑正面一起后缩（贴着楼不悬空），被单位挡住即可；sym = 左右对称向外挤，两侧位移相同；挤到极限仍压到单位就整对一起消失
  const ACC_RULES = {bld_hq: {steps: 'attach', wall: 'sym'}};
  function applyAccRules(b, fp) {
    const rules = ACC_RULES[b.type]; if (!rules || !fp) return;
    const R = [-fp[0] / 2 - .04, .45 - fp[1] / 2 - .04, fp[0] / 2 + .04, .45 + fp[1] / 2 + .04];   // 与 v1.6 排布一致的单位占地框（朝向系）
    const home = p => { p.position.set(p.userData.home[0], 0, p.userData.home[1]); p.rotation.y = 0; p.visible = true; };
    const rect = p => { const [w, d] = Math.abs(Math.sin(p.rotation.y)) > .5 ? [p.userData.size[1], p.userData.size[0]] : p.userData.size; return [p.position.x - w / 2, p.position.z - d / 2, p.position.x + w / 2, p.position.z + d / 2]; };
    const ov = (a, c) => a[0] < c[2] - .005 && a[2] > c[0] + .005 && a[1] < c[3] - .005 && a[3] > c[1] + .005;
    const fixed = [];
    const dz = measureFront(b.visual) - b.front0;          // 主建筑正面相对空置时的位移（驻军时为负）
    for (const p of b.acc) if (rules[p.userData.type] === 'attach') { home(p); p.position.z += dz; fixed.push(rect(p)); }
    const sym = b.acc.filter(p => rules[p.userData.type] === 'sym');
    if (sym.length) {
      let need = 0, room = Infinity;
      for (const p of sym) {
        home(p);
        const [w, d] = p.userData.size, hx = Math.abs(p.userData.home[0]), hz = p.userData.home[1];
        room = Math.min(room, .99 - (hx + w / 2));                                   // 向外还能挤多远（不出格）
        if (hz + d / 2 > R[1] && hz - d / 2 < R[3]) need = Math.max(need, R[2] - (hx - w / 2));   // 要完全让开单位占地框需要挤多远
      }
      const sft = Math.max(0, Math.min(need, room));
      for (const p of sym) p.position.x += (Math.sign(p.userData.home[0]) || 1) * sft;
      // 兜底：挤到极限仍压到单位占地框时，该对镜像围墙一起消失（左右同时，保持对称）
      const pairs = new Map(); for (const p of sym) { const k = Math.abs(p.userData.home[0]).toFixed(3) + '|' + p.userData.home[1].toFixed(3); (pairs.get(k) || pairs.set(k, []).get(k)).push(p); }
      for (const ps of pairs.values()) { const hit = ps.some(p => ov(rect(p), R)); for (const p of ps) { p.visible = !hit; if (!hit) fixed.push(rect(p)); } }
    }
    for (const p of b.acc) if (!rules[p.userData.type] && p.visible) { const r = rect(p); if (fixed.some(f => ov(r, f))) p.visible = false; }   // 树 / 灌木若压到保留件就隐藏
  }
  function refreshBuildings() {
    for (const b of buildings) {
      const ou = units.find(u => !u.path && u.cell[0] === b.cell[0] && u.cell[1] === b.cell[1]), occ = !!ou;
      setBuildingAccent(b.visual, accentOf(b.owner));
      if (b.visual.userData.transport) {
        if (b.type === 'bld_airport') b.visual.rotation.y = bTheta(b);
        else setDockyardState(b.visual.userData.dock ? b.visual : b.visual.children[0], {landOccupied: occ});
      } else {
        const th = bTheta(b);
        let fp;
        if (occ && state.annexPush) {   // 单位占地（相对建筑朝向的外接矩形），量化到 0.05 防止每帧重排
          const psi = ou.yaw - th, cp = Math.abs(Math.cos(psi)), sp = Math.abs(Math.sin(psi));
          const q = v => Math.min(2.6, Math.ceil(v / .05) * .05);
          fp = [q(ou.fw * cp + ou.fl * sp), q(ou.fw * sp + ou.fl * cp)];
        }
        const prevKey = b.visual.userData.accessoryLayoutKey;
        setBuildingDisplayState(b.visual, {occupied: occ, viewQuarter: bq(), ...(fp ? {unitFootprint: fp} : {})});
        const grpA = b.visual.getObjectByName('vacant_annexes');
        if (state.annexPush) {
          grpA.visible = true;
          if (b.visual.userData.accessoryLayoutKey !== prevKey) { applyAccRules(b, fp); for (const p of b.acc) { const d = p.userData; d.tgt = [p.position.x, p.position.z]; p.position.set(d.cur[0], 0, d.cur[1]); } syncBuildingPerformance(b.visual); }
        } else {   // 不挤开：驻军时整组附楼隐藏，空置时归位
          let ch = grpA.visible !== !occ; grpA.visible = !occ;
          for (const p of b.acc) { const d = p.userData; d.cur = [p.userData.home[0], p.userData.home[1]]; d.tgt = [d.cur[0], d.cur[1]]; if (p.position.x !== d.cur[0] || p.position.z !== d.cur[1] || p.rotation.y !== 0 || !p.visible) ch = true; p.position.set(d.cur[0], 0, d.cur[1]); p.rotation.y = 0; p.visible = true; }
          b.visual.userData.accessoryLayoutKey = undefined;
          if (ch) syncBuildingPerformance(b.visual);
        }
      }
      const ghost = state.treeMode === 2 && occ;
      b.visual.traverse(o => {
        if (!o.isMesh) return;
        if (o.name === 'accent' || o.name === 'tower_flag_accent') o.userData.orig = o.material; else o.userData.orig = o.userData.orig || o.material;
        o.material = ghost ? ghostOf(o.userData.orig) : o.userData.orig;
      });
    }
  }
  // 步兵测试接口：姿态（idle / aim / kneel）与开火。有选中的步兵就只作用于它，否则作用于全部不在移动中的步兵
  const infTargets = () => { const sel = state.selected; const L = sel && sel.actors ? [sel] : units.filter(u => u.actors); return L.filter(u => !u.path); };
  function setInfPose(name) { state.infPose = name; for (const u of infTargets()) for (const a of u.actors) a.setMode(name); }
  // 炮塔转向最近的敌人：setAim 的偏航是相对车体的度数，正向 = 绕 +Y 逆时针（与 holder.rotation.y 同向）
  function aimAtNearestEnemy(u) {
    let best = null, bd = 1e9;
    for (const e of units) { if (e.spec.team === u.spec.team) continue; const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < bd) { bd = d; best = e; } }
    if (!best) return;
    let yaw = Math.atan2(best.x - u.x, best.z - u.z) - u.yaw; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    u.model.setAim(yaw * 180 / Math.PI, 2); u.aimLock = true;
  }
  const fireTargets = () => { const sel = state.selected; const L = sel ? [sel] : units; return L.filter(u => !u.path); };
  function fireInfantry(shots = 3) {   // 名字沿用：现在对步兵、坦克都开火。有选中就只作用于它，否则作用于全部不在移动中的单位
    for (const u of fireTargets()) {
      if (u.actors) u.actors.forEach((a, i) => { if (a.mode === 'idle') a.setMode(state.infPose === 'kneel' ? 'kneel' : 'aim'); a.shoot(shots, i * .07); });
      else if (u.spec.k === 'tank') { aimAtNearestEnemy(u); u.fireQ = (u.fireQ | 0) + shots; }
    }
  }
  function cycleOwner(cell) { const b = bldMap.get(cell[0] + ',' + cell[1]); if (!b) return null; const real = buildings.find(x => x.cell[0] === b.cell[0] && x.cell[1] === b.cell[1]); real.owner = OWNER_NEXT[real.owner]; refreshBuildings(); return real; }
  function syncUnit(u) {
    const y = u.path ? u.curY : groundY(u.cell[0], u.cell[1], u);
    u.holder.position.set(u.x, y, u.z); u.holder.rotation.y = u.yaw;
    u.ring.position.set(u.x, y + .05, u.z);
    if (u.badge) u.badge.position.set(u.x, y + u.topOff + .45, u.z);
    if (state.selected === u) selRing.position.set(u.x, y + .07, u.z);
    syncTerrainBadge(u, y);
  }
  const TLABEL = {forest: '林', desert: '漠', swamp: '沼', mountain: '山', building: '城', shoal: '滩', cliff: '崖', river: '河', bridge: '桥'}, tbTex = {};
  function terrainBadgeSprite(label) {
    if (typeof document === 'undefined') return null;
    if (!tbTex[label]) {
      const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
      x.fillStyle = 'rgba(30,40,46,.88)'; x.strokeStyle = '#ffe9a8'; x.lineWidth = 5; x.beginPath(); x.roundRect(8, 8, 80, 80, 18); x.fill(); x.stroke();
      x.fillStyle = '#ffe9a8'; x.font = 'bold 54px -apple-system,PingFang SC,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 48, 52);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tbTex[label] = t;
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tbTex[label], depthTest: false, transparent: true})); sp.scale.set(.42, .42, 1); sp.renderOrder = 19; return sp;
  }
  function syncTerrainBadge(u, y) {
    const label = TLABEL[terrainAt(u.cell[0], u.cell[1])];
    if (!state.terrBadges || !label || !state.units) { if (u.tbadge) u.tbadge.visible = false; return; }
    if (!u.tbadge || u.tbadge.userData.label !== label) { if (u.tbadge) scene.remove(u.tbadge); u.tbadge = terrainBadgeSprite(label); if (!u.tbadge) return; u.tbadge.userData.label = label; scene.add(u.tbadge); }
    const a = state.camA, rx = Math.cos(a), rz = -Math.sin(a), cx = Math.sin(a), cz = Math.cos(a);
    u.tbadge.visible = true; u.tbadge.position.set(u.x + rx * .95 + cx * .35, y + .3, u.z + rz * .95 + cz * .35);
  }
  function applyUnits() {
    for (const u of units) {
      u.baseScale = S * state.unitK * (u.spec.k === 'art' ? state.artK : 1) * (state.sizeMode === 1 ? state.clsK[tkey(u)] : 1);
      u.fw = u.msz.x * u.baseScale; u.fl = u.msz.z * u.baseScale;
      if (!u.path) { [u.x, u.z] = standPos(u.cell[0], u.cell[1]); }
      u.baseY = u.path ? u.curY : groundY(u.cell[0], u.cell[1], u);
      u.holder.scale.setScalar(u.baseScale);
      u.holder.rotation.set(0, u.yaw, 0);
      if (u.spec.k === 'art') u.model.setAim(0, state.artElev); else if (u.spec.k === 'tank' && !u.aimLock) u.model.setAim(0, 0);   // 瞄准锁定期间（开火后到下次移动前）保持炮塔朝向，否则每次重绘会把炮塔拉回正前
      u.holder.position.set(u.x, u.baseY, u.z); u.holder.updateMatrixWorld(true);
      u.topOff = new THREE.Box3().setFromObject(u.holder).max.y - u.baseY;
      syncUnit(u);
      if (u.badge) u.badge.visible = state.badges && state.units;
    }
    unitsGroup.visible = state.units;
    refreshBuildings();
    if (state.selected) showHighlights(state.selected);
  }

  // ───────── 选中 / 移动范围 / 移动 ─────────
  const MOVE = {inf: 3, light: 6, medium: 5, heavy: 4, art: 4};       // 移动力（点数）
  const SPEED = {inf: 3.0, light: 5.0, medium: 4.4, heavy: 3.6, art: 3.8};  // 动画速度（单位/秒）
  const tkey = u => u.spec.k === 'tank' ? u.spec.type : u.spec.k;
  const terrainAt = (cx, cz) => bridgeInfo.has(cx + ',' + cz) ? 'bridge' : bldMap.get(cx + ',' + cz)?.type === 'bld_dockyard' ? 'building' : water.typeAt(cx, cz) !== 'land' ? water.typeAt(cx, cz) : bldMap.has(cx + ',' + cz) ? 'building' : mtnSet.has(cx + ',' + cz) ? 'mountain' : SAND_SET.has(cx + ',' + cz) ? 'desert' : SWAMP_SET.has(cx + ',' + cz) ? 'swamp' : forestHas(cx, cz) ? 'forest' : roadSet.has(cx + ',' + cz) ? 'road' : 'plain';
  // 暂定：步兵涉水代价 2（同上山），其余兵种不可进河
  // 水域通行：海、河对陆军不可进（渡河/桥未接入）；浅滩、断崖格对陆军可进，按平地计价
  const costOf = (tk, cx, cz) => { const t = terrainAt(cx, cz); if (t === 'sea') return Infinity; if (t === 'river') return tk === 'inf' ? 2 : Infinity; if (t === 'mountain') return tk === 'inf' ? 2 : Infinity; if (t === 'forest') return tk === 'inf' ? 1 : 2; if (t === 'desert') return tk === 'inf' ? 1 : 2; if (t === 'swamp') return tk === 'inf' ? 2 : 3; return 1; };   // 沙漠 / 沼泽：暂定的减速（沼泽结束回合掉血等规则属于引擎）
  const key = (x, z) => x + ',' + z;
  function reachable(u) {
    const tk = tkey(u), pts = MOVE[tk], start = key(...u.cell);
    const dist = new Map([[start, 0]]), prev = new Map(), occ = new Map();
    for (const o of units) if (o !== u) occ.set(key(...o.cell), o);
    const pq = [[0, u.cell[0], u.cell[1]]];
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]); const [d, x, z] = pq.shift(); if (d > dist.get(key(x, z))) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < MAP.x[0] || nx > MAP.x[1] || nz < MAP.z[0] || nz > MAP.z[1]) continue;
        const c = costOf(tk, nx, nz); if (!isFinite(c)) continue;
        const o = occ.get(key(nx, nz)); if (o && o.spec.team !== u.spec.team) continue;   // 敌人挡路，友军可穿过
        const nd = d + c, k = key(nx, nz); if (nd > pts) continue;
        if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); prev.set(k, [x, z]); pq.push([nd, nx, nz]); }
      }
    }
    return {dist, prev, occ, start, pts};
  }
  const hl = new THREE.Group(); scene.add(hl);
  const hlGeo = new THREE.PlaneGeometry(1.84, 1.84).rotateX(-Math.PI / 2), hlGeoSmall = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2);
  const hlMat = new THREE.MeshBasicMaterial({color: 0x8fe3ff, transparent: true, opacity: .42, depthWrite: false});
  const selRing = new THREE.Mesh(new THREE.RingGeometry(.86, .98, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xffe08a, depthWrite: false}));
  selRing.visible = false; scene.add(selRing);
  function clearHighlights() { for (const o of [...hl.children]) hl.remove(o); }
  function showHighlights(u) {
    clearHighlights(); const R = reachable(u); u.reach = R;
    for (const [k, d] of R.dist) {
      if (k === R.start || R.occ.has(k)) continue;
      const [x, z] = k.split(',').map(Number), mtn = terrainAt(x, z) === 'mountain';
      const m = new THREE.Mesh(mtn ? hlGeoSmall : hlGeo, hlMat); m.position.set(x * 2, groundY(x, z) + (mtn ? .06 : .07), z * 2); m.renderOrder = 5; hl.add(m);
    }
    selRing.visible = true; syncUnit(u);
  }
  function select(u) { if (units.some(o => o.path)) return false; state.selected = u; showHighlights(u); return true; }
  function deselect() { state.selected = null; clearHighlights(); selRing.visible = false; }
  function canMoveTo(u, cell) { const R = u.reach || reachable(u), k = key(cell[0], cell[1]); return R.dist.has(k) && k !== R.start && !R.occ.has(k); }
  function pathTo(u, cell) { const R = u.reach || reachable(u); const out = []; let k = key(cell[0], cell[1]); while (k && k !== R.start) { out.push(k.split(',').map(Number)); const p = R.prev.get(k); k = p ? key(p[0], p[1]) : null; } out.push([...u.cell]); return out.reverse(); }
  function moveTo(u, cell) {
    if (!canMoveTo(u, cell)) return false;
    u.path = pathTo(u, cell); u.dist = 0; u.curY = groundY(u.cell[0], u.cell[1], u);
    clearHighlights(); refreshBuildings(); return true;
  }
  let treeEasing = false;
  function update(dt, camAngle) {
    let moving = false, info = null;
    for (const u of units) {
      if (!u.path) continue; moving = true;
      const px = u.x, pz = u.z, pyaw = u.yaw;
      let spd = SPEED[tkey(u)];
      if (u.actors) {   // 步兵：跑 = 世界速度不变、按脚步节奏换算播放速率；走 = 速度降到走路步幅的 1.6 倍
        const gait = state.infGait, clip = u.actors[0].clip(gait), sc = u.baseScale;
        spd = gait === 'run' ? SPEED.inf : clip.speed * sc * 1.6;
        const rate = Math.min(3, spd / (clip.speed * sc));
        for (const a of u.actors) { if (a.mode !== gait) a.setMode(gait); a.advance(dt, rate); }
      }
      const total = (u.path.length - 1) * 2; u.dist += spd * dt;
      const d = Math.min(u.dist, total), i = Math.min(Math.floor(d / 2), u.path.length - 2), f = (d - i * 2) / 2;
      const a = u.path[i], b = u.path[i + 1];
      const pt = (c, idx) => (idx === 0 || idx === u.path.length - 1) ? standPos(c[0], c[1]) : [c[0] * 2, c[1] * 2];
      const pa = pt(a, i), pb = pt(b, i + 1);
      u.x = pa[0] + (pb[0] - pa[0]) * f; u.z = pa[1] + (pb[1] - pa[1]) * f;
      const ya = groundY(a[0], a[1], u), yb = groundY(b[0], b[1], u); u.curY = ya + (yb - ya) * (f * f * (3 - 2 * f));
      { const bg = bridgeByCell.get(Math.round(u.x / 2) + ',' + Math.round(u.z / 2)), by = bg ? getBridgeSurfaceY(bg, u.x, u.z) : null; if (by !== null) u.curY = by; }   // 行进中走在桥上：逐帧取脚下的真实桥面高度（含桥头斜坡）
      let dy = Math.atan2(b[0] - a[0], b[1] - a[1]) - u.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      u.yaw += Math.max(-10 * dt, Math.min(10 * dt, dy));
      if (u.spec.k === 'tank') {   // 履带：走过的距离换成模型单位；转向时左右差速（yaw 增大 = 向左转 → 右履带多走）
        const ds = Math.hypot(u.x - px, u.z - pz) / u.baseScale, arc = (u.yaw - pyaw) * TRACK_GAUGE[u.spec.type] / 2;
        u.model.advanceMotion(ds - arc, ds + arc); u.aimLock = false;
      }
      if (u.dist >= total) {
        u.cell = [...u.path[u.path.length - 1]]; u.path = null; if (u.actors) for (const a of u.actors) a.setMode(state.infPose); [u.x, u.z] = standPos(u.cell[0], u.cell[1]); u.baseY = groundY(u.cell[0], u.cell[1], u); refreshBuildings();
        if (state.selected === u) deselect();
      }
      syncUnit(u);
    }
    for (const u of units) if (u.actors) for (const a of u.actors) if (a.update(dt)) moving = true;   // 步兵开火动画
    for (const u of units) if (u.spec.k === 'tank') {                                                      // 坦克：排队的炮击逐发开，特效播放期间保持渲染
      const m = u.model; if ((u.fireQ | 0) <= 0 && !m.fireState().active) continue;
      if ((u.fireQ | 0) > 0 && !m.fireState().active && m.fire()) u.fireQ--;
      m.updateFire(dt); if (m.fireState().active || u.fireQ > 0) moving = true;
    }
    { const k = 1 - Math.exp(-12 * dt);
      for (const b of buildings) {
        let ch = false;
        for (const nd of b.acc) {
          const d = nd.userData, ex = d.tgt[0] - d.cur[0], ez = d.tgt[1] - d.cur[1];
          if (Math.abs(ex) + Math.abs(ez) > .004) { d.cur[0] += ex * k; d.cur[1] += ez * k; moving = true; } else { d.cur[0] = d.tgt[0]; d.cur[1] = d.tgt[1]; }
          if (nd.position.x !== d.cur[0] || nd.position.z !== d.cur[1]) { nd.position.set(d.cur[0], 0, d.cur[1]); ch = true; }
        }
        if (ch) syncBuildingPerformance(b.visual);   // 性能版：部件 Group 位置变了要同步（只在真的变化的帧）
      }
    }
    if (moving || treeEasing) { info = refreshTrees(camAngle, dt); treeEasing = info.easing; if (treeEasing) moving = true; }
    return {moving, info};
  }
  // 屏幕射线 → 格坐标（山格用站位面高度再求一次）
  const plane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
  function cellFromRay(ray) {
    if (!ray.intersectPlane(plane0, _hit)) return null;
    let cx = Math.round(_hit.x / 2), cz = Math.round(_hit.z / 2);
    const py = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MTN_STAND * state.mtnK);
    if (ray.intersectPlane(py, _hit)) { const mx = Math.round(_hit.x / 2), mz = Math.round(_hit.z / 2); if (terrainAt(mx, mz) === 'mountain') { cx = mx; cz = mz; } }
    return [cx, cz];
  }

  // 待机动画（整单位微动，不改几何）：步兵呼吸/重心/转头，坦克怠速抖动+炮塔缓扫，火炮炮管微摆
  function animate(t) {
    if (!state.idle) return;
    for (const u of units) {
      if (u.path) continue;
      const ph = u.phase, h = u.holder, k = u.spec.k;
      if (k === 'inf') {
        const b = 1 + .008 * Math.sin(t * 2.2 + ph);
        h.scale.set(u.baseScale, u.baseScale * b, u.baseScale);
        h.rotation.z = .012 * Math.sin(t * .9 + ph);
        h.rotation.y = u.yaw + .05 * Math.sin(t * .35 + ph);
        h.position.y = u.baseY;
      } else if (k === 'tank') {
        if (!u.aimLock) u.model.setAim(9 * Math.sin(t * .45 + ph), 0);   // 只缓扫炮塔；整车不再抖动（动画包的既定决定）
      } else {
        h.position.y = u.baseY + .006 * (1 + Math.sin(t * 11 + ph)) + .003 * (1 + Math.sin(t * 17 + ph * 2));  // 火炮：只向上抖，不陷进地面
        if (false) {} else u.model.setAim(6 * Math.sin(t * .4 + ph), state.artElev + 1.5 * Math.sin(t * .8 + ph));
      }
    }
  }

  // 单位级视锥剔除 + 网格级视锥剔除开关
  const _f = new THREE.Frustum(), _m = new THREE.Matrix4(), _s = new THREE.Sphere();
  let meshCulling = true;
  function setMeshCulling(flag) {
    if (flag === meshCulling) return; meshCulling = flag;
    scene.traverse(o => { if (o.isMesh) o.frustumCulled = flag; });
  }
  function cull(camera) {
    setMeshCulling(state.cull);
    if (!state.cull) { for (const u of units) u.holder.visible = state.units; return {inView: units.length, total: units.length}; }
    camera.updateMatrixWorld();
    _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _f.setFromProjectionMatrix(_m);
    let n = 0;
    for (const u of units) {
      _s.center.set(u.holder.position.x, u.holder.position.y + .9, u.holder.position.z); _s.radius = CULL_R;
      const vis = _f.intersectsSphere(_s); u.holder.visible = state.units && vis; if (vis) n++;
    }
    return {inView: n, total: units.length};
  }

  // 树：林间空地（单位脚下让位）；默认"挤开"。55°俯视不存在镜头前方遮挡，所以没有前方让位
  const fadeMat = MAT_TERRAIN.clone(); fadeMat.transparent = true; fadeMat.opacity = .3; fadeMat.depthWrite = false;
  function setTreeMat(t, fade) {
    if (t.faded === fade) return; t.faded = fade;
    t.obj.traverse(m => { if (m.isMesh) m.material = fade ? fadeMat : MAT_TERRAIN; });
  }
  // 树林合批（树林包性能版）：树静止时把"不透明、没被隐藏"的树按 3×3 地块分块合成少量 Mesh；
  // 有树在挤开缓动、或树被隐藏 / 变半透明时，签名变化就重建；缓动期间回到逐棵实时。半透明的树始终逐棵显示（材质不同，不进合批）。
  const forest = {region: null, sig: ''};
  function rebuildForest() {
    if (forest.region) { scene.remove(forest.region); disposeForest(forest.region); }
    const records = trees.filter(t => !t.hidden && !t.faded).map(t => ({kind: t.kind, variant: t.v, seed: t.sd, position: [t.cx, 0, t.cz], yaw: t.yaw}));
    forest.region = createForestRegion(records, {batchSpan: 3}); scene.add(forest.region);
  }
  function refreshTrees(camAngle, dt = 1) {
    const dx = Math.sin(camAngle), dz = Math.cos(camAngle), mode = state.treeMode;
    let cleared = 0, yielded = 0, faded = 0, moved = 0, easing = false;
    const k = dt >= 1 ? 1 : 1 - Math.exp(-14 * dt);
    for (const t of trees) {
      let st = 0, px = t.x, pz = t.z;   // st: 0 正常  1 隐藏  2 缩小  3 半透明
      if (state.units) for (const u of units) {
        const vx = t.x - u.x, vz = t.z - u.z;
        if (mode === 0) {
          if (Math.hypot(vx, vz) < 1.0) { st = 1; break; }
          continue;
        }
        const c = Math.cos(u.yaw), s2 = Math.sin(u.yaw), lx = vx * c - vz * s2, lz = vx * s2 + vz * c;
        const hx = u.fw / 2 + TRUNK_R + .06, hz = u.fl / 2 + TRUNK_R + .06;      // 只看树干：树冠可以盖住单位
        if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
        if (mode === 2) { st = 3; continue; }
        // 挤开：候选 = 推到侧边 / 推到前后端；优先选仍在本格内、位移最小的
        const sx = lx >= 0 ? 1 : -1, sz = lz >= 0 ? 1 : -1;
        const cands = [[sx * hx * 1.02, lz], [lx, sz * hz * 1.02]].map(([a, b]) => {
          const wx = u.x + a * c + b * s2, wz = u.z - a * s2 + b * c;
          return {wx, wz, d: Math.hypot(wx - t.x, wz - t.z), inCell: Math.abs(wx - t.hcx * 2) <= 1.05 && Math.abs(wz - t.hcz * 2) <= 1.05};
        });
        cands.sort((p1, p2) => (p2.inCell - p1.inCell) || (p1.d - p2.d));
        px = cands[0].wx; pz = cands[0].wz; moved++; break;
      }
      t.cx += (px - t.cx) * k; t.cz += (pz - t.cz) * k;
      if (Math.abs(px - t.cx) > .004 || Math.abs(pz - t.cz) > .004) easing = true; else { t.cx = px; t.cz = pz; }
      const o = t.obj; o.position.x = t.cx; o.position.z = t.cz;
      setTreeMat(t, st === 3);
      t.hidden = st === 1;
      if (st === 1) { o.visible = false; cleared++; }
      else { o.visible = true; o.scale.set(1, state.treeK, 1); if (st === 3) faded++; }
    }
    if (easing) { if (forest.region) forest.region.visible = false; }   // 缓动中：逐棵实时
    else {
      const sig = trees.map(t => t.hidden ? 'h' : t.faded ? 'f' : t.cx.toFixed(3) + ',' + t.cz.toFixed(3)).join('|');
      if (!forest.region || sig !== forest.sig) { rebuildForest(); forest.sig = sig; }
      forest.region.visible = true; forest.region.scale.set(1, state.treeK, 1);   // 树高滑条：对整片区域沿 y 缩放（树根在 y=0，与逐棵的 scale.set(1,k,1) 等价）
      for (const t of trees) t.obj.visible = t.faded && !t.hidden;               // 合批后只有半透明的树保持逐棵显示
    }
    return {cleared, yielded, faded, moved, easing};
  }

  const api = {
    scene, units, trees, state, mountain, water, sunFollow, setShadowRadius, preset: mapPreset, get ground() { return ground; }, rings, groundY,
    TREE_LABELS, SIZE_LABELS, cycleOwner, setInfPose, fireInfantry, buildings, bldMap, animate, cull, update, select, deselect, canMoveTo, moveTo, cellFromRay, reachable, tkey, MOVE,
    beforeRender() { syncInfantryBatches(); },   // 渲染前：把反坦克兵占位的世界变换同步给批量绘制
    apply(camAngle) { state.camA = camAngle; state.viewQuarter = (((Math.round((camAngle - .08 * Math.PI) / (Math.PI / 2))) % 4) + 4) % 4; if (state.sandbox !== lastSand || state.mtnK !== lastMtnK || state.floorTint !== lastTint) rebuildBoard(); syncMountains(); applyUnits(); rings.visible = state.rings && state.units; return refreshTrees(camAngle); },
    stats() {
      const visTri = o => { let n = 0; o.traverseVisible(m => { if (m.isMesh) { const g = m.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(n); };
      const t = {buildings: buildings.reduce((n, b) => n + visTri(b.visual), 0), ground: triCount(ground), water: visTri(water.group), bridges: triCount(bridgeGroup), infantry: infantryTriCount(), roads: triCount(roads), desert: sand ? triCount(sand) : 0, swamp: marsh ? triCount(marsh) : 0, mountain: triCount(mountain), trees: trees.reduce((n, x) => n + visTri(x.obj), 0) + (forest.region ? visTri(forest.region) : 0), units: units.reduce((n, u) => n + u.tris, 0)};
      t.total = t.buildings + t.ground + t.water + t.bridges + t.infantry + t.roads + t.desert + t.swamp + t.mountain + t.trees + t.units; return t;
    }
  };
  api.apply(0.08 * Math.PI);
  return api;
}
