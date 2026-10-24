import * as THREE from 'three';
import {createSoldier} from './soldier.js';
import {bake,makeLOD,triCount} from './batch.js';
const $=s=>document.querySelector(s),Q=new URLSearchParams(location.search),S=1.8/4.21;
const R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);$('#c').appendChild(R.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9a78);
const cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,200);
let cullDirty=true,cullOn=Q.get('cull')!=='0',IMS=[],MAT=[],vis=0,CN=0;let acc=0,cnt=0,ts=performance.now(),dirty=true,od=Q.get('od')==='1',capN=1,fn=0;let gh,curG=0,G=12;const B0=()=>innerWidth<innerHeight?34:24;let yaw=0,pitch=Math.atan2(1,.8),base=24,dist=30.7,tgt=new THREE.Vector3();
const place=()=>{dirty=true;cullDirty=true;cam.position.set(tgt.x+dist*Math.cos(pitch)*Math.sin(yaw),dist*Math.sin(pitch),tgt.z+dist*Math.cos(pitch)*Math.cos(yaw));cam.lookAt(tgt.x,0,tgt.z)};
const reset=()=>{yaw=0;pitch=Math.atan2(1,.8);base=B0()*(G/12);dist=base*1.28;tgt.set(0,0,0);place()};
const fit=()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();R.setSize(innerWidth,innerHeight);reset()};fit();addEventListener('resize',fit);
const cv=R.domElement,P=new Map(),cl=(v,a,b)=>Math.min(b,Math.max(a,v));let pd=0,pm=[0,0];cv.style.touchAction='none';
const snap=()=>{const[a,b]=[...P.values()];pd=Math.hypot(a[0]-b[0],a[1]-b[1]);pm=[(a[0]+b[0])/2,(a[1]+b[1])/2]};
cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);if(P.size===2)snap()};
cv.onpointermove=e=>{const o=P.get(e.pointerId);if(!o)return;const dx=e.clientX-o[0],dy=e.clientY-o[1];P.set(e.pointerId,[e.clientX,e.clientY]);
 if(P.size===1){yaw-=dx*.008;pitch=cl(pitch+dy*.005,.2,1.45)}
 else if(P.size===2){const[a,b]=[...P.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2],k=dist*.0016,mx=m[0]-pm[0],my=m[1]-pm[1];
  dist=cl(dist*pd/d,2.2,130);pd=d;pm=m;tgt.x+=(-Math.cos(yaw)*mx-Math.sin(yaw)*my)*k;tgt.z+=(Math.sin(yaw)*mx-Math.cos(yaw)*my)*k;tgt.x=cl(tgt.x,-G,G);tgt.z=cl(tgt.z,-G,G)}
 place()};
cv.onpointerup=cv.onpointercancel=e=>{P.delete(e.pointerId);if(P.size===2)snap()};
cv.addEventListener('wheel',e=>{e.preventDefault();dist=cl(dist*Math.exp(e.deltaY*.0012),2.2,130);place()},{passive:false});
scene.add(new THREE.HemisphereLight(0xfff2dc,0x6b6a55,1.4));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(8,18,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:60});scene.add(sun);
const gr=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshStandardMaterial({color:0x9aa77f,roughness:1}));gr.rotation.x=-Math.PI/2;gr.receiveShadow=true;scene.add(gr);
const tpl=createSoldier({seed:31}),parts=bake(tpl);
const TIERS=[['L0',.12,.06],['L1',.25,.1],['L2',.45,.15],['L3',.55,.2],['L4',.7,.2]].map(([n,m,c])=>{const p=makeLOD(tpl,m,c);return{n,p,t:triCount(p)}});let ti=+(Q.get('far')||1);window.__tri={hi:triCount(parts),tiers:TIERS.map(x=>x.t)};let lodMode=Q.get('lod')||'auto',hi,lo;
let mode=Q.get('mode')||'instanced',N=+(Q.get('n')||40),sl=Math.min(2,+(Q.get('shadow')||0)),px=Q.get('px')==='1',shadow=sl>0,cur;
function cells(){G=N>144?20:12;let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647,T=G*G,a=[...Array(T).keys()];for(let i=T-1;i>0;i--){const k=Math.floor(r()*(i+1));[a[i],a[k]]=[a[k],a[i]]}
 return a.slice(0,Math.min(N,T)).map(k=>({x:(k%G-(G-1)/2)*2,z:(Math.floor(k/G)-(G-1)/2)*2,r:Math.floor(r()*4)*Math.PI/2}))}
