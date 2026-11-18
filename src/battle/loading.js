// 加载进度条（0.63）：进入战斗（含第一次下载模块）和「换图」时显示。0.65 起进度条上方有一个跑步的步兵，站在填充端上跟着前进。
// 为什么进度条能在主线程被生成战场卡住时继续动：填充条用 transform（translateX）做 CSS transition，走合成器线程，不受 JS 阻塞影响。
// 所以「进度」由两部分组成：
//   · 真实进度：下载模块时按已下载文件数推进（home.js 预载时调用 set）；
//   · 估计进度：生成战场是一大段同步计算（中途没法更新页面），这段按「上次实际耗时」做缓动，走到约 92% 停住，真正完成后补满。上次耗时记在 localStorage（gm.buildMs），越用越准。
const KEY = 'gm.buildMs';
export const RUNNER_FRAMES = Array.from({length: 12}, (_, i) => `assets/loading/runner-${String(i).padStart(2, '0')}.webp`);   // 帧图由 tools/make-runner-frames.py 从游戏里的步兵模型拍出来（透明底、蓝军、面朝右）
export const lastBuildMs = () => { try { return Math.min(12000, Math.max(800, +localStorage.getItem(KEY) || 2600)); } catch (e) { return 2600; } };
export const saveBuildMs = ms => { try { localStorage.setItem(KEY, String(Math.round(lastBuildMs() * .4 + ms * .6))); } catch (e) { /* 存不了就算了 */ } };

export function createLoading(label = '正在载入…') {
  const el = document.createElement('div'); el.id = 'loading';
  // 跑步步兵：12 张帧图叠放，用 CSS opacity 关键帧逐帧切换（每张只在自己那 1/12 周期里可见）；位置用和填充条同一个 translateX 缓动。
  // opacity / transform 动画都走合成器线程，生成战场卡住主线程的那几秒里步兵也继续跑（iOS Safari 是否同样如此需要真机确认；最坏情况是定格在某一帧，进度条照常走）
  el.innerHTML = '<div class="ld-box"><div class="ld-title">方寸战线</div><div class="ld-lane"><div class="ld-slide"><div class="ld-runner">' + RUNNER_FRAMES.map((u, i) => `<img src="${u}" alt="" decoding="async" style="animation-delay:${(i * 0.06).toFixed(2)}s">`).join('') + '</div></div></div><div class="ld-bar"><i class="ld-fill"></i></div><div class="ld-label"></div></div>';
  const fill = el.querySelector('.ld-fill'), slide = el.querySelector('.ld-slide'), lab = el.querySelector('.ld-label'); lab.textContent = label;
  let pct = 0; fill.style.transform = slide.style.transform = 'translateX(-100%)';
  const api = {
    el,
    attach(host) { if (el.parentNode !== host) host.appendChild(el); return api; },   // mountBattle 会重写 host.innerHTML，之后要重新挂上
    label(t) { lab.textContent = t; return api; },
    // 把进度移到 p（0–100）；ms > 0 = 用 ms 毫秒缓动过去（先快后慢），0 = 立刻
    to(p, ms = 0) {
      pct = Math.max(pct, Math.min(100, p));   // 只增不减
      const tr = ms ? `transform ${ms}ms cubic-bezier(.22,.6,.35,1)` : 'none';
      fill.style.transition = slide.style.transition = tr;
      void fill.offsetWidth;   // 先让上一个状态生效，缓动才会从当前位置起步
      fill.style.transform = slide.style.transform = `translateX(${pct - 100}%)`;
      return api;
    },
    // 完成：补满 → 淡出 → 移除
    done() {
      api.to(100, 180);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 200);
    },
    remove() { el.remove(); },
  };
  return api;
}

// 预载一批文件并回报进度：fetch 把它们放进浏览器缓存，之后 import 直接命中。失败的文件忽略（import 时会自己报错）。
export async function preload(urls, onProgress, concurrency = 6) {
  let done = 0, i = 0; const total = urls.length;
  async function worker() { while (i < total) { const u = urls[i++]; try { await fetch(u); } catch (e) { /* 忽略 */ } onProgress(++done / total); } }
  await Promise.all(Array.from({length: Math.min(concurrency, total)}, worker));
}
