# 更新记录（每次交付改了哪些文件）

> 用途：你跳过了某几个版本时，告诉我你现在的版本，我用 `docs/manifests/` 里的快照一键生成升级包；也可以自己把「你现在的版本之后」每一版的文件取并集。
> 每次交付的更新包里也有 `更新说明.md`，写的是相对上一版的改动；累计包会注明"从 vN 升级"。
> 更新后别忘了把 `index.html` 里的 `GM_VERSION` 加一位（避开手机旧缓存）。

## 0.54

- **展示台去掉「蓝军 / 红军」切换按钮**：兵工厂只显示自己阵营色（由兵工厂归属决定）
- **取消 0.53 的弹窗，改成「价格签变生产按钮」**：点一张兵种卡 = 选中，并且这张卡右侧的价格签变成橙色「生产 / 价格」按钮；点这个按钮才生产（仍是演示：不扣钱、不出兵），生产后还原；再点同一张卡的其他地方 = 还原成只有价格；点别的兵种卡 = 直接换成那张卡的生产按钮。买不起显示灰色「资金不足 / 价格」，暂不可生产显示灰色「暂不可 / 生产」，点了没反应
- **排版**：左边兵种列表加宽 224 → 244，右列数据 214 → 204（展示窗只窄了几个像素）
- `tools/smoke-arsenal.py` 同步：点选 → 检查生产按钮 → 换兵种 → 再点还原 → 点生产 → 关闭
- `src/battle/arsenal.js`、`src/battle/battle.css`、`tools/smoke-arsenal.py`；`index.html`：`GM_VERSION` `0.53` → `0.54`

## 0.53

- **兵工厂：点兵种卡 → 卡片右边弹出「生产」小弹窗**（带指向卡片的小箭头），点弹窗才生产（目前仍是演示：不扣钱、不出兵）；买不起 / 暂不可时弹窗置灰。列表滑动时弹窗跟着卡片走，卡片滑出可见范围就隐藏；点展示窗或生产后收起
- **原「生产」按钮改成「关闭」**（右下角）；**展示窗右上角的圆形 ✕ 移除**
- `tools/smoke-arsenal.py` 同步：点选兵种 → 检查弹窗 → 点弹窗 → 点「关闭」，连做 3 轮
- `src/battle/arsenal.js`、`src/battle/battle.css`、`tools/smoke-arsenal.py`；`index.html`：`GM_VERSION` `0.52` → `0.53`
- 补记：0.50–0.52 当时没有走升级包流程（补丁包名字错了，机器人把它当完整包，仓库被清成只剩补丁），这一版起补回 `docs/manifests/0.51.json`、`0.52.json`（0.50 的快照无法还原，缺）和下面三条记录

## 0.52

- **兵工厂右边改成仿高战2 排版**：转台在左，右列从上到下 = 机动 / 视野 / 燃料三行 + 主炮块 + 副炮块 + 按钮。每个武器块：武器名 + 弹药（射程不是 1 的带「射程」），下面只列「能打的大类」小块（竖排「主炮 / 副炮」标签）
- `rules/data.js` 新增兵种大类 `UNIT_CAT` / `CAT_ORDER` / 阈值 `WEAPON_LIST_MIN`（某武器对某大类里最高基础伤害 ≥ 30 才列出；按高战2 轻坦截图反推：主炮对步兵 25 不列、机枪对车辆 45 列；阈值是猜的）。以后加直升机 / 飞机 / 船 / 潜艇，给新单位标上大类即可
- 武器名在 `arsenal.js` 的 `WPN` 表（我自己起的名字，可改）
- `src/battle/arsenal.js`、`src/battle/battle.css`、`src/rules/data.js`；`index.html`：`GM_VERSION` `0.51` → `0.52`

## 0.51

- 兵工厂展示盒下沿加「火力」：主炮 / 副炮各一排 11 个目标小章（目标兵种 + 基础伤害 %，强中弱三档颜色）；数据条加「燃料」（步兵、反坦克兵燃料 = `Infinity`，显示 ∞，和高战2 区分；`CONFIG.fuel` 仍关）。0.52 改成按大类，这套逐兵种小章已被替换
- `src/battle/arsenal.js`、`src/battle/battle.css`、`src/rules/data.js`；`index.html`：`GM_VERSION` `0.50` → `0.51`

