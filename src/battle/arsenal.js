import {UNITS, UNIT_IDS} from '../rules/data.js';
import {createTank} from '../game/units/tank-family.js';
import {createArtillery} from '../art/units/artillery-v2_0.js';
import {createInfantryBaseline} from '../art/units/infantry/infantry-performance.js';
import {createAntiTankBaseline} from '../art/units/infantry/anti-tank-performance.js';

// 兵工厂界面（0.42）：左边兵种卡片、右边选中单位的高精度模型转台 + 数据 + 生产按钮。界面风格取「B 玩具盒」（奶油底 + 深色粗边 + 军队色细条）。
// 转台不开第二个画布：用战场同一个 renderer，在右侧留空区域对应的屏幕矩形里（viewport + scissor）再画一个独立小场景。
// 目前「生产」只是演示（不扣钱、不出兵），等你对界面和模型特写满意了再接引擎的 produce()。
const GLYPH = {inf: '兵', mech: '反', recon: '侦', apc: '运', tank: '轻', mdtank: '中', neotank: '重', arty: '炮', rocket: '箭', aa: '空', missile: '导'};
const MAKE = {   // 引擎兵种 → 高精度模型（预览用原版 / 基线版，不是战场上的批量性能版）；没有的 = 尚未建模
  inf: team => { const u = createInfantryBaseline(); u.setFaction(team); u.setPose('idle'); return u; },
  mech: team => { const u = createAntiTankBaseline(); u.setFaction(team); u.setPose('idle'); return u; },
  tank: team => createTank('light', {faction: team}),
  mdtank: team => createTank('medium', {faction: team}),
  neotank: team => createTank('heavy', {faction: team}),
  arty: team => createArtillery({faction: team, batch: true, paint: true}),
};
const TEAM_NAME = {blue: '蓝军', red: '红军'};

export function createArsenal({THREE, renderer, host, stage, game}) {
  let lastHole = '', openCell = null, team = 'blue', sel = 'tank', spin = .5, gest = null, zoom = 1, panX = 0, panY = 0, pxW = .01, lastTap = 0, tapDown = null, el = null, pv = null, toastT = 0;
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
  function build() {
    el = document.createElement('div'); el.className = 'ars ' + (team === 'blue' ? 'army-b' : 'army-r') + (stage.side === 'right' ? ' side-r' : ' side-l');   // 灵动岛在哪一边，那一边就多留出空来
    el.innerHTML = `<div class="ars-dim"></div><div class="ars-row">
      <div class="ars-box ars-menu">
        <div class="ars-head"><b>兵工厂</b><span class="ars-fund">资金 <b id="arsFund"></b></span></div>
        <div class="ars-cards">${UNIT_IDS.map(id => `<button class="ars-card" data-u="${id}"><span class="ico">${GLYPH[id]}</span><span class="tx"><span class="nm">${UNITS[id].name}</span><span class="sub"></span></span><span class="pr"></span></button>`).join('')}</div>
      </div>
      <div class="ars-box ars-show">
        <div class="ars-pv" id="arsPv"><div class="nomodel"><span>尚未建模</span></div>
          <div class="ars-tag"><b id="arsName"></b><button class="ars-sw" data-act="team">${TEAM_NAME[team]}</button></div>
          <button class="ars-x" data-act="close" aria-label="关闭">✕</button><small class="ars-hint">拖动旋转 · 双指缩放 · 双击复位</small></div>
        <div class="ars-bar"><div class="ars-stats"></div><button class="ars-buy" data-act="buy"></button></div>
        <div class="ars-toast"></div>
      </div></div>`;
    host.appendChild(el); host.classList.add('ars-open'); pv = el.querySelector('#arsPv');
    // 手势：单指 = 转模型；双指 = 捏合缩放（1×–4.5×，超近距离看细节）+ 双指一起拖动平移；双击 = 复位；电脑上滚轮缩放。
    // 舞台被旋转时，手指向量要经 stage.vec 换算到逻辑坐标（横向滑动落在另一个轴上：两个分量都要交给 vec）
    const startGesture = () => {
      const a = [...pts.values()];
      if (a.length === 1) gest = {m: 'rot', x: a[0].x, y: a[0].y, spin};
      else if (a.length >= 2) { const [p, q] = a; gest = {m: 'zoom', d: Math.hypot(p.x - q.x, p.y - q.y) || 1, z: zoom, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, px: panX, py: panY}; }
    };
    const clampView = () => { zoom = Math.min(4.5, Math.max(1, zoom)); if (zoom < 1.02) { zoom = 1; panX = panY = 0; return; } const hh = current ? current.h : 1.5; panX = Math.min(1.8, Math.max(-1.8, panX)); panY = Math.min(hh * .6 + .2, Math.max(-hh * .6 - .2, panY)); };
    const resetView = () => { zoom = 1; panX = panY = 0; };
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
      if (b.dataset.u) { sel = b.dataset.u; spin = .5; resetView(); refresh(); }
      else if (b.dataset.act === 'close') close();
      else if (b.dataset.act === 'team') { team = team === 'blue' ? 'red' : 'blue'; el.className = 'ars ' + (team === 'blue' ? 'army-b' : 'army-r') + (stage.side === 'right' ? ' side-r' : ' side-l'); b.textContent = TEAM_NAME[team]; refresh(); }   // 仅供验收美术：换军队色看模型
      else if (b.dataset.act === 'buy') toast('演示：生产还没接入引擎（不扣钱、不出兵）');
    });
    refresh();
  }
  function refresh() {
    const f = funds(); el.querySelector('#arsFund').textContent = f;
    el.querySelectorAll('.ars-card').forEach(c => {
      const id = c.dataset.u, u = UNITS[id], lock = u.buildable === false, poor = !lock && u.cost > f;
      c.classList.toggle('sel', id === sel); c.classList.toggle('poor', poor); c.classList.toggle('lock', lock);
      c.querySelector('.pr').textContent = lock ? '暂不可' : u.cost;
      c.querySelector('.sub').textContent = `移${u.move} · 射${u.range[0] === u.range[1] ? u.range[0] : u.range.join('–')}`;
    });
    const u = UNITS[sel], lock = u.buildable === false, poor = !lock && u.cost > f, r = u.range;
    el.querySelector('#arsName').textContent = u.name;
    el.querySelector('.ars-stats').innerHTML = `<div><b>${u.move}</b>移动</div><div><b>${r[0] === r[1] ? r[0] : r.join('–')}</b>射程</div><div><b>${u.ammo || '—'}</b>弹药</div><div><b>${u.vision}</b>视野</div>`;
    const buy = el.querySelector('.ars-buy'); buy.disabled = lock || poor; buy.textContent = lock ? '暂不可生产' : poor ? '资金不足 · ' + u.cost : '生产 · ' + u.cost;
    showModel();
    const sc = el.querySelector('.ars-card.sel'); if (sc) sc.scrollIntoView({block: 'center'});
  }
  function toast(m) { const t = el.querySelector('.ars-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }

  function open(cell, owner) { if (el) close(); openCell = cell; team = TEAM_NAME[owner] ? owner : 'blue'; build(); }
  function close() { if (!el) return; host.classList.remove('ars-open'); el.remove(); el = pv = null; openCell = null; lastHole = ''; pts.clear(); gest = null; resetView(); if (current) { turn.remove(current.holder); current = null; } }

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
