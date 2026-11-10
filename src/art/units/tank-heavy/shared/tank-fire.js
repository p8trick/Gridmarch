import * as THREE from 'three';

// Reusable low-poly effects, allocated once; no per-shot textures or geometry.
export function createTankFire({root,recoil,muzzle,recoilDistance=.23,recoilPeak=.065,recoveryEnd=.44,flashDuration=.105,duration=1.05,effectScale=1}) {
  if(!(recoilDistance>=0&&recoilPeak>0&&recoveryEnd>recoilPeak&&duration>=recoveryEnd&&flashDuration>0&&effectScale>0))throw new Error('Invalid firing parameters');
  const effects=new THREE.Group();effects.name='shot_effects';effects.visible=false;root.add(effects);
  const material=(colour)=>new THREE.MeshBasicMaterial({color:colour,transparent:true,depthWrite:false,toneMapped:false});
  function burstGeometry(){const points=[0,0,-.04],indices=[];for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.16:.25;points.push(Math.cos(a)*r,Math.sin(a)*r,.18);}points.push(0,0,.90);for(let i=0;i<8;i++){const a=i+1,b=(i+1)%8+1;indices.push(0,b,a,a,b,9);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;}
  const flash=new THREE.Mesh(burstGeometry(),material('#ff9a32'));flash.name='muzzle_flash';effects.add(flash);
  const core=new THREE.Mesh(flash.geometry,material('#fff2bb'));core.scale.set(.55,.55,.68);core.position.z=.025;flash.add(core);
  const smokeMat=new THREE.MeshStandardMaterial({color:'#9b998d',roughness:1,transparent:true,opacity:0,depthWrite:false,flatShading:true});
  const smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),smokeMat,5);smoke.name='muzzle_smoke';smoke.frustumCulled=false;smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);effects.add(smoke);
  const worldOrigin=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),worldQuaternion=new THREE.Quaternion();
  const inverse=new THREE.Matrix4(),world=new THREE.Matrix4(),local=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),point=new THREE.Vector3(),rootScale=new THREE.Vector3();
  let elapsed=duration,shotScale=1,shots=0;const baseZ=recoil.position.z;
  function sync(){
    root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();
    const recoilFraction=elapsed<recoilPeak?Math.sin(elapsed/recoilPeak*Math.PI/2):elapsed<recoveryEnd?Math.pow(1-(elapsed-recoilPeak)/(recoveryEnd-recoilPeak),3):0;
    recoil.position.z=baseZ-recoilDistance*Math.max(0,recoilFraction);
    const flashTime=elapsed/flashDuration;flash.visible=elapsed<flashDuration;
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
  function fire(){if(elapsed<duration)return false;root.updateWorldMatrix(true,true);muzzle.getWorldPosition(worldOrigin);muzzle.getWorldQuaternion(worldQuaternion);direction.set(0,0,1).applyQuaternion(worldQuaternion);root.getWorldScale(rootScale);shotScale=Math.abs(rootScale.x)*effectScale;elapsed=0;shots++;sync();return true;}
  function update(dt){if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid firing animation time');if(elapsed>=duration)return false;elapsed=Math.min(duration,elapsed+dt);if(elapsed>=duration)reset();else sync();return true;}
  function reset(){elapsed=duration;recoil.position.z=baseZ;effects.visible=false;flash.position.set(0,0,0);flash.scale.setScalar(0);smokeMat.opacity=0;local.makeScale(0,0,0);for(let i=0;i<5;i++)smoke.setMatrixAt(i,local);smoke.instanceMatrix.needsUpdate=true;}
  function status(){return {active:elapsed<duration,elapsed,duration,shots,origin:worldOrigin.toArray(),direction:direction.toArray()};}
  function dispose(){reset();effects.removeFromParent();const geometries=new Set(),materials=new Set();effects.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  reset();return {effects,fire,update,reset,status,dispose};
}
