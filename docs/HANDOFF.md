# 方寸战线 · Gridmarch 交接开发文档

> 写于 0.74–0.80 窗口结束时（交付 **0.80**）。更早窗口：0.50–0.59、0.60–0.64、0.65–0.73。**新窗口从 0.81 起，小改动 +0.01。**
> 本文只写「现状 + 已定决定 + 风险 + 下一步」，不写流水账；逐版本改动看 `docs/CHANGELOG.md`。标记：【已定】你明确决定　【暂定】我先放的值　【待定】要你拍板　【未验证】没有真机确认

## 0. 新窗口开机清单
1. 上传**整个仓库 zip**（不会被读进对话，我按需解压），说一句本轮目标，并告诉我 GitHub 上现在的版本（`index.html` 的 `GM_VERSION`）。
2. 我先读本文；用到才读 `docs/ARCHITECTURE.md`（结构与约定）、`docs/ART_PACKAGES.md`（美术包版本）、`docs/HOME.md`（主页）。`docs/archive/` 不读。
3. 跑 `npm test`（布局 / 水域 / 海岸 / 规则引擎 25 项 / 关卡适配器）确认起点是绿的。**冒烟测试只跑和本次改动相关的**（你定的，每版你自己会验收新特性）：`smoke-arsenal`（兵工厂 + 生产）、`smoke-endturn`（结束回合）、`smoke-stuck`（无事可做提醒）、`smoke-acted`（已行动 / 变灰）、`smoke-move`（选中 / 移动 / 撤销 / 待命）、`smoke-attack`（攻击 + 血量角标）、`smoke-capture`（占领）、`smoke-detail`（长按详细面板）、`smoke-fps`（画质页）、`smoke-loading`（加载条）。
4. **交付规则【已定，0.50 起】**：日常**只给升级包** `升级包_x到y.zip`（`tools/pack.mjs` 生成），你传 GitHub 根目录，机器人自动应用；**完整包 `Gridmarch_v0_X.zip` 只在本窗口彻底结束时给一次，或你说出意外时随时给**。每次交付：改完每个 js 先 `node --check` → 新增 / 删除 / 重命名 `src/` 下 js 后 `npm run stamp` → 更新 `docs/CHANGELOG.md` + `GM_VERSION` → `node tools/manifest.mjs <新版本>` 拍快照 → `npm test` → 相关冒烟 → `pack.mjs`，用 `&&` 串联，**别把测试输出接 `| tail`**（吞退出码）→ `present_files`。**升级包文件名必须以「升级包」开头，绝不能以 `Gridmarch_v` 开头**（机器人把后者当完整包，会清空仓库，0.50 出过事）。**打包前先删掉仓库目录里残留的旧升级包 zip**，否则会被当成新文件带进下一个包（0.76 出过）。改了 `.github/workflows/` 要手动传。
5. 本文只在你说「本轮结束」时更新一次；中途定下的重要决定你说「记下来」我先补一条。每个窗口约 10 次小迭代（你定的）。
6. 沟通：中文、手机阅读、先给结论、简短；需要真机看的东西单独列出，其余用 Node / 无头浏览器验证。做新视觉 / 交互时给 2–3 个方案让你选（菜单里做成可切换最有效，见 0.78 的占领表现）。

## 1. 项目与设备
- 回合制战棋（类《高级战争》，旧称钢铁经线），3D（Three.js r170）、iOS 独立 PWA、GitHub Pages、仓库 `Gridmarch`。设备只有 iPhone 17 Pro（横屏 874×402，竖屏锁定时用虚拟横屏）和 iPad 2025（真横屏 1180×820）。
- 第一阶段目标【已定】：同一设备双方轮流的「纯战斗」；11 种陆军；暂不做 AI、联机、天气、昼夜、迷雾、编辑器。
- 规则基准【已定】：参考 GBA《高级战争2》；无战争迷雾；取消指挥官改「军队风格」（先只做均衡型）；燃料 / 弹药 / 补给做成配置开关；每方单位上限 40；沼泽里地面单位回合结束掉 1 格血可致死。

## 2. 已定决策与现状

