import * as T from 'three';
import {MAT_TERRAIN,MAT_WATER} from 'palette';
import {createRiverArt} from './river-r61-art.js';
import {createWaterRegion as riverFootprint} from './river-r61-footprint.js';
import {createFinalCoast,makeFinalShoalProfile,makeFinalCliffProfile} from './coast-final.js';
import {createSeaStudy} from './sea-study.js';
import {compactCoastMeshes,coastGeometryBytes,coastTriangleCount} from './coast-performance.js';

const EPS=1e-8,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const rgb=h=>{const c=new T.Color(h);return [c.r,c.g,c.b];},riverC=rgb(0x58b9d5),riverFoam=rgb(0xe3f5ec),shoreC=rgb(0x80d8d3),shoreFoam=rgb(0xe3f6e9);
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),undo=(a,b,t)=>a.map((v,k)=>(v-b[k]*t)/(1-t));
const area2=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
function clip(poly,field){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],u=field(a),v=field(b);if(u>=-1e-10)out.push(a);if(u>1e-10&&v< -1e-10||u< -1e-10&&v>1e-10)out.push(mix(a,b,u/(u-v)));}return out;}
function intersection(poly,mask){const sign=Math.sign(area2(...mask.slice(0,3)))||1;for(let i=0;i<mask.length&&poly.length;i++)poly=clip(poly,p=>sign*area2(mask[i],mask[(i+1)%mask.length],p));return poly;}
function sample(tri,p){const [a,b,c]=tri,den=area2(a,b,c),u=area2(b,c,p)/den,v=area2(c,a,p)/den;return a.map((q,k)=>q*u+b[k]*v+c[k]*(1-u-v));}
const bounds=poly=>[Math.min(...poly.map(v=>v[0])),Math.max(...poly.map(v=>v[0])),Math.min(...poly.map(v=>v[2])),Math.max(...poly.map(v=>v[2]))];
function spatial(polys,origin){
 const bins=new Map(),step=.125,ix=x=>Math.floor((x-origin[0]*2+1)/step),iz=z=>Math.floor((z-origin[1]*2+1)/step);
 for(const poly of polys){const b=bounds(poly);for(let x=ix(b[0]);x<=ix(b[1]);x++)for(let z=iz(b[2]);z<=iz(b[3]);z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(poly);}}
 return box=>{const out=new Set();for(let x=ix(box[0]-EPS);x<=ix(box[1]+EPS);x++)for(let z=iz(box[2]-EPS);z<=iz(box[3]+EPS);z++)for(const poly of bins.get(x+','+z)||[])out.add(poly);return out;};
}
function sampler(polys,origin){const query=spatial(polys,origin);return p=>{for(const t of query([p[0],p[0],p[2],p[2]])){const d=area2(...t),u=area2(t[1],t[2],p)/d,v=area2(t[2],t[0],p)/d;if(Math.min(u,v,1-u-v)>=-2e-6)return sample(t,p);}return null;};}
function rowsOf(group){const rows={};group.traverse(m=>{if(!m.isMesh)return;const g=m.geometry,p=g.attributes.position,c=g.attributes.color,n=g.index?.count||p.count;rows[m.name]??=[];for(let i=0;i<n;i+=3)rows[m.name].push([0,1,2].map(k=>{const j=g.index?g.index.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j),c.getX(j),c.getY(j),c.getZ(j)];}));});return rows;}
function emit(rows,poly,vertical=false){for(let i=1;i<poly.length-1;i++){const tri=[poly[0].slice(0,6),poly[i].slice(0,6),poly[i+1].slice(0,6)],[a,b,c]=tri;
 if(vertical){const n=new T.Vector3().subVectors(new T.Vector3(...b),new T.Vector3(...a)).cross(new T.Vector3().subVectors(new T.Vector3(...c),new T.Vector3(...a)));if(n.lengthSq()<1e-20)continue;}
 else {const d=area2(a,b,c);if(Math.abs(d)<1e-12)continue;if(d>0)[tri[1],tri[2]]=[tri[2],tri[1]];}
 rows.push(tri);}}
