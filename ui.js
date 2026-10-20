// ui.js — 界面:Canvas 绘制、触控、面板。像素尺寸只出现在这里。
// V0.1 用文字+色块当"皮肤";以后换素材只替换 tile()/unit() 两个绘制函数。
import { VERSION, UNITS, TERRAIN, CONFIG, PLAYERS, CAPT } from './data.js';
import * as E from './engine.js';

const $ = i => document.getElementById(i), cv = $('c'), cx = cv.getContext('2d'), K = (x, y) => x + ',' + y;
let S = E.newGame(), cell = 48, mode = 'idle', selId = null, reach = null, tg = [], ul = [], pend = null, snap = null, bx = 0, by = 0, msg = '';
const U = () => S.units.find(u => u.id === selId);
const hp10 = u => Math.ceil(u.hp / 10);

function fit() {
  const b = $('board'), d = devicePixelRatio || 1;
  cell = Math.max(24, Math.floor(Math.min(b.clientWidth / S.w, b.clientHeight / S.h)));
  cv.style.width = cell * S.w + 'px'; cv.style.height = cell * S.h + 'px';
  cv.width = cell * S.w * d; cv.height = cell * S.h * d; cx.setTransform(d, 0, 0, d, 0, 0);
  draw();
}

// ---- 皮肤:地形 ----
const dot = (x, y, r, c) => { cx.fillStyle = c; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); };
function tile(c, x, y, s, o) {
  cx.fillStyle = TERRAIN[c].col; cx.fillRect(x, y, s, s);
  cx.strokeStyle = 'rgba(0,0,0,.12)'; cx.lineWidth = 1; cx.strokeRect(x + .5, y + .5, s - 1, s - 1);
  cx.lineWidth = Math.max(1, s / 16);
  if (c === 'f') { dot(x + s * .32, y + s * .38, s * .2, '#2f6b34'); dot(x + s * .66, y + s * .52, s * .22, '#2a5f2f'); dot(x + s * .4, y + s * .74, s * .17, '#356f3a'); }
  else if (c === '^') { cx.fillStyle = '#5f636c'; cx.beginPath(); cx.moveTo(x + s * .1, y + s * .86); cx.lineTo(x + s * .45, y + s * .2); cx.lineTo(x + s * .9, y + s * .86); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(x + s * .45, y + s * .2); cx.lineTo(x + s * .35, y + s * .42); cx.lineTo(x + s * .55, y + s * .42); cx.fill(); }
  else if (c === '~' || c === 'b') {
    if (c === 'b') { cx.fillStyle = '#5aa9e6'; cx.fillRect(x, y, s, s * .14); cx.fillRect(x, y + s * .86, s, s * .14); cx.fillStyle = '#8a6a45'; cx.fillRect(x, y + s * .14, s, s * .72); cx.strokeStyle = '#5c4529'; for (let i = 1; i < 4; i++) { cx.beginPath(); cx.moveTo(x + s * i / 4, y + s * .14); cx.lineTo(x + s * i / 4, y + s * .86); cx.stroke(); } }
    else { cx.strokeStyle = 'rgba(255,255,255,.6)'; for (const yy of [.35, .7]) { cx.beginPath(); cx.moveTo(x + s * .1, y + s * yy); cx.quadraticCurveTo(x + s * .3, y + s * (yy - .12), x + s * .5, y + s * yy); cx.quadraticCurveTo(x + s * .7, y + s * (yy + .12), x + s * .9, y + s * yy); cx.stroke(); } }
  }
  else if (c === '=') { cx.strokeStyle = '#8c8575'; cx.setLineDash([s * .12, s * .1]); cx.beginPath(); cx.moveTo(x + s / 2, y); cx.lineTo(x + s / 2, y + s); cx.stroke(); cx.setLineDash([]); }
  else if (c === 'w') { for (const [a, b] of [[.3, .35], [.65, .5], [.4, .75]]) dot(x + s * a, y + s * b, s * .16, '#4d6a3a'); }
  else if (c === 'd') { for (const [a, b] of [[.25, .3], [.6, .25], [.45, .55], [.75, .7], [.25, .78]]) dot(x + s * a, y + s * b, s * .05, '#b98f3f'); }
  else if (CAPT.includes(c)) {
    cx.fillStyle = o < 0 ? '#9aa0a6' : PLAYERS[o].col; cx.beginPath(); cx.roundRect(x + s * .15, y + s * .15, s * .7, s * .7, s * .1); cx.fill();
    cx.fillStyle = '#fff'; cx.font = `700 ${s * .4}px system-ui`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText({ c: '小', C: '大', F: '厂', A: '机', H: '总' }[c], x + s / 2, y + s / 2 + 1);
  }
}

