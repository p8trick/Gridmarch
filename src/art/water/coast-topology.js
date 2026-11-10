import {createFinalCoast,makeFinalShoalProfile} from './coast-final.js';
import {SHOAL_RULES} from './shoal-rules.js';
import {CLIFF_COAST_RULES} from './cliff-coast-rules.js';

// MT1 combines the approved A7.3/C2 shapes. It does not alter their source files.
// All coordinates here are logical cells; generated geometry uses world spacing 2.
const directions=[[0,1],[1,0],[0,-1],[-1,0]],diagonals=[[1,1],[-1,1],[-1,-1],[1,-1]];
const key=(x,z)=>`${x},${z}`;
const rotate=([x,z],q)=>{for(let i=0;i<q;i++)[x,z]=[-z,x];return [x,z];};
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const frozenCells=cells=>Object.freeze(cells.map(c=>Object.freeze([...c])));
function validateCells(cells,name,{empty=false}={}){
 if(!Array.isArray(cells)||(!empty&&!cells.length)||cells.some(c=>!Array.isArray(c)||c.length!==2||!c.every(Number.isSafeInteger))||new Set(cells.map(c=>c.join(','))).size!==cells.length)throw Error(`${name}: unique ${empty?'':'nonempty '}integer [x,z] cells required`);
}
export class CoastTopologyConflict extends Error {
 constructor(conflicts){
  super(`MT1: ${conflicts.length} cell(s) need multiple shore features inside one square: ${conflicts.slice(0,6).map(c=>`[${c.cell}] ${c.reason}`).join('; ')}. Widen/revise these cells or use a future multi-sided coast module.`);
  this.name='CoastTopologyConflict';this.conflicts=conflicts;
 }
}

// A single world-space inland wave has no per-corner or per-cell phase reset.
// Amplitudes/wavelengths are those of A7.3; only the shared map phase is new.
export function topologySandOffset(wx,wz,seed=7){
 return .14*Math.sin((wx+wz)*2.5+seed*.42)+.05*Math.sin((wx-wz)*5.7-seed*.27)+.02*Math.sin((wx+wz)*10.3+seed*.31);
}

