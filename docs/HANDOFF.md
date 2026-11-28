# 方寸战线 · Gridmarch 交接开发文档

> 写于 1.01–1.09 窗口结束时（交付 **1.09**，完整包 `Gridmarch_v1_09.zip`）。**新窗口从 1.10 起，小改动 +0.01，日志写 `docs/CHANGELOG.md`（1.01 起）；旧日志在 `docs/archive/`，不用读。**
> 只写「现状 + 已定决定 + 风险 + 下一步」；标记：【已定】你明确决定　【暂定】我先放的值　【待定】要你拍板　【未验证】没有真机确认

## 0. 新窗口开机清单
1. 你上传**整个仓库 zip** + 一句本轮目标 + GitHub 上现在的版本（`index.html` 的 `GM_VERSION`）；要导入模型就同时上传模型 zip。
2. 先读本文；用到才读 `docs/ARCHITECTURE.md`（§11 是 0.91–1.00 新模块）/ `ART_PACKAGES.md` / `HOME.md`；日志不用读。
3. 跑 `npm test`（布局 / 水域 / 海岸 / 规则 38 项 / 关卡适配器 / 语言包）确认起点是绿的；**冒烟只跑和本次改动相关的**（§4）。
4. **交付规则【已定】**：日常只给升级包 `升级包_x到y.zip`（`tools/pack.mjs`），传 GitHub 根目录，机器人自动应用；**完整包 `Gridmarch_vX_XX.zip` 只在本窗口彻底结束时给一次，或你说出意外时随时给**。每次交付：改完每个 js 先 `node --check` → 增删改名 `src/` 下 js 后 `npm run stamp` → 写 `docs/CHANGELOG.md` + 改 `GM_VERSION` → `node tools/manifest.mjs <新版本>` → `npm test` → 相关冒烟 → `node tools/pack.mjs <你的版本> <新版本> notes.json "<输出>/升级包_x到y.zip"` → `present_files`。**升级包文件名必须以「升级包」开头，绝不能以 `Gridmarch_v` 开头**（机器人当完整包会清空仓库）；打包前删输出目录里的旧 zip；改了 `.github/workflows/` 要手动传。快照 `docs/manifests/` 只留最近 5 个（现留 1.05–1.09）。完整包 = 仓库目录全部文件打 zip（根目录直接是文件，含 `.github/`，不含 node_modules / .git / 其他 zip）。
5. 每个窗口约 10 次小迭代；本文只在你说「本轮结束」时更新一次。
6. 沟通：中文、手机阅读、先给结论、简短；需要真机看的单独列出；新视觉 / 交互给 2–3 个方案让你选。

## 1. 项目与设备
回合制战棋（类《高级战争》），3D（Three.js r170）、iOS 独立 PWA、GitHub Pages、仓库 `Gridmarch`。设备：iPhone 17 Pro（横屏 874×402，竖屏锁定用虚拟横屏）、iPad 2025。第一阶段目标【已定】：同一设备双方轮流的纯战斗；11 种陆军；规则基准 GBA《高级战争2》；无迷雾；暂不做联机、天气、昼夜、编辑器。**下一阶段：其余单位模型 + AI**（§8）。

## 2. 已定决策与现状
**技术**：ES 模块 + importmap；美术文件（`src/art/`）不手改；单个 `index.html`（主页 `#homeView` + 战场 `#battle`）；开发直达 `index.html?go=battle&seed=数字&units=1&debug=1`（**`&units=1` 才给每方 4 个起始单位**）。版本号只在 `GM_VERSION`；增删改名 `src/` 下 js 必须 `npm run stamp`。本地存储键前缀 `gridmarch.`（`lang` `sfx` `save` `camCells` `showFps` `hpTuck` …）。全屏【已定】：`100vw×100vh`，不用 dvh / `inset:0` / `env(safe-area-*)`。

**iOS 27 顶部毛玻璃【已定】**：关不掉、不用黑块遮；虚拟横屏主页标题 + 菜单用 80px，真横屏 56px；战场各面板仍 56px。**1.01**：主页右下角版本号可点击，进全黑提示页 `blur-tip.html`（系统返回手势回主页可暂时消除模糊；画返回手势起点边；「返回主页」按钮保底）。

**相机**：正交俯角 55°，视距 5/7/9/11 格，双指缩放。每方记住自己的镜头位置。**「找单位」（1.01 重写）**：只在闲置单位间轮换，多个依次轮转、镜头已停在「下一个」上就跳过；只剩一个闲置单位时每按一下都对准它；**长按 0.45 秒 = 战场情报**。

**第一关（`levels/level1.js`）**：20×12，种子决定一切。**有模型的单位**：步兵 / 反坦克兵 / 轻中重坦 / **自行火炮（1.07 起 V2.1.1 动画性能版）**；侦察车 / 运输车 / 火箭炮 / 防空炮 / 防空导弹没有（兵工厂「未建模」不能买）。

