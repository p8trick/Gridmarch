import {compactCoastMeshes,getCoastHitSource} from '../../water/coast-performance.js';
import * as original from './bridges.js';

// Batch each logical bridge cell separately. Its placement, rotation, picking
// metadata and culling boundary are kept; only identity-local static meshes
// sharing the exact material and render state are merged and indexed.
export function optimizeBridgeGroup(group){
 const before=original.bridgeStats(group),containers=[];
 group.traverse(o=>{if(o.children?.some(c=>c.isMesh))containers.push(o);});
 for(const parent of containers){
  const meshes=parent.children.filter(c=>c.isMesh),merged=compactCoastMeshes(meshes);
  for(const m of meshes){parent.remove(m);m.geometry.dispose();}
  for(const m of merged){m.name='bridge_batched';m.userData.bridgeSources=m.userData.coastSources;parent.add(m);}
  parent.userData.edition='performance';
 }
 group.userData={...group.userData,edition:'performance',referenceStats:before};
 return group;
}
export const createRiverBridge=options=>optimizeBridgeGroup(original.createRiverBridge(options));
export const createRiverBridgeRun=options=>optimizeBridgeGroup(original.createRiverBridgeRun(options));
export const createSeaBridgeModule=options=>optimizeBridgeGroup(original.createSeaBridgeModule(options));
export const createSeaBridgeHead=options=>optimizeBridgeGroup(original.createSeaBridgeHead(options));
export const getBridgeHitSource=getCoastHitSource;
export {BRIDGE_SPEC,BRIDGE_RULES,bridgeStats,disposeBridge,seaBridgeHeadHeight,getBridgeSurfaceY} from './bridges.js';