## 0.50

- **兵工厂兵种列表第一下拖动发卡 → 改成自己处理滑动**：虚拟横屏（舞台旋转 90°）下，原生滚动的 `touch-action` 按物理屏幕算，浏览器要先「猜」手势；现在用 pointer 事件按 `stage.vec` 换算的纵向位移自己滑，手指一动就跟，松手带惯性，拖动时不误点卡片
- **「还能滑」标记**：上 / 下还有内容时对应一侧渐隐 + ▲ / ▼ 小箭头，滑到头自动消失；选中的卡片只有不在可见范围内才自动居中
- `src/battle/arsenal.js`、`src/battle/battle.css`；`index.html`：`GM_VERSION` `0.49` → `0.50`

## 0.49（本窗口最后一版，只改文档）

- `docs/HANDOFF.md` 按本窗口（0.40–0.49）更新：关卡适配器 `engine-map.js`、开局设定、收入改版（1000 / 小城市 700、开局资金 0）、「机械兵」改名「反坦克兵」、兵工厂界面全貌与做法（两个悬浮玩具盒、无转盘展示窗、手势、不显示视野）、风险 / 待决（语言包、真机项、动态生成单位）、路线图、新增教训 11–15（漏传升级包与 CI 红灯、`npm test` 抓不到运行时错误、容器里读中文的坑等）
- 新增 `tools/smoke-arsenal.py`：兵工厂界面无头浏览器冒烟测试（打开 → 选兵种 → 关闭 → 重开 3 轮；不在 `npm test` 里）
- `index.html`：`GM_VERSION` `0.48` → `0.49`

## 0.48

- **修复：关闭 / 重开兵工厂界面报 `ReferenceError: Can't find variable: resetView`**（红色错误条）。0.46 加双指缩放时把 `resetView` / `clampView` / `startGesture` 定义在 `build()` 里面，而 `close()` 在外面也要调 `resetView`，一关闭面板就报错。现在三者都在 `createArsenal` 外层定义。无头浏览器里补了「打开 → 选兵种 → ✕ 关闭 → 再打开」连做 3 轮的冒烟测试，无报错（`npm test` 不跑浏览器，这类运行时错误它抓不到，所以 0.46 / 0.47 没被拦住）
- `src/battle/arsenal.js`；`index.html`：`GM_VERSION` `0.47` → `0.48`

## 0.47

- **兵工厂界面左右边距一致**：两边都留 `max(5·sw, 56px)`（以灵动岛一侧为准），另一侧不再被屏幕圆角吃掉，也离手势区远一点；展示面板左右宽度相应缩小。去掉 0.46 的按灵动岛侧区分的 `side-r` 逻辑
- **去掉「视野」数值**（不做战争迷雾）：展示盒底栏只剩移动 / 射程 / 弹药三项（引擎数据里的 `vision` 保留不动）
- `src/battle/arsenal.js`、`src/battle/battle.css`；`index.html`：`GM_VERSION` `0.46` → `0.47`

## 0.46

- **兵工厂界面避开灵动岛**：灵动岛在哪边（`stage.side`），那一边就多留出 `max(5·sw, 56px)` 的空；岛在左（默认）左边留，岛在右（换边后）右边留，另一边只留 12px，所以换边后展示盒不再被遮。左盒宽度 236 → 224，展示盒相应缩小
- **展示窗手势**：单指拖动 = 转模型；**双指捏合 = 缩放 1×–4.5×**（相机拉近，能凑到模型表面看细节）；放大后**双指一起拖 = 平移观察点**；双击 = 复位；电脑上鼠标滚轮缩放；放大看细节时不自转；切换兵种自动复位。手指向量同样经 `stage.vec` 换算（虚拟横屏下横向滑动落在另一个轴上）
- `src/battle/arsenal.js`、`src/battle/battle.css`；`index.html`：`GM_VERSION` `0.45` → `0.46`

## 0.45

