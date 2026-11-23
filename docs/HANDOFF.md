# 方寸战线 · Gridmarch 交接开发文档

> 写于 0.81–0.90 窗口结束时（交付 **0.90**，完整包）。**新窗口从 0.91 起，小改动 +0.01，新日志从 `docs/CHANGELOG.md`（0.91 起）写；0.90 及以前的日志在 `docs/archive/CHANGELOG_至0.90.md`，不用读。**
> 只写「现状 + 已定决定 + 风险 + 下一步」；标记：【已定】你明确决定　【暂定】我先放的值　【待定】要你拍板　【未验证】没有真机确认

## 0. 新窗口开机清单
1. 你上传**整个仓库 zip**（不进对话，按需解压）+ 一句本轮目标 + GitHub 上现在的版本（`index.html` 的 `GM_VERSION`）。
2. 我先读本文；用到才读 `docs/ARCHITECTURE.md` / `ART_PACKAGES.md` / `HOME.md`；`docs/archive/` 不读。**日志只读 `docs/CHANGELOG.md` 最上面几十行或干脆不读**；增量更新日志是脚本在固定位置插入，不会把整份读进上下文，每条写 5–8 行即可。
3. 跑 `npm test`（布局 / 水域 / 海岸 / 规则 33 项 / 关卡适配器）确认起点是绿的。**冒烟只跑和本次改动相关的**（见 §4）。
4. **交付规则【已定】**：日常只给升级包 `升级包_x到y.zip`（`tools/pack.mjs`），你传 GitHub 根目录，机器人自动应用；**完整包 `Gridmarch_v0_XX.zip` 只在本窗口彻底结束时给一次，或你说出意外时随时给**（完整包 = 仓库目录全部文件打 zip，含 `.github/`，不含 node_modules / .git / 其他 zip）。每次交付：改完每个 js 先 `node --check` → 新增 / 删除 / 重命名 `src/` 下 js 后 `npm run stamp` → 写 `docs/CHANGELOG.md` + 改 `GM_VERSION` → `node tools/manifest.mjs <新版本>` → `npm test` → 相关冒烟 → `node tools/pack.mjs <你的版本> <新版本> notes.json "<输出>/升级包_x到y.zip"`，用 `&&` 串联，**别把测试输出接 `| tail`**（吞退出码）→ `present_files`。**升级包文件名必须以「升级包」开头，绝不能以 `Gridmarch_v` 开头**（机器人当完整包会清空仓库）；打包前删掉仓库目录里残留的旧 zip。改了 `.github/workflows/` 要手动传。**快照 `docs/manifests/` 只保留最近 5 个**（现留 0.86–0.90；你说 10 个、5 个都行）。
5. 每个窗口约 10 次小迭代（你定的）；本文只在你说「本轮结束」时更新一次。
6. 沟通：中文、手机阅读、先给结论、简短；需要真机看的东西单独列出；做新视觉 / 交互给 2–3 个方案让你选。

## 1. 项目与设备
- 回合制战棋（类《高级战争》，旧称钢铁经线），3D（Three.js r170）、iOS 独立 PWA、GitHub Pages、仓库 `Gridmarch`。设备：iPhone 17 Pro（横屏 874×402，竖屏锁定用虚拟横屏）、iPad 2025（1180×820）。
- 第一阶段目标【已定】：同一设备双方轮流的纯战斗；11 种陆军；暂不做 AI、联机、天气、昼夜、迷雾、编辑器。规则基准：GBA《高级战争2》；无迷雾；燃料 / 弹药 / 补给做成配置开关。

## 2. 已定决策与现状
**技术**：ES 模块 + importmap；美术文件（`src/art/`）不手改；整个游戏只有一个 `index.html`（主页 `#homeView` + 战场 `#battle`，只改 `hidden` 不跳转）；开发直达 `index.html?go=battle&seed=数字&units=1&debug=1`（**`&units=1` 才给每方 4 个起始单位，默认开局没有单位**）。版本号只在 `GM_VERSION`；`GM-BOOT` 给所有 js 加版本号，**增删改名 `src/` 下 js 必须 `npm run stamp`**。本地存储键前缀 `gridmarch.`（`hpTuck`、`camCells` 视距、`stageSide` …）。全屏 / 安全区【已定】：`100vw × 100vh`，不用 dvh / `inset:0` / `env(safe-area-*)`。

