import * as T from 'three';
import {MAT_ACCENT} from 'palette';
import {batch,C,hip,panel} from './terrain-buildings.js';
const templates=new Map();
function component(root,name,x,z,build){
 const g=new T.Group();g.name=name;g.position.set(x,0,z);
 const b=batch('body'),a=batch('accent',MAT_ACCENT);build(b,a);
 for(const m of [b.done(),a.done()]){if(m.geometry.attributes.position.count)g.add(m);else m.geometry.dispose();}
 g.userData.independent=true;root.add(g);return g;
}
// Low-sided structural cylinders; vertices remain in the shared color batches.
function cylinder(b,x,z,r,y0,y1,col,n=8){
 for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,c=(i+1)*2*Math.PI/n;
  const p=[x+r*Math.cos(a),z+r*Math.sin(a)],q=[x+r*Math.cos(c),z+r*Math.sin(c)];
  b.quad([p[0],y0,p[1]],[p[0],y1,p[1]],[q[0],y1,q[1]],[q[0],y0,q[1]],col);
  b.tri([x,y1,z],[q[0],y1,q[1]],[p[0],y1,p[1]],col);
  b.tri([x,y0,z],[p[0],y0,p[1]],[q[0],y0,q[1]],col);
 }
}
function fender(b,x,z){
 // Faceted hollow rubber ring on the pier front; a visible opening, no texture.
 const y=-.025,ro=.067,ri=.033,d=.024,n=8;
 for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,c=(i+1)*2*Math.PI/n;
  const v=(r,t,zz)=>[x+r*Math.cos(t),y+r*Math.sin(t),zz];
  b.quad(v(ro,a,z+d),v(ro,c,z+d),v(ri,c,z+d),v(ri,a,z+d),C.window);
  b.quad(v(ro,c,z),v(ro,c,z+d),v(ro,a,z+d),v(ro,a,z),C.window);
  b.quad(v(ri,a,z),v(ri,a,z+d),v(ri,c,z+d),v(ri,c,z),C.roof);
 }
}
function warehouse(b,a,x0,x1,z0,z1,h){
 b.box(x0,x1,z0,z1,-.20,h,C.wall,.025);
 b.box(x0-.018,x1+.018,z0-.018,z1+.018,.015,.09,C.dark,.018);
 const mid=(x0+x1)/2,shoulder=.18,top=h+.25;
 b.profile([[x0,h-.04],[x1,h-.04],[x1-shoulder,top],[x0+shoulder,top]],z0,z1,C.light);
 a.profile([[x0-.025,h+.01],[x0+shoulder,top+.055],[x1-shoulder,top+.055],[x1+.025,h+.01],[x1+.025,h-.035],[x1-shoulder,top+.01],[x0+shoulder,top+.01],[x0-.025,h-.035]],z0-.025,z1+.025,C.accent);
 const door0=x0+.09,door1=x1-.09;
 panel(b,door0,door1,.085,h-.075,z1+.003,C.window);
 for(const x of [door0-.035,door1])b.box(x,x+.035,z1-.015,z1+.025,.085,h-.045,C.light,.008);
 b.box(door0-.035,door1+.035,z1-.015,z1+.025,h-.075,h-.035,C.light,.008);
 for(const x of [mid-.13,mid+.13])b.box(x,x+.012,z1+.004,z1+.01,.09,h-.08,C.roof);
 for(const x of [mid-.18,mid-.055,mid+.07])panel(b,x,x+.09,h+.035,h+.10,z1+.003,C.window);
 // Large roof panels and deeper eaves, readable from the tactical camera.
 for(const x of [x0+shoulder+.055,x1-shoulder-.055])a.box(x-.012,x+.012,z0-.012,z1+.012,top+.055,top+.075,C.accent);
 for(const x of [x0,x1-.045]){
  b.box(x,x+.045,z0-.012,z1+.012,h-.085,h-.035,C.light);
  b.box(x,x+.045,z0+.055,z0+.12,.10,h-.08,C.dark);
 }
 // Loading-door surround and a broad recessed rear service entrance.
 b.box(door0-.02,door1+.02,z1+.013,z1+.055,h-.025,h+.015,C.light,.008);
 panel(b,mid-.14,mid+.14,.09,.46,z0-.003,C.window,true);
 b.box(mid-.16,mid+.16,z0-.04,z0-.004,.46,.50,C.light);
 for(const x of [x0-.003,x1+.003]){
  const zc=(z0+z1)/2;
  for(const y of [.30,.36]){const v=[[x,y,zc-.14],[x,y,zc+.14],[x,y+.018,zc+.14],[x,y+.018,zc-.14]];b.quad(...(x<x0?v.reverse():v),C.light);}
 }
 // Broad roof ventilator, layered fascia and large structural pilasters.
 const zh=(z0+z1)/2;
 b.box(mid-.19,mid+.19,z0+.09,z1-.09,top+.055,top+.115,C.roof,.025);
 hip(a,mid-.21,mid+.21,z0+.07,z1-.07,top+.115,top+.18,C.accent,.04);
 for(const x of [x0+.018,x1-.065]){b.box(x,x+.047,z1-.035,z1+.033,.09,h-.015,C.light,.008);b.box(x-.012,x+.059,z1-.05,z1+.045,.09,.18,C.dark,.008);}
 for(const y of [.22,.36,.50])b.box(door0,door1,z1+.005,z1+.012,y,y+.012,C.roof);
 for(const x of [x0-.002,x1+.002]){const v=[[x,.25,z0+.13],[x,.25,z1-.13],[x,.42,z1-.13],[x,.42,z0+.13]];b.quad(...(x<x0?v.reverse():v),C.window);}
}
function buildAirport(){
 const root=new T.Group();root.name='bld_airport';
 component(root,'hangar',0,0,(b,a)=>warehouse(b,a,-.45,.91,-.90,-.22,.69));
 component(root,'control_tower',-.72,-.63,(b,a)=>{
  b.box(-.17,.17,-.17,.17,-.2,.91,C.wall,.025);
  b.box(-.19,.19,-.19,.19,.02,.13,C.dark,.025);
  b.box(-.18,.18,-.18,.18,.48,.54,C.light,.025);
  panel(b,-.075,.075,.19,.42,.171,C.window);
  b.box(-.205,.205,-.205,.205,.87,.91,C.light,.04);
  b.box(-.19,.19,-.19,.19,.82,.91,C.light,.025);
  b.box(-.22,.22,-.21,.21,.91,1.13,C.window,.055);
  for(const z of [-.20,.18])b.box(-.19,.19,z,z+.02,.92,1.13,C.light);
  for(const x of [-.20,.18])b.box(x,x+.02,-.19,.19,.92,1.13,C.light);
  a.box(-.235,.235,-.225,.225,1.13,1.19,C.accent,.055);
  hip(a,-.235,.235,-.225,.225,1.19,1.24,C.accent,.06);
  cylinder(b,0,0,.165,1.24,1.28,C.light);
  cylinder(a,0,0,.145,1.28,1.39,C.accent);
  cylinder(b,0,0,.11,1.39,1.405,C.roof);
  b.box(-.018,.018,-.015,.015,1.405,1.62,C.roof,.005);
  b.box(.075,.09,-.05,-.035,1.40,1.55,C.roof);
  for(const z of [-.172,.172])panel(b,-.07,.07,.61,.76,z,C.window,z<0);
  a.box(-.20,.20,-.20,.20,.77,.82,C.accent,.035);
  // Faceted balcony ledge and four stout corner posts frame the observation room.
  b.box(-.235,.235,-.225,.225,.85,.88,C.light,.055);
  for(const x of [-.185,.165])for(const z of [-.18,.16])b.box(x,x+.02,z,z+.02,.88,1.13,C.light);
  for(const x of [-.173,.173]){
   const v=[[x,.60,-.07],[x,.60,.07],[x,.75,.07],[x,.75,-.07]];b.quad(...(x<0?v.reverse():v),C.window);
  }
  b.box(-.12,-.10,.07,.09,1.23,1.37,C.roof);
 });
 component(root,'airport_service',-.72,-.32,(b,a)=>{
  b.box(-.19,.19,-.13,.13,-.20,.30,C.wall,.02);
  hip(a,-.20,.20,-.14,.14,.30,.38,C.accent,.04);
  for(const x of [-.13,.02])panel(b,x,x+.09,.12,.24,.131,C.window);
  b.box(-.20,.20,-.14,.14,.015,.06,C.dark,.015);
  b.box(-.21,.21,.13,.15,.27,.30,C.light);
  panel(b,-.065,.065,.06,.23,-.131,C.window,true);
  b.box(-.09,.09,-.16,-.13,.015,.055,C.light);
  b.box(.04,.13,-.07,.04,.35,.42,C.roof,.015);
 });
 const runway=new T.Group();runway.name='runway';runway.userData.independent=true;root.add(runway);
 component(runway,'runway_horizontal',0,0,b=>{
  // One continuous surface, including the former hangar connector.
  b.box(-.97,.97,-.17,.90,-.015,.012,0x787a72,.02);
  for(const z of [-.10,.83])b.box(-.90,.90,z-.01,z+.01,.013,.017,C.light);
  for(const x of [-.58,-.18,.22])b.box(x,x+.22,.35,.375,.013,.018,C.light);
  for(const x of [-.84,.75])for(const z of [.04,.23,.48,.67])b.box(x,x+.09,z-.035,z+.035,.013,.018,C.light);
 });
 const vertical=component(runway,'runway_vertical',0,.34,b=>{
  // Exact R1 apron geometry and markings, retained as an independent option.
  b.box(-.65,.87,-.51,.55,-.015,.012,0x787a72,.02);
  b.box(-.49,-.47,-.39,.39,.013,.016,C.light);
  b.box(.69,.71,-.39,.39,.013,.016,C.light);
  for(const z of [-.28,.0,.28])b.box(.10,.125,z,z+.15,.013,.017,C.light);
  for(const x of [-.42,-.29,.45,.58])b.box(x,x+.07,.40,.43,.013,.017,C.light);
 });vertical.visible=false;
 return root;
}
function buildDock(){
 const root=new T.Group();root.name='bld_dockyard';
 component(root,'warehouse',0,0,(b,a)=>warehouse(b,a,-.32,.91,-.91,-.34,.66));
 component(root,'harbor_control',.77,-.72,(b,a)=>{
  b.box(-.17,.17,-.20,.20,-.20,1.16,C.wall,.02);
  for(const z of [-.201,.201])panel(b,-.105,.105,1.0,1.10,z,C.window,z<0);
  for(const x of [-.171,.171]){const v=[[x,1.0,-.09],[x,1.0,.09],[x,1.10,.09],[x,1.10,-.09]];b.quad(...(x<0?v.reverse():v),C.window);}
  a.box(-.19,.19,-.22,.22,1.16,1.21,C.accent,.025);
  hip(a,-.19,.19,-.22,.22,1.21,1.27,C.accent,.035);
  b.box(-.08,-.055,-.06,-.035,1.24,1.51,C.roof);
  b.box(.05,.075,.02,.045,1.24,1.43,C.roof);
 });
 component(root,'quay_back',0,-.59,b=>{
  b.box(-.97,.97,-.38,.38,-.20,.045,C.dark,.025);
  b.box(-.97,.97,-.38,.38,.045,.085,C.wall,.025);
 });
 for(const side of [-1,1])component(root,side<0?'pier_left':'pier_right',side*.76,.35,b=>{
  b.box(-.21,.21,-.55,.59,-.20,.045,C.dark,.025);
  b.box(-.21,.21,-.55,.59,.045,.085,C.wall,.025);
  for(const z of [-.34,-.08,.18,.44])b.quad([-.185,.086,z],[.185,.086,z],[.185,.086,z-.012],[-.185,.086,z-.012],C.dark);
  b.box(side<0?-.21:.175,side<0?-.175:.21,-.52,.55,.085,.11,C.light,.006);
  b.box(-.19,.19,.55,.59,.085,.11,C.light,.006);
  });
 for(const side of [-1,1])component(root,side<0?'pier_fittings_left':'pier_fittings_right',side*.76,.35,b=>{
  for(const z of [-.25,.35]){cylinder(b,0,z,.045,.085,.18,C.roof,6);cylinder(b,0,z,.067,.18,.205,C.roof,6);}
  for(const z of [-.20,.39])b.box(side<0?.195:-.225,side<0?.225:-.195,z-.065,z+.065,-.11,.015,C.window,.01);
  for(const x of [-.095,.095])fender(b,x,.59);
 });
 component(root,'crane',-.71,-.49,(b,a)=>{
  b.box(-.17,.17,-.19,.19,.085,.20,C.dark,.025);
  for(const x of [-.12,.08])b.box(x,x+.04,-.11,.11,.20,.66,C.roof);
  cylinder(b,0,0,.15,.51,.58,C.dark);
  b.box(-.15,.15,-.15,.15,.55,.62,C.roof,.012);
  a.box(-.13,.13,-.23,-.16,.65,.80,C.accent,.015);
  b.box(-.10,.10,-.235,-.23,.67,.77,C.roof);
  a.box(-.18,.18,-.18,.18,.62,.90,C.accent,.025);
  panel(b,-.12,.12,.69,.85,.181,C.window);
  for(const x of [-.181,.181]){const v=[[x,.69,-.12],[x,.69,.12],[x,.84,.12],[x,.84,-.12]];b.quad(...(x<0?v.reverse():v),C.window);}
  a.box(-.20,.20,-.20,.20,.90,.95,C.accent,.025);
  b.box(-.11,.11,-.12,.12,.20,.25,C.roof,.018);
  b.profile([[-.12,.26],[-.08,.26],[.12,.54],[.08,.54]],-.10,-.06,C.roof);
  b.profile([[.08,.26],[.12,.26],[-.08,.54],[-.12,.54]],.06,.10,C.roof);
  // Open two-rail boom: diagonal beams stay inside the tile.
  // Build boom along local Z with mesh transforms, using the shared geometry builder.
  const boom=batch('accent',MAT_ACCENT);
  for(const x of [-.10,.10]){
   const dy=.53,dz=.72,L=Math.hypot(dy,dz),ny=-dz/L*.025,nz=dy/L*.025;
   boom.quad([x-.022,.86+ny,.02+nz],[x-.022,1.39+ny,.74+nz],[x+.022,1.39+ny,.74+nz],[x+.022,.86+ny,.02+nz],C.accent);
   boom.quad([x-.022,.86-ny,.02-nz],[x+.022,.86-ny,.02-nz],[x+.022,1.39-ny,.74-nz],[x-.022,1.39-ny,.74-nz],C.accent);
   for(const sign of [-1,1])boom.quad([x+sign*.022,.86+ny,.02+nz],[x+sign*.022,.86-ny,.02-nz],[x+sign*.022,1.39-ny,.74-nz],[x+sign*.022,1.39+ny,.74+nz],C.accent);
  }
  for(const t of [0,.5,1])boom.box(-.12,.12,.02+.72*t-.025,.02+.72*t+.025,.86+.53*t-.025,.86+.53*t+.025,C.accent);
  // Merge boom into this component's accent mesh after creation below.
  const m=boom.done();root.userData.boom=m;
  b.box(-.012,.012,.72,.74,.98,1.40,C.roof);
  b.box(-.055,.055,.69,.78,.90,1.02,0xbfa247,.012);
  b.box(-.07,.07,.695,.765,1.30,1.355,0xbfa247,.014);
  b.profile([[-.018,.90],[.018,.90],[.018,.86],[.07,.86],[.07,.885],[.09,.885],[.09,.835],[-.018,.835]],.72,.745,C.roof);
 });
 // Mooring details use the existing batches and shared materials.
 const crane=root.getObjectByName('crane'),boom=root.userData.boom;delete root.userData.boom;
 const accent=crane.getObjectByName('accent');const merged=new T.BufferGeometry();for(const key of ['position','normal','color']){const x=accent.geometry.attributes[key].array,y=boom.geometry.attributes[key].array,v=new Float32Array(x.length+y.length);v.set(x);v.set(y,x.length);merged.setAttribute(key,new T.BufferAttribute(v,3));}accent.geometry.dispose();boom.geometry.dispose();accent.geometry=merged;crane.rotation.y=.90;
 const berth=new T.Group();berth.name='berth_module';berth.userData.independent=true;root.add(berth);
 for(const name of ['quay_back','pier_left','pier_right','pier_fittings_left','pier_fittings_right'])berth.add(root.getObjectByName(name));
 component(berth,'land_platform',0,.40,b=>{
  b.box(-.5,.5,-.53,.53,-.035,.06,C.dark,.012);
  b.box(-.5,.5,-.53,.53,.06,.085,C.wall,.008);
  for(const z of [-.28,.0,.28])b.box(-.49,.49,z-.006,z+.006,.085,.087,C.dark);
 });
 setDockyardState(root);return root;
}
function shared(kind,build){if(!templates.has(kind))templates.set(kind,build());return templates.get(kind).clone(true);}
export const createAirport=()=>shared('airport',buildAirport);
export const createDockyard=()=>shared('dockyard',buildDock);
export const TRANSPORT_BUILDINGS={bld_airport:{create:createAirport,height:1.62,components:['hangar','control_tower','airport_service','runway']},bld_dockyard:{create:createDockyard,height:1.51,components:['harbor_control','warehouse','berth_module','quay_back','pier_left','pier_right','crane','land_platform']}};