function mesh(rows,name,material){const p=[],c=[];for(const tri of rows)for(const v of tri){p.push(...v.slice(0,3));c.push(...v.slice(3,6));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();const m=new T.Mesh(g,material);m.name=name;m.receiveShadow=true;m.castShadow=material===MAT_TERRAIN;return m;}
function finish(group,edition){if(!['original','performance'].includes(edition)){disposeMouthGroup(group);throw Error('valid edition required');}if(edition==='performance'){const old=[...group.children],packed=compactCoastMeshes(old);group.clear();group.add(...packed);for(const m of old)m.geometry.dispose();}return group;}
export function mouthStats(group){let meshes=0,triangles=0,geometryBytes=0;group.traverse(m=>{if(m.isMesh){meshes++;triangles+=coastTriangleCount(m);geometryBytes+=coastGeometryBytes(m);}});return {meshes,triangles,geometryBytes};}
export function disposeMouthGroup(group){group.traverse(m=>{if(m.isMesh)m.geometry.dispose();});group.clear();}

export function makeRiverMouthSpec({cell=[0,0],rotation=0,coastType='cliff',seed=7,isLand:landQuery=null,coastProfile=null}={}){
 if(cell.length!==2||!cell.every(Number.isSafeInteger)||!Number.isSafeInteger(seed)||!Number.isSafeInteger(rotation)||!['shoal','cliff'].includes(coastType))throw Error('integer mouth cell/seed/quarter turn and shoal or cliff coast required');
 rotation=((rotation%4)+4)%4;cell=[...cell];
 const rotate=([x,z],turn)=>{for(let i=0;i<turn;i++)[x,z]=[-z,x];return [x,z];};
 const world=(u,v)=>{const [x,z]=rotate([u,v],rotation);return [cell[0]*2+x,cell[1]*2+z];};
 const local=(x,z)=>rotate([x-cell[0]*2,z-cell[1]*2],(4-rotation)%4);
 const at=(u,v)=>{const [x,z]=rotate([u,v],rotation);return [cell[0]+x,cell[1]+z];};
 if(landQuery!==null&&typeof landQuery!=='function')throw Error('isLand must query the full river neighborhood');
 const isLand=landQuery||((x,z)=>{const [u,v]=rotate([x-cell[0],z-cell[1]],(4-rotation)%4);return v<=0&&u!==0;});
 if(landQuery)for(const [u,v,land] of [[0,0,false],[0,-1,false],[0,1,false],[-1,0,true],[1,0,true],[-1,-1,true],[1,-1,true],[-1,1,false],[1,1,false]])if(!!landQuery(...at(u,v))!==land)throw Error('M1 requires a straight river entrance and a straight coast with open sea ahead');
 const profile=coastProfile||(coastType==='shoal'?makeFinalShoalProfile:makeFinalCliffProfile)({kind:'straight',rotation,origin:cell,seed});
 if(coastProfile&&(profile.waterStyle!=='shore'||typeof profile.distance!=='function'||typeof profile.sandOffset!=='function'||!Number.isFinite(profile.sandWidth)))throw Error('coastProfile must be a valid coast profile');
 return {cell,rotation,coastType,seed,world,local,at,isLand,profile};
}

function collectEdge(rows,spec,side,inverse,beforeRows=null){
 const out=[];for(let ti=0;ti<rows.length;ti++){const tri=rows[ti];for(let k=0;k<3;k++){
  const a=tri[k],b=tri[(k+1)%3],la=spec.local(a[0],a[2]),lb=spec.local(b[0],b[2]),axis=side==='back'?1:0,value=side==='back'?-1:side==='left'?-1:1,along=1-axis;
  if(Math.abs(la[axis]-value)>2e-6||Math.abs(lb[axis]-value)>2e-6||Math.abs(la[along]-lb[along])<1e-9)continue;
  out.push({a,b,lo:la[along],hi:lb[along],baseA:beforeRows?beforeRows[ti][k].slice(3):inverse(a),baseB:beforeRows?beforeRows[ti][(k+1)%3].slice(3):inverse(b)});
 }}return out;
}
function edgeValue(segments,t,base,y=null){let best=null,error=Infinity;for(const s of segments){const f=(t-s.lo)/(s.hi-s.lo);if(f< -2e-6||f>1+2e-6)continue;const v=mix(s.a,s.b,clamp(f));if(y!==null&&Math.abs(v[1]-y)>3e-6)continue;const expected=mix(s.baseA,s.baseB,clamp(f)),e=base.reduce((sum,q,k)=>sum+(q-expected[k])**2,0);if(e<error){error=e;best=v;}}if(!best)throw Error('missing river mouth port sample');return best;}
function waterOutline(shore,spec,back,sides,masks){
 const points=[],edges=new Map(),bins=new Map(),tol=2e-6;
 const node=p=>{const x=Math.round(p[0]/tol),z=Math.round(p[2]/tol);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const id of bins.get((x+dx)+','+(z+dz))||[])if(Math.hypot(points[id][0]-p[0],points[id][2]-p[2])<tol)return id;
  const id=points.length;points.push([p[0],-.3,p[2]]);const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);return id;};
 const add=(a,b)=>{const i=node(a),j=node(b);if(i!==j)edges.set([i,j].sort((a,b)=>a-b).join(','),[i,j]);};
 for(const [a,b] of shore)add(a,b);
 const end=(segments,low)=>segments.flatMap(s=>[{t:s.lo,p:s.a},{t:s.hi,p:s.b}]).sort((a,b)=>a.t-b.t)[low?0:segments.length*2-1].p;
 const left=end(sides.left,true),right=end(sides.right,true),bl=end(back,true),br=end(back,false),a=spec.world(-1,1),b=spec.world(1,1);
 add(left,[a[0],-.3,a[1]]);add([a[0],-.3,a[1]],[b[0],-.3,b[1]]);add([b[0],-.3,b[1]],right);add(bl,br);
 const adj=new Map();for(const [i,j] of edges.values())for(const [x,y] of [[i,j],[j,i]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push(y);}
 for(const [i,ns] of adj)if(ns.length!==2)throw Error('mouth water outline is not a single closed boundary: '+JSON.stringify({point:points[i],degree:ns.length}));
 const ring=[],start=edges.values().next().value[0];let previous=-1,current=start;
 do{ring.push(points[current]);const next=adj.get(current).find(i=>i!==previous);previous=current;current=next;if(ring.length>edges.size)throw Error('mouth outline traversal failed');}while(current!==start);
 if(ring.length!==edges.size)throw Error('unsupported multiple water outlines');
 const ids=T.ShapeUtils.triangulateShape(ring.map(p=>new T.Vector2(p[0],p[2])),[]),tris=ids.map(row=>row.map(i=>ring[i]));
 const area=poly=>Math.abs(poly.slice(1,-1).reduce((s,p,i)=>s+area2(poly[0],p,poly[i+2]),0))/2,reference=masks.reduce((sum,p)=>sum+area(p),0),actual=tris.reduce((sum,p)=>sum+area(p),0);
 if(Math.abs(reference-actual)>2e-5)throw Error('mouth water outline changed covered area: '+reference+' / '+actual);
 return {tris,vertices:ring.length,area:actual};
}