**地形 / 相机**：16 类地块；坐标 y 向上、一格 2×2、格 `(cx,cz)` 中心 `(2cx,0,2cz)`、陆面 0 水面 −0.3。正交相机俯角 55°，视距 5 / 7 / 9 / 11 格，双指自由缩放 3.5–11 松手吸附，**视距自动保存、默认 7**；镜头 `panTo` 平滑平移。目前只有步兵 / 反坦克兵 / 轻坦 / 中坦 / 重坦 / 自行火炮 6 个兵种有战场模型，侦察车 / 运输车 / 火箭炮 / 防空炮 / 防空导弹没有（兵工厂「未建模」不能买）。单位缩放系数【待定】。

**第一关（`levels/level1.js`）**：20×12，种子决定一切。**基地 / 城市 / 公路 / 河 / 起始部队 / 中央大湖仍左右镜像（公平）；山 / 沙漠 / 沼泽 / 树林、「两池」、「贴上缘或下缘的海湾」东西两边各自独立**（0.85）；水域占比：矩形湖 30 / 不规则湖 20 / 两池 15 / 贴边海湾 25 / 无湖 10；河会拐弯（0.84）。`makeLevel1(seed, {army})`，默认 `START.army=[]`，`TEST_ARMY` 给测试。同一个种子在不同版本地图不同。

**规则引擎（`src/rules/`，纯函数，不碰 DOM）**：`data.js` 改数字只改这里（`UNITS` / `TERRAINS` / 伤害表 / `CONFIG`）。
- 血量内部 0–100，显示 `ceil(hp/10)` 格；伤害公式按显示格数；收入：总部 / 大城市 / 兵工厂 / 机场 / 船坞 1000，小城市 700；`produce` 只能在自己的兵工厂，每座每回合 1 个，新单位本回合不能动。**每方单位上限 40**（`maxUnits`，满员点兵工厂弹提示、不开生产界面）。
- **占领**：步兵类站在非己方建筑上累加显示血量格数的点（20 易主），走开清零；**占领对方总部 = 直接获胜**。
- **回合开始（`endTurn` 内，轮到的这一方）**：先收入 → **修理 / 补给**（站在己方总部 / 城市 / 兵工厂上的陆军 +20 点血，修理费 = 造价×点数/100，钱不够就跳过，弹药燃料补满）→ **沼泽掉血**（站沼泽的陆军掉 1 格，可致死；**自己结束回合不扣，轮回自己时才扣**）。返回 `{income, fundsBefore, repairs, repairCost, swamp}` 给战场演动画。
- **合流（0.89–0.90）**：同类型友军走到**血量没满的同类型友军**格上，浮条只有「合流」；血量相加最多 100，**超出部分按造价折资金退还**（`joinRefund`），弹药燃料相加；移动的单位消失，**合流后的单位本回合行动结束（`moved = acted = true`）**；停在合流格上结束回合会自动退回。`CONFIG.join` 可关。
- 胜负：占领总部；**全歼只对「生产出过单位」的一方生效**（`everHad`，零单位开局不会被判）。还没有：补给燃料（`CONFIG.fuel` 关）、运输。适配器 `src/game/engine-map.js`；玩家 0 蓝先手、1 红。

**战场界面（`src/battle/main.js` + `battle.css`）**
- 左上状态条 `第 N 天 | ● 回合方 | 资金`，点 = 结束回合；右上三个按钮（找单位 / 旋转 / 暂停菜单，间距 12px）。**找单位按钮**：准星图标、数字 = 本方未行动单位数（放在圆圈里，>99 显示 99，0 变灰）；点一下镜头平移到某个未行动单位，按编号轮流，**轮完一圈再点回到开始前的位置**。
- **每方记住自己的镜头位置**：结束回合存下，换边后平移到对方上次的位置（红军第一回合去自己总部附近）。
- 点格 = 简要面板；**长按 ≈0.45 秒 = 详细面板**。单位操作（高战式）：点己方未行动单位 → 蓝格 → 点蓝格走 → 浮条「合流 / 占领 / 攻击 / 待命」（按钮间距 12px）；撤销 = 点浮条外空白；攻击 = 红格直接标预估。胜利只有横幅，**没有结算界面**。
- **回合开始动画（0.81）**：横幅滑出时 → 状态条下方飘「+收入」、资金滚上去 → 在己方建筑上回血的单位同时飘绿色「+N」、沼泽单位飘红色「−1」（被攻击的伤害字是金黄色）、状态条下方飘「−修理费」资金滚下来；期间 `econBusy` 挡操作；关了「作战动画」直接到账。合流退款同一套。短提示 `toast`（元素 id `gmToast`，页面里已有别的 `#toast`，不能重名）。
- 移动速度 `SPEED`（world.js）= 原来的 1.8 倍（步兵 5.4）；血量角标步兵 / 反坦克兵用与朝向无关的圆柱定位。**已行动变灰**只对当前回合方；占领表现只留头顶条。
- 水格 / 河格点击光圈：海面整格平 → 常数；河格有堤岸高差 → 每格只采一次 5×5 网格并缓存、双线性插值（`waterShape`）；海岸格（浅滩 / 断崖）单位站位尽量贴格心（`coastOffset`，加载时一次算好，断崖陆军可站、`noNaval`）。
- 步兵 / 反坦克兵是**实例批**绘制，批只有 `addUnit` 没有 remove：单位被拿掉必须 `releaseInfantryActor`（`disposeUnit` 已接），actor 进空闲池复用；批容量 `CAPACITY=80`（每类，累计加入数，不是存活数）。

