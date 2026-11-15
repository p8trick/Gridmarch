import * as T from 'three';
import {MAT_TERRAIN,PALETTE} from 'palette';

// Dimensions come from terrain_batch1_v0_4 createRoadStraight, rather than
// the suggested blueprint road width. All bridge components stay in 2x2.
export const BRIDGE_SPEC=Object.freeze({version:'V1.1-final-P1',cellSize:2,landY:0,waterY:-.30,roadY:.03,roadWidth:1.12,curbWidth:1.32,deckWidth:1.46,riverDeckY:.08,seaDeckY:.16});
export const BRIDGE_RULES=Object.freeze({terrain:'bridge',overlay:true,landUnits:true,navalUnits:false,navalPassUnder:false,airUnits:'inherit-game-rules',stationDiscValidated:false,pathfindingIntegrated:false});
const C={concrete:0xb9b9b0,cap:0xdbd9cc,base:0x999c96,steel:0xc8cbc8,asphalt:PALETTE.road,white:PALETTE.mark,joint:0x4b5254,hazard:0xd9b255};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// A small solid-geometry builder. Flat normals and face colours are retained;
// surfaces belonging to one structural role are already collected together.
class Builder{
 constructor(){this.rows=new Map();}
 tri(role,a,b,c,hex,normal){
  const u=new T.Vector3().fromArray(b).sub(new T.Vector3().fromArray(a)),v=new T.Vector3().fromArray(c).sub(new T.Vector3().fromArray(a)),n=u.cross(v);
  if(n.lengthSq()<1e-20)return;
  if(normal&&n.dot(new T.Vector3(...normal))<0)[b,c]=[c,b];
  const row=this.rows.get(role)||{p:[],c:[]};this.rows.set(role,row);
  const color=new T.Color(hex);for(const p of [a,b,c]){row.p.push(...p);row.c.push(color.r,color.g,color.b);}
 }
 quad(role,a,b,c,d,hex,normal){this.tri(role,a,b,c,hex,normal);this.tri(role,a,c,d,hex,normal);}
 box(role,x0,x1,y0,y1,z0,z1,hex){
  this.prism(role,x0,x1,[[z0,y0],[z1,y0],[z1,y1],[z0,y1]],hex);
 }
 prism(role,x0,x1,profile,hex,offset=()=>0){
  const color=new T.Color(hex),shade=k=>color.clone().multiplyScalar(k),n=profile.length;
  const v=(x,i)=>[x,profile[i][1]+offset(x),profile[i][0]];
  // CCW profile in (z,y) gives outward side normals with this winding.
  const center=profile.reduce((s,p)=>[s[0]+p[0]/n,s[1]+p[1]/n],[0,0]);
  for(let i=0;i<n;i++){
   const j=(i+1)%n,dz=profile[j][0]-profile[i][0],dy=profile[j][1]-profile[i][1];
   const norm=[0,-dz,dy],bright=dz<0?1.02:dz>0?.86:.95;
   this.quad(role,v(x0,i),v(x1,i),v(x1,j),v(x0,j),shade(bright),norm);
   this.tri(role,[x0,center[1]+offset(x0),center[0]],v(x0,i),v(x0,j),shade(.96),[-1,0,0]);
   this.tri(role,[x1,center[1]+offset(x1),center[0]],v(x1,i),v(x1,j),shade(.96),[1,0,0]);
  }
 }
 bevel(role,x0,x1,y0,y1,z0,z1,hex,b=.009,offset=()=>0){
  b=Math.min(b,(y1-y0)/3,(z1-z0)/3);
  this.prism(role,x0,x1,[[z0+b,y0],[z1-b,y0],[z1,y0+b],[z1,y1-b],[z1-b,y1],[z0+b,y1],[z0,y1-b],[z0,y0+b]],hex,offset);
 }
 top(role,x0,x1,z0,z1,y,hex){const at=typeof y==='function'?y:()=>y;this.quad(role,[x0,at(x0),z0],[x1,at(x1),z0],[x1,at(x1),z1],[x0,at(x0),z1],hex,[0,1,0]);}
 finish(name){
  const group=new T.Group();group.name=name;
  for(const [role,row] of this.rows){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(row.p,3));g.setAttribute('color',new T.Float32BufferAttribute(row.c,3));g.computeVertexNormals();const m=new T.Mesh(g,MAT_TERRAIN);m.name=role;m.castShadow=true;m.receiveShadow=true;group.add(m);}
  return group;
 }
}

