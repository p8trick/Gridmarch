// 战斗计算：纯函数，不碰游戏状态。
import {UNITS, TERRAINS, STYLES, DEFAULT_STYLE, DMG_PRIMARY, DMG_SECONDARY, CONFIG} from './data.js';

export const dispHp = hp => Math.ceil(hp / 10);   // 内部血量 0–100，显示 1–10 格

// 高战2 伤害公式（无指挥官）：
//   伤害% = 基础伤害 × 攻方系数 × (攻方显示血量 / 10) × (200 − (守方系数×100 + 地形星 × 守方显示血量)) / 100，向下取整
// atkMul / defMul 来自军队风格（均衡型 = 1）。
export function calcDamage({base, attackerHp, defenderHp, stars, atkMul = 1, defMul = 1}) {
  const d = base * atkMul * (dispHp(attackerHp) / 10) * ((200 - (defMul * 100 + stars * dispHp(defenderHp))) / 100);
  return Math.floor(d + 1e-9);
}

// 选武器：能用的武器里取基础伤害高的；一样高就用副武器（不耗弹）。返回 {base, weapon:'primary'|'secondary'} 或 null
export function pickWeapon(attacker, defenderType, config = CONFIG) {
  const ut = UNITS[attacker.type];
  const p = ut.primary && (!config.ammo || attacker.ammo > 0) ? (DMG_PRIMARY[attacker.type] || {})[defenderType] : null;
  const s = ut.secondary ? (DMG_SECONDARY[attacker.type] || {})[defenderType] : null;
  const hasP = p !== null && p !== undefined, hasS = s !== null && s !== undefined;
  if (hasP && (!hasS || p > s)) return {base: p, weapon: 'primary'};
  if (hasS) return {base: s, weapon: 'secondary'};
  return null;
}

export const styleOf = (game, owner) => STYLES[(game.players[owner] || {}).style] || STYLES[DEFAULT_STYLE];

// 一次出手：返回 {weapon, damage}（damage 为内部血量点数；打不了返回 null）
export function strike(game, attacker, defender) {
  const w = pickWeapon(attacker, defender.type, game.config);
  if (!w) return null;
  const stars = TERRAINS[game.terrain[defender.y][defender.x]].stars;
  const damage = calcDamage({base: w.base, attackerHp: attacker.hp, defenderHp: defender.hp, stars,
    atkMul: styleOf(game, attacker.owner).atk, defMul: styleOf(game, defender.owner).def});
  return {weapon: w.weapon, damage};
}
