import {t, lazyTable} from '../i18n/index.js';
import {UNITS, DMG_PRIMARY, DMG_SECONDARY, TARGET_ORDER, UNIT_CAT, CAT_ORDER, WEAPON_LIST_MIN} from '../rules/data.js';

// 单位信息的共用小零件（0.60 从 arsenal.js 抽出来）：兵工厂右栏和战场「长按详细面板」用同一套，改一处两边一致。
// 只出 HTML 字符串 + 文字表，不碰 DOM / three。样式是 battle.css 里的 .ars-wp 系列（需要外层提供 --line / --card / --sub / --text / --btn 变量）。
// 单位图标字：随语言（中文一个字，英文两个字母），词条 glyph.*；GLYPH[id] 每次读取都按当前语言取
export const GLYPH = {};
for (const id of ['inf', 'mech', 'recon', 'apc', 'tank', 'mdtank', 'neotank', 'arty', 'rocket', 'aa', 'missile']) Object.defineProperty(GLYPH, id, {get: () => t('glyph.' + id), enumerable: true});
// 大类（名字随语言，颜色不变）：CAT[c][0] 名字、CAT[c][1] 颜色
export const CAT = {}; for (const [id, col] of [['foot', '#efd5b0'], ['veh', '#efd5b0'], ['heli', '#d9d3f5'], ['air', '#d9d3f5'], ['ship', '#bfeee6'], ['sub', '#bfeee6']]) { const a = [null, col]; Object.defineProperty(a, 0, {get: () => t('cat.' + id)}); CAT[id] = a; }
export const WPN = lazyTable('wpn.', ['mech', 'tank', 'mdtank', 'neotank', 'arty', 'rocket', 'aa', 'missile']);
export const MT_NAME = lazyTable('mt.', ['foot', 'mech', 'tread', 'wheel']);   // 移动类型的叫法（地形移动消耗表的列头）

// 某武器「能打哪些大类」：某大类里只要有一个目标的基础伤害 ≥ WEAPON_LIST_MIN 就算能打
const cats = tbl => CAT_ORDER.filter(c => TARGET_ORDER.some(t => UNIT_CAT[t] === c && (tbl[t] || 0) >= WEAPON_LIST_MIN));
const wp = (k, name, note, tbl) => {
  const label = t('wp.' + k + 'Tag');   // 竖排的小标签用两字短名（英文 Main / Sub，英文下改横排，见 battle.css）   // 0.61：data-k 给战场详细面板「点一项看说明」用，兵工厂里没有任何效果
  if (!tbl) return `<div class="ars-wp off" data-k="${k}"><div class="ars-wh"><b>${name}</b></div><div class="ars-wr"><span class="ars-wn">${t('wp.none')}</span><span class="ars-wt">${label}</span></div></div>`;
  const cs = cats(tbl);
  return `<div class="ars-wp" data-k="${k}"><div class="ars-wh"><b>${name}</b><i>${note}</i></div><div class="ars-wr"><div class="ars-wc">${cs.length ? cs.map(c => `<span class="ars-cat" data-k="cat:${c}" style="--cc:${CAT[c][1]}">${CAT[c][0]}</span>`).join('') : `<span class="ars-wn">${t('wp.noTarget')}</span>`}</div><span class="ars-wt">${label}</span></div></div>`;
};
// 主炮块 + 副炮块的 HTML。ammoNow：给了就显示「当前 / 满值」（战场上的单位），不给显示满值（兵工厂里的新兵种）。
export function weaponHtml(id, ammoNow) {
  const u = UNITS[id], rg = u.range[0] === u.range[1] ? '' : t('wp.rangeDot', {r: u.range.join('–')});
  const am = (ammoNow === undefined ? u.ammo : ammoNow) + '/' + u.ammo;
  return wp('primary', u.primary ? WPN[id] || t('wp.primary') : t('wp.noPrimary'), u.primary ? rg + am : '', u.primary ? DMG_PRIMARY[id] || {} : null)
    + wp('secondary', u.secondary ? t('wp.mg') : t('wp.noSecondary'), u.secondary && !u.primary ? rg.replace(/ · $/, '') : '', u.secondary ? DMG_SECONDARY[id] || {} : null);
}
