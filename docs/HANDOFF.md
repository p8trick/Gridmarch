# 方寸战线 · Gridmarch 交接开发文档

> 写于 0.91–1.00 窗口结束时（交付 **1.00**，完整包）。**新窗口从 1.01 起，小改动 +0.01，新日志写 `docs/CHANGELOG.md`（1.01 起）；旧日志在 `docs/archive/`，不用读。**
> 只写「现状 + 已定决定 + 风险 + 下一步」；标记：【已定】你明确决定　【暂定】我先放的值　【待定】要你拍板　【未验证】没有真机确认

## 0. 新窗口开机清单
1. 你上传**整个仓库 zip** + 一句本轮目标 + GitHub 上现在的版本（`index.html` 的 `GM_VERSION`）。
2. 先读本文；用到才读 `docs/ARCHITECTURE.md`（§11 是 0.91–1.00 新模块）/ `ART_PACKAGES.md` / `HOME.md`；日志不用读。
3. 跑 `npm test`（布局 / 水域 / 海岸 / 规则 38 项 / 关卡适配器）确认起点是绿的；**冒烟只跑和本次改动相关的**（§4）。
4. **交付规则【已定】**：日常只给升级包 `升级包_x到y.zip`（`tools/pack.mjs`），传 GitHub 根目录，机器人自动应用；**完整包 `Gridmarch_vX_XX.zip` 只在本窗口彻底结束时给一次，或你说出意外时随时给**。每次交付：改完每个 js 先 `node --check` → 增删改名 `src/` 下 js 后 `npm run stamp` → 写 `docs/CHANGELOG.md` + 改 `GM_VERSION` → `node tools/manifest.mjs <新版本>` → `npm test` → 相关冒烟 → `node tools/pack.mjs <你的版本> <新版本> notes.json "<输出>/升级包_x到y.zip"`（`&&` 串联，别接 `| tail`）→ `present_files`。**升级包文件名必须以「升级包」开头，绝不能以 `Gridmarch_v` 开头**（机器人当完整包会清空仓库）；打包前删仓库目录里的旧 zip；改了 `.github/workflows/` 要手动传。快照 `docs/manifests/` 只留最近 5 个（现留 0.96–1.00）。完整包 = 仓库目录全部文件打 zip（根目录直接是文件，含 `.github/`，不含 node_modules / .git / 其他 zip）。
5. 每个窗口约 10 次小迭代；本文只在你说「本轮结束」时更新一次。
6. 沟通：中文、手机阅读、先给结论、简短；需要真机看的单独列出；新视觉 / 交互给 2–3 个方案让你选。

## 1. 项目与设备
回合制战棋（类《高级战争》），3D（Three.js r170）、iOS 独立 PWA、GitHub Pages、仓库 `Gridmarch`。设备：iPhone 17 Pro（横屏 874×402，竖屏锁定用虚拟横屏）、iPad 2025。第一阶段目标【已定】：同一设备双方轮流的纯战斗；11 种陆军；规则基准 GBA《高级战争2》；无迷雾；暂不做联机、天气、昼夜、编辑器。**下一阶段：AI + 其余单位模型**（§8）。

## 2. 已定决策与现状
**技术**：ES 模块 + importmap；美术文件（`src/art/`）不手改；单个 `index.html`（主页 `#homeView` + 战场 `#battle`，只改 `hidden`）；开发直达 `index.html?go=battle&seed=数字&units=1&debug=1`（**`&units=1` 才给每方 4 个起始单位**）。版本号只在 `GM_VERSION`；增删改名 `src/` 下 js 必须 `npm run stamp`。本地存储键前缀 `gridmarch.`（`lang` `sfx` `save` `camCells` `showFps` `hpTuck` …）。全屏【已定】：`100vw×100vh`，不用 dvh / `inset:0` / `env(safe-area-*)`。

**iOS 27 顶部毛玻璃【已定】**：关不掉、不用黑块遮；`tests/orientation.html`「边距」测得 **80px** 才基本不受影响。**只在虚拟横屏**（`#stage.vrot`）主页标题 + 菜单用 80px，真横屏 56px；标题再左移 `条高×.0882` 对齐菜单斜条下角。**战场各面板仍 56px（`--pad-l`），没跟 80 走**，【待定】以后是否让战场左上状态 / 右上按钮也躲。