function roadMarks(b,x0,x1,height,{hazardEnds=[],phase=0,hazardOffset=.05}={}){
 const y=x=>height(x)+.002;
 // Keep the exact .5 dash period and .05 width of the existing road.
 for(let k=Math.floor((x0+.8-phase)/.5)-1;k<Math.ceil((x1+.8-phase)/.5)+1;k++){
  const a=Math.max(x0,-.8+k*.5+phase),c=Math.min(x1,-.55+k*.5+phase);if(c>a+1e-6)b.top('markings',a,c,-.025,.025,y,C.white);
 }
 for(const z of [-.515,.515])b.top('markings',x0,x1,z-.009,z+.009,y,C.white);
 for(const x of hazardEnds){
  // Edge warning patches leave the driving surface uncluttered.
  const yh=t=>height(t)+hazardOffset;
  for(const side of [-1,1]){const z=side*.610;b.top('markings',x-.055,x+.055,z-.043,z+.043,yh,C.joint);for(let i=0;i<3;i++)b.top('markings',x-.05+i*.035,x-.031+i*.035,z-.043,z+.043,t=>yh(t)+.001,C.hazard);}
 }
}

function solidParapet(b,x0,x1,z,height,{joinStart=false,joinEnd=false}={}){
 b.bevel('concrete',x0,x1,height+.035,height+.158,z-.038,z+.038,C.concrete,.008);
 b.bevel('concrete',joinStart?x0:x0-.008,joinEnd?x1:x1+.008,height+.153,height+.178,z-.047,z+.047,C.cap,.006);
 for(const [joined,side] of [[joinStart,-1],[joinEnd,1]]){
  if(joined){const a=side<0?-1:.94,c=side<0?-.94:1;b.bevel('concrete',a,c,height+.016,height+.205,z-.055,z+.055,C.concrete,.008);b.box('concrete',a,c,height+.199,height+.218,z-.059,z+.059,C.cap);}
  else{const x=side<0?x0+.05:x1-.05;b.bevel('concrete',x-.056,x+.056,height+.016,height+.205,z-.055,z+.055,C.concrete,.008);b.box('concrete',x-.060,x+.060,height+.199,height+.218,z-.059,z+.059,C.cap);}
 }
}

function openRail(b,x0,x1,z,height,{posts=true}={}){
 const offset=x=>height(x);
 b.bevel('railings',x0,x1,.174,.203,z-.031,z+.031,C.steel,.005,offset);
 b.bevel('railings',x0,x1,.084,.108,z-.023,z+.023,C.steel,.003,offset);
 if(posts){
  const count=Math.max(1,Math.round((x1-x0)/.62));
  for(let i=0;i<=count;i++){
   const x=x0+.048+(x1-x0-.096)*i/count,y=height(x);
   b.box('railings',x-.025,x+.025,y+.041,y+.203,z-.025,z+.025,C.concrete);
   b.box('railings',x-.037,x+.037,y+.040,y+.062,z-.040,z+.040,C.base);
  }
 }
}

function deck(b,x0,x1,height,{rail='open',hazardEnds=[],joinStart=false,joinEnd=false}={}){
 b.bevel('concrete',x0,x1,-.132,-.012,-.73,.73,C.concrete,.012,height);
 b.bevel('asphalt',x0,x1,-.012,0,-.56,.56,C.asphalt,.002,height);
 for(const s of [-1,1]){
  b.bevel('concrete',x0,x1,0,.048,s>0?.56:-.67,s>0?.67:-.56,C.cap,.006,height);
  if(rail==='solid')solidParapet(b,joinStart?x0:x0+.025,joinEnd?x1:x1-.025,s*.674,height((x0+x1)/2),{joinStart,joinEnd});
  if(rail==='open')openRail(b,x0+.003,x1-.003,s*.647,height);
 }
 roadMarks(b,x0,x1,height,{hazardEnds});
}

