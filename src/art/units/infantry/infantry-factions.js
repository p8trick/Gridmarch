import * as T from 'three';

// Whole-uniform identification, matching the in-game reference. Camouflage
// patches keep their luminance differences; equipment is a darker related tone.
// Skin, gloves, boots, dark hardware and BOTH weapons remain exactly original.
export const INFANTRY_FACTIONS=Object.freeze({blue:'#5f8ea6',red:'#b8795c',green:'#849552',yellow:'#c2a55e'});
const variants=new WeakMap(),luma=c=>.2126*c.r+.7152*c.g+.0722*c.b;
const levels=[0,luma(new T.Color('#b8a87d')),luma(new T.Color('#b5a57c')),luma(new T.Color('#918967'))];
function geometryFor(base,faction){
 if(faction==='neutral')return base;
 let choices=variants.get(base);if(!choices){choices=new Map();variants.set(base,choices);}if(choices.has(faction))return choices.get(faction);
 const g=new T.BufferGeometry();for(const[name,attr]of Object.entries(base.attributes))g.setAttribute(name,attr);g.setIndex(base.index);g.groups=base.groups.map(x=>({...x}));g.setDrawRange(base.drawRange.start,base.drawRange.count);g.boundingBox=base.boundingBox?.clone()??null;g.boundingSphere=base.boundingSphere?.clone()??null;
 const mask=base.attributes.factionMask,color=base.attributes.color,c=color.clone(),target=new T.Color(INFANTRY_FACTIONS[faction]);
 for(let i=0;i<c.count;i++){const region=mask.getX(i);if(!region)continue;const value=.2126*color.getX(i)+.7152*color.getY(i)+.0722*color.getZ(i),shade=value/levels[region]*(region===3?.82:1);c.setXYZ(i,target.r*shade,target.g*shade,target.b*shade);}
 g.setAttribute('color',c);g.userData={...base.userData,factionBase:base.userData.factionBase??base.uuid,faction};choices.set(faction,g);return g;
}
export function attachInfantryFactions(unit,faction='neutral'){
 if(unit.setFaction){unit.setFaction(faction);return unit;}
 const parts=[];unit.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,mask=g.attributes.factionMask;if(mask&&mask.array.some(x=>x!==0))parts.push({mesh,base:g});});
 if(parts.length!==11)throw Error('Faction support requires all 11 uniform/equipment joint regions, got '+parts.length);
 unit.userData.factionSupport={version:'F4-body',colors:Object.keys(INFANTRY_FACTIONS),regions:['helmet','uniform_camouflage','vest_backpack_webbing'],fixed:['skin','gloves','boots','dark_hardware','rifle','launcher']};
 unit.setFaction=(next='neutral')=>{if(next!=='neutral'&&!Object.hasOwn(INFANTRY_FACTIONS,next))throw Error('Unknown infantry faction: '+next);if(unit.userData.faction===next)return unit;for(const p of parts)p.mesh.geometry=geometryFor(p.base,next);unit.userData.faction=next;unit.factionRevision=(unit.factionRevision??0)+1;return unit;};
 unit.setFaction(faction);return unit;
}
