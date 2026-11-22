import * as THREE from 'three';
import {buildWorld} from '../game/world.js';
import {makeLevel1} from '../game/levels/level1.js';
import {TacticalCamera, CAMERA} from './camera.js';
import {stageDebug, onLongPress} from './stage.js';
import {createCursor} from './cursor.js';
import {createArsenal} from './arsenal.js';
import {createDetail} from './detail.js';
import {createLoading, lastBuildMs, saveBuildMs} from './loading.js';
import {createGameFromPreset, specOfUnit} from '../game/engine-map.js';
import {UNITS as RULE_UNITS, TERRAINS as RULE_TERRAINS} from '../rules/data.js';
import {dispHp, unitAt, produce as engineProduce, canProduce, endTurn as engineEndTurn, reachable as engineReach, pathOf, move as engineMove, undoMove as engineUndo, wait as engineWait, capture as engineCapture, canCapture, attack as engineAttack, targetsOf, forecast} from '../rules/engine.js';

// 战场（正式游戏的页面层）：关卡 → 世界 → 相机 → 触控。规则引擎接入前，这里只负责把战场"摆出来、看得清、转得动"。
// 0.30 起战场不再是独立 html，而是主页（index.html）里的一个"视图"：mountBattle 把战场挂进 host、unmountBattle 拆掉并释放显存。
// 整个游戏始终只有一个 html 文档，不发生页面跳转 —— 这样 iOS 的左 / 右边缘滑动（系统前进 / 后退手势）没有历史可翻，自然不会触发。
// 舞台（虚拟横屏）由主页创建，全程共用同一个 Stage，这里只借用，不创建、不销毁。
let current = null;   // 当前挂着的战场（同时只会有一个）
const ROT_SVG = '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.9-6.2"/><path d="M20.6 3.6v5.2h-5.2"/></svg>';   // 顺时针旋转图标（0.57：字符 ⟳ 比 ☰ 小，改成 SVG，大小可控）
export function unmountBattle() { if (current) { current.destroy(); current = null; } }

