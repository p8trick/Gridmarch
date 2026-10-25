import * as THREE from 'three';
import {createSoldier} from './soldier.js';
import {createTank} from './tank.js';
import {UnitRenderer} from './unit-renderer.js';
import {TacticalCamera} from './tactical-camera.js';
const $=s=>document.querySelector(s),Q=new URLSearchParams(location.search),MAP=12,TILE=2,S=1.8/4.21;
const R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:Q.get('dbg')==='1'});$('#c').appendChild(R.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9a78);
const cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.5,200);
scene.add(new THREE.HemisphereLight(0xfff2dc,0x6b6a55,1.4));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(8,18,6);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:60});scene.add(sun);
const gr=new THREE.Mesh(new THREE.PlaneGeometry(MAP*TILE,MAP*TILE),new THREE.MeshStandardMaterial({color:0x9aa77f,roughness:1}));gr.rotation.x=-Math.PI/2;gr.receiveShadow=true;scene.add(gr);
const gh=new THREE.GridHelper(MAP*TILE,MAP,0x55603f,0x55603f);gh.position.y=.01;scene.add(gh);
const UR=new UnitRenderer({scene,camera:cam,renderer:R,light:sun,quality:Q.get('q')||'high',shadow:Q.get('s')||'high',pixelRatio:+(Q.get('pr')||3),
 types:{soldier:{model:createSoldier({seed:31}),scale:S,height:4.21,ringR:.78,tiered:true},
        tank:{models:[createTank({faction:'blue'}),createTank({faction:'red'})],scale:S,height:4.4,ringR:1.2,turretNode:'turret',lodCells:{high:+(Q.get('tc')||.07),mid:.1,low:.14,min:.2}}}});
const TC=new TacticalCamera(cam,R.domElement,{tile:TILE,mapW:MAP,mapH:MAP});
// 40 units per side: K tanks + (40-K) infantry, scattered in each side's 4 rear rows
let K=+(Q.get('k')||10),scan=false,od=true,anim=[],note='',noteT=0;
const pos=(i,j)=>[(i-(MAP-1)/2)*TILE,(j-(MAP-1)/2)*TILE];
function layout(){UR.clear();let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 [[0,0],[1,8]].forEach(([team,row0])=>{const c=[];for(let j=row0;j<row0+4;j++)for(let i=0;i<MAP;i++)c.push([i,j]);c.sort(()=>rnd()-.5);
  c.slice(0,40).forEach(([i,j],k)=>{const[x,z]=pos(i,j);UR.addUnit({id:team*100+k,type:k<K?'tank':'soldier',x,z,rot:team?Math.PI:0,team})})});
 aimAll()}
function aimAll(){const us=[...UR.units.values()];us.filter(u=>u.type==='tank').forEach(t=>{let b=null,bd=1e9;us.forEach(o=>{if(o.team===t.team)return;const d=(o.x-t.x)**2+(o.z-t.z)**2;if(d<bd){bd=d;b=o}});if(b)UR.setAim(t.id,Math.atan2(b.x-t.x,b.z-t.z)-t.rot)})}
UR.onAuto=m=>{note=m;noteT=performance.now()};
const on=(sel,fn)=>document.querySelectorAll(sel).forEach(b=>b.onclick=()=>fn(b));
function sync(){document.querySelectorAll('[data-q]').forEach(b=>b.classList.toggle('on',b.dataset.q===UR.userQ));document.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===UR.shadow));
 document.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',+b.dataset.t===Math.round(TC.tiles)));document.querySelectorAll('[data-k]').forEach(b=>b.classList.toggle('on',+b.dataset.k===K));
 $('#au').textContent='自动降画质:'+(UR.auto?'开':'关');$('#au').classList.toggle('on',UR.auto);$('#od').textContent='按需渲染:'+(od?'开':'关');$('#sc').textContent='炮塔扫描:'+(scan?'开':'关');$('#sc').classList.toggle('on',scan)}
on('[data-q]',b=>{UR.setQuality(b.dataset.q);sync()});on('[data-s]',b=>{UR.setShadow(b.dataset.s);sync()});on('[data-t]',b=>{TC.setTiles(+b.dataset.t);sync()});
on('[data-k]',b=>{K=+b.dataset.k;layout();sync()});
$('#au').onclick=()=>{UR.setAuto(!UR.auto);sync()};$('#od').onclick=()=>{od=!od;sync()};$('#rl').onclick=()=>TC.rotate(-1);$('#rr').onclick=()=>TC.rotate(1);
$('#sc').onclick=()=>{scan=!scan;if(!scan)aimAll();sync()};
$('#mv').onclick=()=>{const now=performance.now();[...UR.units.values()].filter(u=>u.team===0).slice(0,14).forEach(u=>anim.push({id:u.id,x0:u.x,z0:u.z,x1:u.x,z1:u.z+TILE*3,t0:now,dur:1600}))};
addEventListener('resize',()=>{TC.resize();R.setSize(innerWidth,innerHeight);UR.dirty=true});layout();sync();
let last=performance.now(),t0=last,fr=0,fps=0,acc=0,cnt=0,ang=0;
function loop(now){requestAnimationFrame(loop);const dt=now-last;last=now;
 const moved=TC.update(now);
 anim=anim.filter(a=>{const k=Math.min(1,(now-a.t0)/a.dur);UR.moveUnit(a.id,a.x0+(a.x1-a.x0)*k,a.z0+(a.z1-a.z0)*k);return k<1});
 if(scan){ang+=dt*.0012;UR.units.forEach(u=>{if(u.type==='tank')UR.setAim(u.id,ang+u.id)})}
 const changed=UR.update(),active=moved||changed||anim.length>0||scan;
 if(od&&!active){if(now-t0>=500){t0=now;fr=0;$('#hud').textContent='按需渲染：待机中（不绘制）\n'+hud()}return}
 R.render(scene,cam);fr++;if(active)UR.frame(dt);
 if(now-t0>=500){fps=fr*1000/(now-t0);fr=0;t0=now;acc+=fps;cnt++;const i=R.info.render;window.__s={fps:+fps.toFixed(1),...UR.stats,calls:i.calls,q:UR.quality,pr:UR.pr,tiles:TC.tiles};$('#hud').textContent=`FPS ${fps.toFixed(0)} (均${(acc/cnt).toFixed(0)})  绘制调用${i.calls}\n`+hud();sync()}}
function hud(){const s=UR.stats,c=s.counts;return`${UR.describe()} 阴影:${UR.shadow}  可见${s.visible}/${UR.units.size}（步兵${c.soldier||0} 坦克${c.tank||0}） ${(s.tris/1000).toFixed(0)}k面  ${TC.tiles.toFixed(1)}格`+(performance.now()-noteT<8000&&note?'\n'+note:'')}
window.__TC=TC;window.__UR=UR;
requestAnimationFrame(loop);
