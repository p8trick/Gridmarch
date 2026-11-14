import * as THREE from 'three';
import {buildWorld} from '../game/world.js';
import {makeLevel1} from '../game/levels/level1.js';
import {TacticalCamera, CAMERA} from './camera.js';
import {stageDebug, onLongPress} from './stage.js';

// 战场（正式游戏的页面层）：关卡 → 世界 → 相机 → 触控。规则引擎接入前，这里只负责把战场"摆出来、看得清、转得动"。
// 0.30 起战场不再是独立 html，而是主页（index.html）里的一个"视图"：mountBattle 把战场挂进 host、unmountBattle 拆掉并释放显存。
// 整个游戏始终只有一个 html 文档，不发生页面跳转 —— 这样 iOS 的左 / 右边缘滑动（系统前进 / 后退手势）没有历史可翻，自然不会触发。
// 舞台（虚拟横屏）由主页创建，全程共用同一个 Stage，这里只借用，不创建、不销毁。
let current = null;   // 当前挂着的战场（同时只会有一个）
export function unmountBattle() { if (current) { current.destroy(); current = null; } }

// host：容纳战场的容器（#battle）；stage：共用的舞台；opts：{seed, debug, onExit}
export async function mountBattle(host, stage, opts = {}) {
  unmountBattle();
  let alive = true, raf = 0, wheelTimer = 0, renderer = null, world = null;
  const handle = {destroy};
  current = handle;
  host.innerHTML = `<div id="ui">
  <div id="top">
    <div class="grp"><button class="btn" id="bBack">‹ 主页</button><button class="btn" id="bSide" style="display:none" aria-label="画面上下颠倒时点这里换边">换边</button></div>
    <div class="grp"><button class="btn" id="bRotL" aria-label="向左转90度">⟲</button><button class="btn" id="bRotR" aria-label="向右转90度">⟳</button><button class="btn" id="bZoom">视距</button><button class="btn" id="bReroll">换图</button></div>
  </div>
  <div id="info"></div>
</div>
<div id="err"></div>
<div id="loading">正在生成战场…</div>`;
  const $ = id => host.querySelector('#' + id);
  const err = $('err');
  const showErr = m => { err.style.display = 'block'; err.textContent = '出错：' + m; };
  const onErr = e => showErr(e.message || e.error), onRej = e => showErr(e.reason && e.reason.message || e.reason);
  addEventListener('error', onErr); addEventListener('unhandledrejection', onRej);

  // 建世界要同步算 2–3 秒（水域最重）：先让"正在生成战场…"画到屏幕上，再开始算
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  if (!alive) return handle;

// ── 关卡：opts.seed 固定地图（网址 index.html?go=battle&seed=N）；不给就每次随机一个种子（左下角会显示，想复现就记下来）──
const seed = Math.max(1, parseInt(opts.seed) || (1 + Math.floor(Math.random() * 999999)));
const preset = makeLevel1(seed);
world = buildWorld({preset});
const L = preset.layout;
world.setShadowRadius(27);   // 视距 9 格时画面对角约 ±18：阴影范围放大到 ±27（2048 贴图下仍是每格 ~80 像素）

renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.prepend(renderer.domElement);
const cv = renderer.domElement;

// ── 相机：棋盘外缘 = 平移范围；开局看蓝方基地一侧 ──
const bounds = {x0: preset.x[0] * 2 - 1, x1: preset.x[1] * 2 + 1, z0: preset.z[0] * 2 - 1, z1: preset.z[1] * 2 + 1};
const hq = L.buildings.find(b => b.type === 'bld_hq' && b.owner === 'blue').cell;
const cam = new TacticalCamera({bounds, target: [hq[0] * 2 + 10, hq[1] * 2], cells: 7});

let dirty = true, lastQuarter = -1;
const mark = () => { dirty = true; };
function applyView() {   // 视角象限变化时才重排建筑朝向 / 附楼（旋转动画里只在过 45° 的那一刻发生一次）
  if (cam.quarter !== lastQuarter) { lastQuarter = cam.quarter; world.apply(cam.camA); }
}
function resize() { renderer.setSize(stage.w, stage.h); cam.resize(stage.w, stage.h); mark(); }

// ── 点格子：显示地形信息 + 黄框 ──
const key = c => c[0] + ',' + c[1];
const sets = {road: new Set(L.roads.map(key)), mountain: new Set(L.mountain.map(key)), bridge: new Set((preset.bridges || []).flatMap(b => b.cells).map(key)), desert: new Set((L.desert || []).map(key)), swamp: new Set((L.swamp || []).map(key)), forest: new Set(L.forestExtra.map(key))};
const WATER = {sea: '海', shoal: '浅滩', cliff: '断崖', river: '河'};
function describe(c) {
  const k = key(c), b = world.bldMap.get(k), w = world.water.typeAt(c[0], c[1]);
  const t = b ? b.name : sets.bridge.has(k) ? '桥' : sets.mountain.has(k) ? '山地' : sets.desert.has(k) ? '沙漠' : sets.swamp.has(k) ? '沼泽' : sets.forest.has(k) ? '树林' : WATER[w] || (sets.road.has(k) ? '公路' : '平原');
  return `(${c[0]}, ${c[1]}) ${t}`;
}
const marker = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-.95, 0, -.95], [.95, 0, -.95], [.95, 0, .95], [-.95, 0, .95]].map(p => new THREE.Vector3(...p))),
  new THREE.LineBasicMaterial({color: 0xffe08a, depthTest: false}));
