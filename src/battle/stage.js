// 虚拟横屏舞台：iPhone 的 PWA 不能锁横屏，系统被水平仪误翻成竖屏时体验很糟。
// 做法：页面里所有内容放进一个"舞台"；系统是横屏就原样显示，系统是竖屏就把舞台旋转 90°，画面照样是横的。
// 配合 iPhone 控制中心的"竖屏方向锁定"（打开后系统永远不翻转），就等于锁死横屏：把手机横过来握着玩即可。
//
// 旋转带来的唯一麻烦是坐标：DOM 按钮由浏览器自己处理变换，不用管；canvas / 触摸的 clientX、clientY 是物理屏幕坐标，
// 要用 toLogical() 换算成舞台坐标，拖动向量用 vec()。逻辑尺寸取 stage.w / stage.h（代替 innerWidth / innerHeight）。
// side：'left' = 灵动岛在舞台左边（顺时针转 90°），'right' = 灵动岛在舞台右边（逆时针转 90°），会记住上次的选择。
// 不处理安全区（灵动岛 / 手势区）：画面铺满，控件只留固定小边距，不加空白或白边；代码里不用 env(safe-area-*)。
// CSS 里用 var(--sw) / var(--sh)（舞台宽高的 1%）代替 vw / vh。
//
// 测量方式（0.24 起可现场切换，用来排查竖屏黑边）：默认 'vh'（100vw×100vh 探针），其余见 MODES。
// 现场诊断：长按「换边」按钮 0.8 秒 → stageDebug()：画出各种单位量到的屏幕边界、显示数字、可点按钮切换测量方式。
const KEY = 'gm.stageSide', MKEY = 'gm.measure';
export const MODES = ['vh', 'lvh', 'svh', 'dvh', 'inner', 'screen', 'fixed'];
const modeNow = () => { try { const m = localStorage.getItem(MKEY); if (MODES.includes(m)) return m; } catch (e) {} return 'vh'; };

// 纯函数（Node 里可测试）：rot ∈ {0, 90, -90}；W、H 是物理视口宽高
export const toLogical = (rot, W, H, cx, cy) => rot === 90 ? {x: cy, y: W - cx} : rot === -90 ? {x: H - cy, y: cx} : {x: cx, y: cy};
export const toPhysical = (rot, W, H, lx, ly) => rot === 90 ? {x: W - ly, y: lx} : rot === -90 ? {x: ly, y: H - lx} : {x: lx, y: ly};
export const vec = (rot, dx, dy) => rot === 90 ? {x: dy, y: -dx} : rot === -90 ? {x: -dy, y: dx} : {x: dx, y: dy};

