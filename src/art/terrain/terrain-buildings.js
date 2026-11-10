import * as T from 'three';
import {MAT_TERRAIN,MAT_ACCENT} from 'palette';
const C={wall:0xc9c1ac,light:0xd9d1bd,dark:0xada694,roof:0x787a72,window:0x484e4b,lot:0xc8c2ac,accent:0xe6e6e6};
function batch(name,material=MAT_TERRAIN){
 const p=[],c=[];
 const tri=(a,b,d,col)=>{const rgb=new T.Color(col);for(const v of [a,b,d]){p.push(...v);c.push(rgb.r,rgb.g,rgb.b);}};
 const quad=(a,b,d,e,col)=>{tri(a,b,d,col);tri(a,d,e,col);};
 function prism(poly,y0,y1,col){ // CCW in x/z; top points outward +y
  const n=poly.length;for(let i=0;i<n;i++){const j=(i+1)%n,a=poly[i],b=poly[j];quad([a[0],y0,a[1]],[a[0],y1,a[1]],[b[0],y1,b[1]],[b[0],y0,b[1]],col);}
  const faces=T.ShapeUtils.triangulateShape(poly.map(v=>new T.Vector2(...v)),[]);
  for(const f of faces){tri(...[f[0],f[2],f[1]].map(i=>[poly[i][0],y1,poly[i][1]]),col);tri(...f.map(i=>[poly[i][0],y0,poly[i][1]]),col);}
 }
 function box(x0,x1,z0,z1,y0,y1,col,cut=0){const k=Math.min(cut,(x1-x0)/3,(z1-z0)/3);prism(k?[[x0+k,z0],[x1-k,z0],[x1,z0+k],[x1,z1-k],[x1-k,z1],[x0+k,z1],[x0,z1-k],[x0,z0+k]]:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],y0,y1,col);}
 function profile(points,z0,z1,col){const faces=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(...p)),[]);for(const f of faces){tri(...f.map(i=>[points[i][0],points[i][1],z1]),col);tri(...[f[0],f[2],f[1]].map(i=>[points[i][0],points[i][1],z0]),col);}for(let i=0;i<points.length;i++){let a=points[i],b=points[(i+1)%points.length];quad([a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],z1],[a[0],a[1],z1],col);}}
 function done(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();const m=new T.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}
 return {tri,quad,box,profile,done};
}
function facade(b,x0,x1,z0,z1,h,door=false){
 const w=x1-x0;
 // Large flat panels, no window cavities or thin geometry frames.
 if(w>.8){for(const x of [x0+.16,x1-.48])for(const z of [z0-.002,z1+.002]){if(door&&z>z1)continue;const v=[[x,.24,z],[x+.32,.24,z],[x+.32,.54,z],[x,.54,z]];b.quad(...(z<z0?v.slice().reverse():v),C.window);}}
 else {for(const z of [z0-.002,z1+.002]){const x=(x0+x1)/2-.16;const v=[[x,.17,z],[x+.32,.17,z],[x+.32,.47,z],[x,.47,z]];b.quad(...(z<z0?v.slice().reverse():v),C.window);}}
 for(const x of [x0-.002,x1+.002]){const za=(z0+z1)/2-.15;const v=[[x,.2,za],[x,.2,za+.3],[x,.5,za+.3],[x,.5,za]];b.quad(...(x<x0?v.slice().reverse():v),C.window);}
}
// Broad bevelled roof planes remain legible at the 7/9-cell camera.
function hip(b,x0,x1,z0,z1,y0,y1,col,inset=.09){
 const low=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],top=[[x0+inset,y1,z0+inset],[x1-inset,y1,z0+inset],[x1-inset,y1,z1-inset],[x0+inset,y1,z1-inset]];
 for(let i=0;i<4;i++){const j=(i+1)%4;b.quad(low[i],top[i],top[j],low[j],col);}b.quad(top[0],top[3],top[2],top[1],col);
}
// City roofs: deep gables and recessed terraces, all faction-colored surfaces merged.
function cityRoof(b,a,x0,x1,z0,z1,h,gabled){
 const mid=(x0+x1)/2, rise=(x1-x0)*.42;
 if(gabled){
  b.profile([[x0,h],[x1,h],[mid,h+rise]],z0,z1,C.light);
  const e=.018;
  a.profile([[x0-e,h+.025],[mid,h+rise+.045],[x1+e,h+.025],[x1+e,h-.015],[mid,h+rise+.005],[x0-e,h-.015]],z0-.012,z1+.012,C.accent);
  // Roof slopes meet directly; no protruding ridge strip.
  b.profile([[mid-.075,h+.025],[mid+.075,h+.025],[mid,h+rise*.55]],z1+.013,z1+.014,C.window);
 }else{
  hip(a,x0-.012,x1+.012,z0-.012,z1+.012,h,h+.10,C.accent,.055);
  b.box(x0+.065,x1-.065,z0+.08,z1-.08,h+.101,h+.108,C.light,.012);
  for(const [u,v] of [[x0+.035,x0+.067],[x1-.067,x1-.035]])a.box(u,v,z0+.035,z1-.035,h+.10,h+.15,C.accent,.008);
  for(const [u,v] of [[z0+.035,z0+.067],[z1-.067,z1-.035]])a.box(x0+.035,x1-.035,u,v,h+.10,h+.15,C.accent,.008);
 }
}
function panel(b,x0,x1,y0,y1,z,col,back=false){const v=[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]];b.quad(...(back?v.reverse():v),col);}
function create(kind){
 const root=new T.Group();root.name=kind;
 const b=batch('body'),a=batch('accent',MAT_ACCENT);
 const accentBox=a.box;a.box=(x0,x1,z0,z1,y0,y1,col,cut=0)=>accentBox(x0-.004,x1+.004,z0-.004,Math.min(-.251,z1+.004),y0,y1,col,cut);
 if(kind==='bld_hq'){
  // One integrated command building, with a deep central block and two low wings.
  b.box(-.93,.93,-.93,-.27,-.2,.15,C.dark,.04);
  for(const [x0,x1] of [[-.92,-.45],[.45,.92]]){
   b.box(x0,x1,-.91,-.28,.15,.67,C.wall,.025);
   b.box(x0-.01,x1+.01,-.92,-.27,.62,.70,C.light,.018);
   a.box(x0-.01,x1+.01,-.92,-.27,.70,.75,C.accent,.018);
   hip(a,x0-.01,x1+.01,-.92,-.27,.75,.88,C.accent,.065);
   panel(b,x0+.055,x1-.055,.34,.54,-.277,C.window);
   for(const x of [x0+.15,x0+.29])b.box(x,x+.022,-.28,-.275,.34,.54,C.light);
   b.box(x0+.035,x1-.035,-.30,-.274,.28,.33,C.light);
  }
  b.box(-.53,.53,-.935,-.28,.15,1.03,C.wall,.035);
  b.box(-.56,.56,-.94,-.27,.97,1.06,C.light,.025);
  a.box(-.57,.57,-.94,-.26,1.06,1.10,C.accent,.025);
  hip(a,-.57,.57,-.94,-.26,1.10,1.20,C.accent,.075);
  // Broad rectangular entrance, clean separated planes (no nested coplanar profiles).
  panel(b,-.34,.34,.15,.79,-.277,C.window);
  for(const x of [-.35,.29])a.box(x,x+.06,-.30,-.255,.15,.82,C.accent);
  a.box(-.35,.35,-.30,-.255,.79,.84,C.accent);
  b.box(-.013,.013,-.277,-.252,.15,.78,0x9faaa4);
  for(const x of [-.50,.38]){
   b.box(x,x+.12,-.37,-.251,.15,.91,C.light,.02);
   b.box(x-.015,x+.135,-.38,-.2501,.15,.25,C.dark,.015);
  }
  b.box(-.51,.51,-.38,-.251,.89,.97,C.light,.02);
  // Broad emblem panel with an inset chevron.
  b.box(-.13,.13,-.283,-.2505,.96,1.085,0xb6b4a9,.012);
  b.tri([-.085,1.055,-.2502],[0,.99,-.2502],[.085,1.055,-.2502],C.light);
  for(const x of [-.39,.06])panel(b,x,x+.33,.40,.76,-.937,C.window,true);
  const command=batch('roof_command');
  command.box(-.34,.34,-.82,-.40,1.20,1.35,C.light,.025);
  for(const z of [-.822,-.398])panel(command,-.29,.29,1.235,1.32,z,C.window,z<-.8);
  a.box(-.39,.39,-.86,-.36,1.35,1.39,C.accent,.025);
  hip(a,-.39,.39,-.86,-.36,1.39,1.47,C.accent,.055);
  // Two simple rooftop communications units, sharing the attachment mesh.
  for(const [x,top] of [[-.73,1.23],[.73,1.38]]){
   command.box(x-.075,x+.075,-.76,-.62,.86,.96,C.roof,.02);
   command.box(x-.014,x+.014,-.705,-.675,.96,top,C.roof);
   command.box(x-.065,x+.065,-.71,-.67,top-.13,top-.105,C.roof,.006);
  }
  root.add(command.done());
 }else if(kind==='bld_factory'){
  // Thick warehouse body, broad loading door and three stepped roof bays.
  b.box(-.93,.93,-.93,-.27,-.20,.12,C.dark,.025);
  b.box(-.91,.91,-.91,-.28,.12,.73,C.wall,.025);
  for(const x of [-.90,.78]){
   b.box(x,x+.12,-.92,-.251,.12,.75,C.light,.015);
   b.box(x-.01,x+.13,-.93,-.2501,.12,.22,C.dark,.015);
  }
  panel(b,-.74,.74,.13,.65,-.277,C.window);
  for(const y of [.23,.34,.45,.56])panel(b,-.72,.72,y,y+.022,-.274,0x777e79);
  for(const x of [-.78,.72])b.box(x,x+.06,-.32,-.252,.12,.69,C.dark);
  b.box(-.79,.79,-.35,-.251,.65,.73,C.light,.015);
  a.box(-.93,.93,-.93,-.26,.73,.79,C.accent,.02);
  const bays=[[-.91,-.30,1.00],[-.30,.31,.94],[.31,.91,.87]];
  for(const [x0,x1,h] of bays){
   a.profile([[x0,.78],[x1,.78],[x1,h-.10],[x1-.06,h],[x0+.05,h]],-.91,-.28,C.accent);
   // Rear and front eave lips show the roof's thickness.
   a.box(x0+.015,x1-.015,-.93,-.88,h-.08,h-.025,C.accent,.01);
  }
  for(const [x,h] of [[-.64,1.0],[-.03,.94]]){
   b.box(x-.105,x+.105,-.76,-.47,h-.015,h+.12,C.dark,.025);
   hip(b,x-.13,x+.13,-.79,-.44,h+.12,h+.17,C.roof,.025);
   panel(b,x-.065,x+.065,h+.035,h+.09,-.468,C.window);
  }
  for(const x of [-.912,.912]){const v=[[x,.25,-.79],[x,.25,-.43],[x,.56,-.43],[x,.56,-.79]];b.quad(...(x<0?v.reverse():v),C.window);}
  const tower=new T.Group();tower.name='tower_chimney';tower.position.set(.73,.54,-.73);
  const t=batch('tower_chimney_body');t.box(-.12,.12,-.12,.12,0,.18,C.dark,.025);t.box(-.095,.095,-.095,.095,.18,1.06,0x8f8879,.025);for(const y of [.38,.77,1.03])t.box(-.12,.12,-.12,.12,y,y+.09,C.roof,.02);t.box(-.085,.085,-.085,.085,1.12,1.125,C.window,.02);tower.add(t.done());root.add(tower);
 }else{
  const large=kind==='bld_city_large';
  const buildings=large?[[-.91,-.5,.63],[-.46,-.04,1.04],[0,.42,.80],[.46,.91,.55]]:[[-.83,-.12,.55],[.07,.81,.72]];
  buildings.forEach(([x0,x1,h],i)=>{
   const z0=large?[-.89,-.93,-.86,-.91][i]:-.9+(i%2)*.05,z1=large?[-.33,-.42,-.28,-.37][i]:-.28-(i%2)*.035;
   b.box(x0,x1,z0,z1,-.2,h,i%2?C.light:C.wall,.025);
   b.box(x0-.01,x1+.01,z0-.01,z1+.01,.02,.13,C.dark,.02);
   a.box(x0,x1,z0,z1,h-.07,h+.015,C.accent,.02);
   cityRoof(b,a,x0,x1,z0,z1,h,i%2===0);
   for(const z of [z0-.002,z1+.002]){
    const back=z<z0,mid=(x0+x1)/2;
    panel(b,mid-.16,mid+.16,.17,.47,z,C.window,back);
    if(h>.8)panel(b,mid-.16,mid+.16,.59,.89,z,C.window,back);
    else if(!large)panel(b,mid-.17,mid+.17,.17,.47,z,0x515852,back);
   }
   for(const x of [x0-.002,x1+.002]){const v=[[x,.2,z0+.13],[x,.2,z1-.13],[x,.5,z1-.13],[x,.5,z0+.13]];b.quad(...(x<x0?v.reverse():v),C.window);}
   // Large cornices, door recess and roof forms read at tactical scale.
   const mid=(x0+x1)/2;
   b.box(x0-.018,x1+.018,z0-.012,z1+.018,h-.10,h-.045,C.light,.018);
   panel(b,mid-.075,mid+.075,.13,.38,z1+.003,C.window);
   for(const x of [x0+.018,x1-.05])b.box(x,x+.032,z1-.015,z1+.012,.13,h-.10,C.light);
   if(large){
    if(h>.8){b.box(x0+.018,x1-.018,z0-.006,z1+.012,.51,.565,C.light,.012);}
    if(i===1)b.box(x0+.13,x0+.24,z0+.18,z0+.30,h+.108,h+.15,C.roof,.012);
   }
   // Visible front entrance canopy, safely behind the mass boundary.
   b.box(x0+.035,x1-.035,z1-.08,Math.min(-.251,z1+.02),.48,.53,C.light,.015);
  });
 }
 root.add(b.done(),a.done());
 if(kind==='bld_city_small')root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*.65,p.getY(i)<0?p.getY(i):p.getY(i)*.90,-.60+(p.getZ(i)+.60)*.85);p.needsUpdate=true;o.geometry.computeVertexNormals();}});
 return root;
}
// Immutable shared geometry templates; clones retain independent transforms/material slots.
const templates=new Map();
function sharedCreate(kind){if(!templates.has(kind))templates.set(kind,create(kind));return templates.get(kind).clone(true);}
export const createBldHq=()=>sharedCreate('bld_hq');
export const createBldCitySmall=()=>sharedCreate('bld_city_small');
export const createBldCityLarge=()=>sharedCreate('bld_city_large');
export const createBldFactory=()=>sharedCreate('bld_factory');
const entry=(create,height,towers=[])=>({create,height,standCenter:[0,.45],standRadius:.7,massRect:[-.95,-.95,.95,-.25],towers,role:'structure'});
export const BUILDINGS={bld_hq:{...entry(createBldHq,1.47),roofAttachments:['roof_command']},bld_city_small:entry(createBldCitySmall,.864),bld_city_large:entry(createBldCityLarge,1.20),bld_factory:entry(createBldFactory,1.665,['tower_chimney'])};
// Clone once per faction and share that material across its buildings.
export function setBuildingAccent(root,material){root.traverse(o=>{if(o.isMesh&&(o.name==='accent'||o.name==='tower_flag_accent'))o.material=material;});}

