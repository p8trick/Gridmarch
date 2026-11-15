import * as T from 'three';
import {MAT_TERRAIN,PALETTE} from 'palette';
import {buildRockHillA,buildRockHillB} from './mountain-rockmass.js';

// One logical tile: 2 x 2 world units. Geometry has no ground plate.
// A2.6 removes the summit pebble; B1 shares the same refined rock-face pipeline.
export const MOUNTAIN_A2_SPEC=Object.freeze({version:'V2-A2.6',type:'A',state:'natural',cellSize:2,bodyHeight:.55,peakHeight:.82,orientations:4});
export const MOUNTAIN_B_SPEC=Object.freeze({...MOUNTAIN_A2_SPEC,version:'V2-B1',type:'B'});
const GRASS_DARK=new T.Color(0x7fac48),GRASS_LIGHT=new T.Color(0x91b952),GRASS_DRY=new T.Color(0x9eaf61);
// A continuous model-space colour field: the same grass survives occupation
// and height changes, without texture maps or a separate grass material.
export function mountainSummitGrassColor(x,z){
 const patch=.5+.5*Math.sin(3.8*x+.8*Math.sin(3*z))*Math.cos(3.1*z-.5*x);
 const dry=Math.exp(-((x+.22)**2+(z-.15)**2)/.10);
 return GRASS_DARK.clone().lerp(GRASS_LIGHT,.25+.5*patch).lerp(GRASS_DRY,.12*dry).lerp(new T.Color(PALETTE.grass),.12);
}
function builder(name){
 const p=[],c=[];
 return {tri(a,b,d,color){const n=new T.Vector3().subVectors(new T.Vector3(...b),new T.Vector3(...a)).cross(new T.Vector3().subVectors(new T.Vector3(...d),new T.Vector3(...a)));if(n.lengthSq()<1e-15)return;const colors=Array.isArray(color)?color:[color,color,color];p.push(...a,...b,...d);for(const item of colors){const rgb=item?.isColor?item:new T.Color(item);c.push(rgb.r,rgb.g,rgb.b);}},done(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();const m=new T.Mesh(g,MAT_TERRAIN);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}};
}
function makeTemplate(type='A'){
 const spec=type==='B'?MOUNTAIN_B_SPEC:MOUNTAIN_A2_SPEC,root=new T.Group();root.name='mountain_'+type;const b=builder('mountain_body'),s=builder('natural_summit');
 const {grassSamples,stats}=(type==='B'?buildRockHillB:buildRockHillA)(b,s,mountainSummitGrassColor),body=b.done(),summit=s.done();
 summit.userData.grassSamples=grassSamples;root.add(body,summit);
 root.userData={...spec,quarter:0,triangles:(body.geometry.attributes.position.count+summit.geometry.attributes.position.count)/3,bodyTriangles:body.geometry.attributes.position.count/3,summitTriangles:summit.geometry.attributes.position.count/3,gentleDirection:type==='A'?'E':'SE',localBounds:[-1,1,-1,1],rockStructure:stats};return root;
}
// Occupation cuts only the existing upper shell. The fixed mountain body is shared.
export const MOUNTAIN_A_GARRISON=Object.freeze({height:.61,anchor:Object.freeze([-.15,.08])});
function makeGarrisonCap(source){
 const h=MOUNTAIN_A_GARRISON.height,b=builder('garrison_summit'),segments=[],p=source.geometry.attributes.position,col=source.geometry.attributes.color;
 for(let i=0;i<p.count;i+=3){
  const input=[0,1,2].map(k=>({p:[p.getX(i+k),p.getY(i+k),p.getZ(i+k)],c:new T.Color().fromBufferAttribute(col,i+k)})),cut=[],cross=[];
  for(let j=0;j<3;j++){
   const a=input[j],d=input[(j+1)%3],ina=a.p[1]<=h,inb=d.p[1]<=h;
   if(ina)cut.push(a);
   if(ina!==inb){const t=(h-a.p[1])/(d.p[1]-a.p[1]),v=[a.p[0]+(d.p[0]-a.p[0])*t,h,a.p[2]+(d.p[2]-a.p[2])*t];cut.push({p:v,c:a.c.clone().lerp(d.c,t)});cross.push(v);}
  }
  for(let j=1;j<cut.length-1;j++)b.tri(cut[0].p,cut[j].p,cut[j+1].p,[cut[0].c,cut[j].c,cut[j+1].c]);
  if(cross.length===2&&Math.hypot(cross[0][0]-cross[1][0],cross[0][2]-cross[1][2])>1e-8)segments.push(cross);
 }
 // Recover closed horizontal contours. Summit stones can produce smaller inner
 // contours; the largest is the continuous hill silhouette at the cut height.
 const graph=new Map(),points=new Map(),buckets=new Map(),epsilon=1e-5;
 // Float32 intersections on adjoining CSG faces can straddle a decimal-rounding
 // boundary. Weld by actual distance, including neighbouring spatial buckets.
 const key=p=>{const x=Math.floor(p[0]/epsilon),z=Math.floor(p[2]/epsilon);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const id of buckets.get((x+dx)+','+(z+dz))??[]){const a=points.get(id);if(Math.hypot(a[0]-p[0],a[2]-p[2])<epsilon)return id;}const id=String(points.size),bucket=x+','+z;points.set(id,p);if(!buckets.has(bucket))buckets.set(bucket,[]);buckets.get(bucket).push(id);return id;};
 for(const [a,d]of segments){const ka=key(a),kd=key(d);if(ka===kd)continue;for(const [k,v]of [[ka,kd],[kd,ka]]){if(!graph.has(k))graph.set(k,new Set());graph.get(k).add(v);}}
 const used=new Set(),loops=[];
 for(const start of graph.keys()){
  if(used.has(start))continue;const ring=[];let prev=null,k=start;
  for(let n=0;n<1000;n++){
   if(used.has(k))break;used.add(k);ring.push(points.get(k));const next=[...graph.get(k)].find(v=>v!==prev);prev=k;k=next;if(k===start)break;if(!k)break;
  }
  if(k===start&&ring.length>=3)loops.push(ring);
 }
 const area=ring=>Math.abs(ring.reduce((a,v,i)=>{const d=ring[(i+1)%ring.length];return a+v[0]*d[2]-d[0]*v[2];},0)/2);
 loops.sort((a,d)=>area(d)-area(a));if(!loops.length)throw Error('Mountain occupation contour is not closed');
 const ring=loops[0],outline=ring.map(v=>new T.Vector2(v[0],v[2])),vertices=ring.map(p=>p.slice()),faces=T.ShapeUtils.triangulateShape(outline,[]);
 // Retain interior grass samples so cutting the summit does not replace its
 // organic colour pattern with a large flat patch or a different palette.
 for(const [x,z]of source.userData.grassSamples??[]){
  if(vertices.some(v=>Math.hypot(v[0]-x,v[2]-z)<.035))continue;
  for(let i=0;i<faces.length;i++){
   const [a,d,e]=faces[i].map(k=>vertices[k]),den=(d[2]-e[2])*(a[0]-e[0])+(e[0]-d[0])*(a[2]-e[2]);
   if(Math.abs(den)<1e-10)continue;
   const u=((d[2]-e[2])*(x-e[0])+(e[0]-d[0])*(z-e[2]))/den,v=((e[2]-a[2])*(x-e[0])+(a[0]-e[0])*(z-e[2]))/den,w=1-u-v;
   if(Math.min(u,v,w)<=1e-5)continue;
   const [ia,id,ie]=faces[i],n=vertices.length;vertices.push([x,h,z]);faces.splice(i,1,[ia,id,n],[id,ie,n],[ie,ia,n]);break;
  }
 }
 for(const f of faces){
  const [a,d,e]=f.map(k=>vertices[k]),ny=(d[2]-a[2])*(e[0]-a[0])-(d[0]-a[0])*(e[2]-a[2]),points=ny>0?[a,d,e]:[a,e,d];
  b.tri(...points,points.map(p=>mountainSummitGrassColor(p[0],p[2])));
 }
 const mesh=b.done();mesh.userData={platformY:h,platformArea:area(ring),platformOutline:ring.map(v=>[v[0],v[2]]),surface:'grass'};return mesh;
}
export const MOUNTAIN_A_HEIGHT=Object.freeze({min:.90,max:1.10,default:1});
const banks=new Map();
function prepare(type='A'){if(type!=='A'&&type!=='B')throw new TypeError('Mountain type must be A or B');if(!banks.has(type)){const template=makeTemplate(type);banks.set(type,{template,garrisonCap:makeGarrisonCap(template.children[1])});}return banks.get(type);}
function heightMetadata(root){const scale=root.userData.heightScale??1;root.userData.garrison={...MOUNTAIN_A_GARRISON,height:MOUNTAIN_A_GARRISON.height*scale};root.userData.naturalPeakHeight=root.userData.peakHeight*scale;root.userData.surfaceHeight=(root.userData.occupied?MOUNTAIN_A_GARRISON.height:root.userData.peakHeight)*scale;}
export function setMountainAQuarter(root,quarter=0){if(!Number.isInteger(quarter)||quarter<0||quarter>3)throw new TypeError('Mountain A quarter must be 0, 1, 2 or 3');root.rotation.y=quarter*Math.PI/2;root.userData.quarter=quarter;return root;}
export function setMountainAHeight(root,heightScale=1){
 if(!Number.isFinite(heightScale)||heightScale<MOUNTAIN_A_HEIGHT.min||heightScale>MOUNTAIN_A_HEIGHT.max)throw new RangeError('Mountain A heightScale must be between 0.90 and 1.10');
 root.scale.y=heightScale;root.userData.heightScale=heightScale;heightMetadata(root);return root;
}
export function getMountainAStandPoint(root,target=new T.Vector3()){
 root.updateWorldMatrix(true,false);const [x,z]=MOUNTAIN_A_GARRISON.anchor;return target.set(x,MOUNTAIN_A_GARRISON.height,z).applyMatrix4(root.matrixWorld);
}
export function setMountainAOccupied(root,occupied=false){
 const {template,garrisonCap}=prepare(root.userData.type??'A');if(typeof occupied!=='boolean')throw new TypeError('Mountain occupied must be a boolean');
 const cap=occupied?garrisonCap:template.children[1],node=root.children[1];node.geometry=cap.geometry;node.name=cap.name;node.userData={...cap.userData};
 root.userData.state=occupied?'garrison':'natural';root.userData.occupied=occupied;root.userData.summitTriangles=cap.geometry.attributes.position.count/3;root.userData.triangles=root.userData.bodyTriangles+root.userData.summitTriangles;heightMetadata(root);return root;
}
export function createMountain(type='A',quarter=0,{occupied=false,heightScale=1}={}){const {template}=prepare(type);return setMountainAHeight(setMountainAOccupied(setMountainAQuarter(template.clone(true),quarter),occupied),heightScale);}
export function createMountainA(quarter=0,options={}){return createMountain('A',quarter,options);}
export function createMountainB(quarter=0,options={}){return createMountain('B',quarter,options);}
export {setMountainAQuarter as setMountainQuarter,setMountainAHeight as setMountainHeight,setMountainAOccupied as setMountainOccupied,getMountainAStandPoint as getMountainStandPoint};
export {setMountainAQuarter as setMountainBQuarter,setMountainAHeight as setMountainBHeight,setMountainAOccupied as setMountainBOccupied,getMountainAStandPoint as getMountainBStandPoint,MOUNTAIN_A_GARRISON as MOUNTAIN_B_GARRISON};
