// 规则数据（0.33）：单位、地形、伤害表、军队风格。只有数据，不含任何画面 / 像素信息。
// 参考 GBA《高级战争2》：伤害表、移动消耗、防御星取自公开资料；标【草案】的是我们自己的设计，随时改这里的数字即可。
// 造价：大体沿用高战2 的比例，改了三处：装甲运输车 5000→4000、重坦 22000→20000、自行火炮 6000→7000。
// buildable:false = 暂不可生产（防空导弹：没有空军 / 海军时它对陆军一个目标也打不了）。

// ── 配置开关（和 HANDOFF 里"后勤做成可开关"一致）──
export const CONFIG = {
  ammo: true,          // 弹药：主武器耗弹，打光后只能用副武器（机枪）
  fuel: false,         // 燃料：0.33 先关，移动只受移动力限制
  joinRefund: 0.9,     // 合流溢出血量的返现比例（合流本身等定价后实现）
  swampDamage: 10,     // 沼泽：回合结束时站在上面的陆军掉 1 格血（内部血量 10 点 = 显示 1 格）；可致死
  swampKills: true,
  incomeMul: 1,        // 整体收入倍率（以后做 AI 难度档位用）
};

// ── 军队风格（替代指挥官；先只有均衡型，以后按高战风格增加）──
// atk / def：对 1 的倍率，直接进伤害公式（高战里 CO 的攻防系数就是这个位置）。
export const STYLES = {
  balanced: {name: '均衡型', atk: 1, def: 1},
};
export const DEFAULT_STYLE = 'balanced';

// ── 陆军 11 种 ──
// fuel：步兵类（步兵、反坦克兵）= Infinity（无限，界面显示 ∞，和高战2 的 99 / 70 区分；扣燃料、补给的算术对 Infinity 都成立）。
// move 移动力；vision 视野（暂不用，雾战关着）；mt 移动类型；range [最近, 最远]；fuel / ammo 满值；
// primary：有主武器（耗弹）；secondary：有副武器（机枪，不耗弹）；indirect：间接火力（不能移动后开火、不能被反击、不能打相邻）
export const UNITS = {
  inf:     {name: '步兵',     move: 3, vision: 2, mt: 'foot',  range: [1, 1], fuel: Infinity, ammo: 0, primary: false, secondary: true,  indirect: false, capture: true,  cost: 1000},
  mech:    {name: '反坦克兵',   move: 2, vision: 2, mt: 'mech',  range: [1, 1], fuel: Infinity, ammo: 3, primary: true,  secondary: true,  indirect: false, capture: true,  cost: 3000},
  recon:   {name: '快速侦察车', move: 8, vision: 5, mt: 'wheel', range: [1, 1], fuel: 80, ammo: 0, primary: false, secondary: true,  indirect: false, capture: false, cost: 4000},
  apc:     {name: '装甲运输车', move: 6, vision: 1, mt: 'tread', range: [1, 1], fuel: 70, ammo: 0, primary: false, secondary: false, indirect: false, capture: false, cost: 4000},
  tank:    {name: '轻坦',     move: 6, vision: 3, mt: 'tread', range: [1, 1], fuel: 70, ammo: 9, primary: true,  secondary: true,  indirect: false, capture: false, cost: 7000},
  mdtank:  {name: '中坦',     move: 5, vision: 1, mt: 'tread', range: [1, 1], fuel: 50, ammo: 8, primary: true,  secondary: true,  indirect: false, capture: false, cost: 16000},
  neotank: {name: '重坦',     move: 6, vision: 1, mt: 'tread', range: [1, 1], fuel: 99, ammo: 9, primary: true,  secondary: true,  indirect: false, capture: false, cost: 20000},
  arty:    {name: '自行火炮', move: 5, vision: 1, mt: 'tread', range: [2, 3], fuel: 50, ammo: 9, primary: true,  secondary: false, indirect: true,  capture: false, cost: 7000},
  rocket:  {name: '火箭炮',   move: 5, vision: 1, mt: 'wheel', range: [3, 5], fuel: 50, ammo: 6, primary: true,  secondary: false, indirect: true,  capture: false, cost: 15000},
  aa:      {name: '防空炮',   move: 6, vision: 2, mt: 'tread', range: [1, 1], fuel: 60, ammo: 9, primary: true,  secondary: false, indirect: false, capture: false, cost: 8000},
  missile: {name: '防空导弹', move: 4, vision: 5, mt: 'wheel', range: [3, 5], fuel: 50, ammo: 6, primary: true,  secondary: false, indirect: true,  capture: false, cost: 12000, buildable: false},   // 资料里移动力有 4 / 5 两种写法，取 4
};
export const UNIT_IDS = Object.keys(UNITS);

// ── 兵种大类（0.52）：兵工厂界面像高战2 一样按「大类」写武器能打谁，不逐个兵种列。以后加直升机 / 飞机 / 船 / 潜艇，只要在这里给新单位标上大类、CAT_ORDER 里已有位置。──
export const UNIT_CAT = {inf: 'foot', mech: 'foot', recon: 'veh', apc: 'veh', tank: 'veh', mdtank: 'veh', neotank: 'veh', arty: 'veh', rocket: 'veh', aa: 'veh', missile: 'veh'};
export const CAT_ORDER = ['foot', 'veh', 'heli', 'air', 'ship', 'sub'];
export const WEAPON_LIST_MIN = 30;   // 某武器对某一大类里「最高基础伤害」≥ 这个数才算「能打」并列进界面（按高战2 轻坦截图反推：主炮对步兵 25 不列，机枪对车辆 45 列；阈值是猜的，可调）

