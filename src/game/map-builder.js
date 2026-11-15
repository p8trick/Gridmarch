import * as THREE from 'three';
import {createSeaRegion} from '../art/water/sea-board-components.js';
import {createFinalCoast, makeFinalShoalProfile, makeFinalCliffProfile, getFinalStraightPorts, getCoastHitSource} from '../art/water/coast-final.js';
import {createRiverArt} from '../art/water/river-performance.js';
import {createRiverMouthMT2} from '../art/water/river-mouth-mt2.js';   // 河口 M2：用 MT2 规划里的真实邻岸轮廓，支持左右岸型混合
import {planCoast47, createCoast47} from '../art/water/coast47-performance.js';   // MT2：海岸完整 47 种邻接，浅滩/断崖可按格混合
import {PALETTE as P} from 'palette';

// 水域接入层：把 海(V08) / 浅滩(A7.3) / 断崖(C2) / 河(R6.1) 四个独立组件按一张地图组装起来。
// 只做组装，不改任何美术源码。地形类型：land / sea / shoal / cliff / river
export const WATER_Y = -0.3, BASE_Y = -1.6;
// 棋盘草色：格子色块是草色的唯一来源，浅滩/断崖/河里的草地顶点色会被统一到这里（见 retintGrass）
export const boardGrass = (cx, cz) => ((cx + cz) & 1) ? P.grass : P.grassAlt;

