import * as THREE from 'three';
// Bake a soldier into one geometry per material (flat world transforms), keeping triangles intact.
export function bake(root,opts={}){
 root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),map=new Map(),M=new THREE.Matrix4();
 const KEEP=/eye|nose|face|mouth|brow|night_vision/i;
 root.traverse(o=>{if(!o.isMesh)return;const keep=KEEP.test(o.name||'');if(opts.minSize&&!keep&&new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).length()<opts.minSize)return;const key=o.material.uuid+'|'+keep;let e=map.get(key);if(!e)map.set(key,e={material:o.material,keep,pos:[],col:[],useCol:o.material.vertexColors});
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();M.multiplyMatrices(inv,o.matrixWorld);g.applyMatrix4(M);
  const p=g.attributes.position.array.slice();
  if(M.determinant()<0)for(let i=0;i<p.length;i+=9)for(let k=0;k<3;k++){const t=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=t}
  e.pos.push(p);
  if(e.useCol){const c=g.attributes.color;if(c){const a=c.array;e.col.push(c.itemSize===3?a:Float32Array.from({length:p.length},(_,i)=>a[Math.floor(i/3)*4+i%3]))}else e.col.push(new Float32Array(p.length).fill(1))}});
 return [...map.values()].map(e=>{const n=e.pos.reduce((s,a)=>s+a.length,0),P=new Float32Array(n);let o=0;e.pos.forEach(a=>{P.set(a,o);o+=a.length});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));
  if(e.useCol){const C=new Float32Array(n);o=0;e.col.forEach(a=>{C.set(a,o);o+=a.length});g.setAttribute('color',new THREE.BufferAttribute(C,3))}
  g.computeVertexNormals();g.computeBoundingSphere();return{material:e.material,geometry:g,keep:e.keep}})}
// Vertex-clustering decimation: snaps vertices to a grid of `cell` units, averages position/color per cell,
// drops triangles that collapse. Tiny parts vanish, silhouettes and main colors stay.
export function simplify(parts,cell){return parts.map(p=>{if(p.keep)return p;const g=p.geometry,P=g.attributes.position.array,C=g.attributes.color&&g.attributes.color.array,n=P.length/3,id=new Int32Array(n),cl=new Map(),acc=[];
 for(let i=0;i<n;i++){const k=Math.round(P[i*3]/cell)+','+Math.round(P[i*3+1]/cell)+','+Math.round(P[i*3+2]/cell);let c=cl.get(k);if(c===undefined){c=acc.length;cl.set(k,c);acc.push([0,0,0,0,0,0,0])}id[i]=c;const a=acc[c];a[0]+=P[i*3];a[1]+=P[i*3+1];a[2]+=P[i*3+2];if(C){a[3]+=C[i*3];a[4]+=C[i*3+1];a[5]+=C[i*3+2]}a[6]++}
 const op=[],oc=[];for(let t=0;t<n;t+=3){const a=id[t],b=id[t+1],c=id[t+2];if(a===b||b===c||a===c)continue;[a,b,c].forEach(j=>{const q=acc[j],m=q[6];op.push(q[0]/m,q[1]/m,q[2]/m);if(C)oc.push(q[3]/m,q[4]/m,q[5]/m)})}
 if(!op.length)return null;const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(op,3));if(C)ng.setAttribute('color',new THREE.Float32BufferAttribute(oc,3));ng.computeVertexNormals();ng.computeBoundingSphere();return{material:p.material,geometry:ng}}).filter(Boolean)}
export const triCount=ps=>ps.reduce((s,p)=>s+p.geometry.attributes.position.count/3,0);

// Silhouette-preserving LOD: parts smaller than minSize (model units, soldier ~4.2 tall) are dropped,
// kept parts stay untouched; only the over-tessellated camo cloth is clustered with clothCell.
export function makeLOD(root,minSize,clothCell){return bake(root,{minSize}).map(p=>p.material.vertexColors&&!p.keep?simplify([p],clothCell)[0]:p).filter(Boolean)}
