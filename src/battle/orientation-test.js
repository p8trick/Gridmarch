import {Stage, stageDebug} from './stage.js';
// 虚拟横屏测试页。用法：
//  1. 在 iPhone 控制中心打开「竖屏方向锁定」，从主页进入本页（竖握手机时画面应该横过来）。
//  2. 把手机横过来握着：文字应该是正的；灵动岛（红色标记）在你选的那一边。不对就点「换边」。
//  3. 随便划、双指缩放、点底部 5 个按钮：十字准星应该跟手指完全重合；数字里的"舞台坐标"在四个角应是 (0,0)…(宽,高)。
//  3.5 看有没有黑条：竖握手机时，画面四边都应该铺满到屏幕边缘（包括回主页横条那一边）；还有黑条就截图发我，第一行数字是关键。
//  3.6 排查黑边（竖握、竖屏锁定）：依次试顶部「旋转」「容器」两个开关的 4 种组合（诊断面板里还能换测量方式），告诉我哪几种底部有空白、哪几种是满的。
//  3.7 边距测试（0.92）：点右上「边距」→ 灵动岛那一侧画出红色避让带 + 一条黄线（边距）+ 一条青色虚线（按钮倾斜后的最近角 = 可见边缘）+ 三排 0~120px 直尺 + 两个游戏样式的示意按钮。用中间的 −5 −1 +1 +5 调（也可以直接在屏幕上拖），
//      调到示意按钮刚好不被 iOS 27 顶部的毛玻璃糊到为止，把数字发给我——游戏里 --pad-l 的 56px 就按它改。数字会记在本机（刷新不丢）。
//  4. 专门试：从灵动岛那一边、从回主页横条那一边的屏幕边缘起手往里划，看是否误触退出（下面"边缘起手"会计数；"离开页面"计数 > 0 就是被系统手势退出过了）。
const $ = id => document.getElementById(id);
const stage = new Stage($('stage')), cv = $('c'), g = cv.getContext('2d');
stageDebug(stage);   // 测试页打开就带现场诊断（再长按「换边」可关）
// 排查开关（竖屏黑边）：「旋转」开 / 关 = 竖屏时画面转不转 90°；「容器」100vh / fixed = html、body 的写法（100vh 是对的，fixed 会留白）。
// 都不保存：刷新就恢复默认（旋转开、容器 100vh）。
let rootVh = true;
const applyToggles = () => { document.documentElement.classList.toggle('vh', rootVh); $('bRoot').textContent = '容器:' + (rootVh ? '100vh' : 'fixed'); $('bRot').textContent = '旋转:' + (stage.noRot ? '关' : '开'); };
$('bRoot').onclick = () => { rootVh = !rootVh; applyToggles(); stage.update(); };
$('bRot').onclick = () => { stage.setNoRot(!stage.noRot); applyToggles(); };
applyToggles(); stage.update();
let trails = new Map(), edgeStarts = 0, hidden = 0, lastTap = '';
// 边距测试（0.92）：m = 游戏里 --pad-l（离短边的距离，px）；按钮倾斜后最靠边的角比 m 退进 4px，所以「可见边缘」= m - 4。游戏现在是 56（可见 52）。
const PAD_NOW = 56, SKEW = 4; let marginOn = false, m = PAD_NOW;
try { const v = parseInt(localStorage.getItem('gm.padL')); if (v >= 20 && v <= 160) m = v; } catch (e) {}
const setM = v => { m = Math.max(20, Math.min(160, Math.round(v))); try { localStorage.setItem('gm.padL', String(m)); } catch (e) {} };
const islandSides = () => stage.rot === 0 ? ['L', 'R'] : [stage.rot === 90 ? 'L' : 'R'];   // 竖屏转横：只画灵动岛那一侧；系统横屏：岛在哪一边不确定，两侧都画
function drawMargin() {
  const w = stage.w, h = stage.h; g.save();
  for (const sd of islandSides()) {
    const dir = sd === 'L' ? 1 : -1, X = d => (sd === 'L' ? 0 : w) + dir * d, band = (a, b) => [Math.min(X(a), X(b)), Math.abs(b - a)];
    let [bx, bw] = band(0, m); g.fillStyle = 'rgba(226,64,64,.20)'; g.fillRect(bx, 0, bw, h);
    // 直尺：从岛那一侧的屏幕边起量，三排；每 5px 一小格，每 10px 中格，每 20px 大格 + 数字
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 1; g.font = '10px -apple-system,system-ui'; g.textAlign = 'center';
    for (const fy of [.62, .74, .86]) { const y = Math.round(h * fy) + .5;
      g.beginPath(); g.moveTo(X(0), y); g.lineTo(X(130), y);
      for (let d = 0; d <= 130; d += 5) { const L = d % 20 === 0 ? 14 : d % 10 === 0 ? 9 : 5; g.moveTo(X(d) + .5, y); g.lineTo(X(d) + .5, y - L); }
      g.stroke(); for (let d = 20; d <= 120; d += 20) g.fillText(String(d), X(d), y + 12); }
    // 边距线（黄，实线）和可见边缘（青，虚线）
    g.lineWidth = 2; g.strokeStyle = '#ffd84a'; g.beginPath(); g.moveTo(X(m), 0); g.lineTo(X(m), h); g.stroke();
    g.strokeStyle = '#4ae0ff'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(X(m - SKEW), 0); g.lineTo(X(m - SKEW), h); g.stroke(); g.setLineDash([]);
    g.font = 'bold 12px -apple-system,system-ui'; g.fillStyle = '#ffd84a'; g.textAlign = sd === 'L' ? 'left' : 'right'; g.fillText('边距 ' + m, X(m + 6), Math.round(h * .52)); g.fillStyle = '#4ae0ff'; g.fillText('可见 ' + (m - SKEW), X(m + 6), Math.round(h * .52) + 14);
    // 示意按钮（和游戏左上 / 右上一样的斜切深蓝条）：平行四边形，最靠边的角 = m - 4
    const pill = (y, W, H, txt) => { g.fillStyle = 'rgba(14,30,52,.92)'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(m), y); g.lineTo(X(m + W), y); g.lineTo(X(m + W - SKEW), y + H); g.lineTo(X(m - SKEW), y + H); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 13px -apple-system,system-ui'; g.textAlign = 'center'; g.fillText(txt, X(m + W / 2), y + H / 2 + 5); };
    pill(100, 170, 34, '第 1 天 · 蓝军 · 3000'); pill(138, 70, 30, '旋转'); pill(172, 70, 30, '菜单');
  }
  g.restore();
}
function updateMg() {
  $('mg').hidden = !marginOn; if (!marginOn) return;
  $('mgv').textContent = `边距 ${m}px（按钮可见边缘 ${m - SKEW}px）　游戏现在 ${PAD_NOW}px（可见 ${PAD_NOW - SKEW}px）　${m === PAD_NOW ? '' : (m > PAD_NOW ? '比现在多让 ' : '比现在少让 ') + Math.abs(m - PAD_NOW) + 'px'}`;
  $('mgt').textContent = stage.rot === 0 ? '系统横屏：不知道岛在哪边，两侧都画了。' : '红色带 = 避让区；示意按钮的最近角贴着青色虚线。调到刚好不被毛玻璃糊到，把「边距」数字发给我。';
}
const dpr = Math.min(devicePixelRatio, 3);
function layout() { cv.width = Math.round(stage.w * dpr); cv.height = Math.round(stage.h * dpr); draw(); }
stage.onChange(layout);