// 把水域组件里"草"的顶点色换成所在格的棋盘草色，保留组件自带的明暗起伏（噪声）。
// 只处理草：沙、岩、土、水的顶点色不动。按三角形重心归格，所以草色在格边界上是整格切换，和棋盘草地一致。
// 做法：该网格转非索引（每个三角形独立顶点），草权重 w 由绿色相对红/蓝的优势平滑得出，w 低的顶点（沙/岩/土/过渡）保持原色。
export function retintGrass(root, colorOf = boardGrass, keep = 0) {
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const tc = new THREE.Color(), n = {meshes: 0, tris: 0, grassVerts: 0};
  const weight = (col, i) => smooth(.02, .10, col.getY(i) - Math.max(col.getX(i), col.getZ(i)));
  root.traverse(m => {
    if (!m.isMesh || !m.geometry.attributes.color || /cutaway/i.test(m.name)) return;
    let g = m.geometry, col = g.attributes.color, any = false;
    for (let i = 0; i < col.count && !any; i++) if (weight(col, i) > .5) any = true;
    if (!any) return;                                        // 水面、纯沙/岩/土网格原样不动
    if (g.index) { const ng = g.toNonIndexed(); g.dispose(); g = m.geometry = ng; col = g.attributes.color; }
    const pos = g.attributes.position, cnt = pos.count; if (cnt % 3) return;
    let ls = 0, lc = 0; const lum = i => .2126 * col.getX(i) + .7152 * col.getY(i) + .0722 * col.getZ(i);
    if (keep) for (let i = 0; i < cnt; i++) if (weight(col, i) > .5) { ls += lum(i); lc++; }
    const L0 = lc ? ls / lc : 1, W = new Float32Array(cnt), F = new Float32Array(cnt);
    for (let i = 0; i < cnt; i++) { W[i] = weight(col, i); F[i] = keep ? 1 + keep * (lum(i) / L0 - 1) : 1; }
    for (let t = 0; t < cnt; t += 3) {
      const cx = Math.round((pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 6), cz = Math.round((pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 6);
      tc.set(colorOf(cx, cz));
      for (let k = 0; k < 3; k++) {
        const i = t + k, wi = W[i]; if (wi <= 0) continue;
        col.setXYZ(i, col.getX(i) + (tc.r * F[i] - col.getX(i)) * wi, col.getY(i) + (tc.g * F[i] - col.getY(i)) * wi, col.getZ(i) + (tc.b * F[i] - col.getZ(i)) * wi);
        n.grassVerts++;
      }
    }
    col.needsUpdate = true; n.meshes++; n.tris += cnt / 3;
  });
  return n;
}

const key = (x, z) => x + ',' + z;
function rect(x0, x1, z0, z1) { const o = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) o.push([x, z]); return o; }

// 测试地图预设。一条海岸线只含一个转角（组件当前只支持这样，见各自 README）；河口图是一条直海岸 + 一个直入海的河口
export const PRESETS = {
  // 沙漠 / 沼泽陈列：8×10 全陆地。西北一片沙漠（每格不同的沙丘高度 / 仙人掌），东南一片沼泽（每格水洼、芦苇、枯木不同），单位站在上面看站位
  sandmarsh: {
    name: '沙漠沼泽陈列',
    x: [-4, 3], z: [-5, 4], seed: 7,
    topology: {coastType: 'shoal', land: rect(-4, 3, -5, 4), outside: [...rect(-5, -5, -6, 5), ...rect(4, 4, -6, 5), ...rect(-4, 3, -6, -6), ...rect(-4, 3, 5, 5)]},
    layout: {
      mountain: [], roads: [], forest: {x: [0, -1], z: [0, -1]}, forestExtra: [], buildings: [],
      desert: rect(-3, -1, -4, -2), swamp: rect(0, 2, 0, 3),
      units: [
        {k: 'inf', team: 'blue', c: [-3, -4], face: Math.PI, name: '蓝步兵（沙漠）'}, {k: 'tank', type: 'light', team: 'blue', c: [-2, -4], face: Math.PI, name: '蓝轻坦（沙漠）'},
        {k: 'tank', type: 'medium', team: 'blue', c: [-1, -3], face: Math.PI, name: '蓝中坦（沙漠）'}, {k: 'art', team: 'blue', c: [-3, -2], face: Math.PI, name: '蓝火炮（沙漠）'},
        {k: 'inf', team: 'red', c: [0, 0], face: 0, name: '红步兵（沼泽）'}, {k: 'tank', type: 'medium', team: 'red', c: [1, 1], face: 0, name: '红中坦（沼泽）'},
        {k: 'tank', type: 'heavy', team: 'red', c: [2, 2], face: 0, name: '红重坦（沼泽）'}, {k: 'inf', team: 'red', c: [1, 3], face: 0, name: '红步兵（沼泽）'},
      ],
    },
  },
  // 海湾：海在东南象限，内角在海的西北角；北岸断崖、西岸浅滩，断崖与浅滩在内角相接；西北有河 + 河式湖
  bay: {
    name: '海湾·内角',
    x: [-4, 3], z: [-5, 4], seed: 7,
    corner: {kind: 'inner', rotation: 0, origin: [0, 1]},
    arms: [{type: 'cliff', length: 3}, {type: 'shoal', length: 3}],   // 沿 getStraightPorts 的两个端口方向延伸，长度含端口格
    sea: rect(1, 3, 2, 4),
    river: [[-2, -4], [-2, -3], [-3, -3], [-2, -2], [-1, -2], [-2, -1], [-1, -1], [0, -2], [0, -3]],   // 全在棋盘内部，不碰外缘（河组件没有外缘切面）
    layout: {
      mountain: [[1, -3], [2, -3], [2, -2], [1, -2], [-4, -3], [-4, -2]],
      roads: [[-4, 0], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-1, 1], [-1, 2], [-1, 3], [3, -1], [3, -2], [3, -3]],
      forest: {x: [-4, -2], z: [2, 4]},
      forestExtra: [[2, -1], [-4, -4], [0, -5], [2, -5]],
      buildings: [
      {type: 'bld_hq', cell: [-1, 4], owner: 'blue', name: '蓝总部'},
      {type: 'bld_hq', cell: [3, -4], owner: 'red', name: '红总部'},
      {type: 'bld_city_large', cell: [-3, 1], owner: 'neutral', name: '大城市'},
      {type: 'bld_city_small', cell: [0, -4], owner: 'neutral', name: '小城市'},
      {type: 'bld_factory', cell: [-4, 1], owner: 'blue', name: '蓝兵工厂'},
      // 机场随视角转向；船坞暂不放：新海岸/海没有"陆格接水道"的接口，见水域接入说明
      {type: 'bld_airport', cell: [1, -1], owner: 'neutral', name: '机场', stand: [0, .45], y: .018},
    ],
      units: [
      {k: 'tank', type: 'medium', team: 'blue', c: [-2, 0], face: Math.PI / 2, name: '蓝中坦（在路上）'},
      {k: 'tank', type: 'heavy', team: 'blue', c: [-1, 2], face: Math.PI, name: '蓝重坦（在路上）'},
      {k: 'tank', type: 'light', team: 'blue', c: [0, 2], face: Math.PI / 2, name: '蓝轻坦（浅滩）'},
      {k: 'art', team: 'blue', c: [-2, 1], face: Math.PI, name: '蓝火炮'},
      {k: 'inf', team: 'blue', c: [1, 0], face: Math.PI, name: '蓝步兵（在路上）'},
      {k: 'inf', team: 'blue', c: [0, 3], face: Math.PI / 2, name: '蓝步兵（浅滩）'},
      {k: 'tank', type: 'medium', team: 'red', c: [3, -1], face: 0, name: '红中坦'},
      {k: 'tank', type: 'light', team: 'red', c: [0, -1], face: 0, name: '红轻坦'},
      {k: 'art', team: 'red', c: [-4, -1], face: 0, name: '红火炮'},
      {k: 'inf', team: 'red', c: [-3, 3], face: 0, name: '红步兵（在林中）'},
      {k: 'inf', team: 'red', c: [1, -3], face: 0, name: '红步兵（上山）'},
      {k: 'inf', team: 'red', c: [2, 1], face: 0, name: '红步兵（断崖岸）'},
      {k: 'inf', team: 'blue', c: [-2, -3], face: Math.PI / 2, name: '蓝步兵（涉水）'},
      {k: 'inf', type: 'at', team: 'blue', c: [-3, 0], face: Math.PI / 2, name: '蓝反坦克兵'},
      {k: 'inf', type: 'at', team: 'red', c: [3, -3], face: Math.PI, name: '红反坦克兵'},
    ],
    },
  },
  // 群岛·浅滩岸 + 跨海桥：两座陆块被一条 3 格宽的海峡隔开，用多转角海岸 MT1 自动规划（直岸 / 外角 / 内角），海峡上一座 B 型跨海桥
  'island': {
    name: '群岛·浅滩岸 + 跨海桥',
    x: [-4, 3], z: [-5, 4], seed: 7,
    topology: {
      coastType: 'shoal',
      // 陆块：西岛 x -4..-2、东岛 x 2..3。棋盘外再给一圈陆地占格，避免把棋盘裁切边误判成海岸
      land: [...rect(-4, -2, -5, 1), ...rect(2, 3, -5, 0)],
      outside: [...rect(-5, -5, -6, 1), ...rect(-4, -2, -6, -6), ...rect(4, 4, -6, 0), ...rect(2, 3, -6, -6)],
    },
    bridges: [{type: 'B', cells: [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2]], rotation: 0}],   // 首尾两格是桥头（在海岸格里），中间是跨海桥格
    layout: {
      mountain: [[-4, -4], [-4, -3]],
      roads: [[-4, -2], [-3, -2], [-3, -3], [-3, -4], [3, -2], [3, -3]],   // 两头接桥头格：桥头格本身属于桥，不在这里
      forest: {x: [0, -1], z: [0, -1]},
      forestExtra: [[-3, -1]],
      buildings: [
        {type: 'bld_hq', cell: [-4, 0], owner: 'blue', name: '蓝总部'},
        {type: 'bld_dockyard', cell: [-3, 1], owner: 'blue', name: '蓝船坞'},
        {type: 'bld_factory', cell: [-3, 0], owner: 'blue', name: '蓝兵工厂'},
        {type: 'bld_city_large', cell: [-4, -5], owner: 'neutral', name: '大城市'},
        {type: 'bld_airport', cell: [-3, -5], owner: 'neutral', name: '机场', stand: [0, .45], y: .018},
        {type: 'bld_city_small', cell: [-4, -1], owner: 'neutral', name: '小城市'},
        {type: 'bld_hq', cell: [3, -5], owner: 'red', name: '红总部'},
        {type: 'bld_factory', cell: [3, -1], owner: 'red', name: '红兵工厂'},
        {type: 'bld_city_small', cell: [3, -4], owner: 'neutral', name: '小城市'},
      ],
      units: [
        {k: 'tank', type: 'medium', team: 'blue', c: [-3, -2], face: -Math.PI / 2, name: '蓝中坦（在路上）'},
        {k: 'tank', type: 'heavy', team: 'blue', c: [-4, -2], face: -Math.PI / 2, name: '蓝重坦（在路上）'},
        {k: 'tank', type: 'light', team: 'blue', c: [-2, 0], face: Math.PI, name: '蓝轻坦（海岸）'},
        {k: 'art', team: 'blue', c: [-2, -4], face: -Math.PI / 2, name: '蓝火炮（海岸）'},
        {k: 'inf', team: 'blue', c: [-2, -1], face: -Math.PI / 2, name: '蓝步兵（海岸）'},
        {k: 'inf', type: 'at', team: 'blue', c: [-2, -3], face: -Math.PI / 2, name: '蓝反坦克兵'},
        {k: 'tank', type: 'medium', team: 'red', c: [3, -2], face: Math.PI / 2, name: '红中坦（在路上）'},
        {k: 'tank', type: 'medium', team: 'blue', c: [-1, -2], face: Math.PI / 2, name: '蓝中坦（停在桥上）'},
        {k: 'inf', team: 'blue', c: [0, -2], face: Math.PI / 2, name: '蓝步兵（停在桥上）'},
        {k: 'tank', type: 'heavy', team: 'red', c: [1, -2], face: -Math.PI / 2, name: '红重坦（停在桥上）'},
        {k: 'inf', type: 'at', team: 'red', c: [3, -3], face: Math.PI / 2, name: '红反坦克兵'},
        {k: 'tank', type: 'light', team: 'red', c: [2, -3], face: Math.PI / 2, name: '红轻坦（海岸）'},
        {k: 'inf', team: 'red', c: [2, -1], face: Math.PI / 2, name: '红步兵（海岸）'},
        {k: 'art', team: 'red', c: [2, 0], face: Math.PI, name: '红火炮（岛角海岸）'},
      ],
    },
  },
  // 群岛·断崖岸 + 跨海桥：两座陆块被一条 3 格宽的海峡隔开，用多转角海岸 MT1 自动规划（直岸 / 外角 / 内角），海峡上一座 B 型跨海桥
  'island-cliff': {
    name: '群岛·断崖岸 + 跨海桥',
    x: [-4, 3], z: [-5, 4], seed: 7,
    topology: {
      coastType: 'cliff',
      // 陆块：西岛 x -4..-2、东岛 x 2..3。棋盘外再给一圈陆地占格，避免把棋盘裁切边误判成海岸
      land: [...rect(-4, -2, -5, 1), ...rect(2, 3, -5, 0)],
      outside: [...rect(-5, -5, -6, 1), ...rect(-4, -2, -6, -6), ...rect(4, 4, -6, 0), ...rect(2, 3, -6, -6)],
    },
    bridges: [{type: 'B', cells: [[-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2]], rotation: 0}],   // 首尾两格是桥头（在海岸格里），中间是跨海桥格
    layout: {
      mountain: [[-4, -4], [-4, -3]],
      roads: [[-4, -2], [-3, -2], [-3, -3], [-3, -4], [3, -2], [3, -3]],   // 两头接桥头格：桥头格本身属于桥，不在这里
      forest: {x: [0, -1], z: [0, -1]},
      forestExtra: [[-3, -1]],
      buildings: [
        {type: 'bld_hq', cell: [-4, 0], owner: 'blue', name: '蓝总部'},
        {type: 'bld_dockyard', cell: [-3, 1], owner: 'blue', name: '蓝船坞'},
        {type: 'bld_factory', cell: [-3, 0], owner: 'blue', name: '蓝兵工厂'},
        {type: 'bld_city_large', cell: [-4, -5], owner: 'neutral', name: '大城市'},
        {type: 'bld_airport', cell: [-3, -5], owner: 'neutral', name: '机场', stand: [0, .45], y: .018},
        {type: 'bld_city_small', cell: [-4, -1], owner: 'neutral', name: '小城市'},
        {type: 'bld_hq', cell: [3, -5], owner: 'red', name: '红总部'},
        {type: 'bld_factory', cell: [3, -1], owner: 'red', name: '红兵工厂'},
        {type: 'bld_city_small', cell: [3, -4], owner: 'neutral', name: '小城市'},
      ],
      units: [
        {k: 'tank', type: 'medium', team: 'blue', c: [-3, -2], face: -Math.PI / 2, name: '蓝中坦（在路上）'},
        {k: 'tank', type: 'heavy', team: 'blue', c: [-4, -2], face: -Math.PI / 2, name: '蓝重坦（在路上）'},
        {k: 'tank', type: 'light', team: 'blue', c: [-2, 0], face: Math.PI, name: '蓝轻坦（海岸）'},
        {k: 'art', team: 'blue', c: [-2, -4], face: -Math.PI / 2, name: '蓝火炮（海岸）'},
        {k: 'inf', team: 'blue', c: [-2, -1], face: -Math.PI / 2, name: '蓝步兵（海岸）'},
        {k: 'inf', type: 'at', team: 'blue', c: [-2, -3], face: -Math.PI / 2, name: '蓝反坦克兵'},
        {k: 'tank', type: 'medium', team: 'red', c: [3, -2], face: Math.PI / 2, name: '红中坦（在路上）'},
        {k: 'tank', type: 'medium', team: 'blue', c: [-1, -2], face: Math.PI / 2, name: '蓝中坦（停在桥上）'},
        {k: 'inf', team: 'blue', c: [0, -2], face: Math.PI / 2, name: '蓝步兵（停在桥上）'},
        {k: 'tank', type: 'heavy', team: 'red', c: [1, -2], face: -Math.PI / 2, name: '红重坦（停在桥上）'},
        {k: 'inf', type: 'at', team: 'red', c: [3, -3], face: Math.PI / 2, name: '红反坦克兵'},
        {k: 'tank', type: 'light', team: 'red', c: [2, -3], face: Math.PI / 2, name: '红轻坦（海岸）'},
        {k: 'inf', team: 'red', c: [2, -1], face: Math.PI / 2, name: '红步兵（海岸）'},
        {k: 'art', team: 'red', c: [2, 0], face: Math.PI, name: '红火炮（岛角海岸）'},
      ],
    },
  },
  // 河口：南面是整排海，海岸是一条直断崖线，河从北面蜿蜒而下，在 (0,2) 直入海（河口组件 M1）
  estuary: {
    name: '河口·直入海',
    x: [-4, 3], z: [-5, 4], seed: 7,
    mouth: {cell: [0, 2], coastType: 'mixed', typeForCell: x => x < 0 ? 'cliff' : 'shoal', back: 2},   // 左岸断崖、右岸浅滩（M2 支持混合）；back：紧贴河口的入口段格数
    river: [[1, -4], [1, -3], [1, -2], [0, -2], [0, -1], [0, 0], [0, 1]],   // 河口格以上的全部河格（含入口段）
    seaRows: [3, 4],
    bridges: [{type: 'A', cells: [[0, 1]], rotation: 0}],   // 入口段第一格上的 A 型河桥，接两侧道路
    layout: {
      mountain: [[-4, -4], [-3, -4], [-4, -3], [-3, -3]],
      roads: [[-4, 1], [-3, 1], [-2, 1], [-1, 1], [1, 1], [2, 1], [3, 1], [-2, 0], [-2, -1]],   // 河上没有桥：路在河两侧各自断开
      forest: {x: [2, 3], z: [-3, -1]},
      forestExtra: [[-1, -4], [2, -5], [-4, -1]],
      buildings: [
        {type: 'bld_hq', cell: [-3, 0], owner: 'blue', name: '蓝总部'},
        {type: 'bld_hq', cell: [3, -4], owner: 'red', name: '红总部'},
        {type: 'bld_factory', cell: [-4, 0], owner: 'blue', name: '蓝兵工厂'},
        {type: 'bld_city_large', cell: [2, 0], owner: 'neutral', name: '大城市'},
        {type: 'bld_city_small', cell: [-1, -2], owner: 'neutral', name: '小城市'},
        {type: 'bld_airport', cell: [-2, -3], owner: 'neutral', name: '机场', stand: [0, .45], y: .018},
      ],
      units: [
        {k: 'tank', type: 'medium', team: 'blue', c: [-3, 1], face: Math.PI / 2, name: '蓝中坦（在路上）'},
        {k: 'tank', type: 'heavy', team: 'blue', c: [-1, 1], face: Math.PI / 2, name: '蓝重坦（河口左岸）'},
        {k: 'tank', type: 'light', team: 'blue', c: [1, 1], face: Math.PI / 2, name: '蓝轻坦（河口右岸）'},
        {k: 'art', team: 'blue', c: [-2, 0], face: Math.PI, name: '蓝火炮'},
        {k: 'inf', team: 'blue', c: [0, 0], face: Math.PI, name: '蓝步兵（涉水）'},
        {k: 'tank', type: 'light', team: 'red', c: [0, 1], face: Math.PI / 2, name: '红轻坦（停在河桥上）'},
        {k: 'inf', team: 'blue', c: [-3, -3], face: 0, name: '蓝步兵（上山）'},
        {k: 'inf', type: 'at', team: 'blue', c: [-4, 1], face: Math.PI / 2, name: '蓝反坦克兵'},
        {k: 'inf', type: 'at', team: 'red', c: [2, -4], face: Math.PI, name: '红反坦克兵'},
        {k: 'tank', type: 'medium', team: 'red', c: [3, 1], face: -Math.PI / 2, name: '红中坦'},
        {k: 'tank', type: 'light', team: 'red', c: [1, 2], face: Math.PI, name: '红轻坦（断崖岸）'},
        {k: 'art', team: 'red', c: [-4, -2], face: 0, name: '红火炮'},
        {k: 'inf', team: 'red', c: [3, -2], face: 0, name: '红步兵（在林中）'},
        {k: 'inf', team: 'red', c: [-2, 2], face: Math.PI, name: '红步兵（断崖岸）'},
        {k: 'inf', team: 'red', c: [2, 2], face: Math.PI, name: '红步兵（断崖岸）'},
      ],
    },
  },
};