// ---- 皮肤:单位(两字简称+队伍色)----
function unit(u, x, y, s) {
  cx.globalAlpha = u.ac ? .5 : 1;
  cx.fillStyle = PLAYERS[u.o].col; cx.strokeStyle = '#fff'; cx.lineWidth = Math.max(1.5, s / 20);
  cx.beginPath(); cx.roundRect(x + s * .08, y + s * .16, s * .84, s * .68, s * .14); cx.fill(); cx.stroke();
  cx.fillStyle = '#fff'; cx.font = `700 ${s * .34}px system-ui`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(UNITS[u.t].n, x + s / 2, y + s * .48);
  if (u.hp < 100) { cx.fillStyle = '#111'; cx.beginPath(); cx.arc(x + s * .8, y + s * .78, s * .15, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = `700 ${s * .22}px system-ui`; cx.fillText(hp10(u), x + s * .8, y + s * .79); }
  if (u.cargo) { cx.fillStyle = '#ffd34d'; cx.beginPath(); cx.arc(x + s * .2, y + s * .24, s * .09, 0, 7); cx.fill(); }
  cx.globalAlpha = 1;
}

function draw() {
  cx.clearRect(0, 0, cell * S.w, cell * S.h);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = S.tiles[y][x]; tile(c, x * cell, y * cell, cell, S.own[K(x, y)] ?? -1); }
  const fill = (x, y, c) => { cx.fillStyle = c; cx.fillRect(x * cell, y * cell, cell, cell); };
  if (reach) for (const k of reach.keys()) { const [x, y] = k.split(',').map(Number); fill(x, y, 'rgba(60,140,255,.38)'); }
  for (const t of ul) fill(t[0], t[1], 'rgba(60,220,120,.45)');
  for (const u of S.units) unit(u, u.x * cell, u.y * cell, cell);
  cx.lineWidth = 3;
  for (const e of tg) { cx.strokeStyle = e === pend ? '#ffe14d' : '#ff3b3b'; cx.strokeRect(e.x * cell + 2, e.y * cell + 2, cell - 4, cell - 4); }
  const u = selId && U(); if (u) { cx.strokeStyle = '#ffe14d'; cx.strokeRect(u.x * cell + 1.5, u.y * cell + 1.5, cell - 3, cell - 3); }
  hud();
}

