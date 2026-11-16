import {UNITS, TERRAINS} from '../rules/data.js';
import {dispHp} from '../rules/engine.js';
import {GLYPH, MT_NAME, weaponHtml} from './unit-info.js';

// 长按详细面板（0.60，风格同兵工厂的「B 玩具盒」：奶油底 + 深色粗边 + 军队色细条）。
// 点格子的简要面板（main.js 的 #dp）只给最常看的几项；长按同一格出这一版：
//   格上有单位 → 左边「单位盒」（血量 / 机动 / 视野 / 射程 / 燃料 / 弹药 / 主副炮能打什么）+ 右边「地形盒」（防御星 / 各移动类型消耗 / 收入…）；
//   没有单位 → 只有「地形盒」，居中。
// 数据全部来自规则引擎（data.js + game 状态），不另存；打开时取一次快照（面板打开期间战场不会变）。点任意位置关闭。
const OWN = ['蓝军', '红军'];
const MTS = ['foot', 'mech', 'tread', 'wheel'];
const NOTE = {   // 地形的一句话说明（只写性质，具体数字由下面的表和行自动生成，改规则数据时不用回来改文字）
  plain: '开阔的平地，没有遮蔽。',
  forest: '树木提供遮蔽，重型车辆穿行更费力。',
  mountain: '高耸的山地，防御最高，只有步兵类能翻越。',
  river: '河水拦路，大部分车辆过不去，要走桥。',
  sea: '深水，陆军无法进入。',
  shoal: '海边的浅滩，陆军可以正常通行，但没有任何防御。',
  road: '平整的公路，各类陆军畅通无阻。',
  bridge: '架在水面上的桥，各类陆军畅通无阻。',
  hq: '总部，最坚固的据点，每回合带来收入。',
  city_large: '大城市，每回合带来收入。',
  city_small: '小城市，每回合带来收入。',
  factory: '兵工厂，占有者可在这里生产陆军单位，每座每回合最多一个。',
  airport: '机场（目前还没有空军）。',
  port: '船坞（目前还没有海军）。',
  cliff: '陡峭的断崖海岸，陆军无法站上去。',
  desert: '沙漠，拖慢行军，没有任何遮蔽。',
  swamp: '沼泽，拖慢行军，而且会消耗站在里面的陆军的血量。',
};

