import {MODEL_OF} from '../game/engine-map.js';
import {UNITS, UNIT_IDS} from '../rules/data.js';
import {GLYPH, weaponHtml} from './unit-info.js';
import {createTank} from '../game/units/tank-family.js';
import {createArtillery} from '../art/units/artillery-v2_0.js';
import {createInfantryBaseline} from '../art/units/infantry/infantry-performance.js';
import {createAntiTankBaseline} from '../art/units/infantry/anti-tank-performance.js';

// 兵工厂界面（0.42；0.50 列表改为自己处理滑动 + 上下「还能滑」提示；0.52 右边改成仿高战2：转台在左，机动 / 视野 / 燃料 + 主副炮（按大类）在右；0.53 右下角改「关闭」、去掉右上 ✕；0.54 去掉蓝 / 红军切换，生产改成兵种卡价格签变「生产」按钮（取代 0.53 的弹窗）；0.55 点「生产」真的生产并关闭面板，没模型的兵种先不能买）：左边兵种卡片、右边选中单位的高精度模型转台 + 数据 + 生产按钮。界面风格取「B 玩具盒」（奶油底 + 深色粗边 + 军队色细条）。
// 转台不开第二个画布：用战场同一个 renderer，在右侧留空区域对应的屏幕矩形里（viewport + scissor）再画一个独立小场景。
// 目前「生产」只是演示（不扣钱、不出兵），等你对界面和模型特写满意了再接引擎的 produce()。
const MAKE = {   // 引擎兵种 → 高精度模型（预览用原版 / 基线版，不是战场上的批量性能版）；没有的 = 尚未建模
  inf: team => { const u = createInfantryBaseline(); u.setFaction(team); u.setPose('idle'); return u; },
  mech: team => { const u = createAntiTankBaseline(); u.setFaction(team); u.setPose('idle'); return u; },
  tank: team => createTank('light', {faction: team}),
  mdtank: team => createTank('medium', {faction: team}),
  neotank: team => createTank('heavy', {faction: team}),
  arty: team => createArtillery({faction: team, batch: true, paint: true}),
};
const TEAM_NAME = {blue: '蓝军', red: '红军'};

