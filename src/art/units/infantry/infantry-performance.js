import {createSoldier} from './soldier-rig.js';
import {applyFaceProfileTrial} from './face-profile-trial.js';
import {preparePerformanceSoldier,createPerformanceSoldier} from './soldier-performance.js';
import {attachInfantryFactions} from './infantry-factions.js';

// Accepted F1 is baked before lossless indexing. The legacy V6.8P factory and
// page remain untouched. Initialize this entry before using the core bank.
export const createInfantryBaseline=({bootProfile='B1',wristProfile='W2'}={})=>attachInfantryFactions(applyFaceProfileTrial(createSoldier({bootProfile,wristProfile,factionSupport:true})));
let prepared=false,statistics;
export function prepareInfantryPerformance(source){
 if(prepared)return statistics;
 if(source?.userData.faction&&source.userData.faction!=='neutral')throw Error('Prepare the neutral baseline before choosing a faction');
 if(source&&(!source.userData.faceProfileTrial||source.userData.bootProfile?.id!=='B1'||source.userData.wristProfile!=='W2'))throw Error('The supplied baseline must have F1, B1 and W2 profiles');
 const stats=preparePerformanceSoldier(source??createInfantryBaseline());
 const check=createPerformanceSoldier();
 if(!check.userData.faceProfileTrial||check.userData.bootProfile?.id!=='B1'||check.userData.wristProfile!=='W2')throw Error('Legacy infantry cache already initialized: load infantry-performance.js before creating legacy performance units');
 prepared=true;statistics=stats;return stats;
}
export function createPerformanceInfantry({faction='neutral'}={}){
 prepareInfantryPerformance();
 const unit=createPerformanceSoldier();
 unit.name='Infantry_V6_12P_F1_B1_W2';unit.userData.version='6.12P';unit.userData.performance.head='F1';unit.userData.performance.boots='B1';unit.userData.performance.wrists='W2';return attachInfantryFactions(unit,faction);
}
