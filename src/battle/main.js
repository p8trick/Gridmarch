import * as THREE from 'three';
import {buildWorld} from '../game/world.js';
import {makeLevel1} from '../game/levels/level1.js';
import {TacticalCamera, CAMERA} from './camera.js';
import {stageDebug, onLongPress} from './stage.js';
import {createCursor} from './cursor.js';
import {createArsenal} from './arsenal.js';
import {createDetail} from './detail.js';
import {createGameFromPreset, specOfUnit} from '../game/engine-map.js';
import {UNITS as RULE_UNITS, TERRAINS as RULE_TERRAINS} from '../rules/data.js';
import {dispHp, unitAt, produce as engineProduce, endTurn as engineEndTurn} from '../rules/engine.js';

// 战场（正式游戏的页面层）：关卡 → 世界 → 相机 → 触控。规则引擎接入前，这里只负责把战场"摆出来、看得清、转得动"。
// 0.30 起战场不再是独立 html，而是主页（index.html）里的一个"视图"：mountBattle 把战场挂进 host、unmountBattle 拆掉并释放显存。
// 整个游戏始终只有一个 html 文档，不发生页面跳转 —— 这样 iOS 的左 / 右边缘滑动（系统前进 / 后退手势）没有历史可翻，自然不会触发。
// 舞台（虚拟横屏）由主页创建，全程共用同一个 Stage，这里只借用，不创建、不销毁。
let current = null;   // 当前挂着的战场（同时只会有一个）
const ROT_SVG = '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.9-6.2"/><path d="M20.6 3.6v5.2h-5.2"/></svg>';   // 顺时针旋转图标（0.57：字符 ⟳ 比 ☰ 小，改成 SVG，大小可控）
export function unmountBattle() { if (current) { current.destroy(); current = null; } }

