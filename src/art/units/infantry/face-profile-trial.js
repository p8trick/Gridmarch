import * as T from 'three';
import {createSoldier as createSource} from './soldier-v5_2.js';

const key=(p,c)=>[p.x,p.y,p.z,c.r,c.g,c.b].map(n=>Math.round(n*1e5)).join(',');
let edits=null;
// Depth only, in the accepted static head's design coordinates. The eye line
// and everything above the lower nose remain unchanged. These are toy units.
const stations=[[3.07,-.050],[3.125,-.050],[3.18,-.030],[3.33,0]];
function depth(y,z){
 if(y>=3.33-1e-6)return 0;
 let dz=stations[0][1];
 for(let i=1;i<stations.length;i++)if(y<=stations[i][0]){const[a,b]=stations[i-1],[c,d]=stations[i];dz=T.MathUtils.lerp(b,d,T.MathUtils.clamp((y-a)/(c-a),0,1));break;}
 return dz*T.MathUtils.smoothstep(z,-.12,.26);
}
function getEdits(){
 if(edits)return edits;
 edits=new Map();const source=createSource();source.updateMatrixWorld(true);
 const head=source.getObjectByName('head'),toNeck=new T.Matrix4().makeTranslation(0,-3.02,0),dark=new T.Color('#444739');
 head.traverse(o=>{
  if(!o.isMesh)return;
  const selected=['face','nose','chin_cup','chin_buckle'].includes(o.name);
  const strap=!o.name&&Math.abs(o.material.color.r-dark.r)+Math.abs(o.material.color.g-dark.g)+Math.abs(o.material.color.b-dark.b)<1e-5;
  if(!selected&&!strap)return;
  const g=o.geometry,a=g.attributes.position,toHead=head.matrixWorld.clone().invert().multiply(o.matrixWorld),m=toNeck.clone().multiply(o.matrixWorld);
  for(let i=0;i<a.count;i++){
   const p=new T.Vector3().fromBufferAttribute(a,i),local=p.clone().applyMatrix4(toHead),dz=depth(local.y,local.z);
   if(Math.abs(dz)<1e-8)continue;
   edits.set(key(p.applyMatrix4(m),o.material.color),{dz,part:o.name||'chin_strap'});
  }
 });
 // The temporary source is used only to identify exact part vertices. Never
 // retain or dispose any resource belonging to the user's supplied rig.
 const geometries=new Set(),materials=new Set();source.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 return edits;
}

/** Opt-in trial. Does not alter either canonical factory or shared buffers.
 * Positions are baked once; animation remains transform-only, without skinning.
 * The exact front projection is retained in the neutral, orthographic front view;
 * changed lower-face normals can still change lighting, as they should.
 */
export function applyFaceProfileTrial(unit){
 if(unit.userData.faceProfileTrial)return unit;
 if(!unit.joints?.neck)throw Error('A V6.7-compatible rigid infantry neck is required');
 const map=getEdits();let changed=0,maxShift=0,meshes=0;const parts={};
 for(const mesh of unit.joints.neck.children.filter(o=>o.isMesh)){
  const old=mesh.geometry,p=old.attributes.position,c=old.attributes.color;if(!c)continue;
  const changes=[];
  for(let i=0;i<p.count;i++){
   const edit=map.get(key(new T.Vector3().fromBufferAttribute(p,i),new T.Color().fromBufferAttribute(c,i)));
   if(edit)changes.push([i,edit]);
  }
  if(!changes.length)continue;
  const g=old.clone(),pos=g.attributes.position,n=g.attributes.normal,touched=new Set();
  for(const[i,e]of changes){pos.setZ(i,pos.getZ(i)+e.dz);touched.add(i);changed++;maxShift=Math.max(maxShift,Math.abs(e.dz));parts[e.part]=(parts[e.part]||0)+1;}
  const ids=g.index?.array,count=ids?ids.length:pos.count;
  for(let i=0;i<count;i+=3){
   const a=ids?ids[i]:i,b=ids?ids[i+1]:i+1,c=ids?ids[i+2]:i+2;
   if(![a,b,c].some(k=>touched.has(k)))continue;
   const A=new T.Vector3().fromBufferAttribute(pos,a),B=new T.Vector3().fromBufferAttribute(pos,b),C=new T.Vector3().fromBufferAttribute(pos,c),normal=B.sub(A).cross(C.sub(A)).normalize();
   for(const k of[a,b,c])n.setXYZ(k,normal.x,normal.y,normal.z);
  }
  pos.needsUpdate=n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;meshes++;
 }
 if(!changed)throw Error('The supplied head does not match the accepted V5.2 / V6.7 geometry');
 unit.userData.faceProfileTrial={id:'F1-depth-only',changedVertexEntries:changed,maxDepthShift:maxShift,changedMeshes:meshes,parts,frontXYUnchanged:true,extraTriangles:0,extraDraws:0};
 return unit;
}
