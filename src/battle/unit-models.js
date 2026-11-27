import {createTank} from '../game/units/tank-family.js';
import {createArtillery} from '../art/units/artillery/artillery-performance.js';
import {createInfantryBaseline} from '../art/units/infantry/infantry-performance.js';
import {createAntiTankBaseline} from '../art/units/infantry/anti-tank-performance.js';

// 单位特写模型（0.62 从 arsenal.js 抽出来，兵工厂转台和战场详细面板的小窗共用同一份缓存）。
// 预览用「原版 / 基线版」高精度模型，不是战场上的批量性能版。目前只有 6 个兵种有模型，其余（侦察车 / 运输车 / 火箭炮 / 防空炮 / 防空导弹）返回 null = 尚未建模。
const MAKE = {
  inf: team => { const u = createInfantryBaseline(); u.setFaction(team); u.setPose('idle'); return u; },
  mech: team => { const u = createAntiTankBaseline(); u.setFaction(team); u.setPose('idle'); return u; },
  tank: team => createTank('light', {faction: team}),
  mdtank: team => createTank('medium', {faction: team}),
  neotank: team => createTank('heavy', {faction: team}),
  arty: team => createArtillery({faction: team, paint: true}),
};
export const hasUnitModel = type => !!MAKE[type];
const cache = new Map();   // 'type|team' → {holder, h} | null（尚未建模）| 'error'
// 返回的 holder 已经缩放到对角线 3.3、脚底落在 y=0、水平居中；同一个 holder 全局只有一个（挂进哪个场景就从原来的场景摘下来），两个界面不会同时开
export function getUnitModel(THREE, type, team) {
  const k = type + '|' + team;
  if (!cache.has(k)) {
    let v = null;
    if (MAKE[type]) {
      try {
        const model = MAKE[type](team), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
        const s = 3.3 / Math.hypot(size.x, size.y, size.z);   // 对角线统一缩放到 3.3：每个兵种都占满展示位（战棋比例不用于特写）
        const holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(s); holder.position.set(-ctr.x * s, -box.min.y * s, -ctr.z * s);
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        v = {holder, h: size.y * s};
      } catch (e) { console.error(e); v = 'error'; }
    }
    cache.set(k, v);
  }
  return cache.get(k);
}
