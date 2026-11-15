import * as O from './terrain-buildings.js';
import * as R from './terrain-transport.js';
import {enableBuildingPerformance,syncBuildingPerformance} from './building-performance.js';
export {syncBuildingPerformance,getBuildingRenderStats,getBuildingHitSource,disposeBuildingPerformance,clearUnusedBuildingCache,detachBuildingComponent} from './building-performance.js';
export const createBldHq=()=>enableBuildingPerformance(O.createBldHq());
export const createBldCitySmall=()=>enableBuildingPerformance(O.createBldCitySmall());
export const createBldCityLarge=()=>enableBuildingPerformance(O.createBldCityLarge());
export const createBldFactory=()=>enableBuildingPerformance(O.createBldFactory());
export const createBuildingDisplay=kind=>enableBuildingPerformance(O.createBuildingDisplay(kind));
export const createBuildingAccessory=(kind,id)=>enableBuildingPerformance(O.createBuildingAccessory(kind,id));
export const createAirport=()=>enableBuildingPerformance(R.createAirport());
export const createDockyard=()=>enableBuildingPerformance(R.createDockyard());
export function setBuildingAccent(root,material){O.setBuildingAccent(root,material);return syncBuildingPerformance(root);}
export function setBuildingDisplayState(root,options){const anchor=O.setBuildingDisplayState(root,options);syncBuildingPerformance(root);return anchor;}
export function setBuildingAccessory(root,id,options){const part=O.setBuildingAccessory(root,id,options);syncBuildingPerformance(root);return part;}
export function resetBuildingAccessories(root){O.resetBuildingAccessories(root);return root;}
export const getBuildingAccessories=O.getBuildingAccessories;
export function setAirportRunway(root,options){const p=R.setAirportRunway(root,options);syncBuildingPerformance(root);return p;}
export function setDockyardLayout(root,options){const p=R.setDockyardLayout(root,options);syncBuildingPerformance(root);return p;}
export function setDockyardState(root,options){const p=R.setDockyardState(root,options);syncBuildingPerformance(root);return p;}
export const BUILDINGS=Object.fromEntries(Object.entries(O.BUILDINGS).map(([k,d])=>[k,{...d,create:()=>enableBuildingPerformance(d.create())}]));
export const TRANSPORT_BUILDINGS={bld_airport:{...R.TRANSPORT_BUILDINGS.bld_airport,create:createAirport},bld_dockyard:{...R.TRANSPORT_BUILDINGS.bld_dockyard,create:createDockyard}};