- **兵工厂界面改成两个悬浮的独立玩具盒**：左边「选兵种」盒（兵种单列，每张卡片：图标 / 名字 / 移动·射程 / 价格；一屏放不下就上下滑，底部渐隐提示还能滑；选中的卡片自动滚到中间；顶部资金），右边「展示」盒（整个盒子就是展示窗，模型占满；左上兵种名 + 蓝军 / 红军验收按钮，右上 ✕；下沿一条栏：移动 / 射程 / 弹药 / 视野 4 个数值 + 橙色「生产 · 价格」按钮；买不起显示灰色「资金不足 · 价格」）
- **去掉转盘**：展示窗里是暖米色摄影棚背景，脚下只有一块渐隐软落影 + 真实投影（只接收阴影的透明地面），三点布光不变；模型对角线统一缩放到 3.3
- **做法**：展示窗仍是战场 renderer 的 viewport + scissor；窗口四周和盒子其余部分的奶油色，由 `.ars-pv` 的超大外扩阴影提供（盒子 `overflow:hidden` 裁掉多余），窗口圆角也靠它；压暗层用 `clip-path` 在窗口矩形处挖洞。不再需要旧的整块面板底板挖洞
- 兵工厂打开时隐藏右上角的旋转 / 视距 / 换图按钮（原先会透到展示窗上）
- `src/battle/arsenal.js`、`src/battle/battle.css`；`index.html`：`GM_VERSION` `0.44` → `0.45`

## 0.44

- **展台改版（暖米色摄影棚 + 玩具底座）**：背景换成暖米色径向渐变（和奶油面板同色系，略深，带暗角）；脚下是有厚度的玩具底座（深蓝灰底 + 军队色腰线 + 奶油白台面 + 台面细环 + 一圈刻度，刻度随模型一起转，才看得出在转；军队色随「蓝军 / 红军」变）；底座下面一块渐隐的暗斑当落影
- **三点布光**：暖色主光（投影，软边）+ 冷色补光 + 背后轮廓光（给模型边缘勾亮边）
- **取景重做**：按「底座 + 模型」总高度和底座直径算相机距离，底座和模型都完整入镜；模型对角线统一放大到 3.5（原 4.0）
- **「机械兵」改名「反坦克兵」**（引擎 id 仍是 `mech`，模型本来就是反坦克步兵）：`rules/data.js`、`engine-map.js`、兵工厂卡片图标由「机」改「反」
- `src/battle/arsenal.js`、`src/battle/battle.css`；`index.html`：`GM_VERSION` `0.43` → `0.44`

## 0.43

- **转台拖动修好**：虚拟横屏（舞台旋转 90°）下，手指的横向滑动落在逻辑坐标的另一个轴上，原来只把横向分量交给 `stage.vec` 换算，结果永远是 0；现在 x、y 两个分量都交给它。无头浏览器里拖动验证模型会跟着转（那里舞台没旋转，虚拟横屏下的拖动要你真机确认）
- **展台改成纯黑虚空**（`#030405`），去掉转盘：脚下一圈很淡的蓝灰柔光（有"踩着地"的感觉）+ 只接收阴影的透明地面（单位的影子投在柔光上，能看见）；单位在原地自转，光源不动，效果等同相机绕着模型转
- `src/battle/arsenal.js`、`src/battle/battle.css`；`index.html`：`GM_VERSION` `0.42` → `0.43`

## 0.42

- **兵工厂生产界面（风格 B 玩具盒）**：新增 `src/battle/arsenal.js`，样式在 `src/battle/battle.css` 末尾。战场上点「当前回合一方」的兵工厂弹出：左边 11 个兵种卡片（价格 / 买不起置灰 / 防空导弹"暂不可生产"），右边选中单位的**高精度模型转台**（自动慢转、手指拖动旋转）+ 移动 / 射程 / 弹药 / 视野 + 生产按钮；右上资金、✕ 关闭；「蓝军 / 红军」按钮仅供验收美术（切换军队色看模型）
- 转台不开第二个画布：用战场同一个 renderer，在右侧透明留空区对应的屏幕矩形里（viewport + scissor）画一个独立小场景；面板底板和背景压暗层用 `clip-path` 在该矩形挖洞，战场画布才能透出来；虚拟横屏下也成立（用 DOM offset 链取舞台内坐标）
- 预览用的是原版 / 基线高精度模型（步兵 V6 基线、反坦克步兵基线、轻 / 中 / 重坦、自行火炮），不是战场上的批量性能版；每个模型按对角线统一放大到占满转台；快速侦察车、装甲运输车、火箭炮、防空炮、防空导弹显示"尚未建模"
- **「生产」目前只是演示**（提示"不扣钱、不出兵"），等你对界面和模型特写满意后再接引擎 `produce()` 和出兵
- `src/battle/main.js`：创建 / 销毁兵工厂；界面打开时每帧重画战场 + 转台
- `index.html`：`GM_VERSION` `0.41` → `0.42`

