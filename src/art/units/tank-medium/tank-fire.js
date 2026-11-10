import * as THREE from 'three';

// Reusable low-poly effects, allocated once; no per-shot textures or geometry.
export function createTankFire({root,recoil,muzzle,bodyPivot=null}) {
  const effects=new THREE.Group();effects.name='shot_effects';effects.visible=false;root.add(effects);
  const material=(colour)=>new THREE.MeshBasicMaterial({color:colour,transparent:true,depthWrite:false,toneMapped:false});
  function burstGeometry(){const points=[0,0,-.04],indices=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.16:.25;points.push(Math.cos(a)*r,Math.sin(a)*r,.18);}points.push(0,0,.90);for(let i=0;i<8;i++){const a=i+1,b=(i+1)%8+1;indices.push(0,b,a,a,b,9);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;}
  const flash=new THREE.Mesh(burstGeometry(),material('#ff9a32'));flash.name='muzzle_flash';effects.add(flash);
  const core=new THREE.Mesh(flash.geometry,material('#fff2bb'));core.scale.set(.55,.55,.68);core.position.z=.025;flash.add(core);
  const smokeMat=new THREE.MeshStandardMaterial({color:'#9b998d',roughness:1,transparent:true,opacity:0,depthWrite:false,flatShading:true});
  const smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),smokeMat,5);smoke.name='muzzle_smoke';smoke.frustumCulled=false;smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);effects.add(smoke);
  const worldOrigin=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),worldQuaternion=new THREE.Quaternion();
  const inverse=new THREE.Matrix4(),world=new THREE.Matrix4(),local=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),point=new THREE.Vector3(),rootScale=new THREE.Vector3();
  let elapsed=1.2,shotScale=1,shots=0,rockEnabled=true;const localDirection=new THREE.Vector3(),rockAxis=new THREE.Vector3();const duration=1.05,baseZ=recoil.position.z;
  function rock(){if(!bodyPivot)return;const t=elapsed;
    const amount=rockEnabled&&t<.48?Math.sin(Math.PI*t/.48)*Math.exp(-5*t):0;
    rockAxis.set(-localDirection.z,0,localDirection.x).normalize();bodyPivot.quaternion.setFromAxisAngle(rockAxis,.012*amount);
  }
  function setBodyRock(value){rockEnabled=!!value;rock();}
  function sync(){
    rock();
    root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
    const recoilFraction=elapsed<.065?Math.sin(elapsed/.065*Math.PI/2):elapsed<.44?1-(1-Math.pow(1-(elapsed-.065)/.375,3)):0;
    recoil.position.z=baseZ-.23*Math.max(0,recoilFraction);
    const flashTime=elapsed/.105;flash.visible=elapsed<.105;
    flash.material.opacity=Math.max(0,1-flashTime);core.material.opacity=flash.material.opacity;
    world.compose(worldOrigin,worldQuaternion,scale.setScalar(shotScale*(.78+.30*Math.sin(Math.min(1,flashTime)*Math.PI))));local.multiplyMatrices(inverse,world);local.decompose(flash.position,flash.quaternion,flash.scale);
    smoke.visible=elapsed>.035&&elapsed<duration;
    smokeMat.opacity=.46*Math.pow(Math.max(0,1-elapsed/duration),1.3)*Math.min(1,elapsed/.07);
    for(let i=0;i<5;i++){
      const spread=Math.max(0,elapsed-.035),a=i*2.39996;
      point.copy(worldOrigin).addScaledVector(direction,shotScale*(.14+i*.065+spread*(.30+i*.065))).addScaledVector(up,shotScale*spread*(.20+i*.025));
      point.x+=Math.cos(a)*shotScale*spread*.20;point.z+=Math.sin(a)*shotScale*spread*.20;
      q.setFromAxisAngle(up,a+spread*.22);const r=shotScale*(.055+spread*(.15+i*.018));world.compose(point,q,scale.set(r,r*.86,r));local.multiplyMatrices(inverse,world);smoke.setMatrixAt(i,local);
    }
    smoke.instanceMatrix.needsUpdate=true;effects.visible=elapsed<duration;
  }
  function fire(){if(elapsed<duration)return false;root.updateWorldMatrix(true,true);muzzle.getWorldPosition(worldOrigin);muzzle.getWorldQuaternion(worldQuaternion);direction.set(0,0,1).applyQuaternion(worldQuaternion);root.getWorldScale(rootScale);shotScale=Math.abs(rootScale.x);localDirection.copy(direction).transformDirection(new THREE.Matrix4().copy(root.matrixWorld).invert());elapsed=0;shots++;sync();return true;}
  function update(dt){if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid firing animation time');if(elapsed>=duration)return false;elapsed=Math.min(duration,elapsed+dt);if(elapsed>=duration)reset();else sync();return true;}
  function reset(){elapsed=duration;recoil.position.z=baseZ;effects.visible=false;if(bodyPivot)bodyPivot.quaternion.identity();flash.position.set(0,0,0);flash.scale.setScalar(0);smokeMat.opacity=0;local.makeScale(0,0,0);for(let i=0;i<5;i++)smoke.setMatrixAt(i,local);smoke.instanceMatrix.needsUpdate=true;}
  function status(){return {active:elapsed<duration,elapsed,duration,shots,origin:worldOrigin.toArray(),direction:direction.toArray()};}
  reset();return {effects,fire,update,reset,status,setBodyRock};
}
