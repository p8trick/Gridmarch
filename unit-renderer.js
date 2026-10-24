// UnitRenderer — instanced battlefield units with per-unit frustum culling, distance LOD,
// team rings, 4 quality levels, 3 shadow levels, optional auto-downgrade.
import * as THREE from 'three';
import {bake,makeLOD,triCount} from './batch.js';
const TIER={L0:[.12,.06],L1:[.25,.1],L2:[.45,.15],L3:[.55,.2]};
export const QUALITY={high:{far:'L0',near:40},mid:{far:'L1',near:30},low:{far:'L2',near:16},min:{far:'L3',near:0}};
export const ORDER=['high','mid','low','min'];
const SHADOW={off:null,low:{size:512,type:THREE.BasicShadowMap},high:{size:2048,type:THREE.PCFSoftShadowMap}};
const PRS=[1,1.5,2,3];
export class UnitRenderer{
 constructor({scene,camera,renderer,light,model,scale=1.8/4.21,capacity=100,teamColors=[0x3b82f6,0xe5484d],quality='high',shadow='high',pixelRatio=3,nearPx=72}){
  Object.assign(this,{scene,cam:camera,R:renderer,light,S:scale,cap:capacity,nearPx,teamColors:teamColors.map(c=>new THREE.Color(c))});
  this.parts={full:bake(model)};for(const k in TIER)this.parts[k]=makeLOD(model,...TIER[k]);
  this.triOf={full:triCount(this.parts.full)};for(const k in TIER)this.triOf[k]=triCount(this.parts[k]);
  this.units=new Map();this.dirty=true;this._le=new Float32Array(16);
  this.auto=true;this._n=0;this._t=0;this._low=0;this._good=0;this._last=0;this.onAuto=null;
  this.stats={visible:0,near:0,far:0,tris:0};
  this.nearSet=this._mkSet(this.parts.full);
  this.ring=new THREE.InstancedMesh(new THREE.RingGeometry(.55,.78,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,depthWrite:false}),capacity);
  this.ring.count=0;this.ring.frustumCulled=false;this.ring.renderOrder=1;scene.add(this.ring);
  this.userQ=quality;this.userPR=pixelRatio;this.quality=quality;this.pr=pixelRatio;
  this._applyQuality(quality);this._applyPR(pixelRatio);this.setShadow(shadow);
 }
 _mkSet(ps){const group=new THREE.Group(),ims=ps.map(p=>{const im=new THREE.InstancedMesh(p.geometry,p.material,this.cap);im.count=0;im.frustumCulled=false;group.add(im);return im});this.scene.add(group);return{group,ims}}
 // ---- units ----
 _mat(u){u.m=new THREE.Matrix4().compose(new THREE.Vector3(u.x,0,u.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),u.rot||0),new THREE.Vector3(this.S,this.S,this.S))}
 addUnit(u){u={rot:0,team:0,...u};this._mat(u);this.units.set(u.id,u);this.dirty=true}
 moveUnit(id,x,z,rot){const u=this.units.get(id);if(!u)return;u.x=x;u.z=z;if(rot!==undefined)u.rot=rot;this._mat(u);this.dirty=true}
 removeUnit(id){this.units.delete(id);this.dirty=true}
 // ---- settings ----
 setQuality(q){this.userQ=q;this._applyQuality(q)}
 _applyQuality(q){this.quality=q;if(this.farSet)this.scene.remove(this.farSet.group);this.farSet=this._mkSet(this.parts[QUALITY[q].far]);this._flags();this.dirty=true}
 setPixelRatio(r){this.userPR=r;this._applyPR(r)}
 _applyPR(r){this.pr=r;this.R.setPixelRatio(Math.min(devicePixelRatio,r));this.R.setSize(innerWidth,innerHeight);this.dirty=true}
 setShadow(s){this.shadow=s;const c=SHADOW[s];this.light.castShadow=!!c;this.R.shadowMap.enabled=!!c;
  if(c){this.light.shadow.mapSize.set(c.size,c.size);if(this.light.shadow.map){this.light.shadow.map.dispose();this.light.shadow.map=null}this.R.shadowMap.type=c.type}
  this._flags();this.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true});this.dirty=true}
 _flags(){const on=this.shadow!=='off';[this.nearSet,this.farSet].forEach(s=>s&&s.ims.forEach(im=>{im.castShadow=im.receiveShadow=on}))}
 setAuto(b){this.auto=b;this._n=this._t=this._low=this._good=0;if(!b){this._applyPR(this.userPR);this._applyQuality(this.userQ)}}
 describe(){return QUALITY[this.quality].far+'·'+this.quality+' ×'+Math.min(devicePixelRatio,this.pr)}
 // ---- per frame ----
 update(){const cam=this.cam;cam.updateMatrixWorld();const e=cam.matrixWorld.elements;let ch=this.dirty;
  for(let i=0;i<16;i++)if(e[i]!==this._le[i]){ch=true;this._le[i]=e[i]}
  if(!ch)return false;this.dirty=false;
  const pm=new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse),fr=new THREE.Frustum().setFromProjectionMatrix(pm);
  const sph=new THREE.Sphere(new THREE.Vector3(),this.shadow==='off'?1.3:2.6),vis=[];
  for(const u of this.units.values()){sph.center.set(u.x,.9,u.z);if(!fr.intersectsSphere(sph))continue;vis.push({u,d:cam.position.distanceTo(sph.center)})}
  vis.sort((a,b)=>a.d-b.d);
  const H=this.R.domElement.clientHeight||innerHeight,nd=(4.21*this.S*H)/(2*Math.tan(cam.fov*Math.PI/360)*this.nearPx),q=QUALITY[this.quality],near=[],far=[];
  vis.forEach((v,i)=>(i<q.near&&v.d<nd?near:far).push(v.u));
  this._fill(this.nearSet,near);this._fill(this.farSet,far);
  const R=this.ring,mm=new THREE.Matrix4();vis.forEach((v,i)=>{mm.makeTranslation(v.u.x,.03,v.u.z);R.setMatrixAt(i,mm);R.setColorAt(i,this.teamColors[v.u.team]||this.teamColors[0])});
  R.count=vis.length;R.instanceMatrix.needsUpdate=true;if(R.instanceColor)R.instanceColor.needsUpdate=true;
  this.stats={visible:vis.length,near:near.length,far:far.length,tris:near.length*this.triOf.full+far.length*this.triOf[q.far]};return true}
 _fill(set,list){set.ims.forEach(im=>{list.forEach((u,k)=>im.setMatrixAt(k,u.m));im.count=list.length;im.instanceMatrix.needsUpdate=true});set.group.visible=list.length>0}
 // auto quality: call once per rendered frame while drawing continuously (dt in ms)
 frame(dt){if(!this.auto||document.hidden||dt>80)return;this._n++;this._t+=dt;if(this._t<3000)return;
  const fps=this._n*1000/this._t,now=performance.now();this._n=0;this._t=0;
  if(fps<50){this._low++;this._good=0}else if(fps>=58){this._good++;this._low=0}else this._low=0;
  if(this._low>=2&&now-this._last>8000){this._low=0;this._last=now;this._degrade()}
  else if(this._good>=10&&now-this._last>30000){this._good=0;this._last=now;this._upgrade()}}
 _degrade(){if(this.pr>2)this._applyPR(2);else if(this.pr>1.5)this._applyPR(1.5);else{const i=ORDER.indexOf(this.quality);if(i>=3)return;this._applyQuality(ORDER[i+1])}this.onAuto&&this.onAuto('自动降级 → '+this.describe())}
 _upgrade(){const i=ORDER.indexOf(this.quality),u=ORDER.indexOf(this.userQ);
  if(i>u)this._applyQuality(ORDER[i-1]);else if(this.pr<this.userPR)this._applyPR(PRS[Math.min(PRS.indexOf(this.pr)+1,PRS.length-1)]>this.userPR?this.userPR:PRS[PRS.indexOf(this.pr)+1]);else return;
  this.onAuto&&this.onAuto('自动回升 → '+this.describe())}
}
