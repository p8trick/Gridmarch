import * as T from 'three';
import {MAT_WATER} from 'palette';
import {batch,C} from './terrain-buildings.js';
import {setDockyardLayout} from './terrain-transport.js';
import {syncBuildingPerformance} from './building-performance.js';

export const DOCKYARD_TERRAIN_INTERFACE=Object.freeze({version:'D1',cellSize:2,landY:0,waterY:-.3,deckY:.085,landStandY:.087,capacity:1});
const supports=new Map();
// Samples actual approved coast/sea triangles. Never rotates, cuts or recolors
// terrain. Recreate this sampler after replacing the terrain group's meshes.
export function createDockyardTerrainSampler(group){
 const meshes=[];group.traverse(o=>{if(o.isMesh&&o.name!=='board_cutaway'&&!o.name.includes('cutaway'))meshes.push(o);});
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
 return (x,z)=>{group.updateMatrixWorld(true);ray.set(new T.Vector3(x,100,z),down);
  const hit=ray.intersectObjects(meshes,false).find(h=>h.object.visible);if(!hit)return null;
  return {height:hit.point.y,kind:hit.object.material===MAT_WATER||/water|sea_surface/.test(hit.object.name)?'water':'solid'};
 };
}
function supportGeometry(kind,bottom){
 const key=kind+':'+bottom;if(supports.has(key))return supports.get(key);
 const b=batch('terrain_support');
 const [x0,x1,z0,z1]=kind==='back'?[-.97,.97,-.38,.38]:[-.21,.21,-.55,.59],k=.025;
 const poly=[[x0+k,z0],[x1-k,z0],[x1,z0+k],[x1,z1-k],[x1-k,z1],[x0+k,z1],[x0,z1-k],[x0,z0+k]];
 // Only extend existing side faces; the top is already closed by the R3 quay.
 for(let i=0;i<8;i++){const a=poly[i],c=poly[(i+1)%8];b.quad([a[0],bottom,a[1]],[a[0],-.199,a[1]],[c[0],-.199,c[1]],[c[0],bottom,c[1]],C.dark);}
 const geometry=b.done().geometry;supports.set(key,geometry);return geometry;
}
function installSupports(root,waterY,landY){
 const bottom=Math.min(-.201,waterY-landY-.09);
 for(const [name,kind] of [['quay_back','back'],['pier_left','pier'],['pier_right','pier']]){
  const part=root.getObjectByName(name);let mesh=part.children.find(m=>m.userData.dockyardSupport);
  if(!mesh){mesh=new T.Mesh();mesh.name='terrain_support';mesh.userData.dockyardSupport=true;mesh.castShadow=true;mesh.receiveShadow=true;part.add(mesh);}
  mesh.geometry=supportGeometry(kind,bottom);mesh.material=root.getObjectByName('quay_back').children.find(m=>m.name==='body').material;
 }
}
export function getDockyardAnchors(root,{waterY=root.userData.terrainMount?.waterY??-.3}={}){
 root.updateMatrixWorld(true);const berth=root.getObjectByName('berth_module');
 const ground=berth.localToWorld(new T.Vector3(0,.087,.40)),ship=berth.localToWorld(new T.Vector3(0,0,.40));ship.y=waterY;
 return {ground,ship,heading:root.rotation.y+berth.rotation.y};
}
export function getDockyardVisualCells(root){
 root.updateMatrixWorld(true);const box=new T.Box3(),cells=[];
 // During auto-fit the old render batch has not been rebuilt yet. Measure the
 // actual editable components instead, so stale batches cannot reserve cells.
 root.traverse(o=>{if(!o.isMesh||o.userData.buildingRenderBatch)return;for(let p=o.parent;p&&p!==root;p=p.parent)if(!p.visible)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});
 for(let x=Math.floor((box.min.x+1+1e-6)/2);x<=Math.floor((box.max.x+1-1e-6)/2);x++)for(let z=Math.floor((box.min.z+1+1e-6)/2);z<=Math.floor((box.max.z+1-1e-6)/2);z++)cells.push([x,z]);
 return cells;
}
export function inspectDockyardBasin(root,sampleTerrain,{waterY=root.userData.terrainMount?.waterY??-.3}={}){
 if(typeof sampleTerrain!=='function')throw Error('sampleTerrain(x,z) required');
 const berth=root.getObjectByName('berth_module'),width=root.userData.waterWidth??1.1,samples=[],blocked=[];
 root.updateMatrixWorld(true);
 // Clear rectangle inside the fixed-width side piers, ahead of the back quay.
 for(const x of [-width/2+.10,0,width/2-.10])for(const z of [0,.14,.28,.42,.56,.70,.84]){
  const p=berth.localToWorld(new T.Vector3(x,0,z)),surface=sampleTerrain(p.x,p.z),ok=surface?.kind==='water'&&Math.abs(surface.height-waterY)<.035;
  const row={x:p.x,z:p.z,height:surface?.height??null,kind:surface?.kind??'missing',ok};samples.push(row);if(!ok)blocked.push(row);
 }
 return {ok:blocked.length===0,samples: samples.length,blocked,waterY,clearWidth:width-.20,clearLength:.84};
}
export class DockyardPlacementError extends Error{constructor(report){super('Dockyard basin is obstructed or missing terrain; supply available wet neighboring cells or choose another placement.');this.name='DockyardPlacementError';this.report=report;}}
export function mountDockyardOnTerrain(root,{cell=[0,0],quarter=0,landY=0,waterY=-.3,sampleTerrain,autoFit=true,allowNeighborOverhang=true,maxBerthShift=.70}={}){
 if(root.name!=='bld_dockyard'||cell.length!==2||!cell.every(Number.isSafeInteger)||!Number.isSafeInteger(quarter)||![landY,waterY,maxBerthShift].every(Number.isFinite)||waterY>=landY-.05||maxBerthShift<0||maxBerthShift>2)throw Error('Valid dockyard, integer cell/quarter and land/water heights required');
 if(typeof sampleTerrain!=='function')throw Error('Actual terrain sampler required; placement cannot assume an empty basin');
 const berth=root.getObjectByName('berth_module'),before={position:root.position.clone(),rotation:root.rotation.clone(),berthPosition:berth.position.clone()};
 root.position.set(cell[0]*2,landY,cell[1]*2);root.rotation.set(0,((quarter%4)+4)%4*Math.PI/2,0);
 const origin=berth.position.z,candidates=autoFit?Array.from(new Set([origin,...Array.from({length:Math.floor(maxBerthShift/.05)+1},(_,i)=>Number((i*.05).toFixed(3)))])):[origin];
 let report,selected=null;
 for(const z of candidates){berth.position.z=z;root.updateMatrixWorld(true);report=inspectDockyardBasin(root,sampleTerrain,{waterY});
  const cells=getDockyardVisualCells(root),overhang=cells.some(c=>c[0]!==cell[0]||c[1]!==cell[1]);
  if(report.ok&&(allowNeighborOverhang||!overhang)){selected={z,cells,overhang};break;}
 }
 if(!selected){root.position.copy(before.position);root.rotation.copy(before.rotation);berth.position.copy(before.berthPosition);root.updateMatrixWorld(true);throw new DockyardPlacementError({...report,allowNeighborOverhang});}
 installSupports(root,waterY,landY);root.userData.terrainMount={version:'D1',cell:[...cell],quarter:((quarter%4)+4)%4,landY,waterY,berthZ:selected.z,visualCells:selected.cells,neighborOverhang:selected.overhang};
 syncBuildingPerformance(root);
 return {root,logicalCell:[...cell],visualCells:selected.cells,neighborOverhang:selected.overhang,berthZ:selected.z,anchors:getDockyardAnchors(root),basin:report};
}
// Call after manually moving a component; original R3 layout/state APIs remain
// valid. Check the basin again if its transform or the terrain has changed.
export function refreshDockyardTerrain(root){syncBuildingPerformance(root);return getDockyardAnchors(root);}