export function createRiverBridge({cell=[0,0],rotation=0,joinStart=false,joinEnd=false}={}){
 validatePlacement(cell,rotation);const b=new Builder(),h=BRIDGE_SPEC.riverDeckY;
 if(typeof joinStart!=='boolean'||typeof joinEnd!=='boolean')throw Error('river join flags must be boolean');
 deck(b,joinStart?-1:-.83,joinEnd?1:.83,()=>h,{rail:'solid',joinStart,joinEnd});
 for(const s of [-1,1]){
  if(s<0?joinStart:joinEnd){
   halfPier(b,s,h);const x=s*.989;b.top('details',x-.008,x+.008,-.558,.558,h+.001,C.joint);continue;
  }
  // Both solid abutments sit on the R6.1 banks, outside its water opening.
  const lo=s<0?-.95:.74,hi=s<0?-.74:.95;
  b.bevel('supports',lo,hi,-.44,-.045,-.69,.69,C.base,.014);
  b.box('supports',lo-.007,hi+.007,-.095,-.04,-.71,.71,C.concrete);
  const a=s<0?-1:.83,c=s<0?-.83:1;
  const height=x=>h+(BRIDGE_SPEC.roadY-h)*clamp((Math.abs(x)-.83)/.17,0,1);
  b.prism('asphalt',a,c,[[-.56,-.028],[.56,-.028],[.56,0],[-.56,0]],C.asphalt,height);
  for(const z of [-1,1])b.bevel('concrete',a,c,-.032,.012,z<0?-.66:.56,z<0?-.56:.66,C.cap,.004,height);
  roadMarks(b,a,c,height,{hazardEnds:[s*.932],hazardOffset:.014});
  // Thin bearing seam, visible from the side without blackening the face.
  b.box('details',s*.813-.018,s*.813+.018,-.054,-.043,-.58,.58,C.joint);
 }
 const g=b.finish('bridge_river_A');place(g,cell,rotation);
 g.userData={version:BRIDGE_SPEC.version,type:'A',cell:[...cell],rotation,joinStart,joinEnd,deckY:h,roadWidth:1.12,localBounds:[-1,1,-.73,.73],ports:[{x:-1,y:joinStart?h:.03},{x:1,y:joinEnd?h:.03}],rules:BRIDGE_RULES};return g;
}

// Build a straight, contiguous run. Only its outer ends have ramps and bank
// abutments; every internal join has exactly one pier made of two half piers.
export function createRiverBridgeRun({cells=[[0,0]],rotation=0}={}){
 if(!Array.isArray(cells)||!cells.length)throw Error('river run requires nonempty cells');
 for(const cell of cells)validatePlacement(cell,rotation);
 const q=((rotation%4)+4)%4,[dx,dz]=[[1,0],[0,1],[-1,0],[0,-1]][q],at=c=>c[0]*dx+c[1]*dz,side=c=>-c[0]*dz+c[1]*dx;
 const ordered=cells.map(c=>[...c]).sort((a,b)=>at(a)-at(b));
 if(ordered.some((c,i)=>side(c)!==side(ordered[0])||(i&&at(c)!==at(ordered[i-1])+1)))throw Error('river bridge cells must form one contiguous straight run along rotation');
 const group=new T.Group();group.name='bridge_river_A_run';
 ordered.forEach((cell,i)=>group.add(createRiverBridge({cell,rotation:q,joinStart:i>0,joinEnd:i<ordered.length-1})));
 group.userData={version:BRIDGE_SPEC.version,type:'A-run',cells:ordered,rotation:q,deckY:BRIDGE_SPEC.riverDeckY,pierCount:ordered.length-1,abutmentCount:2,rules:BRIDGE_RULES};return group;
}

function halfPier(b,side,h){
 const x0=side<0?-1:.91,x1=side<0?-.91:1;
 // Half piers meet on a cell boundary. Adjacent tiles form a full pier,
 // without one tile extending its geometry into the next logical cell.
 b.bevel('supports',side<0?-1:.82,side<0?-.82:1,-.67,-.55,-.52,.52,C.base,.012);
 b.bevel('supports',x0,x1,-.55,h-.18,-.41,.41,C.concrete,.007);
 b.box('supports',x0,x1,-.303,-.266,-.416,.416,C.base);
 b.bevel('supports',side<0?-1:.855,side<0?-.855:1,h-.20,h-.132,-.67,.67,C.cap,.008);
}

export function createSeaBridgeModule({cell=[0,0],rotation=0}={}){
 validatePlacement(cell,rotation);const b=new Builder(),h=BRIDGE_SPEC.seaDeckY;
 deck(b,-1,1,()=>h);
 for(const s of [-1,1])halfPier(b,s,h);
 // Small perimeter plates flank a joint; none cross a tile boundary.
 for(const s of [-1,1]){const x=s*.989;b.top('details',x-.008,x+.008,-.558,.558,h+.001,C.joint);}
 const g=b.finish('bridge_sea_B_span');place(g,cell,rotation);
 g.userData={version:BRIDGE_SPEC.version,type:'B-span',cell:[...cell],rotation,deckY:h,ports:[{x:-1,y:h},{x:1,y:h}],rules:BRIDGE_RULES};return g;
}

