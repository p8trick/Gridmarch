# 更新记录（每次交付改了哪些文件）

> 用途：你跳过了某几个版本时，告诉我你现在的版本，我用 `docs/manifests/` 里的快照一键生成升级包；也可以自己把「你现在的版本之后」每一版的文件取并集。
> 每次交付的更新包里也有 `更新说明.md`，写的是相对上一版的改动；累计包会注明"从 vN 升级"。
> 更新后别忘了把 `index.html` 里的 `GM_VERSION` 加一位（避开手机旧缓存）。

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