export function setAirportRunway(root,{x=0,z=0,rotation=0,layout='horizontal'}={}){
 if(![x,z,rotation].every(Number.isFinite))throw new Error('Runway transform must be finite');
 if(!['horizontal','vertical'].includes(layout))throw new Error('Invalid runway layout');
 const runway=root.getObjectByName('runway');runway.getObjectByName('runway_horizontal').visible=layout==='horizontal';runway.getObjectByName('runway_vertical').visible=layout==='vertical';runway.userData.layout=layout;runway.position.set(x,0,z);runway.rotation.y=rotation;return runway;
}
export function setDockyardLayout(root,{waterWidth=root.userData.waterWidth??1.10,x,z,rotation}={}){
 if(!Number.isFinite(waterWidth)||[x,z,rotation].some(v=>v!==undefined&&!Number.isFinite(v)))throw new Error('Dockyard layout must be finite');
 const width=T.MathUtils.clamp(waterWidth,.70,1.40),berth=root.getObjectByName('berth_module');
 // Both piers are rigid .42-wide modules. Only position changes with spacing.
 for(const sign of [-1,1])for(const suffix of ['', '_fittings']){
  const p=root.getObjectByName('pier'+suffix+(sign<0?'_left':'_right'));
  p.position.x=sign*(width/2+.21);p.scale.set(1,1,1);
 }
 if(x!==undefined)berth.position.x=x;
 if(z!==undefined)berth.position.z=z;
 if(rotation!==undefined)berth.rotation.y=rotation;
 const deck=root.getObjectByName('land_platform');deck.scale.x=width-.12;
 root.userData.waterWidth=width;return berth;
}
export function setDockyardState(root,{waterWidth,landOccupied=root.userData.landOccupied??false}={}){
 if(waterWidth!==undefined||root.userData.waterWidth===undefined)setDockyardLayout(root,{waterWidth});
 const deck=root.getObjectByName('land_platform');deck.visible=!!landOccupied;
 root.userData.landOccupied=!!landOccupied;return deck;
}