**技术 / 流程**
- ES 模块 + importmap；不做 Service Worker、不做离线单文件包；美术文件不手改。**整个游戏只有一个 `index.html`**：主页 `#homeView` 和战场 `#battle`（`src/battle/main.js`，点「单人对战」才载入）是两个视图，只改 `hidden` 不跳转（避免 iOS 边缘滑动手势）；`mountBattle / unmountBattle` 挂载 / 拆除；开发直达 `index.html?go=battle&seed=数字&debug=1`。
- 版本号只在 `index.html` 的 `GM_VERSION`（主页右下角显示，战场不显示）。`GM-BOOT` 给所有 js 加版本号绕开 iOS 死缓存；**新增 / 删除 / 重命名 `src/` 下 js 必须 `npm run stamp`**（0.78 新增 `gray.js` 时漏了，0.80 补上）。
- 本地存储键前缀 `gridmarch.`；素材放文件夹不内嵌代码；引擎代码里不得出现像素尺寸；测试页放 `tests/`、只调用 `src/` 正式文件。
- 全屏 / 安全区【已定】：`html,body` 用 `100vw × 100vh`，不用 dvh / `fixed; inset:0` / `height:100%` / `innerHeight`（iPhone 竖屏独立窗口里它们矮 62）；**完全不用 `env(safe-area-*)`**，竖屏浮层固定顶部 52px；左右留白 `--pad-l = max(5·sw, 56px)`。详见 §5 和你的 PWA 全屏指南。

**地形 / 美术 / 相机**
- 16 类地块；平原无模型（棋盘两色交替）；山 8 个面随机、不联结；沙漠 / 沼泽整格自带地表；坐标 y 向上、一格 2×2、格 `(cx,cz)` 中心 `(2cx,0,2cz)`、陆面 y=0 水面 −0.3 棋盘底 −1.6。棋盘无底座（要真实沙盘感）。
- 单位按兵种独立缩放（重坦约 0.8、步兵约 1.3）**系数【待定】**，等模型到齐在 `tests/units-terrain.html` 滑条里定。现在只有 6 个兵种有战场模型：步兵 / 反坦克兵 / 轻坦 / 中坦 / 重坦 / 自行火炮；侦察车、运输车、火箭炮、防空炮、防空导弹没有（兵工厂显示「未建模」、不能买）。道路用 R1，R2 未换。
- 相机：正交，固定俯角 55°（`world.state.pitchDeg`，测试页若改俯角要同步）；视距 5 / 7 / 9 / 11 = 屏幕短边方向的地面格数，双指自由缩放 3.5–11、松手吸附；90° 旋转 0.4 秒；旋转按钮缩放时临时显示视距数字。

**第一关（`src/game/levels/level1.js`）**：20×12，红蓝左右镜像（蓝在西），随机只在蓝半边再镜像；种子决定水域 / 河 / 桥 / 基地 / 城市 / 公路 / 山 / 沙漠 / 沼泽 / 树林；红蓝总部各 2 座兵工厂，中立 2 大城市 + 6 小城市；不带参数每次新随机种子。开局 `START`【暂定】：资金 0，每方步兵×2 + 反坦克兵 + 轻坦，蓝方领第 1 天收入 3000。

