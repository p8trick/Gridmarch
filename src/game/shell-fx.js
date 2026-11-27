import * as THREE from 'three';
// 1.08 炮弹飞行 + 落点爆炸（间接火力用：自行火炮；火箭炮以后同用）。纯特效、不碰规则：world.js 在炮管开火那一刻调 launch(从炮口, 到目标, {onLand})，
// 炮弹沿抛物线飞到目标格，落地时 onLand 回调并同时放爆炸：闪光球 + 火球 + 地面冲击环 + 烟团上升 + 几块碎石。
// 一次攻击大约 20 个小网格，放完就从场景里拿掉并释放材质（几何体共用）；update 返回「现在还有没有特效在放」，world 据此保持出帧（按需渲染）。
export function createShellFx(scene) {
  const sphere = new THREE.SphereGeometry(1, 10, 8), box = new THREE.BoxGeometry(1, 1, 1), ring = new THREE.RingGeometry(.84, 1, 36).rotateX(-Math.PI / 2);
  const mat = (color, op = 1, add = false) => new THREE.MeshBasicMaterial({color, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending});
  const shells = [], blasts = [], stats = {launched: 0, landed: 0};
  const v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const ease = k => 1 - (1 - k) * (1 - k);
  function add(mesh, group) { mesh.frustumCulled = false; group.push(mesh); scene.add(mesh); return mesh; }

  // 炮弹：亮芯 + 6 个逐渐变小变淡的拖尾球；抛物线高度随距离增加，飞行时间 0.6–1.1 秒
  function launch(from, to, {onLand} = {}) {
    const dist = from.distanceTo(to), T = Math.min(1.1, Math.max(.6, .5 + dist * .06)), h = 1.3 + dist * .42, meshes = [];
    const core = add(new THREE.Mesh(sphere, mat(0xfff3c4, 1, true)), meshes); core.scale.setScalar(.27);
    const trail = []; for (let i = 0; i < 6; i++) { const m = add(new THREE.Mesh(sphere, mat(0xff6a10, .9 - i * .13)), meshes); m.scale.setScalar(.22 - i * .028); trail.push(m); }
    const s = {from: from.clone(), to: to.clone(), T, h, t: 0, meshes, core, trail, hist: [], onLand}; shells.push(s); stats.launched++;
    core.position.copy(from); for (const m of trail) m.position.copy(from);
    return s;
  }
  const posAt = (s, k, out) => out.lerpVectors(s.from, s.to, k).addScaledVector(up, s.h * 4 * k * (1 - k));

  // 爆炸：scale = 1 对应 2 单位一格的地块
  function explode(p, scale = 1) {
    const meshes = [], b = {p: p.clone(), scale, t: 0, meshes, parts: []};
    const flash = add(new THREE.Mesh(sphere, mat(0xfff6cc, 1, true)), meshes); flash.position.copy(p); b.flash = flash;
    const fire = add(new THREE.Mesh(sphere, mat(0xff6a10, .95)), meshes); fire.position.copy(p); b.fire = fire;
    const r = add(new THREE.Mesh(ring, mat(0xffe3b8, .95, true)), meshes); r.position.set(p.x, p.y - .3, p.z); b.ring = r;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.random(), d = (.25 + Math.random() * .6) * scale; const m = add(new THREE.Mesh(sphere, mat(i % 2 ? 0x45413c : 0x6a645c, .8)), meshes); m.position.set(p.x + Math.cos(a) * d, p.y - .1, p.z + Math.sin(a) * d); b.parts.push({m, kind: 'smoke', vy: .8 + Math.random() * .7, d, a, s0: .4 + Math.random() * .2}); }
    for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, sp = (1.4 + Math.random() * 1.6) * scale, m = add(new THREE.Mesh(box, mat(0x3b342c, 1)), meshes); m.scale.setScalar(.11 + Math.random() * .07); m.position.copy(p); b.parts.push({m, kind: 'debris', vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2.4 + Math.random() * 1.8}); }
    blasts.push(b);
  }
  function drop(group) { for (const m of group) { scene.remove(m); m.material.dispose(); } }

  function update(dt) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i]; s.t += dt; const k = Math.min(1, s.t / s.T);
      s.hist.unshift(s.core.position.clone()); if (s.hist.length > 24) s.hist.pop();
      posAt(s, k, s.core.position);
      for (let j = 0; j < s.trail.length; j++) { const h = s.hist[Math.min(s.hist.length - 1, (j + 1) * 3 - 1)]; if (h) s.trail[j].position.copy(h); }
      if (k >= 1) { explode(s.to, 1); stats.landed++; drop(s.meshes); shells.splice(i, 1); if (s.onLand) s.onLand(); }
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i]; b.t += dt; const t = b.t, sc = b.scale;
      const kf = Math.min(1, t / .22); b.flash.scale.setScalar((.5 + ease(kf) * 1.8) * sc); b.flash.material.opacity = 1 - kf;
      const kg = Math.min(1, t / .55); b.fire.scale.setScalar((.3 + ease(kg) * 1.25) * sc); b.fire.material.opacity = .95 * (1 - kg * kg);
      const kr = Math.min(1, t / .4); b.ring.scale.setScalar((.5 + ease(kr) * 2.3) * sc); b.ring.material.opacity = .95 * (1 - kr);
      for (const q of b.parts) {
        if (q.kind === 'smoke') { const k = Math.min(1, t / 1.25); q.m.position.y = b.p.y - .1 + q.vy * t * (1 - .3 * k); q.m.scale.setScalar(q.s0 * (1 + 2.0 * ease(k)) * sc); q.m.material.opacity = .8 * (1 - k) * Math.min(1, t * 6); }
        else { q.m.position.x = b.p.x + q.vx * t; q.m.position.z = b.p.z + q.vz * t; q.m.position.y = b.p.y + q.vy * t - 4.8 * t * t; q.m.material.opacity = Math.max(0, 1 - t / .7); q.m.rotation.x = t * 9; q.m.rotation.y = t * 7; }
      }
      if (t >= 1.3) { drop(b.meshes); blasts.splice(i, 1); }
    }
    return shells.length > 0 || blasts.length > 0;
  }
  return {launch, explode, update, stats, busy: () => shells.length > 0 || blasts.length > 0};
}