// 混合岸类群岛：西岛浅滩、东岛断崖（MT2 单 plan，按格指定）
PRESETS['island-mixed'] = {
  ...PRESETS.island, name: '群岛·西浅滩 东断崖 + 跨海桥',
  topology: {...PRESETS.island.topology, coastType: 'mixed', typeForCell: x => x < 0 ? 'shoal' : 'cliff'},
};
// 同一座岛内混合：西岛北半浅滩、南半断崖（桥头在浅滩段），东岛断崖
PRESETS['island-split'] = {
  ...PRESETS.island, name: '群岛·岛内混合岸 + 跨海桥',
  topology: {...PRESETS.island.topology, coastType: 'mixed', typeForCell: (x, z) => x < 0 && z <= -2 ? 'shoal' : 'cliff'},
};
// 形状陈列：MT1 拒绝的 34 种里常见的几种——一格宽的岬角、锯齿岸、一格宽的海湾、一格宽的陆桥、一格孤礁、半岛尖端。断崖陆岸 + 浅滩小地形
PRESETS.shapes = {
  name: '形状陈列（MT2 新增形态）',
  x: [-4, 3], z: [-5, 4], seed: 7,
  topology: {
    coastType: 'mixed', typeForCell: (x, z) => z <= -1 ? 'cliff' : 'shoal',
    land: [...rect(-4, 3, -5, -1), [-3, 0], [-3, 1], [0, 0], [2, 0], [0, 1], [0, 2], ...rect(-1, 1, 3, 4), [-3, 3], [3, 3]],
    outside: [...rect(-5, -5, -6, -1), ...rect(-4, 3, -6, -6), ...rect(4, 4, -6, -1)],
  },
  layout: {
    mountain: [[0, -3]], roads: [], forest: {x: [0, -1], z: [0, -1]}, forestExtra: [[-4, -5], [3, -5]],
    buildings: [
      {type: 'bld_hq', cell: [-3, -4], owner: 'blue', name: '蓝总部'},
      {type: 'bld_hq', cell: [2, -4], owner: 'red', name: '红总部'},
      {type: 'bld_city_small', cell: [-1, -3], owner: 'neutral', name: '小城市'},
    ],
    units: [
      {k: 'tank', type: 'medium', team: 'blue', c: [-2, -3], face: Math.PI, name: '蓝中坦'},
      {k: 'tank', type: 'light', team: 'red', c: [1, -3], face: Math.PI, name: '红轻坦'},
      {k: 'inf', team: 'blue', c: [-3, 1], face: Math.PI, name: '蓝步兵（一格宽岬角尖端）'},
      {k: 'inf', team: 'red', c: [0, 1], face: Math.PI, name: '红步兵（一格宽陆桥）'},
      {k: 'inf', type: 'at', team: 'blue', c: [-3, 3], face: Math.PI, name: '蓝反坦克兵（一格孤礁）'},
      {k: 'inf', team: 'red', c: [0, 3], face: Math.PI, name: '红步兵（小岛）'},
    ],
  },
};

