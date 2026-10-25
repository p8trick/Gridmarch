// UnitRenderer v2 — multi-type instanced battlefield units (infantry with LOD, vehicles with independent turrets),
// per-unit frustum culling, team rings, 4 quality levels, 3 shadow levels, optional auto-downgrade.
import * as THREE from 'three';
import {bake,makeLOD,simplify,triCount} from './batch.js';
const TIER={L0:[.12,.06],L1:[.25,.1],L2:[.45,.15],L3:[.55,.2]};
export const QUALITY={high:{far:'L0',near:40},mid:{far:'L1',near:30},low:{far:'L2',near:16},min:{far:'L3',near:0}};
export const ORDER=['high','mid','low','min'];
const SHADOW={off:null,low:{size:512,type:THREE.BasicShadowMap},high:{size:2048,type:THREE.PCFSoftShadowMap}};
const PRS=[1,1.5,2,3],V3=THREE.Vector3,M4=THREE.Matrix4;
// types: { name:{ model | models:[perTeam], scale, height(model units), ringR, tiered:true (infantry LOD), turretNode:'turret' (+hullNode:'hull') } }
export class UnitRenderer{
 constructor({scene,camera,renderer,light,types,capacity=100,teamColors=[0x3b82f6,0xe5484d],quality='high',shadow='high',pixelRatio=3,nearPx=72}){
  Object.assign(this,{scene,cam:camera,R:renderer,light,cap:capacity,nearPx,teamColors:teamColors.map(c=>new THREE.Color(c))});
  this.sets=[];this.types={};this.units=new Map();this.dirty=true;this._le=new Float32Array(16);
  this.auto=true;this._n=0;this._t=0;this._low=0;this._good=0;this._last=0;this.onAuto=null;this.stats={visible:0,counts:{},tris:0};
  this.rings=false;this.userQ=quality;this.quality=quality;this.userPR=pixelRatio;this.pr=pixelRatio;this.shadow='off';
  for(const[name,d]of Object.entries(types)){const ms=d.models||[d.model],T={name,S:d.scale,ringR:d.ringR||.78,H:(d.height||4.21)*d.scale,models:ms,turret:!!d.turretNode,tiered:!!d.tiered,lc:d.lodCells};
   if(T.turret){const hn=d.hullNode||'hull';T.hull=ms.map(m=>bake(m.getObjectByName(hn)));T.tur=ms.map(m=>bake(m.getObjectByName(d.turretNode)));T.pivot=ms[0].getObjectByName(d.turretNode).position.clone();
    T.hs=T.hull.map(p=>this._mkSet(p));T.ts=T.tur.map(p=>this._mkSet(p));T.tri=triCount(T.hull[0])+triCount(T.tur[0])}
   else{T.full=ms.map(m=>bake(m));T.tri=triCount(T.full[0]);T.ns=T.full.map(p=>this._mkSet(p));if(T.tiered)T.tc=ms.map(()=>({}))}
   this.types[name]=T}
  this.ring=new THREE.InstancedMesh(new THREE.RingGeometry(.55,.78,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,depthWrite:false}),capacity);
  this.ring.count=0;this.ring.frustumCulled=false;this.ring.renderOrder=1;scene.add(this.ring);
  this._applyQuality(quality);this._applyPR(pixelRatio);this.setShadow(shadow);
 }
 _mkSet(ps){const group=new THREE.Group(),ims=ps.map(p=>{const im=new THREE.InstancedMesh(p.geometry,p.material,this.cap);im.count=0;im.frustumCulled=false;group.add(im);return im});this.scene.add(group);const s={group,ims};this.sets.push(s);return s}
 _tier(T,i,k){return T.tc[i][k]||(T.tc[i][k]=makeLOD(T.models[i],...TIER[k]))}
 _drop(s){this.scene.remove(s.group);this.sets=this.sets.filter(x=>x!==s)}
 // ---- units ----
 _mat(u){const T=this.types[u.type];u.m=new M4().compose(new V3(u.x,0,u.z),new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),u.rot||0),new V3(T.S,T.S,T.S));
  if(T.turret)u.mt=u.m.clone().multiply(new M4().makeTranslation(T.pivot.x,T.pivot.y,T.pivot.z)).multiply(new M4().makeRotationY(u.aim||0))}
 addUnit(u){u={type:'soldier',rot:0,team:0,aim:0,...u};this._mat(u);this.units.set(u.id,u);this.dirty=true}
 moveUnit(id,x,z,rot){const u=this.units.get(id);if(!u)return;u.x=x;u.z=z;if(rot!==undefined)u.rot=rot;this._mat(u);this.dirty=true}
 setAim(id,aim){const u=this.units.get(id);if(!u)return;u.aim=aim;this._mat(u);this.dirty=true}   // turret yaw relative to hull (radians)
 removeUnit(id){this.units.delete(id);this.dirty=true}
 clear(){this.units.clear();this.dirty=true}
 // ---- settings ----
 setQuality(q){this.userQ=q;this._applyQuality(q)}
 _applyQuality(q){this.quality=q;for(const T of Object.values(this.types)){
   if(T.turret&&T.lc){(T.hsL||[]).concat(T.tsL||[]).forEach(s=>this._drop(s));const c=T.lc[q],hp=T.hull.map(p=>simplify(p,c)),tp=T.tur.map(p=>simplify(p,c));T.hsL=hp.map(p=>this._mkSet(p));T.tsL=tp.map(p=>this._mkSet(p));T.triL=triCount(hp[0])+triCount(tp[0])}
   if(!T.tiered)continue;if(T.fs)T.fs.forEach(x=>this._drop(x));const ps=T.models.map((m,i)=>this._tier(T,i,QUALITY[q].far));T.fs=ps.map(p=>this._mkSet(p));T.triF=triCount(ps[0])}this._flags();this.dirty=true}
 setPixelRatio(r){this.userPR=r;this._applyPR(r)}
 _applyPR(r){this.pr=r;this.R.setPixelRatio(Math.min(devicePixelRatio,r));this.R.setSize(innerWidth,innerHeight);this.dirty=true}
 setShadow(s){this.shadow=s;const c=SHADOW[s];this.light.castShadow=!!c;this.R.shadowMap.enabled=!!c;
  if(c){this.light.shadow.mapSize.set(c.size,c.size);if(this.light.shadow.map){this.light.shadow.map.dispose();this.light.shadow.map=null}this.R.shadowMap.type=c.type}
  this._flags();this.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true});this.dirty=true}
 _flags(){const on=this.shadow!=='off';this.sets.forEach(s=>s.ims.forEach(im=>{im.castShadow=im.receiveShadow=on}))}
 setRings(b){this.rings=b;this.dirty=true}
 setAuto(b){this.auto=b;this._n=this._t=this._low=this._good=0;if(!b){this._applyPR(this.userPR);this._applyQuality(this.userQ)}}
 describe(){return QUALITY[this.quality].far+'·'+this.quality+' ×'+Math.min(devicePixelRatio,this.pr)}
 // ---- per frame ----
 update(){const cam=this.cam;cam.updateMatrixWorld();const e=cam.matrixWorld.elements;let ch=this.dirty;
  for(let i=0;i<16;i++)if(e[i]!==this._le[i]){ch=true;this._le[i]=e[i]}
  if(!ch)return false;this.dirty=false;
  const pm=new M4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),fr=new THREE.Frustum().setFromProjectionMatrix(pm),sph=new THREE.Sphere(new V3(),this.shadow==='off'?1.5:2.8),vis=[];
  for(const u of this.units.values()){const T=this.types[u.type];sph.center.set(u.x,T.H/2,u.z);if(!fr.intersectsSphere(sph))continue;vis.push({u,d:cam.position.distanceTo(sph.center)})}
  vis.sort((a,b)=>a.d-b.d);
  const Hpx=this.R.domElement.clientHeight||innerHeight,tf=2*Math.tan(cam.fov*Math.PI/360),q=QUALITY[this.quality],counts={};let tris=0;
  for(const T of Object.values(this.types)){T.near=[];T.far=[];T.bt=T.models.map(()=>[]);T.bf=T.models.map(()=>[]);T.nl=T.models.map(()=>[]);T.fl=T.models.map(()=>[]);T.rank=0;counts[T.name]=0}
  vis.forEach(v=>{const u=v.u,T=this.types[u.type];counts[T.name]++;
   if(T.turret){const t=Math.min(u.team,T.bt.length-1);(T.lc&&!(T.rank++<q.near&&v.d<(T.H*Hpx)/(tf*this.nearPx))?T.bf:T.bt)[t].push(u)}
   else{const t=Math.min(u.team,T.nl.length-1);if(T.tiered)(T.rank++<q.near&&v.d<(T.H*Hpx)/(tf*this.nearPx)?T.nl:T.fl)[t].push(u);else T.nl[t].push(u)}});
  for(const T of Object.values(this.types)){
   if(T.turret){T.bt.forEach((l,i)=>{this._fill(T.hs[i],l,'m');this._fill(T.ts[i],l,'mt');tris+=l.length*T.tri});if(T.lc)T.bf.forEach((l,i)=>{this._fill(T.hsL[i],l,'m');this._fill(T.tsL[i],l,'mt');tris+=l.length*T.triL})}
   else{T.nl.forEach((l,i)=>{this._fill(T.ns[i],l,'m');tris+=l.length*T.tri});if(T.tiered)T.fl.forEach((l,i)=>{this._fill(T.fs[i],l,'m');tris+=l.length*T.triF})}}
  const R=this.ring,mm=new M4();(this.rings?vis:[]).forEach((v,i)=>{const s=this.types[v.u.type].ringR/.78;mm.compose(new V3(v.u.x,.03,v.u.z),new THREE.Quaternion(),new V3(s,1,s));R.setMatrixAt(i,mm);R.setColorAt(i,this.teamColors[v.u.team]||this.teamColors[0])});
  R.count=this.rings?vis.length:0;R.instanceMatrix.needsUpdate=true;if(R.instanceColor)R.instanceColor.needsUpdate=true;
  this.stats={visible:vis.length,counts,tris};return true}
 _fill(set,list,key){set.ims.forEach(im=>{list.forEach((u,k)=>im.setMatrixAt(k,u[key]));im.count=list.length;im.instanceMatrix.needsUpdate=true});set.group.visible=list.length>0}
 // auto quality: call once per rendered frame while drawing continuously (dt in ms)
 frame(dt){if(!this.auto||document.hidden||dt>80)return;this._n++;this._t+=dt;if(this._t<3000)return;
  const fps=this._n*1000/this._t,now=performance.now();this._n=0;this._t=0;
  if(fps<50){this._low++;this._good=0}else if(fps>=58){this._good++;this._low=0}else this._low=0;
  if(this._low>=2&&now-this._last>8000){this._low=0;this._last=now;this._degrade()}
  else if(this._good>=10&&now-this._last>30000){this._good=0;this._last=now;this._upgrade()}}
 _degrade(){if(this.pr>2)this._applyPR(2);else if(this.pr>1.5)this._applyPR(1.5);else{const i=ORDER.indexOf(this.quality);if(i>=3)return;this._applyQuality(ORDER[i+1])}this.onAuto&&this.onAuto('自动降级 → '+this.describe())}
 _upgrade(){const i=ORDER.indexOf(this.quality),u=ORDER.indexOf(this.userQ);
  if(i>u)this._applyQuality(ORDER[i-1]);else if(this.pr<this.userPR){const n=PRS[PRS.indexOf(this.pr)+1];this._applyPR(n>this.userPR?this.userPR:n)}else return;
  this.onAuto&&this.onAuto('自动回升 → '+this.describe())}
}
