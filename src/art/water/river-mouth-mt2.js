/**
 * Gridmarch M2 river-mouth adapter. MT2 source files are consumed as-is.
 * The river tile uses a DIFFERENT water/land query from MT2's topology landCells:
 *   topology: mouth and river approaches are occupied land-like placeholders;
 *   river rendering/gameplay: those very tiles are waterways.
 * A river mouth can be placed only between two MT2 straight shoreline cells.
 */
import * as T from 'three';
import {createRiverMouth,makeRiverMouthSpec,mouthStats,disposeMouthGroup} from './river-mouth.js';
import {createCoast47} from './coast47-component.js';
import {compactCoastMeshes} from './coast-performance.js';

const key=c=>c.join(','),eps=2e-6;
const turn=([x,z],r)=>{for(let i=0;i<r;i++)[x,z]=[-z,x];return [x,z];};
const cellAt=(c,r,u,v)=>{const [dx,dz]=turn([u,v],r);return [c[0]+dx,c[1]+dz];};

/** Validate the complete map's MT2 coast plan rather than guessing a profile. */
export function validateRiverMouthMT2({plan,cell=[0,0],rotation=0,seed=plan?.seed}={}){
 if(plan?.version!=='MT2'||typeof plan.recordAt!=='function'||typeof plan.profileForCell!=='function'||typeof plan.isLand!=='function')throw Error('M2: complete MT2 planCoast47 result required');
 if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isSafeInteger)||!Number.isSafeInteger(rotation))throw Error('M2: integer mouth cell and rotation required');
 if(seed!==plan.seed)throw Error('M2: river seed and MT2 seed must be identical');
 rotation=((rotation%4)+4)%4;
 const board=new Set(plan.cells.map(key));
 const expected=[[0,0,true],[0,-1,true],[-1,0,true],[1,0,true],[-1,-1,true],[1,-1,true],[0,1,false],[-1,1,false],[1,1,false]];
 for(const [u,v,occupied] of expected){const c=cellAt(cell,rotation,u,v);if(!board.has(key(c)))throw Error(`M2: MT2 plan missing required neighboring cell ${key(c)}`);
  if(plan.isLand(...c)!==occupied)throw Error(`M2: MT2 topology landCells must mark river and mouth as occupied placeholders, sea as water; check ${key(c)}`);}
 const left=cellAt(cell,rotation,-1,0),right=cellAt(cell,rotation,1,0);
 const records=[left,right].map(c=>plan.recordAt(...c));
 for(let i=0;i<2;i++)if(records[i].kind!=='straight'||records[i].shape?.rotation!==rotation||!['cliff','shoal'].includes(records[i].terrain))throw Error(`M2: unsupported shoreline at ${key(i?right:left)}; only straight MT2 shores with the mouth facing open sea are supported`);
 // The generic MT2 profile can vary in non-legacy topology cases; don't silently
 // claim compatibility unless both adjacent edges are the required straight profile.
 return {rotation,cell:[...cell],left,right,types:records.map(r=>r.terrain)};
}

// Clipping in world coordinates preserves source face winding, vertex colors,
// normals and all unmodified side-port geometry, including the vertical cliffs.
function clipTriangle(tri,field,sign){let out=[];for(let i=0;i<tri.length;i++){
 const a=tri[i],b=tri[(i+1)%tri.length],u=sign*field(a),v=sign*field(b);
 if(u>=-1e-9)out.push(a);
 if((u>1e-9&&v< -1e-9)||(u< -1e-9&&v>1e-9)){
  const t=u/(u-v);out.push(a.map((q,j)=>q+(b[j]-q)*t));
 }
 }return out;
}
function slicedMeshes(source,field,sign){const meshes=[];
 source.traverse(m=>{if(!m.isMesh)return;
  const g=m.geometry,p=g.attributes.position,c=g.attributes.color,n=g.attributes.normal,count=g.index?.count||p.count;
  const positions=[],colors=[],normals=[];
  for(let i=0;i<count;i+=3){const tri=[0,1,2].map(k=>{const j=g.index?g.index.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j),c.getX(j),c.getY(j),c.getZ(j),n.getX(j),n.getY(j),n.getZ(j)];}),poly=clipTriangle(tri,field,sign);
   for(let k=1;k<poly.length-1;k++){const vertices=[poly[0],poly[k],poly[k+1]],a=vertices[0],b=vertices[1],d=vertices[2];
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[d[0]-a[0],d[1]-a[1],d[2]-a[2]],area=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]);
    if(area<1e-12)continue;
    for(const v of vertices){positions.push(...v.slice(0,3));colors.push(...v.slice(3,6));normals.push(...v.slice(6,9));}
   }
  }
  if(!positions.length)return;
  const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(positions,3));out.setAttribute('color',new T.Float32BufferAttribute(colors,3));out.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  out.computeBoundingSphere();const mesh=new T.Mesh(out,m.material);mesh.name=m.name;mesh.castShadow=m.castShadow;mesh.receiveShadow=m.receiveShadow;mesh.renderOrder=m.renderOrder;meshes.push(mesh);
 });return meshes;
}
function joinHalves(left,right,spec,edition){const field=p=>spec.local(p[0],p[2])[0],raw=[...slicedMeshes(left,field,-1),...slicedMeshes(right,field,1)];
 const group=new T.Group();group.add(...raw);const originalStats=mouthStats(group),wetArea=waterArea(group);
 if(edition==='performance'){const packed=compactCoastMeshes(raw);group.clear();group.add(...packed);for(const m of raw)m.geometry.dispose();}
 return {group,originalStats,wetArea};
}
function waterArea(group){let area=0;group.traverse(m=>{if(!m.isMesh||m.name!=='mouth_water')return;const p=m.geometry.attributes.position,n=m.geometry.index?.count||p.count;for(let i=0;i<n;i+=3){const a=[0,1,2].map(k=>{const j=m.geometry.index?m.geometry.index.getX(i+k):i+k;return [p.getX(j),p.getZ(j)];});area+=Math.abs((a[1][0]-a[0][0])*(a[2][1]-a[0][1])-(a[1][1]-a[0][1])*(a[2][0]-a[0][0]))/2;}});return area;}
function makeMT2Profile(plan,adjacent,kind){const p=plan.profileForCell(...adjacent);return {...p,key:`M2:${plan.seed}:${kind}:${key(adjacent)}:${p.key}`,kind:'straight'};}