## 0.41

- **收入改版**：总部 / 大城市 / 兵工厂 / 机场 / 船坞 每回合 1000，小城市 700（原来总部、大城市 1500，小城市 1000）；理由：钱来得太容易，前期抢城没有意义。数值在 `src/rules/data.js` 的 `TERRAINS`
- **开局资金 0**（`level1.js` 的 `START.funds`）：第 1 天蓝方领一次收入 3000（总部 + 2 兵工厂），红方轮到时领 3000
- 测试同步：`check-rules.mjs` 收入用例改新数字并加小城市 700 一项；`check-engine-map.mjs` 改为 +3000
- `index.html`：`GM_VERSION` `0.40` → `0.41`

## 0.40（新窗口第 1 版）

- **关卡接上规则引擎（只显示，还不能操作）**：新增 `src/game/engine-map.js`（预设 → 引擎：地形逐格对应 `TERRAINS` id、建筑归属 `owners`、开局资金、起始部队；纯数据，Node 里可测）。引擎坐标 = 世界格坐标减棋盘左上角，换算函数 `toEngine` / `toWorld`；玩家 0 = 蓝（西，先手）、1 = 红（东）
- **开局设定**：`src/game/levels/level1.js` 顶部 `START = {funds: 5000, army: ['inf','inf','mech','tank']}`【暂定】；蓝方起始部队随机落在总部周围 2–4 格内（避开基地一圈、山 / 沙漠 / 沼泽 / 河 / 桥），红方左右镜像，所以双方完全对称；第 1 天蓝方再领一次收入（总部 1500 + 2 兵工厂 2000 = 3500，显示 8500 / 5000）
- **战场显示**：开局单位按引擎状态摆出来（步兵、机械兵 = 反坦克步兵模型、轻坦；蓝军面朝东、红军面朝西）；左下角信息栏加一行 `第 N 天 · 蓝方回合 · 资金`；点格子时显示建筑归属（蓝方 / 红方 / 中立），点到单位显示兵种、血量（格）、弹药
- 新增 `tools/check-engine-map.mjs`（40 个种子：地形合法、建筑归属 1 总部 + 2 兵工厂 / 中立 2 大 + 6 小、起始部队站在合法格且双方镜像、每个单位都能动），并入 `npm test`
- `src/battle/main.js`：创建引擎、把单位规格写进 `preset.layout.units`；调试对象 `window.battle` 多了 `game`
- `index.html`：`GM_VERSION` `0.39` → `0.40`

## 0.39（上个窗口最后一版，只改文档）

- 更新 `docs/HANDOFF.md` 到本窗口的最终状态：战场并入主页（单文档）、规则引擎与经济（`src/rules/`）、格子光圈与地形取样、界面风格方向、顶部固定 52px、状态栏图标结案、待你决定清单、0.40 起的路线图、本地无头浏览器验证方法与新教训
- `index.html`：`GM_VERSION` `0.38` → `0.39`；**新窗口从 0.40 起**

## 0.38

- **光圈贴合各种地形**：`src/game/world.js` 新增 `surfaceY(cx, cz, x, z)`（任意点的可见表面高度：桥面 → 桥面高度；山体 → 山脚；沙漠 → 沙丘起伏；河 / 海 → 水面；海岸格 → 锚点高度；沼泽 → 0；其余 → 平地 / 建筑底面）。`src/battle/cursor.js` 的 `show(x, z, kind, sample)` 改为取样函数：光圈整体放在格子中心的表面上，四个护角和底色（8×8 细分）各自贴合自己位置的高度，沙丘起伏、桥面都对得上
- **点桥选中桥格**：`cellFromRay` 对桥面高度再取一次（桥面比地面高，原来按地面取会选到桥后面的格子）
- 验证：沙漠 / 海面 / 桥面真实点击截图确认；本关种子 7 没有"河"格，河面走同一套水面取样，没有单独截图
- `src/battle/main.js` 改用 `surfaceY`；`index.html`：`GM_VERSION` `0.37` → `0.38`

## 0.37

