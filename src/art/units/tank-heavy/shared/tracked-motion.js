import * as THREE from 'three';

// Explicit bindings: no tank names, wheel counts, geometry creation or merging.
// Axis convention: +Y up, +Z forward, named left track at +X.
export function createTrackedMotion({root,gauge,left,right}) {
  if(!(Number.isFinite(gauge)&&gauge>0))throw new Error('gauge must be positive');
  const axis=new THREE.Vector3(1,0,0),spin=new THREE.Quaternion(),q=new THREE.Quaternion();
  const pos=new THREE.Vector3(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4();
  const state={leftDistance:0,rightDistance:0},sides=[];
  function records(object){
    const result=[];object.updateMatrix();if(object.isInstancedMesh){object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.frustumCulled=false;}
    for(let i=0;i<(object.isInstancedMesh?object.count:1);i++){
      if(object.isInstancedMesh)object.getMatrixAt(i,matrix);else matrix.copy(object.matrix);
      const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),size=new THREE.Vector3();matrix.decompose(position,rotation,size);
      result.push({position,rotation,scale:size});
    }return result;
  }
  function write(object,i){
    if(object.isInstancedMesh){matrix.compose(pos,q,scale);object.setMatrixAt(i,matrix);}
    else{object.position.copy(pos);object.quaternion.copy(q);object.scale.copy(scale);}
  }
  for(const input of [left,right]){
    if(!input?.path||!(input.path.length>0)||typeof input.path.pointAt!=='function')throw new Error('Each side needs a path');
    const belts=(input.belts||[]).map(b=>({...b,records:records(b.object)}));
    const wheels=(input.wheels||[]).map(w=>{
      const rows=records(w.object);if(w.instances&&w.instances.length!==rows.length)throw new Error('Wheel instance bindings must match instance count');return {...w,records:rows.map((r,i)=>{
        const setting=w.instances?.[i]||w,radius=setting.radius??w.radius;
        if(!(Number.isFinite(radius)&&radius>0))throw new Error('Wheel radius must be positive');
        return {...r,radius,center:setting.center?new THREE.Vector3(...setting.center):r.position.clone(),axis:new THREE.Vector3(...(setting.axis||w.axis||[1,0,0])).normalize()};
      })};
    });sides.push({path:input.path,belts,wheels});
  }
  function updateSide(side,distance){
    for(const b of side.belts){
      b.records.forEach((r,i)=>{
        const start=b.phases?.[i]??side.path.length*(i+(b.phaseOffset??.5))/b.records.length;
        const p=side.path.pointAt(THREE.MathUtils.euclideanModulo(start+distance,side.path.length)),offset=b.normalOffset??0;
        pos.set(b.x??r.position.x,p.y+p.dz*offset+(b.yOffset??0),p.z-p.dy*offset+(b.zOffset??0));
        q.setFromAxisAngle(axis,-Math.atan2(p.dy,p.dz));scale.copy(r.scale);write(b.object,i);
      });if(b.object.isInstancedMesh)b.object.instanceMatrix.needsUpdate=true;
    }
    for(const w of side.wheels){
      w.records.forEach((r,i)=>{
        spin.setFromAxisAngle(r.axis,THREE.MathUtils.euclideanModulo(distance/r.radius,Math.PI*2));
        pos.copy(r.position).sub(r.center).applyQuaternion(spin).add(r.center);q.copy(spin).multiply(r.rotation);scale.copy(r.scale);write(w.object,i);
      });if(w.object.isInstancedMesh)w.object.instanceMatrix.needsUpdate=true;
    }
  }
  function advance(l,r,{moveRoot=false}={}){
    if(!Number.isFinite(l)||!Number.isFinite(r))throw new Error('Track distances must be finite');
    if(moveRoot&&(!(root.scale.x>0)||Math.abs(root.scale.x-root.scale.y)>1e-8||Math.abs(root.scale.x-root.scale.z)>1e-8))throw new Error('Root motion requires positive uniform scale');
    if(l===0&&r===0)return;
    state.leftDistance+=l;state.rightDistance+=r;updateSide(sides[0],state.leftDistance);updateSide(sides[1],state.rightDistance);
    if(moveRoot){const d=(l+r)/2*root.scale.x,a=(r-l)/gauge,yaw=root.rotation.y;
      if(Math.abs(a)<1e-9){root.position.x+=Math.sin(yaw)*d;root.position.z+=Math.cos(yaw)*d;}
      else{root.position.x+=d/a*(Math.cos(yaw)-Math.cos(yaw+a));root.position.z+=d/a*(Math.sin(yaw+a)-Math.sin(yaw));}
      root.rotation.y=THREE.MathUtils.euclideanModulo(yaw+a+Math.PI,Math.PI*2)-Math.PI;
    }
  }
  function reset(){state.leftDistance=state.rightDistance=0;updateSide(sides[0],0);updateSide(sides[1],0);}
  reset();return {advance,reset,state};
}
