import * as THREE from 'three';
import {buildWorld} from '../game/world.js';

const $ = id => document.getElementById(id);
const err = $('err');
addEventListener('error', e => { err.style.display = 'block'; err.textContent = '出错：' + (e.message || e.error); });
addEventListener('unhandledrejection', e => { err.style.display = 'block'; err.textContent = '出错：' + (e.reason && e.reason.message || e.reason); });

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

let frozen = false;   // 调试：?fire=秒 时让全部单位开火并推进到该时刻后冻结，便于截图
const MAPS = ['bay', 'estuary', 'island', 'island-cliff', 'island-mixed', 'island-split', 'shapes'], MAP_LABEL = {bay: '海湾', estuary: '河口·河桥', island: '群岛·浅滩', 'island-cliff': '群岛·断崖', 'island-mixed': '群岛·两岛混合', 'island-split': '群岛·岛内混合', shapes: '形状陈列'};
const MAP_NAME = MAPS.includes(new URLSearchParams(location.search).get('map')) ? new URLSearchParams(location.search).get('map') : 'bay';   // ?map=bay|estuary|island|island-cliff
const world = buildWorld({map: MAP_NAME});
const camera = new THREE.OrthographicCamera();
const target = new THREE.Vector3(-1, 0, -1);
let angle = 0, pitch = 55, span = 14, spanTarget = null, pinched = false, wheelTimer = 0;
const ZOOMS = [10, 14, 18];
const zoomLabel = () => { $('bZoom').textContent = '视距 ' + Math.round(span / 2 * 10) / 10 + '格'; };
const snapSpan = () => { let b = ZOOMS[0]; for (const z of ZOOMS) if (Math.abs(z - span) < Math.abs(b - span)) b = z; spanTarget = b; mark(); };
const camA = () => angle + Math.PI * .08;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  const a = innerWidth / innerHeight;
  camera.left = -span / 2; camera.right = span / 2; camera.top = span / (2 * a); camera.bottom = -span / (2 * a);
  camera.near = .1; camera.far = 150; camera.updateProjectionMatrix();
}
function place() {
  const a = camA(), e = pitch * Math.PI / 180;
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(a) * Math.cos(e) * 30, Math.sin(e) * 30, Math.cos(a) * Math.cos(e) * 30));
  camera.lookAt(target);
}
let info = {cleared: 0, yielded: 0};
let onDemand = true, dirty = true, renders = 0, lastMs = 0, lastAnim = 0, cullInfo = {inView: 12, total: 12};
const mark = () => { dirty = true; };
function refresh() { info = world.apply(camA()); mark(); }

const st = world.stats();
const selText = () => { const u = world.state.selected; if (u) return `选中：${u.holder.name} ｜ 移动力 ${world.MOVE[world.tkey(u)]} ｜ 点亮格可移动，点空白取消`; return world.units.some(x => x.path) ? '移动中…' : '点击单位选中，再点高亮格移动'; };
let frames = 0, t0 = performance.now(), fps = 0, lastRenders = 0;
function hud() {
  const head = onDemand
    ? (world.state.idle ? `按需渲染（待机动画中，上限30帧）` : `按需渲染 开`) + ` ｜ 近1秒 ${renders - lastRenders} 帧 ｜ 提交 ${lastMs.toFixed(1)}ms`
    : `持续渲染 ｜ ${fps.toFixed(0)} fps ｜ 单帧提交 ${lastMs.toFixed(1)}ms`;
  $('hud').textContent =
    head + `\n本帧 ${renderer.info.render.triangles} △ ｜ ${renderer.info.render.calls} 次绘制 ｜ 屏内单位 ${cullInfo.inView}/${cullInfo.total}\n` +
    `${selText()}\n林间空地 ${info.cleared} 棵让位，半透明 ${info.faded || 0}，挤开 ${info.moved || 0}`;
}
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = frozen ? 0 : Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (spanTarget !== null) { span += (spanTarget - span) * Math.min(1, dt * 14); if (Math.abs(span - spanTarget) < .02) { span = spanTarget; spanTarget = null; } resize(); zoomLabel(); dirty = true; }
  const up = world.update(dt, camA()); if (up.moving) { dirty = true; if (up.info) info = up.info; }
  if (world.state.idle && now - lastAnim > 33) { world.animate(now / 1000); lastAnim = now; dirty = true; }
  if (dirty || !onDemand) {
    dirty = false; place(); cullInfo = world.cull(camera); world.beforeRender();
    const a = performance.now(); renderer.render(world.scene, camera); lastMs = performance.now() - a;
    renders++; frames++;
  }
  if (now - t0 > 1000) { fps = frames * 1000 / (now - t0); frames = 0; t0 = now; hud(); lastRenders = renders; }
}

