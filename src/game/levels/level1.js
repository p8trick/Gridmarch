import {planWater, validateLayout} from '../map-builder.js';

// 第一关「湖畔对峙」：20×12，红蓝左右镜像（x → -1-x），中央一片湖。
// 固定的部分：总部 / 兵工厂 / 城市的位置、湖的位置。
// 随机的部分（由 seed 决定，同一个 seed 永远生成同一张图）：公路走向、山脉、沙漠、沼泽、树林。
// 随机只在西半边（蓝方）生成，再镜像到东半边，所以双方地形完全对称、公平。
// 单位不在这里：开局单位、生产由规则引擎负责。
const key = (x, z) => x + ',' + z;
const rect = (x0, x1, z0, z1) => { const o = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) o.push([x, z]); return o; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const mir = x => -1 - x;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const LEVEL1 = {x: [-10, 9], z: [-6, 5], lake: rect(-2, 1, -1, 0)};

// 西半边（蓝方）建筑；东半边镜像生成（蓝↔红，中立不变）
const WEST_BUILDINGS = [
  {type: 'bld_hq', cell: [-9, -1], owner: 'blue', name: '蓝总部'},
  {type: 'bld_factory', cell: [-8, -2], owner: 'blue', name: '蓝兵工厂'},
  {type: 'bld_factory', cell: [-8, 0], owner: 'blue', name: '蓝兵工厂'},
  {type: 'bld_city_large', cell: [-4, 3], owner: 'neutral', name: '大城市'},
  {type: 'bld_city_small', cell: [-6, -4], owner: 'neutral', name: '小城市'},
  {type: 'bld_city_small', cell: [-2, -4], owner: 'neutral', name: '小城市'},
  {type: 'bld_city_small', cell: [-7, 4], owner: 'neutral', name: '小城市'},
];
const ROAD_START = [-8, -1];          // 总部正东、两座兵工厂之间：三者都挨着这一格
const CROSS_N = -3, CROSS_S = 2;      // 公路穿过镜像中线（x=-1 与 x=0 相接）的两个行号：湖的北侧与南侧各一条