const SZ=[0,512,2048],TY=[0,THREE.BasicShadowMap,THREE.PCFSoftShadowMap],SN=['关','低','高'];
function rebuild(){if(cur)scene.remove(cur);cur=new THREE.Group();const C=cells();dirty=true;IMS=[];shadow=sl>0;acc=0;cnt=0;ts=performance.now();
 if(G!==curG){curG=G;gr.geometry.dispose();gr.geometry=new THREE.PlaneGeometry(G*2,G*2);if(gh)scene.remove(gh);gh=new THREE.GridHelper(G*2,G,0x55603f,0x55603f);gh.position.y=.01;scene.add(gh);const e=G+4;Object.assign(sun.shadow.camera,{left:-e,right:e,top:e,bottom:-e,far:Math.max(60,G*4)});sun.shadow.camera.updateProjectionMatrix();reset()}
 if(sl){sun.shadow.mapSize.set(SZ[sl],SZ[sl]);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}R.shadowMap.type=TY[sl]}
window.__cells=C;const sh=m=>{m.castShadow=m.receiveShadow=shadow};
 if(mode==='raw')C.forEach(c=>{const u=tpl.clone();u.scale.setScalar(S);u.position.set(c.x,0,c.z);u.rotation.y=c.r;u.traverse(o=>o.isMesh&&sh(o));cur.add(u)});
 else if(mode==='merged')C.forEach(c=>{const g=new THREE.Group();parts.forEach(p=>{const m=new THREE.Mesh(p.geometry,p.material);sh(m);g.add(m)});g.scale.setScalar(S);g.position.set(c.x,0,c.z);g.rotation.y=c.r;cur.add(g)});
 else{const M=new THREE.Matrix4(),q=new THREE.Quaternion(),Y=new THREE.Vector3(0,1,0),sc=new THREE.Vector3(S,S,S);
  MAT=C.map(c=>{q.setFromAxisAngle(Y,c.r);return new THREE.Matrix4().compose(new THREE.Vector3(c.x,0,c.z),q,sc)});CN=C.length;cullDirty=true;
  const mk=ps=>{const g=new THREE.Group();ps.forEach(p=>{const im=new THREE.InstancedMesh(p.geometry,p.material,C.length);MAT.forEach((m,i)=>im.setMatrixAt(i,m));im.frustumCulled=false;IMS.push(im);sh(im);g.add(im)});cur.add(g);return g};
  hi=mk(parts);lo=mk(TIERS[ti].p);
  if(px&&sl){[hi,lo].forEach(g=>g.traverse(o=>{if(o.isMesh)o.castShadow=false}));const g=mk(TIERS[3].p);g.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.colorWrite=false;o.material.depthWrite=false;o.castShadow=true;o.receiveShadow=false}})}}
 scene.add(cur);R.shadowMap.enabled=shadow;scene.traverse(o=>o.material&&(o.material.needsUpdate=true));
 document.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));document.querySelectorAll('[data-n]').forEach(b=>b.classList.toggle('on',+b.dataset.n===N));$('#sh').classList.toggle('on',shadow);$('#px').textContent='投影:'+(px?'代理':'原模型');$('#sh').textContent='阴影:'+SN[sl]}
