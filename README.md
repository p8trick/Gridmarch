# 方寸战线 · Gridmarch

回合制战棋（类高级战争），单文件优先的 PWA，部署在 GitHub Pages。

```
index.html  home.css  home.js    主页（菜单配置在 home.js 顶部的 MENU）
assets/
  home/    主页背景 webp
  title/   中英文标题 webp（游戏内使用）
  _src/    PNG 美术母版（游戏不引用）
```

约定
- 游戏内只用 webp，PNG 母版放 `assets/**/_src/`。
- 中英文标题不同时出现，语言切换在设置里，存于 localStorage `gridmarch.lang`。
- 所有本地存储键以 `gridmarch.` 开头。
- 主页开发入口：连点标题 5 次 → `BATTLE_TEST_URL`（见 home.js）。