export class Stage {
  constructor(el, {side} = {}) {
    this.el = el; this.side = side || (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'left';
    this.listeners = [];
    // 量视口的探针（隐形固定层）。iOS 独立窗口里 innerHeight（有时连 100dvh）会比真实屏幕矮一截，
    // 所以默认量 100vw×100vh（见 PWA 全屏指南）；哪种量法在真机上铺满，用 stageDebug 现场试。
    this.probe = document.createElement('div');
    document.documentElement.appendChild(this.probe);
    const again = () => { this.update(); setTimeout(() => this.update(), 120); setTimeout(() => this.update(), 400); };   // iOS 旋转时 innerWidth/Height 会滞后一拍
    addEventListener('resize', again); addEventListener('orientationchange', again);
    this.update();
  }
  onChange(f) { this.listeners.push(f); }
  setSide(side) { this.side = side; try { localStorage.setItem(KEY, side); } catch (e) {} this.update(); }
  toggleSide() { this.setSide(this.side === 'left' ? 'right' : 'left'); }
  setMode(m) { try { localStorage.setItem(MKEY, m); } catch (e) {} this.update(); }
  measure() {
    const m = modeNow(); let W = 0, H = 0;
    if (m === 'inner') { W = innerWidth; H = innerHeight; }
    else if (m === 'screen') {   // screen.width/height 在 iOS 上不随旋转交换，按当前是竖是横自己排
      const a = screen.width, b = screen.height, portrait = innerWidth < innerHeight;
      W = portrait ? Math.min(a, b) : Math.max(a, b); H = portrait ? Math.max(a, b) : Math.min(a, b);
    } else {
      this.probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' + (m === 'fixed' ? 'inset:0' : `left:0;top:0;width:100${m.replace('h', 'w')};height:100${m}`);
      const r = this.probe.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height);
    }
    return W > 0 && H > 0 ? {W, H} : {W: innerWidth, H: innerHeight};   // 量不到（单位不支持等）就退回 inner
  }
  update() {
    const {W, H} = this.measure(), rot = W >= H ? 0 : this.side === 'left' ? 90 : -90;
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

// 长按（默认 0.8 秒）触发 fn，并吞掉随后的那次点击（所以长按「换边」不会真的换边）。要在添加 click 处理之前调用。
export function onLongPress(el, fn, ms = 800) {
  let t = 0, fired = false;
  const clear = () => clearTimeout(t);
  el.addEventListener('pointerdown', () => { fired = false; clear(); t = setTimeout(() => { fired = true; fn(); }, ms); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => el.addEventListener(n, clear));
  el.addEventListener('click', e => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
}

// 现场诊断：再调用一次就关闭。
// 屏幕上画「各种单位量到的右边 / 下边」：红 = position:fixed;inset:0，青 = 100vh，黄 = 100lvh，绿 = 100svh，粉 = 100dvh，白 = innerWidth/Height；
// 橙色细框 = 舞台实际占的区域。竖握手机时，看哪条线贴着屏幕最底下的边、哪条线缩在里面（线在屏幕外就看不到）。
// 面板在舞台里（跟着转，可读）：显示数字，并有按钮现场切换测量方式 —— 哪个切过去黑边消失，就告诉我哪个。
export function stageDebug(stage) {
  if (stage.dbg) { stage.dbg.close(); return; }
  const nodes = [], add = (css, parent = document.documentElement) => { const d = document.createElement('div'); d.style.cssText = css; parent.appendChild(d); nodes.push(d); return d; };
  const edge = (w, h, color, t) => add(`position:fixed;left:0;top:0;width:${w};height:${h};box-sizing:border-box;border-right:${t}px solid ${color};border-bottom:${t}px solid ${color};pointer-events:none;z-index:2147483646`);
  edge('100%', '100%', 'red', 14);   // 100% 对固定定位 = 布局视口；用 inset:0 的同义写法
  edge('100vw', '100vh', 'cyan', 12); edge('100lvw', '100lvh', 'yellow', 10); edge('100svw', '100svh', 'lime', 8); edge('100dvw', '100dvh', 'magenta', 6);
  const inner = edge('0px', '0px', 'white', 4), box = add('position:fixed;pointer-events:none;z-index:2147483646;box-sizing:border-box;border:3px solid orange');
  const probe = (css) => add('position:fixed;visibility:hidden;pointer-events:none;' + css);
  const pv = ['vh', 'lvh', 'svh', 'dvh'].map(u => [u, probe(`left:0;top:0;width:1px;height:100${u}`)]), pf = probe('inset:0'), pe = probe('padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)');
  const panel = add('position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;background:rgba(0,0,0,.8);color:#fff;font:11px/1.55 ui-monospace,Menlo,monospace;padding:8px 10px;border-radius:10px;pointer-events:auto;white-space:pre;max-width:96%', stage.el);
  const txt = document.createElement('div'), row = document.createElement('div'); panel.append(txt, row); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px';
  const btns = MODES.concat(['关闭']).map(m => { const b = document.createElement('button'); b.textContent = m; b.style.cssText = 'font:inherit;padding:5px 9px;border-radius:7px;border:1px solid #888;background:#223;color:#fff'; b.onclick = () => m === '关闭' ? close() : (stage.setMode(m), tick()); row.appendChild(b); return b; });
  const tick = () => {
    stage.update();
    const g = e => e.getBoundingClientRect(), cs = getComputedStyle(pe), vv = window.visualViewport, b = g(stage.el), cur = modeNow();
    inner.style.width = innerWidth + 'px'; inner.style.height = innerHeight + 'px';
    Object.assign(box.style, {left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px'});
    txt.textContent = `测量方式 ${cur}　舞台 ${stage.w}×${stage.h}　rot ${stage.rot}　(物理 ${stage.W}×${stage.H})\n` +
      `inner ${innerWidth}×${innerHeight}　screen ${screen.width}×${screen.height}　client ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}　visualViewport ${vv ? Math.round(vv.width) + '×' + Math.round(vv.height) : '-'}\n` +
      '高度：' + pv.map(([u, e]) => `${u} ${Math.round(g(e).height)}`).join('　') + `　fixed ${Math.round(g(pf).height)}\n` +
      `系统安全区(仅供参考，代码不用) 上${cs.paddingTop} 右${cs.paddingRight} 下${cs.paddingBottom} 左${cs.paddingLeft}\n` +
      '线：红=fixed 青=100vh 黄=lvh 绿=svh 粉=dvh 白=inner 橙框=舞台';
    btns.forEach(x => x.style.background = x.textContent === cur ? '#0a7' : '#223');
  };
  const timer = setInterval(tick, 400), close = () => { clearInterval(timer); nodes.forEach(n => n.remove()); stage.dbg = null; };
  stage.dbg = {close}; tick();
}