document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;rebuild()});
document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{N=+b.dataset.n;rebuild()});
$('#sh').onclick=()=>{sl=(sl+1)%3;rebuild()};rebuild();window.__cam={set:(x,z,d)=>{tgt.set(x,0,z);dist=d;yaw=0;place()}};let pri=2;const PR=[1,1.5,2,3];$('#pr').onclick=()=>{pri=(pri+1)%4;R.setPixelRatio(Math.min(devicePixelRatio,PR[pri]));R.setSize(innerWidth,innerHeight);dirty=true;$('#pr').textContent='清晰度×'+PR[pri]};const lv=()=>{$('#lv').textContent='远档'+TIERS[ti].n+'·'+(TIERS[ti].t/1000).toFixed(1)+'k'};lv();$('#lv').onclick=()=>{ti=(ti+1)%5;lv();rebuild()};$('#px').onclick=()=>{px=!px;rebuild()};$('#od').onclick=()=>{od=!od;dirty=true;$('#od').textContent='按需渲染:'+(od?'开':'关');acc=0;cnt=0;ts=performance.now()};$('#cap').onclick=()=>{capN=capN===1?2:1;$('#cap').textContent='帧率上限:'+(capN===1?60:30);acc=0;cnt=0;ts=performance.now()};$('#od').textContent='按需渲染:'+(od?'开':'关');$('#cu').onclick=()=>{cullOn=!cullOn;cullDirty=true;dirty=true;$('#cu').textContent='视锥剔除:'+(cullOn?'开':'关');acc=0;cnt=0;ts=performance.now()};$('#cu').textContent='视锥剔除:'+(cullOn?'开':'关');$('#rs').onclick=reset;$('#lod').onclick=()=>{lodMode={auto:'low',low:'high',high:'auto'}[lodMode];$('#lod').textContent='LOD:'+{auto:'自动',low:'战场档',high:'近景档'}[lodMode]};
let t0=performance.now(),fr=0,fps=0;
const frs=new THREE.Frustum(),pmx=new THREE.Matrix4(),sph=new THREE.Sphere(new THREE.Vector3(),1.3);
function applyCull(){if(!IMS.length)return;cam.updateMatrixWorld();pmx.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);frs.setFromProjectionMatrix(pmx);
 const idx=[];for(let i=0;i<CN;i++){if(cullOn){const e=MAT[i].elements;sph.center.set(e[12],.9,e[14]);if(!frs.intersectsSphere(sph))continue}idx.push(i)}
 vis=idx.length;IMS.forEach(im=>{idx.forEach((k,jx)=>im.setMatrixAt(jx,MAT[k]));im.count=idx.length;im.instanceMatrix.needsUpdate=true})}
const nearD=()=>B0()*1.28*.6;
(function loop(){requestAnimationFrame(loop);if(capN>1&&(++fn%capN))return;
 if(od&&!dirty){const q=performance.now();if(q-t0>=500){fr=0;t0=q;$('#hud').textContent='按需渲染：待机中（不绘制，GPU 休息）'}return}dirty=false;if(cullDirty){applyCull();cullDirty=false}if(hi){const near=lodMode==='high'||(lodMode==='auto'&&dist<nearD());hi.visible=near;lo.visible=!near}R.render(scene,cam);fr++;const n=performance.now();
 if(n-t0>=500){fps=fr*1000/(n-t0);acc+=fps;cnt++;fr=0;t0=n;const i=R.info.render;window.__stats={vis,mode,N,calls:i.calls,tris:i.triangles,fps:+fps.toFixed(1)};
  $('#hud').textContent=`${mode} ×${Math.min(N,G*G)}  ${lodMode==='auto'?(dist<nearD()?'近景':'战场'):lodMode==='high'?'近景':'战场'}档 FPS ${fps.toFixed(0)}(均${(acc/cnt).toFixed(0)}/${Math.round((n-ts)/1000)}s)  绘制调用 ${i.calls}  三角面 ${(i.triangles/1000).toFixed(0)}k${IMS.length?'  可见'+vis+'/'+CN:''}`}})();