**规则引擎（`src/rules/`，纯函数）**：`data.js` 改数字只改这里。血量 0–100；收入 1000（小城市 700）；单位上限 40；占领 20 点易主，占领总部 = 获胜；回合开始：收入 → 修理 → 沼泽掉血。**间接火力（1.08 修）**：移动后不能开火，但「原地不动」不算移动（`relocated(u)`：`origin` 与现在不同格才算）；不被反击；射程窗口 `[最近, 最远]`，盲区 = 比最近射程还近。玩家可见的引擎提示走语言包（别名 `tx`）。

**战场界面（`src/battle/main.js` + `battle.css`）**：左上状态条 = 结束回合确认；右上：找单位 / 旋转 / 暂停菜单；点格简要面板，长按 = 详细面板；点单位 → 蓝格 → 浮条「合流 / 占领 / 攻击 / 待命」。**远程攻击范围（1.09）**：射程最大 > 1 的单位，选中时**只有移动格 / 射程格里有敌人**才画一圈橙黄外轮廓（无填充，盲区在里面不另标；`atkRangeOf`）；没敌人 = 只有蓝格；点「攻击」选目标时照画。**炮弹飞行 + 落点爆炸（1.09，`src/game/shell-fx.js`）**：炮口开火那一刻放炮弹，抛物线飞向目标，落地爆炸（闪光 / 火球 / 冲击环 / 烟 / 碎石），攻击回调等爆炸闪过才返回；火箭炮接入时每发调一次 `shellFx.launch`。
胜利结算 `result.js`、战场情报 `intel.js`、暂停菜单 / 存档（只有手动「返回主页」才存，单槽 `gridmarch.save`）、音效 `sfx.js`（WebAudio 合成；`ui` / `game` 两套）同前。步兵 / 反坦克兵是**实例批**，单位被拿掉必须 `releaseInfantryActor`。

**语言包（1.02–1.06，已基本完成）**：`src/i18n/`（`index.js` 的 `t / lazyTable / applyI18n / OWN`，`zh.js` + `en.js`，约 303 条），战斗界面玩家可见文字全部走它；主页和提示页用自带小字典。单位名两套：`.name` 短名（英文 ≤12 字符，列表 / 卡片）、`.fullName` 全名（大标签 / 详细面板）；图标字用 `glyph.*`（中文一个字 / 英文两个字母；以后可能换成 AI 生成的 SVG 图标，**【待定】用户计划，可能延期**）。静态模板用 `data-i18n*` + `applyI18n(root)`。**约定**：中文界面不放英文小字，英文界面不放中文小字；带数字的句子用 `{参数}`；规则 / 存档层只存 id；`main.js` 里翻译函数别名 `tr`（局部变量 `t` 很多）。词条自检在 `tools/check-i18n.mjs`（已并入 `npm test`）。剩余写死中文基本都在测试页 / 调试用代码里。

**界面风格【暂定】**：B「玩具盒」——奶油底 `#fff6dc` + 深色粗边 `#2d3e55` + 橙色按钮，纯 CSS。

**调试钩子** `window.battle = {pick, camMem, saveGame, gid, resumed, intel, result, world, cam, preset, THREE, game, describe, detail, ars, produce, hud, mark, toWorld, toEngine, toast, state()}`；`world.fxStats() / hlCount(name)`；`sfx.last / sfx.log`。

## 3. 仓库地图
```
index.html home.js home.css blur-tip.html manifest.webmanifest package.json README.md
tests/   units-terrain.html orientation.html ui-style.html
src/  art/（程序化美术，不手改）  game/（world.js shell-fx.js engine-map.js map-builder.js levels/ units/）  rules/（data combat engine save）  i18n/
      battle/（main arsenal detail intel result sfx explain unit-info unit-models camera cursor stage loading blur-tip orientation-test + battle.css）  app/  vendor/three r170
tools/  check-*.mjs（npm test）  smoke-*.py  stamp / manifest / pack / apply-package     .github/workflows/
docs/  本文 ARCHITECTURE ART_PACKAGES HOME CHANGELOG manifests/ archive/        assets/
```

## 4. 工具与验证
- `npm test`；`npm run stamp`；`node tools/manifest.mjs <版本>`；`node tools/pack.mjs <你的版本> <新版本> [notes.json] [输出.zip]`。GitHub `checks` 在你上传 zip 的那次提交上必红，看 `gridmarch-bot` 之后那条。
- **冒烟（要先起服务、网址带 `&units=1`）**：旧：`arsenal endturn stuck acted move attack capture detail economy swamp coast next cap join fps loading result wipe intel sfx combat movesfx camrem save cycle`；**新**：`arty`（造自行火炮 → 开火 / 炮弹落地 / 履带转）`range`（攻击范围轮廓：没敌人不画 / 有敌人画 / 射程 1 不画）。
- **无头浏览器**：容器里有 Python Playwright + 无头 Chromium（`--use-gl=swiftshader`）。**静态服务随命令结束被杀：每条命令里 `(setsid nohup python3 -m http.server 8099 >/dev/null 2>&1 &); sleep 1;` 自己起**。**软件渲染只有约 2 帧/秒**：镜头 / 动画等 `wait_for_function`，别靠固定毫秒；**单条命令别超过 300 秒——冒烟每批 3 个、各自 `timeout 80`，`npm test` 单独跑**。点屏幕：先把镜头对准目标，再用 `THREE.Vector3(...).project(cam.cam)` 算像素；很多测试直接走 `window.battle` 钩子更稳。
- 想看某个界面：`window.battle.ars.open(...)` / `detail.open(...)` / `pick(id)` + `page.screenshot`，再 `view` 图片。听感只能真机。