- **光圈对齐山体**：`src/game/world.js` 新增 `baseY(cx, cz)`（格子的地面高度；山体取山脚，其余同 `groundY`）。原来光圈取 `groundY`，对山体返回的是山顶站位点，光圈浮在山顶高度，透视下偏上
- **光圈贴地 + 挡住的部分半透明**：`src/battle/cursor.js` 光圈画在真实地面上，没被挡的部分实心，被建筑 / 山体挡住的部分用半透明显示（`GreaterDepth`），底色层也不再盖在建筑上；护角略收细，粗细集中在 `SIZE`（`arm` / `thick` / `edge`），半透明程度 `GHOST`；`src/battle/main.js` 改用 `baseY`
- 建筑标记（菱形水晶）保持始终可见
- `index.html`：`GM_VERSION` `0.36` → `0.37`

## 0.36

- **格子光圈升级**：新增 `src/battle/cursor.js`（`createCursor`、`COLORS`），`src/battle/main.js` 改用它（替换原来的黄色细线方框）。四个转角厚护角（浅金色 + 深蓝描边），点中时从大一圈"落下"弹一下，之后轻微呼吸；点到建筑时护角更粗、底色更亮，并在建筑上方多一颗自转、上下浮动的菱形标记。光圈显示时约 30 帧/秒重画，不显示时仍按需渲染
- 光圈颜色集中在 `COLORS`，以后单位选中、移动范围等沿用，界面和战场保持同一风格
- `index.html`：`GM_VERSION` `0.35` → `0.36`

## 0.35

- **界面风格对比页**（测试页，不影响游戏）：新增 `tests/ui-style.html`、`src/app/ui-style.js`、`src/app/ui-style.css`。同一套兵工厂界面（左：11 个兵种卡片，含价格 / 置灰 / "暂不可生产"；右：转台预览 + 移动 / 射程 / 弹药 / 视野 + 生产按钮）× 三套主题：A 战术终端、B 玩具盒、C 折中；可切蓝 / 红军色。单位数据取自规则引擎；防空炮 / 防空导弹显示"尚未建模"；转台是占位方块，可拖动旋转，不拖时自动慢转
- 选定风格后整理成全游戏统一的界面规范（兵工厂、单位信息、建筑信息共用）
- `index.html`：`GM_VERSION` `0.34` → `0.35`

## 0.34

- **经济规则**：`src/rules/data.js`（11 个单位造价；地形收入：总部 / 大城市 1500，小城市 / 兵工厂 / 机场 / 船坞 1000；`incomeMul` 整体收入倍率）、`src/rules/engine.js`（`owners` 建筑归属、`funds` 开局资金、回合开始领收入、`produce()` 在自己的兵工厂生产，每座每回合 1 个，新单位本回合不能行动）
- 造价大体沿用高战2，改了三处：装甲运输车 5000→4000，重坦 22000→20000，自行火炮 6000→7000；防空导弹暂不可生产（没有空军 / 海军时它无目标），防空炮对陆军有伤害，可以生产
- `tools/check-rules.mjs` 增加 4 项经济测试（共 15 项）；`index.html`：`GM_VERSION` `0.33` → `0.34`

## 0.33

- **规则引擎骨架**（纯数据 + 纯函数，不依赖画面；战场画面这一版不变）：新增 `src/rules/data.js`（11 个陆军单位、17 种地形的移动消耗与防御星、高战2 伤害表、配置开关、军队风格）、`src/rules/combat.js`（伤害公式、选武器）、`src/rules/engine.js`（移动、攻击与反击、间接火力、弹药、沼泽掉血、回合切换、歼灭胜负）
- 伤害公式同高战2（无指挥官）：基础伤害 × 攻方血量 ×（200 −（守方系数 + 地形星 × 守方血量））；指挥官改为"军队风格"，系数直接进公式，默认均衡型（攻守都 ×1）
- 单位造价留空（不照抄原作），合流返现（`joinRefund` 0.9）等定价后实现
- 草案项（可直接改 `data.js`）：沙漠、沼泽、断崖的移动消耗与防御；防空导弹移动力取 4
- 新增 `tools/check-rules.mjs`（11 项测试），并入 `npm test`；`index.html`：`GM_VERSION` `0.32` → `0.33`

## 0.32