marker.renderOrder = 30; marker.visible = false; world.scene.add(marker);
let picked = null;
const raycaster = new THREE.Raycaster();
function handleTap(px, py) {
  raycaster.setFromCamera(new THREE.Vector2(px / stage.w * 2 - 1, -(py / stage.h) * 2 + 1), cam.cam);
  const c = world.cellFromRay(raycaster.ray);
  const inside = c && c[0] >= preset.x[0] && c[0] <= preset.x[1] && c[1] >= preset.z[0] && c[1] <= preset.z[1];
  picked = inside ? c : null;
  if (picked) marker.position.set(c[0] * 2, world.groundY(c[0], c[1]) + .08, c[1] * 2);
  marker.visible = !!picked; hud(); mark();
}

// ── HUD ──
const debug = !!opts.debug;
let fps = 0, frames = 0, t0 = performance.now();
const cellsTxt = () => Math.round(cam.cells * 10) / 10;
function hud() {
  $('bZoom').textContent = '视距 ' + cellsTxt() + '格';
  $('info').textContent = `${preset.name} · 种子 ${seed} · 视距 ${cellsTxt()}格` + (picked ? `\n${describe(picked)}` : '') +
    (debug ? `\n${fps.toFixed(0)}fps · ${renderer.info.render.triangles}△ · ${renderer.info.render.calls}绘制` : '');
}
$('bRotL').onclick = () => { cam.rotate(-1); mark(); };
$('bRotR').onclick = () => { cam.rotate(1); mark(); };
$('bZoom').onclick = () => { cam.cycleZoom(); mark(); };
$('bReroll').onclick = () => mountBattle(host, stage, {...opts, seed: 1 + Math.floor(Math.random() * 999999)});   // 换图：原地重建（不刷新页面、不产生历史记录）
$('bBack').onclick = () => { unmountBattle(); if (opts.onExit) opts.onExit(); };