export function createArsenal({THREE, renderer, host, stage, game, onProduce}) {
  let lastHole = '', openCell = null, team = 'blue', sel = 'tank', spin = .5, gest = null, zoom = 1, panX = 0, panY = 0, pxW = .01, lastTap = 0, tapDown = null, el = null, pv = null, toastT = 0, listEl = null, ls = null, fling = 0, listRO = null, armed = null;
  const cache = new Map(), pts = new Map();   // pts：当前按在展示窗上的手指（pointerId → 位置）
   // 'type|team' → {holder} | null（尚未建模）| 'error'

  // ── 预览场景（独立于战场）──
  const scene = new THREE.Scene();
  // 背景：暖米色径向渐变 + 轻微暗角（和奶油白面板同色系，比面板略深，产品摄影棚的感觉）
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const bgTex = mk(256, 256, (x, w, h) => { const g = x.createRadialGradient(w * .5, h * .42, 8, w * .5, h * .5, w * .78); g.addColorStop(0, '#f6ead0'); g.addColorStop(.6, '#e2d0a8'); g.addColorStop(1, '#bba67c'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scene.background = bgTex;
  // 三点布光：暖色主光（投影）+ 冷色补光 + 背后轮廓光（给模型边缘勾亮边，和背景分开）
  scene.add(new THREE.HemisphereLight(0xfff4de, 0x9a8a6a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.7); sun.position.set(-4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20}); sun.shadow.bias = -.0004; sun.shadow.radius = 5; sun.shadow.normalBias = .02; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa9c6ff, .9); fill.position.set(6, 3, 3); scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 2.2); rimL.position.set(2, 5, -7); scene.add(rimL);
  const base = new THREE.Group(); scene.add(base);
  const turn = new THREE.Group(); base.add(turn);   // 只放模型；没有转盘：脚下靠「软落影 + 真实投影」立住
  const blobTex = mk(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(70,50,20,.5)'); g.addColorStop(.55, 'rgba(70,50,20,.2)'); g.addColorStop(1, 'rgba(70,50,20,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6), new THREE.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false}));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .003; base.add(blob);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({opacity: .38}));   // 只接收阴影的透明地面
  floor.rotation.x = -Math.PI / 2; floor.position.y = .006; floor.receiveShadow = true; base.add(floor);
  const cam = new THREE.PerspectiveCamera(28, 1.6, .1, 60);
  let current = null;

  function modelFor(type) {
    const k = type + '|' + team;
    if (!cache.has(k)) {
      let v = null;
      if (MAKE[type]) {
        try {
          const model = MAKE[type](team), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
          const s = 3.3 / Math.hypot(size.x, size.y, size.z);   // 对角线统一缩放到 3.3：每个兵种都占满转台（战棋比例不用于特写）
          const holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(s); holder.position.set(-ctr.x * s, -box.min.y * s, -ctr.z * s);
          model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          v = {holder, h: size.y * s};
        } catch (e) { console.error(e); v = 'error'; }
      }
      cache.set(k, v);
    }
    return cache.get(k);
  }
  function showModel() {
    if (current) turn.remove(current.holder); current = null;
    const m = modelFor(sel);
    if (m && m !== 'error') { current = m; turn.add(m.holder); }
    if (el) { const nm = el.querySelector('.nomodel'); nm.style.display = m && m !== 'error' ? 'none' : 'grid'; nm.firstChild.textContent = m === 'error' ? '模型加载失败' : '尚未建模'; }
  }

  // ── DOM ──
  const funds = () => game.funds[team === 'blue' ? 0 : 1];
  const locked = id => UNITS[id].buildable === false || !MODEL_OF[id];   // 0.55：引擎不让造的（防空导弹）+ 还没有模型的兵种（造出来看不见）都先不能买
  // 视图 / 手势辅助：必须在 build() 之外定义——close() 也要用 resetView（0.46 把它们放进了 build() 里，关闭面板时报 ReferenceError）
  const startGesture = () => {
    const a = [...pts.values()];
    if (a.length === 1) gest = {m: 'rot', x: a[0].x, y: a[0].y, spin};
    else if (a.length >= 2) { const [p, q] = a; gest = {m: 'zoom', d: Math.hypot(p.x - q.x, p.y - q.y) || 1, z: zoom, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, px: panX, py: panY}; }
  };
  const clampView = () => { zoom = Math.min(4.5, Math.max(1, zoom)); if (zoom < 1.02) { zoom = 1; panX = panY = 0; return; } const hh = current ? current.h : 1.5; panX = Math.min(1.8, Math.max(-1.8, panX)); panY = Math.min(hh * .6 + .2, Math.max(-hh * .6 - .2, panY)); };
  const resetView = () => { zoom = 1; panX = panY = 0; };
  function build() {
    el = document.createElement('div'); el.className = 'ars ' + (team === 'blue' ? 'army-b' : 'army-r');
    el.innerHTML = `<div class="ars-dim"></div><div class="ars-row">
      <div class="ars-box ars-menu">
        <div class="ars-head"><b>兵工厂</b><span class="ars-fund">资金 <b id="arsFund"></b></span></div>
        <div class="ars-list"><i class="ars-more up">▲</i><i class="ars-more dn">▼</i><div class="ars-cards">${UNIT_IDS.map(id => `<button class="ars-card" data-u="${id}"><span class="ico">${GLYPH[id]}</span><span class="tx"><span class="nm">${UNITS[id].name}</span><span class="sub"></span></span><span class="pr"></span></button>`).join('')}</div></div>
      </div>
      <div class="ars-box ars-show"><div class="ars-body">
        <div class="ars-pv" id="arsPv"><div class="nomodel"><span>尚未建模</span></div>
          <div class="ars-tag"><b id="arsName"></b></div>
          <small class="ars-hint">拖动旋转 · 双指缩放 · 双击复位</small></div>
        <div class="ars-info"><div class="ars-stats"></div><div class="ars-wps"></div><button class="ars-close" data-act="close">关闭</button></div>
        </div>
        <div class="ars-toast"></div>
      </div></div>`;
    host.appendChild(el); host.classList.add('ars-open'); pv = el.querySelector('#arsPv'); armed = null;
    // 兵种列表的滑动（0.50）：不用浏览器原生滚动，自己按手指滑——舞台被旋转 90° 时，touch-action 按物理屏幕算，原生滚动要先「猜」手势方向，
    // 第一下就会卡；自己滑则手指一动就跟（滑动量经 stage.vec 换算成舞台纵向），松手后带惯性。
    listEl = el.querySelector('.ars-cards');
    listEl.onpointerdown = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelAnimationFrame(fling); fling = 0;
      ls = {id: e.pointerId, x: e.clientX, y: e.clientY, top: listEl.scrollTop, drag: false, lastT: performance.now(), lastTop: listEl.scrollTop, v: 0};
    };
    listEl.onpointermove = e => {
      if (!ls || e.pointerId !== ls.id) return;
      const dy = stage.vec(e.clientX - ls.x, e.clientY - ls.y).y;
      if (!ls.drag) { if (Math.abs(dy) < 6) return; ls.drag = true; try { listEl.setPointerCapture(e.pointerId); } catch (_) {} }
      const now = performance.now(); listEl.scrollTop = ls.top - dy;
      const dt = now - ls.lastT; if (dt > 0) { ls.v = ls.v * .6 + (listEl.scrollTop - ls.lastTop) / dt * .4; ls.lastT = now; ls.lastTop = listEl.scrollTop; }
    };
    listEl.onpointerup = listEl.onpointercancel = e => {
      if (!ls || e.pointerId !== ls.id) return;
      const g = ls; ls = null;
      if (!g.drag) return;
      if (e.type === 'pointerup' && performance.now() - g.lastT < 80 && Math.abs(g.v) > .05) {   // 松手时还在动：惯性滑行
        let v = g.v, t0 = performance.now();
        const step = t => { const dt = Math.min(32, t - t0); t0 = t; listEl.scrollTop += v * dt; v *= Math.pow(.94, dt / 16); if (Math.abs(v) > .02 && listEl) fling = requestAnimationFrame(step); else fling = 0; };
        fling = requestAnimationFrame(step);
      }
    };
    listEl.addEventListener('click', e => { if (listEl.dataset.dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
    listEl.addEventListener('pointerup', () => { if (ls && ls.drag) { listEl.dataset.dragged = '1'; setTimeout(() => { if (listEl) delete listEl.dataset.dragged; }, 0); } }, true);
    listEl.addEventListener('scroll', listHint, {passive: true});
    if (typeof ResizeObserver !== 'undefined') { listRO = new ResizeObserver(listHint); listRO.observe(listEl); }
    // 手势：单指 = 转模型；双指 = 捏合缩放（1×–4.5×，超近距离看细节）+ 双指一起拖动平移；双击 = 复位；电脑上滚轮缩放。
    // 舞台被旋转时，手指向量要经 stage.vec 换算到逻辑坐标（横向滑动落在另一个轴上：两个分量都要交给 vec）
    pv.onpointerdown = e => {
      if (e.target.closest('button')) return;
      pts.set(e.pointerId, {x: e.clientX, y: e.clientY}); pv.setPointerCapture(e.pointerId); startGesture();
      tapDown = pts.size === 1 ? {x: e.clientX, y: e.clientY, t: performance.now()} : null;
    };
    pv.onpointermove = e => {
      const p = pts.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY; if (!gest) return;
      if (gest.m === 'rot') spin = gest.spin + stage.vec(p.x - gest.x, p.y - gest.y).x * .012;
      else {
        const [a, b] = [...pts.values()]; zoom = gest.z * (Math.hypot(a.x - b.x, a.y - b.y) / gest.d);
        const v = stage.vec((a.x + b.x) / 2 - gest.mx, (a.y + b.y) / 2 - gest.my); panX = gest.px - v.x * pxW; panY = gest.py + v.y * pxW; clampView();
      }
    };
    pv.onpointerup = pv.onpointercancel = e => {
      pts.delete(e.pointerId);
      if (e.type === 'pointerup' && tapDown && !pts.size && performance.now() - tapDown.t < 300 && Math.hypot(e.clientX - tapDown.x, e.clientY - tapDown.y) < 8) {   // 轻点；350ms 内连点两次 = 复位
        const now = performance.now(); if (now - lastTap < 350) { resetView(); lastTap = 0; } else lastTap = now;
      }
      tapDown = null; if (pts.size) startGesture(); else gest = null;
    };
    pv.addEventListener('wheel', e => { e.preventDefault(); zoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12; clampView(); }, {passive: false});
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.u) {   // 0.54：点兵种卡 = 选中 + 把它的价格签变成「生产」按钮；再点「生产」才买；再点卡片其他地方 = 还原；点别的卡 = 直接换成那张的生产按钮
        const id = b.dataset.u, u = UNITS[id];
        if (armed === id && e.target.closest('.pr')) {
          if (locked(id) || u.cost > funds()) return;   // 灰着的「生产」按钮点了没反应
          const r = onProduce ? onProduce(id, openCell) : {ok: true};   // 0.55：真生产（main.js 调引擎 produce + 往战场加单位）；成功就关掉整个面板回战场，失败（本回合已造过 / 兵工厂上有单位…）弹提示
          if (!r.ok) { toast(r.err); armed = null; refresh(); return; }
          close(); return;
        } else if (armed === id) armed = null;
        else { sel = id; armed = id; spin = .5; resetView(); }
        refresh();
      }
      else if (b.dataset.act === 'close') close();
    });
    refresh();
  }
  // 上 / 下还有内容时：对应一侧渐隐 + 小箭头；滑到头箭头和渐隐就消失
  function listHint() {
    if (!listEl || !el) return;
    const up = listEl.scrollTop > 2, dn = listEl.scrollTop < listEl.scrollHeight - listEl.clientHeight - 2;
    listEl.style.setProperty('--ft', up ? '22px' : '0px'); listEl.style.setProperty('--fb', dn ? '22px' : '0px');
    el.querySelector('.ars-more.up').classList.toggle('on', up); el.querySelector('.ars-more.dn').classList.toggle('on', dn);
  }
  function refresh() {
    const f = funds(); el.querySelector('#arsFund').textContent = f;
    el.querySelectorAll('.ars-card').forEach(c => {
      const id = c.dataset.u, u = UNITS[id], lock = locked(id), poor = !lock && u.cost > f;
      c.classList.toggle('sel', id === sel); c.classList.toggle('poor', poor); c.classList.toggle('lock', lock);
      c.classList.toggle('arm', id === armed); const pr = c.querySelector('.pr');
      if (id === armed) pr.innerHTML = lock ? (u.buildable === false ? '<b>暂不可</b><i>生产</i>' : '<b>未建模</b><i>暂不可</i>') : poor ? '<b>资金不足</b><i>' + u.cost + '</i>' : '<b>生产</b><i>' + u.cost + '</i>';   // 价格签变成「生产 / 价格」按钮
      else pr.textContent = lock ? (u.buildable === false ? '暂不可' : '未建模') : u.cost;
      c.querySelector('.sub').textContent = `移${u.move} · 射${u.range[0] === u.range[1] ? u.range[0] : u.range.join('–')}`;
    });
    const u = UNITS[sel], lock = locked(sel), poor = !lock && u.cost > f;
    el.querySelector('#arsName').textContent = u.name;
    // 右列（0.52，仿高战2）：机动 / 视野 / 燃料三行，然后主炮、副炮各一块：武器名 + 弹药，下面是「能打的大类」小块（只列能打的，不列灰的）
    const fuel = u.fuel === Infinity ? '∞' : u.fuel + '/' + u.fuel;
    el.querySelector('.ars-stats').innerHTML = `<div>机动<b>${u.move}</b></div><div>视野<b>${u.vision}</b></div><div>燃料<b>${fuel}</b></div>`;
    el.querySelector('.ars-wps').innerHTML = weaponHtml(sel);   // 0.60：主副炮块抽到 unit-info.js，和战场长按详细面板共用
    showModel();
    const sc = el.querySelector('.ars-card.sel');   // 选中的卡片不在可见范围内才把它滑到中间（点一下可见的卡片，列表不乱跳）
    if (sc && listEl) { const t = sc.offsetTop, b = t + sc.offsetHeight; if (t < listEl.scrollTop || b > listEl.scrollTop + listEl.clientHeight) listEl.scrollTop = t - (listEl.clientHeight - sc.offsetHeight) / 2; }
    listHint();
  }
  function toast(m) { const t = el.querySelector('.ars-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }

  function open(cell, owner) { if (el) close(); openCell = cell; team = TEAM_NAME[owner] ? owner : 'blue'; build(); }
  function close() { if (!el) return; armed = null; cancelAnimationFrame(fling); fling = 0; ls = null; if (listRO) { listRO.disconnect(); listRO = null; } listEl = null; host.classList.remove('ars-open'); el.remove(); el = pv = null; openCell = null; lastHole = ''; pts.clear(); gest = null; resetView(); if (current) { turn.remove(current.holder); current = null; } }

  // ── 每帧：把预览画进右侧留空矩形（舞台旋转时也成立：DOM 在舞台内，用 offset 链取逻辑坐标）──
  const v4 = new THREE.Vector4(), s4 = new THREE.Vector4();
  function rect() { let x = 0, y = 0; for (let n = pv; n && n !== host; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return {x, y, w: pv.offsetWidth, h: pv.offsetHeight}; }
  function renderPreview(dt) {
    if (!el || !pv) return;
    const r = rect(); if (r.w < 8 || r.h < 8) return;
    if (!gest && zoom < 1.05) spin += dt * .6;   // 手指按着、或已经放大在看细节时不自转
    turn.rotation.y = spin;
    const hole = `${r.x},${r.y},${r.w},${r.h}`;
    if (hole !== lastHole) {   // 预览窗位置变了才重挖：压暗层在窗口矩形处挖洞，转台才不会被压暗（窗口四角的圆角由 .ars-pv 外扩的奶油色阴影盖住）
      lastHole = hole;
      el.querySelector('.ars-dim').style.clipPath = `path(evenodd,'M0 0H${host.offsetWidth}V${host.offsetHeight}H0Z M${r.x} ${r.y}H${r.x + r.w}V${r.y + r.h}H${r.x}Z')`;
    }
    // 取景：纵向按模型高度（含脚下落影）、横向按模型占地，取较大的距离
    const asp = r.w / r.h, fov = 28, hh = current ? current.h : 1.5, half = hh / 2 * 1.14 + .5, ty = hh / 2 - .12;
    cam.aspect = asp; cam.fov = fov; cam.updateProjectionMatrix();
    const fitV = half / Math.sin(fov * Math.PI / 360), fitH = 2.3 / Math.sin(Math.atan(Math.tan(fov * Math.PI / 360) * asp));
    const d = Math.max(fitV, fitH) / zoom, el20 = .3, tY = ty + panY;   // 缩放 = 相机拉近；平移 = 观察点在 x / y 上移动
    cam.position.set(panX, tY + d * Math.sin(el20), d * Math.cos(el20)); cam.lookAt(panX, tY, 0);
    pxW = 2 * d * Math.tan(fov * Math.PI / 360) / r.h;   // 每个屏幕像素对应的世界距离（平移手势用）
    renderer.getViewport(v4); renderer.getScissor(s4); const st = renderer.getScissorTest(), ar = renderer.autoClear;
    const vy = stage.h - (r.y + r.h);
    renderer.setViewport(r.x, vy, r.w, r.h); renderer.setScissor(r.x, vy, r.w, r.h); renderer.setScissorTest(true); renderer.autoClear = true;
    renderer.render(scene, cam);
    renderer.setScissorTest(st); renderer.setViewport(v4); renderer.setScissor(s4); renderer.autoClear = ar;
  }
  function dispose() { close(); bgTex.dispose(); blobTex.dispose(); blob.geometry.dispose(); blob.material.dispose(); floor.geometry.dispose(); floor.material.dispose(); if (sun.shadow.map) sun.shadow.map.dispose(); }
  return {open, close, renderPreview, dispose, get isOpen() { return !!el; }};
}