// 布局校验：建筑 / 树林 / 山 / 路 / 单位都必须落在平原（land）上，且彼此不重叠；单位不能进海，只有步兵能进河。违规直接抛错
export function validateLayout(preset) {
  const L = preset.layout, bad = [], plan = planWater(preset), at = (c) => plan.type.get(key(...c)) ?? 'outside';
  const owner = new Map(), claim = (cells, what, ok = ['land']) => { for (const c of cells) { const k = key(...c); if (owner.has(k) && owner.get(k) !== what) bad.push(`${what} 与 ${owner.get(k)} 重叠 @ ${c}`); else owner.set(k, what); if (!ok.includes(at(c))) bad.push(`${what} 在 ${at(c)} 上（应为 ${ok.join('/')}）@ ${c}`); } };
  const forest = [...L.forestExtra]; for (let x = L.forest.x[0]; x <= L.forest.x[1]; x++) for (let z = L.forest.z[0]; z <= L.forest.z[1]; z++) forest.push([x, z]);
  claim(L.buildings.filter(b => b.type !== 'bld_dockyard').map(b => b.cell), '建筑'); claim(L.buildings.filter(b => b.type === 'bld_dockyard').map(b => b.cell), '建筑', ['shoal', 'cliff']);   // 船坞放在海岸格上，水池朝海 claim(forest, '树林'); claim(L.mountain, '山'); claim(L.roads, '道路'); claim(L.desert || [], '沙漠'); claim(L.swamp || [], '沼泽');
  const bridge = new Set(bridgeCellsOf(preset).map(c => key(...c)));
  for (const b of preset.bridges || []) b.cells.forEach((c, i) => {   // 桥格下面必须是对的地形
    const t = at(c), ok = b.type === 'A' ? t === 'river' : (i === 0 || i === b.cells.length - 1) ? (t === 'shoal' || t === 'cliff') : t === 'sea';
    if (!ok) bad.push(`桥格 ${b.type}[${i}] 下面是 ${t}，不符 @ ${c}`);
    if (owner.has(key(...c))) bad.push(`桥格与 ${owner.get(key(...c))} 重叠 @ ${c}`);
  });
  const seen = new Set();
  for (const u of L.units) {
    const k = key(...u.c), t = at(u.c);
    if (seen.has(k)) bad.push(`单位重叠 @ ${u.c}`); seen.add(k);
    if (!bridge.has(k) && (t === 'sea' || t === 'outside')) bad.push(`单位 ${u.name} 在 ${t} 上 @ ${u.c}`);
    if (!bridge.has(k) && t === 'river' && u.k !== 'inf') bad.push(`${u.name} 不是步兵却在河里 @ ${u.c}`);
    if (L.buildings.some(b => key(...b.cell) === k)) bad.push(`单位 ${u.name} 站在建筑格上 @ ${u.c}`);
    if (L.mountain.some(c => key(...c) === k) && u.k !== 'inf') bad.push(`${u.name} 不是步兵却在山上 @ ${u.c}`);
  }
  if (bad.length) throw Error('布局校验失败（' + preset.name + '）：\n  ' + bad.join('\n  '));
  return true;
}