// ── 触控：单指平移，双指缩放（松手吸附最近一档），轻点选格 ──
// clientX/Y 是物理屏幕坐标：舞台被旋转时要先用 stage.toLogical 换成舞台坐标，位移、间距都从换算后的坐标算
const P = e => stage.toLogical(e.clientX, e.clientY);
const pts = new Map(); let prevD = 0, tap = null, pinched = false;
cv.onpointerdown = e => { const p = P(e); pts.set(e.pointerId, [p.x, p.y]); cv.setPointerCapture(e.pointerId); prevD = 0; tap = pts.size === 1 ? {x: p.x, y: p.y, t: performance.now(), moved: 0} : null; };
cv.onpointermove = e => {
  if (!pts.has(e.pointerId)) return;
  const p = P(e), old = pts.get(e.pointerId); pts.set(e.pointerId, [p.x, p.y]);
  if (tap) { tap.moved = Math.max(tap.moved, Math.hypot(p.x - tap.x, p.y - tap.y)); if (pts.size > 1) tap = null; }
  if (pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    pinched = true; if (prevD) cam.zoomBy(prevD / d); prevD = d; hud(); mark();
  } else { cam.pan(p.x - old[0], p.y - old[1], stage.w); mark(); }   // 位移 < 8px 且很快抬手算点按（见 endPointer）
};
const endPointer = (e, allowTap) => {
  const t = tap; pts.delete(e.pointerId); prevD = 0; tap = null;
  if (pinched && pts.size < 2) { pinched = false; cam.snap(); mark(); }
  if (allowTap && t && t.moved < 8 && performance.now() - t.t < 500) { const p = P(e); handleTap(p.x, p.y); }
};
cv.onpointerup = e => endPointer(e, true);
cv.onpointercancel = e => endPointer(e, false);
cv.onwheel = e => { e.preventDefault(); cam.zoomBy(Math.exp(e.deltaY * .001)); hud(); mark(); clearTimeout(wheelTimer); wheelTimer = setTimeout(() => { if (alive) { cam.snap(); mark(); } }, 180); };
stage.onChange(resize);   // 舞台尺寸 / 旋转变化时重设画布和相机宽高比
// 「换边」按钮：只在舞台被旋转时出现；画面上下颠倒了就点一下（选择会记住）
const syncSide = () => { $('bSide').style.display = stage.rot ? '' : 'none'; };
stage.onChange(syncSide); syncSide();
onLongPress($('bSide'), () => stageDebug(stage));   // 长按「换边」0.8 秒：现场诊断（排查竖屏黑边用）
$('bSide').onclick = () => stage.toggleSide();

// ── 主循环（按需渲染：没有动画 / 没有操作时不出帧）──
let lastT = performance.now();
function loop(now) {
  if (!alive) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  const camChanged = cam.update(dt);
  if (camChanged) { applyView(); hud(); dirty = true; }
  const up = world.update(dt, cam.camA); if (up.moving) dirty = true;
  if (dirty) {
    dirty = false; cam.place(); world.sunFollow(cam.target.x, cam.target.z); world.cull(cam.cam); world.beforeRender();
    renderer.render(world.scene, cam.cam); frames++;
  }
  if (now - t0 > 1000) { fps = frames * 1000 / (now - t0); frames = 0; t0 = now; if (debug) hud(); }
}
resize(); applyView(); hud(); raf = requestAnimationFrame(loop);
requestAnimationFrame(() => requestAnimationFrame(() => { const l = host.querySelector('#loading'); if (l) l.remove(); }));   // 第一帧画出来之后再撤掉加载提示
window.battle = {world, cam, preset, THREE};   // 调试：控制台可直接读取

// ── 拆除：退出 / 换图时调用。停循环、摘监听、释放显存（世界、渲染器、WebGL 上下文），主页和下一局才不会越用越卡 ──
function destroy() {
  if (!alive) return; alive = false;
  cancelAnimationFrame(raf); clearTimeout(wheelTimer);
  removeEventListener('error', onErr); removeEventListener('unhandledrejection', onRej);
  stage.offChange(resize); stage.offChange(syncSide);
  if (stage.dbg) stage.dbg.close();
  if (world) {
    const seen = new Set();
    world.scene.traverse(o => {
      if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        if (!m || seen.has(m)) continue; seen.add(m);
        for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose();
      }
    });
  }
  if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); renderer.domElement.remove(); }
  host.innerHTML = '';
  if (window.battle && window.battle.world === world) delete window.battle;
}
return handle;
}
