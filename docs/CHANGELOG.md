# 更新日志（1.01 起）

> 1.00 及以前的日志在 `docs/archive/CHANGELOG_至0.90.md`、`docs/archive/CHANGELOG_0.91至1.00.md`（不用读）。新日志从这里往下加，每条 5–8 行。

## 1.01
- 「找单位」键：镜头只在闲置单位之间轮换。多个闲置单位依次轮转（轮完回到第 1 个）；镜头已停在「下一个」单位身上时这一下直接跳过它；只剩一个闲置单位时，每按一下都对准它，不再来回切到开始前位置 / 基地视角。（`src/battle/main.js` `bNext.onclick`；结束回合的镜头记忆仍用 `cycleHome`，没动）
- 新增毛玻璃提示页 `blur-tip.html` + `src/battle/blur-tip.js`：主页右下角版本号可点击进入；全黑底、虚拟横屏舞台（真横屏 rot=0 同样适配）；亮条 + 动画箭头标出返回手势的起点边（虚拟横屏在舞台下 / 上边，真横屏在左边，随旋转实时切）；「返回主页」按钮是手势失灵时的保底；随 `gridmarch.lang` 中英文。
- 版本号元素 `#ver` 从 div 改成 button（点击热区加大，文字位置不变）。
- 冒烟 `smoke-cycle.py` 按新规则重写（轮转 / 跳过当前 / 唯一单位）；`smoke-camrem` 通过。

## 1.02
- 语言包框架：新增 `src/i18n/`（`index.js` 的 `t('键', {参数})` / `setLang` / `getLang` / `onLang`，`zh.js`、`en.js` 两份字典）。语言沿用主页的 `gridmarch.lang`；英文缺词自动退回中文并在控制台提示一次，所以可以边译边发。主页（classic 脚本）和提示页自带的小字典这一版不动。
- `src/rules/data.js`：单位 / 地形 / 军队风格的 `name` 改成随语言取词的 getter（词条键 `unit.*` / `terrain.*` / `style.*`），原有 `.name` 调用处不用改；规则和存档里一直只存 id。英文名：Infantry、Anti-Tank Infantry、Recon Vehicle、APC、Light / Medium / Heavy Tank、Artillery、Rocket Artillery、Anti-Air Gun、AA Missile；地形 Plains … Swamp。
- 新增 `tools/check-i18n.mjs`（已并入 `npm test`）：zh / en 键一一对应、无空词条、`{占位符}` 两边一致、每个 id 都有词条、getter 随语言切换；并报告 src 里还剩多少写死的中文（当前约 631 处）作为迁移进度。
- 说明：英文模式下界面其余文字仍是中文，1.03 起分批迁移（1.03 战斗主界面，1.04 详细面板 / explain / 情报 / 兵工厂，1.05 战报 / 结算 / 地图名）。

## 1.03
- 中文菜单变成纯中文：主页菜单、战场暂停菜单（含军务 / 画质子页）去掉了英文小字（CONTINUE、RESUME、SAVE & HOME…）。英文模式下只显示英文主标题，不再有小字。
- 暂停菜单全部接入语言包：静态模板用 `data-i18n` / `data-i18n-html` / `data-i18n-aria`（`applyI18n(host)` 在装载战场时按当前语言替换，模板里保留中文原文当占位），动态文字（开 / 关、标题、「地图 · 种子」）走 `t()`。
- 开机 / 换图进度页跟随语言：标题 Gridmarch / 方寸战线，文字 Loading… / 正在载入…；主页切换语言会发 `gm-lang` 事件，i18n 立即重读，不用刷新页面。
- 英文名排版：单位名分「短名」和「全名」。短名（`UNITS[id].name`，列表 / 卡片 / 信息条用）：Infantry、Anti-Tank、Recon、APC、Light / Medium / Heavy Tank、Artillery、Rockets、AA Gun、AA Missile（自检限制 ≤12 个字符）；全名（`UNITS[id].fullName`，兵工厂大标签、详细面板标题用）：Anti-Tank Infantry、Recon Vehicle、Armored Personnel Carrier、Self-Propelled Artillery、Rocket Artillery、Anti-Air Gun、Anti-Air Missile。
- 单位图标字随语言：中文一个字，英文两个字母（IN、AT、RC、AP、LT、MT、HT、AR、RK、AA、AM），词条 `glyph.*`；`GLYPH[id]` 每次读取都按当前语言取。
- 英文排版微调（CSS，`#battle[data-lang=en]`）：兵工厂左栏加宽 18px（244 → 262）、名字 13px、图标字 14px；进度页标题字距收紧。中文排版不变。
- `window.battle` 增加 `ars`（调试 / 截图用）。自检新增：英文短名长度、图标字长度、`unit.*.full` / `glyph.*` 词条齐全。
- 后续批次顺延：1.04 战斗主界面其余文字（HUD、提示、确认框、行动栏）；1.05 详细面板 / explain / 情报 / 兵工厂；1.06 战报 / 结算 / 地图名。