function drawFrame() {
  const w = stage.w, h = stage.h, s = stage.side;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.fillStyle = '#10283f'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= w; x += 50) { g.moveTo(x, 0); g.lineTo(x, h); } for (let y = 0; y <= h; y += 50) { g.moveTo(0, y); g.lineTo(w, y); } g.stroke();
  // 灵动岛一侧（红）与回主页横条一侧（绿）：竖屏系统下，物理上边 = 灵动岛，物理下边 = 横条
  const islandLeft = stage.rot === 0 ? false : (stage.rot === 90), barLeft = stage.rot === 0 ? false : !islandLeft;
  if (stage.rot) {
    g.fillStyle = 'rgba(226,64,64,.55)'; g.fillRect(islandLeft ? 0 : w - 24, 0, 24, h); g.fillStyle = '#e24040'; g.fillRect(islandLeft ? 0 : w - 12, h / 2 - 54, 12, 108);
    g.fillStyle = 'rgba(64,200,96,.40)'; g.fillRect(barLeft ? 0 : w - 24, 0, 24, h); g.fillStyle = '#40c860'; g.fillRect(barLeft ? 0 : w - 6, h / 2 - 67, 6, 134);
  } else { g.fillStyle = 'rgba(64,200,96,.40)'; g.fillRect(0, h - 24, w, 24); g.fillStyle = '#40c860'; g.fillRect(w / 2 - 67, h - 6, 134, 6); }
  g.fillStyle = '#fff'; g.font = '16px -apple-system,system-ui'; g.textAlign = 'center';
  g.fillText('↑ 画面上方（文字是正的 = 旋转正确）', w / 2, 70); g.fillText('红 = 灵动岛一侧　绿 = 回主页横条一侧（24px 带 = 系统手势区）', w / 2, h / 2 - 90);
  g.textAlign = 'left'; g.fillText('↖ 舞台左上', 40, 28); g.textAlign = 'right'; g.fillText('舞台右上 ↗', w - 40, 28); g.fillText('舞台右下 ↘', w - 40, h - 14); g.textAlign = 'left'; g.fillText('↙ 舞台左下', 40, h - 14);
}
function draw() {
  drawFrame(); if (marginOn) drawMargin(); updateMg();
  const pts = [...trails.values()];
  for (const t of pts) {
    g.strokeStyle = 'rgba(255,224,138,.9)'; g.lineWidth = 3; g.beginPath(); t.pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
    if (t.down) { const p = t.pts[t.pts.length - 1]; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.x - 24, p.y); g.lineTo(p.x + 24, p.y); g.moveTo(p.x, p.y - 24); g.lineTo(p.x, p.y + 24); g.stroke(); g.beginPath(); g.arc(p.x, p.y, 10, 0, 7); g.stroke(); }
  }
  const live = pts.filter(t => t.down), cur = live.length && live[0].pts[live[0].pts.length - 1];
  const pinch = live.length === 2 ? Math.hypot(...['x', 'y'].map(k => live[0].pts.at(-1)[k] - live[1].pts.at(-1)[k])).toFixed(0) : '-';
  const so = screen.orientation ? screen.orientation.type + ' ' + screen.orientation.angle + '°' : '无';
  $('hud').textContent = `舞台量到 100vw×100vh = ${stage.W}×${stage.H}　inner ${innerWidth}×${innerHeight}　screen ${screen.width}×${screen.height}　client ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}　系统方向 ${so}\n舞台 ${stage.w}×${stage.h}　${stage.rot ? '旋转 ' + stage.rot + '°　灵动岛在' + (stage.side === 'left' ? '左' : '右') : '系统横屏，不旋转'}\n手指(舞台坐标) ${cur ? cur.x.toFixed(0) + ', ' + cur.y.toFixed(0) : '-'}　双指间距 ${pinch}\n边缘起手 ${edgeStarts} 次　离开页面 ${hidden} 次　${lastTap}`;
}
// 触摸：clientX/Y 是物理屏幕坐标，用 stage.toLogical 换算
const dragM = p => { const dl = Math.min(...islandSides().map(sd => sd === 'L' ? p.x : stage.w - p.x)); setM(dl); };   // 边距测试开着时，手指拖到哪 = 边距调到哪（粗调）
cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); const p = stage.toLogical(e.clientX, e.clientY); if (marginOn) { trails.set(e.pointerId, {pts: [p], down: true, mg: true}); dragM(p); draw(); return; } trails.set(e.pointerId, {pts: [p], down: true});
  if (p.x < 24 || p.x > stage.w - 24 || p.y < 24 || p.y > stage.h - 24) edgeStarts++; draw(); };
