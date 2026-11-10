import {makeBlueprintProfile,getBlueprintStraightPorts,createBlueprintRegion,clearBlueprintCache} from './shoal-blueprint-a7.js';
import {makeCliffCoastProfile,createCliffCoastRegion,clearCliffCoastCache} from './cliff-coast-c1.js';
import {SHOAL_RULES} from './shoal-rules.js';
import {compactCoastMeshes,coastGeometryBytes,coastTriangleCount} from './coast-performance.js';

export const makeFinalShoalProfile=options=>makeBlueprintProfile({...options,waterStyle:'shore'});
export const makeFinalCliffProfile=makeCliffCoastProfile;
export const getFinalStraightPorts=getBlueprintStraightPorts;
export {SHOAL_RULES} from './shoal-rules.js';
export {CLIFF_COAST_RULES} from './cliff-coast-rules.js';
export {getCoastHitSource} from './coast-performance.js';

export function createFinalCoast(type,cells,options={}){
 if(!['shoal','cliff'].includes(type))throw Error('shoal or cliff coast required');
 if(!Array.isArray(cells)||!cells.length||cells.some(c=>!Array.isArray(c)||c.length!==2||!c.every(Number.isSafeInteger))||new Set(cells.map(c=>c.join(','))).size!==cells.length)throw Error('unique integer coast cells required');
 cells=cells.map(c=>[...c]);
 const {edition='performance',cutaway=false,bottom=-.7,releaseBuildCache=true,...rest}=options;
 if(!['original','performance'].includes(edition))throw Error('original or performance edition required');
 const profile=rest.profile||(type==='shoal'?makeFinalShoalProfile():makeFinalCliffProfile()),pick=rest.profileForCell||(()=>profile);
 const selected=(x,z)=>{const p=pick(x,z);if(p.waterStyle!=='shore')throw Error('final coasts require the approved A7.3 shore palette');return p;};
 const sourceOptions={...rest,profile,profileForCell:selected,bottom,neighbors:(rest.neighbors||cells).map(c=>[...c])},builder=type==='shoal'?createBlueprintRegion:createCliffCoastRegion;
 const build=enabled=>{try{return builder(cells,{...sourceOptions,cutaway:enabled});}finally{if(releaseBuildCache)(type==='cliff'?clearCliffCoastCache:clearBlueprintCache)();}};
 const group=build(!!cutaway),rawCut=group.getObjectByName('board_cutaway');if(rawCut)group.remove(rawCut);
 const rawSurfaces=[...group.children],referenceSurfaceBytes=rawSurfaces.reduce((s,m)=>s+coastGeometryBytes(m),0),referenceSurfaceMeshes=rawSurfaces.length;
 let surfaces=rawSurfaces,edge=null,referenceCutBytes=0,disposed=false;
 if(edition==='performance'){
  surfaces=compactCoastMeshes(rawSurfaces);group.clear();for(const m of rawSurfaces)m.geometry.dispose();group.add(...surfaces);
 }
 if(type==='shoal')group.userData.cells=group.userData.cells.map(c=>({...c,rules:c.areas.water>1e-6&&c.areas.water<3.999999?SHOAL_RULES:null}));
 group.userData.edition=edition;group.userData.finalVersions={shoal:'A7.3',cliff:'C2'};
 const occupied=new Set(sourceOptions.neighbors.map(c=>c.join(','))),hasBoundary=cells.some(([x,z])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!occupied.has([x+dx,z+dz].join(','))));
 function installCut(raw){if(!raw)return;referenceCutBytes=coastGeometryBytes(raw);if(edition==='performance'){edge=compactCoastMeshes([raw])[0];raw.geometry.dispose();}else edge=raw;edge.name='board_cutaway';group.add(edge);}
 installCut(rawCut);
 function alive(){if(disposed)throw Error('coast component disposed');}
 const api={group,surfaces,edition,type,hasBoundary,get cutaway(){return edge;},
  setCutawayEnabled(enabled){alive();if(enabled&&hasBoundary&&!edge){const temporary=build(true),raw=temporary.getObjectByName('board_cutaway');if(raw)temporary.remove(raw);temporary.traverse(m=>{if(m.isMesh)m.geometry.dispose();});installCut(raw);}if(edge)edge.visible=!!enabled;group.userData.cutaway=!!edge?.visible;return edge;},
  releaseCutaway(){alive();if(edge){group.remove(edge);edge.geometry.dispose();edge=null;referenceCutBytes=0;}group.userData.cutaway=false;},
  stats(){alive();const visible=[...surfaces.filter(m=>m.visible),...(edge?.visible?[edge]:[])],resident=[...surfaces,...(edge?[edge]:[])];return {edition,cells:cells.length,triangles:visible.reduce((s,m)=>s+coastTriangleCount(m),0),meshes:visible.length,geometryBytes:resident.reduce((s,m)=>s+coastGeometryBytes(m),0),referenceMeshes:referenceSurfaceMeshes+(edge?.visible?1:0),referenceGeometryBytes:referenceSurfaceBytes+referenceCutBytes,surfaceMeshes:surfaces.length,cutawayLoaded:!!edge,cutawayVisible:!!edge?.visible,indexBits:[...new Set(resident.map(m=>m.geometry.index?m.geometry.index.array.BYTES_PER_ELEMENT*8:0))]};},
  dispose(){if(disposed)return;api.releaseCutaway();for(const m of surfaces)m.geometry.dispose();group.clear();disposed=true;}
 };
 group.userData.cutaway=!!edge?.visible;return api;
}
