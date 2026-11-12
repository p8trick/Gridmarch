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
npm run stamp                 # 新增 / 删除 / 重命名 src/ 下的 js 后运行：重新生成各页面启动脚本里的文件清单
```

详见 `docs/ARCHITECTURE.md`。

## 战场页

- 地址：`battle.html`；`?seed=N` 固定地图（不带则每次随机，种子显示在左下角）；`?debug=1` 显示帧率与面数。
- 相机：单指拖动平移，双指缩放（松手吸附 5/7/9 格），⟲ ⟳ 按钮 90° 旋转（旋转中心 = 屏幕中心的地面点），点格子显示地形。
- 暂不做 Service Worker；缓存靠 `npm run stamp                 # 新增 / 删除 / 重命名 src/ 下的 js 后运行：重新生成各页面启动脚本里的文件清单

## 版本号与缓存（不做 Service Worker）

- 版本号**只在 index.html 里**（`GM_VERSION`），主页跳转时带上 `?v=版本`：`battle.html?v=0.1.3`、`tests/xxx.html?v=0.1.3`。
- 每个页面 `<head>` 里的 `<!--GM-BOOT entry="…" css="…"-->` 之间是自动生成的启动脚本：读取 `?v=`，把 src/ 下每个 js 映射成 `路径?v=版本` 再加载入口模块。改了任何文件，只要在 index.html 里改一下版本号，所有页面全部拿新文件。
- 直接打开页面（没有 `?v=`）用时间戳，每次都拿最新；three.js 不跟版本号走。
- 新增测试页：复制一个现有页面，改 `entry` / `css` 两个属性，运行 `npm run stamp` 即可。

## 手机网页更新（自动应用升级包）
不用电脑也能整体更新：把我给的 zip **直接传到仓库根目录**，`.github/workflows/apply-package.yml` 会自动解压、覆盖、按清单删文件，再把 zip 删掉。
- **升级包**（`升级包_x到y.zip`，只含改动的文件，几十 KB）：日常用这个。里面的 `升级说明.md` 写着改了哪些文件；要删的文件在 `_delete.txt`，机器人会照着删。
- **完整包**（`Gridmarch_vX.zip`）：整个仓库，跳了很多版本 / 想一次对齐时用。机器人会让仓库和包**完全一致**（包里没有的文件会被删）。包必须带 `index.html`，否则拒绝。每传一次，zip 会留在 git 历史里（约 15 MB），所以别频繁用。
- 操作：手机浏览器打开仓库根目录 → Add file → Upload files → 选 zip（别在「文件」App 里点开解压）→ Commit changes。一两分钟后看 Actions 页 `apply-package` 是否绿勾，再刷新页面确认版本号。
- 限制：机器人**没有权限改 `.github/workflows/` 里的文件**，这类文件仍要手动上传（升级说明里会提示）。其他名字的 zip 一律不碰。
- 脚本是 `tools/apply-package.py`，也能在仓库根目录本地跑：`python3 tools/apply-package.py`。

## 文档

- `docs/HANDOFF.md`：**现状 + 已定决策 + 待决 + 下一步**（新窗口唯一必读）
- `docs/ARCHITECTURE.md`：分层、模块解析、世界约定、集成契约、测试
- `docs/ART_PACKAGES.md`：美术包版本表与换包流程
- `docs/HOME.md`：主页开发文档（版本号、菜单、视觉、避坑）
- `docs/CHANGELOG.md` + `docs/manifests/`：每个版本改了什么 / 文件指纹（生成升级包用）
- `docs/archive/`：历史文档，平时不用读