// —— 把预设展开成逐格的类型（land/sea/shoal/cliff/river）和"由哪个组件生成"（owner），纯数据，Node 里可检查 ——
export function planWater(preset) { return preset.mouth ? planMouth(preset) : preset.topology ? planTopology(preset) : planCorner(preset); }
const boardCells = preset => rect(preset.x[0], preset.x[1], preset.z[0], preset.z[1]);
function newPlan(preset) {
  const [[x0, x1], [z0, z1]] = [preset.x, preset.z], type = new Map(), owner = new Map();
  const inBoard = (cx, cz) => cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1;
  const set = (c, t, o) => { if (!inBoard(...c)) throw Error('cell outside board ' + c); if (type.has(key(...c))) throw Error('cell used twice ' + c); type.set(key(...c), t); owner.set(key(...c), o); };
  const fillLand = () => { for (const [x, z] of boardCells(preset)) if (!type.has(key(x, z))) { type.set(key(x, z), 'land'); owner.set(key(x, z), 'land'); } };
  return {preset, inBoard, type, owner, set, fillLand};
}
function planCorner(preset) {
  const p = newPlan(preset), seed = preset.seed, cornerArgs = {...preset.corner, seed};
  const cornerProfile = {shoal: makeFinalShoalProfile(cornerArgs), cliff: makeFinalCliffProfile(cornerArgs)};
  const ports = getFinalStraightPorts(cornerProfile.cliff), o = preset.corner.origin;
  const cornerType = preset.arms[0].type, cliffFirst = preset.arms.some(a => a.type === 'cliff');
  p.set(o, cornerType, cornerType === 'cliff' ? 'cliff' : 'shoal');
  const arms = preset.arms.map((arm, i) => {
    const port = ports[i], dir = [port.cell[0] - o[0], port.cell[1] - o[1]], cells = [];
    for (let k = 1; k <= arm.length; k++) {
      const c = [o[0] + dir[0] * k, o[1] + dir[1] * k]; cells.push(c);
      // 断崖区域里夹带的浅滩格：浅滩臂的端口格属于断崖组件（README：typeForCell）
      p.set(c, arm.type, arm.type === 'cliff' ? 'cliff' : (k === 1 && cliffFirst ? 'cliff' : 'shoal'));
    }
    return {type: arm.type, cells, profile: port.profile};
  });
  for (const c of preset.sea) p.set(c, 'sea', 'sea');
  for (const c of preset.river) p.set(c, 'river', 'river');
  p.fillLand();
  return {kind: 'corner', preset, inBoard: p.inBoard, cornerProfile, ports, arms, type: p.type, owner: p.owner};
}
function planMouth(preset) {
  const p = newPlan(preset), m = preset.mouth, [mx, mz] = m.cell, [x0, x1] = preset.x, [z0, z1] = preset.z, board = boardCells(preset);
  const approach = Array.from({length: m.back}, (_, i) => [mx, mz - 1 - i]), apSet = new Set(approach.map(c => key(...c)));
  const riverKeys = new Set(preset.river.map(c => key(...c)));
  for (const c of approach) if (!riverKeys.has(key(...c))) throw Error('入口段格必须在 river 列表里：' + c);
  // MT2 规划：陆格 = 海行以外的全部（含河口 / 河道，它们是"被占据的拓扑占位格"，保证两侧海岸识别为直岸）；棋盘外补一圈陆地，避免裁切边被判成海岸
  const seaRows = new Set(preset.seaRows), land = board.filter(([x, z]) => !seaRows.has(z)), lastLand = mz;
  const outside = [...rect(x0 - 1, x0 - 1, z0 - 1, lastLand), ...rect(x1 + 1, x1 + 1, z0 - 1, lastLand), ...rect(x0, x1, z0 - 1, z0 - 1)];
  const topo = planCoast47({cells: board, landCells: [...land, ...outside], coastType: m.coastType, typeForCell: m.typeForCell, seed: preset.seed});
  for (const [x, z] of board) {
    const k = key(x, z);
    if (k === key(...m.cell)) { p.type.set(k, 'river'); p.owner.set(k, 'mouth'); }
    else if (riverKeys.has(k)) { p.type.set(k, 'river'); p.owner.set(k, apSet.has(k) ? 'approach' : 'river'); }
    else { const t = topo.recordAt(x, z).terrain; p.type.set(k, t); p.owner.set(k, t === 'land' ? 'land' : t === 'sea' ? 'sea' : 'coast'); }
  }
  return {kind: 'mouth', preset, inBoard: p.inBoard, approach, apSet, type: p.type, owner: p.owner, topo};
}

