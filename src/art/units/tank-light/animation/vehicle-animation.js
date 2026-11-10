import {createTrackedMotion} from './shared/tracked-motion.js';
import {createTankFire} from './shared/tank-fire.js';

// Call once after creating the movable parts, before final display.
export function attachVehicleAnimations({root,gauge,left,right,recoil,muzzle,fire={}}){
  const movement=createTrackedMotion({root,gauge,left,right});
  const shooting=createTankFire({root,recoil,muzzle,...fire});
  root.advanceMotion=movement.advance;root.resetMotion=movement.reset;root.motionState=movement.state;
  root.fire=shooting.fire;root.updateFire=shooting.update;root.resetFire=shooting.reset;root.fireState=shooting.status;
  root.disposeAnimation=shooting.dispose;
  return root;
}
