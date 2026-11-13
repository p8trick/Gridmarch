# 方寸战线 · Gridmarch 主页开发文档

> 用法：只在要改主页时读。主页文件在 GitHub 仓库根目录（`index.html / home.css / home.js` …），整个仓库 zip 上传后我直接读，不需要单独上传 html。
> 原《主页开发文档 v1》已并入这里（v8 起），并补上版本号、跳转与开发入口的改动。

## 1. 项目与目标设备
- 回合制战棋（类高级战争），单文件优先的 iOS 独立 PWA，GitHub Pages 部署，仓库名 `Gridmarch`（已清空重建）。
- 目标设备仅两台：**iPhone 17 Pro**（横屏 874×402，3x）和 **iPad 2025 基础款 A16**（横屏 1180×820，2x，屏幕 2360×1640）。其他机型、竖屏均不适配。
- 竖屏只显示“请横屏使用”提示层（深蓝底 + 手机转横屏动画）。

## 2. 仓库文件
```
index.html  home.css  home.js  manifest.webmanifest  README.md
assets/
  home/    home-bg.webp（iPhone，2622×1206）  home-bg-ipad.webp（iPad，2360×1640）
  title/   title-zh.webp  title-en.webp（游戏内使用，宽 1400）
  icons/   apple-touch-icon.png(180)  icon-192.png  icon-512.png
  splash/  ipad-2360x1640-landscape.png（需自己放入，仅 iPad）
  _src/    PNG 美术母版：home-bg / title-zh / title-en / icon-master（游戏不引用）
```
- 素材一律放文件夹，不内嵌进代码；游戏内用 webp，PNG 母版放 `_src/`。

## 3. 已定决策
**菜单**：继续 / 单人对战 / 多人对战 / 编辑器 / 设置。
- 继续：读 `localStorage` 键 `gridmarch.save`，没有则置灰且不可点。
- 单人对战：跳 `BATTLE_URL`（= `battle.html?v=版本号`；以后改成选图页）。
- 多人对战、编辑器：点击弹“即将开放”。
- 开发入口不在菜单里：**2 秒内连点标题 5 次**跳 `DEV_URL`（= `tests/units-terrain.html?v=版本号`，单位 × 地形测试页，里面有「横屏测试」入口）。
- 菜单项在 `home.js` 顶部 `MENU` 数组，增删只改这里。

**视觉**：菜单是 CSS 画的斜切（−10°）平板条，深蓝半透明底 + 细高光 + “厚度”；选中变金色并右移 10px；中文主标签在左，英文小副标在右。不用毛玻璃，不用 blur。动效只用 `transform` / `opacity`，支持减少动态效果。

**标题**：最终稿 中文 V1.4.1、英文 V1.4（英文与 1.3 逐像素相同）。中英文**不同时出现**；只有一个 `<img id="title">`，设置里切语言时换 `src`。英文比中文宽很多，英文显示高度为中文的 **66%**（`home.css` 中 `.title[data-lang="en"] img`）。

**语言**：设置面板里的“中文 / English”，存 `gridmarch.lang`；英文模式菜单只显示英文，不带中文副标。

**背景**：`<picture>` 按屏幕比例选图，比例小于 16:9 用 iPad 图，其余用 iPhone 图；`object-fit: cover`，iPhone 焦点 55% 50%，iPad 居中。左侧有一层 CSS 渐变暗角保证菜单可读。

**图标与启动图**
- 图标用坦克图，`apple-touch-icon` 180 + 192 + 512 三个尺寸都保留。
- 启动图**必须是 PNG**，webp 不被 iOS 当启动图（推箱子上的白屏即此原因）。
- 只做 **iPad 横屏**一张；**iPhone 不做启动图**，竖屏直接显示“请横屏”提示。
- `<head>` 里有一行内联样式把 `html, body` 底色设为 `#0b1e36`，保证首帧不是白色。

**版本号**：全项目唯一的位置是 `index.html` 里的 `window.GM_VERSION`（新窗口起形如 `0.20`，小改动 +0.01）。
- 主页右下角显示 `v版本号`（`#ver`，样式在 `index.html` 内联 `<style>`；战场里不显示）。
- `home.css` 与 `home.js` 的引用地址由 `index.html` 里的小脚本带上 `?v=版本号`；跳转到战场页 / 测试页时网址也带 `?v=`，各页面的启动脚本据此给全部 js 加版本号（见 `docs/ARCHITECTURE.md` §2）。
- **每次更新文件后，把 `GM_VERSION` 加一位**，手机才不会继续用旧缓存。

## 4. 版式参数（`home.css` 顶部 `:root`）
| 变量 | 值 | 说明 |
|---|---|---|
| `--title-h` | `min(22vh, 10.5vw)` | 标题高度（中文），英文为其 66% |
| `--pad-l` | `5vw` | 左边距 |
| `--pad-t` | `7vh` | 上边距 |
| `--pad-b` | `3vh` | 下边距 |
| `--menu-top` | `4vh` | 标题与菜单间距 |
| `--menu-w` | `min(24vw, 240px)` | 菜单宽 |
| `--item-h` | `clamp(44px, 7vh, 56px)` | 条高，不低于 44pt |
| `--item-gap` | `clamp(4px, 1.1vh, 10px)` | 条间距 |

iPhone 横屏 402pt 高刚好放下 5 项；**再加菜单项会放不下**，需压条高或分两列。

## 5. 避坑
1. 容器用 `position: fixed; inset: 0`，**不用 `dvh`**；不处理安全区（灵动岛 / 手势区）、不留空白边，也不用安全区补高度（见 PWA 全屏指南）。
2. iOS 启动图要求 `media` 与设备尺寸精确匹配，差一个像素整张被忽略；只在“添加到主屏幕”时读取，换图后要**删掉旧图标重新添加**。
3. iOS PWA 会死缓存 js，没有 Service Worker：靠 `GM_VERSION` + 页面启动脚本给所有文件加 `?v=`（见上）。
4. 所有本地存储键以 `gridmarch.` 开头：`gridmarch.lang`、`gridmarch.save`。
5. 用 GitHub 网页上传文件时无法拖进文件夹；批量整理用 github.dev（仓库页按 `.`）。

## 6. 未完成 / 下一步
- 「单人对战」目前直接进第一关随机图；以后改成选图页（地图 json 由编辑器 / 生成器输出）。
- iPad 启动图 PNG 放入 `assets/splash/`。
- 设置里的画质（渲染比例、阴影、帧率上限）与音量目前是占位。
- 多人对战第一版倾向“同机轮流”，线上联机放最后；编辑器输出地图 json。
- 目标结构：根目录放页面入口，`src/` 放共用代码（引擎不碰 DOM / three，AI 只依赖引擎，数值全放 data），`tests/` 放测试页，地图 json 以后放 `maps/`。
- 虚拟横屏（`docs/HANDOFF.md` §5）目前只在 `tests/orientation.html` 里单独排查竖屏黑边；查清之前，战场页和主页保持真横屏（竖屏显示“请横屏使用”）。