function bindSlider(id, vid, key) {
  $(id).oninput = e => { const v = e.target.value / 100; world.state[key] = v; $(vid).textContent = v.toFixed(2); refresh(); };
}
bindSlider('sArtK', 'vArtK', 'artK');
$('sArtE').oninput = e => { world.state.artElev = +e.target.value; $('vArtE').textContent = e.target.value + '°'; refresh(); };
bindSlider('sTree', 'vTree', 'treeK'); bindSlider('sMtn', 'vMtn', 'mtnK'); bindSlider('sUnit', 'vUnit', 'unitK');
const toggle = (id, key) => { $(id).onclick = () => { world.state[key] = !world.state[key]; $(id).classList.toggle('on', world.state[key]); refresh(); }; };
$('bMap').textContent = '地图：' + MAP_LABEL[MAP_NAME];
$('bMap').onclick = () => { const q = new URLSearchParams(location.search); q.set('map', MAPS[(MAPS.indexOf(MAP_NAME) + 1) % MAPS.length]); location.search = q.toString(); };
$('bSand').onclick = () => { world.state.sandbox = !world.state.sandbox; $('bSand').classList.toggle('on', world.state.sandbox); refresh(); };
// 面板三档：全部 → 只留按钮（数值条收起，画面最大）→ 全隐藏（含状态栏）→ 全部
let foldLv = 0;
const applyFold = () => {
  document.querySelectorAll('#bar .sl').forEach(e => { e.style.display = foldLv === 1 ? 'none' : ''; });
  $('bar').style.display = foldLv === 2 ? 'none' : ''; $('hud').style.display = foldLv === 2 ? 'none' : '';
  $('bFold').textContent = ['面板', '面板·键', '面板·隐'][foldLv];
};
$('bFold').onclick = () => { foldLv = (foldLv + 1) % 3; applyFold(); };
toggle('bBldFollow', 'bldFollow'); toggle('bAnnex', 'annexPush'); toggle('bTerrBadge', 'terrBadges');
$('bTree').onclick = () => { const s = world.state; s.treeMode = (s.treeMode + 1) % 3; $('bTree').textContent = world.TREE_LABELS[s.treeMode]; refresh(); hud(); };
$('bSize').onclick = () => { const s = world.state; s.sizeMode = (s.sizeMode + 1) % 2; $('bSize').textContent = world.SIZE_LABELS[s.sizeMode]; refresh(); hud(); };
toggle('bFloor', 'floorTint');
for (const [id, key] of [['kInf', 'inf'], ['kLight', 'light'], ['kMedium', 'medium'], ['kHeavy', 'heavy'], ['kArt', 'art']])
  $(id).oninput = e => { world.state.clsK[key] = e.target.value / 100; $('v' + id).textContent = (e.target.value / 100).toFixed(2); if (world.state.sizeMode !== 1) { world.state.sizeMode = 1; $('bSize').textContent = world.SIZE_LABELS[1]; } refresh(); };
const PITCHES = [55, 62, 70];
$('bPitch').onclick = () => { pitch = PITCHES[(PITCHES.indexOf(pitch) + 1) % 3]; $('bPitch').textContent = '俯角 ' + pitch + '°'; mark(); };
toggle('bCull', 'cull'); toggle('bBadge', 'badges'); toggle('bIdle', 'idle'); toggle('bRing', 'rings'); toggle('bUnits', 'units');
const INF_POSES = [['idle', '站立'], ['aim', '瞄准'], ['kneel', '跪射']];
$('bInfPose').onclick = () => { const s = world.state; const i = (INF_POSES.findIndex(p => p[0] === s.infPose) + 1) % 3; world.setInfPose(INF_POSES[i][0]); $('bInfPose').textContent = '步兵:' + INF_POSES[i][1]; mark(); };
$('bInfGait').onclick = () => { const s = world.state; s.infGait = s.infGait === 'run' ? 'walk' : 'run'; $('bInfGait').textContent = '步态:' + (s.infGait === 'run' ? '跑' : '走'); };
$('bFire1').onclick = () => { world.fireInfantry(1); mark(); };
$('bFire3').onclick = () => { world.fireInfantry(3); mark(); };
$('bRot').onclick = () => { angle += Math.PI / 2; refresh(); };
$('bOnDemand').onclick = () => { onDemand = !onDemand; $('bOnDemand').classList.toggle('on', onDemand); mark(); };
$('bZoom').onclick = () => { let i = 0; for (let k = 0; k < 3; k++) if (Math.abs(ZOOMS[k] - span) < Math.abs(ZOOMS[i] - span)) i = k; spanTarget = ZOOMS[(i + 1) % 3]; mark(); };
$('bReset').onclick = () => { angle = 0; pitch = 55; $('bPitch').textContent = '俯角 55°'; span = 14; spanTarget = null; target.set(-1, 0, -1); world.deselect(); zoomLabel(); resize(); refresh(); };

