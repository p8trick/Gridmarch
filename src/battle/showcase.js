import {BLOCK_BOTTOM} from './tile-block.js';

// 展示窗的「摄影棚」（0.62）：每个窗口一个独立的小场景，不看战场。暖米色径向渐变背景 + 三点布光 + 软落影（同兵工厂转台），
// 模型放在转台 turn 上，手指拖动转 turn（灯光不跟着转，阴影方向才稳定）；相机固定。
// kind = 'unit'（单位：脚底 y=0）/ 'tile'（厚地块：底面 y=BLOCK_BOTTOM，脚下落影放在底面）。
export function createStudio(THREE, kind) {
  const scene = new THREE.Scene();
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  scene.background = mk(256, 256, (x, w, h) => { const g = x.createRadialGradient(w * .5, h * .42, 8, w * .5, h * .5, w * .78); g.addColorStop(0, '#f6ead0'); g.addColorStop(.6, '#e2d0a8'); g.addColorStop(1, '#bba67c'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scene.add(new THREE.HemisphereLight(0xfff4de, 0x9a8a6a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.7); sun.position.set(-4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 22}); sun.shadow.bias = -.0004; sun.shadow.radius = 5; sun.shadow.normalBias = .02; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa9c6ff, .9); fill.position.set(6, 3, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2); rim.position.set(2, 5, -7); scene.add(rim);
  const base = new THREE.Group(); base.position.y = kind === 'tile' ? BLOCK_BOTTOM : 0; scene.add(base);
  const turn = new THREE.Group(); scene.add(turn);
  const blobTex = mk(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(70,50,20,.5)'); g.addColorStop(.55, 'rgba(70,50,20,.2)'); g.addColorStop(1, 'rgba(70,50,20,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(kind === 'tile' ? 7.4 : 6.6, kind === 'tile' ? 7.4 : 6.6), new THREE.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false}));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .003; base.add(blob);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({opacity: .38}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = .006; floor.receiveShadow = true; base.add(floor);
  const cam = new THREE.PerspectiveCamera(28, 1.4, .1, 60);
  const cfg = kind === 'tile' ? {ty: -.05, d: 8.6, pitch: 28, yaw: .72} : {ty: .8, d: 6.6, pitch: 18, yaw: .5};
  // 取景自动适配（0.64）：按模型包围盒定相机注视点和距离，高个子（步兵、树林）不再被窗口上沿截掉头；矮的模型保持原来的基准距离，各地块大小才不会忽大忽小
  let fit = {ty: cfg.ty, r: 0};
  function setContent(obj) {
    turn.clear(); fit = {ty: cfg.ty, r: 0}; if (!obj) return;
    turn.add(obj); turn.rotation.y = 0; obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) return;
    const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    fit = {ty: kind === 'tile' ? (box.min.y + box.max.y) / 2 : Math.max(cfg.ty, box.max.y * .5), r: Math.hypot(sz.x, sz.z) / 2, h: box.max.y - box.min.y, top: box.max.y, bot: box.min.y};
  }
  // 画进当前 renderer 的一个矩形（调用方已设好 viewport / scissor）
  function draw(renderer, aspect, yaw, pitch) {
    cam.aspect = aspect; cam.updateProjectionMatrix();
    const p = pitch * Math.PI / 180, ty = fit.ty;
    // 距离：至少是基准距离；模型的上下范围（以注视点为中心的半高，加一点边距）和转到任意角度时的水平半径都要装进视野
    const half = Math.max(fit.top - ty, ty - fit.bot, 0) * 1.12 + .12, vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * aspect);
    const d = Math.max(cfg.d, half / Math.sin(vf) / Math.cos(p * .5) * .92, (fit.r * 1.08) / Math.sin(hf));
    cam.position.set(0, ty + Math.sin(p) * d, Math.cos(p) * d); cam.lookAt(0, ty, 0);
    turn.rotation.y = yaw; renderer.render(scene, cam);
  }
  return {scene, setContent, draw, defaults: {yaw: cfg.yaw, pitch: cfg.pitch}};
}