// Optional low annexes: two merged meshes, shared across copies of each type.
const annexTemplates=new Map();
function createAnnexes(kind){
 if(annexTemplates.has(kind))return annexTemplates.get(kind).clone(true);
 const root=new T.Group();root.name='vacant_annexes';let b=batch('annex_body'),a=batch('accent',MAT_ACCENT);const counters={};
 function part(type,build){
  const oldB=b,oldA=a;b=batch('annex_body');a=batch('accent',MAT_ACCENT);build();
  const g=new T.Group();g.name=type+'_'+(counters[type]=(counters[type]||0)+1);
  for(const m of [b.done(),a.done()]){if(m.geometry.attributes.position.count)g.add(m);else m.geometry.dispose();}
  const bounds=new T.Box3().setFromObject(g),center=bounds.getCenter(new T.Vector3());center.y=0;
  for(const m of g.children)m.geometry.translate(-center.x,0,-center.z);
  g.position.copy(center);g.userData={accessory:true,type,home:[center.x,center.z],size:[bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z]};root.add(g);b=oldB;a=oldA;
 }
 const house=(...args)=>part('house',()=>rawHouse(...args));
 const tree=(...args)=>part('tree',()=>rawTree(...args));
 const hedge=(...args)=>part('shrub',()=>rawHedge(...args));
 const wall=(...args)=>part('wall',()=>rawWall(...args));
 function rawHouse(x0,x1,z0,z1,h,roof='hip'){
  b.box(x0,x1,z0,z1,-.20,h,C.wall,.025);
  b.box(x0-.012,x1+.012,z0-.012,z1+.012,.02,.10,C.dark,.018);
  b.box(x0-.018,x1+.018,z0-.018,z1+.018,h-.055,h,C.light,.018);
  cityRoof(b,a,x0,x1,z0,z1,h,roof==='hip');
  const mid=(x0+x1)/2;panel(b,mid-.07,mid+.07,.1,Math.min(.32,h-.07),z1+.002,C.window);
  for(const x of [x0-.002,x1+.002]){const v=[[x,.17,z0+.09],[x,.17,z1-.09],[x,h-.10,z1-.09],[x,h-.10,z0+.09]];b.quad(...(x<x0?v.reverse():v),C.window);}
 }
 function rawTree(x,z,h=.53,r=.13){
  b.box(x-.025,x+.025,z-.025,z+.025,-.2,.16,0x66523a);
  const levels=[[.12,r*.7],[h*.48,r],[h*.82,r*.72],[h,r*.22]];
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<6;i++){
   const point=(level,k)=>{const [y,rad]=levels[level],t=k*Math.PI/3;return [x+rad*Math.cos(t),y,z+rad*Math.sin(t)];};
   b.quad(point(j,i),point(j+1,i),point(j+1,i+1),point(j,i+1),[0x527c35,0x6a913e,0x779e44][i%3]);
  }
  for(let i=0;i<6;i++){const t=i*Math.PI/3,u=(i+1)*Math.PI/3;b.tri([x,h+.025,z],[x+r*.22*Math.cos(u),h,z+r*.22*Math.sin(u)],[x+r*.22*Math.cos(t),h,z+r*.22*Math.sin(t)],0x779e44);}
 }
 function rawHedge(x,z,w=.20){b.box(x-w/2,x+w/2,z-.065,z+.065,-.05,.15,0x567c35,.035);}
 function rawWall(x0,x1,z0,z1){b.box(x0,x1,z0,z1,-.08,.19,C.wall,.015);b.box(x0-.008,x1+.008,z0-.008,z1+.008,.19,.23,C.light,.015);}
 if(kind==='bld_hq'){
  // Courtyard furnishings only: the wings belong to the main building.
  part('steps',()=>{b.box(-.43,.43,.04,.33,-.01,.045,C.dark,.025);
  b.box(-.40,.40,.04,.24,.045,.09,C.wall,.025);
  b.box(-.37,.37,.04,.15,.09,.135,C.light,.02);});
  wall(-.92,-.84,.43,.85);wall(-.84,-.48,.77,.85);
  wall(.84,.92,.43,.85);wall(.48,.84,.77,.85);
  tree(-.70,.38,.51,.115);tree(.70,.38,.51,.115);hedge(-.58,.68);hedge(.58,.68);
 }else if(kind==='bld_city_large'){
  // Two offset foreground blocks, central street retained.
  house(-.77,-.26,-.03,.54,.57);house(.26,.77,.12,.69,.50,'flat');
  tree(-.83,.70,.55,.105);tree(.83,-.02,.52,.105);hedge(-.12,.73);hedge(.12,.73);
 }else if(kind==='bld_city_small'){
  // The two existing houses remain the whole settlement, landscaping only.
  tree(-.70,-.12,.51,.12);tree(.70,.02,.48,.12);hedge(-.35,.30);hedge(.40,.40);
 }else{
  // Blueprint planting: broad faceted crowns, exposed trunks, staggered side groups.
  const factoryTree=(...args)=>part('tree',()=>rawFactoryTree(...args));
  const shrub=(...args)=>part('shrub',()=>rawShrub(...args));
  function rawFactoryTree(x,z,h,r){
   b.box(x-.033,x+.033,z-.033,z+.033,-.20,.25,0x63503a,.008);
   const rings=[[.20,r*.63],[.30,r],[h*.76,r*.86],[h,r*.34]];
   const point=(j,i)=>{const [y,rad]=rings[j],t=i*Math.PI/3+.2;return [x+rad*Math.cos(t),y,z+rad*.88*Math.sin(t)];};
   for(let j=0;j<3;j++)for(let i=0;i<6;i++)b.quad(point(j,i),point(j+1,i),point(j+1,i+1),point(j,i+1),[0x45682f,0x587d35,0x709343,0x63873b,0x4d7031,0x3f602c][i]);
   for(let i=0;i<6;i++)b.tri([x,h+.025,z],point(3,i+1),point(3,i),0x6c8e40);
  }
  function rawShrub(x,z,r,h,color){
   const at=(i,y,k)=>[x+r*k*Math.cos(i*Math.PI/3),y,z+r*.8*k*Math.sin(i*Math.PI/3)];
   for(let i=0;i<6;i++){b.quad(at(i,-.08,.7),at(i,h*.65,1),at(i+1,h*.65,1),at(i+1,-.08,.7),color);b.tri(at(i,h*.65,1),[x,h,z],at(i+1,h*.65,1),color);}
  }
  factoryTree(-.855,.04,.64,.14);factoryTree(.855,-.48,.59,.135);
  shrub(-.86,.25,.085,.14,0x4f7431);shrub(-.90,.15,.065,.10,0x64873a);
  shrub(.86,-.28,.08,.13,0x537934);shrub(.90,-.37,.06,.095,0x688a3f);
 }
 b.done().geometry.dispose();a.done().geometry.dispose();annexTemplates.set(kind,root);return root.clone(true);
}

