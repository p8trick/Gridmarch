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

const CAPACITY = 24;   // 每类最多同屏 24 个（包的约定容量；超出会抛错）
const batches = {}, actors = []; let sceneRef = null, prepared = false;

export function resetInfantryBatches(scene) {   // 每次建世界先清空旧批
  for (const b of Object.values(batches)) { b.root.removeFromParent(); b.dispose?.(); }
  for (const k of Object.keys(batches)) delete batches[k];
  actors.length = 0; sceneRef = scene;
  if (!prepared) { prepareInfantryPerformance(); prepareAntiTankPerformance(); prepared = true; }   // 预热共享缓存：一次
}
const batchFor = kind => {
  if (!batches[kind]) { batches[kind] = kind === 'at' ? createAntiTankBatch({capacity: CAPACITY}) : createInfantryBatch({capacity: CAPACITY}); sceneRef?.add(batches[kind].root); }
  return batches[kind];
};
const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
export function syncInfantryBatches() {
  for (const a of actors) { a.root.updateWorldMatrix(true, false); a.root.matrixWorld.decompose(a.unit.position, a.unit.quaternion, a.unit.scale); a.unit.visible = shown(a.root); }
  for (const b of Object.values(batches)) b.sync();
}

// 步兵不在场景图里（实例批量绘制），世界统计的三角形要单独加上：每个可见单位的待机三角形数
export const infantryTriCount = () => actors.reduce((n, a) => n + (shown(a.root) ? a.tris : 0), 0);

export function createInfantryActor(team, type = 'basic') {
  const at = type === 'at', faction = team;   // 'blue' | 'red' | 'green' | 'yellow'
  const unit = at ? createPerformanceAntiTank({faction}) : createPerformanceInfantry({faction});
  if (at) unit.setRocketAmmo(1);   // 测试页：有弹 = 火箭筒开火（弹药扣减归游戏逻辑）
  const fire = at ? createPerformanceAntiTankFire(unit) : createInfantryFire(unit); fire.setReadabilityScale?.(1.35);
  unit.setPose('idle'); unit.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(unit), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const root = new THREE.Group(); root.name = (at ? 'AntiTank' : 'Infantry') + '_proxy';
  const bounds = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({visible: false})); bounds.visible = false; bounds.position.copy(ctr); root.add(bounds);
  batchFor(at ? 'at' : 'basic').addUnit(unit, fire);
  const actor = {
    root, unit, fire, mode: 'idle', phase: 0,
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
