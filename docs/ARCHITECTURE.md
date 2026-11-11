# 结构与约定

## 1. 分层

| 层 | 目录 | 谁改 | 说明 |
|---|---|---|---|
| 美术资产 | `src/art/` | 美术流程（新包进来整体替换） | 程序化模型：入口函数返回 `THREE.Group`；不含游戏规则 |
| 集成层 | `src/game/` | 开发 | 把美术接成世界：地图数据、通行、站位、开火、高度、校验 |
| 应用 | `src/app/` | 开发 | 当前是测试页（面板 / 相机），正式游戏替换这一层 |

规则：`art/` 不依赖 `game/` 和 `app/`；美术模块之间可以互相依赖（例如河口依赖海岸、桥依赖 `coast-performance.js`）。

## 2. 模块解析（importmap + 版本号启动脚本）

各页面（`battle.html`、`tests/*.html`）的 `<head>` 里有一对注释 `<!--GM-BOOT entry="…" css="…"-->…<!--/GM-BOOT-->`，中间是 `tools/stamp.mjs` 生成的启动脚本。它启动时读网址里的 `?v=`（版本号只在 `index.html` 的 `GM_VERSION`，主页跳转时带上；直接打开无 `?v=` 就用时间戳），然后：
1. 用 `document.write` 写出 importmap：`three → src/vendor/three.module.js`、`palette → src/art/palette.js`，并把 `src/` 下**每个 js** 映射成 `路径?v=版本号`（three.js 不带版本，永远走缓存）；
2. 再写出样式表和入口模块的 `<script type="module">`。

美术模块里一律写 `import 'three'` / `import 'palette'`，其余是相对路径；浏览器按解析后的完整地址查 importmap，所以相对 import 也会被换成带版本号的地址。Node 测试用 `tools/loader.mjs` 做同样的裸名映射。新增 / 删除 / 重命名 js 后运行 `npm run stamp` 更新清单（清单漏了某个文件也不会坏，只是那个文件不带版本号）。新测试页：复制一个现有页面，改 `entry` / `css` 即可。

> 美术包的原文件里写的是 `./vendor/three.module.js` 和 `./palette.js`。放进仓库时只改这两种导入（其余相对导入若跨目录需要按新位置改）。换新版本时同名文件整体覆盖即可，不要手改美术文件。

## 3. 世界约定（所有模块共用，别随意改）

- 一格 = 2 个世界单位；格 `(cx,cz)` 的中心在世界 `(2cx, 0, 2cz)`，格内局部坐标 `[-1,1]²`。
- 高度：陆面 `y=0`，水面 `y=-0.3`（`WATER_Y`），棋盘底 `y=-1.6`（`BASE_Y`）。
- 草色**只由棋盘格色块决定**：`boardGrass(cx,cz)`（`(cx+cz)&1` 交错 `P.grass / P.grassAlt`）。水域组件里"草"的顶点色在装配时被统一改成它（`retintGrass`，沙 / 岩 / 土 / 水不动）。以后只改调色板，所有水岸地块自动跟随。
- 材质共用：全部模块从同一个 `palette.js` 取 `MAT_TERRAIN` 等，避免多份材质实例。

## 4. 地图 = 数据

`map-builder.js` 的 `PRESETS[名字]`：`x/z` 范围、`seed`、水域描述（`topology` / `mouth` / `corner`）、`bridges`、`layout`（山 / 路 / 林 / 建筑 / 单位）。

- 水域三条路径：**MT2 拓扑**（`topology`：给陆格集合，47 种邻接自动出岸线，`coastType: shoal | cliff | mixed`）、**河口**（`mouth`：MT2 海岸 + 河口 M2 + 入口段 + 上游河）、**海湾**（`corner`：旧的单转角海岸模块，保留作回归）。
- 陆地棋盘格由 `world.js` 自己画（只画 `typeAt === 'land'` 的格）；水域组件负责海面 / 岸线 / 河。
- `validateLayout()`：建筑 / 树 / 山 / 路 / 单位必须在平原上且互不重叠；单位不进海，只有步兵进河；桥格下面必须是对的地形。**违规直接抛错**，不会悄悄渲染出来。

## 5. 集成契约

