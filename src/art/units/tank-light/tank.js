import {createTank as createBase} from './model-core.js';
export function createTank(options={}){return createBase({...options,optimized:true});}
