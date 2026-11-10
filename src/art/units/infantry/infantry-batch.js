import {createAntiTankBatch} from './anti-tank-batch.js';

// Faction variants split only the three coloured parts, not all 21 parts.
export function createInfantryBatch({capacity=24}={}){
 const batch=createAntiTankBatch({capacity,comparison:true}),add=batch.addUnit,sync=batch.sync;
 batch.addUnit=(unit,fire=null)=>{
  if(fire){fire.unit=unit;fire.performanceEffectMeshes=[fire.flash];}
  return add(unit,fire);
 };
 batch.sync=()=>{const r=sync();return{...r,flashDraws:r.effectDraws};};
 Object.defineProperties(batch,{
  parts:{get:()=>batch.buckets.filter(b=>b.role==='body').map(b=>b.mesh)},
  flashInstances:{get:()=>batch.buckets.find(b=>b.role==='effect')?.mesh??null},
 });
 return batch;
}
