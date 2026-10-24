import * as THREE from 'three';
// Bake a soldier into one geometry per material (flat world transforms), keeping triangles intact.
export function bake(root){
 root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),map=new Map(),M=new THREE.Matrix4();
 root.traverse(o=>{if(!o.isMesh)return;let e=map.get(o.material);if(!e)map.set(o.material,e={material:o.material,pos:[],col:[],useCol:o.material.vertexColors});
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();M.multiplyMatrices(inv,o.matrixWorld);g.applyMatrix4(M);
  const p=g.attributes.position.array.slice();
  if(M.determinant()<0)for(let i=0;i<p.length;i+=9)for(let k=0;k<3;k++){const t=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=t}
  e.pos.push(p);
  if(e.useCol){const c=g.attributes.color;if(c){const a=c.array;e.col.push(c.itemSize===3?a:Float32Array.from({length:p.length},(_,i)=>a[Math.floor(i/3)*4+i%3]))}else e.col.push(new Float32Array(p.length).fill(1))}});
 return [...map.values()].map(e=>{const n=e.pos.reduce((s,a)=>s+a.length,0),P=new Float32Array(n);let o=0;e.pos.forEach(a=>{P.set(a,o);o+=a.length});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));
  if(e.useCol){const C=new Float32Array(n);o=0;e.col.forEach(a=>{C.set(a,o);o+=a.length});g.setAttribute('color',new THREE.BufferAttribute(C,3))}
  g.computeVertexNormals();g.computeBoundingSphere();return{material:e.material,geometry:g}})}