- 测试页顶部固定距离 55px → 52px：`src/app/ui.css`（`--top-safe`；错误条随之变为 52+52）
- 主页菜单离岛侧边缘至少 52px：`home.css`（`--pad-l: max(5vw, 56px)`：按钮倾斜后最靠边的角约退进 4px，实测可见边缘 ≈ 52px；标题同步右移几像素）；`index.html`：`GM_VERSION` `0.31` → `0.32`

## 0.31

- **测试页直接加到主屏幕时顶部空白**：`tests/units-terrain.html` 缺少 `apple-mobile-web-app-capable` 和 `status-bar-style=black-translucent`（`index.html`、`orientation.html` 都有），iOS 按默认状态栏样式把内容推到状态栏下面（inner 少了约 62px）。从主页跳转过去没问题，是因为沿用了主页已经建立的窗口样式。补上这几行 meta；已经加到主屏幕的旧图标要删掉重新添加才会生效。
- `index.html`：`GM_VERSION` `0.30` → `0.31`

## 0.30（新窗口第一版）

- **战场并入主页，整个游戏只有一个 html**（不再有页面跳转，系统边缘滑动前进 / 后退手势没有历史可翻）：删除 `battle.html`；`index.html`（新增 `#homeView` / `#battle` 两个视图、`<!--GM-BOOT self="1"-->` 只生成 importmap）、`home.js`（单人对战 = 切换视图并按需 `import('./src/battle/main.js')`；舞台只创建一次、两个视图共用；开发直达 `index.html?go=battle&seed=N&debug=1`）、`home.css`（`#homeView`）、`src/battle/main.js`（改成 `mountBattle` / `unmountBattle`，退出和「换图」时停循环、摘监听、释放显存与 WebGL 上下文；「换图」原地重建，不再刷新页面）、`src/battle/battle.css`（全部挂在 `#battle` 下）、`src/battle/stage.js`（新增 `offChange`）、`tools/stamp.mjs`（支持 `self="1"` 和无入口页面）
- `tests/units-terrain.html` 顶部不再用 `env(safe-area-inset-top)`（从网址直接打开时顶部会多出空白）：`src/app/ui.css`（新增 `--top-safe:55px`，`#hud`、`#err` 用它）、`tests/units-terrain.html`（`#bFold`）；原来多出来的 +8px 间距一并去掉
- 文档：`README.md`、`docs/HOME.md`、`docs/ARCHITECTURE.md` 同步页面结构（`docs/HANDOFF.md` 按习惯等本轮结束时再整理）
- `index.html`：`GM_VERSION` `0.29` → `0.30`

## 0.29
- `tests/units-terrain.html` 顶部加安全区（竖屏下免得被灵动岛挡）：`src/app/ui.css`（`#hud`、`#err`）、`tests/units-terrain.html`（`#bFold`）的 `top` 加 `env(safe-area-inset-top)`
- `docs/HANDOFF.md` 按本窗口结果整理：新窗口从 0.30 起；§5 改写（舞台方案、全屏规则、安全区例外、排查工具、沿革）；§7 新增“竖屏状态栏图标”未解决项；§10 教训；§3 / §4 补自动应用工作流
- `index.html`：`GM_VERSION` `0.28` → `0.29`

## 0.28
- `tests/units-terrain.html` 竖屏底部留白：`src/app/ui.css`（`html,body` / 画布改 100vw×100vh，底部条 `bottom:calc(100% - 100vh)`）、`src/app/main.js`（画布尺寸、点选、拖动换算用 100vw×100vh 探针量出的 `vp`，不再用 `innerWidth/innerHeight`；横竖屏切换时重新测量；HUD 末行显示 100vh / inner 数字）
- `index.html`：`GM_VERSION` `0.27` → `0.28`

## 0.27
- 主页去掉「换边」按钮：`index.html`、`home.css`、`home.js`（换边只在战场页里做，选择共用；`src/battle/stage.js` 回到前台 / 页面从缓存恢复时重新读取选择，所以在战场页换边后回主页会自动跟着变）
- 主页版本号：往里挪（`right:34px; bottom:24px`，避开屏幕圆角）、加粗、白字黑描边，叠在背景图上也看得清
- `src/battle/stage.js`、`src/battle/orientation-test.js`：排查开关（测量方式 / 关闭旋转 / 容器）不再存 `localStorage`，只在当前页面有效，刷新恢复默认（旋转开、容器 100vh、测量 vh），避免测试留下的状态影响别的页面
- `src/battle/battle.css`：注释同步；`index.html`：`GM_VERSION` `0.26` → `0.27`

