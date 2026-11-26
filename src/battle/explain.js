import {UNITS, UNIT_CAT, CAT_ORDER, TERRAINS} from '../rules/data.js';
import {CAT, MT_NAME} from './unit-info.js';
import {t, lazyTable} from '../i18n/index.js';

// 详细面板里「点一项看说明」的全部文字（0.61；1.05 起接入语言包，词条在 src/i18n 的 blurb.* / tnote.* / tip.*）。纯文字 + 纯函数，不碰 DOM，Node 里可测试。
// 约束：每条说明（标题 + 正文）尽量不超过 70 个字（英文尽量别超过 130 个字符），说明栏固定三行高；数字全部从规则数据 / 当前局面算出来，不手写，改规则时不用回来改文字。
// 返回统一形状 {t: 标题, d: 正文}。

export const UNIT_BLURB = lazyTable('blurb.', ['inf', 'mech', 'recon', 'apc', 'tank', 'mdtank', 'neotank', 'arty', 'rocket', 'aa', 'missile']);
const TERRAIN_NOTE = lazyTable('tnote.', ['plain', 'forest', 'mountain', 'river', 'sea', 'shoal', 'road', 'bridge', 'hq', 'city_large', 'city_small', 'factory', 'airport', 'port', 'cliff', 'desert', 'swamp']);
export const terrainNote = id => TERRAIN_NOTE[id] || '';

const namesOf = pred => Object.values(UNITS).filter(pred).map(u => u.name).join(t('sep.list'));

// 单位盒：key = hp / status / move / vision / range / mt / fuel / ammo / primary / secondary / cat:<大类>
// ctx = {type, eu（战场上的这个单位）, cfg（game.config）}
export function unitTip(key, {type, eu, cfg}) {
  const u = UNITS[type];
  if (key.startsWith('cat:')) { const c = key.slice(4), l = namesOf(x => UNIT_CAT[Object.keys(UNITS).find(k => UNITS[k] === x)] === c); return {t: t('tip.cat.title', {name: CAT[c][0]}), d: l ? t('tip.cat.body', {list: l}) : t('tip.cat.none')}; }
  switch (key) {
    case 'hp': return {t: t('card.hp'), d: (eu ? t('tip.hp.now', {hp: eu.hp, n: Math.ceil(eu.hp / 10)}) : t('tip.hp.range')) + (t('tip.hp.tail').startsWith('格') ? '' : ' ') + t('tip.hp.tail')};
    case 'status': return {t: t(eu && eu.acted ? 'chip.acted' : 'chip.ready'), d: t('tip.status.body')};
    case 'move': return {t: t('kv.move'), d: t('tip.move.body', {n: u.move})};
    case 'vision': return {t: t('kv.vision'), d: t('tip.vision.body', {n: u.vision})};
    case 'range': return u.indirect
      ? {t: t('tip.range.ind.title', {r: u.range.join('–')}), d: t('tip.range.ind.body')}
      : {t: t('tip.range.dir.title'), d: t('tip.range.dir.body')};
    case 'mt': return {t: t('tip.mt.title', {name: MT_NAME[u.mt]}), d: t('tip.mt.body')};
    case 'fuel': return u.fuel === Infinity ? {t: t('card.fuel'), d: t('tip.fuel.inf')}
      : {t: t('card.fuel'), d: t(cfg && cfg.fuel ? 'tip.fuel.on' : 'tip.fuel.off')};
    case 'ammo': return !u.ammo ? {t: t('card.ammo'), d: t('tip.ammo.none')}
      : {t: t('card.ammo'), d: t(cfg && cfg.ammo ? 'tip.ammo.on' : 'tip.ammo.off')};
    case 'primary': return u.primary ? {t: t('wp.primary'), d: t('tip.primary.has')} : {t: t('wp.primary'), d: t('tip.primary.none')};
    case 'secondary': return u.secondary ? {t: t('tip.secondary.title'), d: t('tip.secondary.has')} : {t: t('wp.secondary'), d: t('tip.secondary.none')};
  }
  return null;
}

// 地形盒：key = stars / cost:<foot|mech|tread|wheel> / income / capture / owner / hazard
// ctx = {tid, owner, eu, cfg}
export function terrainTip(key, {tid, owner, cfg}) {
  const T = TERRAINS[tid];
  if (key.startsWith('cost:')) {
    const m = key.slice(5), c = T.cost[m], who = namesOf(u => u.mt === m);
    return {t: t('tip.cost.title', {mt: MT_NAME[m], who}), d: c === null ? t('tip.cost.no', {terrain: T.name}) : t('tip.cost.yes', {terrain: T.name, c})};
  }
  switch (key) {
    case 'stars': return {t: t('tip.stars.title', {n: T.stars}), d: t(T.stars ? 'tip.stars.has' : 'tip.stars.none')};
    case 'income': return {t: t('kv.income'), d: t('tip.income.body', {n: T.income})};
    case 'capture': return {t: t('tip.capture.title'), d: t('tip.capture.body', {n: T.capture})};
    case 'owner': return {t: t('card.owner'), d: t(owner === undefined ? 'tip.owner.neutral' : 'tip.owner.owned')};
    case 'hazard': return {t: t('tip.hazard.title'), d: t('tip.hazard.body', {n: (cfg.swampDamage || 0) / 10, kill: cfg.swampKills ? t('tip.hazard.kill') : ''})};
  }
  return null;
}

// 说明栏平时显示的默认文字
export const unitDefault = (type) => ({t: UNITS[type].name, d: UNIT_BLURB[type] || ''});
export function terrainDefault(tid, eu) {
  const T = TERRAINS[tid];
  if (!eu) return {t: t('tip.def.title'), d: t(T.stars ? 'tip.def.has' : 'tip.def.none')};
  const hp = Math.ceil(eu.hp / 10);
  return {t: t('tip.onTile.title', {name: UNITS[eu.type].name}), d: T.stars ? t('tip.onTile.has', {hp, pct: T.stars * hp}) : t('tip.onTile.none')};
}
export {CAT_ORDER};
