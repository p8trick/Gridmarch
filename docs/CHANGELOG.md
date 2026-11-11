# 更新记录（每次交付改了哪些文件）

> 用途：你跳过了某几个版本时，告诉我你现在的版本，我用 `docs/manifests/` 里的快照一键生成升级包；也可以自己把「你现在的版本之后」每一版的文件取并集。
> 每次交付的更新包里也有 `更新说明.md`，写的是相对上一版的改动；累计包会注明"从 vN 升级"。
> 更新后别忘了把 `index.html` 里的 `GM_VERSION` 加一位（避开手机旧缓存）。

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
