import {attachVehicleAnimations} from './vehicle-animation.js';

// Only the heavy tank's bindings and feel parameters live here.
// shared/* and vehicle-animation.js are byte-identical to the supplied package.
export function attachHeavyTankAnimations({root,left,right,recoil,muzzle}){
  return attachVehicleAnimations({
    root,gauge:2*1.335,left,right,recoil,muzzle,
    fire:{recoilDistance:.28,recoilPeak:.075,recoveryEnd:.50,flashDuration:.12,duration:1.12,effectScale:1.18}
  });
}