**规则引擎（`src/rules/`，纯数据 + 纯函数，不碰 DOM / three）**
- `data.js` 改数字只改这里：11 个陆军 `UNITS`、17 种地形 `TERRAINS`、高战2 伤害表、`CONFIG`、军队风格。反坦克兵引擎 id 仍是 `mech`。防空导弹 `buildable:false`（对陆军无目标）。
- **血量**【已定】：内部 0–100 整数，**显示 = `ceil(hp/10)` 格**；伤害公式 `基础 × 攻方系数 × (攻方显示血量/10) × (200 − (守方系数×100 + 地形星×守方显示血量))/100` 向下取整，再从内部血量里扣；威力 / 减伤 / 占领速度都按格数。面板显示 `87/100`，战场角标显示格数。
- 收入【你 0.41 改】：总部 / 大城市 / 兵工厂 / 机场 / 船坞每回合 1000，小城市 700。造价【暂定】沿用高战2 微调：步兵 1000 … 重坦 20000。`produce` 只能在自己的兵工厂，每座每回合 1 个，新单位本回合不能动。
- **占领【已定，0.77】**：`engine.js` 的 `canCapture / capture`。步兵 / 反坦克兵站在不属于自己的建筑（中立或敌方，所有可占领建筑）上选「占领」，累加**显示血量格数**的点（满血 +10），到建筑占领点数（20）易主；占领 = 本回合行动结束；站着不动下回合接着占；走开 `move` 到别格进度清零（`u.cap`），`undoMove` 还原；易主后收入 / 兵工厂资格立刻归新主人。**占领对方总部 = 直接获胜**（`CONFIG.hqWin`，默认开）。
- 其余：移动 / 攻击 / 反击 / 弹药 / 沼泽掉血 / 回合 / 歼灭胜负；`pathOf / undoMove / canProduce / forecast`。**还没有**：合流、补给燃料（`CONFIG.fuel` 关）、修理、运输、单位上限。适配器 `src/game/engine-map.js`：`createGameFromPreset(preset)` → `{game, specs, toEngine, toWorld}`；玩家 0 蓝先手、1 红；引擎坐标 = 世界格坐标 − 棋盘左上角。

**界面风格【暂定，一直在用】**：B「玩具盒」——奶油底 `#fff6dc` + 深色粗边 `#2d3e55` + 军队色细条 + 斜体价格牌 + 橙色按钮；明亮低多边形，不照搬高战 2D 立绘；全纯 CSS（`index.html` 保持苗条）。`tests/ui-style.html` 留作对照。所有常用操作不要埋进暂停菜单。

**兵工厂界面（`arsenal.js`）**：点当前回合方兵工厂弹出两个悬浮玩具盒；左「选兵种」（卡片列表，自己处理滑动 + 惯性，因为虚拟横屏下原生滚动不可靠）、右「展示」（战场同一个 renderer 的 viewport + scissor 小场景，三点布光，双指缩放 / 平移，双击复位）。点卡片 = 价格签变橙色生产钮，再点才买；买不起灰色；生产后自动关面板。主副炮按大类列出，阈值 `WEAPON_LIST_MIN = 30`【暂定】。

**战场界面（`src/battle/main.js` + `battle.css`）**
- 左上状态条 `第 N 天 | ● 回合方 | 资金`，点 = 结束回合（弹确认条；本方全部行动完状态条脉冲，**没有有效操作时才自动弹确认**）；右上旋转 + 暂停菜单。暂停菜单：继续 / 画质 / 换边（仅画面被旋转时）/ 换图 / 返回主页。**画质页**：帧率小标（绿 ≥50 / 黄 40–49 / 橙 30–39 / 红 <30 / 灰 = 静止）、作战动画开关、**血量角标左移**（0 / 25 / 40 / 50%，默认 40，`gridmarch.hpTuck`）。
- 点格 = 简要面板（左下，光圈对侧）：单位卡（血量条 `N/100`、燃料、弹药）+ 地形卡（防御星、归属、占领进度）；**长按约 0.45 秒 = 详细面板**（`detail.js`，两个盒子：单位盒 + 地形盒，点一项看说明 `explain.js`，点暗处关闭；血条 = **10 格斜切槽，每格 10 点**）。换回合大横幅约 1.7 秒（底边阵营色线保留与否【待定】）。
- **单位操作【已定，高战式】**：点己方未行动单位 → 蓝色范围格 → 点蓝格走（点脚下 = 原地）→ 走完出浮条：「占领」（站在可占领建筑上才出）/「攻击」（射程内有敌人才出）/「待命」；撤销移动 = 点浮条外空白；攻击 = 红格上直接标预估（大字伤害、小字反击，会击破标红），点哪个直接打，规则立刻结算、画面按序演（转向开火 → 飘字 / 缩小消失 → 反击）。范围格 = 涟漪着色器（蓝紫 / 红）+ 整个场景压暗（可接受）。胜利只有横幅，**没有结算界面**。

