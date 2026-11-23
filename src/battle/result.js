import {summaryOf} from '../rules/engine.js';

// 胜利结算面板（0.91，方案 A「双盒战报」+ C 的「看战场」收成底部细横幅）：
// 左盒 = 胜利牌（胜方颜色条 + 盖章「胜利」+ 第 N 天 + 怎么赢的 + 三个按钮），右盒 = 蓝红对照表（条形 = 数量对比，更占优的一边数字放大）。
// 「看战场」= 面板收起，底部留一条细横幅（胜方 · 第 N 天 · 击毁 / 损失 / 据点），点一下重新展开。数据来自规则引擎的统计表（engine.summaryOf），战场情报以后共用。
const OWN = ['蓝军', '红军'];
const HOW = {hq: '占领了敌军总部', wipe: '歼灭了敌军全部部队', draw: '双方同时全灭'};
const ROWS = [   // better：'hi' 越大越占优、'lo' 越小越占优、null 只比条形不加粗
  ['built', '已生产', null], ['lost', '损失', 'lo'], ['killed', '击毁', 'hi'], ['props', '据点', 'hi'], ['income', '累计收入', 'hi'], ['spent', '累计军费', null],
];
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function createResult({host, game, onAgain, onHome, onShown}) {
  let el = null, tag = null;
  const build = () => {
    const s = summaryOf(game), w = s.winner, draw = w < 0, cls = draw ? 'army-n' : w === 1 ? 'army-r' : 'army-b';
    el = document.createElement('div'); el.className = 'res ' + cls;
    const col = side => `<span class="res-side ${side ? 'r' : 'b'}${w === side ? ' win' : ''}"><i class="dot ${side ? 'r' : 'b'}"></i>${OWN[side]}${w === side ? '<em>胜</em>' : ''}</span>`;
    const rows = ROWS.map(([k, name, better]) => {
      const a = s.sides[0][k], b = s.sides[1][k], mx = Math.max(a, b, 1), cell = (v, o, side) => {
        const lead = better && v !== o && (better === 'hi' ? v > o : v < o);
        return `<div class="res-c ${side ? 'r' : 'b'}${lead ? ' lead' : ''}"><i style="width:${Math.round(v / mx * 100)}%"></i><b>${fmt(v)}</b></div>`;
      };
      return `<div class="res-r">${cell(a, b, 0)}<span class="res-l">${name}</span>${cell(b, a, 1)}</div>`;
    }).join('');
    el.innerHTML = `<div class="res-dim"></div><div class="res-row">
      <div class="res-box res-win">
        <div class="res-ribbon">${draw ? '平局' : '胜利'}</div>
        <div class="res-team">${draw ? '双方全灭' : `<i class="dot ${w ? 'r' : 'b'}"></i>${OWN[w]}`}</div>
        <div class="res-day">第 ${s.day} 天</div>
        <div class="res-how">${HOW[s.reason] || ''}</div>
        <div class="res-btns"><button class="res-btn main" data-act="again">再来一局</button><button class="res-btn" data-act="home">回主页</button><button class="res-btn" data-act="view">看战场</button></div>
      </div>
      <div class="res-box res-tbl"><div class="res-th">${col(0)}<span class="res-ttl">战报</span>${col(1)}</div><div class="res-rows">${rows}</div></div>
    </div>`;
    tag = document.createElement('button'); tag.className = 'res-tag ' + cls; tag.hidden = true;
    const k = s.sides, me = draw ? null : k[w];
    tag.innerHTML = draw ? '<b>平局</b><span>第 ' + s.day + ' 天</span><em>▴</em>' : `<i class="dot ${w ? 'r' : 'b'}"></i><b>${OWN[w]} 胜利</b><span>第 ${s.day} 天</span><span class="k">击毁 ${me.killed}</span><span class="k">损失 ${me.lost}</span><span class="k">据点 ${me.props}</span><em>▴</em>`;
    host.appendChild(el); host.appendChild(tag);
    el.addEventListener('click', e => {
      const b = e.target.closest('.res-btn'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'again') onAgain(); else if (a === 'home') onHome(); else if (a === 'view') min(true);
    });
    tag.addEventListener('click', () => min(false));
  };
  function min(on) { if (!el) return; el.hidden = on; tag.hidden = !on; host.classList.toggle('res-open', !on); if (!on) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } if (onShown) onShown(on); }
  function open() { if (el) return; build(); el.classList.add('in'); host.classList.add('res-open'); }
  function dispose() { if (el) { el.remove(); tag.remove(); el = tag = null; } host.classList.remove('res-open'); }
  return {open, dispose, get isOpen() { return !!el && !el.hidden; }, get minimized() { return !!el && el.hidden; }, get exists() { return !!el; }};
}