// 海岸 MT2：整张图的陆格交给一个 plan，47 种邻接全支持；coastType 可为 'shoal' / 'cliff' / 'mixed'（mixed 时由 typeForCell 逐格指定）
function planTopology(preset) {
  const p = newPlan(preset), T = preset.topology, board = boardCells(preset);
  const topo = planCoast47({cells: board, landCells: [...T.land, ...T.outside], coastType: T.coastType, typeForCell: T.typeForCell, seed: preset.seed});
  for (const [x, z] of board) { const t = topo.recordAt(x, z).terrain; p.type.set(key(x, z), t); p.owner.set(key(x, z), t === 'land' ? 'land' : 'coast'); }
  for (const c of preset.river || []) {   // 内陆河（与海岸互不相接）：河格本身必须是陆地格
    if (p.type.get(key(...c)) !== 'land') throw Error('river cell must be land @ ' + c);
    p.type.set(key(...c), 'river'); p.owner.set(key(...c), 'river');
  }
  return {kind: 'topology', preset, inBoard: p.inBoard, type: p.type, owner: p.owner, topo};
}
// 桥占用的格（A 型河桥：河格；B 型：两端桥头在海岸格里，中间是海格）
export const bridgeCellsOf = preset => (preset.bridges || []).flatMap(b => b.cells);