**界面风格【暂定】**：B「玩具盒」——奶油底 `#fff6dc` + 深色粗边 `#2d3e55` + 橙色按钮；全纯 CSS。兵工厂界面 `arsenal.js`：左选兵种卡片、右展示（同一 renderer 的 viewport + scissor）；点卡片 = 价格签变生产钮，再点才买。

**调试钩子** `window.battle = {world, cam, preset, THREE, game, describe, detail, produce, hud, mark, toWorld, toEngine, toast, state()}`；world API：`setActed / setHp / setHpView / unitById / busy / showRange / moveAlong / placeAt / playAttack / removeUnit / addUnit / surfaceY / water …`。

## 3. 仓库地图
```
index.html home.js home.css manifest.webmanifest package.json README.md   根目录
tests/   units-terrain.html orientation.html ui-style.html
src/  art/（程序化美术，不手改）  game/（world.js engine-map.js map-builder.js levels/ units/）  rules/（data.js combat.js engine.js）
      battle/（main.js arsenal.js detail.js explain.js showcase.js camera.js cursor.js stage.js loading.js battle.css …）  app/  vendor/three r170
tools/  check-*.mjs（npm test）  smoke-*.py（无头浏览器冒烟）  stamp / manifest / pack / apply-package
.github/workflows/  checks.yml apply-package.yml        docs/  本文 ARCHITECTURE ART_PACKAGES HOME CHANGELOG manifests/ archive/
assets/  title / home / icons（`assets/_src` 母版和 `assets/splash` 不在仓库，见 docs/HOME.md）
```

## 4. 工具与验证
- `npm test`；`npm run stamp`；`node tools/manifest.mjs <版本>`；`node tools/pack.mjs <你的版本> <新版本> [notes.json] [输出.zip]`。GitHub `checks` 在你上传 zip 的那次提交上必红，看 `gridmarch-bot` 之后那条。
- **冒烟（都要先起服务、网址带 `&units=1`）**：`smoke-arsenal`（兵工厂生产）`endturn`（结束回合）`stuck`（无事可做提醒）`acted`（已行动变灰）`move`（选中 / 移动 / 撤销 / 待命）`attack`（攻击 + 角标）`capture`（占领）`detail`（长按面板）`economy`（收入 / 修理动画）`swamp`（沼泽动画）`coast`（海岸站位 / 角标 / 浮条间距）`next`（无单位开局 / 找单位 / 视距 / 间距）`cap`（单位上限 / 提示 / 镜头记忆，较慢）`join`（合流 / 残影 / 批容量）`fps` `loading`。
- **无头浏览器**：容器里有 Python Playwright + 无头 Chromium（`--use-gl=swiftshader`）。**静态服务随命令结束被杀：每条命令里 `(setsid nohup python3 -m http.server 8099 >/dev/null 2>&1 &); sleep 1;` 自己起**。**软件渲染连续出帧只有约 2 帧/秒**（0.80 也是），飘字只活 1.3 秒、动画要几十秒：等待用 `wait_for_function(..., polling=100)` + MutationObserver 记录，别靠 raf 轮询 / `wait_for_timeout` 对时间；**单条命令别跑超过 300 秒**（`cap` 要 ~200 秒单独跑）。点屏幕：先把镜头对准目标（`cam.target.x/z = 世界格×2; mark()`），再用 `THREE.Vector3(cx*2, world.surfaceY(cx,cz), cz*2).project(cam.cam)` 算像素；默认镜头下单位可能在屏幕外或压在界面下，测试不能靠运气。
- 拖镜头别逐步 `mouse.move`（会被当长按），用页内 `dispatchEvent(new PointerEvent(...))`。