// 触屏：单指平移，双指缩放
const pts = new Map(); let prevD = 0, tap = null;
const _v = new THREE.Vector3(), _rc = new THREE.Raycaster();
function pickUnit(px, py) {
  let best = null, bd = 46;
  for (const u of world.units) {
    if (!u.holder.visible) continue;
    _v.set(u.holder.position.x, u.holder.position.y + .8, u.holder.position.z).project(camera);
    const d = Math.hypot((_v.x * .5 + .5) * innerWidth - px, (-_v.y * .5 + .5) * innerHeight - py);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
function handleTap(px, py) {
  if (world.units.some(u => u.path)) return;
  const sel = world.state.selected;
  if (sel) {
    _rc.setFromCamera(new THREE.Vector2(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1), camera);
    const cell = world.cellFromRay(_rc.ray);
    if (cell && world.canMoveTo(sel, cell)) { world.moveTo(sel, cell); mark(); hud(); return; }
  }
  const u = pickUnit(px, py);
  if (!u && !sel) {
    _rc.setFromCamera(new THREE.Vector2(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1), camera);
    const c = world.cellFromRay(_rc.ray); if (c && world.cycleOwner(c)) { mark(); hud(); return; }
  }
  if (u && u !== sel) world.select(u); else world.deselect();
  mark(); hud();
}
const cv = renderer.domElement;
cv.onpointerdown = e => { pts.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); prevD = 0; tap = pts.size === 1 ? {x: e.clientX, y: e.clientY, t: performance.now(), moved: 0} : null; };
cv.onpointermove = e => {
  if (!pts.has(e.pointerId)) return;
  const old = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (tap) { tap.moved = Math.max(tap.moved, Math.hypot(e.clientX - tap.x, e.clientY - tap.y)); if (pts.size > 1) tap = null; }
  if (pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    pinched = true; spanTarget = null;
    if (prevD) span = Math.max(7.5, Math.min(22, span * prevD / d)); prevD = d; resize(); zoomLabel(); mark();
  } else {
    const dx = (e.clientX - old[0]) * span / innerWidth, dz = (e.clientY - old[1]) * span / innerWidth / Math.sin(pitch * Math.PI / 180), a = camA();
    target.x -= dx * Math.cos(a) + dz * Math.sin(a); target.z += dx * Math.sin(a) - dz * Math.cos(a); mark();
  }
};
cv.onpointerup = e => { const t = tap; pts.delete(e.pointerId); prevD = 0; tap = null; if (pinched && pts.size < 2) { pinched = false; snapSpan(); } if (t && t.moved < 8 && performance.now() - t.t < 500) handleTap(e.clientX, e.clientY); };
cv.onpointercancel = e => { pts.delete(e.pointerId); prevD = 0; tap = null; if (pinched && pts.size < 2) { pinched = false; snapSpan(); } };
cv.onwheel = e => { e.preventDefault(); span = Math.max(7.5, Math.min(22, span * Math.exp(e.deltaY * .001))); resize(); zoomLabel(); mark(); clearTimeout(wheelTimer); wheelTimer = setTimeout(snapSpan, 180); };
onresize = () => { resize(); mark(); };

// 调试网址参数：?t=x,z 相机目标(格坐标)  ?s=视距(世界单位)  ?a=转向(度)  ?p=俯角(度)  ?fold=1 收起面板
{ const q = new URLSearchParams(location.search);
  if (q.has('t')) { const [x, z] = q.get('t').split(',').map(Number); target.set(x * 2, 0, z * 2); }
  if (q.has('s')) span = +q.get('s'); if (q.has('a')) angle = +q.get('a') * Math.PI / 180; if (q.has('p')) { pitch = +q.get('p'); $('bPitch').textContent = '俯角 ' + pitch + '°'; }
  if (q.has('fold')) { foldLv = Math.min(2, +q.get('fold') || 0); applyFold(); } zoomLabel(); }
if (new URLSearchParams(location.search).has('fire')) {
  const T = +new URLSearchParams(location.search).get('fire') || .12; world.fireInfantry(1);
  for (let t = 0; t < T; t += 1 / 120) world.update(1 / 120, angle);
  frozen = true;
}
window.__world = world; window.__mark = mark; window.__camera = camera;   // 调试用：控制台 / 自动化检查可直接读取世界对象
resize(); refresh(); hud(); requestAnimationFrame(loop);
window.battleTest = {world, THREE};
