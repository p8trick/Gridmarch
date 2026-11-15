import {UNITS, UNIT_IDS} from '../rules/data.js';
import {createTank} from '../game/units/tank-family.js';
import {createArtillery} from '../art/units/artillery-v2_0.js';
import {createInfantryBaseline} from '../art/units/infantry/infantry-performance.js';
import {createAntiTankBaseline} from '../art/units/infantry/anti-tank-performance.js';

// 兵工厂界面（0.42）：左边兵种卡片、右边选中单位的高精度模型转台 + 数据 + 生产按钮。界面风格取「B 玩具盒」（奶油底 + 深色粗边 + 军队色细条）。
// 转台不开第二个画布：用战场同一个 renderer，在右侧留空区域对应的屏幕矩形里（viewport + scissor）再画一个独立小场景。
// 目前「生产」只是演示（不扣钱、不出兵），等你对界面和模型特写满意了再接引擎的 produce()。
const GLYPH = {inf: '兵', mech: '机', recon: '侦', apc: '运', tank: '轻', mdtank: '中', neotank: '重', arty: '炮', rocket: '箭', aa: '空', missile: '导'};
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
  let lastHole = '', openCell = null, team = 'blue', sel = 'tank', spin = .5, drag = null, el = null, pv = null, toastT = 0;
  const cache = new Map();   // 'type|team' → {holder} | null（尚未建模）| 'error'

  // ── 预览场景（独立于战场）──
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#dff0ff');
  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x6c7a4a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6); sun.position.set(-4, 7, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20}); sun.shadow.bias = -.0004; scene.add(sun);
  const base = new THREE.Group(); scene.add(base);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.42, .16, 56), new THREE.MeshStandardMaterial({color: '#8cc63f', roughness: 1}));
  disc.position.y = -.08; disc.receiveShadow = true; base.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.36, .05, 8, 72), new THREE.MeshStandardMaterial({color: '#2d3e55', roughness: .8}));
  rim.rotation.x = Math.PI / 2; rim.position.y = .0; base.add(rim);
  const turn = new THREE.Group(); base.add(turn);
  const cam = new THREE.PerspectiveCamera(28, 1.6, .1, 60);
  let current = null;

  function modelFor(type) {
    const k = type + '|' + team;
    if (!cache.has(k)) {
      let v = null;
      if (MAKE[type]) {
        try {
          const model = MAKE[type](team), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
          const s = 4.0 / Math.hypot(size.x, size.y, size.z);   // 对角线统一缩放到 4.0：每个兵种都占满转台（战棋比例不用于特写）
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
    el = document.createElement('div'); el.className = 'ars ' + (team === 'blue' ? 'army-b' : 'army-r');
    el.innerHTML = `<div class="ars-dim"></div><div class="ars-panel"><div class="ars-bg"></div>
      <div class="ars-head"><b>兵工厂</b><span class="ars-sub">点选兵种</span>
        <button class="ars-sw" data-act="team">${TEAM_NAME[team]}</button><span class="ars-fund">资金 <b id="arsFund"></b></span><button class="ars-x" data-act="close" aria-label="关闭">✕</button></div>
      <div class="ars-body">
        <div class="ars-cards">${UNIT_IDS.map(id => `<button class="ars-card" data-u="${id}"><span class="ico">${GLYPH[id]}</span><span class="tx"><span class="nm">${UNITS[id].name}</span><span class="pr"></span></span></button>`).join('')}</div>
        <div class="ars-view"><div class="ars-name"><b id="arsName"></b><small>拖动旋转</small></div>
          <div class="ars-pv" id="arsPv"><div class="nomodel"><span>尚未建模</span></div></div>
          <div class="ars-stats"></div><button class="ars-buy" data-act="buy"></button></div>
      </div><div class="ars-toast"></div></div>`;
    host.appendChild(el); pv = el.querySelector('#arsPv');
    pv.onpointerdown = e => { drag = {x: e.clientX, spin}; pv.setPointerCapture(e.pointerId); };
    pv.onpointermove = e => { if (drag) spin = drag.spin + stage.vec(e.clientX - drag.x, 0).x * .012; };
    pv.onpointerup = pv.onpointercancel = () => { drag = null; };
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.u) { sel = b.dataset.u; spin = .5; refresh(); }
      else if (b.dataset.act === 'close') close();
      else if (b.dataset.act === 'team') { team = team === 'blue' ? 'red' : 'blue'; el.className = 'ars ' + (team === 'blue' ? 'army-b' : 'army-r'); b.textContent = TEAM_NAME[team]; refresh(); }   // 仅供验收美术：换军队色看模型
      else if (b.dataset.act === 'buy') toast('演示：生产还没接入引擎（不扣钱、不出兵）');
    });
    refresh();
  }
  function refresh() {
    const f = funds(); el.querySelector('#arsFund').textContent = f;
    el.querySelectorAll('.ars-card').forEach(c => {
      const id = c.dataset.u, u = UNITS[id], lock = u.buildable === false, poor = !lock && u.cost > f;
      c.classList.toggle('sel', id === sel); c.classList.toggle('poor', poor); c.classList.toggle('lock', lock);
      c.querySelector('.pr').textContent = lock ? '暂不可生产' : u.cost;
    });
    const u = UNITS[sel], lock = u.buildable === false, poor = !lock && u.cost > f, r = u.range;
    el.querySelector('#arsName').textContent = u.name;
    el.querySelector('.ars-stats').innerHTML = `<div><b>${u.move}</b>移动</div><div><b>${r[0] === r[1] ? r[0] : r.join('–')}</b>射程</div><div><b>${u.ammo || '—'}</b>弹药</div><div><b>${u.vision}</b>视野</div>`;
    const buy = el.querySelector('.ars-buy'); buy.disabled = lock || poor; buy.textContent = lock ? '暂不可生产' : poor ? '资金不足 · ' + u.cost : '生产 · ' + u.cost;
    showModel();
  }
  function toast(m) { const t = el.querySelector('.ars-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }

  function open(cell, owner) { if (el) close(); openCell = cell; team = TEAM_NAME[owner] ? owner : 'blue'; build(); }
  function close() { if (!el) return; el.remove(); el = pv = null; openCell = null; lastHole = ''; drag = null; if (current) { turn.remove(current.holder); current = null; } }

  // ── 每帧：把预览画进右侧留空矩形（舞台旋转时也成立：DOM 在舞台内，用 offset 链取逻辑坐标）──
  const v4 = new THREE.Vector4(), s4 = new THREE.Vector4();
  function rect() { let x = 0, y = 0; for (let n = pv; n && n !== host; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return {x, y, w: pv.offsetWidth, h: pv.offsetHeight}; }
  function renderPreview(dt) {
    if (!el || !pv) return;
    const r = rect(); if (r.w < 8 || r.h < 8) return;
    if (!drag) spin += dt * .6;
    turn.rotation.y = spin;
    const hole = `${r.x},${r.y},${r.w},${r.h}`;
    if (hole !== lastHole) {   // 预览位置变了才重挖：底板（.ars-bg）用 evenodd clip-path 挖出一个与预览框重合的洞
      lastHole = hole; const panel = el.querySelector('.ars-panel'), bg = el.querySelector('.ars-bg'); let ox = 0, oy = 0;
      for (let n = panel; n && n !== host; n = n.offsetParent) { ox += n.offsetLeft; oy += n.offsetTop; }
      const x = r.x - ox, y = r.y - oy, W = bg.offsetWidth, H = bg.offsetHeight;
      bg.style.clipPath = `path(evenodd,'M0 0H${W}V${H}H0Z M${x} ${y}H${x + r.w}V${y + r.h}H${x}Z')`;
      el.querySelector('.ars-dim').style.clipPath = `path(evenodd,'M0 0H${host.offsetWidth}V${host.offsetHeight}H0Z M${r.x} ${r.y}H${r.x + r.w}V${r.y + r.h}H${r.x}Z')`;
    }
    const asp = r.w / r.h, fov = 28, hh = current ? current.h : 1.5, ctr = Math.max(.9, hh / 2);
    cam.aspect = asp; cam.fov = fov; cam.updateProjectionMatrix();
    const fitV = 2.05 / Math.sin(fov * Math.PI / 360), fitH = 2.05 / Math.sin(Math.atan(Math.tan(fov * Math.PI / 360) * asp));
    const d = Math.max(fitV, fitH) * 1.04, el20 = .36;
    cam.position.set(0, ctr + d * Math.sin(el20), d * Math.cos(el20)); cam.lookAt(0, ctr * .85, 0);
    renderer.getViewport(v4); renderer.getScissor(s4); const st = renderer.getScissorTest(), ar = renderer.autoClear;
    const vy = stage.h - (r.y + r.h);
    renderer.setViewport(r.x, vy, r.w, r.h); renderer.setScissor(r.x, vy, r.w, r.h); renderer.setScissorTest(true); renderer.autoClear = true;
    renderer.render(scene, cam);
    renderer.setScissorTest(st); renderer.setViewport(v4); renderer.setScissor(s4); renderer.autoClear = ar;
  }
  function dispose() { close(); disc.geometry.dispose(); disc.material.dispose(); rim.geometry.dispose(); rim.material.dispose(); if (sun.shadow.map) sun.shadow.map.dispose(); }
  return {open, close, renderPreview, dispose, get isOpen() { return !!el; }};
}
