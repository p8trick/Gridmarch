import * as THREE from 'three';

// Exact geometry/material instancing. No simplification or material approximation.
export function instanceMovingParts({sides,movingNodes}){
 const signatures=new Map();
 function signature(geometry){
  if(signatures.has(geometry))return signatures.get(geometry);
  let hash=2166136261;const bytes=[];
  for(const key of Object.keys(geometry.attributes).sort()){
   const a=geometry.attributes[key];bytes.push(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
   for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  }
  if(geometry.index)bytes.push(new Uint8Array(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength));
  for(const data of bytes)for(const v of data)hash=Math.imul(hash^v,16777619);
  const value=hash>>>0;signatures.set(geometry,value);return value;
 }
 function identical(a,b){
  const attrs=Object.keys(a.attributes).sort();if(attrs.join()!=Object.keys(b.attributes).sort().join())return false;
  for(const key of [...attrs,'index']){
   const x=key==='index'?a.index:a.attributes[key],y=key==='index'?b.index:b.attributes[key];
   if(!x||!y){if(x!==y)return false;continue;}
   if(x.itemSize!==y.itemSize||x.array.constructor!==y.array.constructor||x.array.length!==y.array.length)return false;
   for(let i=0;i<x.array.length;i++)if(x.array[i]!==y.array[i])return false;
  }return true;
 }
 for(const side of Object.values(sides)){
  const parent=side.track,belts=[],wheels=[];
  for(const offset of [.042,0]){
   const bindings=side.belts.filter(b=>b.normalOffset===offset),first=bindings[0].object;
   const batch=new THREE.InstancedMesh(first.geometry,first.material,bindings.length);batch.name=offset?'track_pads_instanced':'track_links_instanced';batch.castShadow=batch.receiveShadow=true;
   bindings.forEach((b,i)=>{b.object.updateMatrix();batch.setMatrixAt(i,b.object.matrix);b.object.removeFromParent();});parent.add(batch);movingNodes.add(batch);
   belts.push({object:batch,normalOffset:offset,phases:bindings.map(b=>b.phases[0])});
  }
  const groups=new Map();
  for(const binding of side.wheels){
   const wheel=binding.object;wheel.updateMatrix();
   for(const part of wheel.children){part.updateMatrix();const key=part.material.uuid+':'+signature(part.geometry);let candidates=groups.get(key);if(!candidates)groups.set(key,candidates=[]);
    let bucket=candidates.find(b=>identical(b.geometry,part.geometry));if(!bucket)candidates.push(bucket={geometry:part.geometry,material:part.material,items:[]});
    bucket.items.push({matrix:new THREE.Matrix4().multiplyMatrices(wheel.matrix,part.matrix),radius:binding.radius,center:wheel.position.toArray(),axis:[1,0,0]});
   }wheel.removeFromParent();movingNodes.delete(wheel);
  }
  for(const candidates of groups.values())for(const bucket of candidates){
   const batch=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.items.length);batch.name='wheel_parts_instanced';batch.castShadow=batch.receiveShadow=true;
   bucket.items.forEach((item,i)=>batch.setMatrixAt(i,item.matrix));parent.add(batch);movingNodes.add(batch);wheels.push({object:batch,instances:bucket.items.map(({radius,center,axis})=>({radius,center,axis}))});
  }
  side.belts=belts;side.wheels=wheels;
 }
}
