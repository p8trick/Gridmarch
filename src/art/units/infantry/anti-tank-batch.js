import * as T from 'three';

// Geometry/material buckets can contain several alternative attachment points:
// the held and slung rifle share a bucket, but only visible nodes are emitted.
export function createAntiTankBatch({capacity=24,comparison=false}={}){
 if(!Number.isInteger(capacity)||capacity<1)throw Error('Invalid capacity');
 const root=new T.Group(),instanced=new T.Group(),ordinary=new T.Group(),records=[],buckets=[],lookup=new Map(),mirrors=new Set();root.name='AntiTank_Performance_Batch';root.add(instanced);
 let enabled=true,disposed=false,bodySignature=null,effectSignature=null;
 const shown=(o,unit)=>{for(let p=o;p;p=p.parent){if(!p.visible)return false;if(p===unit)return true;}return false;};
 function bucketFor(mesh,slots,role){const key=mesh.geometry.uuid+'|'+mesh.material.uuid;let b=lookup.get(key);if(b)return b;const m=new T.InstancedMesh(mesh.geometry,mesh.material,capacity*slots);m.name=mesh.name+'_instances';m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.castShadow=mesh.castShadow;m.receiveShadow=mesh.receiveShadow;m.userData.softwareUnlit=!!mesh.userData.softwareUnlit;m.count=0;m.visible=false;instanced.add(m);b={mesh:m,role,count:0,slots};lookup.set(key,b);buckets.push(b);return b;}
 const family=g=>g.userData.factionBase??g.uuid;
 function checkSignature(meshes,signature,label){if(signature&&(meshes.length!==signature.length||meshes.some((m,i)=>family(m.geometry)!==signature[i].family||m.material!==signature[i].material)))throw Error('Batch '+label+' resources must be shared');return signature||meshes.map(m=>({family:family(m.geometry),material:m.material}));}
 function addUnit(unit,fire=null){
  if(disposed)throw Error('Batch disposed');if(records.length>=capacity)throw Error('Capacity exceeded');if(unit.parent)throw Error('Logical units must be detached and batch-local');if(records.some(r=>r.unit===unit))throw Error('Unit already added');if(!unit.performanceMeshes)throw Error('A performance anti-tank unit is required');if(fire&&(fire.unit!==unit||!fire.performanceEffectMeshes))throw Error('Use this unit\'s performance fire controller');
  bodySignature=checkSignature(unit.performanceMeshes,bodySignature,'body');if(fire)effectSignature=checkSignature(fire.performanceEffectMeshes,effectSignature,'effect');
  const all=[...unit.performanceMeshes,...(fire?.performanceEffectMeshes||[])],counts=new Map();for(const m of all){const k=m.geometry.uuid+'|'+m.material.uuid;counts.set(k,(counts.get(k)||0)+1);}
  const entries=all.map((mesh,i)=>{const b=bucketFor(mesh,counts.get(mesh.geometry.uuid+'|'+mesh.material.uuid),i<unit.performanceMeshes.length?'body':'effect');let ref=null;if(comparison){ref=new T.Mesh(mesh.geometry,mesh.material);ref.name=mesh.name+'_ordinary';ref.castShadow=mesh.castShadow;ref.receiveShadow=mesh.receiveShadow;ref.userData.softwareUnlit=!!mesh.userData.softwareUnlit;ref.matrixAutoUpdate=false;ordinary.add(ref);mirrors.add(ref);}return{mesh,b,ref};});
  records.push({unit,fire,entries});return records.length-1;
 }
 function sync(){
  if(disposed)throw Error('Batch disposed');buckets.forEach(b=>{b.previousCount=b.count;b.count=0;b.dirty=false;b.mesh.userData.unitSlots=[];});let units=0,bodyInstances=0,effectInstances=0;
  records.forEach((r,index)=>{
   if(r.unit.visible){units++;r.unit.updateMatrixWorld(true);}
   for(const e of r.entries){const visible=r.unit.visible&&shown(e.mesh,r.unit);if(e.ref)e.ref.visible=visible;if(!visible)continue;
    if(e.mesh.geometry!==e.b.mesh.geometry||e.mesh.material!==e.b.mesh.material)e.b=bucketFor(e.mesh,e.b.slots,e.b.role);
    const b=e.b,slot=b.count++;if(slot>=b.mesh.instanceMatrix.count)throw Error('Instance bucket overflow');const values=e.mesh.matrixWorld.elements,buffer=b.mesh.instanceMatrix.array;
    if(values.some((v,k)=>Math.fround(v)!==buffer[slot*16+k])){b.mesh.setMatrixAt(slot,e.mesh.matrixWorld);b.dirty=true;}if(!b.mesh.userData.unitSlots)b.mesh.userData.unitSlots=[];b.mesh.userData.unitSlots[slot]=index;
    if(e.ref){e.ref.geometry=e.mesh.geometry;e.ref.material=e.mesh.material;e.ref.matrix.copy(e.mesh.matrixWorld);e.ref.matrixWorldNeedsUpdate=true;e.ref.userData.unitSlot=index;}
    if(b.role==='body')bodyInstances++;else effectInstances++;
   }
  });
  for(const b of buckets){b.mesh.count=b.count;b.mesh.visible=b.count>0;if(b.count&&(b.dirty||b.previousCount!==b.count)){b.mesh.instanceMatrix.needsUpdate=true;b.mesh.computeBoundingSphere();}}
  const bodyDraws=enabled?buckets.filter(b=>b.role==='body'&&b.count).length:bodyInstances,effectDraws=enabled?buckets.filter(b=>b.role==='effect'&&b.count).length:effectInstances;
  return{units,bodyDraws,effectDraws,mainPassDraws:bodyDraws+effectDraws,bodyInstances,effectInstances,mode:enabled?'instanced':'ordinary'};
 }
 const api={root,records,buckets,addUnit,sync,
  setInstanced(value){if(!value&&!comparison)throw Error('Create with comparison:true for ordinary mirrors');enabled=!!value;instanced.removeFromParent();ordinary.removeFromParent();root.add(enabled?instanced:ordinary);},
  get instanced(){return enabled;},
  removeUnit(unit){const i=records.findIndex(r=>r.unit===unit);if(i<0)return false;const[r]=records.splice(i,1);r.entries.forEach(e=>{e.ref?.removeFromParent();if(e.ref)mirrors.delete(e.ref);});sync();return true;},
  unitForHit(hit){const o=hit?.object,b=buckets.find(b=>b.mesh===o);if(b){if(!Number.isInteger(hit.instanceId)||hit.instanceId<0||hit.instanceId>=o.count)return null;return records[o.userData.unitSlots[hit.instanceId]]?.unit??null;}if(mirrors.has(o)&&o.visible)return records[o.userData.unitSlot]?.unit??null;return null;},
  dispose(){if(disposed)return;buckets.forEach(b=>b.mesh.dispose());root.clear();ordinary.clear();instanced.clear();records.length=0;buckets.length=0;lookup.clear();mirrors.clear();disposed=true;}
 };return api;
}