function hud() {
  $('hud').innerHTML = `<span>第${S.day}日 ${S.win != null ? PLAYERS[S.win].name + '方获胜' : PLAYERS[S.turn].name + '方回合'}</span><span>资金 ${S.funds[S.turn]}</span><span style="opacity:.5">v${VERSION}</span>`;
  $('hud').style.color = PLAYERS[S.turn].col;
  const b = $('btns'); b.innerHTML = '';
  const add = (t, f, off) => { const e = document.createElement('button'); e.textContent = t; e.disabled = !!off; e.onclick = f; b.appendChild(e); };
  const u = selId && U();
  let info = msg;
  if (S.win != null) { add('重新开始', () => { S = E.newGame(); reset(); draw(); }); $('info').textContent = '游戏结束'; return; }
  if (mode === 'idle') add('结束回合', () => { do_({ t: 'end' }); });
  if (mode === 'move') { add('取消', () => { reset(); draw(); }); if (u) info = `${UNITS[u.t].n} 血${hp10(u)} 移动${UNITS[u.t].mv} 射程${UNITS[u.t].r.join('-')}`; }
  if (mode === 'act') {
    add('攻击', () => { tg = E.targets(S, U()); pend = null; mode = 'atk'; draw(); }, !E.targets(S, u).length);
    add('占领', () => { do_({ t: 'capture', id: selId }); }, !(UNITS[u.t].cap && CAPT.includes(S.tiles[u.y][u.x]) && S.own[K(u.x, u.y)] !== S.turn));
    if (u.cargo) add('卸载', () => { ul = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => [u.x + d[0], u.y + d[1]]).filter(([x, y]) => S.tiles[y]?.[x] && !E.unitAt(S, x, y) && TERRAIN[S.tiles[y][x]].c[UNITS[u.cargo.t].mt] != null); mode = 'unl'; draw(); });
    add('待命', () => { do_({ t: 'wait', id: selId }); });
    add('撤销', () => { S = snap; mode = 'move'; reach = E.reach(S, U()); draw(); });
  }
  if (mode === 'atk') {
    add('返回', () => { tg = []; pend = null; mode = 'act'; draw(); });
    if (pend) { const [x, c] = E.preview(S, u, pend); info = `预计造成 ${Math.round(x / 10 * 10) / 10} 点,反击 ${Math.round(c / 10 * 10) / 10} 点`; add('确认攻击', () => { do_({ t: 'attack', id: selId, tid: pend.id }); }); }
    else info = '点选红框目标';
  }
  if (mode === 'unl') { add('返回', () => { ul = []; mode = 'act'; draw(); }); info = '点选绿色格子卸载'; }
  if (mode === 'build') {
    add('取消', () => { reset(); draw(); });
    for (const [k, d] of Object.entries(UNITS)) add(`${d.n} ${d.cost}`, () => { do_({ t: 'build', x: bx, y: by, type: k }); }, S.funds[S.turn] < d.cost);
    info = '选择要建造的单位';
  }
  $('info').textContent = info;
}

function reset() { mode = 'idle'; selId = null; reach = null; tg = []; ul = []; pend = null; snap = null; msg = ''; }
function do_(a) { const e = E.act(S, a); msg = e || ''; if (!e) { reset(); } draw(); }

cv.addEventListener('pointerdown', ev => {
  const r = cv.getBoundingClientRect(), x = Math.floor((ev.clientX - r.left) / cell), y = Math.floor((ev.clientY - r.top) / cell);
  if (x < 0 || y < 0 || x >= S.w || y >= S.h || S.win != null) return;
  const u = E.unitAt(S, x, y), mine = u && u.o === S.turn && !u.ac;
  if (mode === 'idle' || mode === 'move' || mode === 'build') {
    if (mode === 'move' && reach.has(K(x, y)) && !(u && u.id !== selId && !mine && false)) {
      snap = E.clone(S); const e = E.act(S, { t: 'move', id: selId, x, y }); msg = e || '';
      if (e) { snap = null; } else { reach = null; mode = U() ? 'act' : 'idle'; if (mode === 'idle') reset(); }
    } else if (mine) { reset(); selId = u.id; reach = E.reach(S, u); mode = 'move'; }
    else if (S.tiles[y][x] === 'F' && S.own[K(x, y)] === S.turn && !u && mode !== 'move') { reset(); mode = 'build'; bx = x; by = y; }
    else if (u) { reset(); msg = `${PLAYERS[u.o].name}方${UNITS[u.t].n} 血${hp10(u)}${u.ac ? '(已行动)' : ''}`; }
    else { reset(); msg = `${TERRAIN[S.tiles[y][x]].n} 防御${TERRAIN[S.tiles[y][x]].d}%`; }
  } else if (mode === 'atk') {
    const e = tg.find(t => t.x === x && t.y === y);
    if (e && pend === e) { do_({ t: 'attack', id: selId, tid: e.id }); return; }
    pend = e || null;
  } else if (mode === 'unl') {
    if (ul.some(t => t[0] === x && t[1] === y)) { do_({ t: 'unload', id: selId, x, y }); return; }
  }
  draw();
});

addEventListener('resize', fit);
fit();
