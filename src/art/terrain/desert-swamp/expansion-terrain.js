import * as T from 'three';
import {MAT_WATER} from 'palette';
import {COLORS as C,GeometryBuilder,clamp,hash,rgb,cactus,reedClump,deadTree,fallenLog,lilyPad,geometryStats} from './expansion-geometry.js';

export const EXPANSION_SPEC=Object.freeze({version:'V1.0 Final R3',tileSize:2,landY:0,swampWaterY:-.055,bottom:-.38,duneHeightCeiling:.70,reedHeightDefault:.80,reedHeightMin:.25,reedHeightMax:.90,forestTreeMin:1.2,desertVariants:['flat','cactus','dunes','mixed','low_dunes','double_dunes','ripples','varied'],swampVariants:['standard','muddy','reeds','deadwood']});
const key=([x,z])=>x+','+z;
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
function cellsChecked(cells){
 if(!Array.isArray(cells)||cells.length===0)throw Error('At least one cell is required');
 for(const c of cells)if(!Array.isArray(c)||c.length!==2||!c.every(Number.isInteger))throw Error('Cell coordinates must be integer [x,z] pairs');
 return [...new Map(cells.map(c=>[key(c),c.slice()])).values()];
}
function domain(cells){
 const set=new Set(cells.map(key)),edges=[];
 for(const [x,z] of cells)for(const [dx,dz] of DIRS)if(!set.has(key([x+dx,z+dz]))){
  const a=dx?[x*2+dx,z*2-1]:[x*2-1,z*2+dz],b=dx?[x*2+dx,z*2+1]:[x*2+1,z*2+dz];edges.push([a,b]);
 }
 const distance=(x,z)=>{let d=Infinity;for(const [a,b] of edges){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));d=Math.min(d,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return d;};
 return {set,edges,distance};
}
function tileSides(b,cell,allCells,bottom,color,height){
 const set=new Set(allCells.map(key)),[cx,cz]=cell;
 for(const [dx,dz] of DIRS)if(!set.has(key([cx+dx,cz+dz])))for(let j=0;j<4;j++){
  const a=dx?[dx,height(dx,(-1+j*.5)),-1+j*.5]:[-1+j*.5,height(-1+j*.5,dz),dz];
  const c=dx?[dx,height(dx,(-.5+j*.5)),-.5+j*.5]:[-.5+j*.5,height(-.5+j*.5,dz),dz];
  const lo=[c[0],bottom,c[2]],hi=[a[0],bottom,a[2]],n=new T.Vector3().subVectors(new T.Vector3(...c),new T.Vector3(...a)).cross(new T.Vector3().subVectors(new T.Vector3(...lo),new T.Vector3(...a)));
  const q=n.dot(new T.Vector3(dx,0,dz))>0?[a,c,lo,hi]:[c,a,hi,lo];b.quad(...q,color,.84+(j%2)*.055);
 }
}
function finishTile(root,terrain,water,cell,type,variant){
 const tile=new T.Group();tile.name=type+'_'+variant;tile.position.set(cell[0]*2,0,cell[1]*2);tile.add(terrain.mesh());
 if(water?.positions.length){const m=water.mesh(MAT_WATER);m.castShadow=false;tile.add(m);}
 tile.userData={type,variant,cell:cell.slice(),bounds:[-1,1,-1,1],landY:0,waterY:type==='swamp'?EXPANSION_SPEC.swampWaterY:null};root.add(tile);return tile;
}
function decorateDesert(b,variant,cell,seed,sample){
 if(['flat','dunes','low_dunes','double_dunes','ripples'].includes(variant))return;
 const [cx,cz]=cell;
 if(['mixed','varied'].includes(variant)&&hash(cx,cz,seed+8)>(variant==='varied'?.32:.47))return;
 const candidates=[[.43,-.22],[-.43,.22],[.30,.42],[-.35,-.43]];
 const chosen=candidates.slice().sort((a,c)=>sample(cx*2+a[0],cz*2+a[1])-sample(cx*2+c[0],cz*2+c[1]));
 const [x,z]=chosen[0],y=sample(cx*2+x,cz*2+z),temp=new GeometryBuilder();cactus(temp,x,z,.88,hash(cx,cz,seed)*Math.PI*2);
 for(let i=1;i<temp.positions.length;i+=3)temp.positions[i]+=y;b.positions.push(...temp.positions);b.colors.push(...temp.colors);
 if(variant==='cactus'){
  const sx=-x,sz=-z,h=sample(cx*2+sx,cz*2+sz),small=new GeometryBuilder();cactus(small,sx,sz,.38,1.2);
  for(let i=1;i<small.positions.length;i+=3)small.positions[i]+=h;b.positions.push(...small.positions);b.colors.push(...small.colors);
 }
}
export function desertSampler(input,{variant='mixed',seed=7,heightScale=1}={}){
 if(!Number.isFinite(heightScale)||heightScale<.25||heightScale>1)throw Error('Dune heightScale must be between 0.25 and 1; R1 height is the ceiling');
 const cells=cellsChecked(input),d=domain(cells),peaks=cells.flatMap(([x,z])=>{
  const a=hash(x,z,seed+5)*1.15-.60;
  const p={x:x*2+(hash(x,z,seed)-.5)*.60,z:z*2+(hash(x,z,seed+1)-.5)*.52,a,h:.48+hash(x,z,seed+2)*.22,wind:1.28,slip:.66,length:1.32};
  if(variant==='double_dunes')return [-1,1].map((sign,i)=>({...p,x:p.x+Math.cos(a)*sign*.34,z:p.z+Math.sin(a)*sign*.34,h:p.h*(i?.50:.43),wind:.68,slip:.44,length:.98}));
  if(variant==='varied'){const t=hash(x,z,seed+41);p.h*=t<.25?.30:t<.55?.5:t<.8?.70:.95;p.a+=(hash(x,z,seed+42)-.5)*.9;p.wind*=.85+hash(x,z,seed+43)*.2;p.length*=.8+hash(x,z,seed+44)*.3;}
  return [p];
 });
 const sample=(x,z)=>{
  if(variant==='flat'||variant==='cactus')return 0;
  let h=0;for(const p of peaks){
   const dx=x-p.x,dz=z-p.z,u=dx*Math.cos(p.a)+dz*Math.sin(p.a),v=-dx*Math.sin(p.a)+dz*Math.cos(p.a);
   // Long windward face, short slip face, and a broad irregular crest.
   const width=u<0?p.wind:p.slip,profile=1-Math.abs(u)/width-Math.pow(Math.abs(v)/p.length,1.30)*.62;
   h=Math.max(h,p.h*clamp(profile));
  }
  if(variant==='ripples')h=.035+.105*Math.pow(.5+.5*Math.sin(x*4.1+z*1.55+seed*.23),1.35)+.025*(.5+.5*Math.sin(z*2.2-x*.6));
  return Math.min(EXPANSION_SPEC.duneHeightCeiling,h,d.distance(x,z)*.92)*(variant==='low_dunes'?.5:1)*heightScale;
 };return {sample,domain:d,heightScale};
}
export function createDesertRegion(input,{variant='mixed',seed=7,heightScale=1,cutaway=false,bottom=EXPANSION_SPEC.bottom,contextCells=input,props=true,propFreeCells=[]}={}){
 const cells=cellsChecked(input);if(!EXPANSION_SPEC.desertVariants.includes(variant))throw Error('Unknown desert variant');
 const {sample}=desertSampler(cells,{variant,seed,heightScale}),root=new T.Group(),free=new Set(propFreeCells.map(key));root.name='desert_region_r2';
 for(const cell of cells){
  const [cx,cz]=cell,b=new GeometryBuilder('desert_surface_and_props'),N=8;
  const p=(i,j)=>{const x=-1+i*2/N,z=-1+j*2/N;return [x,sample(cx*2+x,cz*2+z),z];};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const a=p(i,j),c=p(i,j+1),d=p(i+1,j+1),e=p(i+1,j);
   const tris=(i+j+cx+cz)%2?[[a,c,e],[c,d,e]]:[[a,c,d],[a,d,e]];
   for(const tri of tris){
    const y=tri.reduce((s,p)=>s+p[1],0)/3,shade=.98+hash(cx*8+i,cz*8+j,seed)*.025;
    let color=y>.36?C.sandLight:C.sand;
    if(['low_dunes','double_dunes','ripples','varied'].includes(variant)){const x=tri.reduce((s,p)=>s+p[0],0)/3+cx*2,z=tri.reduce((s,p)=>s+p[2],0)/3+cz*2,patch=.5+.25*Math.sin(x*1.7+z*.9+seed*.2)+.25*Math.cos(z*1.8-x*.6);color=rgb(C.sand).clone().lerp(rgb(C.sandLight),.08+patch*.26);}
    b.up(...tri,color,shade);
   }
  }
  if(props&&!free.has(key(cell)))decorateDesert(b,variant,cell,seed,sample);
  if(cutaway)tileSides(b,cell,contextCells,bottom,C.sandDark,(x,z)=>sample(cx*2+x,cz*2+z));
  finishTile(root,b,null,cell,'desert',variant);
 }
 root.userData={type:'desert',variant,cells,seed,heightScale,tileSize:2,landY:0,cutaway,stats:geometryStats(root)};return root;
}
function smoothMin(a,b,k){if(!Number.isFinite(a))return b;const h=clamp(.5+.5*(b-a)/k);return b*(1-h)+a*h-k*h*(1-h);}
export function swampSampler(input,{variant='standard',seed=7}={}){
 const cells=cellsChecked(input),d=domain(cells),features=[];
 const rx=variant==='muddy'?.64:.91,rz=variant==='muddy'?.55:.77;
 for(const [x,z] of cells){
  features.push({x:x*2+(hash(x,z,seed)-.5)*.28,z:z*2+(hash(x,z,seed+1)-.5)*.25,rx:rx*(.94+hash(x,z,seed+3)*.10),rz});
  if(variant!=='muddy')for(const [dx,dz] of [[1,0],[0,1]])if(d.set.has(key([x+dx,z+dz])))features.push({x:x*2+dx,z:z*2+dz,rx:dx?.66:.34,rz:dz?.66:.34});
 }
 const field=(x,z)=>{
  let s=Infinity;for(const p of features){const distance=(Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)-1)*Math.min(p.rx,p.rz);s=smoothMin(s,distance,.10);}
  s+=.065*Math.sin(x*6.7+z*3.6+seed)+.045*Math.cos(z*8.3-x*4.3+seed*.3);
  return Math.max(s,.125-d.distance(x,z)*.86);
 };return {field,domain:d};
}
function clip(poly,level,above){
 const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],u=(a[3]-level)*(above?1:-1),v=(b[3]-level)*(above?1:-1);
  if(u>=-1e-10)out.push(a);
  if(u>1e-10&&v< -1e-10||u< -1e-10&&v>1e-10){const t=u/(u-v);out.push(a.map((p,k)=>p+(b[k]-p)*t));}
 }return out;
}
function contourSurface(builder,polygon,kind,cx,cz,seed){
 if(polygon.length<3)return;
 const p=polygon.map(v=>[v[0],kind==='dry'?0:kind==='water'?EXPANSION_SPEC.swampWaterY:EXPANSION_SPEC.swampWaterY*(1-clamp(v[3]/.125)),v[2]]);
 const x=polygon.reduce((sum,v)=>sum+v[0],0)/polygon.length+cx*2,z=polygon.reduce((sum,v)=>sum+v[2],0)/polygon.length+cz*2;
 const wave=Math.sin(x*2.8+z*1.2+seed)*.5+Math.cos(z*3.5-x*.9)*.5;
 const color=kind==='dry'?rgb(C.moss).clone().lerp(rgb(C.mossLight),clamp(wave*.25+.35)):kind==='water'?rgb(C.water).clone().lerp(rgb(C.waterLight),clamp(.35+wave*.23)):rgb(C.mud).clone().lerp(rgb(C.bank),.35);
 for(let i=1;i<p.length-1;i++)builder.up(p[0],p[i],p[i+1],color);
}
function swampProps(b,water,cell,field,{variant,seed,reedHeight}){
 const [cx,cz]=cell,at=(x,z)=>field(x+cx*2,z+cz*2);
 const candidates=[[-.61,-.58],[.56,-.58],[-.58,.58],[.56,.58],[0,-.72],[0,.72],[-.72,0],[.72,0]];
 const start=Math.floor(hash(cx,cz,seed+13)*4),ordered=Array.from({length:candidates.length},(_,i)=>candidates[(i+start)%candidates.length]);
 const dry=ordered.filter(([x,z])=>at(x,z)>.08);
 const primary=dry[0]||ordered.reduce((best,p)=>at(...p)>at(...best)?p:best,ordered[0]);
 const scale=variant==='reeds'?1.12:1.00,clumps=[];
 function fittedReeds(p,s,salt){
  const t=hash(cx,cz,salt+101),heightFactor=t<.25?.48+t*.5:t<.67?.77+(t-.25)*.70:1.10+(t-.67)*1.20,widthFactor=.90+hash(cx,cz,salt+102)*.24,bladeCount=14+Math.floor(hash(cx,cz,salt+103)*9);
  const jitter=[p[0]+(hash(cx,cz,salt+104)-.5)*.13,p[1]+(hash(cx,cz,salt+105)-.5)*.13];if(Math.max(...jitter.map(Math.abs))<.80&&at(...jitter)>.07)p=jitter;
  const temp=new GeometryBuilder();reedClump(temp,...p,s,salt,-.005,{heightFactor,widthFactor,bladeCount,phase:hash(cx,cz,salt+106)*Math.PI*2});let fit=1;
  for(let i=0;i<temp.positions.length;i+=3)for(const axis of [0,2]){const center=p[axis===0?0:1],v=temp.positions[i+axis]-center;if(v>0)fit=Math.min(fit,(.975-center)/v);else if(v<0)fit=Math.min(fit,(-.975-center)/v);}
  for(let i=0;i<temp.positions.length;i+=3){temp.positions[i]=p[0]+(temp.positions[i]-p[0])*fit;temp.positions[i+2]=p[1]+(temp.positions[i+2]-p[1])*fit;}
  let maxY=-Infinity;for(let i=1;i<temp.positions.length;i+=3)maxY=Math.max(maxY,temp.positions[i]);
  const fraction=.40+.60*clamp((heightFactor-.48)/1.02),targetHeight=reedHeight*fraction*Math.min(1,s/1.12),scaleY=targetHeight/(maxY+.005);
  for(let i=1;i<temp.positions.length;i+=3)temp.positions[i]=-.005+(temp.positions[i]+.005)*scaleY;
  b.positions.push(...temp.positions);b.colors.push(...temp.colors);
  clumps.push({x:p[0],z:p[1],heightFactor,widthFactor,bladeCount,height:targetHeight});
 }
 fittedReeds(primary,scale,Math.floor(hash(cx,cz,seed)*100000));
 if(variant==='reeds'||variant==='muddy'||hash(cx,cz,seed+4)>.48){
  const second=dry.find(p=>Math.hypot(p[0]-primary[0],p[1]-primary[1])>.95);if(second)fittedReeds(second,.55+hash(cx,cz,seed+5)*.25,seed+cx*27+cz*91+203);
 }
 if(variant==='deadwood'){
  const p=dry.find(p=>Math.hypot(p[0]-primary[0],p[1]-primary[1])>1.0);if(p)deadTree(b,...p,.85,hash(cx,cz,seed+11)*6.28);
  if(hash(cx,cz,seed+6)>.30&&at(.13,.12)<-.04)fallenLog(b,.06,.14,.68,.50,EXPANSION_SPEC.swampWaterY);
 }
 const pads=[[-.35,-.12,.095],[.30,-.18,.085],[-.12,.33,.075],[.32,.28,.07]];
 for(let i=0;i<pads.length;i++){
  const [x,z,r]=pads[i],xx=x+(hash(cx,cz,seed+i+31)-.5)*.14,zz=z+(hash(cx,cz,seed+i+37)-.5)*.14;
  if(at(xx,zz)<-r*1.6)lilyPad(water,xx,zz,r*1.22,EXPANSION_SPEC.swampWaterY+.0025,i*1.3);
 }
 return clumps;
}
// propVariant(cell)：可选，按格返回 'standard' | 'reeds' | 'deadwood'，只改变该格的道具（芦苇多少 / 枯木），水洼形状不变
export function createSwampRegion(input,{variant='standard',seed=7,reedHeight=EXPANSION_SPEC.reedHeightDefault,cutaway=false,bottom=EXPANSION_SPEC.bottom,contextCells=input,props=true,propVariant=null}={}){
 const cells=cellsChecked(input);if(!EXPANSION_SPEC.swampVariants.includes(variant))throw Error('Unknown swamp variant');
 if(!Number.isFinite(reedHeight)||reedHeight<EXPANSION_SPEC.reedHeightMin||reedHeight>EXPANSION_SPEC.reedHeightMax)throw Error('Reed height must be 0.25–0.90, below the smallest 1.2-high forest tree');
 const {field}=swampSampler(cells,{variant,seed}),root=new T.Group();root.name='swamp_region_r1';
 for(const cell of cells){
  const [cx,cz]=cell,b=new GeometryBuilder('swamp_banks_and_props'),water=new GeometryBuilder('swamp_shallow_water'),N=12;
  const p=(i,j)=>{const x=-1+i*2/N,z=-1+j*2/N;return [x,0,z,field(x+cx*2,z+cz*2)];};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
   const a=p(i,j),c=p(i,j+1),d=p(i+1,j+1),e=p(i+1,j);
   const tris=(i+j+cx+cz)%2?[[a,c,e],[c,d,e]]:[[a,c,d],[a,d,e]];
   for(const tri of tris){
    contourSurface(b,clip(tri,.125,true),'dry',cx,cz,seed);
    contourSurface(b,clip(clip(tri,0,true),.125,false),'bank',cx,cz,seed);
    contourSurface(water,clip(tri,0,false),'water',cx,cz,seed);
   }
  }
  const pv=propVariant?propVariant(cell):variant;if(!['standard','reeds','deadwood','muddy'].includes(pv))throw Error('Unknown swamp prop variant');
   const clumps=props?swampProps(b,water,cell,field,{variant:pv,seed,reedHeight}):[];
  if(cutaway)tileSides(b,cell,contextCells,bottom,0x7a8134,()=>0);
  finishTile(root,b,water,cell,'swamp',variant).userData.reedClumps=clumps;
 }
 root.userData={type:'swamp',variant,cells,seed,reedHeight,tileSize:2,landY:0,waterY:EXPANSION_SPEC.swampWaterY,cutaway,stats:geometryStats(root)};return root;
}
export function createDesertTile({cell=[0,0],...options}={}){return createDesertRegion([cell],options);}
export function createSwampTile({cell=[0,0],...options}={}){return createSwampRegion([cell],options);}
export function disposeExpansion(root){root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});root.clear();}
export const EXPANSION_PARTS={
 desert:{variants:EXPANSION_SPEC.desertVariants,create:createDesertTile,role:'terrain'},
 swamp:{variants:EXPANSION_SPEC.swampVariants,create:createSwampTile,role:'terrain'}
};
