export {planCoast47,planCoast47 as planCoastTopology} from './coast47-plan.js';
export * from './coast47-mask.js';
import {createCoast47 as create} from './coast47-component.js';
export const createCoast47=(plan,options={})=>create(plan,{...options,edition:'performance'});
export const createCoastTopology=createCoast47;