**战场视觉表现（0.74–0.80）**
- **血量角标**：显示血量 < 10 才出现，右下角精灵（深蓝底牌，7–9 白 / 4–6 黄 / 1–3 红），数字按字形包围盒居中；位置贴**模型包围盒最右下角**再夹在本格内（`hpPlace`，模型大到占满格时压在模型上、不越界），随镜头旋转 / 模型朝向 / 缩放实时算；视距超过 9 格时按 `hpK = max(1, 视距/9)` 放大，屏幕上不小于 9 格时的大小（`world.setHpView`，视距变化在 `hud()` 里触发）。
- **已行动 = 变灰**【已定】：单位行动完慢慢变灰 + 压暗（`src/art/gray.js` 注入去饱和着色器；坦克 / 火炮材质每单位独有走 uniform，步兵 / 反坦克兵是实例化批量绘制、材质全队共享，走每实例 `instanceColor.r`，`anti-tank-batch.js` 里写）。**只有当前回合方的已行动单位变灰**（`syncActed`：`acted && owner === game.turn`），点结束回合后全部复色；脚下灰环已去掉。
- **占领表现【已定：只留头顶条】**：建筑头顶一条连续进度条（`10/20`，不分格），常驻宽度 1.8（≈ 一格），占领动画 = 弹大到 2.0 倍 → 灌条 → 缩回；占满 = 灯带闪白换色 + 冲击波 + 「占领成功！」；占领中灯带颜色按进度渐变。进度来自引擎 `u.cap`，`syncCaps()` 在每次 `syncActed()` 里同步（单位走开 / 被打死 / 占完自动清掉）。脚下环、地块 + 建筑从左到右染色这两种样式的代码还在（`world.setCapStyle('ring'|'wipe'|'combo')`），当前不开放；染色依赖渲染器 `localClippingEnabled`。
- world API（调试 `window.battle = {world, cam, preset, THREE, game, describe, detail, produce, hud, mark, toWorld, toEngine, state()}`）：`setActed / setHp / setHpView / setCapStyle / setBuildingOwner / setCaptureMarks / playCapture / unitById / busy / showRange / showTargets / clearRange / moveAlong / placeAt / pulseRange / playAttack / removeUnit / addUnit`。

## 3. 仓库地图
```
index.html home.js home.css manifest.webmanifest package.json README.md   主页 + 战场容器（根目录）
tests/       units-terrain.html（定单位大小）、orientation.html（虚拟横屏诊断）、ui-style.html（风格对照）
src/
  art/       程序化美术（整体替换，不手改）：water/ terrain/ units/ palette.js、gray.js（0.78 已行动变灰着色器）
  game/      集成层：engine-map.js、world.js（世界 + 单位 + 各种表现）、map-builder.js、levels/、units/
  rules/     规则引擎：data.js、combat.js、engine.js
  battle/    战场：main.js、arsenal.js、detail.js、explain.js、showcase.js、tile-block.js、unit-models.js、unit-info.js、loading.js、cursor.js、camera.js、stage.js、battle.css
  app/       测试页的 UI；vendor/ three.js r170
tools/       check-*.mjs（npm test）、smoke-*.py（无头浏览器冒烟，不在 npm test）、stamp / manifest / pack / apply-package
.github/workflows/   checks.yml、apply-package.yml        docs/   本文、ARCHITECTURE、ART_PACKAGES、HOME、CHANGELOG、manifests/、archive/
assets/      title / home / icons 等（`assets/_src` PNG 母版和 `assets/splash` iPad 启动图不在仓库：打成 `素材备份_src与splash.zip` 放 `.github/workflows/`，机器人不碰；恢复方法见 docs/HOME.md；iPad 开机一瞬间白屏你接受）
```

