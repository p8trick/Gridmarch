import {UNITS, UNIT_CAT, CAT_ORDER, TERRAINS} from '../rules/data.js';
import {CAT, MT_NAME} from './unit-info.js';

// 详细面板里「点一项看说明」的全部文字（0.61）。纯文字 + 纯函数，不碰 DOM，Node 里可测试；以后做多语言，把这个文件整个换掉就行。
// 约束：每条说明（标题 + 正文）尽量不超过 70 个字，说明栏固定三行高；数字全部从规则数据 / 当前局面算出来，不手写，改规则时不用回来改文字。
// 返回统一形状 {t: 标题, d: 正文}。

export const UNIT_BLURB = {
  inf: '最便宜的单位，山地、河流都能翻越，可以占领建筑。',
  mech: '带火箭筒的步兵：能有效打击坦克，翻山越河同样灵活。',
  recon: '轮式侦察车：机动和视野都很高，火力很弱，适合探路。',
  apc: '没有任何武器，只能靠走位，机动不错。',
  tank: '机动、火力、造价都居中的主力坦克。',
  mdtank: '火力和装甲明显强于轻坦，但更慢、更贵。',
  neotank: '最强的陆上火力和装甲，价格也最高。',
  arty: '隔着 2–3 格开火，对方没法反击；移动后不能开火。',
  rocket: '射程 3–5 的远程间接火力；移动后不能开火。',
  aa: '专为对付空中目标设计（目前战场上还没有空军）。',
  missile: '射程 3–5 的防空间接火力，目前不能生产。',
};

const TERRAIN_NOTE = {
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
export const terrainNote = id => TERRAIN_NOTE[id] || '';

const namesOf = pred => Object.values(UNITS).filter(pred).map(u => u.name).join('、');

// 单位盒：key = hp / status / move / vision / range / mt / fuel / ammo / primary / secondary / cat:<大类>
// ctx = {type, eu（战场上的这个单位）, cfg（game.config）}
export function unitTip(key, {type, eu, cfg}) {
  const u = UNITS[type];
  if (key.startsWith('cat:')) { const c = key.slice(4), l = namesOf(x => UNIT_CAT[Object.keys(UNITS).find(k => UNITS[k] === x)] === c); return {t: CAT[c][0] + '大类', d: l ? '包括：' + l + '。这件武器对这一类有明显威力。' : '目前还没有这类单位。'}; }
  switch (key) {
    case 'hp': return {t: '血量', d: (eu ? `当前 ${eu.hp}/100 点，战力按「向上取整」的 ${Math.ceil(eu.hp / 10)} 格算（战场角标和公式里都用格数）。` : '血量是 0–100 点。') + '格数越少，打出的伤害越低，防御星的减伤和占领速度也越低；每一格 10 点，血条上的刻度就是格线。'};
    case 'status': return {t: eu && eu.acted ? '已行动' : '可行动', d: '每回合每个单位行动一次（攻击或待命）。行动过就显示“已行动”，下回合恢复。'};
    case 'move': return {t: '机动', d: `一回合最多走 ${u.move} 点。每格花几点看地形和移动类型，见右边地形盒的消耗表。`};
    case 'vision': return {t: '视野', d: `能看到 ${u.vision} 格远。目前战场没有战争迷雾，这个数值暂时不影响游戏。`};
    case 'range': return u.indirect
      ? {t: '射程 ' + u.range.join('–') + ' 格', d: '间接火力：打不到相邻的格子，移动后不能开火；对方没法反击它。'}
      : {t: '射程 1 格', d: '只能攻击相邻的格子。被打的直瞄单位只要没被打死，就会反击。'};
    case 'mt': return {t: '移动类型：' + MT_NAME[u.mt], d: '它决定在各种地形上的移动消耗。右边地形盒的表里，高亮的那一列就是它。'};
    case 'fuel': return u.fuel === Infinity ? {t: '燃料', d: '步兵类单位不消耗燃料。'}
      : {t: '燃料', d: cfg && cfg.fuel ? '每走 1 点移动力消耗 1 点燃料，烧光就走不动了。' : '本局规则没有启用燃料消耗，这个数值暂时只是展示。'};
    case 'ammo': return !u.ammo ? {t: '弹药', d: '这个兵种没有主炮，所以不用弹药。'}
      : {t: '弹药', d: cfg && cfg.ammo ? '主炮每开一次火（包括反击）消耗 1 发，打光后只能用副炮；副炮不耗弹药。' : '本局规则没有启用弹药消耗。'};
    case 'primary': return u.primary ? {t: '主炮', d: '威力最大的武器，每次消耗 1 发弹药。出手时自动选基础伤害更高的那门；一样高就用不耗弹的副炮。'} : {t: '主炮', d: '这个兵种没有主炮。'};
    case 'secondary': return u.secondary ? {t: '副炮（机枪）', d: '不消耗弹药。主炮打光弹药，或主炮打不到时使用；下面的标签是它能有效攻击的大类。'} : {t: '副炮', d: '这个兵种没有副炮。'};
  }
  return null;
}

// 地形盒：key = stars / cost:<foot|mech|tread|wheel> / income / capture / owner / hazard
// ctx = {tid, owner, eu, cfg}
export function terrainTip(key, {tid, owner, cfg}) {
  const T = TERRAINS[tid];
  if (key.startsWith('cost:')) {
    const m = key.slice(5), c = T.cost[m], who = namesOf(u => u.mt === m);
    return {t: MT_NAME[m] + '类（' + who + '）', d: c === null ? `在${T.name}上无法进入。` : `进入${T.name}要花 ${c} 点移动力。`};
  }
  switch (key) {
    case 'stars': return {t: '防御星 ' + T.stars + ' 颗', d: T.stars ? '守方受到的伤害按“星数 × 守方血量格数”% 减少：满血时每颗星约 −10%，血量越低效果越弱。' : '这里没有防御加成，站在上面的单位挨打不会减伤。'};
    case 'income': return {t: '收入', d: `占有者每回合可从这座建筑得到 ${T.income} 资金。`};
    case 'capture': return {t: '占领点数', d: `步兵、反坦克兵站在不属于自己的建筑上选「占领」，每次累加自己的血量格数（满血 +10）；累计到 ${T.capture} 点建筑易主。占领中走开，进度清零。`};
    case 'owner': return {t: '归属', d: owner === undefined ? '中立的建筑，谁都可以去占。' : '这座建筑已被一方占有，对方要占领才能夺走。'};
    case 'hazard': return {t: '泥潭', d: `回合结束时，站在这里的陆军掉 ${(cfg.swampDamage || 0) / 10} 格血${cfg.swampKills ? '，血量归零就会阵亡' : ''}。`};
  }
  return null;
}

// 说明栏平时显示的默认文字
export const unitDefault = (type) => ({t: UNITS[type].name, d: UNIT_BLURB[type] || ''});
export function terrainDefault(tid, eu) {
  const T = TERRAINS[tid];
  if (!eu) return {t: '防御星', d: T.stars ? '每颗星让满血单位少受约 10% 的伤害，血量越少效果越弱。' : '这里没有防御加成。'};
  const hp = Math.ceil(eu.hp / 10);
  return {t: '这一格上的' + UNITS[eu.type].name, d: T.stars ? `当前 ${hp}/10 血，在这里受到的伤害 −${T.stars * hp}%。` : '在这里没有防御加成。'};
}
export {CAT_ORDER};
