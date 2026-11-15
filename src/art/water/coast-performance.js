import * as T from 'three';

// Exact opaque-geometry batching: positions, colors AND normals are retained.
// In particular, normals used by shadow normalBias are never averaged away.
const states=['castShadow','receiveShadow','renderOrder','frustumCulled','visible','customDepthMaterial','customDistanceMaterial','onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
export function coastGeometryBytes(mesh){const g=mesh.geometry;return Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(g.index?.array.byteLength||0);}
export function coastTriangleCount(mesh){const g=mesh.geometry;return (g.index?.count||g.attributes.position.count)/3;}
function compatible(a,b){return a.material===b.material&&a.layers.mask===b.layers.mask&&states.every(k=>a[k]===b[k]);}
function check(mesh){
 if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.transparent)throw Error('exact coast batching requires static opaque meshes');
 if(mesh.position.lengthSq()||mesh.rotation.x||mesh.rotation.y||mesh.rotation.z||mesh.scale.x!==1||mesh.scale.y!==1||mesh.scale.z!==1)throw Error('source coast meshes must have identity local transforms');
 const g=mesh.geometry,count=g.index?.count||g.attributes.position.count;
 if(g.groups.length||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count<count)throw Error('full coast geometry required');
 for(const a of Object.values(g.attributes))if(a.isInterleavedBufferAttribute||!(a.array instanceof Float32Array))throw Error('Float32 coast attributes required');
}
function compactBatch(meshes){
 const first=meshes[0],names=Object.keys(first.geometry.attributes).sort(),layout=names.map(n=>[n,first.geometry.attributes[n]]),values=Object.fromEntries(names.map(n=>[n,[]])),indices=[],lookup=new Map(),sources=[];
 let referenceBytes=0,triangleStart=0;
 for(const m of meshes){check(m);const g=m.geometry;
  if(Object.keys(g.attributes).sort().join(',')!==names.join(','))throw Error('matching coast attributes required');
  for(const [name,ref] of layout){const a=g.attributes[name];if(a.itemSize!==ref.itemSize||a.normalized!==ref.normalized||a.usage!==ref.usage||a.gpuType!==ref.gpuType)throw Error('matching coast attribute layout required');}
  const bits=Object.fromEntries(names.map(n=>{const a=g.attributes[n].array;return [n,new Uint32Array(a.buffer,a.byteOffset,a.length)];})),count=g.index?.count||g.attributes.position.count;
  referenceBytes+=coastGeometryBytes(m);sources.push({name:m.name,firstTriangle:triangleStart,triangles:count/3});triangleStart+=count/3;
  for(let i=0;i<count;i++){
   const j=g.index?g.index.getX(i):i,key=[];for(const [name,a] of layout)for(let k=0;k<a.itemSize;k++)key.push(bits[name][j*a.itemSize+k]);
   const text=key.join(',');let id=lookup.get(text);
   if(id===undefined){id=lookup.size;lookup.set(text,id);for(const [name,a] of layout){const source=g.attributes[name].array;for(let k=0;k<a.itemSize;k++)values[name].push(source[j*a.itemSize+k]);}}
   indices.push(id);
  }
 }
 let g=new T.BufferGeometry();for(const [name,a] of layout){const next=new T.BufferAttribute(new Float32Array(values[name]),a.itemSize,a.normalized);next.setUsage(a.usage);next.gpuType=a.gpuType;g.setAttribute(name,next);}g.setIndex(indices);
 const indexedBytes=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength,expandedBytes=indices.length*layout.reduce((s,[,a])=>s+a.itemSize*4,0);
 // Some tiny facet groups have no reusable vertices. Keep those unindexed.
 if(indexedBytes>=expandedBytes){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
 g.computeBoundingBox();g.computeBoundingSphere();
 const out=new T.Mesh(g,first.material);for(const key of states)out[key]=first[key];out.layers.mask=first.layers.mask;
 out.name=meshes.length===1?first.name:'terrain_surface';
 out.userData={...(meshes.length===1?first.userData:{}),coastSources:sources,referenceMeshes:meshes.length,referenceBytes,geometryBytes:coastGeometryBytes(out),triangles:triangleStart,indexBits:g.index?g.index.array.BYTES_PER_ELEMENT*8:0};
 return out;
}
export function compactCoastMeshes(meshes){
 const batches=[];for(const m of meshes){check(m);let batch=batches.find(b=>compatible(b[0],m));if(!batch){batch=[];batches.push(batch);}batch.push(m);}
 return batches.map(compactBatch);
}
export function getCoastHitSource(hit){
 const i=hit.faceIndex;return hit.object.userData.coastSources?.find(s=>i>=s.firstTriangle&&i<s.firstTriangle+s.triangles)?.name||hit.object.name;
}