/**
 * @param {object} options
 * @param {object} options.plan Actual planCoast47 result, made from FULL map.
 * @param {[number,number]} options.cell Mouth cell, reserved for river renderer.
 * @param {number} options.rotation 0/1/2/3, M1 orientation.
 * @param {function} [options.isLand] R6.1 river-water classification, not MT2 plan.isLand.
 * @param {'original'|'performance'} [options.edition] Mesh output.
 */
export function createRiverMouthMT2({plan,cell=[0,0],rotation=0,isLand,edition='performance',seed=plan?.seed}={}){
 if(!['original','performance'].includes(edition))throw Error('M2: original or performance edition required');
 const checked=validateRiverMouthMT2({plan,cell,rotation,seed}),{left,right,types}=checked;
 const opts={cell:checked.cell,rotation:checked.rotation,seed, ...(isLand?{isLand}:{})};
 const mixed=types[0]!==types[1],sources=[];
 try{
  sources.push(createRiverMouth({...opts,coastType:types[0],coastProfile:makeMT2Profile(plan,left,types[0]),edition:'original'}));
  if(mixed)sources.push(createRiverMouth({...opts,coastType:types[1],coastProfile:makeMT2Profile(plan,right,types[1]),edition:'original'}));
 }catch(e){for(const s of sources)s.dispose();throw e;}
 const {spec,ports}=sources[0];let group,originalStats,compositeWaterArea;
 // A shore is allowed to render beside a river-owned topology placeholder,
 // but it must not build a cliff-to-shoal shoulder *into* that unrendered tile.
 // This is a shallow plan view, not a mutation of MT2 or of the caller's plan.
 const renderingPlan=plan.coastType==='mixed'?Object.freeze({...plan,typeForCell:(x,z)=>plan.isLand(x,z)&&!spec.isLand(x,z)?'cliff':plan.typeForCell(x,z)}):plan;
 if(mixed){const combined=joinHalves(sources[0].group,sources[1].group,spec,edition);group=combined.group;originalStats=combined.originalStats;compositeWaterArea=combined.wetArea;}
 else if(edition==='performance'){
  // Reusing the exact M1 generation/compaction path ensures parity for uniform shores.
  sources[0].dispose();sources.length=0;
  sources.push(createRiverMouth({...opts,coastType:types[0],coastProfile:makeMT2Profile(plan,left,types[0]),edition}));
  group=sources[0].group;originalStats=sources[0].originalStats;
 }else{group=sources[0].group;originalStats=sources[0].originalStats;}
 group.name='river_mouth_m2';group.userData={...group.userData,cell:[...cell],cells:[[...cell]],cellSize:2,rotation:checked.rotation,seed,topologyVersion:'MT2',coastType:mixed?'mixed':types[0],bankTypes:{left:types[0],right:types[1]},riverMouth:true,logicalTerrain:'river',edition,waterY:-.3,landY:0,waterArea:mixed?compositeWaterArea:group.userData.waterArea,renderOwner:'river-mouth-M2',requiresTopologyPlaceholder:true,landingAllowed:false,stationDiscValidated:false};
 let disposed=false;
 const alive=()=>{if(disposed)throw Error('M2: mouth component disposed');};
 return {group,plan,spec,ports,edition,bankTypes:group.userData.bankTypes,originalStats,stats(){alive();return mouthStats(group);},
  // MT2 owns ALL adjacent coast rendering; never call old M1 createCoast().
  createCoast(cells,{edition:ed=edition,cutaway=false}={}){alive();if(!Array.isArray(cells)||!cells.length)throw Error('M2: nonempty MT2 coast cells required');
   if(cells.some(c=>key(c)===key(cell)||!plan.cells.some(p=>key(p)===key(c))))throw Error('M2: only existing MT2 cells outside the reserved mouth may be rendered');
   return createCoast47(renderingPlan,{cells,neighbors:plan.cells,edition:ed,cutaway});},
  createApproach(cells=[spec.at(0,-1)],{edition:ed=edition}={}){alive();if(!['original','performance'].includes(ed))throw Error('M2: invalid approach edition');
   if(!mixed)return sources[0].createApproach(cells,{edition:ed});
   const a=sources[0].createApproach(cells,{edition:'original'}),b=sources[1].createApproach(cells,{edition:'original'});
   try{const combined=joinHalves(a,b,spec,ed).group;combined.userData={...combined.userData,mouthApproach:{cell:[...cell],rotation:checked.rotation,grassCollar:.28},edition:ed};return combined;}finally{disposeMouthGroup(a);disposeMouthGroup(b);}},
  createSea(cells,options={}){alive();return sources[0].createSea(cells,options);},
  dispose(){if(disposed)return;if(mixed)disposeMouthGroup(group);for(const s of sources)s.dispose();disposed=true;}
 };
}