export function seaBridgeHeadHeight(x){
 // Starts on the existing road. The long, shallow ramp is confined to the
 // coast cell, and its seaward edge is level with every repeating span.
 return BRIDGE_SPEC.roadY+(BRIDGE_SPEC.seaDeckY-BRIDGE_SPEC.roadY)*clamp((x+.96)/1.4,0,1);
}

export function createSeaBridgeHead({cell=[0,0],rotation=0}={}){
 validatePlacement(cell,rotation);const b=new Builder(),h=seaBridgeHeadHeight;
 // The slope break at .44 is an actual vertex; do not span it with one quad.
 for(const [a,c] of [[-1,-.96],[-.96,.44],[.44,1]]){
  b.bevel('concrete',a,c,-.132,-.012,-.73,.73,C.concrete,.012,h);
  b.bevel('asphalt',a,c,-.012,0,-.56,.56,C.asphalt,.002,h);
  for(const s of [-1,1])b.bevel('concrete',a,c,0,.048,s<0?-.67:.56,s<0?-.56:.67,C.cap,.006,h);
  roadMarks(b,a,c,h,{hazardEnds:a===-1?[-.935]:[]});
 }
 // Retaining abutment is buried into the existing coast; no terrain is cut.
 b.bevel('supports',-.72,-.42,-.54,-.045,-.69,.69,C.base,.01);
 b.bevel('supports',-.74,-.40,-.06,.035,-.72,.72,C.concrete,.008);
 halfPier(b,1,BRIDGE_SPEC.seaDeckY);
 for(const s of [-1,1]){
  for(const [a,c] of [[-.70,.44],[.44,1]])openRail(b,a,c,s*.647,h);
  b.bevel('concrete',-.92,-.69,0,.14,s<0?-.694:.616,s<0?-.616:.694,C.concrete,.008,h);
 }
 const g=b.finish('bridge_sea_B_head');place(g,cell,rotation);
 g.userData={version:BRIDGE_SPEC.version,type:'B-head',cell:[...cell],rotation,ports:[{x:-1,y:.03},{x:1,y:.16}],rules:BRIDGE_RULES};return g;
}

// Height-only integration API for unit feet / movement animation. This reads the
// existing approved road surface equations; it creates no geometry, material or
// per-frame raycaster. Returns null when the point is outside the driving lane.
// Coordinates are WORLD X/Z, and the returned Y is the WORLD road-surface Y.
export function getBridgeSurfaceY(bridge,worldX,worldZ){
 if(!Number.isFinite(worldX)||!Number.isFinite(worldZ))throw Error('bridge surface query requires finite world X/Z');
 if(!bridge?.userData)return null;
 if(bridge.userData.type==='A-run'){
  for(const cellBridge of bridge.children){const y=getBridgeSurfaceY(cellBridge,worldX,worldZ);if(y!==null)return y;}
  return null;
 }
 const d=bridge.userData;
 if(!['A','B-span','B-head'].includes(d.type))return null;
 bridge.updateWorldMatrix(true,false);
 const origin=bridge.getWorldPosition(new T.Vector3());
 const p=bridge.worldToLocal(new T.Vector3(worldX,origin.y,worldZ));
 const eps=1e-6,halfRoad=BRIDGE_SPEC.roadWidth/2;
 if(Math.abs(p.x)>1+eps||Math.abs(p.z)>halfRoad+eps)return null;
 const x=clamp(p.x,-1,1);
 let y;
 if(d.type==='A'){
  const left=!d.joinStart&&x<-.83,right=!d.joinEnd&&x>.83;
  y=BRIDGE_SPEC.riverDeckY+(left||right?(BRIDGE_SPEC.roadY-BRIDGE_SPEC.riverDeckY)*clamp((Math.abs(x)-.83)/.17,0,1):0);
 }else if(d.type==='B-span')y=BRIDGE_SPEC.seaDeckY;
 else y=seaBridgeHeadHeight(x);
 return bridge.localToWorld(new T.Vector3(x,y,p.z)).y;
}

function validatePlacement(cell,rotation){if(!Array.isArray(cell)||cell.length!==2||!cell.every(Number.isSafeInteger)||!Number.isSafeInteger(rotation))throw Error('bridge requires integer cell and quarter-turn rotation');}
function place(g,cell,rotation){g.position.set(cell[0]*2,0,cell[1]*2);g.rotation.y=-rotation*Math.PI/2;}
export function disposeBridge(group){group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});group.clear();}
export function bridgeStats(group){let triangles=0,meshes=0,bytes=0;group.traverse(o=>{if(o.isMesh){meshes++;const g=o.geometry;triangles+=(g.index?.count||g.attributes.position.count)/3;bytes+=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength||0);}});return {triangles,meshes,bytes};}
