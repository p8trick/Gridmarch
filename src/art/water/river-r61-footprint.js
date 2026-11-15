import * as T from 'three';
import {MAT_WATER} from 'palette';
export const WATER_PALETTE={surface:0x45a6c9,shallow:0x60b4d0,deep:0x3288a6,sand:0xe8c77a,cliff:0x8b6b3e,cliffLow:0x7a5c34,lip:0x6fa83a,foam:0xeef7fa,edge:[0x45a6c9,0x3288a6,0x246980]};
const EPS=1e-10, BLUE=0x45a6c9, GREY=0x92969a;
const smin=(a,b,k)=>Math.min(a,b)-Math.max(k-Math.abs(a-b),0)**2/(4*k);
// World-space, piecewise-linear noise: adjacent tiles read the same profile.
export function bankNoise(x,z){const h=(a,b)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263)^719;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};x/=.65;z/=.65;const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b;return u+v<1?h(a,b)+(h(a+1,b)-h(a,b))*u+(h(a,b+1)-h(a,b))*v:h(a+1,b+1)+(h(a,b+1)-h(a+1,b+1))*(1-u)+(h(a+1,b)-h(a+1,b+1))*(1-v);}
export function createWaterRegion(waterCells,opts={}){
 if(!Array.isArray(waterCells)||waterCells.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isSafeInteger)))throw Error('integer cell coordinates required');
 if(typeof opts.isLand!=='function')throw Error('isLand callback required');
 const shore=opts.shore??'river',seed=opts.seed??1;if(shore!=='river'||!Number.isSafeInteger(seed))throw Error('invalid shore or seed');
 const cells=[...new Map(waterCells.map(p=>[p.join(','),p.slice()])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),wet=new Set(cells.map(p=>p.join(',')));
 const out=new T.Group();out.name='water_region';const buffers={surface:[],bank:[]};
 function tri(type,a,b,c){let cross=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(Math.abs(cross)<1e-12)return;if(cross<0)[b,c]=[c,b];buffers[type].push(...a,...b,...c);}
 for(const [cx,cz] of cells){
  const X=2*cx,Z=2*cz,land=[];const has=(dx,dz)=>!wet.has(`${cx+dx},${cz+dz}`)&&!!opts.isLand(cx+dx,cz+dz);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if((dx||dz)&&has(dx,dz))land.push([2*dx,2*dz]);
  const corners=[];for(const sx of [-1,1])for(const sz of [-1,1])if(has(sx,0)&&has(0,sz))corners.push([sx,sz]);
  const strict=(x,z)=>land.reduce((d,[lx,lz])=>Math.min(d,Math.hypot(Math.max(Math.abs(x-lx)-1,0),Math.max(Math.abs(z-lz)-1,0))),10);
  const smooth=(x,z)=>{let d=strict(x,z);for(const [sx,sz] of corners){const a=1-sx*x,b=1-sz*z;d=Math.min(d,smin(a,b,.4));}return d;};
  const lip=(x,z)=>width(x,z)-(.12+.02*bankNoise(x+X+3.7,z+Z-1.2));
  // Nominal water width 1.2 / cell width 2 = 60%; world noise keeps tile ports identical.
  const width=(x,z)=>.40+.16*(bankNoise(x+X,z+Z)-.5);
  const field=(x,z)=>smooth(x,z)-width(x,z);
  // Canonical edge roots: solve using world-aligned edge direction, independent of traversal.
  const perimeter=[];
  const edges=[[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]];
  for(const [a,b] of edges){let ts=Array.from({length:9},(_,i)=>i/8);
   for(const fn of [field,(x,z)=>strict(x,z)-lip(x,z)])for(let i=0;i<8;i++){let lo=i/8,hi=(i+1)/8,at=t=>fn(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),fl=at(lo),fh=at(hi);if(fl*fh<0){for(let j=0;j<42;j++){const mid=(lo+hi)/2;if(at(mid)*fl>0)lo=mid;else hi=mid;}ts.push((lo+hi)/2);}}
   ts.sort((a,b)=>a-b);for(const t of ts)if(t<1-EPS)perimeter.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  }
  const rings=perimeter.map(([x,z])=>{
   const root=fn=>{if(fn(x,z)>=-EPS)return 1;let lo=0,hi=1;for(let i=0;i<44;i++){const m=(lo+hi)/2;if(fn(x*m,z*m)>0)lo=m;else hi=m;}return (lo+hi)/2;};
   const tw=root(field),tl=root((x,z)=>strict(x,z)-lip(x,z)),d=strict(x,z);
   // Height interpolates between strict lip and the smooth-min waterline.
   const y=d<1e-9?0:d<=lip(x,z)?-.05*d/lip(x,z):field(x,z)>=-EPS?-.3:-.05-.25*Math.min(1,(d-lip(x,z))/(d-lip(x,z)-field(x,z)));
   const p=(t,h)=>[X+x*t,h,Z+z*t];return [p(tw,-.3),p(Math.max(tw,tl),tl<1-EPS?-.05:y),p(1,y)];
  });
  for(let i=0;i<rings.length;i++){const j=(i+1)%rings.length;tri('surface',[X,-.3,Z],rings[i][0],rings[j][0]);for(let r=0;r<2;r++){tri('bank',rings[i][r],rings[i][r+1],rings[j][r+1]);tri('bank',rings[i][r],rings[j][r+1],rings[j][r]);}}
 }
 for(const type of ['surface','bank'])if(buffers[type].length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(buffers[type],3));const c=new T.Color(type==='surface'?BLUE:GREY),colors=[];for(let i=0;i<buffers[type].length/3;i++)colors.push(c.r,c.g,c.b);geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,MAT_WATER);mesh.name='water_'+type;mesh.castShadow=false;mesh.receiveShadow=true;out.add(mesh);}
 out.userData={cells,waterY:-.3,stationRadius:.6,stationDiscValidated:false,nominalRiverWidth:.60,tris:{surface:buffers.surface.length/9,bank:buffers.bank.length/9,foam:0}};return out;
}
