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
// 一个带包络的音：f0 → f1（指数滑音）持续 dur 秒，峰值 gain；lp = 可选低通（给方波 / 锯齿波去掉刺耳的高频）
function tone(t, f0, f1, dur, type, gain, lp) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g);
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(master); } else g.connect(master);
  o.start(t); o.stop(t + dur + .03);
}
// 一小撮带通噪声：给声音加一点颗粒感
function click(t, freq, dur, gain) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .05, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .01);
}
// 两套声音，名字一一对应（ui 里没有的名字就不出声）：
//   ui   = 菜单（主页 / 设置 / 暂停菜单 / 结算面板）：圆润的「啵」，玩具盒质感
//   game = 真正的游戏内操作（棋盘点按、选单位、浮条、兵工厂、详细面板、战场情报、右上角按钮）：军事机械味——开关咔嗒、电台哔哔、冲压盖章、棘轮上膛
const BANKS = {
  ui: {
    tap(t) { const k = .97 + Math.random() * .06; tone(t, 760 * k, 430 * k, .085, 'sine', .24); tone(t, 1520 * k, 1520 * k, .03, 'triangle', .06); click(t, 4200, .014, .07); },
    ok(t) { tone(t, 523.25, 523.25, .11, 'triangle', .17); tone(t + .075, 783.99, 783.99, .17, 'triangle', .19); tone(t + .075, 1567.98, 1567.98, .12, 'sine', .05); click(t, 3600, .012, .05); },
    back(t) { tone(t, 600, 390, .12, 'triangle', .17); tone(t + .03, 300, 220, .1, 'sine', .08); },
    open(t) { tone(t, 392, 660, .13, 'sine', .14); tone(t + .05, 784, 990, .1, 'sine', .06); },
    deny(t) { tone(t, 160, 120, .1, 'square', .07, 900); tone(t + .11, 150, 110, .13, 'square', .07, 900); },
  },
  game: {
    tap(t) { click(t, 5200, .012, .11); tone(t, 220, 140, .05, 'sine', .2); tone(t, 1800, 1800, .012, 'square', .03, 3000); },          // 开关咔嗒
    select(t) { tone(t, 1318, 1318, .045, 'square', .06, 4000); tone(t + .065, 1760, 1760, .06, 'square', .06, 4000); click(t, 2500, .01, .05); },   // 电台「哔哔」：选中单位
    cell(t) { click(t, 2200, .02, .09); tone(t, 330, 250, .04, 'sine', .13); },                                                    // 棋盘上的小「嗒」：点空格 / 地形
    go(t) { tone(t, 90, 210, .17, 'sawtooth', .09, 650); click(t, 1500, .02, .07); tone(t + .12, 880, 880, .05, 'square', .04, 3500); },  // 下达移动命令：发动机一轰 + 一声「收到」
    ok(t) { tone(t, 140, 70, .13, 'sine', .32); tone(t, 1180, 1180, .14, 'triangle', .07); tone(t, 1770, 1770, .1, 'triangle', .05); click(t, 3000, .02, .1); },   // 盖章 / 钢板一响：占领、合流、生产、攻击、确认结束回合
    wait(t) { tone(t, 200, 100, .08, 'sine', .24); click(t, 2600, .015, .07); },                                                   // 待命：轻一点的盖章
    arm(t) { click(t, 3500, .01, .12); click(t + .055, 2600, .012, .12); tone(t + .055, 300, 300, .05, 'square', .04, 1500); },    // 棘轮上膛：进入选目标
    back(t) { tone(t, 420, 260, .06, 'square', .05, 2500); click(t, 1800, .015, .06); },                                           // 取消 / 撤销 / 点面板外
    open(t) { click(t, 2000, .06, .08); tone(t + .04, 990, 990, .07, 'square', .05, 3500); tone(t + .1, 1320, 1320, .09, 'square', .05, 3500); },   // 电台静电 + 一声「滴」：打开详细面板 / 情报 / 兵工厂
    deny(t) { tone(t, 160, 120, .1, 'square', .07, 900); tone(t + .11, 150, 110, .13, 'square', .07, 900); },
  },
};

export const sfx = {
  last: null,   // 最近一次出声的 {bank, name}（冒烟测试用）
  play(name, bank = 'ui') {
    if (!on) return;
    const fn = BANKS[bank] && BANKS[bank][name]; if (!fn) return;
    const now = performance.now(); if (now - last0 < 35) return; last0 = now;
    const c = ensure(); if (!c) return;
    this.last = {bank, name}; fn(c.currentTime + .005);
  },
  get enabled() { return on; },
  setEnabled(v) { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} if (on) this.play('tap'); },
  unlock() { ensure(); },
  // 挂全局监听（只挂一次）。点哪种元素出哪种声音，规则都在 kindOf 里；棋盘上的点按（选单位 / 点格 / 走 / 撤销…）由 main.js 直接 sfx.play(名字, 'game')
  install(doc = document) {
    if (installed) return; installed = true;
    doc.addEventListener('pointerdown', () => { if (on) ensure(); }, true);
    doc.addEventListener('click', e => { const k = kindOf(e.target); if (k) this.play(k[1], k[0]); }, true);
  },
};
let last0 = 0;

const CLICKABLE = 'button, [role=button], #hudL, [data-k], .abtn';
const MENU = '#homeView, #pause, .sheet, .res:not(.int), .res-tag, #bMenu';   // 菜单：主页、设置、暂停菜单、结算面板、右上角的菜单键；其余战场内的都算游戏本身
const BACK_ACTS = new Set(['close', 'back', 'resume', 'view', 'cancel']), OK_ACTS = new Set(['ok', 'capture', 'join', 'again', 'produce']);
// 返回 [声音库, 名字]；null = 不出声
function kindOf(t) {
  if (!t || !t.closest || t.tagName === 'CANVAS') return null;
  const menu = !!t.closest(MENU), bank = menu || !t.closest('#battle') ? 'ui' : 'game';
  const b = t.closest(CLICKABLE);
  if (b) {
    if (b.closest('[disabled],[aria-disabled=true],.off')) return null;   // 灰着的：不出声
    const act = b.dataset.act;
    if (b.classList.contains('arm') && t.closest('.pr')) return [bank, /不足|暂不可|未建模/.test(t.closest('.pr').textContent) ? 'deny' : 'ok'];   // 兵工厂：点已选中的卡的价格签 = 买
    if (b.classList.contains('close') || b.id === 'closeSettings' || BACK_ACTS.has(act)) return [bank, 'back'];
    if (bank === 'game' && act === 'wait') return [bank, 'wait'];
    if (bank === 'game' && act === 'attack') return [bank, 'arm'];
    if (OK_ACTS.has(act) || b.dataset.id === 'single' || b.classList.contains('main') && b.classList.contains('res-btn')) return [bank, 'ok'];
    return [bank, 'tap'];
  }
  // 点面板外面的暗处 = 关闭
  const o = t.closest('.det, .int, #pause, #endm, .sheet');
  if (o && (o.classList.contains('det') || o.classList.contains('int') ? !t.closest('.dt-box, .res-box') : t === o)) return [bank, 'back'];
  return null;
}
