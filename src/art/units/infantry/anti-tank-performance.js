import * as T from 'three';
import {createAntiTankSoldier} from './anti-tank-soldier.js';
import {applyFaceProfileTrial} from './face-profile-trial.js';
import {indexGeometryExactly} from './soldier-performance.js';
import {createAntiTankFire} from './anti-tank-fire.js';
import {attachInfantryFactions} from './infantry-factions.js';

export const createAntiTankBaseline=({bootProfile='B1',wristProfile='W2'}={})=>attachInfantryFactions(applyFaceProfileTrial(createAntiTankSoldier({bootProfile,wristProfile,factionSupport:true})));
const byteSize=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength||0);
let bank,effectBank;
export function prepareAntiTankPerformance(){
 if(bank)return bank.stats;
 const source=createAntiTankBaseline(),names=[...Object.keys(source.joints),'rocket_launcher','right_launcher_glove','left_launcher_glove'],nodes=names.map(n=>source.getObjectByName(n));
 const record=()=>{const a=new Float64Array(nodes.length*7);nodes.forEach((n,i)=>{n.position.toArray(a,i*7);n.quaternion.toArray(a,i*7+3);});return a;};
 const clips={},fireClips={},poses=new Map();
 for(const mode of['launcher','rifle']){
  source.setWeaponMode(mode);clips[mode]={};fireClips[mode]={};
  for(const name of['walk','run']){clips[mode][name]=[];for(let i=0;i<=48;i++){source.sampleCycle(name,i/48);clips[mode][name].push(record());}}
  for(const name of['aim','kneel']){fireClips[mode][name]=[];for(let i=0;i<=16;i++){source.sampleFirePose(name,i/16);fireClips[mode][name].push(record());}}
  for(const name of['idle','aim','kneel']){source.setPose(name);poses.set([mode,name,1,0,0].join('|'),record());}
 }
 source.setWeaponMode('launcher');source.setPose('idle');const prototype=source.clone(true),materials=new Map(),geometries=new Map();
 let originalBytes=0,indexedBytes=0,originalVertices=0,indexedVertices=0,residentMeshes=0;
 prototype.traverse(o=>{
  if(!o.isMesh)return;residentMeshes++;
  if(!geometries.has(o.geometry)){const raw=o.geometry,indexed=indexGeometryExactly(raw);geometries.set(raw,indexed);originalBytes+=byteSize(raw);indexedBytes+=byteSize(indexed);originalVertices+=raw.attributes.position.count;indexedVertices+=indexed.attributes.position.count;}
  o.geometry=geometries.get(o.geometry);
  const json=o.material.toJSON();delete json.uuid;delete json.metadata;delete json.name;const key=JSON.stringify(json);if(!materials.has(key))materials.set(key,o.material.clone());o.material=materials.get(key);if(o.matrixAutoUpdate)o.updateMatrix();o.matrixAutoUpdate=false;
 });
 const stats=Object.freeze({residentMeshes,uniqueGeometries:geometries.size,sharedMaterials:materials.size,originalBytes,indexedBytes,originalVertices,indexedVertices,clipFrames:264,movableNodes:names.length,activeMeshes:24,activeTriangles:30395});
 bank={source,names,record,prototype,clips,fireClips,poses,stats};return stats;
}

