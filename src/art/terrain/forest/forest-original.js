import * as THREE from 'three';
import {PALETTE as P,MAT_TERRAIN} from 'palette';
// Original tree factories extracted without geometry changes from BasicTerrain Roads R2.
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
export function createTreeBroad(variant=0,seed=1){
 const h=[1.2,1.5,1.8][variant%3],b=builder(seed);
 rings(b,[[0,.14],[h*.73,.105]],7,P.trunk,seed);
 rings(b,[[h*.47,.23],[h*.61,.43],[h*.82,.39],[h*.95,.23],[h,0]],7,0x548a45,seed+19);
 return b.done('tree_broad');
}
export const FOREST_SPEC=Object.freeze({version:'V1.0 Dual P1',tileSize:2,heights:[1.2,1.5,1.8],types:['pine','broad']});
export const PARTS={tree_pine:{create:createTreePine,variants:3,height:1.8,role:'prop'},tree_broad:{create:createTreeBroad,variants:3,height:1.8,role:'prop'}};
export function forestStats(root){const out={trees:root.userData.records?.length??1,triangles:0,meshes:0,bytes:0};root.traverse(o=>{if(!o.isMesh)return;out.meshes++;out.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const a of Object.values(o.geometry.attributes))out.bytes+=a.array.byteLength;if(o.geometry.index)out.bytes+=o.geometry.index.array.byteLength;});return out;}
export function createForestRegion(records=[]){
 if(!Array.isArray(records))throw Error('Forest records must be an array');
 const normalized=records.map(r=>{
  const kind=r.kind??'pine',variant=r.variant??1,seed=r.seed??1,position=r.position??[0,0,0],yaw=r.yaw??0,scale=r.scale??1;
  if(!['pine','broad'].includes(kind)||!Number.isInteger(variant)||variant<0||variant>2||!Number.isInteger(seed)||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Number.isFinite(yaw)||!Number.isFinite(scale)||scale<=0)throw Error('Invalid forest record');
  return {kind,variant,seed,position:position.slice(),yaw,scale};
 });
 const root=new THREE.Group();root.name='forest_region';
 for(const r of normalized){const tree=(r.kind==='pine'?createTreePine:createTreeBroad)(r.variant,r.seed);tree.position.set(...r.position);tree.rotation.y=r.yaw;tree.scale.setScalar(r.scale);root.add(tree);}
 root.userData={edition:'original',version:FOREST_SPEC.version,records:normalized};root.userData.stats=forestStats(root);return root;
}
export function disposeForest(root){const seen=new Set();root.traverse(o=>{if(o.isMesh&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});root.clear();}
