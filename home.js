/* 方寸战线 / Gridmarch · 主页逻辑 */
(function () {
  'use strict';

  /* ===== 配置：增删菜单只改这里 ===== */
  var VER = window.GM_VERSION || 'dev';       // 版本号在 index.html 里（唯一位置）；跳转时带上 ?v=，各页面据此给所有文件加版本号
  var PARAMS = new URLSearchParams(location.search);   // 开发用：index.html?go=battle&seed=N&debug=1 直接进战场
  var DEV_URL = 'tests/units-terrain.html?v=' + VER;   // 开发入口：连点标题 5 次 → 单位×地形测试页
  var SAVE_KEY = 'gridmarch.save';            // 有这个键就视为有存档
  var LANG_KEY = 'gridmarch.lang';

  var MENU = [
    { id: 'continue', zh: '继续',     en: 'Continue',     sub: 'CONTINUE',      needsSave: true, go: { toast: 'soon' } },
    { id: 'single',   zh: '单人对战', en: 'Single Player', sub: 'SINGLE PLAYER', go: { battle: true } },
    { id: 'multi',    zh: '多人对战', en: 'Multiplayer',  sub: 'MULTIPLAYER',   go: { toast: 'soon' } },
    { id: 'editor',   zh: '编辑器',   en: 'Editor',       sub: 'EDITOR',        go: { toast: 'soon' } },
    { id: 'settings', zh: '设置',     en: 'Settings',     sub: 'SETTINGS',      go: { settings: true } }
  ];

  var TITLE = {
    zh: { src: 'assets/title/title-zh.webp', alt: '方寸战线' },
    en: { src: 'assets/title/title-en.webp', alt: 'Gridmarch' }
  };
  var STR = {
    zh: { settings: '设置', language: '语言', quality: '画质', volume: '音量', soon: '即将开放', close: '关闭', doc: '方寸战线 · Gridmarch' },
    en: { settings: 'Settings', language: 'Language', quality: 'Graphics', volume: 'Volume', soon: 'Coming soon', close: 'Close', doc: 'Gridmarch' }
  };

  /* ===== 工具 ===== */
  var $ = function (s) { return document.querySelector(s); };
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var menuEl = $('#menu'), titleEl = $('#title'), toastEl = $('#toast'), sheet = $('#settings');
  var lang = load(LANG_KEY) === 'en' ? 'en' : 'zh';
  var hasSave = !!load(SAVE_KEY);
  var items = [], sel = -1, toastTimer = 0;

  /* ===== 菜单 ===== */
  function build() {
    MENU.forEach(function (m, i) {
      var li = document.createElement('li');
      li.style.setProperty('--i', i);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'item';
      b.dataset.id = m.id;
      if (m.needsSave && !hasSave) b.setAttribute('aria-disabled', 'true');
      b.innerHTML = '<span class="txt"><span class="main"></span><span class="sub"></span></span>';
      li.appendChild(b);
      menuEl.appendChild(li);
      items.push(b);
    });
  }
  function isDisabled(i) { return items[i].getAttribute('aria-disabled') === 'true'; }
  function select(i, focus) {
    if (i < 0 || i >= items.length || isDisabled(i)) return;
    if (sel >= 0) items[sel].classList.remove('is-sel');
    sel = i;
    items[i].classList.add('is-sel');
    if (focus) items[i].focus({ preventScroll: true });
  }
  function move(d) {
    var n = items.length, i = sel;
    for (var k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (!isDisabled(i)) return select(i, true);
    }
  }
  function toast(key) {
    toastEl.textContent = STR[lang][key] || key;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }
  function activate(i) {
    if (isDisabled(i)) return;
    var g = MENU[i].go;
    if (g.battle) { setTimeout(function () { enterBattle(); }, 120); }
    else if (g.settings) { openSettings(); }
    else if (g.toast) { toast(g.toast); }
  }

  menuEl.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.item');
    if (b) select(items.indexOf(b));
  });
  menuEl.addEventListener('click', function (e) {
    var b = e.target.closest('.item');
    if (b) { select(items.indexOf(b)); activate(items.indexOf(b)); }
  });
  document.addEventListener('keydown', function (e) {
    if (battleOn) return;
    if (!sheet.hidden) { if (e.key === 'Escape') closeSettings(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON' && sel >= 0) activate(sel);
  });

  /* ===== 设置 ===== */
  function openSettings() { sheet.hidden = false; $('#closeSettings').focus({ preventScroll: true }); }
  function closeSettings() { sheet.hidden = true; if (sel >= 0) items[sel].focus({ preventScroll: true }); }
  $('#closeSettings').addEventListener('click', closeSettings);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSettings(); });
  sheet.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) { lang = b.dataset.lang === 'en' ? 'en' : 'zh'; store(LANG_KEY, lang); applyLang(); }
  });

  /* ===== 语言：标题图与文字一起切换，中英文不同时出现 ===== */
  function applyLang() {
    var s = STR[lang];
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = s.doc;
    titleEl.src = TITLE[lang].src;
    titleEl.alt = TITLE[lang].alt;
    $('.title').dataset.lang = lang;
    items.forEach(function (b, i) {
      var m = MENU[i];
      b.querySelector('.main').textContent = lang === 'en' ? m.en : m.zh;
      b.querySelector('.sub').textContent = lang === 'en' ? '' : m.sub;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = s[el.dataset.i18n];
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang]'), function (el) {
      el.setAttribute('aria-pressed', el.dataset.lang === lang ? 'true' : 'false');
    });
    $('#closeSettings').setAttribute('aria-label', s.close);
  }

  /* ===== 开发入口：连点标题 5 次 → 单位×地形测试页 ===== */
  var taps = 0, tapTimer = 0;
  $('.title').addEventListener('click', function () {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 2000);
    if (taps >= 5) { taps = 0; location.href = DEV_URL; }
  });

  /* ===== 虚拟横屏舞台：iPhone 竖屏锁定时整页转 90°（src/battle/stage.js，主页和战场共用这一个舞台）。主页没有换边按钮：在战场里换，选择存在本机，主页自动跟着 ===== */
  var stageEl = $('#stage'), bgEl = $('#bg');
  var BG_WIDE = 'assets/home/home-bg.webp', BG_TALL = 'assets/home/home-bg-ipad.webp';
  function layout(st) {
    var tall = st.w / st.h <= 16 / 9;                   // 舞台比例 ≤ 16:9（iPad）用专属背景，其余（iPhone）用宽图
    stageEl.classList.toggle('tall', tall);
    var src = tall ? BG_TALL : BG_WIDE;
    if (bgEl.getAttribute('src') !== src) bgEl.src = src;
  }
  var stageP = import('./src/battle/stage.js').then(function (m) {   // 经 index.html 的 importmap 自动带版本号
    var st = new m.Stage(stageEl);
    st.onChange(layout); layout(st);
    stageEl.classList.add('ready');
    return st;
  });
  stageP.catch(function () { bgEl.src = BG_WIDE; stageEl.classList.add('ready'); });   // 舞台加载失败：按原样显示

  /* ===== 视图切换：主页 ↔ 战场都在这一个文档里（不跳转页面，系统边缘滑动手势就没有历史可翻）=====
     战场是 src/battle/main.js 里的模块，第一次进入时才载入；退出时它自己释放显存。 */
  var homeEl = $('#homeView'), battleEl = $('#battle'), battleOn = false;
  function enterBattle(seed) {
    if (battleOn) return;
    battleOn = true;
    homeEl.hidden = true; battleEl.hidden = false;
    battleEl.innerHTML = '<div id="loading">正在载入…</div>';
    Promise.all([stageP, import('./src/battle/main.js')]).then(function (r) {
      return r[1].mountBattle(battleEl, r[0], { seed: seed, debug: PARAMS.has('debug'), onExit: exitBattle });
    }).catch(function (e) {
      exitBattle(); toast('载入战场失败：' + (e && e.message || e));
    });
  }
  function exitBattle() {
    battleOn = false;
    battleEl.hidden = true; battleEl.innerHTML = '';
    homeEl.hidden = false;
    if (sel >= 0) items[sel].focus({ preventScroll: true });
  }

  /* ===== 启动 ===== */
  $('#ver').textContent = 'v' + VER;   // 右下角版本号
  build();
  applyLang();
  for (var i = 0; i < items.length; i++) { if (!isDisabled(i)) { select(i); break; } }
  if (PARAMS.get('go') === 'battle') enterBattle(PARAMS.get('seed'));   // 开发直达
  // 预载另一种语言的标题，切换时无延迟
  setTimeout(function () { new Image().src = TITLE[lang === 'zh' ? 'en' : 'zh'].src; }, 800);
})();
