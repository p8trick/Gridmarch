# 方寸战线（GridMarch）

回合制战棋（高级战争类）。画面是 55° 俯视的 3D 低面数沙盘，**所有美术资产都是程序化生成的 JS 模块**——没有贴图、没有二进制模型，整个仓库约 2 MB（其中 three.js 1.3 MB）。

## 本地运行

```bash
npm run serve                 # python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/index.html
# 手机测试：同一局域网打开 http://<电脑IP>:8080/ ；或部署到 GitHub Pages（Settings → Pages → 根目录，.nojekyll 已放好）
```

调试网址参数：`?map=bay|estuary|island|island-cliff|island-mixed|island-split|shapes`、`?t=x,z`（相机目标格）、`?s=视距`、`?a=转向°`、`?p=俯角°`、`?fold=0|1|2`（面板折叠）、`?fire=秒`（全员开火并冻结到该时刻，截图用）。

## 目录

```
battle.html           战场页（正式游戏入口）：主页的"单人对战"跳这里
test.html             单位×地形测试页（原 index.html，开发用）
（根目录 index.html 属于主页，不在本仓库包里）
src/
  battle/             战场页：main.js（关卡→世界→触控→循环）、camera.js（5/7/9 三档视距 + 90° 旋转动画）、battle.css
  app/                测试页 UI 与相机（main.js、ui.css）
  battle/             战场页：main.js（关卡→世界→触控→循环）、camera.js（5/7/9 格三档视距 + 90° 旋转动画）、battle.css
    game/levels/        关卡生成器：level1.js（20×12 湖畔对峙，种子随机、左右镜像）、index.js（注册给 npm test）
  game/               把美术接成"世界"的集成层
    world.js            地块 / 单位 / 选择 / 移动 / 开火 / 桥 / 站位
    levels/             关卡生成器：level1.js（第一关，种子决定公路/山/树，左右镜像）、index.js（注册给检查脚本）
    map-builder.js      地图预设（数据）+ 水域 / 海岸 / 河口的组装与校验
    units/              坦克家族、步兵批量封装
  art/                固定美术资产（程序化模型，一次做好、少改）
    palette.js          全局调色板与共享材质
    terrain/            自然 / 建筑 / 交通 / 道路 R1 / mountain/ / bridges/
    water/              海 V08、海岸（基础 + MT2）、河 R6.1、河口 M2
    units/              tank-light / tank-medium / tank-heavy / infantry / 火炮
  vendor/three.module.js
tools/                检查与构建脚本（Node，无依赖）
docs/                 ARCHITECTURE.md（结构与约定）、ART_PACKAGES.md（美术包版本表）
```

## 检查

```bash
npm test                      # 布局校验 + 各地图接缝检查 + 海岸 47 种邻域完备性
npm run stamp                 # 改了 src/ 下任何文件后运行：给 battle.html / test.html 的 importmap 写入文件内容哈希（iOS 无 SW 时避开 js 死缓存）
npm run build:offline         # 单文件离线战场页 → dist/battle_offline.html（build:offline:test 是测试页）
```

详见 `docs/ARCHITECTURE.md`。

## 战场页

- 地址：`battle.html`；`?seed=N` 固定地图（不带则每次随机，种子显示在左下角）；`?debug=1` 显示帧率与面数。
- 相机：单指拖动平移，双指缩放（松手吸附 5/7/9 格），⟲ ⟳ 按钮 90° 旋转（旋转中心 = 屏幕中心的地面点），点格子显示地形。
- 暂不做 Service Worker；缓存靠 `npm run stamp`。
