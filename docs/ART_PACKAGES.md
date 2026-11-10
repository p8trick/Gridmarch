# 美术包版本表

> 版本号取自各包 README / 清单；有出入请以你的包为准并更正这里。`状态` = 当前集成层是否在用。

| 族 | 位置 | 版本 / 入口 | 状态 |
|---|---|---|---|
| 海 | `art/water/sea-*` | V08 性能版（`createSeaRegion`，relief 取 0 以与岸格水面同高） | 在用 |
| 海岸·基础 | `art/water/shoal-*`, `cliff-*`, `coast-final`, `coast-performance` | 浅滩 A7.3 / 断崖 C2（被 MT2、河口、海湾图调用） | 在用 |
| 海岸·MT2 | `art/water/coast47-*`, `coast-topology.js` | 47 种邻接 + 浅滩 / 断崖按格混合（`planCoast47`, `createCoast47`） | 在用（群岛、河口图） |
| 河流 | `art/water/river-performance`, `river-r61-*` | R6.1 性能版（256 种邻接已验证） | 在用 |
| 河口 | `art/water/river-mouth*.js` | M2（MT2 兼容；左右岸型可混合） | 在用（河口图） |
| 桥梁 | `art/terrain/bridges/` | A 型河桥 / B 型跨海桥 + 桥面高度 API（`getBridgeSurfaceY`） | 在用 |
| 山 | `art/terrain/mountain/` | AB 最终双版（A 单峰 / B 双峰 × 4 朝向，高度系数 0.90–1.10） | 在用（性能版） |
| 道路 | `art/terrain/terrain-batch1.js` | R1（含中线导向） | 在用 |
| 六建筑 | `art/terrain/terrain-buildings / -transport`（原版）+ `building-performance / buildings-performance / dockyard-terrain / buildings-index`（性能版 + 港口地形） | V1.6 R3 双版本 + P1 性能版 + D1 港口地形（`mountDockyardOnTerrain`，自动选朝向） | 在用（群岛图有船坞） |
| 树林 | `art/terrain/forest/` | 树林包 V1.0 双版本（`createForestRegion` 按 3×3 地块合批） | 在用（静止合批，挤开 / 缓动时回到逐棵） |
| 自然（其余） / 交通 | `art/terrain/terrain-nature.js` 等 | 旧版 | 在用 |
| 轻坦 | `art/units/tank-light/` | V1.5 行进 + 开火动画，性能版 | 在用 |
| 中坦 | `art/units/tank-medium/` | V3.2 性能版 | 在用 |
| 重坦 | `art/units/tank-heavy/` | V1.2 性能版 | 在用 |
| 沙漠 / 沼泽 | `art/terrain/desert-swamp/` | V1.0 Final R3（性能版：3×3 格分区合批；沙漠用 low_dunes 半高沙丘，沼泽 standard） | 在用 |
| 步兵 | `art/units/infantry/` | V6.12P（F1 侧脸 + B1 军靴 + W2 左手 + 四色阵营），批量版 | 在用 |
| 反坦克步兵 | `art/units/infantry/anti-tank-*` | V1.6P，批量版 | 在用 |
| 火炮 | `art/units/artillery-v2_0.js` | v2.0 | 在用（旧版） |

## 已收到、尚未接入

快速侦察车、沙漠沼泽地形（V1.0 R3）。

## 换包流程

1. 把新包里的运行文件放到对应族目录，**同名文件整体覆盖**，不手改。
2. 只把 `./vendor/three.module.js` 改成 `three`、`./palette.js` 改成 `palette`；若包里的相对导入与仓库目录结构不同，按新位置调整。
3. `npm test` 通过后再提交；在这张表里更新版本。