## 5. 虚拟横屏（iPhone 不能锁横屏）
`src/battle/stage.js`：系统竖屏就把舞台转 90°，配合「竖屏方向锁定」= 锁死横屏；`side` 记灵动岛在左 / 右（`gm.stageSide`）；触摸坐标经 `stage.toLogical / stage.vec`，尺寸用 `stage.w/h`，CSS 用 `var(--sw)/var(--sh)`。排查：战场「换边」长按 0.8 秒 = 现场诊断；`tests/orientation.html`。

## 6. 未验证 / 风险
1. 0.81–0.90 的**真机手感**（回合开始动画节奏、移动提速、合流操作、找单位按钮、各方镜头记忆）只有无头浏览器证明流程走通。
2. **选中单位后点「能走到的同类型残血友军」= 合流移动，不再是切换选中**（想选那个友军要先点别处）；如果不顺手可改成长按 / 确认。
3. 断崖防御星暂定 0（与浅滩一致）；水格 5×5 插值在堤岸陡坡最大误差 0.11（光圈是装饰，够用）；机场 / 船坞没实测。
4. 没有战场模型的 5 个兵种造出来看不见；沼泽扣死的单位战场里会拿掉（0.83 起）；胜利后没有结算界面。
5. 语言：主页中英文，战场全是写死中文；`explain.js` 说明文字没逐条审；加载进度条后半段是估计值。

## 7. 待你决定
1. 单位大小系数；造价；沙漠 / 沼泽 / 断崖移动与防御草案；防空导弹对地能力；军队风格要几种。
2. 河也要左右不对称吗（现在河仍镜像：公路要两边都通）；合流点选交互是否要改。
3. 胜利结算界面怎么做；语言包何时抽出（建议外挂 `src/i18n`）。

## 8. 下一步路线图（建议顺序）
1. 对战做完整：胜利结算界面 → 其余单位模型接入战场（侦察车 / 运输车 / 火箭炮 / 防空炮）→ 简单 AI（红军走向最近敌人并攻击）。
2. 补给 / 燃料开关、运输（浅滩让运输船登陆已预留）。
3. 选图页、地图 JSON 导出、存档（`gridmarch.save`）。
4. 小项：语言包、道路换 R2、外海 LOD。

## 9. 教训（省额度）
1. 没有证据别改正式页面：先做对照开关让你试完再并回。
2. **注释永远另起一行，别接在代码行末**：行内 `//` 会把同一行后面的代码一起吃掉（0.63、0.79、0.84、0.90 都栽过，0.90 这次让合流的 actor 回收一直没生效）。改完每个 js 先 `node --check`。
3. **断言要覆盖位置 / 数值，不只是「存在」**；`npm test` 不跑浏览器，抓不到运行时错误，改了界面脚本一定跑相关冒烟；换了随机序列（改关卡生成）后，依赖屏幕位置的冒烟会点空，要先让镜头对准目标。
4. 性能：查「卡顿」先量——`water.surfaceAt` 在水里一次 3–5ms、陆地 0.5ms，别整格铺满采样、别点击时现算；不要用「进场景后逐格预热」（会拖慢开局动画）。
5. `groundY`（单位站位高度）≠ `baseY`（山脚）≠ `surfaceY`（任意点可见表面）；贴地的东西用 `surfaceY`。
6. 容器里读中文文件别用 `cut -c / head -c`（切断 UTF-8），用 Python 切片；**不要 `pkill -f` / `pgrep -f` 带自己命令行里的字（会杀掉自己的 shell）**；同时跑两个无头浏览器会互相拖慢。
7. 打包：`&&` 串联、不接 `| tail`；仓库目录里不能留旧 zip；发布文件必须 `present_files`；增量包拿不准就给完整包。
8. iOS：动画只动 `transform / opacity`；虚拟横屏里原生滚动不可靠；带 `display` 的元素 `hidden` 会失效，补 `[hidden]{display:none}`；拖镜头走 `cam.pan` 不触发 `cam.update`。
9. 步兵 / 反坦克兵是实例批、材质全队共享：逐单位效果走实例属性；新增单位生命周期代码要想到「批只增不减」。
10. 测试里改状态走引擎同一条路径（`createGame` 开局先结算收入，资金要建完后再改；摆单位用 `world.placeAt` + 改引擎坐标一起）；新功能顺手挂 `window.battle` 钩子；页面 id 先查重（`#toast` 撞过）。
11. 先查仓库再说「有 / 没有某个资产」；提点子先读现有代码再设计；触屏上别做「点目标 → 弹预估 → 再确认」。