export function createDetail({host, game, toEngine}) {
  let el = null, openedAt = 0, sawDown = false;

  const stars = n => '<span class="dt-st on">★</span>'.repeat(n) + '<span class="dt-st">★</span>'.repeat(Math.max(0, 4 - n));
  const row = (k, v) => `<div class="dt-kv"><span>${k}</span><b>${v}</b></div>`;

  function unitBox(eu) {
    const d = UNITS[eu.type], hp = dispHp(eu.hp), col = hp >= 7 ? '#4fc34f' : hp >= 4 ? '#f2b81e' : '#ee5a4d';
    const rg = d.range[0] === d.range[1] ? d.range[0] : d.range.join('–');
    const tags = [d.indirect ? '间接火力：不能打相邻目标，移动后不能开火，不会被反击' : '', d.capture ? '可占领建筑' : ''].filter(Boolean);
    return `<div class="dt-box ${eu.owner === 0 ? 'army-b' : 'army-r'}">
      <div class="dt-head"><span class="dt-ico">${GLYPH[eu.type]}</span><b class="dt-name">${d.name}</b><span class="dt-chips"><em class="dt-chip ${eu.acted ? '' : 'go'}">${eu.acted ? '已行动' : '可行动'}</em><em class="dt-chip army">${OWN[eu.owner]}</em></span></div>
      <div class="dt-hp"><span>血量</span><span class="dt-bar"><i style="width:${hp * 10}%;background:${col}"></i></span><b>${hp}/10</b></div>
      <div class="dt-grid">${row('机动', d.move)}${row('视野', d.vision)}${row('射程', rg)}${row('移动', MT_NAME[d.mt])}${row('燃料', d.fuel === Infinity ? '∞' : eu.fuel + '/' + d.fuel)}${row('弹药', d.ammo ? eu.ammo + '/' + d.ammo : '—')}</div>
      <div class="dt-wps">${weaponHtml(eu.type, d.ammo ? eu.ammo : undefined)}</div>
      ${tags.length ? `<div class="dt-note">${tags.join('　·　')}</div>` : ''}
    </div>`;
  }

  function terrainBox(tid, owner, eu) {
    const T = TERRAINS[tid], cfg = game.config || {};
    const army = T.property && owner !== undefined ? (owner === 0 ? 'army-b' : 'army-r') : '';
    const chip = T.property ? `<em class="dt-chip ${army ? 'army' : ''}">${owner === undefined ? '中立' : OWN[owner]}</em>` : '';
    const mine = eu ? UNITS[eu.type].mt : null;
    const cost = MTS.map(m => { const c = T.cost[m]; return `<div class="dt-c ${m === mine ? 'me' : ''}"><span>${MT_NAME[m]}</span><b class="${c === null ? 'no' : ''}">${c === null ? '✕' : c}</b></div>`; }).join('');
    // 防御星的效果：伤害 ×（1 − 星数 × 守方显示血量 / 100）（combat.js），满血每颗星约少受 10%
    const eff = eu ? (T.stars ? `${UNITS[eu.type].name}（${dispHp(eu.hp)}/10 血）在这里受到的伤害 −${T.stars * dispHp(eu.hp)}%` : `${UNITS[eu.type].name}在这里没有防御加成`) : '每颗星让满血单位少受约 10% 的伤害，血量越少效果越弱';
    const extra = [];
    if (T.property) { extra.push(row('收入', T.income + ' / 回合')); extra.push(row('占领点数', T.capture)); }
    if (T.hazard && cfg.swampDamage) extra.push(`<div class="dt-warn">回合结束时，站在这里的陆军掉 ${cfg.swampDamage / 10} 格血${cfg.swampKills ? '，可致死' : ''}</div>`);
    return `<div class="dt-box ${army}">
      <div class="dt-head"><b class="dt-name">${T.name}</b><span class="dt-chips">${chip}</span></div>
      <div class="dt-note top">${NOTE[tid] || ''}</div>
      <div class="dt-def"><span>防御</span><span class="dt-stars">${T.stars ? stars(T.stars) : '<span class="dt-none">无</span>'}</span></div>
      <div class="dt-eff">${T.stars || eu ? eff : ''}</div>
      <div class="dt-sec">移动消耗</div>
      <div class="dt-cost">${cost}</div>
      ${extra.length ? `<div class="dt-grid one">${extra.join('')}</div>` : ''}
    </div>`;
  }

  function open(cell) {
    if (el) close();
    const [ex, ey] = toEngine(cell), tid = game.terrain[ey] && game.terrain[ey][ex]; if (!tid) return false;
    const eu = game.units.find(u => u.x === ex && u.y === ey) || null;
    el = document.createElement('div'); el.className = 'det';
    el.innerHTML = `<div class="det-dim"></div><div class="det-row">${eu ? unitBox(eu) : ''}${terrainBox(tid, game.owners[ex + ',' + ey], eu)}</div><div class="det-hint">点任意位置关闭</div>`;
    // 关闭只认「在面板上按下 + 抬起」：长按时手指还没抬起，抬起产生的那次 click 不能把刚打开的面板关掉
    el.addEventListener('pointerdown', () => { sawDown = true; });
    el.addEventListener('click', () => { if (sawDown && performance.now() - openedAt > 250) close(); sawDown = false; });
    host.appendChild(el); host.classList.add('det-open'); openedAt = performance.now(); sawDown = false;
    return true;
  }
  function close() { if (!el) return; el.remove(); el = null; host.classList.remove('det-open'); }
  return {open, close, dispose: close, get isOpen() { return !!el; }};
}
