// 方寸战线 语言包框架（1.02）。t('键名', {参数}) 取当前语言的文字；语言存在 localStorage 'gridmarch.lang'（和主页同一个键），主页切换后下次进战场生效。
// 英文缺词：退回中文并在控制台提示一次（不会崩，也不会显示键名）；中文也缺：显示键名本身。node 里（测试）没有 localStorage，默认中文。
import zh from './zh.js'; import en from './en.js';
export const DICT = {zh, en}, LANG_KEY = 'gridmarch.lang';
let lang = 'zh', warned = new Set(); const subs = new Set();   // 注意：getLang 等函数里用到 subs，必须先于下面的 addEventListener 声明
try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch (e) {}
export const getLang = () => lang;
// 主页切换语言时写 localStorage 并发 'gm-lang' 事件：这里重新读一遍，战场 / 进度页用的就是最新语言（不用刷新页面）
const reread = () => { try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch (e) {} };
if (typeof window !== 'undefined') window.addEventListener('gm-lang', () => { reread(); subs.forEach(f => { try { f(lang); } catch (e) {} }); });
export function setLang(l) { lang = l === 'en' ? 'en' : 'zh'; try { localStorage.setItem(LANG_KEY, lang); } catch (e) {} subs.forEach(f => { try { f(lang); } catch (e) {} }); }
export const onLang = f => (subs.add(f), () => subs.delete(f));   // 切换语言时回调（战场内以后做热切换用）
export function t(key, params) {
  let s = DICT[lang][key];
  if (s === undefined) {
    s = DICT.zh[key];
    if (!warned.has(key)) { warned.add(key); if (typeof console !== 'undefined') console.warn('[i18n] 缺词条', lang, key); }
    if (s === undefined) s = key;
  }
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => params[k] === undefined ? m : params[k]);
  return s;
}
// 给一段静态 HTML 上色：data-i18n="键" → textContent；data-i18n-html="键" → innerHTML（词条里带标签时用）；data-i18n-aria="键" → aria-label。模板里保留中文原文当占位。
export function applyI18n(root) {
  root.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(e => { e.innerHTML = t(e.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
}

// 队伍名：OWN[0] 蓝军 / OWN[1] 红军（随语言；原来 main / detail / intel / result 各写了一份）
export const OWN = {}; Object.defineProperty(OWN, 0, {get: () => t('team.blue'), enumerable: true}); Object.defineProperty(OWN, 1, {get: () => t('team.red'), enumerable: true});

// 查表对象：obj[id] 每次读取都按当前语言取 t(prefix + id)（原来写死中文的 {id: '文字'} 表直接换成它，调用处不用改）
export const lazyTable = (prefix, ids) => { const o = {}; for (const id of ids) Object.defineProperty(o, id, {get: () => t(prefix + id), enumerable: true}); return o; };