export function createRiverMouth(options={}){
 const {edition='performance',...rest}=options;if(!['original','performance'].includes(edition))throw Error('valid edition required');const spec=makeRiverMouthSpec(rest),{cell,seed,profile}=spec;
 const projected=rows=>rows.filter(t=>Math.abs(area2(...t))>1e-12);
 const coast=createFinalCoast(spec.coastType,[cell],{profile,edition:'original'}),coastRows=rowsOf(coast.group),dryC=projected(Object.entries(coastRows).filter(([n])=>n!=='water'&&n!=='cliff_face').flatMap(([,r])=>r)),wetC=projected(coastRows.water||[]),cliffs=coastRows.cliff_face||[];
 const river=createRiverArt([cell],{isLand:spec.isLand,seed}),riverRows=rowsOf(river),dryR=projected(riverRows.water_bank||[]),wetR=projected(riverRows.water_surface||[]),sampleCoast=sampler(dryC,cell);
 const coastlineDistance=(x,z)=>{const [u,v]=spec.local(x,z),axis=Math.abs(Math.abs(u)-1)<1e-6?1:Math.abs(Math.abs(v)-1)<1e-6?0:-1;
  if(axis<0)return profile.distance(x,z);const along=axis===1?v:u,k=Math.max(0,Math.min(15,Math.floor((along+1)/.125))),a=axis===1?spec.world(u,-1+k*.125):spec.world(-1+k*.125,v),b=axis===1?spec.world(u,-1+(k+1)*.125):spec.world(-1+(k+1)*.125,v),t=clamp((along+1-k*.125)/.125);return profile.distance(...a)*(1-t)+profile.distance(...b)*t;};
 const shoreAmounts=p=>{const f=coastlineDistance(p[0],p[2]),wx=p[0],wz=p[2];return [.38*(1-smooth(f/.44)),(1-smooth(f/.055))*smooth((Math.sin(wx*6.7+wz*4.1)+.35*Math.sin(wx*3.3-wz*5.2)-.12)/.72)*.64];};
 const inverseShore=p=>{const [m,f]=shoreAmounts(p);return undo(undo(p.slice(3),shoreFoam,f),shoreC,m);};
 const shoreSegments=[];
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const c=[cell[0]+dx,cell[1]+dz];if(spec.isLand(...c))continue;const g=riverFootprint([c],{isLand:spec.isLand}),rows=rowsOf(g).water_bank||[];
  for(const tri of rows)for(let k=0;k<3;k++)if(Math.abs(tri[k][1]+.3)<1e-6&&Math.abs(tri[(k+1)%3][1]+.3)<1e-6&&tri[(k+2)%3][1]>-.29999)shoreSegments.push([tri[k],tri[(k+1)%3]]);disposeMouthGroup(g);}
 const distanceTo=(p,segments)=>{let d=Infinity;for(const [a,b] of segments){const x=b[0]-a[0],z=b[2]-a[2],t=clamp(((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z));d=Math.min(d,Math.hypot(p[0]-a[0]-x*t,p[2]-a[2]-z*t));}return d;};
 const riverFoamAt=p=>Math.max(0,1-distanceTo(p,shoreSegments)/.055)*clamp((Math.sin(p[0]*3.1+p[2]*4.7)+.35)*2)*.24;
 const inverseRiver=p=>undo(undo(p.slice(3),riverFoam,riverFoamAt(p)),riverC,.28);
 const sideForce=p=>smooth((Math.abs(spec.local(p[0],p[2])[0])-.72)/.28);
 const coastWeight=(p,hc,hr)=>Math.max(sideForce(p),smooth((hr-hc+.025)/.05));
 function tintApproach(group){group.traverse(m=>{if(!m.isMesh||m.name!=='water_bank')return;const p=m.geometry.attributes.position,c=m.geometry.attributes.color;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),[u,v]=spec.local(x,z);if(v< -1.280001||v>-.999999)continue;
   const point=spec.world(u,-1),target=sampleCoast([point[0],0,point[1]]);if(!target)continue;const w=smooth((v+1.28)/.28)*coastWeight([x,y,z],0,y),col=mix([c.getX(i),c.getY(i),c.getZ(i)],target.slice(3),w);c.setXYZ(i,...col);}c.needsUpdate=true;});return group;}
 const refApproach=createRiverArt([spec.at(0,-1)],{isLand:spec.isLand,seed}),beforeApproach=rowsOf(refApproach);tintApproach(refApproach);const afterApproach=rowsOf(refApproach);
 const backGround=collectEdge(afterApproach.water_bank||[],spec,'back',p=>p.slice(3),beforeApproach.water_bank),backWater=collectEdge(afterApproach.water_surface||[],spec,'back',inverseRiver);
 const sideWater={left:collectEdge(wetC,spec,'left',inverseShore),right:collectEdge(wetC,spec,'right',inverseShore)};
 const terrain=[],waterMasks=[...wetC],rock=[],queryR=spatial(dryR,cell),queryWet=spatial(wetR,cell),sampleR=sampler([...dryR,...wetR],cell);
 function terrainPoint(p,useCoast){const hc=p[1],hr=p[7],y=useCoast?hc:hr,w=coastWeight(p,hc,hr);let colour=mix(p.slice(9,12),p.slice(3,6),w);const [u,v]=spec.local(p[0],p[2]);
  if(Math.abs(v+1)<2e-6)colour=edgeValue(backGround,u,p.slice(9,12),y).slice(3);return [p[0],y,p[2],...colour];}
 for(const c of dryC){for(const r of queryR(bounds(c))){let poly=intersection(c,r);if(poly.length<3)continue;poly=poly.map(v=>[...v,...sample(r,v)]);
   if(poly.every(p=>Math.abs(p[1]-p[7])<1e-8))emit(terrain,poly.map(p=>terrainPoint(p,true)));
   else {emit(terrain,clip(poly,p=>p[7]-p[1]).map(p=>terrainPoint(p,true)));emit(terrain,clip(poly,p=>p[1]-p[7]).map(p=>terrainPoint(p,false)));}}
  for(const r of queryWet(bounds(c))){const poly=intersection(r,c);if(poly.length>=3&&Math.abs(poly.slice(1,-1).reduce((s,p,i)=>s+area2(poly[0],p,poly[i+2]),0))>1e-12)waterMasks.push(poly);}
 }
 const queryAllR=spatial([...dryR,...wetR],cell);
 for(const c of cliffs)for(const r of queryAllR(bounds(c))){let poly=intersection(c,r);if(poly.length<3)continue;poly=clip(poly,p=>sample(r,p)[1]-p[1]);emit(rock,poly,true);}
 // Only the true combined bank is used for foam; the old coast waterline is open through the channel.
 const finalShore=[];for(const tri of [...terrain,...rock])for(let k=0;k<3;k++)if(Math.abs(tri[k][1]+.3)<1e-6&&Math.abs(tri[(k+1)%3][1]+.3)<1e-6&&Math.hypot(tri[k][0]-tri[(k+1)%3][0],tri[k][2]-tri[(k+1)%3][2])>1e-7)finalShore.push([tri[k],tri[(k+1)%3]]);
 function waterPoint(p){const [u,v]=spec.local(p[0],p[2]),base=p.slice(3),d=distanceTo(p,finalShore),seaBlend=smooth((v+1)/2);let c=mix(base,riverC,.28*(1-seaBlend));
  c=mix(c,shoreC,.38*(1-smooth(d/.44))*seaBlend);const foam=(1-smooth(d/.055))*smooth((Math.sin(p[0]*6.7+p[2]*4.1)+.35*Math.sin(p[0]*3.3-p[2]*5.2)-.12)/.72)*(.24+.4*seaBlend);c=mix(c,shoreFoam,foam);
  if(Math.abs(v+1)<2e-6)c=edgeValue(backWater,u,base,-.3).slice(3);
  if(Math.abs(Math.abs(u)-1)<2e-6)c=edgeValue(sideWater[u<0?'left':'right'],v,base,-.3).slice(3);
  if(Math.abs(v-1)<2e-6)c=base;return [p[0],-.3,p[2],...c];}
 const outline=waterOutline(finalShore,spec,backWater,sideWater,waterMasks),baseSea=createSeaStudy([cell],{seed,relief:0}),baseRows=rowsOf(baseSea),seaTriangles=baseRows.sea_art_study,queryMasks=spatial(outline.tris,cell),water=[];
 const portPoints={back:[...new Set(backWater.flatMap(s=>[s.lo,s.hi]))],left:[...new Set(sideWater.left.flatMap(s=>[s.lo,s.hi]))],right:[...new Set(sideWater.right.flatMap(s=>[s.lo,s.hi]))]};
 function waterPolygon(poly){const ring=[];let inserted=false;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],la=spec.local(a[0],a[2]),lb=spec.local(b[0],b[2]);ring.push(a);let side,axis;
   if(Math.abs(la[1]+1)<2e-6&&Math.abs(lb[1]+1)<2e-6){side='back';axis=0;}else if(Math.abs(la[0]+1)<2e-6&&Math.abs(lb[0]+1)<2e-6){side='left';axis=1;}else if(Math.abs(la[0]-1)<2e-6&&Math.abs(lb[0]-1)<2e-6){side='right';axis=1;}
   if(!side||Math.abs(lb[axis]-la[axis])<1e-9)continue;const additions=[];
   for(const value of portPoints[side]){const t=(value-la[axis])/(lb[axis]-la[axis]);if(t>1e-6&&t<1-1e-6)additions.push({t,p:mix(a,b,t)});}additions.sort((a,b)=>a.t-b.t);if(additions.length)inserted=true;ring.push(...additions.map(p=>p.p));}
  if(inserted){const center=ring.reduce((s,p)=>s.map((v,k)=>v+p[k]/ring.length),Array(6).fill(0));for(let i=0;i<ring.length;i++)emit(water,[center,ring[i],ring[(i+1)%ring.length]].map(waterPoint));}
  else emit(water,ring.map(waterPoint));
 }
 for(const tri of seaTriangles)for(const mask of queryMasks(bounds(tri))){const poly=intersection(tri,mask);if(poly.length>=3)waterPolygon(poly);}
 const group=new T.Group();if(terrain.length)group.add(mesh(terrain,'mouth_terrain',MAT_TERRAIN));if(rock.length)group.add(mesh(rock,'mouth_cliff',MAT_TERRAIN));if(water.length)group.add(mesh(water,'mouth_water',MAT_WATER));
 group.name='river_mouth_m1';group.userData={cell:[...cell],cells:[[...cell]],cellSize:2,rotation:spec.rotation,coastType:spec.coastType,seed,landY:0,waterY:-.3,logicalTerrain:'river',riverMouth:true,landingAllowed:false,stationDiscValidated:false,edition,waterArea:outline.area,waterOutlineVertices:outline.vertices};
 const originalStats=mouthStats(group);finish(group,edition);
 disposeMouthGroup(baseSea);disposeMouthGroup(river);disposeMouthGroup(refApproach);coast.dispose();
 let disposed=false;
 return {group,spec,originalStats,ports:{river:spec.at(0,-1),sea:spec.at(0,1),left:spec.at(-1,0),right:spec.at(1,0)},stats:()=>mouthStats(group),
  createApproach(cells=[spec.at(0,-1)],{edition:ed=edition}={}){if(disposed)throw Error('mouth disposed');const g=createRiverArt(cells,{isLand:spec.isLand,seed});tintApproach(g);g.userData.mouthApproach={cell:[...cell],rotation:spec.rotation,grassCollar:.28};return finish(g,ed);},
  createCoast(cells,{edition:ed=edition}={}){if(disposed)throw Error('mouth disposed');return createFinalCoast(spec.coastType,cells,{profile,edition:ed});},
  createSea(cells,{edition:ed=edition,relief=.018}={}){if(disposed)throw Error('mouth disposed');if(!Number.isFinite(relief)||relief<0||relief>.05)throw Error('sea relief must be between zero and .05');const surface=createSeaStudy(cells,{seed,relief}),p=surface.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const [,v]=spec.local(p.getX(i),p.getZ(i)),fade=smooth((v-1)/2);if(fade<1)p.setY(i,fade===0?-.3:-.3+(p.getY(i)+.3)*fade);}p.needsUpdate=true;surface.geometry.computeVertexNormals();surface.name='v08_connected_sea';const g=new T.Group();g.add(surface);g.userData={cells,seed,waterY:-.3,relief,shoreWaveCollar:2};return finish(g,ed);},
  dispose(){if(disposed)return;disposeMouthGroup(group);disposed=true;}
 };
}
