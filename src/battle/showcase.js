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
  const cfg = kind === 'tile' ? {ty: -.3, d: 9.4, pitch: 28, yaw: .72} : {ty: .8, d: 6.6, pitch: 18, yaw: .5};
  function setContent(obj) { turn.clear(); if (obj) turn.add(obj); }
  // 画进当前 renderer 的一个矩形（调用方已设好 viewport / scissor）
  function draw(renderer, aspect, yaw, pitch) {
    cam.aspect = aspect; cam.updateProjectionMatrix();
    const p = pitch * Math.PI / 180; cam.position.set(0, cfg.ty + Math.sin(p) * cfg.d, Math.cos(p) * cfg.d); cam.lookAt(0, cfg.ty, 0);
    turn.rotation.y = yaw; renderer.render(scene, cam);
  }
  return {scene, setContent, draw, defaults: {yaw: cfg.yaw, pitch: cfg.pitch}};
}
