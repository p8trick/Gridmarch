import {UNITS, TERRAINS} from '../rules/data.js';
import {dispHp} from '../rules/engine.js';
import {GLYPH, MT_NAME, weaponHtml} from './unit-info.js';
import {terrainNote, unitTip, terrainTip, unitDefault, terrainDefault} from './explain.js';

// 长按详细面板（0.60 做出，0.61 加了展示窗 + 点一项看说明；风格同兵工厂的「B 玩具盒」）：
//   格上有单位 → 左「单位盒」+ 右「地形盒」；没有单位 → 只有「地形盒」居中。
//   每个盒子左上是一个「展示窗」：不开新画布、不用新模型——用战场同一个 renderer 和同一个场景，换一台近景相机，在窗口对应的屏幕矩形里
//   （viewport + scissor）再画一遍这一格（单位盒 = 单位近景，地形盒 = 地形俯视带周围）。手指在窗口上拖动可以转视角。
//   窗口是透明的洞：盒子本身不画底色，奶油色靠 .dt-view 的外扩阴影（同兵工厂 .ars-pv 的做法），压暗层在窗口位置挖洞。
//   点一项（血量 / 机动 / 主炮 / 防御星 / 某类移动消耗…）→ 该项高亮，盒子底部说明栏换成这一项的解释（文字全在 explain.js）；再点一次取消。
//   点盒子外面的暗处，或右上角「关闭」关掉面板。
// 数据全部来自规则引擎（data.js + game 状态），打开时取一次快照（面板打开期间战场不会变）。
const OWN = ['蓝军', '红军'];
const MTS = ['foot', 'mech', 'tread', 'wheel'];