## 0.26（舞台并回战场页和主页）
- 根因（0.25 测试页验证）：`html,body` 写成 `position:fixed; inset:0` / `height:100%` 时，竖屏独立窗口里只有 812（比屏幕矮 62），底部留白；改成 `width:100vw; height:100vh` 就铺满
- 战场页并回舞台：`battle.html`（整页放进 `#stage`，去掉竖屏提示 `#land`，新增「换边」）、`src/battle/main.js`（画布 / 相机尺寸用 `stage.w/h`，指针坐标用 `stage.toLogical`，长按「换边」0.8 秒开现场诊断）、`src/battle/battle.css`（`html,body` 改 100vw×100vh，界面层相对舞台定位）
- 主页并回舞台：`index.html`（整页放进 `#stage`，去掉竖屏提示层，背景改 `<img id="bg">`，新增「换边」）、`home.css`（`html,body` 改 100vw×100vh；`vw/vh` 改 `--sw/--sh`；去掉 `env(safe-area-*)`）、`home.js`（动态加载 `stage.js`、按舞台比例选背景、换边、长按诊断）
- `src/battle/orientation-test.js`：「容器」开关默认 100vh
- `index.html`：`GM_VERSION` `0.25` → `0.26`

## 0.25（回退 + 单独排查）
- 回退：战场页、主页恢复为 v8 的做法（真横屏；竖屏显示“请横屏使用”），不再用舞台——0.21 起并入舞台后竖屏出现黑边，原因没查清。涉及 `battle.html`、`src/battle/main.js`、`src/battle/battle.css`、`index.html`、`home.css`、`home.js`，相对 v8 只去掉了 `env(safe-area-*)`
- 舞台只留在 `tests/orientation.html` 单独排查：新增「旋转 开/关」「容器 fixed/100vh」两个开关（`gm.norot`、`gm.root`），配合诊断面板的测量方式，一次摸清黑边出在哪；`src/battle/stage.js` 新增 `setNoRot()`
- `docs/HANDOFF.md`、`docs/HOME.md` 同步；`index.html`：`GM_VERSION` `0.24` → `0.25`

## 0.24
- 竖屏黑边的现场诊断（0.23 的 100vh 探针没解决）：`src/battle/stage.js` 测量方式可切换（`gm.measure`：vh / lvh / svh / dvh / inner / screen / fixed，默认 vh），新增 `stageDebug()`（画各单位量到的屏幕边界 + 数字面板 + 切换按钮）和 `onLongPress()`
- 长按「换边」0.8 秒打开诊断：`src/battle/main.js`（战场页）、`home.js`（主页）；`src/battle/orientation-test.js`（测试页打开就带）
- `index.html`：`GM_VERSION` `0.23` → `0.24`

## 0.23
- 修竖屏伪横屏的黑色空白：`src/battle/stage.js` 量尺寸改用 `100vw×100vh` 隐形探针（`innerHeight` 在 iOS 独立窗口竖屏下比真实屏幕矮一截）；舞台上新增 CSS 变量 `--sw` / `--sh`（舞台宽 / 高的 1%）
- 主页并入虚拟横屏舞台：`index.html`（整页放进 `#stage`，去掉竖屏提示层，背景改成 `<img id="bg">`，新增「换边」按钮）、`home.css`（`vw/vh` 全改 `--sw/--sh`，`fixed` 改 `absolute`，去掉所有 `env(safe-area-inset-*)`）、`home.js`（动态加载 `stage.js`、按舞台比例选背景图、换边按钮、去掉“请横屏”文字）
- `src/battle/orientation-test.js`：HUD 第一行多打 `inner` / `screen` / `client` 数字，排查黑条用
- `index.html`：`GM_VERSION` `0.22` → `0.23`

## 0.22（只动工具和文档，运行文件没变）
- 新增 `.github/workflows/apply-package.yml`、`tools/apply-package.py`：手机网页把升级包 / 完整包 zip 传到仓库根目录，机器人自动解压、覆盖、删文件（`.github/workflows/` 里的文件机器人改不了，仍要手动传）
- `tools/pack.mjs`：升级包里多一个 `_delete.txt`（要删的文件清单，给自动应用用），升级说明加了手机上传的提示
- `README.md` 加「手机网页更新」，`docs/HANDOFF.md` 开机清单第 4 条改为"完整包 + 升级包"
- `index.html`：`GM_VERSION` `0.21` → `0.22`

