// 存档（0.99）：战场状态 ↔ 纯 JSON。只存「会变的」（单位、归属、资金、回合、统计…），地形不存——由种子重新生成，
// 用地形签名（terrainSig）校验：生成器改过、地图变了就拒绝恢复（由调用方提示 + 开新局）。纯数据、不碰 three / DOM，Node 里可测。
export const SAVE_VERSION = 1;

// 地形指纹：FNV-1a 哈希 + 宽高。同一种子在同一版生成器下必然相同
export function terrainSig(g) {
  let h = 2166136261; const s = g.terrain.map(r => r.join(',')).join(';');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + ':' + g.w + 'x' + g.h;
}

export function serializeGame(g) {
  return {
    v: SAVE_VERSION, sig: terrainSig(g), turn: g.turn, day: g.day, winner: g.winner, winReason: g.winReason, winCell: g.winCell, nextId: g.nextId,
    units: g.units.map(u => ({...u})), owners: {...g.owners}, funds: [...g.funds], built: [...g.built], everHad: g.players.map((_, i) => !!g.everHad[i]),
    stats: g.stats.map(s => ({...s})), config: {...g.config}, players: g.players.map(p => ({...p})),
  };
}

// 把存档写回一个刚用同一种子建好的 game（原地改，外面拿着的 game 引用不用换）。校验不过返回 false 且不动 game
export function restoreGame(g, d) {
  if (!d || d.v !== SAVE_VERSION || d.sig !== terrainSig(g) || !Array.isArray(d.units) || !Array.isArray(d.funds)) return false;
  g.units = d.units.map(u => ({...u})); g.owners = {...d.owners}; g.funds = [...d.funds]; g.built = new Set(d.built); g.everHad = [...d.everHad];
  g.turn = d.turn; g.day = d.day; g.winner = d.winner; g.winReason = d.winReason; g.winCell = d.winCell; g.nextId = d.nextId;
  g.stats = d.stats.map(s => ({...s})); g.config = {...d.config}; g.players = d.players.map(p => ({...p}));
  return true;
}
