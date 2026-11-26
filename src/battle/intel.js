import {summaryOf, incomeOf} from '../rules/engine.js';
import {TERRAINS} from '../rules/data.js';

// 战场情报（0.93）：长按右上角「找未行动单位」键（约 0.45 秒）打开；单个大玩具盒，风格同胜利结算的对照表（样式 .res-* 复用，外壳是 .res.int）。
// 蓝红对照：现存单位 / 已生产 / 损失 / 据点（带各类据点数）/ 每回合收入 / 军费（现有资金）；底部一条「中立据点」（总数 + 各类）。
// 数据来自规则引擎（engine.summaryOf + incomeOf）。打开时取一次快照，面板打开期间战场不会变。点盒子外面的暗处关闭（长按时手指还没抬起，抬起的那次点按不算）。
import {OWN} from '../i18n/index.js';
const ORDER = ['hq', 'city_large', 'city_small', 'factory', 'airport', 'port'];
const SHORT = {hq: '总部', city_large: '大城', city_small: '小城', factory: '兵工厂', airport: '机场', port: '船坞'};
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const chips = map => ORDER.filter(id => map[id]).map(id => `${SHORT[id] || TERRAINS[id].name} ${map[id]}`).join('　');

export function createIntel({host, game, onOpen, onClose}) {
  let el = null, openedAt = 0, sawDown = false;
  const ROWS = [['units', '现存单位', 'hi'], ['built', '已生产', null], ['lost', '损失', 'lo'], ['props', '据点', 'hi', true], ['inc', '每回合收入', 'hi'], ['funds', '军费', 'hi']];
  function build() {
    const s = summaryOf(game); s.sides.forEach((x, i) => { x.inc = incomeOf(game, i); });
    const t = game.turn, cls = t === 1 ? 'army-r' : 'army-b';
    const side = i => `<span class="res-side ${i ? 'r' : 'b'}${t === i ? ' win' : ''}"><i class="dot ${i ? 'r' : 'b'}"></i>${OWN[i]}${t === i ? '<em>行动中</em>' : ''}</span>`;
    const rows = ROWS.map(([k, name, better, tall]) => {
      const a = s.sides[0][k], b = s.sides[1][k], mx = Math.max(a, b, 1), cell = (v, o, i) => {
        const lead = better && v !== o && (better === 'hi' ? v > o : v < o), sub = tall ? chips(s.sides[i].byType) : '';
        return `<div class="res-c ${i ? 'r' : 'b'}${lead ? ' lead' : ''}"><i style="width:${Math.round(v / mx * 100)}%"></i><div class="int-cc"><b>${fmt(v)}</b>${sub ? `<span class="int-sub">${sub}</span>` : ''}</div></div>`;
      };
      return `<div class="res-r${tall ? ' tall' : ''}">${cell(a, b, 0)}<span class="res-l">${name}</span>${cell(b, a, 1)}</div>`;
    }).join('');
    const neu = s.neutral ? `<b>中立据点 ${s.neutral}</b><span>${chips(s.neutralByType)}</span>` : '<b>中立据点 0</b><span>已经全部有主</span>';
    el = document.createElement('div'); el.className = 'res int ' + cls;
    el.innerHTML = `<div class="res-dim"></div><div class="res-row"><div class="res-box res-tbl">
      <div class="int-top"><b>战场情报</b><span>第 ${game.day} 天 · ${OWN[t]}行动</span></div>
      <div class="res-th">${side(0)}<span class="res-ttl"></span>${side(1)}</div>
      <div class="res-rows">${rows}</div>
      <div class="int-neu">${neu}</div>
    </div></div><div class="det-hint">点空白处关闭</div>`;
    el.addEventListener('pointerdown', () => { sawDown = true; });
    el.addEventListener('click', e => { const ok = sawDown && performance.now() - openedAt > 250; sawDown = false; if (e.target.closest('.res-box')) return; if (ok) close(); });
  }
  function open() {
    if (el) close(true); build(); host.appendChild(el); host.classList.add('int-open'); openedAt = performance.now(); sawDown = false; el.classList.add('in');
    if (onOpen) onOpen();
  }
  function close(silent) { if (!el) return; el.remove(); el = null; host.classList.remove('int-open'); if (!silent && onClose) onClose(); }
  return {open, close, dispose: () => close(true), get isOpen() { return !!el; }};
}