## 4. 工具与验证
- `npm test`；`npm run stamp`；`node tools/manifest.mjs <版本>`；`node tools/pack.mjs <你的版本> <新版本> [notes.json] [输出.zip]`（按快照比对，你跳几个版本都能一次升到最新）。**快照只保留最近 10 个**（你定的）：现留 0.71–0.80；窗口结束整理时精简，完整包会让仓库同步删掉多余的。版本号：小改动 +0.01，一个窗口约 10 次。
- 手机更新：把 zip 传仓库根目录，`apply-package` 解压覆盖、按 `_delete.txt` 删文件、删 zip；完整包会让仓库与包完全一致。GitHub 的 `checks` 在你上传 zip 的那次提交上必红（zip 还没解开），要看的是 `gridmarch-bot` 提交后的那一条。
- **无头浏览器验证**：容器里有 Python Playwright + 无头 Chromium（`--use-gl=swiftshader`）。起服务 `python3 -m http.server 8099 &`——**它会随命令结束退出，每条命令里自己起、自己 kill**；`page.goto('http://localhost:8099/index.html?go=battle&seed=7')`。投影格子到屏幕：`new THREE.Vector3(cx*2, world.surfaceY(cx,cz)+.1, cz*2).project(cam.cam)`；移动相机后 `cam.clampTarget(); cam.place()`；对准某格 `battle.cam.target.x/z = …; battle.mark()`。软件渲染很慢（一个冒烟约 30–140 秒），**单条命令别连跑超过 2–3 个**（300 秒会被杀）；输出含中文时用 ASCII 安全方式打印；拖镜头别逐步 `mouse.move`（会被当长按），用页内 `dispatchEvent(new PointerEvent(...))`。

## 5. 虚拟横屏（iPhone 不能锁横屏）
`src/battle/stage.js`：系统横屏就原样，系统竖屏就把舞台转 90°，配合控制中心「竖屏方向锁定」= 锁死横屏；`side` 记灵动岛在左 / 右（`gm.stageSide`，主页 / 战场共用，「换边」仅战场出现）；触摸坐标经 `stage.toLogical / stage.vec`，尺寸用 `stage.w/h`，CSS 用 `var(--sw)/var(--sh)`。状态栏图标在虚拟横屏下以竖屏文字方向显示——【已结案】接受现状。排查工具：战场「换边」长按 0.8 秒 = 现场诊断；`tests/orientation.html`。

## 6. 未验证 / 风险
1. **0.65–0.80 的战场操作和表现没有真机确认的**：选中 / 浮条 / 撤销 / 红格点按手感、伤害预估牌互相遮挡、涟漪 + 压暗的帧率发热、开火动画顺序、**已行动变灰的着色器在 iPhone 上的性能**（给坦克 / 火炮 / 实例化步兵的材质打了补丁）、头顶占领条在密集城市里的观感。无头浏览器只能证明「流程走通、不报错」，证明不了手感 / 发热 / 掉帧。
2. 机场、船坞（第一关没有）与河的光圈没实测；光圈 / 涟漪时约 30 帧/秒重画的耗电没测。
3. 没有战场模型的 5 个兵种造出来看不见（所有流程已防空）；沼泽致死的单位引擎删了、战场没摘（`world.removeUnit` 已有，没接）；胜利后规则层不再允许操作，但没有结算界面。
4. 语言：主页有中英文，战场 / 兵工厂 / 单位地形名全是写死中文。`explain.js` 说明文字还没逐条审（你说后期慢慢收敛）。
5. 加载进度条后半段是估计值；页面首次打开的白屏没处理；河 / 浅滩 / 断崖地块是临时拼的；iPad 尺寸下详细面板排版没验证；视距 11 的阴影精度没看。

## 7. 待你决定
1. 界面风格确认 B；单位大小系数；沙漠 / 沼泽 / 断崖移动与防御草案、造价。
2. 防空导弹对地能力 / 等空军再放开；军队风格要几种；沼泽「每回合多沉」是否启用。
3. 横幅底边阵营色线保留与否；撤销移动是否要远离「待命」的专用钮；伤害预估牌样式；压暗保留与否。
4. 胜利结算界面怎么做；语言包何时抽出（建议外挂 `src/i18n/zh.js / en.js`，等主流程定型）。
5. 占领的其他细节：占领中被打 / 被攻击是否影响进度（现在只看自己血量格数）；是否要「点建筑看占领进度」之外的提示。

## 8. 下一步路线图（建议顺序）
1. 对战做完整：**胜利结算界面** → **其余单位模型接入战场**（侦察车 / 运输车 / 火箭炮 / 防空炮，否则造出来看不见）→ 沼泽致死接 `removeUnit` → **简单 AI**（红军「走向最近敌人并攻击」）。
2. 合流（`joinRefund` 0.9）、补给 / 燃料开关、修理。
3. 选图页（接主页「单人对战」）、地图 JSON 导出、存档（`gridmarch.save`）。
4. 小项：语言包、道路换 R2、防空炮 / 防空导弹建模、第一关加地形多样性、外海 LOD。