## 1.04
- 战斗主界面其余文字接入语言包（`src/battle/main.js`）：HUD（第 N 天 / Day N、队伍名）、三个图标按钮的无障碍文字、结束回合确认框（标题、「还有 N 座兵工厂没生产」、取消 / 结束回合）、行动栏（合流 / 占领 / 攻击 / 待命 + 两条提示）、攻击预测（击破 / 反击 / 会被反杀）、胜负横幅、占领飘字、解散 / 投降 / 换图三个确认框、各类提示（单位上限、动画进行中、存档失败、已解散、存档地图已变化）、单位 / 地形信息卡的标签（血量 / 燃料 / 弹药 / 防御 / 归属 / 占领 / 中立）、错误前缀。
- 队伍名统一成 `OWN[0|1]`（`src/i18n/index.js` 导出，随语言：蓝军 / 红军，英文 Blue / Red）；`detail.js`、`intel.js`、`result.js` 里各自写死的那份已删。
- `main.js` 里的翻译函数用别名 `tr`（文件里好几处局部变量叫 `t` = 回合方，直接叫 t 会盖住它）。
- 词条共 128 条；`describe()`（调试用的旧单行说明，界面不显示）未迁移。
- 已知：兵工厂价格签的提示音靠中文关键词（不足 / 暂不可 / 未建模）判断，迁移兵工厂时（1.05）要改成按 class（`.poor` / `.lock`）判断，否则英文下「买不起」会发成功音。

## 1.05
- 详细面板、点一项的说明、兵工厂、战场情报全部接入语言包：
  - `explain.js` 整个重写：兵种简介（`blurb.*`）、地形简介（`tnote.*`）、点一项看说明的标题和正文（`tip.*`，数字用 `{参数}` 占位，句子不再拼接）。中文原文逐字保留。
  - `unit-info.js`：大类名（`cat.*`）、武器名（`wpn.*`）、移动类型名（`mt.*`）、武器块标签和「无 / 暂无目标 / 射程」（`wp.*`）；`CAT` / `WPN` / `MT_NAME` 变成随语言取词的查表对象（`lazyTable`），调用处没改。
  - `detail.js`：已行动 / 可行动、各格标签（机动 / 视野 / 射程 / 移动 / 燃料 / 弹药 / 收入 / 占领进度 / 占领点数 / 防御）、泥潭警告、底部提示、模型状态。
  - `arsenal.js`：标题、资金、转台提示、关闭、价格签（生产 / 暂不可 / 未建模 / 资金不足）、卡片小字（移 / 射）、机动 / 视野 / 燃料。
  - `intel.js`：标题、六行对照、行动中、中立据点、关闭提示、据点小标签（总部 / 大城 / 小城…）；顶部那行复用 `hud.day` + `banner.turn`。
