# 更新日志（1.01 起）

> 1.00 及以前的日志在 `docs/archive/CHANGELOG_至0.90.md`、`docs/archive/CHANGELOG_0.91至1.00.md`（不用读）。新日志从这里往下加，每条 5–8 行。

## 1.01
- 「找单位」键：镜头只在闲置单位之间轮换。多个闲置单位依次轮转（轮完回到第 1 个）；镜头已停在「下一个」单位身上时这一下直接跳过它；只剩一个闲置单位时，每按一下都对准它，不再来回切到开始前位置 / 基地视角。（`src/battle/main.js` `bNext.onclick`；结束回合的镜头记忆仍用 `cycleHome`，没动）
- 新增毛玻璃提示页 `blur-tip.html` + `src/battle/blur-tip.js`：主页右下角版本号可点击进入；全黑底、虚拟横屏舞台（真横屏 rot=0 同样适配）；亮条 + 动画箭头标出返回手势的起点边（虚拟横屏在舞台下 / 上边，真横屏在左边，随旋转实时切）；「返回主页」按钮是手势失灵时的保底；随 `gridmarch.lang` 中英文。
- 版本号元素 `#ver` 从 div 改成 button（点击热区加大，文字位置不变）。
- 冒烟 `smoke-cycle.py` 按新规则重写（轮转 / 跳过当前 / 唯一单位）；`smoke-camrem` 通过。

## 1.02
- 语言包框架：新增 `src/i18n/`（`index.js` 的 `t('键', {参数})` / `setLang` / `getLang` / `onLang`，`zh.js`、`en.js` 两份字典）。语言沿用主页的 `gridmarch.lang`；英文缺词自动退回中文并在控制台提示一次，所以可以边译边发。主页（classic 脚本）和提示页自带的小字典这一版不动。
- `src/rules/data.js`：单位 / 地形 / 军队风格的 `name` 改成随语言取词的 getter（词条键 `unit.*` / `terrain.*` / `style.*`），原有 `.name` 调用处不用改；规则和存档里一直只存 id。英文名：Infantry、Anti-Tank Infantry、Recon Vehicle、APC、Light / Medium / Heavy Tank、Artillery、Rocket Artillery、Anti-Air Gun、AA Missile；地形 Plains … Swamp。
- 新增 `tools/check-i18n.mjs`（已并入 `npm test`）：zh / en 键一一对应、无空词条、`{占位符}` 两边一致、每个 id 都有词条、getter 随语言切换；并报告 src 里还剩多少写死的中文（当前约 631 处）作为迁移进度。
- 说明：英文模式下界面其余文字仍是中文，1.03 起分批迁移（1.03 战斗主界面，1.04 详细面板 / explain / 情报 / 兵工厂，1.05 战报 / 结算 / 地图名）。

