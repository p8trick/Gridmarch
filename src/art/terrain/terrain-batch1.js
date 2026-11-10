import * as T from 'three';
import {PALETTE as P,MAT_TERRAIN} from 'palette';
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};}
function build(name,seed=1){const positions=[],colors=[],random=rng(seed);return {tri(a,b,c,color,variation=.05){positions.push(...a,...b,...c);const v=new T.Color(color).multiplyScalar(1+(random()-.5)*variation);for(let k=0;k<3;k++)colors.push(v.r,v.g,v.b);},done(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const m=new T.Mesh(g,MAT_TERRAIN);m.name=name;m.castShadow=true;m.receiveShadow=true;const out=new T.Group();out.name=name;out.add(m);return out;}};}
// Intersection of sloped half-spaces. Every exposed rock facet has a measured
// 44–53 degree inclination; the lower cut extends to -0.2, without a base plate.
function rock(b,h,variant,seed,ox=0,oz=0,color=P.rock){
 const random=rng(seed),a=new T.Vector2(-h*.14,h*.15),c=variant%2?new T.Vector2(h*.17,-h*.08):new T.Vector2(h*.03,-h*.25);
 const axis=c.clone().sub(a).normalize(),angles=Array.from({length:8},(_,i)=>i*Math.PI/4+(random()-.5)*.12);
 const perpendicular=Math.atan2(-axis.x,axis.y);angles.push(perpendicular,perpendicular+Math.PI);
 const planes=angles.map((angle,i)=>{const nx=Math.cos(angle),nz=Math.sin(angle),tan=Math.tan((44+(i*3+variant*5)%10)*Math.PI/180);return {n:new T.Vector3(nx*tan,1,nz*tan),d:h+tan*Math.max(nx*a.x+nz*a.y,nx*c.x+nz*c.y)};});
 planes.push({n:new T.Vector3(0,-1,0),d:.2});const pts=[];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const A=planes[i],B=planes[j],C=planes[k],cross=new T.Vector3().crossVectors(B.n,C.n),det=A.n.dot(cross);if(Math.abs(det)<1e-8)continue;
  const v=cross.multiplyScalar(A.d).add(new T.Vector3().crossVectors(C.n,A.n).multiplyScalar(B.d)).add(new T.Vector3().crossVectors(A.n,B.n).multiplyScalar(C.d)).divideScalar(det);
  if(planes.every(p=>p.n.dot(v)<=p.d+1e-7)&&!pts.some(p=>p.distanceTo(v)<1e-6))pts.push(v);
 }
 for(const plane of planes.slice(0,-1)){
  const face=pts.filter(v=>Math.abs(plane.n.dot(v)-plane.d)<1e-6);if(face.length<3)continue;
  const center=face.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(face.length),normal=plane.n.clone().normalize();
  const u=face[0].clone().sub(center).normalize(),v=new T.Vector3().crossVectors(normal,u);
  face.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));
  const shade=.72+.28*Math.max(0,normal.dot(new T.Vector3(-.5,.55,.65).normalize())),hex=new T.Color(color).multiplyScalar(shade);
  const p=face.map(v=>[v.x+ox,v.y,v.z+oz]);for(let i=1;i<p.length-1;i++)b.tri(p[0],p[i],p[i+1],hex,.07);
 }
}
export function createPeakSmall(variant=0,seed=1){const b=build('mtn_peak_s',seed);rock(b,1,variant,seed);return b.done();}
export function createPeakMedium(variant=0,seed=1){const b=build('mtn_peak_m',seed);rock(b,1.6,variant,seed);return b.done();}
export function createPeakLarge(variant=0,seed=1){const b=build('mtn_peak_l',seed);rock(b,2,variant,seed);return b.done();}
// variant = sizeIndex*2 + shapeIndex: three sizes × two shapes.
export function createMtnRock(variant=0,seed=1){const b=build('mtn_rock',seed);rock(b,[.3,.55,.8][Math.floor(variant/2)%3],variant%2,seed);return b.done();}
export function createPebble(variant=0,seed=1){const b=build('pebble',seed);rock(b,[.08,.11,.15][variant%3],variant,seed,0,0,0x8d8b80);return b.done();}
export function createMtnScree(variant=0,seed=1){const b=build('mtn_scree',seed);for(let i=0;i<4+variant%2;i++){const a=i*2.4+variant*.6,r=.16+i*.095;rock(b,.07+(i%3)*.035,i%2,seed+i*17,Math.cos(a)*r,Math.sin(a)*r,0x89858d);}return b.done();}
function lump(b,x,z,h,r,color,seed){const random=rng(seed),n=7,levels=[[-.2,r*.58],[h*.16,r],[h*.65,r*.85],[h,.08]];let rings=levels.map(([y,rad])=>Array.from({length:n},(_,i)=>{let a=i*Math.PI*2/n;return [x+Math.cos(a)*rad*(.94+random()*.12),y,z+Math.sin(a)*rad*(.94+random()*.12)];}));for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){let k=(i+1)%n;b.tri(rings[j][i],rings[j+1][i],rings[j][k],color,.12);b.tri(rings[j][k],rings[j+1][i],rings[j+1][k],color,.12);}for(let i=0;i<n;i++)b.tri([x,h,z],rings.at(-1)[(i+1)%n],rings.at(-1)[i],color);}
export function createBush(variant=0,seed=1){const b=build('bush',seed);lump(b,-.13,0,.34,.25,0x618b43,seed);lump(b,.17,.07,variant%2?.4:.28,.22,0x6d974b,seed+4);return b.done();}
export function createGrassTuft(variant=0,seed=1){const b=build('grass_tuft',seed),random=rng(seed);for(let i=0;i<5+variant%2;i++){const a=i*2.4,w=.065+random()*.02,x=Math.cos(a)*.09,z=Math.sin(a)*.09,h=.19+random()*.05,tip=[x+Math.cos(a)*.08,h,z+Math.sin(a)*.08],l=[x-w,-.2,z],r=[x+w,-.2,z],back=[x,-.2,z+.025];b.tri(l,tip,r,0x7d9d4b);b.tri(r,tip,back,0x688d41);b.tri(back,tip,l,0x8ba852);}return b.done();}
function polygon(b,points,y,color){const contour=points.map(p=>new T.Vector2(...p));for(const face of T.ShapeUtils.triangulateShape(contour,[])){const p=face.map(i=>[points[i][0],y,points[i][1]]);if(new T.Vector3().subVectors(new T.Vector3(...p[1]),new T.Vector3(...p[0])).cross(new T.Vector3().subVectors(new T.Vector3(...p[2]),new T.Vector3(...p[0]))).y<0)[p[1],p[2]]=[p[2],p[1]];b.tri(...p,color,0);}}
function outline(kind,w){const c=.12;
 if(kind==='bend')return [[-w,1],[w,1],[w,w+c],[w+c,w],[1,w],[1,-w],[-w+.20,-w],[-w,-w+.20]];
 if(kind==='t')return [[-1,-w],[1,-w],[1,w],[w+c,w],[w,w+c],[w,1],[-w,1],[-w,w+c],[-w-c,w],[-1,w]];
 if(kind==='cross')return [[-w,-1],[w,-1],[w,-w-c],[w+c,-w],[1,-w],[1,w],[w+c,w],[w,w+c],[w,1],[-w,1],[-w,w+c],[-w-c,w],[-1,w],[-1,-w],[-w-c,-w],[-w,-w-c]];
 return [[-w,1],[w,1],[w,-w+.11],[w-.22,-w-.14],[-w+.22,-w-.14],[-w,-w+.11]];
}
const connections={bend:['S','E'],t:['W','E','S'],cross:['N','E','S','W'],end:['S']};
// R1: centre guidance is part of the same mesh, above the asphalt at y=.035.
function road(kind){
 const b=build('road_'+kind);
 polygon(b,outline(kind,.66),.025,P.curb);polygon(b,outline(kind,.56),.03,P.road);
 for(const port of connections[kind]){
  const vertical=port==='N'||port==='S',sign=port==='N'||port==='W'?-1:1;
  for(const [start,end] of [[.75,1],[.25,.50]]){
   if(kind!=='end'&&start<.5)continue;
   const lo=start*sign,hi=end*sign;
   polygon(b,vertical?[[-.025,lo],[.025,lo],[.025,hi],[-.025,hi]]:[[lo,-.025],[hi,-.025],[hi,.025],[lo,.025]],.035,P.mark);
  }
 }
 const stripe=(x0,x1,z0,z1)=>polygon(b,[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],.035,P.mark);
 if(kind==='cross'){
  // Three touching rectangles form one cross without coplanar overlap.
  stripe(-.50,.50,-.025,.025);stripe(-.025,.025,-.50,-.025);stripe(-.025,.025,.025,.50);
 }else if(kind==='t'){
  stripe(-.50,.50,-.025,.025);stripe(-.025,.025,.025,.50);
 }else if(kind==='bend'){
  const outer=[],inner=[];
  for(let i=0;i<=6;i++){const a=Math.PI+i*Math.PI/12;outer.push([.5+Math.cos(a)*.525,.5+Math.sin(a)*.525]);inner.push([.5+Math.cos(a)*.475,.5+Math.sin(a)*.475]);}
  polygon(b,[...outer,...inner.reverse()],.035,P.mark);
 }
 const out=b.done();out.userData={connect:connections[kind],roadWidth:1.12,curbWidth:1.32,roadY:.03,markingsVersion:'R1'};return out;
}
export function createRoadBend(){return road('bend');}
export function createRoadT(){return road('t');}
export function createRoadCross(){return road('cross');}
export function createRoadEnd(){return road('end');}
const prop=(create,variants,height)=>({create,variants,height,embedDepth:.2,role:'prop'});
const overlay=(create,connect)=>({create,variants:1,connect,role:'overlay',roadWidth:1.12,curbWidth:1.32});
export const BATCH1_PARTS={bush:prop(createBush,2,.4),grass_tuft:prop(createGrassTuft,2,.25),pebble:prop(createPebble,3,.15),road_bend:overlay(createRoadBend,['S','E']),road_t:overlay(createRoadT,['W','E','S']),road_cross:overlay(createRoadCross,['N','E','S','W']),road_end:overlay(createRoadEnd,['S']),mtn_peak_s:prop(createPeakSmall,2,1),mtn_peak_m:prop(createPeakMedium,2,1.6),mtn_peak_l:prop(createPeakLarge,2,2),mtn_rock:prop(createMtnRock,6,.8),mtn_scree:prop(createMtnScree,2,.15)};
