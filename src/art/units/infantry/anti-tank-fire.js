import * as T from 'three';
import {createInfantryFire} from './infantry-fire.js';

// Visual animation only: one flash mesh per tube end and one stylized rocket.
// No damage, collision, ballistics or automatic ammo mutation in the model layer.
export function createAntiTankFire(unit){
 const rifle=createInfantryFire(unit),front=new T.Group(),rear=new T.Group();
 front.name='launcher_muzzle_fx';rear.name='launcher_rear_fx';
 front.position.fromArray(unit.userData.launcherLandmarks.muzzle);rear.position.fromArray(unit.userData.launcherLandmarks.rear);
 front.rotation.y=Math.PI/2;rear.rotation.y=-Math.PI/2;unit.launcher.add(front,rear);
 // Reuse the accepted infantry star-flash geometry/material, not two solid
 // cones. Its per-face colour rings also survive the CPU preview renderer.
 function flashMesh(){const m=new T.Mesh(rifle.flash.geometry,rifle.flash.material);m.userData.softwareUnlit=true;m.visible=false;return m;}
 const flash=flashMesh(),backblast=flashMesh();front.add(flash);rear.add(backblast);
 const rocket=new T.Group();rocket.name='visual_rocket';unit.add(rocket);rocket.visible=false;
 const mat=new T.MeshStandardMaterial({color:0x596d36,flatShading:true,roughness:.8});
 const body=new T.Mesh(new T.CylinderGeometry(.062,.062,.25,8),mat);body.rotation.x=Math.PI/2;rocket.add(body);
 const nose=new T.Mesh(new T.ConeGeometry(.085,.19,8),mat);nose.rotation.x=Math.PI/2;nose.position.z=.20;rocket.add(nose);
 const fins=new T.Mesh(new T.BoxGeometry(.19,.018,.13),mat);fins.position.z=-.10;rocket.add(fins);const fins2=fins.clone();fins2.rotation.z=Math.PI/2;rocket.add(fins2);
 let mode='launcher',active=false,hasClip=false,time=0,pose='aim',scale=1,disposed=false;
 const duration=.65;
 function clear(){flash.visible=backblast.visible=rocket.visible=false;}
 function render(seconds){
  time=T.MathUtils.clamp(Number.isFinite(seconds)?seconds:0,0,duration);const recoil=time<.035?Math.sin(time/.035*Math.PI/2):Math.max(0,1-(time-.035)/.20);
  unit.sampleFirePose(pose,recoil);
  flash.visible=time<.075;backblast.visible=time<.10;
  const s=scale*(1-.38*Math.min(1,time/.10));flash.scale.set(s*1.6,s*1.6,1.8);backblast.scale.set(s*2.0,s*2.0,2.0);
  rocket.visible=time>.075&&time<.46;
  if(rocket.visible){
   unit.updateMatrixWorld(true);const point=unit.worldToLocal(unit.launcher.localToWorld(new T.Vector3(1.35+9*(time-.02),0,0)));
   rocket.position.copy(point);rocket.quaternion.copy(unit.getWorldQuaternion(new T.Quaternion()).invert().multiply(unit.launcher.getWorldQuaternion(new T.Quaternion()))).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2));
  }
  return {time,recoil,flashVisible:flash.visible};
 }
 const api={rifle,flash,backblast,rocket,
  get mode(){return mode;},get active(){return mode==='rifle'?rifle.active:active;},get hasClip(){return mode==='rifle'?rifle.hasClip:hasClip;},get time(){return mode==='rifle'?rifle.time:time;},get duration(){return mode==='rifle'?rifle.duration:duration;},
  start(options={}){if(disposed)throw Error('Disposed fire controller');api.cancel({restore:false});mode=unit.userData.weaponMode;pose=options.pose||'aim';if(!['aim','kneel'].includes(pose))throw Error('Aim or kneel required');if(mode==='rifle')return rifle.start({pose,shots:options.shots||3});active=hasClip=true;return render(0);},
  update(dt){if(mode==='rifle')return rifle.update(dt);if(!active)return;const result=render(time+Math.max(0,Number.isFinite(dt)?dt:0));if(time>=duration)active=false;return result;},
  seek(t){if(mode==='rifle')return rifle.seek(t);active=false;hasClip=true;return render(t);},
  pause(){active=false;rifle.pause();},resume(){if(mode==='rifle')return rifle.resume();if(hasClip){if(time>=duration)time=0;active=true;render(time);}},
  cancel({restore=true}={}){rifle.cancel({restore:restore&&mode==='rifle'});if(restore&&hasClip&&mode==='launcher')unit.sampleFirePose(pose,0);active=hasClip=false;time=0;clear();},
  setReadabilityScale(n){scale=T.MathUtils.clamp(n,.75,1.5);rifle.setReadabilityScale(scale);},
  dispose(){if(disposed)return;api.cancel();rifle.dispose();front.removeFromParent();rear.removeFromParent();rocket.removeFromParent();disposed=true;}
 };return api;
}