## 0.21
- 虚拟横屏并入战场页：`battle.html`（整个页面放进 `#stage`，删除竖屏提示 `#land`，新增「换边」按钮）、`src/battle/main.js`（画布和相机尺寸用 `stage.w/h`，指针坐标用 `stage.toLogical`）、`src/battle/battle.css`（`#ui` / `#err` / `#loading` / 画布改为相对舞台定位）
- `index.html`：`GM_VERSION` `0.20` → `0.21`
- `tools/pack.mjs`：升级包里的"更新后"提示，遇到 `index.html` 已在包内时不再叫你手动改版本号

## 0.20（新窗口第一版；从这一版起交付完整仓库 zip，文件名带版本号）
- 战场 / 测试页不再处理安全区（灵动岛、手势区）：`src/battle/stage.js` 去掉安全区探测（`insets`、`--sa-*`、`insetsToLogical`）；`src/battle/battle.css`、`src/app/ui.css`、`tests/orientation.html`、`tests/units-terrain.html` 里的 `env(safe-area-inset-*)` 改成固定边距；`src/battle/orientation-test.js` 去掉对应显示
- `battle.html` 补 `apple-mobile-web-app-status-bar-style=black-translucent`（与主页、横屏测试页一致）
- 删除 `tools/bundle.mjs`（离线单文件打包，已不适用）；仓库根目录多余的 `升级说明.md` 不再放进包
- `index.html`：`GM_VERSION` `0.1.0` → `0.20`
- 虚拟横屏定为 iPhone 的正式方案，iPad 用真横屏（`docs/HANDOFF.md` §5）；并入战场页是下一步

## v8（旧窗口的收尾版，之后新窗口从 0.20 起）
- 新增 `docs/HANDOFF.md`（唯一必读的交接文档）、`docs/HOME.md`（并入主页开发文档）
- 旧开发文档改名并归档：`docs/archive/钢铁经线_开发文档.md` → `docs/archive/方寸战线_开发文档_测试阶段.md`（旧文件请删除）
- `docs/ARCHITECTURE.md` §2、§8 更新，新增 §9、§10；`docs/ART_PACKAGES.md` 更新
- 新增 `tools/manifest.mjs`、`tools/pack.mjs` 与 `docs/manifests/`（版本快照，之后可一键生成"从任意版本升级"的升级包）
- `README.md` 加文档索引

## v7
- 新增 `src/battle/stage.js`：虚拟横屏舞台（iPhone PWA 不能锁横屏时，系统竖屏就把画面转 90°）
- 新增 `src/battle/orientation-test.js`、`tests/orientation.html`：虚拟横屏真机测试页
- `src/app/main.js`、`tests/units-terrain.html`：测试页加「横屏测试」入口；三个页面里的文件清单增加新文件（`battle.html`、`tests/*.html`）

## v6
- `src/game/levels/level1.js` 第一关生成器重写：水域也随机（大湖 / 不规则湖 / 左右两池 / 没有湖）、河 + 公路桥、湖上跨海桥、基地行号与城市位置随机
- `src/game/map-builder.js` 岛屿图支持内陆河
- `src/game/world.js` 沼泽停留回合下沉接口 setMireTurns
- `src/battle/main.js` 点按格子能识别桥
- `src/app/main.js`、`tests/units-terrain.html` 测试页：沼泽停留回合按钮

## v5
- `src/art/terrain/desert-swamp/expansion-terrain.js` 沼泽按格指定道具（propVariant）
- `src/game/world.js` 沙漠每格不同高度、沼泽道具随机与站位深浅
- `src/game/map-builder.js` 纯陆地图可建；新增「沙漠沼泽」测试图
- `src/app/main.js` 测试页地图列表加入「沙漠沼泽」
- `docs/ART_PACKAGES.md` 登记上面的改动

## v4
- 沙漠、沼泽接入战场（新增 `src/art/terrain/desert-swamp/` 三个文件；`world.js`、`map-builder.js`、`level1.js`、`src/battle/main.js` 等）
- 战场页不再显示版本号