// —— 通用收尾：草色统管、地表采样、对外接口 ——
function assemble({group, parts, plan, board, grassFromBoard}) {
  const retint = grassFromBoard ? retintGrass(group) : null;   // 先于任何采样：高度不变，只改草的顶点色
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3(), bc = new THREE.Vector3(), tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  // 世界坐标 (x,z) 处水域组件地表的高度与顶点色（只取朝上的面；用于浅滩/断崖格的站立高度）
  function surfaceAt(x, z) {
    rc.set(from.set(x, 5, z), down);
    for (const h of rc.intersectObject(group, true)) {
      const g = h.object.geometry, col = g.attributes.color, pos = g.attributes.position, f = h.face;
      if (!col || !f || f.normal.y < .3) continue;
      tri[0].fromBufferAttribute(pos, f.a); tri[1].fromBufferAttribute(pos, f.b); tri[2].fromBufferAttribute(pos, f.c);
      THREE.Triangle.getBarycoord(h.point, tri[0], tri[1], tri[2], bc);
      const ch = [0, 1, 2].map(k => { const get = [col.getX, col.getY, col.getZ][k]; return get.call(col, f.a) * bc.x + get.call(col, f.b) * bc.y + get.call(col, f.c) * bc.z; });
      return {y: h.point.y, color: ch};
    }
    return null;
  }
  return {
    group, plan, parts, board, surfaceAt, retint,
    typeAt: (cx, cz) => plan.inBoard(cx, cz) ? plan.type.get(key(cx, cz)) : 'land',
    setCutaway(on) { for (const p of Object.values(parts)) p.setCutawayEnabled?.(!!on); },
    dispose() { for (const p of Object.values(parts)) p.dispose?.(); group.clear(); },
  };
}
const disposeTree = root => () => root.traverse(m => m.isMesh && m.geometry.dispose());

export function createWaterWorld(preset, opts = {}) { return preset.mouth ? buildMouthWorld(preset, opts) : preset.topology ? buildTopologyWorld(preset, opts) : buildCornerWorld(preset, opts); }

// 岛屿图：整张图交给 MT2（海面 + 岸线一起出），陆地格由棋盘自己画
function buildTopologyWorld(preset, {cutaway = true, grassFromBoard = true} = {}) {
  const plan = planTopology(preset), board = boardCells(preset), group = new THREE.Group(); group.name = 'water_world';
  const wet = board.filter(([x, z]) => !['land', 'river'].includes(plan.type.get(key(x, z))));   // 海 / 浅滩 / 断崖
  const coast = wet.length ? createCoast47(plan.topo, {cells: wet, cutaway, bottom: BASE_Y}) : null;   // 纯陆地图（没有水格）不生成水域组件
  if (coast) group.add(coast.group);
  const parts = coast ? {coast} : {};
  if (preset.river?.length) {   // 内陆河：非水格里除海岸格之外都按陆地处理
    const rv = new Set(preset.river.map(c => key(...c))), isLand = (x, z) => !rv.has(key(x, z)) && (!plan.inBoard(x, z) || plan.type.get(key(x, z)) === 'land');
    const river = createRiverArt(preset.river, {isLand, seed: preset.seed}); group.add(river); parts.river = {group: river, dispose: disposeTree(river)};
  }
  const api = assemble({group, parts, plan, board, grassFromBoard});
  // 陆军站位参考点：MT2 逐格给出的实际陆面参考点（格内局部坐标，换算 [2x+a0, a1, 2z+a2]）
  const anchors = new Map((coast ? coast.group.userData.cells : []).filter(m => m.groundAnchor).map(m => [key(m.cx, m.cz), m.groundAnchor]));
  api.anchorAt = (cx, cz) => { const a = anchors.get(key(cx, cz)); return a ? [2 * cx + a[0], a[1], 2 * cz + a[2]] : null; };
  return api;
}