// ── 地形：cost = 各移动类型的消耗（null 不可进入）；stars = 防御星（0–4）──
// 收入（income）：高战2 里所有产出建筑都是 1000/回合；0.41 起：总部 / 大城市 / 兵工厂 / 机场 / 船坞 1000，小城市 700（钱不能来得太容易，前期抢城才有意义）。
// 前 13 项取自高战2（晴天）。city_large / city_small 的防御星、占领点数先与原作的城市相同，收入与修理量等经济规则以后再分。
const P = {foot: 1, mech: 1, tread: 1, wheel: 1};          // 全部消耗 1
export const TERRAINS = {
  plain:      {name: '平原',   stars: 1, cost: {foot: 1, mech: 1, tread: 1, wheel: 2}},
  forest:     {name: '树林',   stars: 2, cost: {foot: 1, mech: 1, tread: 2, wheel: 3}},
  mountain:   {name: '山地',   stars: 4, cost: {foot: 2, mech: 1, tread: null, wheel: null}},
  river:      {name: '河流',   stars: 0, cost: {foot: 2, mech: 1, tread: null, wheel: null}},
  sea:        {name: '海洋',   stars: 0, cost: {foot: null, mech: null, tread: null, wheel: null}},
  shoal:      {name: '浅滩',   stars: 0, cost: {...P}},
  road:       {name: '公路',   stars: 0, cost: {...P}},
  bridge:     {name: '桥梁',   stars: 0, cost: {...P}},
  hq:         {name: '总部',   stars: 4, cost: {...P}, income: 1000, property: true, capture: 20},
  city_large: {name: '大城市', stars: 3, cost: {...P}, income: 1000, property: true, capture: 20},
  city_small: {name: '小城市', stars: 3, cost: {...P}, income: 700, property: true, capture: 20},
  factory:    {name: '兵工厂', stars: 3, cost: {...P}, income: 1000, property: true, capture: 20},
  airport:    {name: '机场',   stars: 3, cost: {...P}, income: 1000, property: true, capture: 20},
  port:       {name: '船坞',   stars: 3, cost: {...P}, income: 1000, property: true, capture: 20},
  // 以下是我们自己的设计【草案】
  cliff:      {name: '断崖',   stars: 0, cost: {foot: null, mech: null, tread: null, wheel: null}},   // 断崖海岸：陆军不能站上去
  desert:     {name: '沙漠',   stars: 0, cost: {foot: 2, mech: 2, tread: 2, wheel: 3}},                // 拖慢移动，无遮蔽
  swamp:      {name: '沼泽',   stars: 0, cost: {foot: 2, mech: 2, tread: 3, wheel: 4}, hazard: true}, // 拖慢移动；回合结束掉血（见 CONFIG）
};

// ── 伤害表：基础伤害 %（攻击方行 → 目标列），数组顺序 = TARGET_ORDER；null = 打不了 ──
// 来源：高战2 伤害表（Wars World News）。主武器(P)耗弹；副武器(S)是机枪不耗弹。
// 没有空军 / 海军时：防空导弹对陆军一律打不了（它是纯对空单位）。
export const TARGET_ORDER = ['inf', 'mech', 'recon', 'tank', 'mdtank', 'neotank', 'apc', 'arty', 'rocket', 'aa', 'missile'];
const row = a => Object.fromEntries(TARGET_ORDER.map((t, i) => [t, a[i]]));
export const DMG_PRIMARY = {
  mech:    row([null, null, 85, 55, 15, 15, 75, 70, 85, 65, 85]),
  tank:    row([25, 25, 85, 55, 15, 15, 75, 70, 85, 65, 85]),
  mdtank:  row([30, 30, 105, 85, 55, 45, 105, 105, 105, 105, 105]),
  neotank: row([35, 35, 125, 105, 75, 55, 125, 115, 125, 115, 125]),
  arty:    row([90, 85, 80, 70, 45, 40, 70, 75, 80, 75, 80]),
  rocket:  row([95, 90, 90, 80, 55, 50, 80, 80, 85, 85, 90]),
  aa:      row([105, 105, 60, 25, 10, 5, 50, 50, 55, 45, 55]),
};
export const DMG_SECONDARY = {
  inf:     row([55, 45, 12, 5, 1, 1, 14, 15, 25, 5, 25]),
  mech:    row([65, 55, 18, 6, 1, 1, 20, 32, 35, 6, 35]),
  recon:   row([70, 65, 35, 6, 1, 1, 45, 45, 55, 4, 28]),
  tank:    row([75, 70, 40, 6, 1, 1, 45, 45, 55, 5, 30]),
  mdtank:  row([105, 95, 45, 8, 1, 1, 45, 45, 55, 7, 35]),
  neotank: row([125, 115, 65, 10, 1, 1, 65, 65, 75, 17, 55]),
};