// Visual-only wrapper: tile coordinates belong to the caller. Never animate game state.
export function createBuildingDisplay(name){
 if(!BUILDINGS[name])throw new Error('Unknown building: '+name);
 const root=new T.Group();root.name=name+'_display';const facing=new T.Group();facing.name='view_facing';
 const building=BUILDINGS[name].create();building.name='building';const anchor=new T.Group();anchor.name='unit_anchor';
 facing.add(building,anchor,createAnnexes(name));root.add(facing);root.userData.buildingType=name;
 setBuildingDisplayState(root,{occupied:false,viewQuarter:0});return root;
}
export function setBuildingDisplayState(display,{occupied=false,viewQuarter=0,unitFootprint=[.50,.50]}={}){
 const facing=display.getObjectByName('view_facing'),building=facing.getObjectByName('building'),anchor=facing.getObjectByName('unit_anchor');
 const q=((Math.round(viewQuarter)%4)+4)%4;facing.rotation.y=q*Math.PI/2;
 const deep=['bld_hq','bld_factory'].includes(display.userData.buildingType);building.scale.x=!occupied&&display.userData.buildingType==='bld_factory'?.80:1;building.scale.z=!occupied&&deep?1.5:1;building.position.z=occupied?0:display.userData.buildingType==='bld_factory'?.85:deep?.45:(display.userData.buildingType==='bld_city_small'?.30:.16);facing.getObjectByName('vacant_annexes').visible=true;anchor.position.set(0,0,occupied?.45:0);anchor.visible=occupied;
 const key=JSON.stringify([occupied,...unitFootprint]);
 display.userData.occupied=occupied;display.userData.viewQuarter=q;
 if(display.userData.accessoryLayoutKey!==key){display.userData.accessoryLayoutKey=key;layoutBuildingAccessories(display,unitFootprint);}
 return anchor; // World position via getWorldPosition after updateMatrixWorld.
}