cv.onpointermove = e => { const t = trails.get(e.pointerId); if (!t || !t.down) return; if (t.mg) { dragM(stage.toLogical(e.clientX, e.clientY)); draw(); return; } t.pts.push(stage.toLogical(e.clientX, e.clientY)); if (t.pts.length > 400) t.pts.shift(); draw(); };
const up = e => { const t = trails.get(e.pointerId); if (t) t.down = false; draw(); };
cv.onpointerup = up; cv.onpointercancel = up;
document.addEventListener('visibilitychange', () => { if (document.hidden) hidden++; });
// DOM 按钮：变换后的命中测试由浏览器负责，应该点哪个亮哪个
const grid = $('grid'); for (let i = 1; i <= 5; i++) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = i; b.onclick = () => { b.classList.toggle('on'); lastTap = '点了按钮 ' + i; draw(); }; grid.appendChild(b); }
$('bSide').onclick = () => { stage.toggleSide(); };
$('bMg').onclick = () => { marginOn = !marginOn; if (marginOn && stage.dbg) stageDebug(stage);   // 打开边距测试时先关掉现场诊断（它盖在屏幕中央、还有一圈彩色边线，会干扰看毛玻璃）
   $('bMg').classList.toggle('on', marginOn); draw(); };
for (const b of document.querySelectorAll('#mg [data-d]')) b.onclick = () => { const d = +b.dataset.d; setM(d ? m + d : PAD_NOW); draw(); };
$('bClr').onclick = () => { trails.clear(); edgeStarts = 0; draw(); };
$('bBack').onclick = () => { location.href = './units-terrain.html' + location.search; };
layout();