export function planCoastTopology({cells,landCells,coastType='shoal',typeForCell=null,seed=7}={}){
 validateCells(cells,'cells');validateCells(landCells,'landCells',{empty:true});
 if(!['shoal','cliff','mixed'].includes(coastType)||!Number.isSafeInteger(seed))throw Error('MT1.1: shoal/cliff/mixed coast type and integer seed required');
 if(coastType==='mixed'?typeof typeForCell!=='function':typeForCell!==null)throw Error('MT1.1: mixed coasts require typeForCell; uniform coasts must omit it');
 const board=frozenCells(cells),boardSet=new Set(board.map(c=>key(...c))),land=frozenCells(landCells),landSet=new Set(land.map(c=>key(...c))),records=new Map(),profiles=new Map();
 const isLand=(x,z)=>landSet.has(key(x,z));
 function recordAt(x,z){
  if(![x,z].every(Number.isSafeInteger))throw Error('MT1: integer cell coordinates required');
  const id=key(x,z);if(records.has(id))return records.get(id);
  let kind='sea',rotation=0,reason=null,exposed=[];
  if(isLand(x,z)){
   exposed=directions.filter(([dx,dz])=>!isLand(x+dx,z+dz));
   const inner=diagonals.filter(([dx,dz])=>!isLand(x+dx,z+dz)&&isLand(x+dx,z)&&isLand(x,z+dz));
   if(!exposed.length){
    if(!inner.length)kind='land';
    else if(inner.length===1){kind='inner';rotation=diagonals.findIndex(d=>same(d,inner[0]));}
    else reason='several concave corners';
   }else if(exposed.length===1&&!inner.length){
    kind='straight';rotation=[0,1,2,3].find(q=>same(rotate([0,1],q),exposed[0]));
   }else if(exposed.length===2&&!inner.length){
    rotation=[0,1,2,3].find(q=>[[0,1],[1,0]].every(d=>exposed.some(e=>same(e,rotate(d,q)))));
    if(rotation===undefined)reason='opposite shores / one-cell-wide strip';else kind='outer';
   }else reason=inner.length?'a straight/convex shore plus another concave corner':'three/four exposed shores';
  }
  let terrain=reason?null:kind==='land'?'land':kind==='sea'?'sea':coastType;
  if(terrain==='mixed'){
   if(!boardSet.has(id))throw Error(`MT1.1: mixed shore neighbor [${x},${z}] is outside the complete plan; include it in cells before rendering chunks`);
   terrain=typeForCell(x,z);
   if(!['shoal','cliff'].includes(terrain))throw Error(`MT1.1: typeForCell(${x},${z}) must explicitly return shoal or cliff`);
  }
  const record=Object.freeze({cell:Object.freeze([x,z]),kind:reason?'unsupported':kind,rotation:rotation??0,reason,exposed:frozenCells(exposed),terrain,rules:terrain==='shoal'?SHOAL_RULES:terrain==='cliff'?CLIFF_COAST_RULES:null});
  records.set(id,record);return record;
 }
 const selected=board.map(c=>recordAt(...c)),conflicts=selected.filter(r=>r.reason);
 if(conflicts.length)throw new CoastTopologyConflict(conflicts);
 function profileForCell(x,z){
  const id=key(x,z);if(profiles.has(id))return profiles.get(id);
  const record=recordAt(x,z);if(record.reason)throw new CoastTopologyConflict([record]);
  const context=record.kind==='land'||record.kind==='sea',base=makeFinalShoalProfile({kind:context?'straight':record.kind,rotation:record.rotation,origin:[x,z],seed});
  // These fields are local to one cell but their values agree on every shared
  // shore edge. Fully dry/wet context edges are outside the transition bands.
  const profile=Object.freeze({...base,key:`MT1:${record.kind}:${record.rotation}:${x}:${z}:${seed}`,distance:context?()=>record.kind==='land'?-4:4:base.distance,sandOffset:(wx,wz)=>topologySandOffset(wx,wz,seed)});
  profiles.set(id,profile);return profile;
 }
 const counts={land:0,sea:0,straight:0,outer:0,inner:0},coastCounts={shoal:0,cliff:0};for(const r of selected){counts[r.kind]++;if(r.terrain==='shoal'||r.terrain==='cliff')coastCounts[r.terrain]++;}
 // Snapshot the selected coast types in records. The caller's callback is not
 // used again when lazily building skirts, chunks or the other edition.
 const resolvedTypeForCell=(x,z)=>{const r=recordAt(x,z);return r.terrain==='shoal'?'shoal':'cliff';};
 return Object.freeze({version:'MT1',revision:'MT1.1',cellSize:2,landY:0,waterY:-.3,coastType,seed,cells:board,landCells:land,records:Object.freeze(selected),counts:Object.freeze(counts),coastCounts:Object.freeze(coastCounts),isLand,recordAt,profileForCell,typeForCell:resolvedTypeForCell});
}

export function createCoastTopology(plan,options={}){
 if(plan?.version!=='MT1')throw Error('MT1: a planCoastTopology result is required');
 const {cells=plan.cells,neighbors=plan.cells,edition='performance',cutaway=false,bottom=-.7}=options;
 const allowed=new Set(plan.cells.map(c=>key(...c)));validateCells(cells,'render cells');validateCells(neighbors,'neighbors');
 if(cells.some(c=>!allowed.has(key(...c))))throw Error('MT1: render cells must belong to the complete board plan');
 const occupied=new Set(neighbors.map(c=>key(...c)));
 if(cells.some(c=>!occupied.has(key(...c))))throw Error('MT1: neighbors must include all render cells');
 const mixed=plan.coastType==='mixed',component=createFinalCoast(mixed?'cliff':plan.coastType,cells,{profile:plan.profileForCell(...cells[0]),profileForCell:plan.profileForCell,...(mixed?{typeForCell:plan.typeForCell}:{}),edition,cutaway,bottom,neighbors});
 const metadata=new Map(component.group.userData.cells.map(c=>[key(c.cx,c.cz),c]));
 for(const cell of cells){const r=plan.recordAt(...cell),m=metadata.get(key(...cell));Object.assign(m,{kind:r.kind,rotation:r.rotation,terrain:r.terrain,rules:r.rules,logicalCellSize:2,stationDiscValidated:false});}
 component.type=plan.coastType;component.group.userData.topologyVersion=plan.revision||'MT1';component.group.userData.coastMode=plan.coastType;component.group.userData.phase='world-space';component.plan=plan;
 return component;
}
