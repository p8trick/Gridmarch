import {Stage} from '../battle/stage.js';
import {UNITS, UNIT_IDS} from '../rules/data.js';

// 兵工厂界面样机：同一结构 × 三套主题（A 战术终端 / B 玩具盒 / C 折中）× 蓝 / 红军色，用来在真机上挑界面风格。
// 单位数据直接取自规则引擎（价格、移动、射程、弹药）；右侧转台是占位——模型接入后在这里用战场同一个渲染器画。
const FUNDS = 2500;                                   // 样机资金：总部 1500 + 兵工厂 1000
const NO_MODEL = new Set(['aa', 'missile']);          // 还没建模的单位 → 显示"尚未建模"
const GLYPH = {inf: '兵', mech: '机', recon: '侦', apc: '运', tank: '轻', mdtank: '中', neotank: '重', arty: '炮', rocket: '箭', aa: '空', missile: '导'};
const THEMES = [['t-term', 'A 终端'], ['t-toy', 'B 玩具盒'], ['t-mix', 'C 折中']];

const ui = document.getElementById('ui');
const stage = new Stage(document.getElementById('stage'));
let theme = 't-toy', army = 'army-b', sel = 'tank', ry = 25, drag = null, raf = 0;

function render() {
  ui.className = theme + ' ' + army;
  ui.innerHTML = `
  <div class="top"><div class="sw">${THEMES.map(([c, n]) => `<button data-th="${c}" class="${c === theme ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="sw"><button data-army="army-b" class="${army === 'army-b' ? 'on' : ''}">蓝军</button><button data-army="army-r" class="${army === 'army-r' ? 'on' : ''}">红军</button></div>
    <div class="fund">资金 ${FUNDS}</div></div>
  <div class="panel">
    <div class="list"><div class="hd">兵工厂 <small>点选兵种</small></div><div class="cards">
      ${UNIT_IDS.map(id => { const u = UNITS[id], lock = u.buildable === false, poor = !lock && u.cost > FUNDS;
        return `<button class="card ${id === sel ? 'sel' : ''} ${poor ? 'poor' : ''} ${lock ? 'lock' : ''}" data-u="${id}"><span class="ico">${GLYPH[id]}</span><span><span class="nm">${u.name}</span><br><span class="pr">${lock ? '暂不可生产' : u.cost}</span></span></button>`; }).join('')}
    </div></div>
    <div class="view" id="view"></div>
  </div>
  <div class="toast" id="toast"></div>`;
  renderView();
}

function renderView() {
  const u = UNITS[sel], lock = u.buildable === false, poor = u.cost > FUNDS;
  document.getElementById('view').innerHTML = `
    <div class="hd">${u.name}<small>${NO_MODEL.has(sel) ? '尚未建模' : '拖动旋转'}</small></div>
    <div class="tt" id="tt"><div class="ring"></div>
      ${NO_MODEL.has(sel) ? '<div class="nomodel">尚未建模<br><small>模型接入后在这里 360° 展示</small></div>'
        : '<div class="box" id="box"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="hint">占位方块 · 模型接入后替换</div>'}</div>
    <div class="stats"><div><b>${u.move}</b>移动</div><div><b>${u.range[0] === u.range[1] ? u.range[0] : u.range.join('–')}</b>射程</div><div><b>${u.ammo || '—'}</b>弹药</div><div><b>${u.vision}</b>视野</div></div>
    <button class="buy" id="buy" ${lock || poor ? 'disabled' : ''}>${lock ? '暂不可生产' : poor ? '资金不足 · ' + u.cost : '生产 · ' + u.cost}</button>`;
  const tt = document.getElementById('tt');
  tt.onpointerdown = e => { drag = {x: e.clientX, ry}; tt.setPointerCapture(e.pointerId); };
  tt.onpointermove = e => { if (drag) { const d = stage.vec(e.clientX - drag.x, 0).x; ry = drag.ry + d * 0.8; spin(); } };
  tt.onpointerup = tt.onpointercancel = () => { drag = null; };
  document.getElementById('buy').onclick = () => toast('已生产 ' + u.name + '（样机演示，不扣钱）');
}
const spin = () => { const b = document.getElementById('box'); if (b) b.style.transform = `rotateX(-18deg) rotateY(${ry}deg)`; };
const toast = m => { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1400); };

ui.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.th) { theme = b.dataset.th; render(); }
  else if (b.dataset.army) { army = b.dataset.army; render(); }
  else if (b.dataset.u) { sel = b.dataset.u; ry = 25; ui.querySelectorAll('.card').forEach(c => c.classList.toggle('sel', c.dataset.u === sel)); renderView(); }
});
(function loop() { if (!drag) ry += 0.6; spin(); raf = requestAnimationFrame(loop); })();   // 没在拖的时候自动慢转
render();
