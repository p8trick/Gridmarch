import {Stage} from './stage.js';
// 1.01 毛玻璃提示页：主页点右下角版本号进来。全黑底，和主页一样用虚拟横屏舞台（真横屏时 rot = 0，同样适配）。
// iOS 27 在独立 PWA 顶部加的毛玻璃关不掉；用系统返回手势回到主页可暂时消除，切出游戏再回来会恢复。
// 手势要从屏幕物理左边缘起手：虚拟横屏下那条边在舞台下边（rot 90）或上边（rot -90），真横屏就是舞台左边；示意随旋转 / 换边实时切。
const $ = id => document.getElementById(id);
let lang = 'zh'; try { lang = localStorage.getItem('gridmarch.lang') === 'en' ? 'en' : 'zh'; } catch (e) {}
const STR = {
  zh: {t: '暂时去掉顶部的毛玻璃', p1: '从屏幕<b>亮条那一边</b>的边缘起手，用<b>系统返回手势</b>往里划，回到主页，顶部的模糊就会暂时消失。', p2: '切出游戏再回来，模糊会恢复，到这里再来一次即可。手势失灵就点下面的按钮。', back: '‹ 返回主页', lab: '从这条边起手，往里划', doc: '方寸战线 · Gridmarch'},
  en: {t: 'Clear the top blur (temporarily)', p1: 'Start at the <b>glowing edge</b> and swipe inward with the <b>system back gesture</b> to return home; the top blur goes away for a while.', p2: 'It comes back after you leave the game and return; just repeat this. If the gesture does not work, use the button below.', back: '‹ Back to home', lab: 'Swipe in from this edge', doc: 'Gridmarch'}
}[lang];
$('t').textContent = STR.t; $('p1').innerHTML = STR.p1; $('p2').textContent = STR.p2; $('back').textContent = STR.back;
document.querySelectorAll('.lab').forEach(e => e.textContent = STR.lab); document.title = STR.doc;
const el = $('stage'), stage = new Stage(el);
const mark = () => { el.classList.toggle('rb', stage.rot === 90); el.classList.toggle('rt', stage.rot === -90); el.classList.toggle('rl', stage.rot === 0); };
stage.onChange(mark); mark();
// 返回主页：直接跳到 index.html（按钮是手势失灵时的保底）
const ver = new URLSearchParams(location.search).get('v');
$('back').onclick = () => { location.href = './index.html' + (ver ? '?v=' + ver : ''); };
window.blurTip = {stage};
