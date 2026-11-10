import * as T from 'three';
import {MAT_TERRAIN} from 'palette';

export const COLORS={sand:0xf5be56,sandLight:0xffd579,sandDark:0xe6a344,cactus:0x7fae24,cactusLight:0x9cbe28,cactusDark:0x608a21,moss:0x929f30,mossLight:0xa7b43b,mud:0x666e3b,bank:0x7a813b,water:0x287f7c,waterLight:0x39978c,lily:0x7caf47,reed:0x8fae27,reedLight:0xc8ce39,reedDark:0x66882b,wood:0x8e6036,cutwood:0xc49558};
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function hash(x,z,s=1){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(s|0,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
export function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};}
const colorCache=new Map();
export function rgb(hex){if(!colorCache.has(hex))colorCache.set(hex,new T.Color(hex));return colorCache.get(hex);}
export class GeometryBuilder {
 constructor(name='expansion'){this.name=name;this.positions=[];this.colors=[];}
 tri(a,b,c,hex,shade=1){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)<1e-10)return;
  this.positions.push(...a.slice(0,3),...b.slice(0,3),...c.slice(0,3));
  const col=typeof hex==='number'?rgb(hex):hex;
  for(let i=0;i<3;i++)this.colors.push(col.r*shade,col.g*shade,col.b*shade);
 }
 up(a,b,c,hex,shade=1){if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)[b,c]=[c,b];this.tri(a,b,c,hex,shade);}
 quad(a,b,c,d,color,shade=1){this.tri(a,b,c,color,shade);this.tri(a,c,d,color,shade);}
 polygon(points,y,color){const contour=points.map(p=>new T.Vector2(p[0],p[1]));for(const [a,b,c] of T.ShapeUtils.triangulateShape(contour,[]))this.up([points[a][0],y,points[a][1]],[points[b][0],y,points[b][1]],[points[c][0],y,points[c][1]],color);}
 mesh(material=MAT_TERRAIN){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.positions,3));g.setAttribute('color',new T.Float32BufferAttribute(this.colors,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,material);mesh.name=this.name;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 }
}
export function tube(b,points,radii,color,sides=8,cap=true){
 const p=points.map(v=>new T.Vector3(...v));const rings=p.map((v,k)=>{
  const tangent=p[Math.min(k+1,p.length-1)].clone().sub(p[Math.max(0,k-1)]).normalize();
  const reference=Math.abs(tangent.y)>.85?new T.Vector3(0,0,1):new T.Vector3(0,1,0),u=new T.Vector3().crossVectors(reference,tangent).normalize(),w=new T.Vector3().crossVectors(tangent,u);
  return Array.from({length:sides},(_,i)=>v.clone().addScaledVector(u,Math.cos(i*2*Math.PI/sides)*radii[k]).addScaledVector(w,Math.sin(i*2*Math.PI/sides)*radii[k]).toArray());
 });
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
  const k=(i+1)%sides,shade=1+(i%3-1)*.045;
  b.quad(rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i],color,shade);
 }
 if(cap)for(let i=0;i<sides;i++){const k=(i+1)%sides;b.tri(points[0],rings[0][k],rings[0][i],color,.86);b.tri(points.at(-1),rings.at(-1)[i],rings.at(-1)[k],color,1.05);}
}
export function cactus(b,x,z,scale=1,angle=0){
 const at=(xx,y,zz=0)=>[x+(xx*Math.cos(angle)-zz*Math.sin(angle))*scale,y*scale,z+(xx*Math.sin(angle)+zz*Math.cos(angle))*scale];
 tube(b,[at(0,-.025),at(0,.90),at(0,1.015),at(0,1.055)],[.125,.125,.102,.045].map(v=>v*scale),COLORS.cactus,8);
 tube(b,[at(-.06,.37),at(-.245,.37),at(-.33,.44),at(-.33,.72),at(-.33,.78)],[.08,.087,.087,.086,.035].map(v=>v*scale),COLORS.cactusDark,7);
 tube(b,[at(.07,.56),at(.23,.56),at(.30,.63),at(.30,.89),at(.30,.95)],[.075,.082,.082,.08,.032].map(v=>v*scale),COLORS.cactusLight,7);
}
export function reedClump(b,x,z,scale=1,seed=1,baseY=0,{heightFactor=1,widthFactor=1,bladeCount=18,phase=0}={}){
 const random=rng(seed),count=bladeCount;
 for(let i=0;i<count;i++){
  const angle=phase+i*2.39996+random()*.5,h=(.68+random()*.54)*scale*heightFactor,lean=(.13+random()*.40)*scale*widthFactor,rootR=random()*.14*scale*widthFactor;
  const dir=[Math.cos(angle),Math.sin(angle)],side=[-dir[1],dir[0]],root=[x+dir[0]*rootR,z+dir[1]*rootR];
  const sections=[0,.28,.62,.86,1],widths=[.022,.092,.083,.043,0].map(v=>v*scale*widthFactor*(.87+random()*.26)),rings=[];
  for(let j=0;j<sections.length;j++){
   const t=sections[j],bend=lean*t*t,cx=root[0]+dir[0]*bend,cz=root[1]+dir[1]*bend,cy=baseY+h*t*(1-.17*t),w=widths[j];
   rings.push([[cx+side[0]*w,cy,cz+side[1]*w],[cx-dir[0]*.018*scale,cy+.013*scale,cz-dir[1]*.018*scale],[cx-side[0]*w,cy,cz-side[1]*w],[cx+dir[0]*.004*scale,cy-.005*scale,cz+dir[1]*.004*scale]]);
  }
  for(let j=0;j<rings.length-1;j++)for(let k=0;k<4;k++){
   const c=k===0?COLORS.reedLight:k===1?COLORS.reed:k===2?COLORS.reedDark:COLORS.reed;
   b.quad(rings[j][(k+1)%4],rings[j][k],rings[j+1][k],rings[j+1][(k+1)%4],c,.93+(i%3)*.035);
  }
 }
}
export function deadTree(b,x,z,scale=1,angle=0){
 const at=(xx,y,zz=0)=>[x+(xx*Math.cos(angle)-zz*Math.sin(angle))*scale,y*scale,z+(xx*Math.sin(angle)+zz*Math.cos(angle))*scale];
 for(const [pts,radii] of [
  [[[0,-.025],[.025,.28],[-.015,.57],[.06,.95]],[.11,.075,.045,.012]],
  [[[.005,.36],[-.22,.55],[-.28,.78]],[.055,.028,.009]],
  [[[-.18,.51],[-.37,.56]],[.025,.006]],
  [[[0,.60],[.26,.76],[.32,.95]],[.038,.021,.006]],
  [[[.24,.75],[.41,.78]],[.018,.005]],
  [[[.025,.28,0],[.08,.47,.20],[.14,.60,.25]],[.040,.023,.008]],
  [[[.015,.10,0],[-.13,.008,.14]],[.07,.025]],
  [[[.015,.09,0],[.17,.006,-.12]],[.065,.02]]
 ])tube(b,pts.map(p=>at(...p)),radii.map(r=>r*scale),COLORS.wood,6);
}
export function fallenLog(b,x,z,scale=1,angle=.5,baseY=0){
 const dir=new T.Vector3(Math.cos(angle),.06,Math.sin(angle)).normalize(),u=new T.Vector3().crossVectors(new T.Vector3(0,1,0),dir).normalize(),v=new T.Vector3().crossVectors(dir,u),center=new T.Vector3(x,baseY+.12*scale,z),n=8;
 const ring=(along,r)=>Array.from({length:n},(_,i)=>center.clone().addScaledVector(dir,along*scale).addScaledVector(u,Math.cos(i*2*Math.PI/n)*r*scale).addScaledVector(v,Math.sin(i*2*Math.PI/n)*r*scale).toArray());
 const ends=[ring(-.44,.13),ring(.44,.14)],inner=[ring(-.445,.087),ring(.445,.092)],deep=[ring(-.24,.081),ring(.24,.085)];
 for(let i=0;i<n;i++){
  const k=(i+1)%n;b.quad(ends[0][i],ends[0][k],ends[1][k],ends[1][i],COLORS.wood,.84+(i%3)*.09);
  for(let e=0;e<2;e++){
   let q=[ends[e][i],inner[e][i],inner[e][k],ends[e][k]],wall=[inner[e][i],deep[e][i],deep[e][k],inner[e][k]];
   if(e){q.reverse();wall.reverse();}b.quad(...q,COLORS.cutwood);b.quad(...wall,0x4d3923);
  }
 }
 for(let e=0;e<2;e++){const c=center.clone().addScaledVector(dir,(e?.24:-.24)*scale).toArray();for(let i=0;i<n;i++){const k=(i+1)%n;b.tri(c,deep[e][e?i:k],deep[e][e?k:i],0x302b20);}}
}
export function lilyPad(b,x,z,r,y,angle=0){
 const pts=[];for(let i=0;i<10;i++){const a=angle+i*2*Math.PI/10;pts.push([x+Math.cos(a)*r,z+Math.sin(a)*r*.84]);}
 // The small V cut makes the pads read as leaves, rather than colored bubbles.
 pts[0]=[x+Math.cos(angle)*r*.20,z+Math.sin(angle)*r*.16];b.polygon(pts,y,COLORS.lily);
}
export function geometryStats(root){const out={triangles:0,meshes:0,bytes:0};root.traverse(o=>{if(!o.isMesh)return;out.meshes++;out.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const a of Object.values(o.geometry.attributes))out.bytes+=a.array.byteLength;if(o.geometry.index)out.bytes+=o.geometry.index.array.byteLength;});return out;}