## 5. 虚拟横屏
`src/battle/stage.js`：系统竖屏就把舞台转 90°；`side` 记灵动岛在左 / 右；触摸经 `stage.toLogical`，尺寸用 `stage.w/h`，CSS 用 `var(--sw)/var(--sh)`；`stage.rot !== 0` = 虚拟横屏。排查：战场「换边」长按 0.8 秒；`tests/orientation.html`。

## 6. 未验证 / 风险
1. **1.01–1.09 的真机表现**：英文模式各面板排版（兵工厂左栏、详细面板、行动栏）、自行火炮开火 / 炮弹 / 爆炸的观感与多单位帧率、攻击范围轮廓的粗细颜色、提示页手势位置。**自行火炮的问题用户测完会在新窗口告知。**
2. **性能【待办】**：步兵约 29.5k 三角形，同屏 30+ 单位帧率掉到 40 多；战场只需 3–5k 面。方向：Blender 重做低面战场版，或试降分段数（`src/art/` 不手改，要你点头）。
3. 选中单位后点「能走到的残血同类型友军」= 合流；断崖防御星暂定 0；机场 / 船坞没实测；解散最后一个单位 = 判负。

## 7. 待你决定
单位大小系数 / 造价 / 沙漠沼泽断崖数值；防空导弹对地能力；战场左上 / 右上是否也躲毛玻璃；自动存档要不要；兵种图标是否换成 AI 生成的 SVG（可能延期）；直瞄坦克要不要炮弹弹道。

## 8. 下一步路线图
1. **先处理用户测完 1.09 后反馈的自行火炮问题。**
2. **模型导入（用户已有旧版包，新窗口需重新上传）**：**快速侦察车 V1.3**（`createScout`，转向 / 开火）、**六轮装甲运输补给车 V1.6.1**（`createAPC`）、**多管火箭炮车 V1.5.1**（`createMLRS`，展开 / 八管连射专属动画）。建议：1.10 侦察车 + 运输车（都是轮式，共用轮式运动的接法；接法参照 1.07 自行火炮：`world.js` 的 `spec.k` 分支、`unit-models.js`、兵工厂解锁、`data.js` 的 `buildable`）；1.11 火箭车（攻击流程 + `shellFx.launch` 连射）。每个包先读它自己的 README，同名文件整体覆盖，版本记进 `ART_PACKAGES.md`。
3. **AI（单人对战的前提，开新窗口专做）**：红军回合自动走：造兵 → 走向最近敌人 / 敌方建筑 → 攻击 / 占领；先做最简单可玩的，再按军队风格（`data.js` 的 `style`）加变化；走引擎同一套函数，战场用现有动画 + 音效回调演出。
4. 补给 / 燃料开关、运输；选图页、地图导出、自动存档；步兵低面版；胜利 / 失败音效、炮类移动声、外海 LOD。

## 9. 教训（省额度）
1. 没有证据别改正式页面。**注释永远另起一行，别接在代码行末**（行内 `//` 会把后面的代码一起吃掉）；改完每个 js 先 `node --check`。
2. **断言要覆盖位置 / 数值**；`npm test` 不跑浏览器，改了界面脚本一定跑相关冒烟；修 bug 要验证「去掉修复测试会失败」。
3. 状态机类逻辑（找单位循环、镜头记忆、aimLock）改一处会影响另一处：改前先列出会走到的状态组合，写进冒烟。**规则里「状态标记」和「真实含义」要分开想**（1.08：原地不动被记成 moved，导致间接火力永远开不了火）。
4. 查性能先量；`groundY ≠ baseY ≠ surfaceY`。先查仓库再说「有 / 没有某个资产」；先读现有代码再设计。
5. **容器里读中文文件别用 `cut -c / head -c`**（切断 UTF-8），用 Python 切片；**正则替换多行代码块要用精确字符串 + assert**（1.05 的非贪婪正则吃掉了三行）；不要 `pkill/pgrep -f` 带自己命令行里的字；同时跑两个无头浏览器会互相拖慢。
6. 打包：`&&` 串联；输出目录里不能留旧 zip；发布文件必须 `present_files`。
7. iOS：动画只动 `transform / opacity`；带 `display` 的元素 `hidden` 会失效，补 `[hidden]{display:none}`；WebAudio 要用户手势唤醒；拖镜头走 `cam.pan`。
8. 实例批只增不减：新增单位生命周期代码要想到回收。新功能顺手挂 `window.battle` 钩子；页面 id 先查重。
9. **视觉改动先给截图 / 方案再定稿**（1.08 的斜纹范围被嫌丑，1.09 改成只画轮廓）；亮地面上的特效要大、饱和，纯加色会被洗掉。
