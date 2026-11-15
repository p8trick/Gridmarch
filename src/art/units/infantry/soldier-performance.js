import * as T from 'three';
import {createSoldier as createStandard} from './soldier-rig.js';

// Lossless indexing: identity includes every raw attribute bit, not a position
// tolerance. Hard normals, camouflage boundaries and triangle order survive.
export function indexGeometryExactly(source){
 const entries=Object.entries(source.attributes),bits=entries.map(([,a])=>new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 const table=new Map(),unique=[],indices=[],count=source.index?.count??source.attributes.position.count;
 for(let k=0;k<count;k++){
  const i=source.index?source.index.getX(k):k;let key='';
  for(let j=0;j<entries.length;j++){const a=entries[j][1],start=i*a.itemSize*a.array.BYTES_PER_ELEMENT,end=start+a.itemSize*a.array.BYTES_PER_ELEMENT;for(let b=start;b<end;b++)key+=String.fromCharCode(bits[j][b]);}
  let index=table.get(key);if(index===undefined){index=unique.length;table.set(key,index);unique.push(i);}indices.push(index);
 }
 const g=new T.BufferGeometry();
 for(const [name,a] of entries){const data=new a.array.constructor(unique.length*a.itemSize);for(let j=0;j<unique.length;j++)for(let c=0;c<a.itemSize;c++)data[j*a.itemSize+c]=a.array[unique[j]*a.itemSize+c];g.setAttribute(name,new T.BufferAttribute(data,a.itemSize,a.normalized));}
 g.setIndex(new T.BufferAttribute(unique.length<=65536?new Uint16Array(indices):new Uint32Array(indices),1));
 source.groups.forEach(x=>g.addGroup(x.start,x.count,x.materialIndex));g.setDrawRange(source.drawRange.start,source.drawRange.count);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
const bytes=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength||0);
let bank;
export function preparePerformanceSoldier(source){
 if(bank)return bank.stats;
 if(!source)source=createStandard();
 const names=Object.keys(source.joints),groups=names.map(n=>source.joints[n]);
 const record=()=>{const a=new Float64Array(names.length*7);groups.forEach((g,i)=>{g.position.toArray(a,i*7);g.quaternion.toArray(a,i*7+3);});return a;};
 const restore=a=>groups.forEach((g,i)=>{g.position.fromArray(a,i*7);g.quaternion.fromArray(a,i*7+3);});
 function author(fn){const saved=record(),p=source.position.clone(),q=source.quaternion.clone(),s=source.scale.clone(),meta={pose:source.userData.pose,unreachableArms:source.userData.unreachableArms,wristError:source.userData.wristError};try{source.position.set(0,0,0);source.quaternion.identity();source.scale.setScalar(1);source.updateMatrixWorld(true);return fn();}finally{restore(saved);source.position.copy(p);source.quaternion.copy(q);source.scale.copy(s);Object.assign(source.userData,meta);source.updateMatrixWorld(true);}}
 const clips={},fireClips={},poses=new Map();let prototype;
 author(()=>{
  for(const name of ['walk','run']){clips[name]=[];for(let i=0;i<=48;i++){source.sampleCycle(name,i/48);clips[name].push(record());}}
  for(const name of ['aim','kneel']){fireClips[name]=[];for(let i=0;i<=16;i++){source.sampleFirePose(name,i/16);fireClips[name].push(record());}}
  for(const name of ['idle','aim','kneel']){source.setPose(name);poses.set(name+'|1|0',record());}
  source.setPose('idle');prototype=source.clone(true);prototype.getObjectByName('muzzle_fx')?.removeFromParent();
 });
 const materials=new Map(),rawMeshes=[],optimizedMeshes=[];let originalBytes=0,indexedBytes=0,originalVertices=0,indexedVertices=0;
 prototype.traverse(o=>{if(!o.isMesh)return;rawMeshes.push(o);originalBytes+=bytes(o.geometry);originalVertices+=o.geometry.attributes.position.count;
  const g=indexGeometryExactly(o.geometry);o.geometry=g;indexedBytes+=bytes(g);indexedVertices+=g.attributes.position.count;o.updateMatrix();o.matrixAutoUpdate=false;
  const json=o.material.toJSON();delete json.uuid;delete json.metadata;delete json.name;const key=JSON.stringify(json);if(!materials.has(key))materials.set(key,o.material.clone());o.material=materials.get(key);optimizedMeshes.push(o);
 });
 const stats=Object.freeze({triangles:source.userData.triangles,meshes:optimizedMeshes.length,joints:names.length,originalBytes,indexedBytes,originalVertices,indexedVertices,sharedMaterials:materials.size,clipFrames:132});
 bank={source,names,prototype,clips,fireClips,poses,record,author,stats};return stats;
}
export function createPerformanceSoldier({source}={}){
 if(!bank)preparePerformanceSoldier(source);
 const b=bank,unit=b.prototype.clone(true),list=b.names.map(n=>unit.getObjectByName(n)),body=[];unit.traverse(o=>{if(o.isMesh)body.push(o);});
 unit.name='Infantry_V6_8P';unit.userData.version='6.8.0';unit.userData.performance={losslessIndexing:true,sharedGeometry:true,sharedClips:true};
 unit.joints=Object.fromEntries(b.names.map((name,i)=>[name,list[i]]));unit.performanceMeshes=body;unit.poseRevision=0;
 const qa=new T.Quaternion(),qb=new T.Quaternion();let lastKey='';
 function apply(a,z=a,t=0,key=''){
  if(key===lastKey)return;lastKey=key;for(let i=0;i<list.length;i++){const o=i*7,g=list[i];g.position.fromArray(a,o);if(t)g.position.x+=(z[o]-a[o])*t,g.position.y+=(z[o+1]-a[o+1])*t,g.position.z+=(z[o+2]-a[o+2])*t;qa.fromArray(a,o+3);if(t){qb.fromArray(z,o+3);qa.slerp(qb,t);}g.quaternion.copy(qa);}unit.poseRevision++;unit.updateMatrixWorld(true);
 }
 unit.setPose=(name='idle',amount=1,phase=0)=>{const t=T.MathUtils.clamp(amount,0,1),key=name+'|'+t+'|'+phase;let frame=b.poses.get(key);if(!frame){frame=b.author(()=>{b.source.setPose(name,t,phase);return b.record();});if(b.poses.size>=128)b.poses.delete(b.poses.keys().next().value);b.poses.set(key,frame);}apply(frame,frame,0,'pose:'+key);unit.userData.pose=name;unit.userData.unreachableArms=0;unit.userData.wristError=0;};
 unit.sampleCycle=(name,phase)=>{const frames=b.clips[name];if(!frames)throw Error('Unknown cycle: '+name);const f=((phase%1+1)%1)*48,i=Math.min(47,Math.floor(f)),t=f-i;apply(frames[i],frames[i+1],t,'cycle:'+name+':'+phase);unit.userData.pose=name;};
 unit.sampleFirePose=(name,kick=0)=>{const frames=b.fireClips[name];if(!frames)throw Error('Firing pose must be aim or kneel');const f=T.MathUtils.clamp(kick,0,1)*16,i=Math.min(15,Math.floor(f));apply(frames[i],frames[i+1],f-i,'fire:'+name+':'+f);unit.userData.pose=name;};
 unit.setPose('idle');return unit;
}
export function getPerformanceStats(){return bank?.stats??null;}