**相机**：正交俯角 55°，视距 5/7/9/11 格，双指缩放 3.5–11 吸附，视距自动保存。每方记住自己的镜头位置（结束回合存、换边后平移回去）；**「找单位」跳过去后单位行动完且没手动拖镜头，记跳过去的位置**（`lastJump` + `browsing`）。胜负分出后镜头平移到被占总部（占领）/ 打出最后一击的单位（歼灭）并缓慢绕场，碰一下棋盘停。

**第一关（`levels/level1.js`）**：20×12，种子决定一切（同一种子换版本地图可能不同）；基地 / 城市 / 公路 / 河 / 起始部队 / 中央大湖左右镜像。战场只有步兵 / 反坦克兵 / 轻中重坦 / 自行火炮 6 个有模型，侦察车 / 运输车 / 火箭炮 / 防空炮 / 防空导弹没有（兵工厂「未建模」不能买）。

**规则引擎（`src/rules/`，纯函数）**：`data.js` 改数字只改这里。血量内部 0–100；收入 1000（小城市 700）；每方单位上限 40；占领 20 点易主，**占领总部 = 获胜**，全歼只对生产过单位的一方生效；回合开始先收入 → 修理（己方建筑上陆军 +20）→ 沼泽掉血；合流（残血同类型，超出折资金）。**新增（0.91–0.99）**：统计表 `g.stats[玩家]`（built / lost / killed / captured / income / spent / disbanded）、`g.winReason / winCell`、`summaryOf(g)`、`disband(g,id)`、`save.js`（存档）。

**战场界面（`src/battle/main.js` + `battle.css`）**
- 左上状态条点 = 结束回合确认；右上三键：**找单位**（点 = 镜头轮流跳到未行动单位，每按一下镜头都动；轮完回到开始前的位置，那位置就在眼前时去己方基地视角；**长按 0.45 秒 = 战场情报**）/ 旋转 / 暂停菜单。点格简要面板；**长按 = 详细面板**；单位操作：点单位 → 蓝格 → 浮条「合流 / 占领 / 攻击 / 待命」。
- **胜利结算（`result.js`）**：左胜利牌 + 右蓝红对照表（已生产 / 损失 / 击毁 / 据点 / 累计收入 / 累计军费），败方压灰，「看战场」收成底部横幅；「再来一局」同图重开。**战场情报（`intel.js`）**：单个大玩具盒，蓝红对照 + 各类据点 + 中立据点。两者共用 `.res-*` 样式。
- **暂停菜单**：继续 / 画质 / 界面音效 / **军务**（解散部队 / 投降撤退 / 换图重开，均有确认）/ **返回主页（= 存档）**。**存档（0.99）**：只有手动「返回主页」才存，单槽 `gridmarch.save`，带 `gid`；主页「继续」读它；投降撤退一律清空，分出胜负 / 换图 / 再来一局只清自己那局；地图靠种子重生、`terrainSig` 不符则开新局。继续存档时开局布局校验放宽「单位不能站在建筑上」（`preset.resumed`）。
- **音效（`sfx.js`，WebAudio 合成，无音频文件）【已定】两套**：`ui`（菜单：主页 / 设置 / 暂停 / 结算，圆润「啵」）与 `game`（战场内：右上角键、兵工厂、详细面板、情报、棋盘点按、开火 / 命中 / 被消灭、脚步 / 履带 / 起步 / 熄火、兵工厂齿轮）。步兵被消灭是卡通「噗」，机械单位爆炸。开关主页设置 + 暂停菜单（同一个键）；iOS 静音键会让它没声。
- 回合开始动画（收入 / 修理 / 沼泽）期间 `econBusy` 挡操作；短提示 `toast`（元素 `gmToast`）；解散提示条 `gmHint`。步兵 / 反坦克兵是**实例批**，单位被拿掉必须 `releaseInfantryActor`。

**界面风格【暂定】**：B「玩具盒」——奶油底 `#fff6dc` + 深色粗边 `#2d3e55` + 橙色按钮，纯 CSS。

**调试钩子** `window.battle = {camMem, saveGame, gid, resumed, intel, result, world, cam, preset, THREE, game, describe, detail, produce, hud, mark, toWorld, toEngine, toast, state()}`；`sfx.last / sfx.log`（最近出声）。

