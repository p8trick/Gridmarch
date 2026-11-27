import {createArtillery as factory} from './artillery-v2_1_1.js';
export const createArtillery=(options={})=>factory({...options,batch:true});
export {createArtillery as createTank};
