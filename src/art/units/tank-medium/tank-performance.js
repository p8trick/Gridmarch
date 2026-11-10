import {createTank as createStandardTank} from './tank.js';
export function createTank(options={}){return createStandardTank({...options,performance:true});}
