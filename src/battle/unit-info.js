import {UNITS, DMG_PRIMARY, DMG_SECONDARY, TARGET_ORDER, UNIT_CAT, CAT_ORDER, WEAPON_LIST_MIN} from '../rules/data.js';

// 单位信息的共用小零件（0.60 从 arsenal.js 抽出来）：兵工厂右栏和战场「长按详细面板」用同一套，改一处两边一致。
// 只出 HTML 字符串 + 文字表，不碰 DOM / three。样式是 battle.css 里的 .ars-wp 系列（需要外层提供 --line / --card / --sub / --text / --btn 变量）。
export const GLYPH = {inf: '兵', mech: '反', recon: '侦', apc: '运', tank: '轻', mdtank: '中', neotank: '重', arty: '炮', rocket: '箭', aa: '空', missile: '导'};
export const CAT = {foot: ['步兵', '#efd5b0'], veh: ['车辆', '#efd5b0'], heli: ['直升机', '#d9d3f5'], air: ['飞机', '#d9d3f5'], ship: ['船', '#bfeee6'], sub: ['潜艇', '#bfeee6']};   // 大类名 + 底色（沿用高战2：陆米色 / 空淡紫 / 海青绿）
export const WPN = {mech: '火箭筒', tank: '轻型火炮', mdtank: '中型火炮', neotank: '重型火炮', arty: '榴弹炮', rocket: '火箭炮', aa: '机关炮', missile: '防空导弹'};   // 主炮名（我自己起的，随便改）；副炮统一叫机枪
export const MT_NAME = {foot: '步兵', mech: '反坦克兵', tread: '履带', wheel: '轮式'};   // 移动类型的叫法（地形移动消耗表的列头）

// 某武器「能打哪些大类」：某大类里只要有一个目标的基础伤害 ≥ WEAPON_LIST_MIN 就算能打
const cats = tbl => CAT_ORDER.filter(c => TARGET_ORDER.some(t => UNIT_CAT[t] === c && (tbl[t] || 0) >= WEAPON_LIST_MIN));
const wp = (label, name, note, tbl) => {
  if (!tbl) return `<div class="ars-wp off"><div class="ars-wh"><b>${name}</b></div><div class="ars-wr"><span class="ars-wn">无</span><span class="ars-wt">${label}</span></div></div>`;
  const cs = cats(tbl);
  return `<div class="ars-wp"><div class="ars-wh"><b>${name}</b><i>${note}</i></div><div class="ars-wr"><div class="ars-wc">${cs.length ? cs.map(c => `<span class="ars-cat" style="--cc:${CAT[c][1]}">${CAT[c][0]}</span>`).join('') : '<span class="ars-wn">暂无目标</span>'}</div><span class="ars-wt">${label}</span></div></div>`;
};
// 主炮块 + 副炮块的 HTML。ammoNow：给了就显示「当前 / 满值」（战场上的单位），不给显示满值（兵工厂里的新兵种）。
export function weaponHtml(id, ammoNow) {
  const u = UNITS[id], rg = u.range[0] === u.range[1] ? '' : '射程' + u.range.join('–') + ' · ';
  const am = (ammoNow === undefined ? u.ammo : ammoNow) + '/' + u.ammo;
  return wp('主炮', u.primary ? WPN[id] || '主炮' : '无主炮', u.primary ? rg + am : '', u.primary ? DMG_PRIMARY[id] || {} : null)
    + wp('副炮', u.secondary ? '机枪' : '无副炮', u.secondary && !u.primary ? rg.replace(/ · $/, '') : '', u.secondary ? DMG_SECONDARY[id] || {} : null);
}
