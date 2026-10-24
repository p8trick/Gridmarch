import * as THREE from 'three';
import {createSoldier} from './soldier.js';
import {bake} from './batch.js';
const $=s=>document.querySelector(s),Q=new URLSearchParams(location.search),S=1.8/4.21;
const R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setSize(innerWidth,innerHeight);$('#c').appendChild(R.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9a78);
const cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,200);
const fit=()=>{cam.aspect=innerWidth/innerHeight;const d=innerWidth<innerHeight?34:24;cam.position.set(0,d,d*.8);cam.lookAt(0,0,0);cam.updateProjectionMatrix();R.setSize(innerWidth,innerHeight)};fit();addEventListener('resize',fit);
scene.add(new THREE.HemisphereLight(0xfff2dc,0x6b6a55,1.4));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(8,18,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:60});scene.add(sun);
const gr=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshStandardMaterial({color:0x9aa77f,roughness:1}));gr.rotation.x=-Math.PI/2;gr.receiveShadow=true;scene.add(gr);const gh=new THREE.GridHelper(24,12,0x55603f,0x55603f);gh.position.y=.01;scene.add(gh);
const tpl=createSoldier({seed:31}),parts=bake(tpl);
let mode=Q.get('mode')||'instanced',N=+(Q.get('n')||40),shadow=Q.get('shadow')==='1',cur;
function cells(){let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647,a=[...Array(144).keys()];for(let i=143;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 return a.slice(0,Math.min(N,144)).map(k=>({x:(k%12-5.5)*2,z:(Math.floor(k/12)-5.5)*2,r:Math.floor(r()*4)*Math.PI/2}))}
function rebuild(){if(cur)scene.remove(cur);cur=new THREE.Group();const C=cells(),sh=m=>{m.castShadow=m.receiveShadow=shadow};
 if(mode==='raw')C.forEach(c=>{const u=tpl.clone();u.scale.setScalar(S);u.position.set(c.x,0,c.z);u.rotation.y=c.r;u.traverse(o=>o.isMesh&&sh(o));cur.add(u)});
 else if(mode==='merged')C.forEach(c=>{const g=new THREE.Group();parts.forEach(p=>{const m=new THREE.Mesh(p.geometry,p.material);sh(m);g.add(m)});g.scale.setScalar(S);g.position.set(c.x,0,c.z);g.rotation.y=c.r;cur.add(g)});
 else{const M=new THREE.Matrix4(),q=new THREE.Quaternion(),Y=new THREE.Vector3(0,1,0),sc=new THREE.Vector3(S,S,S);
  parts.forEach(p=>{const im=new THREE.InstancedMesh(p.geometry,p.material,C.length);C.forEach((c,i)=>{q.setFromAxisAngle(Y,c.r);M.compose(new THREE.Vector3(c.x,0,c.z),q,sc);im.setMatrixAt(i,M)});im.frustumCulled=false;sh(im);cur.add(im)})}
 scene.add(cur);R.shadowMap.enabled=shadow;scene.traverse(o=>o.material&&(o.material.needsUpdate=true));
 document.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));document.querySelectorAll('[data-n]').forEach(b=>b.classList.toggle('on',+b.dataset.n===N));$('#sh').classList.toggle('on',shadow)}
document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;rebuild()});
document.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{N=+b.dataset.n;rebuild()});
$('#sh').onclick=()=>{shadow=!shadow;rebuild()};rebuild();
let last=performance.now(),fps=60,t=0;
(function loop(){requestAnimationFrame(loop);const n=performance.now();fps+=(1000/(n-last)-fps)*.1;last=n;R.render(scene,cam);
 if(++t%15==0){const i=R.info.render;window.__stats={mode,N,calls:i.calls,tris:i.triangles,fps:Math.round(fps)};$('#hud').textContent=`${mode} ×${Math.min(N,144)}  FPS ${Math.round(fps)}  绘制调用 ${i.calls}  三角面 ${(i.triangles/1000).toFixed(0)}k`}})();
