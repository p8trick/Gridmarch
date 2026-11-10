// C1: the complete logical coast cell is ground-only and cannot receive a landing.
export const CLIFF_COAST_RULES=Object.freeze({terrain:'cliff_coast',cellSize:2,capacity:1,ground:true,air:false,naval:false,landingAllowed:false});
export function canEnterCliffCoast(unit,occupant=null,{fromSea=false}={}){
 return !!unit&&(typeof unit.id==='string'||typeof unit.id==='number')&&unit.domain==='ground'&&!fromSea&&(!occupant||occupant.id===unit.id);
}
export function enterCliffCoast(cell,unit,options){
 if(!canEnterCliffCoast(unit,cell.occupant,options))return false;
 cell.occupant={...unit};return true;
}
