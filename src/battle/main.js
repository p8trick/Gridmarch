import * as THREE from 'three';
import {buildWorld} from '../game/world.js';
import {makeLevel1} from '../game/levels/level1.js';
import {TacticalCamera, CAMERA} from './camera.js';
import {Stage} from './stage.js';

// 战场入口（正式游戏的页面层）：关卡 → 世界 → 相机 → 触控。规则引擎接入前，这里只负责把战场"摆出来、看得清、转得动"。
const $ = id => document.getElementById(id);
const stage = new Stage($('stage'));   // 虚拟横屏舞台：iPhone 系统竖屏时整个画面转 90°；系统横屏 / iPad 真横屏时原样（见 stage.js）
const err = $('err');
const showErr = m => { err.style.display = 'block'; err.textContent = '出错：' + m; };
addEventListener('error', e => showErr(e.message || e.error));
addEventListener('unhandledrejection', e => showErr(e.reason && e.reason.message || e.reason));

// 建世界要同步算 2–3 秒（水域最重）：先让"正在生成战场…"画到屏幕上，再开始算
await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));

// ── 关卡：?seed=N 固定地图；不带参数每次随机一个种子（左下角会显示，想复现就把它写进网址）──
const q = new URLSearchParams(location.search);
const seed = Math.max(1, parseInt(q.get('seed')) || (1 + Math.floor(Math.random() * 999999)));
const preset = makeLevel1(seed);
const world = buildWorld({preset});
const L = preset.layout;
world.setShadowRadius(27);   // 视距 9 格时画面对角约 ±18：阴影范围放大到 ±27（2048 贴图下仍是每格 ~80 像素）

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('stage').prepend(renderer.domElement);
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
const debug = q.has('debug');
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
$('bReroll').onclick = () => { const n = new URLSearchParams(location.search); n.set('seed', 1 + Math.floor(Math.random() * 999999)); location.search = n.toString(); };

// ── 触控：单指平移，双指缩放（松手吸附最近一档），轻点选格 ──
// clientX/Y 是物理屏幕坐标：舞台被旋转时要先用 stage.toLogical 换成舞台坐标，位移、间距都从换算后的坐标算
const P = e => stage.toLogical(e.clientX, e.clientY);
const pts = new Map(); let prevD = 0, tap = null, pinched = false, wheelTimer = 0;
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
cv.onwheel = e => { e.preventDefault(); cam.zoomBy(Math.exp(e.deltaY * .001)); hud(); mark(); clearTimeout(wheelTimer); wheelTimer = setTimeout(() => { cam.snap(); mark(); }, 180); };
stage.onChange(resize);   // 舞台尺寸 / 旋转变化时重设画布和相机宽高比
// 「换边」按钮：只在舞台被旋转时出现；画面上下颠倒了就点一下（选择会记住）
const syncSide = () => { $('bSide').style.display = stage.rot ? '' : 'none'; };
stage.onChange(syncSide); syncSide();
$('bSide').onclick = () => stage.toggleSide();

// ── 主循环（按需渲染：没有动画 / 没有操作时不出帧）──
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
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
resize(); applyView(); hud(); requestAnimationFrame(loop);
requestAnimationFrame(() => requestAnimationFrame(() => $('loading')?.remove()));   // 第一帧画出来之后再撤掉加载提示
window.battle = {world, cam, preset, THREE};   // 调试：控制台可直接读取
