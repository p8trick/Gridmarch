// 步兵 / 反坦克步兵（V6.12P / AT V1.6P：F1 侧脸 + B1 军靴 + W2 左手 + 全身四色）的集成层。
// 两类单位各用一个实例批量绘制批（阵营色在批内按几何 / 材质分桶，蓝红可同屏）。
// 对世界代码仍是同一个 actor 接口（setMode / advance / shoot / update / clip / mode / root）：
// 模型本体不进场景图，actor.root 只是一个不可见的包围盒占位，挂在 holder 下用来量尺寸、跟随位置；
// 每帧渲染前 syncInfantryBatches() 把占位的世界变换拷给逻辑单位，再统一刷新各批的实例矩阵。
import * as THREE from 'three';
import {prepareInfantryPerformance, createPerformanceInfantry} from '../../art/units/infantry/infantry-performance.js';
import {createInfantryBatch} from '../../art/units/infantry/infantry-batch.js';
import {createInfantryFire} from '../../art/units/infantry/infantry-fire.js';
import {prepareAntiTankPerformance, createPerformanceAntiTank, createPerformanceAntiTankFire} from '../../art/units/infantry/anti-tank-performance.js';
import {createAntiTankBatch} from '../../art/units/infantry/anti-tank-batch.js';

const CAPACITY = 80;   // 每类最多同屏 80 个（0.88：每方单位上限 40 × 两方，最坏情况全是同一类步兵；批的容量超出会抛 'Capacity exceeded'，0.87 及以前是 24，造到约 20 个步兵就红色横幅报错）
const batches = {}, actors = [], pool = {}; let sceneRef = null, prepared = false;   // pool：被拿掉的单位的 actor 留着复用（见 releaseInfantryActor）

export function resetInfantryBatches(scene) {   // 每次建世界先清空旧批
  for (const b of Object.values(batches)) { b.root.removeFromParent(); b.dispose?.(); }
  for (const k of Object.keys(batches)) delete batches[k];
  actors.length = 0; for (const k of Object.keys(pool)) delete pool[k]; sceneRef = scene;
  if (!prepared) { prepareInfantryPerformance(); prepareAntiTankPerformance(); prepared = true; }   // 预热共享缓存：一次
}
const batchFor = kind => {
  if (!batches[kind]) { batches[kind] = kind === 'at' ? createAntiTankBatch({capacity: CAPACITY}) : createInfantryBatch({capacity: CAPACITY}); sceneRef?.add(batches[kind].root); }
  return batches[kind];
};
const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
export function syncInfantryBatches() {
  for (const a of actors) { if (a.released) { a.unit.visible = false; continue; } a.root.updateWorldMatrix(true, false); a.root.matrixWorld.decompose(a.unit.position, a.unit.quaternion, a.unit.scale); a.unit.visible = shown(a.root); }
  for (const b of Object.values(batches)) b.sync();
}

// 步兵不在场景图里（实例批量绘制），世界统计的三角形要单独加上：每个可见单位的待机三角形数
export const infantryTriCount = () => actors.reduce((n, a) => n + (!a.released && shown(a.root) ? a.tris : 0), 0);

// 0.90：单位被拿掉（合流 / 不放动画的击杀）时，实例批里的那一份并不会消失——美术批只有 addUnit、没有 remove，模型会留在原地成「残影」，
// 而且批容量（CAPACITY）是「累计加入过多少个」，一局里造了又死的步兵总数超过容量就会报 Capacity exceeded。
// 所以不真删：release 把 actor 标成隐藏并放进空闲池，下次同类（步兵 / 反坦克）同阵营造单位时直接复用这一份（颜色按阵营烘在批里，所以池按「类型 + 阵营」分）。
export function releaseInfantryActor(actor) {
  if (actor.released) return;
  // 灰度归零：复用时新单位的灰度缓动从 0 开始，不会继承上一个单位的灰
  actor.released = true; actor.root.removeFromParent(); actor.unit.visible = false; actor.unit.userData.gray = 0; (pool[actor.key] ||= []).push(actor);
}
export const infantryPoolSizes = () => Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, v.length]));   // 调试 / 测试用：空闲池里各类型各阵营有几个
export function createInfantryActor(team, type = 'basic') {
  const at = type === 'at', faction = team;   // 'blue' | 'red' | 'green' | 'yellow'
  const key = (at ? 'at:' : 'basic:') + team, free = pool[key]?.pop();
  if (free) { free.released = false; free.phase = 0; free.setMode('idle'); return free; }
  const unit = at ? createPerformanceAntiTank({faction}) : createPerformanceInfantry({faction});
  if (at) unit.setRocketAmmo(1);   // 测试页：有弹 = 火箭筒开火（弹药扣减归游戏逻辑）
  const fire = at ? createPerformanceAntiTankFire(unit) : createInfantryFire(unit); fire.setReadabilityScale?.(1.35);
  unit.setPose('idle'); unit.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(unit), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const root = new THREE.Group(); root.name = (at ? 'AntiTank' : 'Infantry') + '_proxy';
  const bounds = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({visible: false})); bounds.visible = false; bounds.position.copy(ctr); root.add(bounds);
  batchFor(at ? 'at' : 'basic').addUnit(unit, fire);
  const actor = {
    root, unit, fire, key, released: false, mode: 'idle', phase: 0,
    clip: name => unit.userData.cycles[name],
    setMode(mode) { if (fire.active || fire.hasClip) fire.cancel(); actor._wait = 0; actor.mode = mode; if (mode === 'walk' || mode === 'run') unit.sampleCycle(mode, actor.phase); else unit.setPose(mode); },
    advance(dt, rate = 1) { if (actor.mode !== 'walk' && actor.mode !== 'run') return; actor.phase = (actor.phase + dt / actor.clip(actor.mode).duration * rate) % 1; unit.sampleCycle(actor.mode, actor.phase); },
    shoot(shots = 1, delay = 0) {
      if (actor.mode !== 'aim' && actor.mode !== 'kneel') actor.setMode('aim');
      if (delay > 0) { actor._wait = delay; actor._shots = shots; } else fire.start({pose: actor.mode, shots});
    },
    update(dt) {
      if (actor._wait > 0) { actor._wait -= dt; if (actor._wait <= 0) fire.start({pose: actor.mode, shots: actor._shots}); return true; }
      if (fire.active) { fire.update(dt); return true; }
      return false;
    },
  };
  actor.tris = 0; unit.traverse(o => { if (o.isMesh && shown(o)) { const g = o.geometry; actor.tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });   // 待机可见三角形（不含特效）
  actors.push(actor); return actor;
}
