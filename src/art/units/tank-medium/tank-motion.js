import * as THREE from 'three';

// Signed distances are model-local units; positive means forwards.
// At the bottom the belt travels backwards relative to the hull, cancelling travel.
export function createTankMotion({root,hull,belt,gauge,colourBatcher}) {
  const groups=[],sides=new Map(),state={leftDistance:0,rightDistance:0};
  const axis=new THREE.Vector3(1,0,0),spin=new THREE.Quaternion(),matrix=new THREE.Matrix4();
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),unit=new THREE.Vector3(1,1,1);
  const mod=(v,n)=>((v%n)+n)%n;
  for(const track of hull.children.filter(o=>o.name==='left_track'||o.name==='right_track')) {
    const dynamic=new THREE.Group();dynamic.name=track.name+'_moving';track.add(dynamic);groups.push(dynamic);
    const batches=[];
    if(colourBatcher){
      const wheels=new Map();
      track.children.filter(o=>o.userData.rolling).forEach(o=>{const key=o.userData.rolling.center.join(',');if(!wheels.has(key))wheels.set(key,[]);wheels.get(key).push(o);});
      for(const parts of wheels.values()){
        const descriptor=parts[0].userData.rolling,centre=new THREE.Vector3(...descriptor.center),pivot=new THREE.Group();pivot.position.copy(centre);track.add(pivot);track.updateWorldMatrix(true,true);parts.forEach(o=>pivot.attach(o));
        const merged=colourBatcher.merge(pivot,parts,'wheel');
        for(const mesh of merged){track.attach(mesh);mesh.userData.rolling={...descriptor,kind:descriptor.kind.split('_')[0]+'_combined'};}
        pivot.removeFromParent();
      }
    }
    function instances(sources,kind) {
      const mesh=new THREE.InstancedMesh(colourBatcher?sources[0].geometry:sources[0].geometry.clone(),sources[0].material,sources.length);
      mesh.name=track.name+'_'+kind;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
      const records=sources.map(o=>({position:o.position.clone(),rotation:o.quaternion.clone(),rolling:o.userData.rolling,center:o.userData.rolling?new THREE.Vector3(...o.userData.rolling.center):null}));
      sources.forEach(o=>{o.removeFromParent();if(o.geometry!==mesh.geometry)o.geometry.dispose();});dynamic.add(mesh);
      batches.push({mesh,kind,records});
    }
    instances(track.children.filter(o=>o.name==='track_pad'),'pads');
    instances(track.children.filter(o=>o.name==='track_link'),'links');
    const rolling=new Map();
    track.children.filter(o=>o.userData.rolling).forEach(o=>{const k=o.userData.rolling.kind;if(!rolling.has(k))rolling.set(k,[]);rolling.get(k).push(o);});
    for(const [kind,parts] of rolling)instances(parts,kind);
    sides.set(track.name==='left_track'?'left':'right',{batches});
  }
  function updateSide(side,distance) {
    for(const {mesh,kind,records} of sides.get(side).batches) {
      records.forEach((record,i)=>{
        if(kind==='pads'||kind==='links') {
          const q=belt.pointAt(belt.length*(i+.5)/records.length+mod(distance,belt.length));
          const offset=kind==='pads'?.058:0;
          position.set(record.position.x,q.y+q.dz*offset,q.z-q.dy*offset);
          rotation.setFromAxisAngle(axis,-Math.atan2(q.dy,q.dz));
        } else {
          const {radius}=record.rolling;
          spin.setFromAxisAngle(axis,mod(distance/radius,Math.PI*2));
          position.copy(record.position).sub(record.center).applyQuaternion(spin).add(record.center);
          rotation.copy(spin).multiply(record.rotation);
        }
        matrix.compose(position,rotation,unit);mesh.setMatrixAt(i,matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  function advance(left,right,{moveRoot=false}={}) {
    if(!Number.isFinite(left)||!Number.isFinite(right))throw new Error('Track distances must be finite');
    if(moveRoot&&(!(root.scale.x>0)||Math.abs(root.scale.x-root.scale.y)>1e-8||Math.abs(root.scale.x-root.scale.z)>1e-8))throw new Error('Root motion requires positive uniform scale');
    if(left===0&&right===0)return;
    state.leftDistance+=left;state.rightDistance+=right;
    updateSide('left',state.leftDistance);updateSide('right',state.rightDistance);
    if(moveRoot) {
      const d=(left+right)/2*root.scale.x,angle=(right-left)/gauge,yaw=root.rotation.y;
      if(Math.abs(angle)<1e-9){root.position.x+=Math.sin(yaw)*d;root.position.z+=Math.cos(yaw)*d;}
      else{root.position.x+=d/angle*(Math.cos(yaw)-Math.cos(yaw+angle));root.position.z+=d/angle*(Math.sin(yaw+angle)-Math.sin(yaw));}
      root.rotation.y=THREE.MathUtils.euclideanModulo(yaw+angle+Math.PI,Math.PI*2)-Math.PI;
    }
  }
  function reset(){state.leftDistance=state.rightDistance=0;updateSide('left',0);updateSide('right',0);}
  reset();return {groups,advance,reset,state};
}
