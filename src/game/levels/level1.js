import {planWater, validateLayout} from '../map-builder.js';

// 第一关：20×12，红蓝左右镜像（x → -1-x）。蓝方在西，红方在东。
// 一切都由 seed 决定（同一个 seed 永远生成同一张图），不同 seed 的图差别很大：
//   · 水域：中央大湖（大小不同）/ 不规则湖 / 左右各一池 / 没有湖；湖上有时横跨一座跨海桥
//   · 河流：每一侧可能有一条竖向小河，河上一座公路桥
//   · 基地行号、城市位置、公路走向、山、沙漠、沼泽、树林
// 随机只在西半边（蓝方）生成，再镜像到东半边，所以双方地形完全对称、公平。
// 单位不在这里：开局单位、生产由规则引擎负责。
const key = (x, z) => x + ',' + z;
const rect = (x0, x1, z0, z1) => { const o = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) o.push([x, z]); return o; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const mir = x => -1 - x;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const LEVEL1 = {x: [-10, 9], z: [-6, 5]};

function build(seed, attempt) {
  const rnd = mulberry32(seed * 7919 + attempt * 104729 + 13);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = arr => arr[Math.floor(rnd() * arr.length)];
  const [X0, X1] = LEVEL1.x, [Z0, Z1] = LEVEL1.z, board = rect(X0, X1, Z0, Z1);

  // ── 蓝方基地（西缘）：总部行号随机；两座兵工厂在它上下，三者共用正东那一格公路 ──
  const hz = ri(-3, 1), roadStart = [-8, hz];
  const WEST = [
    {type: 'bld_hq', cell: [-9, hz], owner: 'blue', name: '蓝总部'},
    {type: 'bld_factory', cell: [-8, hz - 1], owner: 'blue', name: '蓝兵工厂'},
    {type: 'bld_factory', cell: [-8, hz + 1], owner: 'blue', name: '蓝兵工厂'},
  ];
  const apron = new Set();   // 基地周围一圈保持空旷（出兵、转向的余地）：不长山、不长树、不挖水
  for (const b of WEST) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) apron.add(key(b.cell[0] + dx, b.cell[1] + dz));

  // ── 水域：湖（海岸交给 MT2 规划，西岸浅滩、东岸断崖）──
  const sea = new Set(), addSea = (x, z) => { sea.add(key(x, z)); sea.add(key(mir(x), z)); };
  const r0 = rnd(), lakeKind = r0 < .40 ? 'rect' : r0 < .65 ? 'blob' : r0 < .85 ? 'twin' : 'none';
  let rectInfo = null;
  if (lakeKind === 'rect') {   // 居中的矩形湖：半宽 2–3，高 2–3
    const a = ri(2, 3), H = ri(2, 3), zt = H === 2 ? ri(-2, 0) : ri(-2, -1);
    for (let x = -a; x <= -1; x++) for (let z = zt; z < zt + H; z++) addSea(x, z);
    rectInfo = {a, H, zt};
  } else if (lakeKind === 'blob') {   // 不规则湖：从中线上一格长出来，左右镜像连成一片
    const zc = ri(-2, 0), cells = [[-1, zc]], target = ri(4, 7);
    for (let g = 0; cells.length < target && g < 80; g++) {
      const [x, z] = pick(cells), [dx, dz] = pick(N4), nx = x + dx, nz = z + dz;
      if (nx >= -4 && nx <= -1 && nz >= -3 && nz <= 1 && !cells.some(c => c[0] === nx && c[1] === nz)) cells.push([nx, nz]);
    }
    cells.forEach(([x, z]) => addSea(x, z));
  } else if (lakeKind === 'twin') {   // 中线两侧各一池（互不相连）
    const w = ri(2, 3), h = ri(2, 3), x0 = ri(-6, -3 - w + 1), z0 = ri(-4, 1);
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + h; z++) addSea(x, z);
  }
  const outside = [...rect(X0 - 1, X0 - 1, Z0 - 1, Z1 + 1), ...rect(X1 + 1, X1 + 1, Z0 - 1, Z1 + 1), ...rect(X0, X1, Z0 - 1, Z0 - 1), ...rect(X0, X1, Z1 + 1, Z1 + 1)];
  const preset = {
    name: '第一关', x: [X0, X1], z: [Z0, Z1], seed: 7, levelSeed: seed,
    topology: {coastType: 'mixed', typeForCell: x => x < 0 ? 'shoal' : 'cliff', land: board.filter(c => !sea.has(key(...c))), outside},
    layout: {mountain: [], desert: [], swamp: [], roads: [], forest: {x: [0, -1], z: [0, -1]}, forestExtra: [], buildings: [], units: []},
    bridges: [],
  };
  let plan = planWater(preset);
  const isLand = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1 && plan.type.get(key(x, z)) === 'land';
  const west = (x, z) => x <= -1 && isLand(x, z);
  const bld = new Set(WEST.map(b => key(...b.cell)));
  for (const b of WEST) if (!west(...b.cell)) throw Error('基地被水占了');

  // ── 河：西半边一条竖向小河（带一点弯），中间一段笔直处架公路桥；整条河离海岸、棋盘外缘、基地都要有距离 ──
  const river = []; let bridgeA = null;
  if (rnd() < .75) for (let tries = 0; tries < 12 && !river.length; tries++) {   // 河的位置不合适（碰到水岸 / 基地）就换一条再试
    const x0 = ri(-6, -4), len = ri(6, 8), z0 = ri(-5, 4 - len + 1);
    let x = x0, z = z0; river.push([x, z]);
    while (river.length < len) {
      const dx = rnd() < .25 ? pick([-1, 1]) : 0;
      if (dx && x + dx >= -6 && x + dx <= -4) { x += dx; } else z++;
      river.push([x, z]);
    }
    const inR = new Set(river.map(c => key(...c)));
    const ok = river.every(([x, z]) => z > Z0 && z < Z1 && x > X0 && !apron.has(key(x, z)) && N8.every(([a, b]) => { const k = key(x + a, z + b); return inR.has(k) || (plan.type.get(k) === 'land' && !bld.has(k)); }));
    const straight = river.map((c, i) => i > 0 && i < river.length - 1 && river[i - 1][0] === c[0] && river[i + 1][0] === c[0] && river[i - 1][1] !== river[i + 1][1] && isLand(c[0] - 1, c[1]) && isLand(c[0] + 1, c[1]) && !inR.has(key(c[0] - 1, c[1])) && !inR.has(key(c[0] + 1, c[1])) ? i : -1).filter(i => i >= 0);
    if (ok && straight.length) { bridgeA = river[pick(straight)]; } else river.length = 0;
  }
  const riverSet = new Set(river.map(c => key(...c)));
  const bridgeKey = bridgeA ? key(...bridgeA) : null;

  // ── 跨海桥：只有矩形湖，且湖的左右两岸在桥那一行都是"直岸"时才架（桥头要落在直岸上）──
  let bridgeB = null;
  if (rectInfo && rnd() < .85) {
    const {a, H, zt} = rectInfo, rows = rect(0, 0, zt, zt + H - 1).map(c => c[1]).sort(() => rnd() - .5);
    for (const r of rows) {
      const hw = plan.topo.recordAt(-a - 1, r), he = plan.topo.recordAt(a, r);
      if (hw.kind === 'straight' && he.kind === 'straight' && isLand(-a - 2, r) && isLand(a + 1, r)) { bridgeB = {row: r, a, cells: rect(-a - 1, a, r, r)}; break; }
    }
  }

  // ── 城市：随机位置，彼此 ≥3 格、离基地 ≥3 格；1 座大城市 + 3 座小城市（镜像后共 2 + 6）──
  const cityCells = [];
  const farFrom = (x, z, list, d) => list.every(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - z)) >= d);
  const cityOk = (x, z) => x <= -2 && west(x, z) && !apron.has(key(x, z)) && !riverSet.has(key(x, z)) && N4.every(([dx, dz]) => !riverSet.has(key(x + dx, z + dz))) &&
    farFrom(x, z, WEST.map(b => b.cell), 3) && farFrom(x, z, cityCells, 3) && !(bridgeB && Math.abs(z - bridgeB.row) <= 1 && x >= -bridgeB.a - 3);
  const placeCity = type => {
    for (let t = 0; t < 300; t++) { const x = ri(-7, -2), z = ri(-5, 4); if (cityOk(x, z)) { cityCells.push([x, z]); WEST.push({type, cell: [x, z], owner: 'neutral', name: type === 'bld_city_large' ? '大城市' : '小城市'}); bld.add(key(x, z)); return; } }
    throw Error('放不下城市');
  };
  placeCity('bld_city_large'); for (let i = 0; i < 3; i++) placeCity('bld_city_small');

  // ── 公路：带噪声和转弯惩罚的最短路，得到自然的弯曲；河格不可走，只有桥格可以 ──
  const noise = new Map(), nz = (x, z) => { const k = key(x, z); if (!noise.has(k)) noise.set(k, rnd() * 1.3); return noise.get(k); };
  const passable = (x, z) => west(x, z) && !bld.has(key(x, z)) && (!riverSet.has(key(x, z)) || key(x, z) === bridgeKey);
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
        if (!passable(nx, nzz)) continue;
        const nd = d + 1 + nz(nx, nzz) + (dir >= 0 && dir !== i ? .35 : 0), nk = key(nx, nzz) + '|' + i;
        if (nd < (best.get(nk) ?? 1e9)) { best.set(nk, nd); prev.set(nk, sk); pq.push([nd, nx, nzz, i]); }
      }
    }
    return null;
  }
  const road = new Set([key(...roadStart)]);
  const addPath = p => { if (!p) throw Error('公路寻路失败'); for (const c of p) road.add(key(...c)); };
  // 两条贯穿中线的干线（x=-1 与镜像的 x=0 相接）：一条走北侧、一条走南侧，行号随机
  const crossRows = z => west(-1, z) && !bld.has(key(-1, z)) && !riverSet.has(key(-1, z));
  const north = rect(0, 0, Z0 + 1, -2).map(c => c[1]).filter(crossRows), south = rect(0, 0, 1, Z1 - 1).map(c => c[1]).filter(crossRows);
  if (!north.length || !south.length) throw Error('没有可通过中线的行');
  const zN = pick(north), zS = pick(south);
  addPath(route([roadStart], (x, z) => x === -1 && z === zN));
  addPath(route([roadStart], (x, z) => x === -1 && z === zS));
  const sideRoads = [];   // 桥两端必须有路接上
  if (bridgeA) sideRoads.push([bridgeA[0] - 1, bridgeA[1]], [bridgeA[0] + 1, bridgeA[1]]);
  if (bridgeB) sideRoads.push([-bridgeB.a - 2, bridgeB.row]);
  const pending = new Set(sideRoads.map(c => key(...c)));
  for (const c of sideRoads) {
    road.add(key(...c));
    if (N4.some(([dx, dz]) => { const k = key(c[0] + dx, c[1] + dz); return road.has(k) && !pending.has(k) && k !== bridgeKey; })) { pending.delete(key(...c)); continue; }
    addPath(route([c], (x, z) => road.has(key(x, z)) && !pending.has(key(x, z)) && !(x === c[0] && z === c[1]) && key(x, z) !== bridgeKey)); pending.delete(key(...c));
  }
  for (const b of WEST) {   // 每座建筑都要有公路挨着：没有就拉一条支路接到最近的路上
    const [cx, cz] = b.cell, nbrs = N4.map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => passable(x, z) && key(x, z) !== bridgeKey);
    if (nbrs.some(c => road.has(key(...c)))) continue;
    addPath(route(nbrs, (x, z) => road.has(key(x, z)) && key(x, z) !== bridgeKey));
  }
  if (bridgeKey) road.delete(bridgeKey);   // 桥格的路面由桥模型负责

  // ── 山、沙漠、沼泽、树：随机游走长出成片的簇，只在西半边 ──
  const mountain = new Set(), desert = new Set(), swamp = new Set(), forest = new Set(), forestSingle = new Set();
  const nearBld = (x, z) => N4.some(([dx, dz]) => bld.has(key(x + dx, z + dz)));
  const nearRiver = (x, z) => N8.some(([dx, dz]) => riverSet.has(key(x + dx, z + dz)));
  const taken = k => mountain.has(k) || desert.has(k) || swamp.has(k) || forest.has(k) || forestSingle.has(k);
  const free = (x, z) => west(x, z) && !bld.has(key(x, z)) && !road.has(key(x, z)) && !apron.has(key(x, z)) && !riverSet.has(key(x, z)) && !nearBld(x, z) && !taken(key(x, z));
  const pool = () => board.filter(([x, z]) => free(x, z));
  function cluster(set, size, ok = () => true) {
    const cand = pool().filter(([x, z]) => ok(x, z)), start = pick(cand); if (!start) return [];
    const got = [start]; set.add(key(...start));
    for (let guard = 0; got.length < size && guard < 60; guard++) {
      const [x, z] = pick(got), [dx, dz] = pick(N4), nx = x + dx, nzz = z + dz;
      if (free(nx, nzz) && ok(nx, nzz)) { got.push([nx, nzz]); set.add(key(nx, nzz)); }
    }
    return got;
  }
  // 至少长出 min 格：起点选在太挤的地方长不够，就撤销换个起点再试
  function clusterMin(set, size, min, ok) {
    for (let t = 0; t < 12; t++) { const got = cluster(set, size, ok); if (got.length >= min) return true; got.forEach(c => set.delete(key(...c))); }
    return false;
  }
  // 山不能把地面部队的路彻底堵死：非山、非水、非河的格子（含镜像后的整张棋盘；河上只有桥格能走）必须保持连成一片
  const mirrorOf = k => { const [x, z] = k.split(',').map(Number); return key(mir(x), z); };
  const connected = () => {
    const blocked = k => plan.type.get(k) === 'sea' || ((riverSet.has(k) || riverSet.has(mirrorOf(k))) && k !== bridgeKey && k !== mirrorOf(bridgeKey || '0,0')) || mountain.has(k) || mountain.has(mirrorOf(k));
    const cells = board.map(c => key(...c)).filter(k => !blocked(k) && !['shoal', 'cliff'].includes(plan.type.get(k)) === true || (!blocked(k) && ['shoal', 'cliff'].includes(plan.type.get(k))));
    if (!cells.length) return false;
    const ok = new Set(cells), seen = new Set([cells[0]]), st = [cells[0]];
    while (st.length) { const [x, z] = st.pop().split(',').map(Number); for (const [dx, dz] of N4) { const k = key(x + dx, z + dz); if (ok.has(k) && !seen.has(k)) { seen.add(k); st.push(k); } } }
    return seen.size === ok.size;
  };
  // 沙漠 / 沼泽：整格自带地表的地块，要离水岸、河、棋盘外缘远一点（接缝只和草格相接），各一片
  const calm = (x, z) => x > X0 && z > Z0 && z < Z1 && !nearRiver(x, z) && N8.concat([[0, 0]]).every(([dx, dz]) => plan.type.get(key(x + dx, z + dz)) === 'land');
  clusterMin(desert, 5 + Math.floor(rnd() * 4), 4, calm);
  clusterMin(swamp, 4 + Math.floor(rnd() * 3), 4, calm);
  for (let n = 0; n < 4; n++) {
    const snap = new Set(mountain); cluster(mountain, 2 + Math.floor(rnd() * 4), (x, z) => x > X0 && z > Z0 && z < Z1);   // 山不贴着棋盘外缘长
    if (!connected()) { mountain.clear(); for (const k of snap) mountain.add(k); }
  }
  for (let n = 0; n < 5; n++) cluster(forest, 3 + Math.floor(rnd() * 5));
  for (let n = 0; n < 3; n++) { const c = pick(pool()); if (c) forestSingle.add(key(...c)); }   // 孤立的单格树林（2–3 棵树）

  // ── 镜像到东半边，装配布局 ──
  const mirrorCells = set => [...set].flatMap(k => { const [x, z] = k.split(',').map(Number); return [[x, z], [mir(x), z]]; });
  const uniq = a => { const s = new Set(); return a.filter(c => !s.has(key(...c)) && s.add(key(...c))); };
  const L = preset.layout;
  L.roads = uniq(mirrorCells(road)); L.mountain = uniq(mirrorCells(mountain)); L.desert = uniq(mirrorCells(desert)); L.swamp = uniq(mirrorCells(swamp));
  L.forestExtra = uniq(mirrorCells(new Set([...forest, ...forestSingle])));
  L.buildings = WEST.flatMap(b => b.owner === 'neutral' ? [b, {...b, cell: [mir(b.cell[0]), b.cell[1]]}]
    : [b, {...b, cell: [mir(b.cell[0]), b.cell[1]], owner: 'red', name: b.name.replace('蓝', '红')}]);
  if (river.length) { preset.river = uniq(mirrorCells(riverSet)); preset.bridges.push({type: 'A', cells: [bridgeA], rotation: 0}, {type: 'A', cells: [[mir(bridgeA[0]), bridgeA[1]]], rotation: 0}); }
  if (bridgeB) preset.bridges.push({type: 'B', cells: bridgeB.cells, rotation: 0});
  preset.stats = {lake: lakeKind, roads: L.roads.length, mountain: L.mountain.length, desert: L.desert.length, swamp: L.swamp.length, forest: L.forestExtra.length, river: (preset.river || []).length, bridges: preset.bridges.length, buildings: L.buildings.length};
  if (L.mountain.length < 8 || L.forestExtra.length < 14 || desert.size < 4 || swamp.size < 4) throw Error('随机结果太稀疏，重试');
  validateLayout(preset);
  return preset;
}

// seed 相同则地图相同；个别 seed 随机结果不合格（放不下、堵路、太稀疏）会自动换一次随机再试
export function makeLevel1(seed = 1) {
  let err;
  for (let attempt = 0; attempt < 40; attempt++) { try { return build(seed, attempt); } catch (e) { err = e; } }
  throw err;
}
