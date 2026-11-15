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
  let lastHole = '', openCell = null, team = 'blue', sel = 'tank', spin = .5, drag = null, el = null, pv = null, toastT = 0;
  const cache = new Map();   // 'type|team' → {holder} | null（尚未建模）| 'error'

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
  // 玩具底座：深蓝灰厚底 + 奶油白台面 + 军队色描边 + 一圈刻度（刻度随台面一起转，才看得出在转）
  const turn = new THREE.Group(); base.add(turn);
  const std = (c, r = .6) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: .05});
  const rimMat = std('#3b82f6', .5);
  const cyl = (r0, r1, h, y, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 64), mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; turn.add(m); return m; };
  cyl(2.32, 2.4, .2, -.46, std('#2d3e55', .7));   // 底座
  cyl(2.2, 2.2, .06, -.33, rimMat);               // 军队色腰线
  const top = cyl(2.1, 2.14, .2, -.1, std('#fff4d6', .55));   // 台面，顶面在 y=0
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.78, .018, 8, 96), rimMat); ring.rotation.x = Math.PI / 2; ring.position.y = .002; turn.add(ring);   // 台面细环
  const tickMat = std('#2d3e55', .7);
  for (let i = 0; i < 36; i++) { const big = i % 3 === 0, t = new THREE.Mesh(new THREE.BoxGeometry(big ? .05 : .03, .012, big ? .16 : .09), tickMat); const a = i / 36 * Math.PI * 2; t.position.set(Math.sin(a) * 1.96, .004, Math.cos(a) * 1.96); t.rotation.y = a; turn.add(t); }
  // 底座下方的柔和落影（背景是平的，没有地面可投，靠这块渐隐的暗斑把底座"放"在空间里）
  const blobTex = mk(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(60,45,20,.55)'); g.addColorStop(1, 'rgba(60,45,20,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), new THREE.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false}));
  blob.rotation.x = -Math.PI / 2; blob.position.y = -.58; base.add(blob);
  const ped = turn.children.filter(o => o.isMesh);   // 只含底座零件（模型之后才加进 turn）
  const cam = new THREE.PerspectiveCamera(28, 1.6, .1, 60);
  let current = null;

  function modelFor(type) {
    const k = type + '|' + team;
    if (!cache.has(k)) {
      let v = null;
      if (MAKE[type]) {
        try {
          const model = MAKE[type](team), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
          const s = 3.5 / Math.hypot(size.x, size.y, size.z);   // 对角线统一缩放到 3.5：每个兵种都占满转台（战棋比例不用于特写）
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
    pv.onpointerdown = e => { drag = {x: e.clientX, y: e.clientY, spin}; pv.setPointerCapture(e.pointerId); };
    pv.onpointermove = e => { if (drag) spin = drag.spin + stage.vec(e.clientX - drag.x, e.clientY - drag.y).x * .012; };   // 舞台被旋转时，手指横向滑动落在逻辑坐标的另一个轴上：必须两个分量都交给 vec 换算
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
    rimMat.color.set(team === 'blue' ? '#3b82f6' : '#ef4444');
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
    // 取景：纵向按「底座 + 模型」的总高度、横向按底座直径，取较大的那个距离，保证底座和模型都完整入镜
    const asp = r.w / r.h, fov = 28, hh = current ? current.h : 1.5, half = (hh + .6) / 2 * 1.1 + .4, ty = (hh - .6) / 2 - .3;
    cam.aspect = asp; cam.fov = fov; cam.updateProjectionMatrix();
    const fitV = half / Math.sin(fov * Math.PI / 360), fitH = 2.75 / Math.sin(Math.atan(Math.tan(fov * Math.PI / 360) * asp));
    const d = Math.max(fitV, fitH), el20 = .34;
    cam.position.set(0, ty + d * Math.sin(el20), d * Math.cos(el20)); cam.lookAt(0, ty, 0);
    renderer.getViewport(v4); renderer.getScissor(s4); const st = renderer.getScissorTest(), ar = renderer.autoClear;
    const vy = stage.h - (r.y + r.h);
    renderer.setViewport(r.x, vy, r.w, r.h); renderer.setScissor(r.x, vy, r.w, r.h); renderer.setScissorTest(true); renderer.autoClear = true;
    renderer.render(scene, cam);
    renderer.setScissorTest(st); renderer.setViewport(v4); renderer.setScissor(s4); renderer.autoClear = ar;
  }
  function dispose() { close(); bgTex.dispose(); blobTex.dispose(); blob.geometry.dispose(); blob.material.dispose(); ped.forEach(o => { o.geometry.dispose(); o.material.dispose(); }); if (sun.shadow.map) sun.shadow.map.dispose(); }
  return {open, close, renderPreview, dispose, get isOpen() { return !!el; }};
}
