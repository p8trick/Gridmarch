import {planWater, bridgeCellsOf} from './map-builder.js';
import {createGame} from '../rules/engine.js';

// 关卡预设 → 规则引擎（0.40）。纯数据、不碰 three / DOM，Node 里可测。
// 坐标：关卡用世界格坐标 (cx, cz)（可以是负数）；引擎用 0 起的 (x, y)：x = cx - x0，y = cz - z0。
// 玩家序号：0 = 蓝方，1 = 红方（蓝方先手）。建筑 owner 'neutral' 不进引擎的 owners（中立）。
const key = (x, z) => x + ',' + z;
export const PLAYER_OF = {blue: 0, red: 1};
export const TEAM_OF = ['blue', 'red'];

const BUILDING_TERRAIN = {bld_hq: 'hq', bld_city_large: 'city_large', bld_city_small: 'city_small', bld_factory: 'factory', bld_airport: 'airport', bld_dockyard: 'port'};
const WATER_TERRAIN = {sea: 'sea', shoal: 'shoal', cliff: 'cliff', river: 'river'};

// 引擎单位 → 渲染层单位规格（world.js 的 UNITS 条目）。没有模型的兵种返回 null（还不能显示）。
export const MODEL_OF = {
  inf: {k: 'inf'}, mech: {k: 'inf', type: 'at'},
  tank: {k: 'tank', type: 'light'}, mdtank: {k: 'tank', type: 'medium'}, neotank: {k: 'tank', type: 'heavy'},
  arty: {k: 'art'},
};
const NAME = {inf: '步兵', mech: '反坦克兵', tank: '轻坦', mdtank: '中坦', neotank: '重坦', arty: '自行火炮'};

export function terrainGrid(preset) {
  const L = preset.layout, plan = planWater(preset), [x0, x1] = preset.x, [z0, z1] = preset.z;
  const set = cells => new Set((cells || []).map(c => key(...c)));
  const bridge = set(bridgeCellsOf(preset)), mountain = set(L.mountain), desert = set(L.desert), swamp = set(L.swamp), road = set(L.roads);
  const forest = set(L.forestExtra);
  for (let x = L.forest.x[0]; x <= L.forest.x[1]; x++) for (let z = L.forest.z[0]; z <= L.forest.z[1]; z++) forest.add(key(x, z));
  const bld = new Map(L.buildings.map(b => [key(...b.cell), BUILDING_TERRAIN[b.type]]));
  const grid = [];
  for (let z = z0; z <= z1; z++) {
    const row = [];
    for (let x = x0; x <= x1; x++) {
      const k = key(x, z), w = plan.type.get(k);
      row.push(bridge.has(k) ? 'bridge' : bld.get(k) || WATER_TERRAIN[w] || (mountain.has(k) ? 'mountain' : desert.has(k) ? 'desert' : swamp.has(k) ? 'swamp' : forest.has(k) ? 'forest' : road.has(k) ? 'road' : 'plain'));
    }
    grid.push(row);
  }
  return grid;
}

// 预设 → {game, specs, toEngine, toWorld}
//   preset.start = {funds: [蓝, 红], units: [{type, owner, c: [cx, cz]}]}（关卡生成器给，见 level1.js）
//   specs：给 world.js 的单位规格，spec.id 对应引擎单位 id
export function createGameFromPreset(preset, opts = {}) {
  const [x0] = preset.x, [z0] = preset.z, start = preset.start || {funds: [0, 0], units: []};
  const toEngine = ([cx, cz]) => [cx - x0, cz - z0], toWorld = ([x, y]) => [x + x0, y + z0];
  const owners = {};
  for (const b of preset.layout.buildings) if (PLAYER_OF[b.owner] !== undefined) { const [x, y] = toEngine(b.cell); owners[key(x, y)] = PLAYER_OF[b.owner]; }
  const units = start.units.map(u => { const [x, y] = toEngine(u.c); return {type: u.type, owner: u.owner, x, y}; });
  const game = createGame({terrain: terrainGrid(preset), units, owners, funds: opts.funds || start.funds, config: opts.config});
  const specs = [];
  for (const u of game.units) { const s = specOfUnit(u, toWorld); if (s) specs.push(s); }
  return {game, specs, toEngine, toWorld};
}
// 引擎单位 → 渲染规格（开局单位和生产出的新单位共用；没有模型的兵种返回 null）
export function specOfUnit(u, toWorld) {
  const m = MODEL_OF[u.type]; if (!m) return null;
  const team = TEAM_OF[u.owner];
  return {...m, id: u.id, team, c: toWorld([u.x, u.y]), face: team === 'blue' ? FACE_BLUE : FACE_RED, name: (team === 'blue' ? '蓝' : '红') + NAME[u.type]};
}
// 朝向（world.js：holder.rotation.y = face；模型正前方 = +z，yaw θ 时朝 (sin θ, cos θ)）：蓝方在西面朝东 +x，红方在东面朝西 -x
export const FACE_BLUE = Math.PI / 2, FACE_RED = -Math.PI / 2;
