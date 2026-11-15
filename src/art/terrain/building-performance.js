import * as T from 'three';

// Exact geometry batching. Original component groups stay editable; only their
// source meshes are hidden. Render batches live outside those source groups.
const controllers=new WeakMap(), indexed=new WeakMap(), cache=new Map();
const noRaycast=()=>{};
let nextGeometry=1;const geometryIds=new WeakMap();
const geometryId=g=>{if(!geometryIds.has(g))geometryIds.set(g,nextGeometry++);return geometryIds.get(g);};
function compact(g){
 if(indexed.has(g))return indexed.get(g);
 const attrs=['position','normal','color'].map(k=>g.attributes[k]);
 if(attrs.some(a=>!a||a.itemSize!==3))throw Error('Building batching requires position, normal and color');
 const bits=attrs.map(a=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length));
 const values=[[],[],[]],indices=[],map=new Map(),n=g.index?g.index.count:attrs[0].count;
 for(let i=0;i<n;i++){
  const j=g.index?g.index.getX(i):i,key=bits.map(a=>[a[j*3],a[j*3+1],a[j*3+2]].join(',')).join(';');
  let id=map.get(key);if(id===undefined){id=map.size;map.set(key,id);attrs.forEach((a,k)=>values[k].push(a.getX(j),a.getY(j),a.getZ(j)));}indices.push(id);
 }
 const result={values:values.map(a=>new Float32Array(a)),indices};indexed.set(g,result);return result;
}
function trimCache(){
 if(cache.size<=48)return;
 for(const [key,v] of cache){if(!v.refs){v.geometry.dispose();cache.delete(key);if(cache.size<=32)break;}}
}
function acquire(records,key){
 if(cache.has(key)){const e=cache.get(key);e.refs++;return e;}
 const pos=[],norm=[],color=[],indices=[],ranges=[];let offset=0,face=0;
 for(const r of records){
  const c=compact(r.mesh.geometry),normalMatrix=new T.Matrix3().getNormalMatrix(r.matrix);
  for(let i=0;i<c.values[0].length;i+=3){
   const p=new T.Vector3().fromArray(c.values[0],i).applyMatrix4(r.matrix),n=new T.Vector3().fromArray(c.values[1],i).applyMatrix3(normalMatrix).normalize();
   pos.push(p.x,p.y,p.z);norm.push(n.x,n.y,n.z);color.push(...c.values[2].subarray(i,i+3));
  }
  for(const i of c.indices)indices.push(i+offset);
  ranges.push({start:face,end:face+c.indices.length/3,id:r.id});face+=c.indices.length/3;offset+=c.values[0].length/3;
 }
 const geometry=new T.BufferGeometry();
 for(const [name,a] of [['position',pos],['normal',norm],['color',color]])geometry.setAttribute(name,new T.Float32BufferAttribute(a,3));
 geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const entry={geometry,ranges,refs:1};cache.set(key,entry);trimCache();return entry;
}
function visibleTo(mesh,target){for(let p=mesh.parent;p&&p!==target;p=p.parent)if(!p.visible)return false;return true;}
export function enableBuildingPerformance(root){
 if(controllers.has(root))return root;
 const target=root.getObjectByName('view_facing')||root;
 controllers.set(root,{target,sources:new Map(),batches:[],signature:'',disposed:false});
 root.userData.edition='performance';syncBuildingPerformance(root);return root;
}
export function syncBuildingPerformance(root){
 const c=controllers.get(root);if(!c)return root;if(c.disposed)throw Error('Building performance instance disposed');
 const {target}=c;
 // New optional support/accessory components can be attached after creation.
 target.traverse(o=>{if(!o.isMesh||o.userData.buildingRenderBatch||o.userData.unitVisual)return;
  for(let p=o.parent;p&&p!==target;p=p.parent)if(p.name==='unit_anchor'||p.userData.unitVisual)return;
  if(!c.sources.has(o))c.sources.set(o,{mesh:o,visible:o.visible,raycast:o.raycast});o.visible=false;o.raycast=noRaycast;
 });
 root.updateMatrixWorld(true);const records=[];
 for(const record of c.sources.values()){
  const mesh=record.mesh;if(!record.visible||!visibleTo(mesh,target))continue;
  let p=mesh,belongs=false;while(p){if(p===target){belongs=true;break;}p=p.parent;}if(!belongs)continue;
  let id=mesh.name;for(let p=mesh.parent;p&&p!==target;p=p.parent)id=p.name+'/'+id;
  const matrix=new T.Matrix4();for(let p=mesh;p&&p!==target;p=p.parent){p.updateMatrix();matrix.premultiply(p.matrix);}
  records.push({mesh,id,matrix});
 }
 const groups=new Map();for(const r of records){const k=[r.mesh.material.uuid,r.mesh.castShadow,r.mesh.receiveShadow,r.mesh.renderOrder,r.mesh.layers.mask].join(':');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 const descriptions=[...groups.values()].map(rs=>({rs,key:rs.map(r=>[geometryId(r.mesh.geometry),r.id,...r.matrix.elements].join(',')).join('|')}));
 const signature=descriptions.map(({rs,key})=>rs[0].mesh.material.uuid+':'+key).join('\n');
 if(signature===c.signature)return root;
 for(const b of c.batches){target.remove(b.mesh);b.entry.refs--;}
 c.batches=[];
 for(const {rs,key} of descriptions){
  const entry=acquire(rs,key),source=rs[0].mesh,mesh=new T.Mesh(entry.geometry,source.material);
  mesh.name='building_render_batch';mesh.userData.buildingRenderBatch=true;mesh.userData.hitRanges=entry.ranges;
  mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;mesh.layers.mask=source.layers.mask;
  target.add(mesh);c.batches.push({mesh,entry});
 }
 c.signature=signature;trimCache();return root;
}
export function getBuildingHitSource(hit){
 const range=hit.object?.userData.hitRanges?.find(r=>hit.faceIndex>=r.start&&hit.faceIndex<r.end);return range?.id??hit.object?.name;
}
export function getBuildingRenderStats(root){
 let meshes=0,triangles=0,geometryBytes=0;const geometries=new Set();
 root.traverseVisible(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
  if(!geometries.has(o.geometry)){geometries.add(o.geometry);geometryBytes+=Object.values(o.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(o.geometry.index?.array.byteLength??0);}
 });return {meshes,triangles,geometryBytes};
}
export function disposeBuildingPerformance(root){
 const c=controllers.get(root);if(!c||c.disposed)return;
 for(const b of c.batches){c.target.remove(b.mesh);b.entry.refs--;}
 for(const record of c.sources.values()){record.mesh.visible=record.visible;record.mesh.raycast=record.raycast;}
 c.batches=[];c.disposed=true;controllers.delete(root);root.userData.edition='original';trimCache();
}
export function detachBuildingComponent(root,id){
 const c=controllers.get(root),part=root.getObjectByName(id);if(!c||!part||part===root||part.isMesh)throw Error('An independent component group is required');
 const meshes=[];part.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){const record=c.sources.get(mesh);if(record){mesh.visible=record.visible;mesh.raycast=record.raycast;c.sources.delete(mesh);}}
 part.removeFromParent();syncBuildingPerformance(root);return enableBuildingPerformance(part);
}
export function clearUnusedBuildingCache(){for(const [key,e] of cache)if(!e.refs){e.geometry.dispose();cache.delete(key);}}