## 9. 教训（省额度）
1. 没有证据别改正式页面：先在测试页 / 菜单里做对照开关，让你一次试完再并回；排查开关别存 `localStorage`。
2. 凡「铺到屏幕底」都查是否用了 `innerHeight / height:100% / fixed; inset:0`；不用 `env(safe-area-*)`；测试页单独加到主屏幕要自带 iOS 全屏 meta。
3. `groundY`（单位站位高度，山体返回山顶）≠ `baseY`（山脚）≠ `surfaceY`（任意点可见表面）；画贴地的东西用 `surfaceY`。
4. **改完每个 js 先 `node --check`；注释永远另起一行，别接在代码行末**：行内 `//` 会把同一行后面的代码一起吃掉（0.63 模块解析失败；**0.79 占领条的定位语句被吃掉，所有条堆在原点**）。
5. **断言要覆盖位置 / 数值，不只是「存在」**（0.79 的 bug 就因为测试只查了条存在）。`npm test` 不跑浏览器，抓不到运行时错误；改了界面脚本一定跑相关冒烟。
6. **新增 / 删除 / 重命名 `src/` 下的 js 必须 `npm run stamp`**（0.78 漏过）。
7. **打包**：命令用 `&&` 串联、不接 `| tail`；仓库目录里不能留旧升级包 zip（会被当新文件带进下一个包，快照也会记下它）；升级包文件名以「升级包」开头；发布文件必须 `present_files`；增量包漏传一个会半新半旧，拿不准就给完整包；先读 `pack.mjs` / 本文惯例再交付。
8. 容器里读中文文件别用 `cut -c / head -c`（切断 UTF-8），用 Python 切片；不要 `pkill -f` / `pgrep -f` 带自己命令行里的字；同时跑两个无头浏览器会互相拖慢（假象卡死）；静态服务随命令结束退出，每条命令自己起；一条命令别跑太多完整测试。
9. 无头浏览器截动画别靠 `wait_for_timeout` 对时间（软件渲染帧很慢）；iOS 真机上帧动画 / 多元素 opacity 关键帧和桌面不一样（0.65 回滚）——新动画先在真机验证最小版本。动画只动 `transform / opacity`（`left`、`border`、斜切 + 动画同元素在 iOS 上闪）。
10. 虚拟横屏里原生滚动不可靠（`touch-action` 按物理屏幕算），要自己处理滑动；DOM 要透出 WebGL 画布，窗口的所有祖先都不能画底色；带 `display` 的元素 `hidden` 会失效，补 `[hidden]{display:none}`。
11. 拖镜头走 `cam.pan` 不触发 `cam.update`：跟着相机 / 单位走的 DOM 要在每次出帧后重新定位；按需渲染 + 持续动画要在主循环自己 `dirty = true` 并限帧，帧率统计要排除节流帧；视距变化的钩子在 `hud()` 里，测试里直接改 `cam.cells` 不会触发，要派发一个 wheel 事件。
12. `ShaderMaterial` 不做色彩空间转换（颜色直接写 sRGB `Vector3`）；`THREE.Color(hex)` 会转线性。
13. **性能层把建筑零件合并成 2 个网格**（车身 + 灯带），复制 / 染色建筑要复制「可见网格」而不是整棵树；**步兵 / 反坦克兵是实例化批量绘制、材质全队共享**，逐单位效果走实例属性（`instanceColor`），不能改材质。
14. 测试里改状态走引擎同一条路径（`createGame` 开局先结算收入，测试资金要建完后再改；摆单位用 `world.placeAt` + 改引擎坐标一起）；新功能顺手挂 `window.battle` 钩子，冒烟测试不靠点屏幕位置；规则模块可在页面里 `await import('/src/rules/data.js')`。
15. 先查仓库再说「有 / 没有某个资产」（0.61 说错过 6 个 vs 11 个模型）；提点子先读现有代码再设计；第三方美术函数参数不一定生效，先量包围盒。
16. 触屏上别做「点目标 → 弹预估 → 再确认」；做新交互 / 视觉先给 2–3 个方案让你选。
