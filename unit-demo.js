import * as THREE from 'three';
import {createSoldier} from './soldier.js';
import {UnitRenderer} from './unit-renderer.js';
import {TacticalCamera} from './tactical-camera.js';
const $=s=>document.querySelector(s),Q=new URLSearchParams(location.search),MAP=12,TILE=2;
const R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:Q.get('dbg')==='1'});$('#c').appendChild(R.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9a78);
const cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.5,200);
scene.add(new THREE.HemisphereLight(0xfff2dc,0x6b6a55,1.4));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(8,18,6);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:60});scene.add(sun);
const gr=new THREE.Mesh(new THREE.PlaneGeometry(MAP*TILE,MAP*TILE),new THREE.MeshStandardMaterial({color:0x9aa77f,roughness:1}));gr.rotation.x=-Math.PI/2;gr.receiveShadow=true;scene.add(gr);
const gh=new THREE.GridHelper(MAP*TILE,MAP,0x55603f,0x55603f);gh.position.y=.01;scene.add(gh);
const UR=new UnitRenderer({scene,camera:cam,renderer:R,light:sun,model:createSoldier({seed:31}),quality:Q.get('q')||'high',shadow:Q.get('s')||'high',pixelRatio:+(Q.get('pr')||3)});
const TC=new TacticalCamera(cam,R.domElement,{tile:TILE,mapW:MAP,mapH:MAP});
// 80 units: team 0 (blue) rows 0-3, team 1 (red) rows 8-11, 40 each, scattered
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,pos=(i,j)=>[(i-(MAP-1)/2)*TILE,(j-(MAP-1)/2)*TILE];
[[0,0],[1,8]].forEach(([team,row0])=>{const c=[];for(let j=row0;j<row0+4;j++)for(let i=0;i<MAP;i++)c.push([i,j]);c.sort(()=>rnd()-.5);c.slice(0,40).forEach(([i,j],k)=>{const[x,z]=pos(i,j);UR.addUnit({id:team*100+k,x,z,rot:team?Math.PI:0,team})})});
UR.onAuto=m=>{note=m;noteT=performance.now();sync()};let note='',noteT=0;
// buttons
let od=true,anim=[];const on=(sel,fn)=>document.querySelectorAll(sel).forEach(b=>b.onclick=()=>fn(b));
function sync(){document.querySelectorAll('[data-q]').forEach(b=>b.classList.toggle('on',b.dataset.q===UR.userQ));document.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===UR.shadow));
 document.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',+b.dataset.t===Math.round(TC.tiles)));$('#au').textContent='自动降画质:'+(UR.auto?'开':'关');$('#au').classList.toggle('on',UR.auto);$('#od').textContent='按需渲染:'+(od?'开':'关')}
on('[data-q]',b=>{UR.setQuality(b.dataset.q);sync()});on('[data-s]',b=>{UR.setShadow(b.dataset.s);sync()});on('[data-t]',b=>{TC.setTiles(+b.dataset.t);sync()});
$('#au').onclick=()=>{UR.setAuto(!UR.auto);sync()};$('#od').onclick=()=>{od=!od;sync()};$('#rl').onclick=()=>TC.rotate(-1);$('#rr').onclick=()=>TC.rotate(1);
$('#mv').onclick=()=>{const now=performance.now();[...UR.units.values()].filter(u=>u.team===0).slice(0,14).forEach(u=>anim.push({id:u.id,x0:u.x,z0:u.z,x1:u.x,z1:u.z+TILE*3,t0:now,dur:1600}))};
addEventListener('resize',()=>{TC.resize();R.setSize(innerWidth,innerHeight);UR.dirty=true});sync();
// loop
let last=performance.now(),t0=last,fr=0,fps=0,acc=0,cnt=0;
function loop(now){requestAnimationFrame(loop);const dt=now-last;last=now;
 const moved=TC.update(now);
 anim=anim.filter(a=>{const k=Math.min(1,(now-a.t0)/a.dur);UR.moveUnit(a.id,a.x0+(a.x1-a.x0)*k,a.z0+(a.z1-a.z0)*k);return k<1});
 const changed=UR.update(),active=moved||changed||anim.length>0;
 if(od&&!active){if(now-t0>=500){t0=now;fr=0;$('#hud').textContent='按需渲染：待机中（不绘制）\n'+hud()}return}
 R.render(scene,cam);fr++;if(active)UR.frame(dt);
 if(now-t0>=500){fps=fr*1000/(now-t0);fr=0;t0=now;acc+=fps;cnt++;window.__s={fps:+fps.toFixed(1),...UR.stats,q:UR.quality,pr:UR.pr,tiles:TC.tiles};$('#hud').textContent=`FPS ${fps.toFixed(0)} (均${(acc/cnt).toFixed(0)})\n`+hud();sync()}}
function hud(){const s=UR.stats;return`${UR.describe()} 阴影:${UR.shadow}  可见${s.visible}/${UR.units.size}  v5×${s.near} 远档×${s.far}  ${(s.tris/1000).toFixed(0)}k面  ${TC.tiles.toFixed(1)}格`+(performance.now()-noteT<8000&&note?'\n'+note:'')}
requestAnimationFrame(loop);
