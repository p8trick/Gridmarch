// Latest Gridmarch rule: ground + landing craft; one logical occupant per 2x2 cell.
export const SHOAL_RULES=Object.freeze({terrain:'shoal',cellSize:2,capacity:1,ground:true,air:true,landingCraft:true,otherNaval:false});
export function canEnterShoal(unit,occupant=null){return !!unit&&(typeof unit.id==='string'||typeof unit.id==='number')&&(!occupant||occupant.id===unit.id)&&(unit.domain==='ground'||unit.domain==='air'||unit.domain==='naval'&&unit.role==='landingCraft');}
export function enterShoal(cell,unit){if(!canEnterShoal(unit,cell.occupant))return false;cell.occupant={...unit};return true;}
