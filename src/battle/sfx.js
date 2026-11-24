// 界面音效（0.94）：全部用 WebAudio 现场合成，没有音频文件。主页 + 战场的所有按钮 / 菜单点击都走这里。
// 做法：在 document 上挂一个捕获阶段的 click 监听（install，只挂一次），按点中的元素挑一种声音：
//   tap = 普通点按（软「啵」）· ok = 确认 / 开始 / 生产 / 占领（两个上行音）· back = 关闭 / 返回 / 继续 / 点面板外（下行音）· open = 长按打开面板 · deny = 点了灰的「生产」（低沉嗡）
// 点棋盘（canvas）不出声；灰着的按钮不出声。iOS 要用户手势才能发声：首次 pointerdown 时建立并唤醒 AudioContext。
// 开关存本机（localStorage gridmarch.sfx，'0' = 关）：主页设置的「音量」行、战场暂停菜单第二页的「音效」都读写它。
const KEY = 'gridmarch.sfx', VOL = .75, AC = window.AudioContext || window.webkitAudioContext;
let ctx = null, master = null, noiseBuf = null, last = 0, installed = false, on = true;
try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}

function ensure() {
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC({latencyHint: 'interactive'}); master = ctx.createGain(); master.gain.value = VOL;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    } catch (e) { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// 一个带包络的音：f0 → f1（指数滑音）持续 dur 秒，峰值 gain
function tone(t, f0, f1, dur, type, gain) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .03);
}
// 一小撮带通噪声：给「啵」加一点点颗粒感（像塑料玩具按键）
function click(t, freq, dur, gain) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .05, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .01);
}
const SOUNDS = {
  tap(t) { const k = .97 + Math.random() * .06; tone(t, 760 * k, 430 * k, .085, 'sine', .24); tone(t, 1520 * k, 1520 * k, .03, 'triangle', .06); click(t, 4200, .014, .07); },
  ok(t) { tone(t, 523.25, 523.25, .11, 'triangle', .17); tone(t + .075, 783.99, 783.99, .17, 'triangle', .19); tone(t + .075, 1567.98, 1567.98, .12, 'sine', .05); click(t, 3600, .012, .05); },
  back(t) { tone(t, 600, 390, .12, 'triangle', .17); tone(t + .03, 300, 220, .1, 'sine', .08); },
  open(t) { tone(t, 392, 660, .13, 'sine', .14); tone(t + .05, 784, 990, .1, 'sine', .06); },
  deny(t) { tone(t, 160, 120, .1, 'square', .07); tone(t + .11, 150, 110, .13, 'square', .07); },
};

export const sfx = {
  play(name) {
    if (!on) return;
    const now = performance.now(); if (now - last < 35) return; last = now;
    const c = ensure(); if (!c || !SOUNDS[name]) return;
    SOUNDS[name](c.currentTime + .005);
  },
  get enabled() { return on; },
  setEnabled(v) { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} if (on) this.play('tap'); },
  unlock() { ensure(); },
  // 挂全局监听（只挂一次）。点哪种元素出哪种声音，规则都在 kindOf 里
  install(doc = document) {
    if (installed) return; installed = true;
    doc.addEventListener('pointerdown', () => { if (on) ensure(); }, true);
    doc.addEventListener('click', e => { const k = kindOf(e.target); if (k) this.play(k); }, true);
  },
};

const CLICKABLE = 'button, [role=button], #hudL, [data-k], .abtn';
const BACK_ACTS = new Set(['close', 'back', 'resume', 'view', 'cancel']), OK_ACTS = new Set(['ok', 'capture', 'join', 'again']);
function kindOf(t) {
  if (!t || !t.closest || t.tagName === 'CANVAS') return null;
  const b = t.closest(CLICKABLE);
  if (b) {
    if (b.closest('[disabled],[aria-disabled=true],.off')) return null;   // 灰着的：不出声
    const act = b.dataset.act;
    if (b.classList.contains('arm') && t.closest('.pr')) return /不足|暂不可|未建模/.test(t.closest('.pr').textContent) ? 'deny' : 'ok';   // 兵工厂：点已选中的卡的价格签 = 买
    if (b.classList.contains('close') || b.id === 'closeSettings' || BACK_ACTS.has(act)) return 'back';
    if (OK_ACTS.has(act) || b.dataset.id === 'single' || b.classList.contains('main') && b.classList.contains('res-btn')) return 'ok';
    return 'tap';
  }
  // 点面板外面的暗处 = 关闭
  const o = t.closest('.det, .int, #pause, #endm, .sheet');
  if (o && (o.classList.contains('det') || o.classList.contains('int') ? !t.closest('.dt-box, .res-box') : t === o)) return 'back';
  return null;
}
