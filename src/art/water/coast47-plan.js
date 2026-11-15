import {makeFinalShoalProfile} from './coast-final.js';
import {topologySandOffset} from './coast-topology.js';
import {SHOAL_RULES} from './shoal-rules.js';
import {CLIFF_COAST_RULES} from './cliff-coast-rules.js';
import {coastMaskFromLand,describeCoastMask,COAST_NEIGHBORS} from './coast47-mask.js';

const id=(x,z)=>`${x},${z}`,freezeCells=a=>Object.freeze(a.map(c=>Object.freeze([...c])));
export function validateCoastCells(cells,name,{empty=false}={}){
 if(!Array.isArray(cells)||(!empty&&!cells.length)||cells.some(c=>!Array.isArray(c)||c.length!==2||!c.every(Number.isSafeInteger))||new Set(cells.map(c=>c.join(','))).size!==cells.length)throw Error(`${name}: unique ${empty?'':'nonempty '}integer [x,z] cells required`);
}
const local=(wx,wz,x,z,q)=>{let u=wx-x*2,v=wz-z*2;for(let i=0;i<q;i++)[u,v]=[v,-u];return [u,v];};
let planSerial=0;
const noise=(x,z,s)=>.025*Math.sin(x*3.1+z*1.4+s*.2)+.012*Math.sin(x*7.2-z*4.1);
function fingerprint(cells,land,seed){let h=2166136261;for(const c of [seed,...cells.map(c=>c.join(',')).sort(),...land.map(c=>c.join(',')).sort()].join('|'))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);}

export function planCoast47({cells,landCells,coastType='shoal',typeForCell=null,seed=7}={}){
 validateCoastCells(cells,'cells');validateCoastCells(landCells,'landCells',{empty:true});
 if(!['shoal','cliff','mixed'].includes(coastType)||!Number.isSafeInteger(seed))throw Error('MT2: shoal/cliff/mixed coast mode and integer seed required');
 if(coastType==='mixed'?typeof typeForCell!=='function':typeForCell!==null)throw Error('MT2: mixed mode requires explicit typeForCell; omit it for uniform mode');
 const board=freezeCells(cells),land=freezeCells(landCells),landSet=new Set(land.map(c=>id(...c))),boardSet=new Set(board.map(c=>id(...c))),shapes=new Map(),records=new Map(),profiles=new Map(),stamp=fingerprint(board,land,seed)+'-'+(++planSerial);
 const isLand=(x,z)=>landSet.has(id(x,z));
 function shapeAt(x,z){
  const key=id(x,z);if(!shapes.has(key))shapes.set(key,isLand(x,z)?describeCoastMask(coastMaskFromLand(isLand,x,z)):null);return shapes.get(key);
 }
 function recordAt(x,z){
  if(![x,z].every(Number.isSafeInteger))throw Error('MT2: integer cell coordinates required');
  const key=id(x,z);if(records.has(key))return records.get(key);
  const shape=shapeAt(x,z);let terrain=!shape?'sea':shape.kind==='land'?'land':coastType;
  if(terrain==='mixed'){
   if(!boardSet.has(key))throw Error(`MT2: shore [${x},${z}] must be in the complete plan before rendering its neighbors`);
   terrain=typeForCell(x,z);if(!['shoal','cliff'].includes(terrain))throw Error(`MT2: typeForCell(${x},${z}) must explicitly return shoal or cliff`);
  }
  const r=Object.freeze({cell:Object.freeze([x,z]),kind:shape?.kind||'sea',mask:shape?.mask??null,atlasIndex:shape?.index??null,shape,terrain,rules:terrain==='shoal'?SHOAL_RULES:terrain==='cliff'?CLIFF_COAST_RULES:null,stationDiscValidated:false});records.set(key,r);return r;
 }
 const selected=Object.freeze(board.map(c=>recordAt(...c)));
 // Narrow terrain needs narrower sand bands, otherwise both shores consume all
 // its grass. The bilinear world field is shared at tile edges; no phase reset.
 const narrowAt=(x,z)=>shapeAt(x,z)?.narrow?1:0;
 function sandOffset(wx,wz){
  const u=wx/2,v=wz/2,x=Math.floor(u),z=Math.floor(v),a=u-x,b=v-z;
  const n=(narrowAt(x,z)*(1-a)+narrowAt(x+1,z)*a)*(1-b)+(narrowAt(x,z+1)*(1-a)+narrowAt(x+1,z+1)*a)*b;
  return (.67+topologySandOffset(wx,wz,seed))*(1-.82*n)-.67;
 }
 function profileForCell(x,z){
  const key=id(x,z);if(profiles.has(key))return profiles.get(key);
  const r=recordAt(x,z),shape=r.shape,base=makeFinalShoalProfile({kind:shape?.legacy&&shape.kind!=='land'?shape.kind:'straight',rotation:shape?.rotation||0,origin:[x,z],seed});
  let distance;
  if(!shape)distance=()=>4;
  else if(shape.kind==='land')distance=()=>-4;
  else if(shape.legacy)distance=base.distance;
  else if(shape.kind==='islet')distance=(wx,wz)=>{const d=Math.hypot(wx-x*2,wz-z*2)-.8+noise(wx,wz,seed);return d>0?d*4:d;};
  else if(shape.kind==='cap')distance=(wx,wz)=>{const [u,v]=local(wx,wz,x,z,shape.rotation);return Math.hypot(u,Math.max(0,-v))-1/3+noise(wx,wz,seed);};
  else{
   const fields=[];
   for(const [q,bit] of [[0,1],[1,8],[2,4],[3,2]])if(!(shape.mask&bit))fields.push(makeFinalShoalProfile({kind:'straight',rotation:q,origin:[x,z],seed}).distance);
   for(const [q,a,b] of [[0,1,2],[1,1,8],[2,4,8],[3,4,2]])if(!(shape.mask&a)&&!(shape.mask&b))fields.push(makeFinalShoalProfile({kind:'outer',rotation:q,origin:[x,z],seed}).distance);
   for(const q of shape.innerCorners)fields.push(makeFinalShoalProfile({kind:'inner',rotation:q,origin:[x,z],seed}).distance);
   distance=(wx,wz)=>Math.max(...fields.map(f=>f(wx,wz)));
  }
  const profile=Object.freeze({...base,key:`MT2:${stamp}:${shape?.mask??'sea'}:${x}:${z}:${seed}`,distance,sandOffset});profiles.set(key,profile);return profile;
 }
 const resolvedTypeForCell=(x,z)=>recordAt(x,z).terrain==='shoal'?'shoal':'cliff';
 const counts={land:0,sea:0,shoal:0,cliff:0,legacy:0,expanded:0};for(const r of selected){counts[r.terrain]++;if(r.shape)counts[r.shape.legacy?'legacy':'expanded']++;}
 return Object.freeze({version:'MT2',cellSize:2,landY:0,waterY:-.3,seed,coastType,cells:board,landCells:land,records:selected,counts:Object.freeze(counts),isLand,recordAt,shapeAt,profileForCell,typeForCell:resolvedTypeForCell,
  dirtyCellsAfterEdit(x,z){if(![x,z].every(Number.isSafeInteger))throw Error('integer edit cell required');return board.filter(([a,b])=>Math.abs(a-x)<=2&&Math.abs(b-z)<=2);}
 });
}