// All coordinates are local to view_facing; callers may reparent cloned parts freely.
export function getBuildingAccessories(display){return display.getObjectByName('vacant_annexes').children;}
export function createBuildingAccessory(kind,id){const source=createAnnexes(kind).getObjectByName(id);if(!source)throw new Error('Unknown accessory: '+id);const part=source.clone(true);part.position.set(0,0,0);return part;}
export function setBuildingAccessory(display,id,{x,z,rotation,visible}={}){
 const p=getBuildingAccessories(display).find(p=>p.name===id);if(!p)throw new Error('Unknown accessory: '+id);
 const mode=display.userData.occupied?'occupied':'vacant',all=display.userData.accessoryOverrides??={};const saved=(all[mode]??={})[id]??={};
 for(const [k,v] of Object.entries({x,z,rotation,visible}))if(v!==undefined)saved[k]=v;
 if(x!==undefined)p.position.x=x;if(z!==undefined)p.position.z=z;if(rotation!==undefined)p.rotation.y=rotation;if(visible!==undefined)p.visible=visible;return p;
}
export function resetBuildingAccessories(display){display.userData.accessoryOverrides={};delete display.userData.accessoryLayoutKey;}
function layoutBuildingAccessories(display,footprint){
 const occupied=display.userData.occupied,parts=getBuildingAccessories(display),placed=[];
 const building=display.getObjectByName('building');building.updateMatrix();
 // Compute bounds in the facing group's local space, independent of camera rotation.
 const box=new T.Box3();building.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();let m=new T.Matrix4();let n=o;while(n!==building.parent){n.updateMatrix();m.premultiply(n.matrix);n=n.parent;}box.union(o.geometry.boundingBox.clone().applyMatrix4(m));}});
 const blocked=occupied?[[box.min.x,box.min.z,box.max.x,box.max.z],[-footprint[0]/2-.04,.45-footprint[1]/2-.04,footprint[0]/2+.04,.45+footprint[1]/2+.04]]:[];
 const overlap=(a,b)=>a[0]<b[2]+.015&&a[2]>b[0]-.015&&a[1]<b[3]+.015&&a[3]>b[1]-.015;
 for(const p of parts){
  p.position.set(p.userData.home[0],0,p.userData.home[1]);p.rotation.y=0;p.visible=true;
  if(occupied){
   const candidates=[];for(const rotation of [0,Math.PI/2]){const [w,d]=rotation?[...p.userData.size].reverse():p.userData.size;for(let x=-1+w/2+.01;x<=1-w/2-.009;x+=.08)for(let z=-1+d/2+.01;z<=1-d/2-.009;z+=.08)candidates.push({x,z,rotation,w,d,cost:(x-p.position.x)**2+(z-p.position.z)**2+(rotation?.015:0)});}
   candidates.sort((a,b)=>a.cost-b.cost);const c=candidates.find(c=>![...blocked,...placed].some(b=>overlap([c.x-c.w/2,c.z-c.d/2,c.x+c.w/2,c.z+c.d/2],b)));
   p.visible=!!c;if(c){p.position.set(c.x,0,c.z);p.rotation.y=c.rotation;placed.push([c.x-c.w/2,c.z-c.d/2,c.x+c.w/2,c.z+c.d/2]);}
  }
  const override=display.userData.accessoryOverrides?.[occupied?'occupied':'vacant']?.[p.name];if(override){if(override.x!==undefined)p.position.x=override.x;if(override.z!==undefined)p.position.z=override.z;if(override.rotation!==undefined)p.rotation.y=override.rotation;if(override.visible!==undefined)p.visible=override.visible;}
 }
}

// Shared modeling primitives for the airport/dock extension; existing factories unchanged.
export {batch,C,hip,panel};
