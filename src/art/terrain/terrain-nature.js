import {BATCH1_PARTS} from './terrain-batch1.js';
export * from './terrain-batch1.js';
import * as THREE from 'three';
import {PALETTE as P,MAT_TERRAIN} from 'palette';
function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function builder(seed){const pos=[],col=[],rng=random(seed);return {tri(a,b,c,hex,v=.09){const color=new THREE.Color(hex).multiplyScalar(1+(rng()-.5)*v);pos.push(...a,...b,...c);for(let i=0;i<3;i++)col.push(color.r,color.g,color.b);},done(name){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();const m=new THREE.Mesh(g,MAT_TERRAIN);m.name=name;m.castShadow=true;m.receiveShadow=true;const group=new THREE.Group();group.name=name;group.add(m);return group;}};}
function rings(b,levels,n,hex,seed,cap=true){const rng=random(seed),radii=Array.from({length:n},()=>.88+rng()*.22);const ring=levels.map(([y,r,dx=0,dz=0])=>Array.from({length:n},(_,i)=>{let a=i*Math.PI*2/n;return [dx+Math.cos(a)*r*radii[i],y,dz+Math.sin(a)*r*radii[i]];}));for(let k=0;k<ring.length-1;k++)for(let i=0;i<n;i++){const j=(i+1)%n;b.tri(ring[k][i],ring[k+1][i],ring[k][j],hex);b.tri(ring[k][j],ring[k+1][i],ring[k+1][j],hex);}if(cap){let r=ring.at(-1),y=levels.at(-1)[0];for(let i=0;i<n;i++)b.tri([levels.at(-1)[2]||0,y,levels.at(-1)[3]||0],r[(i+1)%n],r[i],hex);}}
// Low-poly cones have closed undersides, leaving a clear layered silhouette.
function cone(b,y0,yt,r,hex,seed){
 const n=8,rng=random(seed),phase=.12,rr=Array.from({length:n},()=>r*(.96+rng()*.08));
 const rim=rr.map((v,i)=>[Math.cos(i*2*Math.PI/n+phase)*v,y0,Math.sin(i*2*Math.PI/n+phase)*v]);
 for(let i=0;i<n;i++){let j=(i+1)%n;b.tri(rim[i],[0,yt,0],rim[j],hex,.13);b.tri([0,y0,0],rim[i],rim[j],new THREE.Color(hex).multiplyScalar(.72),.04);}
}
export function createTreePine(variant=0,seed=1){
 const v=((variant%3)+3)%3,h=[1.2,1.5,1.8][v],b=builder(seed);
 rings(b,[[0,.14],[h*.80,.12]],8,P.trunk,seed);
 const layers=v===0?[[.50,.83,.33],[.71,1,.23]]:[[.47,.78,.38],[.63,.90,.29],[.79,1,.19]];
 layers.forEach(([lo,hi,r],i)=>cone(b,h*lo,h*hi,r,[0x36813c,0x40913e,0x4b9c43][i],seed+i*17));
 return b.done('tree_pine');
}
// Baked facet contrast is deliberately subtle on lit faces and stronger on backs.
function rockTri(b,a,c,d){
 const u=new THREE.Vector3().fromArray(c).sub(new THREE.Vector3().fromArray(a));
 const v=new THREE.Vector3().fromArray(d).sub(new THREE.Vector3().fromArray(a));
 const n=u.cross(v).normalize(),sun=new THREE.Vector3(-.56,.5,.66).normalize();
 const shade=.72+.28*Math.max(0,n.dot(sun));
 b.tri(a,c,d,new THREE.Color(P.rock).multiplyScalar(shade),.12);
}
export function createTreeBroad(variant=0,seed=1){
 const h=[1.2,1.5,1.8][variant%3],b=builder(seed);
 rings(b,[[0,.14],[h*.73,.105]],7,P.trunk,seed);
 rings(b,[[h*.47,.23],[h*.61,.43],[h*.82,.39],[h*.95,.23],[h,0]],7,0x548a45,seed+19);
 return b.done('tree_broad');
}
// A mountain REGION is a set of occupied grid coordinates, not a fused asset.
// Each cell remains a separate <=2x2 mesh. A shared boundary-distance function
// gives both sides of every internal edge exactly the same height.
const MTN_H=.55;
const MTN_GRID=[-1,-.85,-.65,-.45,0,.45,.65,.85,1];
function mountainBoundary(cells){
 const occupied=new Set(cells.map(([x,z])=>x+','+z)),edges=[];
 for(const [x,z] of cells){const cx=x*2,cz=z*2;
  for(const [dx,dz,a,b] of [[0,-1,[cx-1,cz-1],[cx+1,cz-1]],[1,0,[cx+1,cz-1],[cx+1,cz+1]],[0,1,[cx+1,cz+1],[cx-1,cz+1]],[-1,0,[cx-1,cz+1],[cx-1,cz-1]]]){
   if(!occupied.has((x+dx)+','+(z+dz)))edges.push([a,b]);
  }
 }
 return edges;
}
function boundaryDistance(x,z,edges){
 let best=Infinity;for(const [[ax,az],[bx,bz]] of edges){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-ax-dx*t,z-az-dz*t));}return best;
}
function mountainCell(cx,cz,edges,variant=0,seed=1){
 const b=builder(seed);
 const height=(x,z)=>{
  const wx=x+cx*2,wz=z+cz*2,dist=boundaryDistance(wx,wz,edges);
  // Continuous world-coordinate relief gives adjoining cells identical edge heights.
  const ridge=Math.min(.70,.64+.10*Math.sin(wx*1.67+wz*.83+variant*.9)+.055*Math.cos(wz*2.1-wx*.61));
  const natural=ridge*Math.min(1,dist/.35);
  const r=Math.max(Math.abs(x),Math.abs(z)),blend=Math.max(0,Math.min(1,(r-.45)/.20));
  return MTN_H*(1-blend)+natural*blend;
 };
 function face(a,c,d){
  const mx=(a[0]+c[0]+d[0])/3+cx*2,mz=(a[2]+c[2]+d[2])/3+cz*2;
  const n=new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...d),new THREE.Vector3(...a))).normalize();
  const sun=new THREE.Vector3(-.56,.5,.66).normalize(),shade=.78+.22*Math.max(0,n.dot(sun));
  // Muted mineral patches continue over the small standing area; no green tabletop.
  const patch=Math.sin(mx*3.1+mz*1.7)+.45*Math.cos(mz*3.7-mx);
  const color=new THREE.Color(patch>.5?0x95918a:patch<-.6?0x817d87:0x8b8790).multiplyScalar(shade);
  b.tri(a,c,d,color,.055);
 }
 for(let z=0;z<MTN_GRID.length-1;z++)for(let x=0;x<MTN_GRID.length-1;x++){
  const x0=MTN_GRID[x],x1=MTN_GRID[x+1],z0=MTN_GRID[z],z1=MTN_GRID[z+1];
  const a=[x0,height(x0,z0),z0],c=[x0,height(x0,z1),z1],d=[x1,height(x1,z1),z1],e=[x1,height(x1,z0),z0];
  if((x+z+variant)%2){face(a,c,e);face(c,d,e);}else{face(a,c,d);face(a,d,e);}
 }
 const g=b.done('mtn_ledge');g.userData={standY:MTN_H,standRadius:.45,cell:[cx,cz],bounds:[-1,1,-1,1]};return g;
}
export function createMtnLedge(variant=0,seed=1){return mountainCell(0,0,mountainBoundary([[0,0]]),variant,seed);}
export function createMountainRegion(cells,seed=1){
 const unique=[...new Map(cells.map(c=>[c[0]+','+c[1],c])).values()];
 if(unique.some(c=>!Number.isInteger(c[0])||!Number.isInteger(c[1])))throw new Error('Mountain cells must use integer grid coordinates');
 const edges=mountainBoundary(unique),group=new THREE.Group();group.name='mountain_region';
 for(const [x,z] of unique){const tile=mountainCell(x,z,edges,0,seed+x*31+z*79);tile.position.set(x*2,0,z*2);group.add(tile);}return group;
}
function rect(b,x0,x1,z0,z1,y,c){b.tri([x0,y,z0],[x0,y,z1],[x1,y,z1],c,0);b.tri([x0,y,z0],[x1,y,z1],[x1,y,z0],c,0);}
export function createRoadStraight(){let b=builder(1);rect(b,-1,1,-.66,.66,.025,P.curb);rect(b,-1,1,-.56,.56,.03,P.road);for(let x=-.8;x<1;x+=.5)rect(b,x,x+.25,-.025,.025,.035,P.mark);return b.done('road_straight');}
export const PARTS={
 ...BATCH1_PARTS,
 tree_pine:{create:createTreePine,variants:3,height:1.8,role:'prop'},
 tree_broad:{create:createTreeBroad,variants:3,height:1.8,role:'prop'},
 mtn_ledge:{create:createMtnLedge,variants:2,height:.7,role:'prop',standY:.55,standRadius:.45},
 road_straight:{create:createRoadStraight,variants:1,connect:['E','W'],role:'overlay'}
};