- `sfx.js`：兵工厂价格签「买不起 / 锁定」的提示音改成按卡片的 `poor` / `lock` class 判断，不再靠中文文字（否则英文下会发成功音）。
- 英文排版：武器块的竖排标签（主炮 / 副炮）英文改成横排短名 Main / Sub；详细面板数值行加间隙、字号 11px；兵工厂转台提示字号 9.5px。中文不变。
- 自检新增：对每个单位 / 地形的每一项说明在英文下都能生成、且不含中文；中文关键句与原文一致。词条共 268 条；src 里还剩约 385 处写死的中文字符串。
- 顺延：1.06 战报 / 结算 / 地图名 / 地图编辑器 / 设置页等剩余部分。

## 1.06
- 修：兵工厂武器块里，没有武器时显示「无 / None」，右边的「主炮 / 副炮」标签会跑到左边贴着它；现在标签始终顶在最右（`.ars-wn{flex:1}`，中英文都一样）。
- 修：兵工厂展示台左上的名字小盒子，英文名太长折成两行时（装甲运兵车 Armored Personnel Carrier），右边缘离展示台边框太近，左右不对等；现在加了 `right:10px`，左右距离一致。
- 战报 / 结算（`result.js`）接入语言包：胜负标题、「占领了敌军总部」等结束原因、六行统计、「胜」印章、三个按钮、折叠条里的击毁 / 损失 / 据点。
- 引擎玩家可见的提示（`engine.js`：资金不足、不是你的兵工厂、本回合已生产过、已行动、到不了、打不到、不能占领 / 合流、已达到单位上限…）改成走语言包（别名 `tx`），中文原文不变；开发用的 `throw new Error(...)` 没动。
- 关卡名「第一关」接入语言包（`level1.js` 的 `name` 改成 getter，英文 Level 1），暂停菜单里的「第一关 · 种子 7」随语言。
- 英文：兵工厂卡片「移 / 射」改成 Mv / Rg 且不折行，价格签字号小一号。
- 自检新增：引擎提示中英文（`produce` 的资金不足 / 不是你的兵工厂）、`res.*` / `err.*` / `map.*` 词条齐全且英文无中文。词条共 303 条。
- 没迁移（有意）：开发 / 测试用页面（`tests/` 下的 units-terrain、ui-style、orientation，`src/app/`）、`map-builder.js` 里的测试地图和对象名、`world.js` 里的调试标签；主页和提示页用自带的双语字典。剩下约 344 处写死中文基本都在这些里面。

## 1.07
- 自行火炮换成 V2.1.1 动画性能版（`src/art/units/artillery/`：`artillery-performance.js` 入口、`artillery-v2_1_1.js` 共同工厂、`artillery-original.js`、`track-path.js`、`vehicle-animation.js`、`shared/tank-fire.js`、`shared/tracked-motion.js`）。静止外形与原 V2.0 逐项一致；新增行进（履带 / 轮组随距离转动、转向差速）和开火（炮管后坐复进、炮口闪光、烟尘）动画，接口和坦克完全一样（`advanceMotion` / `fire` / `updateFire` / `fireState`）。旧的 `artillery-v2_0.js` 和 `units/track-path.js` 已删除。
- `world.js`：自行火炮（`spec.k === 'art'`）接入坦克那套：移动时驱动履带（左右履带中心距 `ART_GAUGE = 1.95`）、攻击时炮塔先转向目标并保持到攻击结束（`aimLock`）、排队逐发 `fire()`，开火声改为炮管真的开火那一刻才响（和坦克一致，原来是点攻击就响）；待机缓扫炮塔时尊重 `aimLock`。
- `unit-models.js`（兵工厂转台 / 详细面板小窗）同步换成新模型。
- 新增冒烟 `tools/smoke-arty.py`：造一台自行火炮 → 攻击期间炮塔锁定 / 炮管真的开过火 / 特效放完回调返回 → 行驶时履带距离变化 / 页面无报错。
- 美术包版本表更新；「已收到、尚未接入」列出快速侦察车 V1.3、多管火箭炮车 V1.5.1、六轮装甲运输补给车 V1.6.1（后续两个小版本接入）。
- 未测：iPhone 真机帧率（性能版车体 47 个网格；开火时额外 3 个特效网格，预先分配、复用）。

