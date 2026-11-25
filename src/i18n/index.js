// 方寸战线 语言包框架（1.02）。t('键名', {参数}) 取当前语言的文字；语言存在 localStorage 'gridmarch.lang'（和主页同一个键），主页切换后下次进战场生效。
// 英文缺词：退回中文并在控制台提示一次（不会崩，也不会显示键名）；中文也缺：显示键名本身。node 里（测试）没有 localStorage，默认中文。
import zh from './zh.js'; import en from './en.js';
export const DICT = {zh, en}, LANG_KEY = 'gridmarch.lang';
let lang = 'zh', warned = new Set(); const subs = new Set();
try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch (e) {}
export const getLang = () => lang;
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