- **站位与高度**：海岸格用 MT2 的 `groundAnchor`（`water.anchorAt`）；桥格用桥的 `getBridgeSurfaceY(group, x, z)`（静止取格心，行进中逐帧取脚下）；河里步兵按身高 27% 涉水（`WADE_DEPTH`，水面不透明，沉下去的部分被遮住）；山格用 `getMountainStandPoint`（有单位的山格切驻扎顶面）。
- **步兵批量绘制**：步兵 / 反坦克步兵是实例批量绘制，模型不在场景图里。`infantry-actors.js` 给世界一个 actor 接口（`setMode/advance/shoot/update/clip`），`actor.root` 是不可见包围盒占位；每帧渲染前 `world.beforeRender()` 把占位的世界变换同步给逻辑单位并刷新实例矩阵。阵营色是包内的四色（`faction`）。
- **坦克**：行进时 `advanceMotion(l,r)`（差速：yaw 增大 = 向左转 → 右履带多走）；开火前炮塔转向最近敌人（`setAim` 偏航相对车体），开火期间 `aimLock` 防止重绘把炮塔拉回。
- **按需渲染**：只有动画 / 移动 / 开火期间才持续出帧；`world.update` 返回是否仍在活动。
- **桥是叠加物**：桥格仍是水（河 / 海）地形，另有 `bridgeByCell`；`terrainAt` 返回 `'bridge'`，对陆军可通行。桥必须直线，编辑器放桥时校验"直的水段"即可。

## 6. 已知限制（以美术包自己的说明为准）

- 一格宽的陆条 / 岬角 / 孤礁：MT2 已支持，但站位圆盘没验证（单位身体可能探出水面）。
- 河口只支持直入海、两侧为直岸；与岛屿海岸的其他相接方式没有。
- 桥只支持直线；桥头旁必须是直岸。
- 水域面数偏高：群岛 / 形状陈列图约 13.7–15.2 万面（每个水域格约 2100 面），尚未做外海 LOD。
- 没有实机帧率对比数据。

## 7. 测试

`npm test`：`check-layout`（所有预设布局校验）、`check-water-seams`（每个预设里"不同组件相邻"的格边：高度与顶点色，每边 49 点）、`check-coast-blob47`（高战式 47 种邻域逐一喂给规划器，必须全部接受）。接缝检查里个别"超差"样本若落在沙 → 草过渡带，不是真接缝（颜色两侧相近）。

## 8. 发布时要做的（现在还没做）

当前是 80 多个 JS 模块按需加载（开发 / GitHub Pages 直接跑没问题）。iOS PWA 冷启动会发 80 多个请求。**现阶段不做 Service Worker、不做打包**（开发期要方便迭代；单个模型也要能单独升级）。游戏稳定后再评估：
1. 构建期合并成 4~5 个分块（three / terrain / water / units / game），源码仍保持分散；
2. Service Worker 预缓存分块，带版本号，换版本整体失效；
3. 美术包的版本记录进 `docs/ART_PACKAGES.md`，换包时同步更新。

## 9. 战场页与关卡

- `src/battle/main.js`：关卡 → `buildWorld({preset})` → 相机 → 触控 → 按需渲染循环。`camera.js`：战术相机（视距按“短边格数”，90° 旋转动画）。`stage.js`：虚拟横屏舞台（见 `docs/HANDOFF.md` §5）。
- `src/game/levels/level1.js`：第一关生成器，`makeLevel1(seed)` 返回一个 `PRESETS` 同格式的预设（含 `topology`、`river`、`bridges`、`layout`）；`levels/index.js` 把它注册进 `PRESETS` 供检查脚本使用。
- `buildWorld` 接受 `{preset}` 直接传入预设；棋盘范围随预设变化；`world.sunFollow(x,z)` / `setShadowRadius(r)` 让阴影跟着相机；纯陆地图（无水格）、内陆河（`preset.river`）都支持。

## 10. 文档与版本快照

`docs/HANDOFF.md`（现状 + 决策 + 下一步，唯一必读）、`docs/HOME.md`（主页）、`docs/ART_PACKAGES.md`、`docs/CHANGELOG.md`（每个版本改了哪些文件）、`docs/manifests/*.json`（每个版本的文件指纹，`tools/pack.mjs` 靠它生成升级包）、`docs/archive/`（历史文档，不读）。