export function createPerformanceAntiTank({faction='neutral'}={}){
 if(!bank)prepareAntiTankPerformance();const b=bank,unit=b.prototype.clone(true),nodes=b.names.map(n=>unit.getObjectByName(n));
 unit.name='AntiTank_Infantry_V1_6P_F1_B1_W2';unit.userData.version='AT1.6P';unit.userData.performance={losslessIndexing:true,sharedGeometry:true,sharedMaterials:true,sharedClips:true,head:'F1',boots:'B1',wrists:'W2'};
 unit.joints=Object.fromEntries(b.names.slice(0,-3).map((n,i)=>[n,nodes[i]]));
 unit.launcher=unit.getObjectByName('rocket_launcher');unit.stowedRifle=unit.getObjectByName('back_stowed_rifle');unit.launcherGloves={right:unit.getObjectByName('right_launcher_glove'),left:unit.getObjectByName('left_launcher_glove')};
 unit.equipmentKeepers={rifle:unit.getObjectByName('rifle_pack_keepers'),launcher:unit.getObjectByName('empty_launcher_keepers')};
 unit.performanceMeshes=[];unit.traverse(o=>{if(o.isMesh)unit.performanceMeshes.push(o);});unit.poseRevision=0;
 const rifleMeshes=unit.joints.rifle.children.filter(o=>o.isMesh),qa=new T.Quaternion(),qb=new T.Quaternion();
 let mode='launcher',ammo=1,pose='idle',amount=1,phase=0,recoil=0,lastKey='';
 function visibility(){const held=mode==='launcher';rifleMeshes.forEach(o=>o.visible=!held);unit.joints.right_hand.visible=unit.joints.left_hand.visible=!held;unit.stowedRifle.visible=held;unit.launcherGloves.right.visible=unit.launcherGloves.left.visible=held;unit.launcher.visible=true;unit.equipmentKeepers.launcher.visible=!held;unit.userData.weaponMode=mode;unit.userData.rocketAmmo=ammo;}
 function apply(a,z=a,t=0,key){
  if(key!==lastKey){lastKey=key;nodes.forEach((g,i)=>{if(mode==='rifle'&&i>=nodes.length-2)return;const o=i*7;g.position.fromArray(a,o);if(t){g.position.x+=(z[o]-a[o])*t;g.position.y+=(z[o+1]-a[o+1])*t;g.position.z+=(z[o+2]-a[o+2])*t;}qa.fromArray(a,o+3);if(t){qb.fromArray(z,o+3);qa.slerp(qb,t);}g.quaternion.copy(qa);});unit.poseRevision++;}
  visibility();unit.userData.pose=pose;unit.updateMatrixWorld(true);
 }
 unit.setPose=(name='idle',mix=1,p=0,kick=0)=>{
  if(!['idle','aim','kneel','walk','run'].includes(name))throw Error('Unknown pose: '+name);
  pose=name;amount=T.MathUtils.clamp(Number.isFinite(mix)?mix:1,0,1);phase=Number.isFinite(p)?p:0;recoil=T.MathUtils.clamp(Number.isFinite(kick)?kick:0,0,1);
  const key=[mode,pose,amount,phase,recoil].join('|');let frame=b.poses.get(key);
  if(!frame){b.source.setWeaponMode(mode);b.source.setPose(pose,amount,phase,recoil);frame=b.record();if(b.poses.size>=128)b.poses.delete(b.poses.keys().next().value);b.poses.set(key,frame);}
  apply(frame,frame,0,'pose:'+key);
 };
 unit.sampleCycle=(name,p)=>{const frames=b.clips[mode][name];if(!frames)throw Error('Unknown cycle: '+name);pose=name;amount=1;phase=Number.isFinite(p)?p:0;recoil=0;const f=((phase%1+1)%1)*48,i=Math.min(47,Math.floor(f));apply(frames[i],frames[i+1],f-i,['cycle',mode,name,phase].join(':'));};
 unit.sampleFirePose=(name,kick=0)=>{const frames=b.fireClips[mode][name];if(!frames)throw Error('Firing pose must be aim or kneel');pose=name;amount=1;recoil=T.MathUtils.clamp(Number.isFinite(kick)?kick:0,0,1);const f=recoil*16,i=Math.min(15,Math.floor(f));apply(frames[i],frames[i+1],f-i,['fire',mode,name,f].join(':'));};
 unit.setWeaponMode=next=>{if(!['launcher','rifle'].includes(next))throw Error('Unknown weapon mode');mode=next;unit.setPose(pose,amount,phase,recoil);return unit;};
 unit.setRocketAmmo=n=>{ammo=Math.max(0,Math.floor(Number.isFinite(n)?n:0));return unit.setWeaponMode(ammo?'launcher':'rifle');};
 unit.setPose('idle');return attachInfantryFactions(unit,faction);
}

// Same controller, timing and visual geometry as V1.1. Pool only its per-unit
// projectile resources; flash resources are already shared by infantry-fire.
export function createPerformanceAntiTankFire(unit){
 const fire=createAntiTankFire(unit),meshes=fire.rocket.children.filter(o=>o.isMesh);
 if(!effectBank){const gs=new Map(),ms=new Map();effectBank=meshes.map(m=>{if(!gs.has(m.geometry))gs.set(m.geometry,m.geometry.clone());if(!ms.has(m.material))ms.set(m.material,m.material.clone());return{g:gs.get(m.geometry),m:ms.get(m.material)};});}
 const oldG=new Set(meshes.map(m=>m.geometry)),oldM=new Set(meshes.map(m=>m.material));meshes.forEach((m,i)=>{m.geometry=effectBank[i].g;m.material=effectBank[i].m;});oldG.forEach(g=>g.dispose());oldM.forEach(m=>m.dispose());
 fire.unit=unit;fire.performanceEffectMeshes=[fire.rifle.flash,fire.flash,fire.backblast,...meshes];return fire;
}
export const getAntiTankPerformanceStats=()=>bank?.stats??null;