// host：容纳战场的容器（#battle）；stage：共用的舞台；opts：{seed, debug, onExit}
export async function mountBattle(host, stage, opts = {}) {
  unmountBattle();
  let alive = true, raf = 0, wheelTimer = 0, renderer = null, world = null;
  const handle = {destroy};
  current = handle;
  host.innerHTML = `<div id="ui">
  <div id="hudL" class="hud"><span id="hDay"></span><i class="sep"></i><span class="team"><i id="hDot" class="dot b"></i><span id="hTeam"></span></span><i class="sep"></i><span class="coin"></span><b id="hFunds"></b><span class="endchip" aria-hidden="true"></span></div>
  <div id="hudR"><button class="gbtn" id="bRot" aria-label="旋转画面"><span>${ROT_SVG}</span></button><button class="gbtn" id="bMenu" aria-label="菜单"><span class="burger"><i></i><i></i><i></i></span></button></div>
  <div id="dp" class="dpanel r" hidden><div id="uCard" class="dcard" hidden></div><div id="tCard" class="dcard"></div></div>
  <div id="dbg"></div>
</div>
<div id="pause" class="pmask" hidden><div class="ppanel" role="dialog" aria-modal="true">
  <header class="phead"><h2>暂停</h2><em id="pInfo"></em></header>
  <ul class="pmenu">
    <li><button class="item" data-act="resume"><span class="txt"><span class="main">继续</span><span class="sub">RESUME</span></span></button></li>
    <li id="mSideLi" hidden><button class="item" id="bSide" data-act="side" aria-label="画面上下颠倒时点这里换边"><span class="txt"><span class="main">换边</span><span class="sub">SWAP SIDE</span></span></button></li>
    <li><button class="item" data-act="reroll"><span class="txt"><span class="main">换图</span><span class="sub">NEW MAP</span></span></button></li>
    <li><button class="item" data-act="home"><span class="txt"><span class="main">返回主页</span><span class="sub">HOME</span></span></button></li>
  </ul>
</div></div>
<div id="endm" class="emask" hidden><div class="endp" role="dialog"><div class="et" id="eTitle"></div><div class="ee" id="eNote" hidden></div><div class="eb"><button class="sbtn" data-act="cancel">取消</button><button class="sbtn gold" data-act="ok">结束回合</button></div></div></div>
<div id="banner" class="banner" hidden><div class="bb"><div class="bs"><i class="bshine"></i><i class="bline"></i></div><span class="bday" id="bDay"></span><span class="bteam"><i class="dot b" id="bDot"></i><span id="bTeam"></span></span></div></div>
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
const {game, specs, toEngine, toWorld} = createGameFromPreset(preset);   // 0.40：关卡 → 规则引擎（建筑归属、开局资金、起始部队）；目前只显示，还不能操作
preset.layout.units = specs;
world = buildWorld({preset});
const L = preset.layout;
world.setShadowRadius(33);   // 视距 11 格时画面对角约 ±22：阴影范围放大到 ±33（2048 贴图下约每格 62 像素；原 9 格 ±27 时是 80）

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
// 生产（0.55）：兵工厂界面点「生产」→ 引擎 produce（扣钱、标记本回合已造、单位本回合不能动）→ 战场里在这座兵工厂上摆出新单位
const produceHere = (type, cell) => {
  const [ex, ey] = toEngine(cell), r = engineProduce(game, ex, ey, type);
  if (r.ok) { const spec = specOfUnit(r.unit, toWorld); if (spec) world.addUnit(spec); hud(); infoUpdate(); mark(); }
  return r;
};
const ars = createArsenal({THREE, renderer, host, stage, game, onProduce: produceHere});   // 兵工厂界面（0.42）
const detail = createDetail({host, game, toEngine});   // 长按详细面板（0.60）

let dirty = true, lastQuarter = -1, lastCur = 0;
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
  const OWN = ['蓝方', '红方'], bo = game.owners[toEngine(c).join(',')], eu = unitAt(game, ...toEngine(c));
  let txt = `(${c[0]}, ${c[1]}) ${t}` + (b && RULE_TERRAINS[game.terrain[toEngine(c)[1]][toEngine(c)[0]]].property ? ` · ${bo === undefined ? '中立' : OWN[bo]}` : '');
  if (eu) { const d = RULE_UNITS[eu.type]; txt += `\n${OWN[eu.owner]}${d.name} · 血量 ${dispHp(eu.hp)}/10 · 弹药 ${d.ammo ? eu.ammo + '/' + d.ammo : '—'}`; }
  return txt;
}
const cursor = createCursor(THREE); world.scene.add(cursor.group);   // 格子光圈（见 cursor.js）
let picked = null;
const raycaster = new THREE.Raycaster();
function selectAt(px, py) {   // 屏幕坐标 → 选中格子 + 光圈；棋盘外 = 取消选中。返回选中的格子（没有 = null）
  raycaster.setFromCamera(new THREE.Vector2(px / stage.w * 2 - 1, -(py / stage.h) * 2 + 1), cam.cam);
  const c = world.cellFromRay(raycaster.ray);
  const inside = c && c[0] >= preset.x[0] && c[0] <= preset.x[1] && c[1] >= preset.z[0] && c[1] <= preset.z[1];
  picked = inside ? c : null;
  if (picked) cursor.show(c[0] * 2, c[1] * 2, world.bldMap.has(key(c)) ? 'building' : 'cell', (px, pz) => world.surfaceY(c[0], c[1], px, pz)); else cursor.hide();
  return picked;
}
function handleTap(px, py) {
  if (selectAt(px, py)) { const [ex, ey] = toEngine(picked); if (game.terrain[ey][ex] === 'factory' && game.owners[ex + ',' + ey] === game.turn) ars.open(picked, game.turn === 0 ? 'blue' : 'red'); }
  infoUpdate(); hud(); mark();
}
function handleLong(px, py) {   // 长按（0.60）：同样选中这一格，但出完整版详细面板（自己的兵工厂也是看详情，不开生产界面）
  const c = selectAt(px, py);
  infoUpdate(); hud(); mark();
  if (c) detail.open(c);
}

// ── 详细信息面板（0.57）：点格子后，面板出现在光圈所在位置的【另一侧】（光圈在左半屏 → 面板在右下，反之亦然；中间 46%–54% 不切换，免得抖）。
//    单位卡（名字 / 血量 / 燃料 / 弹药）在上，地形卡（名字 / 防御星 / 归属）在下；数据全部来自引擎（rules/engine + data）。 ──
const OWN = ['蓝军', '红军'];
let infoSide = 'r';
function infoUpdate() {
  const dp = $('dp');
  if (!picked) { dp.hidden = true; return; }
  const [ex, ey] = toEngine(picked), T = RULE_TERRAINS[game.terrain[ey][ex]], eu = unitAt(game, ex, ey), o = game.owners[ex + ',' + ey];
  $('uCard').hidden = !eu;
  if (eu) {
    const d = RULE_UNITS[eu.type], hp = dispHp(eu.hp);
    $('uCard').innerHTML = `<h3><i class="dot ${eu.owner === 0 ? 'b' : 'r'}"></i>${d.name}</h3>` +
      `<div class="drow"><span>血量</span><span class="hpbar"><i style="width:${hp * 10}%;background:${hp >= 7 ? '#6ee06e' : hp >= 4 ? '#ffd45a' : '#ff6b5e'}"></i></span><b>${hp}/10</b></div>` +
      `<div class="drow"><span>燃料</span><b>${d.fuel === Infinity ? '∞' : eu.fuel + '/' + d.fuel}</b></div>` +
      `<div class="drow"><span>弹药</span><b>${d.ammo ? eu.ammo + '/' + d.ammo : '—'}</b></div>`;
  }
  $('tCard').innerHTML = `<h3>${T.name}</h3><div class="drow"><span>防御</span><b class="stars">${T.stars ? '★'.repeat(T.stars) : '—'}</b></div>` + (T.property ? `<div class="drow"><span>归属</span><b>${o === undefined ? '中立' : OWN[o]}</b></div>` : '');
  dp.hidden = false; infoPlace();
}
function infoPlace() {   // 相机移动 / 旋转后光圈在屏幕上的位置会变，面板跟着换边
  const dp = $('dp'); if (!picked || dp.hidden) return;
  const v = new THREE.Vector3(picked[0] * 2, world.surfaceY(picked[0], picked[1]), picked[1] * 2).project(cam.cam), sx = (v.x + 1) / 2 * stage.w;
  if (sx < stage.w * .46) infoSide = 'r'; else if (sx > stage.w * .54) infoSide = 'l';
  dp.className = 'dpanel ' + infoSide;
}

// ── HUD ──
const debug = !!opts.debug;
let fps = 0, frames = 0, t0 = performance.now();
const cellsTxt = () => Math.round(cam.cells * 10) / 10;
let hudSig = '', lastCells = null, zoomT = 0, zoomOn = false, hudReady = false, bannerT = 0;
// 视距提示（0.56）：缩放时右上「旋转」按钮临时变成当前视距（格数），随缩放实时变化；停手 2 秒后淡出，变回旋转图标（双指还按着就继续等）
const rotSpan = $('bRot').firstElementChild;
function showZoom() {
  rotSpan.style.opacity = 1; rotSpan.textContent = cellsTxt(); rotSpan.classList.add('zoom'); zoomOn = true;
  clearTimeout(zoomT); zoomT = setTimeout(hideZoom, 2000);
}
function hideZoom() {
  if (!alive || !zoomOn) return;
  if (pts.size > 1) { zoomT = setTimeout(hideZoom, 600); return; }
  rotSpan.style.opacity = 0;
  zoomT = setTimeout(() => { rotSpan.innerHTML = ROT_SVG; rotSpan.classList.remove('zoom'); rotSpan.style.opacity = 1; zoomOn = false; }, 200);
}
function hud() {   // 左上角：第 N 天 · 当前回合方 · 金币（0.55 起战场上不再有左下角说明面板；点格子的详细信息面板另行设计，describe() 先留着）
  const t = game.turn, sig = game.day + '|' + t + '|' + game.funds[t];
  if (sig !== hudSig) { hudSig = sig; $('hDay').textContent = `第 ${game.day} 天`; $('hTeam').textContent = t === 0 ? '蓝军' : '红军'; $('hDot').className = 'dot ' + (t === 0 ? 'b' : 'r'); $('hFunds').textContent = game.funds[t]; }
  const mine = game.units.filter(u => u.owner === game.turn), ready = game.winner === null && mine.length > 0 && mine.every(u => u.acted);   // 本方单位全部行动完 = 可以结束回合了
  if (ready !== hudReady) { hudReady = ready; $('hudL').classList.toggle('ready', ready); if (ready && $('endm').hidden && $('pause').hidden && !ars.isOpen && !detail.isOpen) openEnd(); }   // 刚好行动完的这一刻自动弹出结束确认；取消后状态条继续脉冲提醒
  infoPlace();
  if (lastCells !== cam.cells) { if (lastCells !== null) showZoom(); lastCells = cam.cells; }   // 视距变了（双指 / 滚轮 / 松手吸附）：旋转按钮临时变成视距数字
  if (debug) $('dbg').textContent = `${fps.toFixed(0)}fps · ${renderer.info.render.triangles}△ · ${renderer.info.render.calls}绘制`;
}
// 结束回合（0.58）：点左上状态条 → 状态条下方弹出确认；点「结束回合」才真正结束：引擎 endTurn（换人 / 天数 / 单位恢复 / 收入 / 兵工厂可再生产）→ 中央大横幅「第 N 天」
function openEnd() {
  const t = game.turn, f = [...Object.keys(game.owners)].filter(k => game.owners[k] === t && !game.built.has(k)).filter(k => { const [x, y] = k.split(',').map(Number); return game.terrain[y][x] === 'factory' && !unitAt(game, x, y); }).length;
  $('eTitle').textContent = `结束第 ${game.day} 天 · ${OWN[t]} 的回合？`;
  const note = $('eNote'); note.hidden = !(f && game.funds[t] >= 1000); note.textContent = `还有 ${f} 座兵工厂没生产`;   // 单位没行动这一项，等移动 / 攻击接入后再加
  $('endm').hidden = false;
}
const closeEnd = () => { $('endm').hidden = true; };
function doEndTurn() {
  if (!engineEndTurn(game).ok) return;
  hudReady = false; $('hudL').classList.remove('ready');
  hud(); infoUpdate(); mark(); playBanner();
}
function playBanner() {   // 换回合的大横幅：深蓝斜切横幅从左滑入、金色大字「第 N 天」缩放落下、扫光一闪、停一下再向右滑出；期间挡住触摸
  const b = $('banner'), t = game.turn;
  $('bDay').textContent = `第 ${game.day} 天`; $('bTeam').textContent = OWN[t] + '行动'; $('bDot').className = 'dot ' + (t === 0 ? 'b' : 'r'); b.className = 'banner ' + (t === 0 ? 'b' : 'r');
  b.hidden = false; void b.offsetWidth; b.classList.add('play');
  clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; b.classList.remove('play'); }, 1700);
}
$('hudL').onclick = () => { if ($('pause').hidden && !ars.isOpen && !detail.isOpen) openEnd(); };
$('endm').addEventListener('click', e => {
  if (e.target.id === 'endm') return closeEnd();   // 点外面 = 取消
  const b = e.target.closest('button'); if (!b) return;
  closeEnd(); if (b.dataset.act === 'ok') doEndTurn();
});
// 右上角两个图标按钮：旋转画面（顺时针 90°）+ 暂停菜单（继续 / 视距 / 换边 / 换图 / 返回主页，样式同主页菜单）
$('pInfo').textContent = `${preset.name} · 种子 ${seed}`;
const pause = $('pause');
$('bRot').onclick = () => { if (zoomOn) { clearTimeout(zoomT); rotSpan.innerHTML = ROT_SVG; rotSpan.classList.remove('zoom'); rotSpan.style.opacity = 1; zoomOn = false; } cam.rotate(1); mark(); };   // 正显示视距数字时点一下 = 立刻变回图标并旋转
$('bMenu').onclick = () => { pause.querySelectorAll('.item').forEach(b => b.classList.remove('is-sel')); pause.hidden = false; };
pause.addEventListener('pointerdown', e => { const b = e.target.closest('.item'); if (b) pause.querySelectorAll('.item').forEach(x => x.classList.toggle('is-sel', x === b)); });   // 按下变金色，同主页
pause.addEventListener('click', e => {
  if (e.target === pause) { pause.hidden = true; return; }   // 点面板外 = 继续
  const b = e.target.closest('.item'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'resume') pause.hidden = true;
  else if (a === 'side') stage.toggleSide();
  else if (a === 'reroll') mountBattle(host, stage, {...opts, seed: 1 + Math.floor(Math.random() * 999999)});   // 换图：原地重建（不刷新页面、不产生历史记录）
  else if (a === 'home') { unmountBattle(); if (opts.onExit) opts.onExit(); }
});

// ── 触控：单指平移，双指缩放（松手吸附最近一档），轻点选格 ──
// clientX/Y 是物理屏幕坐标：舞台被旋转时要先用 stage.toLogical 换成舞台坐标，位移、间距都从换算后的坐标算
const P = e => stage.toLogical(e.clientX, e.clientY);
const pts = new Map(); let prevD = 0, tap = null, pinched = false;
// 长按（0.60）：单指按住约 0.45 秒、手指没动（< 8px）→ 选中这一格并打开详细面板；触发后这次触摸不再平移 / 不算点按，抬手时也不会再点一次
const LONG_MS = 450; let lpT = 0, lpFired = false;
const lpClear = () => { clearTimeout(lpT); lpT = 0; };
cv.onpointerdown = e => {
  const p = P(e); pts.set(e.pointerId, [p.x, p.y]); cv.setPointerCapture(e.pointerId); prevD = 0; tap = pts.size === 1 ? {x: p.x, y: p.y, t: performance.now(), moved: 0} : null;
  lpClear(); lpFired = false;
  if (tap) lpT = setTimeout(() => { lpT = 0; if (!alive || !tap || tap.moved >= 8 || pts.size !== 1) return; lpFired = true; tap = null; handleLong(p.x, p.y); }, LONG_MS);
};
cv.onpointermove = e => {
  if (!pts.has(e.pointerId)) return;
  const p = P(e), old = pts.get(e.pointerId); pts.set(e.pointerId, [p.x, p.y]);
  if (lpFired) return;   // 长按已经打开了详细面板：手指还按着时的移动不再拖动战场
  if (tap) { tap.moved = Math.max(tap.moved, Math.hypot(p.x - tap.x, p.y - tap.y)); if (pts.size > 1) tap = null; }
  if (!tap) lpClear(); else if (tap.moved >= 8) lpClear();
  if (pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    pinched = true; if (prevD) cam.zoomBy(prevD / d); prevD = d; hud(); mark();
  } else { cam.pan(p.x - old[0], p.y - old[1], stage.w); mark(); }   // 位移 < 8px 且很快抬手算点按（见 endPointer）
};
const endPointer = (e, allowTap) => {
  lpClear(); const t = tap; pts.delete(e.pointerId); prevD = 0; tap = null;
  if (lpFired) { if (!pts.size) lpFired = false; return; }   // 长按触发过：这次抬手不算点按
  if (pinched && pts.size < 2) { pinched = false; cam.snap(); mark(); }
  if (allowTap && t && t.moved < 8 && performance.now() - t.t < 500) { const p = P(e); handleTap(p.x, p.y); }
};
cv.onpointerup = e => endPointer(e, true);
cv.onpointercancel = e => endPointer(e, false);
cv.onwheel = e => { e.preventDefault(); cam.zoomBy(Math.exp(e.deltaY * .001)); hud(); mark(); clearTimeout(wheelTimer); wheelTimer = setTimeout(() => { if (alive) { cam.snap(); mark(); } }, 180); };
stage.onChange(resize);   // 舞台尺寸 / 旋转变化时重设画布和相机宽高比
// 「换边」按钮：只在舞台被旋转时出现；画面上下颠倒了就点一下（选择会记住）
const syncSide = () => { $('mSideLi').hidden = !stage.rot; };
stage.onChange(syncSide); syncSide();
onLongPress($('bSide'), () => stageDebug(stage));   // 长按「换边」0.8 秒：现场诊断（排查竖屏黑边用）

// ── 主循环（按需渲染：没有动画 / 没有操作时不出帧）──
let lastT = performance.now();
function loop(now) {
  if (!alive) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  const camChanged = cam.update(dt);
  if (camChanged) { applyView(); hud(); dirty = true; }
  const up = world.update(dt, cam.camA); if (up.moving) dirty = true;
  if (cursor.update(now / 1000) && now - lastCur > 30) { dirty = true; lastCur = now; }   // 光圈有动画：显示时约 30 帧/秒重画，没有光圈时仍然按需渲染
  if (ars.isOpen) dirty = true;   // 兵工厂转台每帧都要重画（先画战场，再把转台画进右侧留空区）
  if (dirty) {
    dirty = false; cam.place(); world.sunFollow(cam.target.x, cam.target.z); world.cull(cam.cam); world.beforeRender();
    renderer.render(world.scene, cam.cam); frames++;
    if (ars.isOpen) ars.renderPreview(dt);
  }
  if (now - t0 > 1000) { fps = frames * 1000 / (now - t0); frames = 0; t0 = now; if (debug) hud(); }
}
resize(); applyView(); hud(); raf = requestAnimationFrame(loop);
requestAnimationFrame(() => requestAnimationFrame(() => { const l = host.querySelector('#loading'); if (l) l.remove(); }));   // 第一帧画出来之后再撤掉加载提示
window.battle = {world, cam, preset, THREE, game, describe, detail};   // describe：旧的单行说明文字，0.55 起不再显示，留作调试   // 调试：控制台可直接读取

// ── 拆除：退出 / 换图时调用。停循环、摘监听、释放显存（世界、渲染器、WebGL 上下文），主页和下一局才不会越用越卡 ──
function destroy() {
  if (!alive) return; alive = false;
  ars.dispose(); detail.dispose();
  cancelAnimationFrame(raf); clearTimeout(wheelTimer); clearTimeout(zoomT); clearTimeout(bannerT); clearTimeout(lpT);
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
