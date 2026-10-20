// data.js — 纯数据:兵种、地形、伤害表、规则开关、地图。加内容只改这里。
export const VERSION = '0.1.0';
export const PLAYERS = [{ name: '蓝', col: '#3b6fd8' }, { name: '红', col: '#d84a4a' }];
export const CONFIG = { startFunds: [300, 300], capPts: 20, joinRefund: 0.9 }; // joinRefund:合并溢出血量按造价折算的返还比例
export const CAPT = 'cCFAH'; // 可占领:小城 大城 工厂 机场 总部
// 建筑:inc 每回合收入,rep 回合开始修复的血量(内部点数,10点=1格)。数值为占位。
export const PROP = {
  c: { inc: 60, rep: 10 }, C: { inc: 150, rep: 30 },
  F: { inc: 100, rep: 20 }, A: { inc: 100, rep: 20 }, H: { inc: 100, rep: 20 },
};

// 护甲类:0步兵 1轻甲 2中甲 3重甲 4直升机 5固定翼
// mt 移动方式:0步行 1轮式 2履带;r 射程[最小,最大];ind 间接火力(移动后不能开火)
// 造价为占位值,以后用公式+自我对战调
export const UNITS = {
  inf: { n: '步兵', cls: 0, mv: 3, mt: 0, r: [1, 1], cost: 100, cap: 1, foot: 1 },
  at:  { n: '反坦', cls: 0, mv: 2, mt: 0, r: [1, 1], cost: 250, cap: 1, foot: 1 },
  rec: { n: '侦察', cls: 1, mv: 7, mt: 1, r: [1, 1], cost: 350 },
  lt:  { n: '轻坦', cls: 2, mv: 6, mt: 2, r: [1, 1], cost: 600 },
  mt:  { n: '中坦', cls: 2, mv: 5, mt: 2, r: [1, 1], cost: 1000 },
  ht:  { n: '重坦', cls: 3, mv: 4, mt: 2, r: [1, 1], cost: 1500 },
  art: { n: '炮兵', cls: 1, mv: 5, mt: 2, r: [2, 3], cost: 550, ind: 1 },
  rkt: { n: '火箭', cls: 1, mv: 5, mt: 1, r: [3, 5], cost: 900, ind: 1 },
  aa:  { n: '防空', cls: 1, mv: 6, mt: 2, r: [1, 1], cost: 600 },
  msl: { n: '导弹', cls: 1, mv: 5, mt: 1, r: [3, 5], cost: 800, ind: 1 },
  apc: { n: '运输', cls: 1, mv: 6, mt: 2, r: [0, 0], cost: 400, carry: 1 },
};

// 基础伤害:占满血条的百分比,对 [步兵 轻甲 中甲 重甲 直升机 固定翼]
export const DMG = {
  inf: [55, 8, 4, 2, 8, 0],     at:  [25, 55, 55, 35, 0, 0],
  rec: [70, 25, 8, 4, 12, 0],   lt:  [75, 45, 25, 8, 20, 0],
  mt:  [90, 70, 55, 30, 25, 0], ht:  [105, 90, 75, 50, 30, 0],
  art: [90, 65, 55, 40, 0, 0],  rkt: [95, 80, 70, 55, 0, 0],
  aa:  [70, 25, 10, 5, 95, 85], msl: [30, 15, 8, 4, 100, 95],
};

// c 移动消耗 [步行,轮式,履带],null 不可通行;d 防御%
export const TERRAIN = {
  '.': { n: '平原', c: [1, 2, 1], d: 0, col: '#9bc86a' },
  '=': { n: '道路', c: [1, 1, 1], d: 0, col: '#bdb6a4' },
  'b': { n: '桥', c: [1, 1, 1], d: 0, col: '#8a6a45' },
  'f': { n: '树林', c: [1, 3, 2], d: 20, col: '#7fb35a' },
  '^': { n: '山地', c: [2, null, null], d: 40, col: '#8b8f98' },
  '~': { n: '河流', c: [2, null, null], d: 0, col: '#5aa9e6' },
  's': { n: '海洋', c: [null, null, null], d: 0, col: '#3b7dc4' },
  ',': { n: '浅滩', c: [1, 2, 1], d: 0, col: '#e3d9a8' },
  'c': { n: '小城', c: [1, 1, 1], d: 20, col: '#9bc86a' },
  'C': { n: '大城', c: [1, 1, 1], d: 30, col: '#9bc86a' },
  'F': { n: '工厂', c: [1, 1, 1], d: 30, col: '#9bc86a' },
  'A': { n: '机场', c: [1, 1, 1], d: 30, col: '#9bc86a' },
  'H': { n: '总部', c: [1, 1, 1], d: 40, col: '#9bc86a' },
  'd': { n: '沙漠', c: [2, 3, 2], d: 0, col: '#e0c27a' },
  'w': { n: '沼泽', c: [2, 4, 3], d: 0, col: '#6f8a54' }, // 回合结束停留 -1 血
};

// 8×12,180°旋转对称。上半(行0-3)归红,下半(行8-11)归蓝,中间中立。
export const MAP = {
  rows: [
    'f.cHF.^.', '..=..=..', 'w.=^.=f.', 'd.=.f=.c', '.f=C.=w.', '~~b~~b~~',
    '~~b~~b~~', '.w=.C=f.', 'c.=f.=.d', '.f=.^=.w', '..=..=..', '.^.FHc.f',
  ],
  units: [
    { t: 'inf', o: 0, x: 2, y: 10 }, { t: 'inf', o: 0, x: 5, y: 10 }, { t: 'lt', o: 0, x: 3, y: 9 },
    { t: 'inf', o: 1, x: 5, y: 1 }, { t: 'inf', o: 1, x: 2, y: 1 }, { t: 'lt', o: 1, x: 4, y: 2 },
  ],
};
