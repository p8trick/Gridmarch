import * as T from 'three';
import {createDesertRegion as originalDesert,createSwampRegion as originalSwamp,disposeExpansion,EXPANSION_SPEC} from './expansion-terrain.js';
import {geometryStats} from './expansion-geometry.js';

// No triangle removal, color quantization or normal smoothing. Vertices are
// shared only when all world-position, normal and color float32 bits match.
function packedMesh(batch){
 const source=batch.rows,unique=[],indices=[],lookup=new Map(),float=new Float32Array(9),bits=new Uint32Array(float.buffer);
 for(let i=0;i<source.length;i+=9){for(let k=0;k<9;k++)float[k]=source[i+k];const key=Array.from(bits).join(',');let index=lookup.get(key);if(index===undefined){index=unique.length/9;lookup.set(key,index);unique.push(...float);}indices.push(index);}
 const indexBytes=unique.length/9<=65535?2:4,useIndex=unique.length*4+indices.length*indexBytes<source.length*4,rows=useIndex?unique:source;
 const position=[],normal=[],color=[];for(let i=0;i<rows.length;i+=9){position.push(rows[i],rows[i+1],rows[i+2]);normal.push(rows[i+3],rows[i+4],rows[i+5]);color.push(rows[i+6],rows[i+7],rows[i+8]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('color',new T.Float32BufferAttribute(color,3));if(useIndex)g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 const m=new T.Mesh(g,batch.material);m.name=batch.name+'_batched';m.castShadow=batch.castShadow;m.receiveShadow=batch.receiveShadow;m.renderOrder=batch.renderOrder;return m;
}
export function optimizeExpansion(original,{batchSpan=3}={}){
 if(!Number.isInteger(batchSpan)||batchSpan<1||batchSpan>8)throw Error('batchSpan must be an integer from 1 to 8');
 const origin=[Math.min(...original.userData.cells.map(c=>c[0])),Math.min(...original.userData.cells.map(c=>c[1]))];
 original.updateMatrixWorld(true);const batches=new Map(),point=new T.Vector3(),normal=new T.Vector3();
 original.traverse(o=>{
  if(!o.isMesh)return;if(Array.isArray(o.material))throw Error('Expansion batching requires one material per source mesh');
  const cell=o.parent.userData.cell,chunk=[Math.floor((cell[0]-origin[0])/batchSpan),Math.floor((cell[1]-origin[1])/batchSpan)],key=[...chunk,o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder].join('|');if(!batches.has(key))batches.set(key,{name:o.name,material:o.material,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,rows:[]});
  const b=batches.get(key),p=o.geometry.attributes.position,n=o.geometry.attributes.normal,c=o.geometry.attributes.color,index=o.geometry.index,normalMatrix=new T.Matrix3().getNormalMatrix(o.matrixWorld),count=index?index.count:p.count;
  for(let i=0;i<count;i++){const j=index?index.getX(i):i;point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);normal.fromBufferAttribute(n,j).applyMatrix3(normalMatrix);b.rows.push(Math.fround(point.x),Math.fround(point.y),Math.fround(point.z),Math.fround(normal.x),Math.fround(normal.y),Math.fround(normal.z),c.getX(j),c.getY(j),c.getZ(j));}
 });
 const root=new T.Group();root.name=original.name+'_performance';for(const batch of batches.values())root.add(packedMesh(batch));
 root.userData={...original.userData,edition:'performance',batchSpan,tiles:original.children.map(t=>t.userData),referenceStats:geometryStats(original),stats:geometryStats(root)};disposeExpansion(original);return root;
}
export function createDesertRegion(cells,options={}){return optimizeExpansion(originalDesert(cells,options),options);}
export function createSwampRegion(cells,options={}){return optimizeExpansion(originalSwamp(cells,options),options);}
export function createDesertTile({cell=[0,0],...options}={}){return createDesertRegion([cell],options);}
export function createSwampTile({cell=[0,0],...options}={}){return createSwampRegion([cell],options);}
export const EXPANSION_PARTS={desert:{variants:EXPANSION_SPEC.desertVariants,create:createDesertTile,role:'terrain'},swamp:{variants:EXPANSION_SPEC.swampVariants,create:createSwampTile,role:'terrain'}};