## 3. 仓库地图
```
index.html home.js home.css manifest.webmanifest package.json README.md
tests/   units-terrain.html orientation.html（含「边距」测试）ui-style.html
src/  art/（程序化美术，不手改）  game/（world.js engine-map.js map-builder.js levels/ units/）  rules/（data combat engine save）
      battle/（main arsenal detail intel result sfx explain showcase camera cursor stage loading orientation-test + battle.css）  app/  vendor/three r170
tools/  check-*.mjs（npm test）  smoke-*.py  stamp / manifest / pack / apply-package     .github/workflows/  checks.yml apply-package.yml
docs/  本文 ARCHITECTURE ART_PACKAGES HOME CHANGELOG manifests/ archive/        assets/  title / home / icons
```

## 4. 工具与验证
- `npm test`；`npm run stamp`；`node tools/manifest.mjs <版本>`；`node tools/pack.mjs <你的版本> <新版本> [notes.json] [输出.zip]`。GitHub `checks` 在你上传 zip 的那次提交上必红，看 `gridmarch-bot` 之后那条。
- **冒烟（要先起服务、网址带 `&units=1`）**：`arsenal endturn stuck acted move attack capture detail economy swamp coast next cap join fps loading`（旧）；**新**：`result`（占领获胜 → 结算 / 看战场 / 再来一局）`wipe`（歼灭 + 镜头）`intel`（长按）`sfx`（两库归属 / 开关 / 主页边距）`combat [inf|tank]`（开火 → 命中 → 消灭顺序）`movesfx [inf|tank]`（脚步 / 履带 / 兵工厂齿轮）`camrem`（镜头记忆）`save`（解散 / 存档继续 / 建筑上单位 / 投降清存档）`cycle`（找单位循环三种情形）。
- **无头浏览器**：容器里有 Python Playwright + 无头 Chromium（`--use-gl=swiftshader`）。**静态服务随命令结束被杀：每条命令里 `(setsid nohup python3 -m http.server 8099 >/dev/null 2>&1 &); sleep 1;` 自己起**。**软件渲染只有约 2 帧/秒**：镜头平移 / 动画要等 `wait_for_function('()=>!window.battle.cam.glide')`，别靠固定毫秒；**单条命令别超过 300 秒**（`npm test` + 几个冒烟分开跑）。点屏幕：先把镜头对准目标（`cam.target.x/z = 世界格×2; mark()`），再用 `THREE.Vector3(...).project(cam.cam)` 算像素。拖镜头别逐步 `mouse.move`，用页内 `dispatchEvent(new PointerEvent(...))`。
- 测声音：给 `AudioContext.createOscillator` 打计数补丁，或读 `sfx.log / sfx.last`；**听感只能真机**。

## 5. 虚拟横屏
`src/battle/stage.js`：系统竖屏就把舞台转 90°（配合竖屏方向锁定）；`side` 记灵动岛在左 / 右；触摸经 `stage.toLogical`，尺寸用 `stage.w/h`，CSS 用 `var(--sw)/var(--sh)`；`stage.rot !== 0` = 虚拟横屏。排查：战场「换边」长按 0.8 秒 = 现场诊断；`tests/orientation.html`。

## 6. 未验证 / 风险
1. **0.81–1.00 的真机手感**只有无头浏览器证明流程走通：回合动画、**所有音效的听感与音量**、长按情报 0.45 秒蓄力、存档继续、找单位循环、结算面板字号间距。
2. **性能【待办】**：实测每个步兵约 **29.5k 三角形**（反坦克兵 30.4k）；同屏 30+ 单位帧率掉到 40 多；实例化只省绘制调用、不减面数；默认视距步兵屏幕高约 36 逻辑像素，**战场只需 3–5k 面**。方向：Blender 重做低面战场版（带同骨骼 / 动画），高面版留给详细面板 / 兵工厂展示；或先试降代码生成的分段数（`src/art/` 约定不手改，要你点头）。
3. 选中单位后点「能走到的残血同类型友军」= 合流，不是切换选中；断崖防御星暂定 0；机场 / 船坞没实测；解散最后一个单位 = 判负。
4. 战场文字全是写死中文（主页中英文）；`explain.js` 没逐条审；加载进度条后半段是估计值。