// 海湾图：断崖转角 + 浅滩臂 + 纯海 + 河
function buildCornerWorld(preset, {cutaway = true, grassFromBoard = true} = {}) {
  const plan = planCorner(preset), {type, arms, cornerProfile} = plan, o = preset.corner.origin, board = boardCells(preset);
  const group = new THREE.Group(); group.name = 'water_world';
  const parts = {}, [cliffArm, shoalArm] = [arms.find(a => a.type === 'cliff'), arms.find(a => a.type === 'shoal')];
  const common = {neighbors: board, bottom: BASE_Y, seed: preset.seed};
  const done = (name, comp) => { parts[name] = comp; group.add(comp.group); return comp; };
  // 1) 断崖区域：转角 + 断崖臂 + 浅滩臂的端口格（以浅滩类型渲染）
  if (cliffArm) {
    const beach = shoalArm ? shoalArm.cells[0] : null, cells = [o, ...cliffArm.cells, ...(beach ? [beach] : [])];
    const lookup = new Map(); for (const a of arms) for (const c of a.cells) lookup.set(key(...c), a.profile);
    const typeForCell = (x, z) => beach && x === beach[0] && z === beach[1] ? 'shoal' : 'cliff';
    done('cliff', createFinalCoast('cliff', cells, {...common, profile: cornerProfile.cliff, profileForCell: (x, z) => lookup.get(key(x, z)) || cornerProfile.cliff, typeForCell, cutaway}));
  }
  // 2) 浅滩区域：浅滩臂端口格之后的延伸格，沿用同一个端口轮廓以保持岸线相位
  if (shoalArm && shoalArm.cells.length > 1) done('shoal', createFinalCoast('shoal', shoalArm.cells.slice(1), {...common, profile: shoalArm.profile, profileForCell: () => shoalArm.profile, cutaway}));
  // 3) 纯海（relief 0：与海岸格的水面同高，避免交界出现细缝）
  if (preset.sea.length) done('sea', createSeaRegion(preset.sea, {neighbors: board, seed: preset.seed, relief: 0, cutaway, bottom: BASE_Y}));
  // 4) 河（含河式湖）：非水格里除海与海岸格之外都按陆地处理
  if (preset.river.length) {
    const wet = new Set(preset.river.map(c => key(...c))), isLand = (x, z) => !wet.has(key(x, z)) && (!plan.inBoard(x, z) || type.get(key(x, z)) === 'land');
    const river = createRiverArt(preset.river, {isLand, seed: preset.seed}); group.add(river); parts.river = {group: river, dispose: disposeTree(river)};
  }
  return assemble({group, parts, plan, board, grassFromBoard});
}

// 河口图：MT2 海岸规划 + 河口 M2（单格直入海）+ 入口段 + 上游河 + 整排海
function buildMouthWorld(preset, {cutaway = true, grassFromBoard = true} = {}) {
  const plan = planMouth(preset), {type, inBoard} = plan, m = preset.mouth, board = boardCells(preset);
  const group = new THREE.Group(); group.name = 'water_world'; const parts = {};
  // 河组件的邻域查询（R6.1 语义）：陆 = 平原与海岸格；河 / 河口 / 海都不是陆。它和 MT2 的拓扑占位不是同一个查询
  const isLand = (x, z) => { if (!inBoard(x, z)) return true; const t = type.get(key(x, z)); return t === 'land' || t === 'cliff' || t === 'shoal'; };
  const mouth = createRiverMouthMT2({plan: plan.topo, cell: m.cell, rotation: 0, isLand, edition: 'performance'});
  const add = (name, g, dispose) => { group.add(g); parts[name] = {group: g, dispose}; };
  add('mouth', mouth.group, () => mouth.dispose());
  const approach = mouth.createApproach(plan.approach, {edition: 'performance'}); add('approach', approach, disposeTree(approach));
  const upstream = preset.river.filter(c => !plan.apSet.has(key(...c)));
  if (upstream.length) { const river = createRiverArt(upstream, {isLand, seed: preset.seed}); add('river', river, disposeTree(river)); }
  // 海岸行：M2 适配器代调 MT2（只给真正要画的海岸格，不含河口 / 河道 / 另画的海水）
  const coastCells = board.filter(([x, z]) => plan.owner.get(key(x, z)) === 'coast');
  const coast = mouth.createCoast(coastCells, {edition: 'performance', cutaway}); parts.coast = coast; group.add(coast.group);
  const seaCells = board.filter(([x, z]) => type.get(key(x, z)) === 'sea');
  const sea = createSeaRegion(seaCells, {neighbors: board, seed: preset.seed, relief: 0, cutaway, bottom: BASE_Y}); parts.sea = sea; group.add(sea.group);
  return assemble({group, parts, plan, board, grassFromBoard});
}
export {getCoastHitSource};
