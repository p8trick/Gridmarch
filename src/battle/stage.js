// 虚拟横屏舞台：iPhone 的 PWA 不能锁横屏，系统被水平仪误翻成竖屏时体验很糟。
// 做法：页面里所有内容放进一个"舞台"；系统是横屏就原样显示，系统是竖屏就把舞台旋转 90°，画面照样是横的。
// 配合 iPhone 控制中心的"竖屏方向锁定"（打开后系统永远不翻转），就等于锁死横屏：把手机横过来握着玩即可。
//
// 旋转带来的唯一麻烦是坐标：DOM 按钮由浏览器自己处理变换，不用管；canvas / 触摸的 clientX、clientY 是物理屏幕坐标，
// 要用 toLogical() 换算成舞台坐标，拖动向量用 vec()。逻辑尺寸取 stage.w / stage.h（代替 innerWidth / innerHeight）。
// side：'left' = 灵动岛在舞台左边（顺时针转 90°），'right' = 灵动岛在舞台右边（逆时针转 90°），会记住上次的选择。
// 不处理安全区（灵动岛 / 手势区）：画面铺满，控件只留固定小边距，不加空白或白边。
// 尺寸取 100vw×100vh 探针而不是 innerWidth/Height（见 constructor）；CSS 里用 var(--sw) / var(--sh)（舞台宽高的 1%）代替 vw / vh。
const KEY = 'gm.stageSide';

// 纯函数（Node 里可测试）：rot ∈ {0, 90, -90}；W、H 是物理视口宽高
export const toLogical = (rot, W, H, cx, cy) => rot === 90 ? {x: cy, y: W - cx} : rot === -90 ? {x: H - cy, y: cx} : {x: cx, y: cy};
export const toPhysical = (rot, W, H, lx, ly) => rot === 90 ? {x: W - ly, y: lx} : rot === -90 ? {x: ly, y: H - lx} : {x: lx, y: ly};
export const vec = (rot, dx, dy) => rot === 90 ? {x: dy, y: -dx} : rot === -90 ? {x: -dy, y: dx} : {x: dx, y: dy};

export class Stage {
  constructor(el, {side} = {}) {
    this.el = el; this.side = side || (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'left';
    this.listeners = [];
    // 量视口的探针：100vw × 100vh 的隐形固定层。iOS 独立窗口里 innerHeight（和 100dvh）会比真实屏幕矮一截（手势区那一段），
    // 竖屏转成"横屏"后，那一段就成了舞台侧边的黑条；100vh 才是整块屏幕（见 PWA 全屏指南），所以尺寸取探针，不取 innerHeight。
    this.probe = document.createElement('div');
    this.probe.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;visibility:hidden;pointer-events:none';
    document.documentElement.appendChild(this.probe);
    const again = () => { this.update(); setTimeout(() => this.update(), 120); setTimeout(() => this.update(), 400); };   // iOS 旋转时 innerWidth/Height 会滞后一拍
    addEventListener('resize', again); addEventListener('orientationchange', again);
    this.update();
  }
  onChange(f) { this.listeners.push(f); }
  setSide(side) { this.side = side; try { localStorage.setItem(KEY, side); } catch (e) {} this.update(); }
  toggleSide() { this.setSide(this.side === 'left' ? 'right' : 'left'); }
  update() {
    const r = this.probe.getBoundingClientRect(), ok = r.width > 0 && r.height > 0;
    const W = ok ? Math.round(r.width) : innerWidth, H = ok ? Math.round(r.height) : innerHeight, rot = W >= H ? 0 : this.side === 'left' ? 90 : -90;
    if (W === this.W && H === this.H && rot === this.rot && this.sideApplied === this.side) return;
    Object.assign(this, {W, H, rot, w: rot ? H : W, h: rot ? W : H, sideApplied: this.side});
    const t = rot === 90 ? `translate(${W}px,0) rotate(90deg)` : rot === -90 ? `translate(0,${H}px) rotate(-90deg)` : 'none';
    this.el.style.cssText = `position:fixed;left:0;top:0;width:${this.w}px;height:${this.h}px;transform-origin:0 0;transform:${t};overflow:hidden`;
    this.el.style.setProperty('--sw', this.w / 100 + 'px'); this.el.style.setProperty('--sh', this.h / 100 + 'px');   // 舞台宽 / 高的 1%：CSS 里代替 vw / vh
    this.listeners.forEach(f => f(this));
  }
  toLogical(cx, cy) { return toLogical(this.rot, this.W, this.H, cx, cy); }
  vec(dx, dy) { return vec(this.rot, dx, dy); }
}