## 7. 待你决定
单位大小系数 / 造价 / 沙漠沼泽断崖数值；防空导弹对地能力；河是否左右不对称；战场左上 / 右上是否也躲毛玻璃（虚拟横屏下 80px）；自动存档要不要；语言包何时抽出（建议外挂 `src/i18n`）。

## 8. 下一步路线图（建议顺序）
1. **AI（单人对战的前提，开新窗口专做）**：红军回合自动走：造兵 → 走向最近敌人 / 敌方建筑 → 攻击 / 占领；先做最简单可玩的，再按军队风格（`data.js` 已有 `style`）加变化。AI 走引擎同一套函数（`reachable / move / attack / capture / produce`），战场用现有动画 + 音效回调演出。
2. **模型**：步兵低面版（§6.2）→ 侦察车 / 运输车 / 火箭炮 / 防空炮。
3. 补给 / 燃料开关、运输；选图页、地图导出、自动存档 / 多存档位。
4. 小项：胜利 / 失败音效、地形相关脚步、炮类自己的移动声、语言包、外海 LOD。

## 9. 教训（省额度）
1. 没有证据别改正式页面：先做对照开关让你试完再并回。
2. **注释永远另起一行，别接在代码行末**：行内 `//` 会把同一行后面的代码一起吃掉（栽过 5 次）。改完每个 js 先 `node --check`。
3. **断言要覆盖位置 / 数值**；`npm test` 不跑浏览器，改了界面脚本一定跑相关冒烟；**修 bug 要验证「去掉修复测试会失败」**（1.00 建筑上存档就是这样确认的）。
4. 状态机类逻辑（找单位循环、镜头记忆）改一处会影响另一处：0.99 让镜头常停在单位上，直接弄坏了「回到原位」。改前先列出会走到的状态组合，写进冒烟。
5. 查性能先量；`groundY ≠ baseY ≠ surfaceY`；贴地的东西用 `surfaceY`。
6. 容器里读中文文件别用 `cut -c / head -c`（切断 UTF-8），用 Python 切片；**不要 `pkill/pgrep -f` 带自己命令行里的字**；同时跑两个无头浏览器会互相拖慢。
7. 打包：`&&` 串联；仓库目录里不能留旧 zip；发布文件必须 `present_files`；增量包拿不准就给完整包。
8. iOS：动画只动 `transform / opacity`；带 `display` 的元素 `hidden` 会失效，补 `[hidden]{display:none}`；WebAudio 要用户手势唤醒；拖镜头走 `cam.pan`。
9. 实例批只增不减：新增单位生命周期代码要想到回收。测试里改状态走引擎同一条路径；新功能顺手挂 `window.battle` 钩子；页面 id 先查重。
10. 先查仓库再说「有 / 没有某个资产」；先读现有代码再设计；触屏上别做「点目标 → 弹预估 → 再确认」。

## 语言包约定（1.02 起）
- 所有玩家可见的文字走 `t('模块.键', {参数})`，词条放 `src/i18n/zh.js` + `en.js`（键必须两边都有，`npm test` 检查）。带数字的句子用 `{参数}` 占位，不拼接。
- 规则 / 存档层只存 id，名字由 getter 或 `t()` 在显示时取（见 `data.js` 的 `localize`）。新增单位 / 地形 / 风格时，记得同时加 `unit.*` / `terrain.*` / `style.*` 词条。
- 主页（classic 脚本）和 `blur-tip.js` 有自己的小字典，暂未并入；迁移进度看 `check-i18n` 输出的「还剩约 N 处写死的中文」。
- 单位名两套：`.name` 短名（列表 / 卡片，英文 ≤12 字符）、`.fullName` 全名（大标签 / 详细面板）；图标字用 `glyph.*`。静态 HTML 模板用 `data-i18n*` 属性 + `applyI18n(root)`。
- 注意：`sfx.js` 里用中文关键词（不足 / 暂不可 / 未建模）判断提示音类型，迁移提示文字（toast）时要同步改成按词条键或错误类型判断，否则英文提示会没有音效。
- 中文界面不放英文小字；英文界面不放中文小字。

