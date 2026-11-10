import * as T from 'three';
import * as original from './forest-original.js';

export const FOREST_SPEC=original.FOREST_SPEC;
export const forestStats=original.forestStats;
export const disposeForest=original.disposeForest;
function makeBatch(batch){
 const source=batch.rows,unique=[],indices=[],lookup=new Map(),v=new Float32Array(9),bits=new Uint32Array(v.buffer);
 for(let i=0;i<source.length;i+=9){for(let k=0;k<9;k++)v[k]=source[i+k];const key=Array.from(bits).join(',');let index=lookup.get(key);if(index===undefined){index=unique.length/9;lookup.set(key,index);unique.push(...v);}indices.push(index);}
 const indexBytes=unique.length/9<=65535?2:4,indexed=unique.length*4+indices.length*indexBytes<source.length*4,rows=indexed?unique:source,p=[],n=[],c=[];
 for(let i=0;i<rows.length;i+=9){p.push(rows[i],rows[i+1],rows[i+2]);n.push(rows[i+3],rows[i+4],rows[i+5]);c.push(rows[i+6],rows[i+7],rows[i+8]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));if(indexed)g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 const m=new T.Mesh(g,batch.material);m.name=batch.name;m.castShadow=batch.castShadow;m.receiveShadow=batch.receiveShadow;m.renderOrder=batch.renderOrder;return m;
}
export function optimizeForest(source,{batchSpan=3}={}){
 if(!Number.isInteger(batchSpan)||batchSpan<1||batchSpan>8)throw Error('batchSpan must be an integer from 1 to 8');
 source.updateMatrixWorld(true);const meshes=[];source.traverse(o=>{if(o.isMesh)meshes.push(o);});const cellOf=o=>[Math.floor((o.matrixWorld.elements[12]+1)/2),Math.floor((o.matrixWorld.elements[14]+1)/2)];
 const cells=meshes.map(cellOf),origin=[Math.min(0,...cells.map(c=>c[0])),Math.min(0,...cells.map(c=>c[1]))],batches=new Map(),point=new T.Vector3(),normal=new T.Vector3();
 // Anchor each nonempty region at its minimum logical cell. Keep bounded
 // spatial batches so the renderer can still cull distant forest sections.
 if(cells.length){origin[0]=Math.min(...cells.map(c=>c[0]));origin[1]=Math.min(...cells.map(c=>c[1]));}
 for(let k=0;k<meshes.length;k++){
  const o=meshes[k],cell=cells[k],chunk=[Math.floor((cell[0]-origin[0])/batchSpan),Math.floor((cell[1]-origin[1])/batchSpan)];if(Array.isArray(o.material))throw Error('Forest source mesh must use one material');
  const key=[...chunk,o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder].join('|');if(!batches.has(key))batches.set(key,{name:'forest_chunk_'+chunk.join('_'),material:o.material,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,rows:[]});
  const b=batches.get(key),g=o.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,index=g.index,count=index?index.count:p.count,normalMatrix=new T.Matrix3().getNormalMatrix(o.matrixWorld);
  for(let i=0;i<count;i++){const j=index?index.getX(i):i;point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);normal.fromBufferAttribute(n,j).applyMatrix3(normalMatrix);b.rows.push(Math.fround(point.x),Math.fround(point.y),Math.fround(point.z),Math.fround(normal.x),Math.fround(normal.y),Math.fround(normal.z),c.getX(j),c.getY(j),c.getZ(j));}
 }
 const root=new T.Group();root.name=source.name;for(const b of batches.values())root.add(makeBatch(b));root.userData={...source.userData,version:FOREST_SPEC.version,edition:'performance',batchSpan,referenceStats:forestStats(source)};root.userData.stats=forestStats(root);disposeForest(source);return root;
}
export function createTreePine(variant=0,seed=1){return optimizeForest(original.createTreePine(variant,seed));}
export function createTreeBroad(variant=0,seed=1){return optimizeForest(original.createTreeBroad(variant,seed));}
export function createForestRegion(records=[],options={}){return optimizeForest(original.createForestRegion(records),options);}
export const PARTS={tree_pine:{...original.PARTS.tree_pine,create:createTreePine},tree_broad:{...original.PARTS.tree_broad,create:createTreeBroad}};
