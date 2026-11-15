import {createRiverArt as original} from './river-r61-art.js';
import {compactCoastMeshes,coastGeometryBytes,coastTriangleCount,getCoastHitSource} from './coast-performance.js';

// Static R6.1 river data only: no simplification, palette changes or new normals.
export function optimizeRiverGroup(group){
 if(!group?.isGroup||group.children.some(m=>!m.isMesh))throw Error('a static river mesh group is required');
 if(group.userData.optimization?.version==='R6.1-performance')return group;
 const old=[...group.children],packed=compactCoastMeshes(old);
 for(const m of old){group.remove(m);m.geometry.dispose();}
 for(const m of packed){m.name='river_surface';group.add(m);}
 group.userData.optimization={version:'R6.1-performance',method:'exact attributes and compatible opaque batches'};
 return group;
}
export function createRiverArt(cells,options={}){return optimizeRiverGroup(original(cells,options));}
export const getRiverHitSource=getCoastHitSource;
export function getRiverStats(group){
 let meshes=0,triangles=0,geometryBytes=0,referenceMeshes=0,referenceGeometryBytes=0;const indexBits=new Set();
 group.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=coastTriangleCount(m);geometryBytes+=coastGeometryBytes(m);
  referenceMeshes+=m.userData.referenceMeshes??1;referenceGeometryBytes+=m.userData.referenceBytes??coastGeometryBytes(m);
  indexBits.add(m.geometry.index?m.geometry.index.array.BYTES_PER_ELEMENT*8:0);});
 return {meshes,triangles,geometryBytes,referenceMeshes,referenceGeometryBytes,bufferReduction:referenceGeometryBytes?1-geometryBytes/referenceGeometryBytes:0,indexBits:[...indexBits].sort()};
}
export function getRiverWaterArea(group){
 let total=0;group.traverse(m=>{if(!m.isMesh)return;
  const g=m.geometry,p=g.attributes.position,index=g.index;
  const sources=m.userData.coastSources||(m.name==='water_surface'?[{name:'water_surface',firstTriangle:0,triangles:coastTriangleCount(m)}]:[]);
  for(const source of sources)if(source.name==='water_surface')for(let t=source.firstTriangle;t<source.firstTriangle+source.triangles;t++){
   const ids=[0,1,2].map(k=>index?index.getX(t*3+k):t*3+k),x=ids.map(i=>p.getX(i)),z=ids.map(i=>p.getZ(i));
   total+=Math.abs((x[1]-x[0])*(z[2]-z[0])-(x[2]-x[0])*(z[1]-z[0]))/2;}
 });return total;
}