function build(seed, attempt) {
  const rnd = mulberry32(seed * 7919 + attempt * 104729 + 13);
  const [X0, X1] = LEVEL1.x, [Z0, Z1] = LEVEL1.z, board = rect(X0, X1, Z0, Z1);
  const lake = new Set(LEVEL1.lake.map(c => key(...c)));
  const preset = {
    name: '第一关·湖畔对峙', x: [X0, X1], z: [Z0, Z1], seed: 7, levelSeed: seed,
    topology: {   // 湖：整片内陆水域交给 MT2 海岸规划，西岸浅滩、东岸断崖；棋盘外补一圈陆地占格，避免把棋盘裁切边当成海岸
      coastType: 'mixed', typeForCell: x => x < 0 ? 'shoal' : 'cliff',
      land: board.filter(c => !lake.has(key(...c))),
      outside: [...rect(X0 - 1, X0 - 1, Z0 - 1, Z1 + 1), ...rect(X1 + 1, X1 + 1, Z0 - 1, Z1 + 1), ...rect(X0, X1, Z0 - 1, Z0 - 1), ...rect(X0, X1, Z1 + 1, Z1 + 1)],
    },
    layout: {mountain: [], desert: [], swamp: [], roads: [], forest: {x: [0, -1], z: [0, -1]}, forestExtra: [], buildings: [], units: []},
  };
  const plan = planWater(preset);
  const isLand = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1 && plan.type.get(key(x, z)) === 'land';
  const west = (x, z) => x <= -1 && isLand(x, z);

  const bld = new Set(WEST_BUILDINGS.map(b => key(...b.cell)));
  const apron = new Set();   // 基地周围一圈保持空旷（出兵、转向的余地）：不长山、不长树
  for (const b of WEST_BUILDINGS) if (b.owner === 'blue') for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) apron.add(key(b.cell[0] + dx, b.cell[1] + dz));
  const nearBld = (x, z) => N4.some(([dx, dz]) => bld.has(key(x + dx, z + dz)));

  // ── 公路：带噪声和转弯惩罚的最短路，得到自然的弯曲而不是死直线 ──
  const noise = new Map(), nz = (x, z) => { const k = key(x, z); if (!noise.has(k)) noise.set(k, rnd() * 1.3); return noise.get(k); };
  function route(starts, goal) {
    const best = new Map(), prev = new Map(), pq = [];
    for (const [x, z] of starts) { best.set(key(x, z) + '|-1', 0); pq.push([0, x, z, -1]); }
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, x, z, dir] = pq.shift(), sk = key(x, z) + '|' + dir;
      if (d > best.get(sk)) continue;
      if (goal(x, z)) { const out = []; let k = sk; while (k) { const [c] = k.split('|'); out.push(c.split(',').map(Number)); k = prev.get(k); } return out; }
      for (let i = 0; i < 4; i++) {
        const nx = x + N4[i][0], nzz = z + N4[i][1];
        if (!west(nx, nzz) || bld.has(key(nx, nzz))) continue;
        const nd = d + 1 + nz(nx, nzz) + (dir >= 0 && dir !== i ? .35 : 0), nk = key(nx, nzz) + '|' + i;
        if (nd < (best.get(nk) ?? 1e9)) { best.set(nk, nd); prev.set(nk, sk); pq.push([nd, nx, nzz, i]); }
      }
    }
    return null;
  }
  const road = new Set([key(...ROAD_START)]);
  const addPath = p => { if (!p) throw Error('公路寻路失败'); for (const c of p) road.add(key(...c)); };
  addPath(route([ROAD_START], (x, z) => x === -1 && z === CROSS_N));
  addPath(route([ROAD_START], (x, z) => x === -1 && z === CROSS_S));
  for (const b of WEST_BUILDINGS) {   // 每座建筑都要有公路挨着：没有就拉一条支路接到最近的路上
    const [cx, cz] = b.cell, nbrs = N4.map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => west(x, z) && !bld.has(key(x, z)));
    if (nbrs.some(c => road.has(key(...c)))) continue;
    addPath(route(nbrs, (x, z) => road.has(key(x, z))));
  }

  // ── 山、树：随机游走长出成片的簇，只在西半边 ──
  const mountain = new Set(), desert = new Set(), swamp = new Set(), forest = new Set(), forestSingle = new Set();
  const free = (x, z) => west(x, z) && !bld.has(key(x, z)) && !road.has(key(x, z)) && !apron.has(key(x, z)) && !nearBld(x, z) && !mountain.has(key(x, z)) && !desert.has(key(x, z)) && !swamp.has(key(x, z)) && !forest.has(key(x, z)) && !forestSingle.has(key(x, z));
  const pool = () => board.filter(([x, z]) => free(x, z));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  function cluster(set, size, ok = () => true) {
    const cand = pool().filter(([x, z]) => ok(x, z)), start = pick(cand); if (!start) return [];
    const got = [start]; set.add(key(...start));
    for (let guard = 0; got.length < size && guard < 60; guard++) {
      const [x, z] = pick(got), [dx, dz] = pick(N4), nx = x + dx, nzz = z + dz;
      if (free(nx, nzz) && ok(nx, nzz)) { got.push([nx, nzz]); set.add(key(nx, nzz)); }
    }
    return got;
  }
  // 山不能把地面部队的路彻底堵死：非山、非水的格子（含镜像后的整张棋盘）必须保持连成一片
  const connected = () => {
    const cells = board.filter(c => { const [x, z] = c; return x >= -10 && plan.type.get(key(x, z)) !== 'sea' && !(mountain.has(key(x, z)) || mountain.has(key(mir(x), z))); });
    if (!cells.length) return false;
    const seen = new Set([key(...cells[0])]), st = [cells[0]], ok = new Set(cells.map(c => key(...c)));
    while (st.length) { const [x, z] = st.pop(); for (const [dx, dz] of N4) { const k = key(x + dx, z + dz); if (ok.has(k) && !seen.has(k)) { seen.add(k); st.push([x + dx, z + dz]); } } }
    return seen.size === ok.size;
  };
  for (let n = 0; n < 4; n++) {
    const snap = new Set(mountain); cluster(mountain, 2 + Math.floor(rnd() * 4), (x, z) => x > X0 && z > Z0 && z < Z1);   // 山不贴着棋盘外缘长
    if (!connected()) { mountain.clear(); for (const k of snap) mountain.add(k); }
  }
  // 沙漠 / 沼泽：整格自带地表的地块，要离湖岸和棋盘外缘远一点（接缝只和草格相接），各一片
  const calm = (x, z) => x > X0 && z > Z0 && z < Z1 && [-1, 0, 1].every(dx => [-1, 0, 1].every(dz => plan.type.get(key(x + dx, z + dz)) === 'land'));
  cluster(desert, 5 + Math.floor(rnd() * 4), calm);
  cluster(swamp, 4 + Math.floor(rnd() * 3), calm);
  for (let n = 0; n < 5; n++) cluster(forest, 3 + Math.floor(rnd() * 5));
  for (let n = 0; n < 3; n++) { const c = pick(pool()); if (c) forestSingle.add(key(...c)); }   // 孤立的单格树林（2–3 棵树）

  // ── 镜像到东半边，装配布局 ──
  const mirrorCells = set => [...set].flatMap(k => { const [x, z] = k.split(',').map(Number); return [[x, z], [mir(x), z]]; });
  const L = preset.layout;
  L.roads = mirrorCells(road); L.mountain = mirrorCells(mountain); L.desert = mirrorCells(desert); L.swamp = mirrorCells(swamp); L.forestExtra = mirrorCells(new Set([...forest, ...forestSingle]));
  L.buildings = WEST_BUILDINGS.flatMap(b => b.owner === 'neutral' ? [b, {...b, cell: [mir(b.cell[0]), b.cell[1]]}]
    : [b, {...b, cell: [mir(b.cell[0]), b.cell[1]], owner: 'red', name: b.name.replace('蓝', '红')}]);
  // 去重（中线两侧各自的路 / 树不会重复，但保险）
  const uniq = a => { const s = new Set(); return a.filter(c => !s.has(key(...c)) && s.add(key(...c))); };
  L.roads = uniq(L.roads); L.mountain = uniq(L.mountain); L.desert = uniq(L.desert); L.swamp = uniq(L.swamp); L.forestExtra = uniq(L.forestExtra);
  preset.stats = {roads: L.roads.length, mountain: L.mountain.length, desert: L.desert.length, swamp: L.swamp.length, forest: L.forestExtra.length, buildings: L.buildings.length};
  if (L.mountain.length < 10 || L.forestExtra.length < 14 || desert.size < 4 || swamp.size < 4) throw Error('随机结果太稀疏，重试');
  validateLayout(preset);
  return preset;
}

// seed 相同则地图相同；个别 seed 随机结果不合格（山堵路、太稀疏）会自动换一次随机再试
export function makeLevel1(seed = 1) {
  let err;
  for (let attempt = 0; attempt < 30; attempt++) { try { return build(seed, attempt); } catch (e) { err = e; } }
  throw err;
}