// host：容纳战场的容器（#battle）；stage：共用的舞台；opts：{seed, debug, onExit, loading（home.js 已经开始显示的进度条，没有就自己建）}
export async function mountBattle(host, stage, opts = {}) {
  unmountBattle();
  const ld = opts.loading || createLoading('正在生成战场…');   // 0.63：进度条；换图时没有现成的，自己建（模块已下载好，从 0 开始只剩生成这一段）
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
  <header class="phead"><h2 id="pTitle">暂停</h2><em id="pInfo"></em></header>
  <ul class="pmenu" id="pMain">
    <li><button class="item" data-act="resume"><span class="txt"><span class="main">继续</span><span class="sub">RESUME</span></span></button></li>
    <li><button class="item" data-act="quality"><span class="txt"><span class="main">画质</span><span class="sub">GRAPHICS</span></span></button></li>
    <li id="mSideLi" hidden><button class="item" id="bSide" data-act="side" aria-label="画面上下颠倒时点这里换边"><span class="txt"><span class="main">换边</span><span class="sub">SWAP SIDE</span></span></button></li>
    <li><button class="item" data-act="reroll"><span class="txt"><span class="main">换图</span><span class="sub">NEW MAP</span></span></button></li>
    <li><button class="item" data-act="home"><span class="txt"><span class="main">返回主页</span><span class="sub">HOME</span></span></button></li>
  </ul>
  <ul class="pmenu" id="pQual" hidden>
    <li><button class="item" data-act="canim"><span class="txt"><span class="main">作战动画</span><span class="pst" id="pCombatSt">开</span></span></button></li>
    <li><button class="item" data-act="hptuck"><span class="txt"><span class="main">血量角标左移</span><span class="pst" id="pTuckSt">40%</span></span></button></li>
    <li class="pnote">角标左边压进模型的量（占角标宽度）：0% = 角标整块在模型右下角外面，数值越大越贴向模型。点一下换下一档</li>
    <li><button class="item" data-act="fps"><span class="txt"><span class="main">帧率显示</span><span class="pst" id="pFpsSt">关</span></span></button></li>
    <li class="pnote">右上角菜单按钮右侧的小标：<i class="g">绿 ≥50</i> <i class="y">黄 40–49</i> <i class="o">橙 30–39</i> <i class="r">红 &lt;30</i> <i class="n">灰 = 画面静止（按需渲染，不出帧）</i></li>
    <li><button class="item" data-act="back"><span class="txt"><span class="main">返回</span><span class="sub">BACK</span></span></button></li>
  </ul>
</div></div>
<div id="endm" class="emask" hidden><div class="endp" role="dialog"><div class="et" id="eTitle"></div><div class="ee" id="eNote" hidden></div><div class="eb"><button class="sbtn" data-act="cancel">取消</button><button class="sbtn gold" data-act="ok">结束回合</button></div></div></div>
<div id="banner" class="banner" hidden><div class="bb"><div class="bs"><i class="bshine"></i><i class="bline"></i></div><span class="bday" id="bDay"></span><span class="bteam"><i class="dot b" id="bDot"></i><span id="bTeam"></span></span></div></div>
<div id="err"></div>
<div id="abar" class="abar" hidden><button class="abtn" data-act="capture" hidden><span>占领</span></button><button class="abtn" data-act="attack" hidden><span>攻击</span></button><button class="abtn" data-act="wait"><span>待命</span></button><span class="ahint u">点空白处撤销</span><span class="ahint t">点红格攻击 · 点空白处返回</span></div>
<div id="fpsb" class="fpsb" hidden><b>--</b></div>
`;
ld.attach(host).label('正在生成战场…');
  const $ = id => host.querySelector('#' + id);
  const err = $('err');
  const showErr = m => { err.style.display = 'block'; err.textContent = '出错：' + m; };
  const onErr = e => showErr(e.message || e.error), onRej = e => showErr(e.reason && e.reason.message || e.reason);
  addEventListener('error', onErr); addEventListener('unhandledrejection', onRej);

  // 建世界要同步算 2–3 秒（水域最重）：先让"正在生成战场…"画到屏幕上，再开始算
  // 生成战场占进度条的 40%–92%（下载模块占前 40%）：下面这段是一大段同步计算，页面卡住时进度条靠合成器缓动继续走
  const buildT0 = performance.now(); ld.to(92, lastBuildMs());
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

renderer = new THREE.WebGLRenderer({antialias: true}); renderer.localClippingEnabled = true;   // 0.78：占领「染色」样式用裁剪面做从左到右的擦除
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
// 0.65：引擎里每个单位的 acted → 战场单位头顶「休」标记（生产、换回合后同步；以后移动 / 待命也走这里）
const TEAM = ['blue', 'red'];
// 0.77：占领进度同步到战场（建筑脚下的进度环 + 灯带渐变）：引擎里 cap > 0 的单位 = 正在占领；单位走开 / 被打死 / 占完后进度归零，这里会自动把建筑恢复本色
const syncCaps = () => world.setCaptureMarks(game.units.filter(u => u.cap > 0).map(u => { const o = game.owners[u.x + ',' + u.y]; return {cell: toWorld([u.x, u.y]), f: u.cap / RULE_TERRAINS[game.terrain[u.y][u.x]].capture, cap: u.cap, need: RULE_TERRAINS[game.terrain[u.y][u.x]].capture, team: TEAM[u.owner], from: o === undefined ? 'neutral' : TEAM[o]}; }));
const holdHp = new Set();   // 0.81：回合开始修理动画还没演到的单位，血量角标先不更新（飘 +N 的那一刻才变）
const syncActed = () => { for (const u of game.units) { world.setActed(u.id, u.acted && u.owner === game.turn); if (!holdHp.has(u.id)) world.setHp(u.id, dispHp(u.hp)); } syncCaps(); };   // 0.73：同时同步血量角标（显示血量 < 10 才挂数字牌）
const produceHere = (type, cell) => {
  const [ex, ey] = toEngine(cell), r = engineProduce(game, ex, ey, type);
  if (r.ok) { const spec = specOfUnit(r.unit, toWorld); if (spec) world.addUnit(spec); syncActed(); hud(); infoUpdate(); mark(); }
  return r;
};
const ars = createArsenal({THREE, renderer, host, stage, game, onProduce: produceHere});   // 兵工厂界面（0.42）
const showCursor = c => cursor.show(c[0] * 2, c[1] * 2, world.bldMap.has(key(c)) ? 'building' : 'cell', (px, pz) => world.surfaceY(c[0], c[1], px, pz));
// 长按详细面板（0.60；0.61 加展示窗：面板开着时光圈先藏起来——光圈有动画会让战场每秒重画 30 次，展示窗不需要）
const detail = createDetail({THREE, renderer, host, stage, game, toEngine,
  onOpen: () => cursor.hide(), onClose: () => { if (picked) showCursor(picked); mark(); }});

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
  if (eu) { const d = RULE_UNITS[eu.type]; txt += `\n${OWN[eu.owner]}${d.name} · 血量 ${eu.hp}/100 · 弹药 ${d.ammo ? eu.ammo + '/' + d.ammo : '—'}`; }
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
  if (picked) showCursor(c); else cursor.hide();
  return picked;
}
// ── 单位操作（0.67，高战式）：点自己没动过的单位 → 蓝格（引擎算的移动范围）→ 点蓝格直接走 → 单位旁出小浮条「待命」→ 已行动。点自己脚下 = 原地不动（直接出浮条）；点别处 = 取消选中。
//    攻击下一版接（浮条里再加「攻击」）。走完之后点浮条以外的地方（浮条周围 36px 不算）= 撤销这次移动（0.68），镜头还能拖。
let sel = null, reach = null, acting = null, lastPul = 0, wasBusy = false;
const clearSel = () => { sel = null; reach = null; world.deselect(); };
function pickUnit(eu) {
  sel = eu; reach = engineReach(game, eu);
  world.showRange([...reach.keys()].map(k => toWorld(k.split(',').map(Number))), world.unitById(eu.id));
}
function startMove(ex, ey) {
  const u = sel, path = pathOf(game, u, ex, ey), w = world.unitById(u.id);
  if (!path || !engineMove(game, u.id, ex, ey).ok) { clearSel(); return; }
  clearSel(); acting = u; hideBar(); syncCaps();   // 离开正在占领的建筑 = 进度清零，建筑恢复本色
  world.moveAlong(w, path.map(toWorld), () => { if (acting === u) { showBar(); mark(); } });
}
const bar = $('abar');
function showBar() { bar.querySelector('[data-act=capture]').hidden = !canCapture(game, acting); bar.querySelector('[data-act=attack]').hidden = !targetsOf(game, acting).length; bar.classList.remove('pick'); bar.hidden = false; barPlace(); }
function hideBar() { bar.hidden = true; }
function barPlace() {   // 浮条贴在单位右边（单位在屏幕右侧 40% 时放左边），相机移动 / 旋转后跟着走
  if (bar.hidden || !acting) return;
  if (targeting) { bar.style.left = Math.round(stage.w / 2 - (bar.offsetWidth || 160) / 2) + 'px'; bar.style.top = '66px'; return; }   // 选目标时提示条放在屏幕上方中间，别压住红格
  const w = world.unitById(acting.id); if (!w) return;
  const v = new THREE.Vector3(w.x, world.surfaceY(w.cell[0], w.cell[1]) + .9, w.z).project(cam.cam), sx = (v.x + 1) / 2 * stage.w, sy = (1 - v.y) / 2 * stage.h;
  const left = sx > stage.w * .6, bw = bar.offsetWidth || 90;
  bar.style.left = Math.round(left ? sx - 34 - bw : sx + 34) + 'px'; bar.style.top = Math.round(Math.max(30, Math.min(stage.h - 30, sy))) + 'px';
}
function clearAct() { exitTargeting(); acting = null; hideBar(); }
let targeting = null;   // 选目标阶段：Map('x,y' → 敌方引擎单位)
function enterTargeting() {
  const list = targetsOf(game, acting); if (!list.length) return;
  targeting = new Map(list.map(e => [e.x + ',' + e.y, e]));
  world.showTargets(list.map(e => toWorld([e.x, e.y])), world.unitById(acting.id)); bar.classList.add('pick'); barPlace(); showForecast(list);
}
function exitTargeting() { if (!targeting) return; clearForecast(); targeting = null; world.clearRange(); bar.classList.remove('pick'); barPlace(); }
function unitScreen(w, up = 1.1) {
  const v = new THREE.Vector3(w.x, world.surfaceY(w.cell[0], w.cell[1]) + up, w.z).project(cam.cam);
  return [(v.x + 1) / 2 * stage.w, (1 - v.y) / 2 * stage.h];
}
const fmtHp = d => String(Math.round(d) / 10);   // 伤害点数（0–100）→ 显示血量（0.1 为单位）
// 伤害预估（0.73）：触屏上「点一下目标 → 出预估 → 再点确认」太拖沓，所以进入选目标时，每个红格上方直接标出预估：大字 = 预计伤害（会打死就显示「击破」），小字 = 对方反击伤害；点哪个就直接打
let fcEls = [];
function clearForecast() { for (const f of fcEls) f.el.remove(); fcEls = []; }
function showForecast(list) {
  clearForecast();
  for (const t of list) {
    const f = forecast(game, acting.id, t.id); if (!f) continue;
    const el = document.createElement('div'); el.className = 'fc' + (f.kill ? ' kill' : '');
    el.innerHTML = '<b>' + (f.kill ? '击破' : '-' + fmtHp(f.damage)) + '</b>' + (f.counter > 0 ? '<i' + (f.counterKill ? ' class="die"' : '') + '>反击 -' + fmtHp(f.counter) + (f.counterKill ? ' · 会被反杀' : '') + '</i>' : '');
    host.appendChild(el); fcEls.push({el, id: t.id});
  }
  fcPlace();
}
function fcPlace() {
  for (const f of fcEls) { const w = world.unitById(f.id); if (!w) continue; const [x, y] = unitScreen(w, 1.75); f.el.style.left = Math.round(x) + 'px'; f.el.style.top = Math.round(y) + 'px'; }
}
function popup(id, text, cls = '') {   // 单位头顶飘一个伤害数字（出现位置固定在被打那一刻的屏幕位置）；cls：占领用 'cap b' / 'cap r'
  const w = world.unitById(id); if (!w) return;
  const el = document.createElement('div'); el.className = 'dmg ' + cls; el.textContent = text; const [x, y] = unitScreen(w);
  el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; host.appendChild(el); setTimeout(() => el.remove(), 1300);
}
function showWinner() {   // 胜负已分（先用换回合横幅的样式提示一下；结算界面以后再做）
  const w = game.winner; if (w === null) return;
  const b = $('banner'); $('bDay').textContent = w < 0 ? '同归于尽' : '胜利'; $('bTeam').textContent = w < 0 ? '双方全灭' : OWN[w] + '获胜';
  $('bDot').className = 'dot ' + (w === 1 ? 'r' : 'b'); b.className = 'banner ' + (w === 1 ? 'r' : 'b'); b.hidden = false; void b.offsetWidth; b.classList.add('play');
  clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; b.classList.remove('play'); }, 1700);
}
function doAttack(tgt) {   // 规则立刻结算（engineAttack），画面按顺序演：攻击方开火 → 伤害数字 / 目标倒下 → 目标反击 → 伤害数字 / 攻击方倒下
  const att = acting, aid = att.id, tid = tgt.id, r = engineAttack(game, aid, tid);
  if (!r.ok) { exitTargeting(); return; }
  exitTargeting(); hideBar();
  const anim = combatOn, tdead = tgt.hp <= 0, adead = att.hp <= 0, fmt = d => '-' + fmtHp(d);
  const fin = () => { acting = null; syncActed(); hud(); infoUpdate(); mark(); if (game.winner !== null) showWinner(); };
  const counter = () => {
    if (!r.counter) return fin();
    const go = () => { popup(aid, fmt(r.counter.damage)); syncActed(); if (adead) world.removeUnit(aid, anim); fin(); };
    anim ? world.playAttack(tid, aid, go) : go();
  };
  const first = () => { popup(tid, fmt(r.hit.damage)); syncActed(); if (tdead) world.removeUnit(tid, anim); counter(); };
  anim ? world.playAttack(aid, tid, first) : first();
}
// 0.77 占领：规则立刻结算（engineCapture），画面演：进度环从旧进度走到新进度、灯带颜色渐变 + 头顶飘「占领 x/20」；占满 = 灯带闪白换色 + 冲击波 + 「占领成功！」。占领总部 = 获胜（见 CONFIG.hqWin）
function doCapture() {
  const u = acting, id = u.id, cell = toWorld([u.x, u.y]), prev = game.owners[u.x + ',' + u.y], r = engineCapture(game, id);
  if (!r.ok) return;
  hideBar();
  const team = TEAM[u.owner], from = prev === undefined ? 'neutral' : TEAM[prev];
  const fin = () => { acting = null; syncActed(); hud(); infoUpdate(); mark(); if (game.winner !== null) showWinner(); };
  popup(id, r.done ? '占领成功！' : '占领 ' + r.cap + '/' + r.need, 'cap ' + (u.owner === 0 ? 'b' : 'r'));
  if (combatOn) world.playCapture(cell, {team, from, f0: (r.cap - r.gain) / r.need, f1: r.done ? 1 : r.cap / r.need, need: r.need, done: r.done}, fin);
  else { if (r.done) world.setBuildingOwner(cell, team); fin(); }
}
bar.addEventListener('click', e => {
  const b = e.target.closest('.abtn'); if (!b || !acting) return;
  if (b.dataset.act === 'capture') { doCapture(); return; }
  if (b.dataset.act === 'attack') { enterTargeting(); return; }
  if (b.dataset.act === 'wait') { engineWait(game, acting.id); clearAct(); syncActed(); hud(); infoUpdate(); mark(); }
});
function undoMove() {   // 撤销：单位退回原格，回到「选中」状态（蓝格重新出现，可以重新选落点）
  const u = acting; if (!u || !u.origin) return;
  const from = [u.origin.x, u.origin.y];
  if (!engineUndo(game, u.id).ok) return;
  clearAct(); world.placeAt(world.unitById(u.id), toWorld(from)); picked = toWorld(from); showCursor(picked); pickUnit(u);
  syncActed(); hud(); infoUpdate(); mark();
}
function nearBar(px, py) {   // 浮条周围留一圈 36px 的缓冲：想点「待命」却点偏了，不算撤销
  const l = bar.offsetLeft, t = bar.offsetTop - bar.offsetHeight / 2, M = 36;
  return px > l - M && px < l + bar.offsetWidth + M && py > t - M && py < t + bar.offsetHeight + M;
}
function handleTap(px, py) {
  if (world.busy() || econBusy) return;
  if (acting) {
    if (targeting) { const c = selectAt(px, py), t = c && targeting.get(toEngine(c).join(',')); if (t) doAttack(t); else { exitTargeting(); infoUpdate(); mark(); } return; }
    if (!nearBar(px, py)) undoMove();
    return;
  }
  const c = selectAt(px, py);
  if (c) {
    const [ex, ey] = toEngine(c), eu = unitAt(game, ex, ey);
    if (sel && reach.has(ex + ',' + ey)) { startMove(ex, ey); infoUpdate(); hud(); mark(); return; }
    clearSel();
    if (eu && eu.owner === game.turn && !eu.moved && !eu.acted && game.winner === null) pickUnit(eu);
    else if (game.terrain[ey][ex] === 'factory' && game.owners[ex + ',' + ey] === game.turn) ars.open(c, game.turn === 0 ? 'blue' : 'red');
  } else clearSel();
  infoUpdate(); hud(); mark();
}
function handleLong(px, py) {   // 长按（0.60）：同样选中这一格，但出完整版详细面板（自己的兵工厂也是看详情，不开生产界面）
  if (econBusy) return;
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
      `<div class="drow"><span>血量</span><span class="hpbar"><i style="width:${eu.hp}%;background:${hp >= 7 ? '#6ee06e' : hp >= 4 ? '#ffd45a' : '#ff6b5e'}"></i></span><b>${eu.hp}/100</b></div>` +
      `<div class="drow"><span>燃料</span><b>${d.fuel === Infinity ? '∞' : eu.fuel + '/' + d.fuel}</b></div>` +
      `<div class="drow"><span>弹药</span><b>${d.ammo ? eu.ammo + '/' + d.ammo : '—'}</b></div>`;
  }
  $('tCard').innerHTML = `<h3>${T.name}</h3><div class="drow"><span>防御</span><b class="stars">${T.stars ? '★'.repeat(T.stars) : '—'}</b></div>` + (T.property ? `<div class="drow"><span>归属</span><b>${o === undefined ? '中立' : OWN[o]}</b></div>` + (eu && eu.cap > 0 ? `<div class="drow"><span>占领</span><b>${eu.cap}/${T.capture}</b></div>` : '') : '');
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
let econBusy = false, econShown = null, econTok = 0, econTimers = [];   // 0.81：回合开始「收入 → 修理」动画期间：econShown = 状态条上显示的资金（null = 跟引擎走），econBusy 挡住操作
let hudSig = '', lastCells = null, zoomT = 0, zoomOn = false, hudReady = false, hudStuck = false, bannerT = 0;
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
  const t = game.turn, shown = econShown !== null ? econShown : game.funds[t], sig = game.day + '|' + t + '|' + shown;
  if (sig !== hudSig) { hudSig = sig; $('hDay').textContent = `第 ${game.day} 天`; $('hTeam').textContent = t === 0 ? '蓝军' : '红军'; $('hDot').className = 'dot ' + (t === 0 ? 'b' : 'r'); $('hFunds').textContent = shown; }
  // 0.69：两档提醒。① 本方单位全部行动完 = 状态条脉冲（可以结束回合了，但可能还想造兵）；② 脉冲的同时再也没有有效操作了（没有能造兵的兵工厂：都造过了 / 被单位占着 / 钱不够最便宜的单位）= 才自动弹出结束确认。
  const mine = game.units.filter(u => u.owner === game.turn), ready = game.winner === null && mine.every(u => u.acted), stuck = ready && !canProduce(game);
  if (ready !== hudReady) { hudReady = ready; $('hudL').classList.toggle('ready', ready); }
  if (!stuck) hudStuck = false;
  else if (!hudStuck) {   // 刚刚变成「无事可做」的这一刻：弹出确认；兵工厂 / 详细面板 / 暂停菜单开着就先等着（它们关上时会再检查一次）；确认已经开着就不重复弹
    if (!$('endm').hidden) hudStuck = true;
    else if ($('pause').hidden && !ars.isOpen && !detail.isOpen && !econBusy) { hudStuck = true; openEnd(); }
  }
  infoPlace();
  if (lastCells !== cam.cells) { if (lastCells !== null) showZoom(); lastCells = cam.cells; world.setHpView({k: Math.max(1, cam.cells / 9)}); }   // 视距变了（双指 / 滚轮 / 松手吸附）：旋转按钮临时变成视距数字
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
  const r = engineEndTurn(game); if (!r.ok) return;
  hudReady = false; hudStuck = false; $('hudL').classList.remove('ready'); clearSel(); clearAct();
  const swamp = r.swamp || [], reps = r.repairs || [];
  const fx = combatOn && ((r.income || 0) > 0 || reps.length > 0 || swamp.length > 0);   // 关了「作战动画」就不演，直接到账
  if (fx) { if (r.fundsBefore !== undefined) econShown = r.fundsBefore; econBusy = true; for (const q of reps) holdHp.add(q.id); for (const q of swamp) if (!q.dead) holdHp.add(q.id); }
  else for (const q of swamp) if (q.dead) world.removeUnit(q.id, false);   // 沼泽扣死的单位：引擎里已经没了，画面里也要拿掉
  syncActed(); hud(); infoUpdate(); mark();
  if (game.winner === null) playBanner();   // 沼泽把轮到的这一方扣光：对方直接获胜，不放「第 N 天」横幅，演完直接报胜负
  if (fx) playEconomy(r); else if (game.winner !== null) showWinner();
}
// 0.81 回合开始的经济动画（规则在 engineEndTurn 里已经结算好，这里只是演）：横幅快滑出时 → 状态条下方飘「+收入」，资金数字滚动涨上去 →
// 然后所有在己方建筑上回血的单位「同时」飘绿色「+N」（和被打时的伤害飘字同一套动画，只是变成加），同时状态条下方飘「-修理费合计」，资金数字同步滚动扣下来。
// 期间 econBusy 挡住点击；全部演完才解除，再检查一次「无事可做」提醒。
function fxMoney(text, cls) {   // 状态条下方、资金数字正下方飘一个数字（只动 transform / opacity）
  const bar = $('hudL'), f = $('hFunds'), el = document.createElement('div');
  el.className = 'fxm ' + cls; el.textContent = text;
  el.style.left = Math.round(bar.offsetLeft + f.offsetLeft + f.offsetWidth / 2) + 'px'; el.style.top = Math.round(bar.offsetTop + bar.offsetHeight + 16) + 'px';
  bar.parentNode.appendChild(el); setTimeout(() => el.remove(), 1500);
}
function tweenFunds(from, to, ms, done) {
  const tok = econTok, f = $('hFunds'), t0 = performance.now(); f.classList.remove('up', 'down'); f.classList.add(to > from ? 'up' : 'down');
  const step = now => {
    if (!alive || tok !== econTok) return;
    const k = Math.max(0, Math.min(1, (now - t0) / ms)), e = 1 - (1 - k) * (1 - k);   // rAF 时间戳可能比 t0 早一点点，k 不夹下限第一帧会冒出反向的数（测试抓到 3010）
    econShown = Math.round(from + (to - from) * e); f.textContent = econShown;
    if (k < 1) requestAnimationFrame(step); else { f.classList.remove('up', 'down'); done(); }
  };
  requestAnimationFrame(step);
}
function playEconomy(r) {
  const tok = ++econTok, later = (fn, ms) => econTimers.push(setTimeout(() => { if (alive && tok === econTok) fn(); }, ms));
  const after = (r.income || 0) > 0 ? r.fundsBefore + r.income : r.fundsBefore, reps = r.repairs || [], swamp = r.swamp || [];
  const finish = () => { econShown = null; econBusy = false; holdHp.clear(); syncActed(); hud(); infoUpdate(); mark(); if (game.winner !== null) showWinner(); };
  const repairPhase = () => {
    if (!reps.length && !swamp.length) return finish();
    // 0.83：回血（绿 +N）和沼泽掉血（红 -N，与被打同款；掉到 0 的单位倒下）在同一刻一起演
    for (const q of swamp) { popup(q.id, '-' + fmtHp(q.damage)); holdHp.delete(q.id); if (q.dead) world.removeUnit(q.id, true); }
    for (const q of reps) popup(q.id, '+' + fmtHp(q.heal), 'heal');
    for (const q of reps) holdHp.delete(q.id);
    syncActed(); mark();
    if (r.repairCost > 0) { fxMoney('-' + r.repairCost, 'out'); later(() => tweenFunds(after, after - r.repairCost, 700, () => later(finish, 350)), 250); }
    else later(finish, 1000);
  };
  const incomePhase = () => {
    if (!(r.income > 0)) return repairPhase();   // （没有收入就直接进下一段）
    fxMoney('+' + r.income, 'in');
    later(() => tweenFunds(r.fundsBefore, after, 700, () => later(repairPhase, 450)), 250);
  };
  later(incomePhase, 650);
}
function playBanner() {   // 换回合的大横幅：深蓝斜切横幅从左滑入、金色大字「第 N 天」缩放落下、扫光一闪、停一下再向右滑出；期间挡住触摸
  const b = $('banner'), t = game.turn;
  $('bDay').textContent = `第 ${game.day} 天`; $('bTeam').textContent = OWN[t] + '行动'; $('bDot').className = 'dot ' + (t === 0 ? 'b' : 'r'); b.className = 'banner ' + (t === 0 ? 'b' : 'r');
  b.hidden = false; void b.offsetWidth; b.classList.add('play');
  clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; b.classList.remove('play'); }, 1700);
}
$('hudL').onclick = () => { if (!world.busy() && !econBusy && $('pause').hidden && !ars.isOpen && !detail.isOpen) openEnd(); };
$('endm').addEventListener('click', e => {
  if (e.target.id === 'endm') return closeEnd();   // 点外面 = 取消
  const b = e.target.closest('button'); if (!b) return;
  closeEnd(); if (b.dataset.act === 'ok') doEndTurn();
});
// 右上角两个图标按钮：旋转画面（顺时针 90°）+ 暂停菜单（继续 / 视距 / 换边 / 换图 / 返回主页，样式同主页菜单）
$('pInfo').textContent = `${preset.name} · 种子 ${seed}`;
const pause = $('pause');
$('bRot').onclick = () => { if (zoomOn) { clearTimeout(zoomT); rotSpan.innerHTML = ROT_SVG; rotSpan.classList.remove('zoom'); rotSpan.style.opacity = 1; zoomOn = false; } cam.rotate(1); mark(); };   // 正显示视距数字时点一下 = 立刻变回图标并旋转
// 画质（0.66）：暂停菜单第二页；目前只有「帧率显示」开关（存 localStorage gridmarch.showFps）
const FPS_KEY = 'gridmarch.showFps';
let fpsOn = false; try { fpsOn = localStorage.getItem(FPS_KEY) === '1'; } catch (e) {}
const fpsEl = $('fpsb'), fpsNum = fpsEl.firstElementChild;
let fpsSum = 0, fpsN = 0, fpsPrev = 0, fpsT = 0, fpsLast = null, fpsChain = false;   // 采样：只统计「连续出帧」的相邻帧间隔；光圈 30 帧/秒是设计值，不计入
function fpsRender() {
  fpsEl.hidden = !fpsOn; $('pFpsSt').textContent = fpsOn ? '开' : '关'; $('pFpsSt').classList.toggle('on', fpsOn);
  if (!fpsOn) return;
  const v = fpsLast, lv = v === null ? 'n' : v >= 50 ? 'g' : v >= 40 ? 'y' : v >= 30 ? 'o' : 'r';
  fpsNum.textContent = v === null ? '--' : Math.min(999, Math.round(v)); fpsEl.className = 'fpsb lv-' + lv + (fpsStale ? ' idle' : '');
}
let fpsStale = true;
function fpsTick(now) {   // 每 0.5 秒结算一次：攒够 3 个样本就算；攒不够且 1 秒没有新样本 = 画面静止（显示上一次的数字并变灰）
  if (now - fpsT < 500) return; fpsT = now;
  if (fpsN >= 3) { fpsLast = 1000 / (fpsSum / fpsN); fpsStale = false; fpsSum = 0; fpsN = 0; }
  else if (now - fpsPrev > 1000) { fpsStale = true; fpsSum = 0; fpsN = 0; }
  if (fpsOn) fpsRender();
}
// 作战动画（0.70）：开 = 攻击时单位转向目标、播放模型自带的开火动画、被打掉的单位缩小消失；关 = 全部跳过，只飘伤害数字（存 localStorage gridmarch.combatAnim）
const CANIM_KEY = 'gridmarch.combatAnim';
let combatOn = true; try { combatOn = localStorage.getItem(CANIM_KEY) !== '0'; } catch (e) {}
function canimRender() { $('pCombatSt').textContent = combatOn ? '开' : '关'; $('pCombatSt').classList.toggle('on', combatOn); }
canimRender();
// 血量角标左移（0.75；0.76 改成 0 / 25 / 40 / 50%，默认 40%——再大就贴到脚上了）：轮换，存 localStorage gridmarch.hpTuck；视距超过 9 格时角标按 视距/9 放大，屏幕上保持 9 格时的大小
const TUCK_KEY = 'gridmarch.hpTuck', TUCKS = [0, 25, 40, 50];
let tuckPct = 40; try { const v = +localStorage.getItem(TUCK_KEY); if (TUCKS.includes(v) && localStorage.getItem(TUCK_KEY) !== null) tuckPct = v; } catch (e) {}
const tuckRender = () => { $('pTuckSt').textContent = tuckPct + '%'; world.setHpView({tuck: tuckPct / 100}); mark(); };
tuckRender();
function setPage(q) { $('pMain').hidden = q; $('pQual').hidden = !q; $('pTitle').textContent = q ? '画质' : '暂停'; $('pInfo').hidden = q; pause.querySelectorAll('.item').forEach(b => b.classList.remove('is-sel')); }
fpsRender();
$('bMenu').onclick = () => { setPage(false); pause.hidden = false; };
pause.addEventListener('pointerdown', e => { const b = e.target.closest('.item'); if (b) pause.querySelectorAll('.item').forEach(x => x.classList.toggle('is-sel', x === b)); });   // 按下变金色，同主页
pause.addEventListener('click', e => {
  if (e.target === pause) { pause.hidden = true; return; }   // 点面板外 = 继续
  const b = e.target.closest('.item'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'resume') pause.hidden = true;
  else if (a === 'quality') setPage(true);
  else if (a === 'back') setPage(false);
  else if (a === 'canim') { combatOn = !combatOn; try { localStorage.setItem(CANIM_KEY, combatOn ? '1' : '0'); } catch (e) {} canimRender(); }
  else if (a === 'hptuck') { tuckPct = TUCKS[(TUCKS.indexOf(tuckPct) + 1) % TUCKS.length]; try { localStorage.setItem(TUCK_KEY, String(tuckPct)); } catch (e) {} tuckRender(); }
  else if (a === 'fps') { fpsOn = !fpsOn; try { localStorage.setItem(FPS_KEY, fpsOn ? '1' : '0'); } catch (e) {} fpsChain = false; fpsRender(); }
  else if (a === 'side') stage.toggleSide();
  else if (a === 'reroll') mountBattle(host, stage, {...opts, loading: null, seed: 1 + Math.floor(Math.random() * 999999)});   // 换图：原地重建（不刷新页面、不产生历史记录）
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
  if (camChanged) { applyView(); hud(); barPlace(); dirty = true; }
  const up = world.update(dt, cam.camA); if (up.moving) dirty = true;
  let cursorOnly = false;
  if (cursor.update(now / 1000) && now - lastCur > 30) { cursorOnly = !dirty; dirty = true; lastCur = now; }   // 光圈有动画：显示时约 30 帧/秒重画，没有光圈时仍然按需渲染
  if (world.pulseRange(now / 1000) && now - lastPul > 30) { cursorOnly = cursorOnly || !dirty; dirty = true; lastPul = now; }   // 蓝格呼吸：有蓝格时约 30 帧/秒（同光圈，不计入帧率）
  { const busy = ars.isOpen || detail.isOpen || !$('pause').hidden; if (wasBusy && !busy) hud(); wasBusy = busy; }   // 兵工厂 / 详细面板 / 暂停菜单刚关上：补查一次「是不是无事可做」
  if (ars.isOpen) dirty = true;   // 兵工厂转台每帧都要重画（先画战场，再把转台画进右侧留空区）
  if (detail.needsFrame()) dirty = true;   // 详细面板的展示窗：刚打开 / 拖动后画几帧，静止时不出帧
  if (dirty) {
    dirty = false; cam.place(); world.sunFollow(cam.target.x, cam.target.z); world.cull(cam.cam); world.beforeRender();
    renderer.render(world.scene, cam.cam); frames++;
    barPlace(); if (fcEls.length) fcPlace();   // 0.68：浮条每次出帧都跟着单位走（拖镜头时 cam.update 不一定报变化）；0.73：伤害预估同理
    if (cursorOnly) fpsChain = false; else { if (fpsChain) { fpsSum += now - fpsPrev; fpsN++; } fpsPrev = now; fpsChain = true; }   // 0.66 帧率采样：连续两个 rAF 都出帧才算一个样本（再慢也算，不会漏掉卡顿）
    if (ars.isOpen) ars.renderPreview(dt);
    if (detail.isOpen) detail.renderPreview();   // 战场画完后，把详细面板的展示窗（同一个场景换近景相机）画进各自的矩形
  } else fpsChain = false;
  fpsTick(now);
  if (now - t0 > 1000) { fps = frames * 1000 / (now - t0); frames = 0; t0 = now; if (debug) hud(); }
}
resize(); applyView(); hud(); raf = requestAnimationFrame(loop);
saveBuildMs(performance.now() - buildT0);   // 记下这次生成花了多久，下次进度条按它缓动
requestAnimationFrame(() => requestAnimationFrame(() => ld.done()));   // 第一帧画出来之后补满进度条并淡出
window.battle = {world, cam, preset, THREE, game, describe, detail, produce: (type, x, y) => produceHere(type, toWorld([x, y])), hud, mark, toWorld, toEngine, state: () => ({sel: sel && sel.id, acting: acting && acting.id, targeting: !!targeting, picked})};   // describe：旧的单行说明文字，0.55 起不再显示，留作调试   // 调试：控制台可直接读取

// ── 拆除：退出 / 换图时调用。停循环、摘监听、释放显存（世界、渲染器、WebGL 上下文），主页和下一局才不会越用越卡 ──
function destroy() {
  if (!alive) return; alive = false;
  ars.dispose(); detail.dispose();
  cancelAnimationFrame(raf); clearTimeout(wheelTimer); clearTimeout(zoomT); clearTimeout(bannerT); clearTimeout(lpT); econTok++; econTimers.forEach(clearTimeout);
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
