/* 方寸战线 / Gridmarch · 主页逻辑 */
(function () {
  'use strict';

  /* ===== 配置：增删菜单只改这里 ===== */
  var BATTLE_TEST_URL = 'battle_test.html';   // TODO：填战场测试页的相对路径（单人对战暂时也跳这里；连点标题 5 次是开发入口）
  var SAVE_KEY = 'gridmarch.save';            // 有这个键就视为有存档
  var LANG_KEY = 'gridmarch.lang';

  var MENU = [
    { id: 'continue', zh: '继续',     en: 'Continue',     sub: 'CONTINUE',      needsSave: true, go: { toast: 'soon' } },
    { id: 'single',   zh: '单人对战', en: 'Single Player', sub: 'SINGLE PLAYER', go: { link: BATTLE_TEST_URL } },  // TODO：以后改成选图页
    { id: 'multi',    zh: '多人对战', en: 'Multiplayer',  sub: 'MULTIPLAYER',   go: { toast: 'soon' } },
    { id: 'editor',   zh: '编辑器',   en: 'Editor',       sub: 'EDITOR',        go: { toast: 'soon' } },
    { id: 'settings', zh: '设置',     en: 'Settings',     sub: 'SETTINGS',      go: { settings: true } }
  ];

  var TITLE = {
    zh: { src: 'assets/title/title-zh.webp', alt: '方寸战线' },
    en: { src: 'assets/title/title-en.webp', alt: 'Gridmarch' }
  };
  var STR = {
    zh: { rotate: '请横屏使用', settings: '设置', language: '语言', quality: '画质', volume: '音量', soon: '即将开放', close: '关闭', doc: '方寸战线 · Gridmarch' },
    en: { rotate: 'Please rotate your device', settings: 'Settings', language: 'Language', quality: 'Graphics', volume: 'Volume', soon: 'Coming soon', close: 'Close', doc: 'Gridmarch' }
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
    if (g.link) { setTimeout(function () { location.href = g.link; }, 120); }
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
    $('#rotateText').textContent = s.rotate;
  }

  /* ===== 开发入口：连点标题 5 次 → 战场测试页 ===== */
  var taps = 0, tapTimer = 0;
  $('.title').addEventListener('click', function () {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 2000);
    if (taps >= 5) { taps = 0; location.href = BATTLE_TEST_URL; }
  });

  /* ===== 启动 ===== */
  build();
  applyLang();
  for (var i = 0; i < items.length; i++) { if (!isDisabled(i)) { select(i); break; } }
  // 预载另一种语言的标题，切换时无延迟
  setTimeout(function () { new Image().src = TITLE[lang === 'zh' ? 'en' : 'zh'].src; }, 800);
})();