export function createDetail({THREE, renderer, host, stage, game, world, toEngine, getYaw, onOpen, onClose}) {
  let el = null, openedAt = 0, sawDown = false, wins = [], frames = 0, cell = null;

  const stars = n => '<span class="dt-st on">★</span>'.repeat(n) + '<span class="dt-st">★</span>'.repeat(Math.max(0, 4 - n));
  const kv = (k, key, v) => `<div class="dt-kv" data-k="${key}"><span>${k}</span><b>${v}</b></div>`;

  function unitBox(eu) {
    const d = UNITS[eu.type], hp = dispHp(eu.hp), col = hp >= 7 ? '#4fc34f' : hp >= 4 ? '#f2b81e' : '#ee5a4d';
    const rg = d.range[0] === d.range[1] ? d.range[0] : d.range.join('–');
    return `<div class="dt-box ${eu.owner === 0 ? 'army-b' : 'army-r'}" data-box="unit">
      <div class="dt-head"><span class="dt-ico">${GLYPH[eu.type]}</span><b class="dt-name">${d.name}</b><span class="dt-chips"><em class="dt-chip ${eu.acted ? '' : 'go'}" data-k="status">${eu.acted ? '已行动' : '可行动'}</em><em class="dt-chip army">${OWN[eu.owner]}</em></span></div>
      <div class="dt-mid"><div class="dt-view" data-w="unit"></div><div class="dt-col">
        <div class="dt-hp" data-k="hp"><span>血量</span><span class="dt-bar"><i style="width:${hp * 10}%;background:${col}"></i></span><b>${hp}/10</b></div>
        <div class="dt-grid">${kv('机动', 'move', d.move)}${kv('视野', 'vision', d.vision)}${kv('射程', 'range', rg)}${kv('移动', 'mt', MT_NAME[d.mt])}${kv('燃料', 'fuel', d.fuel === Infinity ? '∞' : eu.fuel + '/' + d.fuel)}${kv('弹药', 'ammo', d.ammo ? eu.ammo + '/' + d.ammo : '—')}</div>
      </div></div>
      <div class="dt-wps">${weaponHtml(eu.type, d.ammo ? eu.ammo : undefined)}</div>
      <div class="dt-exp"></div>
    </div>`;
  }

  function terrainBox(tid, owner, eu) {
    const T = TERRAINS[tid], cfg = game.config || {};
    const army = T.property && owner !== undefined ? (owner === 0 ? 'army-b' : 'army-r') : '';
    const chip = T.property ? `<em class="dt-chip ${army ? 'army' : ''}" data-k="owner">${owner === undefined ? '中立' : OWN[owner]}</em>` : '';
    const mine = eu ? UNITS[eu.type].mt : null;
    const cost = MTS.map(m => { const c = T.cost[m]; return `<div class="dt-c ${m === mine ? 'me' : ''}" data-k="cost:${m}"><span>${MT_NAME[m]}</span><b class="${c === null ? 'no' : ''}">${c === null ? '✕' : c}</b></div>`; }).join('');
    const extra = [];
    if (T.property) { extra.push(kv('收入', 'income', T.income + '/回合')); extra.push(kv('占领点数', 'capture', T.capture)); }
    return `<div class="dt-box ${army}" data-box="terrain">
      <div class="dt-head"><b class="dt-name">${T.name}</b><span class="dt-chips">${chip}</span></div>
      <div class="dt-mid"><div class="dt-view" data-w="terrain"></div><div class="dt-col">
        <div class="dt-note">${terrainNote(tid)}</div>
        <div class="dt-def" data-k="stars"><span>防御</span><span class="dt-stars">${T.stars ? stars(T.stars) : '<span class="dt-none">无</span>'}</span></div>
      </div></div>
      <div class="dt-cost">${cost}</div>
      ${extra.length ? `<div class="dt-grid">${extra.join('')}</div>` : ''}
      ${T.hazard && cfg.swampDamage ? '<div class="dt-warn" data-k="hazard">回合结束时，站在这里的陆军会掉血 ▸</div>' : ''}
      <div class="dt-exp"></div>
    </div>`;
  }

  // 说明栏：key 为空 = 默认文字
  function explain(box, key) {
    const tid = game.terrain[cell.ey][cell.ex], eu = cell.eu, cfg = game.config || {};
    const isUnit = box.dataset.box === 'unit';
    const tip = key ? (isUnit ? unitTip(key, {type: eu.type, eu, cfg}) : terrainTip(key, {tid, owner: game.owners[cell.ex + ',' + cell.ey], eu, cfg}))
      : (isUnit ? unitDefault(eu.type) : terrainDefault(tid, eu));
    box.querySelector('.dt-exp').innerHTML = tip ? `<b>${tip.t}</b>${tip.d}` : '';
    box.querySelectorAll('[data-k].sel').forEach(n => n.classList.remove('sel'));
    return tip;
  }
  function pick(box, node) {
    const k = node.dataset.k, was = node.classList.contains('sel');
    if (was) explain(box, null); else if (explain(box, k)) node.classList.add('sel');
  }

  function open(c) {
    if (el) close(true);
    const [ex, ey] = toEngine(c), tid = game.terrain[ey] && game.terrain[ey][ex]; if (!tid) return false;
    const eu = game.units.find(u => u.x === ex && u.y === ey) || null;
    cell = {c, ex, ey, eu};
    el = document.createElement('div'); el.className = 'det';
    el.innerHTML = `<div class="det-dim"></div><div class="det-row">${eu ? unitBox(eu) : ''}${terrainBox(tid, game.owners[ex + ',' + ey], eu)}</div><button class="det-x" type="button">关闭</button><div class="det-hint">点一项看说明　·　拖动小窗转视角</div>`;
    el.querySelectorAll('.dt-box').forEach(b => explain(b, null));
    // 关闭只认「在面板上按下 + 抬起」：长按时手指还没抬起，抬起产生的那次 click 不能把刚打开的面板关掉
    el.addEventListener('pointerdown', () => { sawDown = true; });
    el.addEventListener('click', e => {
      const ok = sawDown && performance.now() - openedAt > 250; sawDown = false;
      const box = e.target.closest('.dt-box'), item = e.target.closest('[data-k]');
      if (box && item) { pick(box, item); return; }
      if (box) return;   // 盒子里的空白处：什么都不做（关闭靠盒子外面的暗处 / 右上角「关闭」）
      if (ok) close();
    });
    host.appendChild(el); host.classList.add('det-open'); openedAt = performance.now(); sawDown = false; frames = 0;
    wins = [...el.querySelectorAll('.dt-view')].map(v => {
      const kind = v.dataset.w, w = {el: v, kind, cam: new THREE.PerspectiveCamera(30, 1.3, .1, 150), yaw: getYaw(), pitch: kind === 'unit' ? 26 : 58, d: kind === 'unit' ? 4.6 : 9.5, drag: null};
      v.addEventListener('pointerdown', e => { w.drag = {x: e.clientX, y: e.clientY, yaw: w.yaw, pitch: w.pitch, id: e.pointerId}; v.setPointerCapture(e.pointerId); e.stopPropagation(); sawDown = false; });
      v.addEventListener('pointermove', e => {
        if (!w.drag || w.drag.id !== e.pointerId) return;
        const v2 = stage.vec(e.clientX - w.drag.x, e.clientY - w.drag.y);   // 舞台旋转时把屏幕位移换成舞台方向
        w.yaw = w.drag.yaw - v2.x * .012; w.pitch = Math.max(8, Math.min(80, w.drag.pitch + v2.y * .3)); frames = 0;
      });
      const end = e => { if (w.drag && w.drag.id === e.pointerId) w.drag = null; };
      v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
      v.addEventListener('click', e => e.stopPropagation());   // 点窗口不算关闭
      return w;
    });
    if (onOpen) onOpen();
    return true;
  }
  function close(silent) {
    if (!el) return; el.remove(); el = null; wins = []; cell = null; host.classList.remove('det-open');
    if (!silent && onClose) onClose();
  }

  // ── 每帧（主循环里战场画完之后）：把各个展示窗画进对应的矩形 ──
  const v4 = new THREE.Vector4(), s4 = new THREE.Vector4();
  function rectOf(n) { let x = 0, y = 0; for (let t = n; t && t !== host; t = t.offsetParent) { x += t.offsetLeft; y += t.offsetTop; } return {x, y, w: n.offsetWidth, h: n.offsetHeight}; }
  const needsFrame = () => !!el && frames < 6;   // 面板刚开 / 拖动 / 尺寸变化后的几帧才需要重画；静止时不出帧（省电）
  function renderPreview() {
    if (!el) return; frames++;
    const holes = [];
    renderer.getViewport(v4); renderer.getScissor(s4);
    const st = renderer.getScissorTest(), ar = renderer.autoClear, sh = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;   // 阴影图和相机无关（太阳视角），沿用刚画战场时的那张，省掉一遍阴影渲染
    for (const w of wins) {
      const r = rectOf(w.el); if (r.w < 8 || r.h < 8) continue;
      holes.push(`M${r.x} ${r.y}H${r.x + r.w}V${r.y + r.h}H${r.x}Z`);
      const [cx, cz] = [cell.c[0] * 2, cell.c[1] * 2], gy = world.surfaceY(cell.c[0], cell.c[1]);
      const ty = gy + (w.kind === 'unit' ? .55 : .1), p = w.pitch * Math.PI / 180, cam = w.cam;
      cam.aspect = r.w / r.h; cam.updateProjectionMatrix();
      cam.position.set(cx + Math.sin(w.yaw) * Math.cos(p) * w.d, ty + Math.sin(p) * w.d, cz + Math.cos(w.yaw) * Math.cos(p) * w.d); cam.lookAt(cx, ty, cz);
      world.cull(cam);
      const vy = stage.h - (r.y + r.h);
      renderer.setViewport(r.x, vy, r.w, r.h); renderer.setScissor(r.x, vy, r.w, r.h); renderer.setScissorTest(true); renderer.autoClear = true;
      renderer.render(world.scene, cam);
    }
    renderer.shadowMap.autoUpdate = sh; renderer.setScissorTest(st); renderer.setViewport(v4); renderer.setScissor(s4); renderer.autoClear = ar;
    const dim = el.querySelector('.det-dim');   // 压暗层在窗口位置挖洞（evenodd：外框 + 每个窗口一个洞），窗口里才不会被压暗
    const hole = `path(evenodd,'M0 0H${host.offsetWidth}V${host.offsetHeight}H0Z ${holes.join(' ')}')`;
    if (dim.dataset.h !== hole) { dim.dataset.h = hole; dim.style.clipPath = hole; frames = Math.min(frames, 3); }   // 窗口位置变了（刚排版好 / 屏幕尺寸变）→ 再多画几帧
  }
  return {open, close, dispose: () => close(true), renderPreview, needsFrame, get isOpen() { return !!el; }};
}
