// 关卡 → 规则引擎适配器检查（0.40）：多个种子下，地形对得上、建筑归属对称、起始部队合法且双方镜像。
import assert from 'assert';
import {makeLevel1, TEST_ARMY} from '../src/game/levels/level1.js';
import {createGameFromPreset, MODEL_OF} from '../src/game/engine-map.js';
import {reachable} from '../src/rules/engine.js';
import {UNITS, TERRAINS} from '../src/rules/data.js';

let n = 0;
const t = (name, f) => { f(); n++; console.log('PASS', name); };
const SEEDS = Array.from({length: 40}, (_, i) => i + 1);

t('40 个种子：引擎地图尺寸 = 20×12，地形 id 全部合法', () => {
  for (const seed of SEEDS) {
    const p = makeLevel1(seed), {game} = createGameFromPreset(p);
    assert.equal(game.w, 20); assert.equal(game.h, 12);
    for (const row of game.terrain) for (const id of row) assert(TERRAINS[id], seed + ' ' + id);
  }
});

t('建筑归属：红蓝各 1 总部 + 2 兵工厂，中立 2 大 + 6 小城市；开局资金与收入', () => {
  for (const seed of SEEDS) {
    const p = makeLevel1(seed), {game} = createGameFromPreset(p), cnt = {};
    for (const [k, o] of Object.entries(game.owners)) { const [x, y] = k.split(',').map(Number), id = game.terrain[y][x]; (cnt[o] ||= {})[id] = (cnt[o][id] || 0) + 1; }
    assert.deepEqual(cnt[0], {hq: 1, factory: 2}, 'blue ' + seed); assert.deepEqual(cnt[1], {hq: 1, factory: 2}, 'red ' + seed);
    const flat = game.terrain.flat(); assert.equal(flat.filter(i => i === 'city_large').length, 2); assert.equal(flat.filter(i => i === 'city_small').length, 6);
    assert.equal(game.funds[0], p.start.funds[0] + 3000);   // 第 1 天蓝方领一次收入：总部 1000 + 2 兵工厂
    assert.equal(game.funds[1], p.start.funds[1]);
  }
});

t('默认开局没有起始单位（0.86：全靠自己生产），双方都能生产；胜负不会一开局就判', () => {
  for (const seed of SEEDS) {
    const p = makeLevel1(seed), {game, specs} = createGameFromPreset(p);
    assert.equal(game.units.length, 0); assert.equal(specs.length, 0); assert.equal(game.winner, null);
  }
});

t('起始部队（网址 &units=1 / TEST_ARMY）：双方镜像、站在合法格、都有模型、每个单位都能动', () => {
  for (const seed of SEEDS) {
    const p = makeLevel1(seed, {army: TEST_ARMY}), {game, specs} = createGameFromPreset(p);
    assert.equal(game.units.length, 8); assert.equal(specs.length, 8);
    const seen = new Set();
    for (const u of game.units) {
      assert(MODEL_OF[u.type], '没有模型 ' + u.type);
      const k = u.x + ',' + u.y; assert(!seen.has(k), '重叠 ' + seed); seen.add(k);
      const tr = TERRAINS[game.terrain[u.y][u.x]]; assert(tr.cost[UNITS[u.type].mt] != null, `${seed} ${u.type} 站在 ${game.terrain[u.y][u.x]}`);
      assert(!tr.property, '站在建筑上 ' + seed);
      assert(reachable(game, u).size > 1, '被困住 ' + seed + ' ' + u.type);
    }
    const blue = game.units.filter(u => u.owner === 0), red = game.units.filter(u => u.owner === 1);
    for (const b of blue) assert(red.some(r => r.type === b.type && r.y === b.y && r.x === game.w - 1 - b.x), '没有镜像 ' + seed);
  }
});

console.log(`✓ ${n} 项通过`);
