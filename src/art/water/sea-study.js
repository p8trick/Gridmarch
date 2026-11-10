import * as T from 'three';
import {MAT_WATER} from 'palette';
function hash(x,z,seed){let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
const SCALE=.52;
function site(x,z,s){return [(x+.5+(hash(x,z,s)-.5)*.84)*SCALE,(z+.5+(hash(x,z,s+1)-.5)*.84)*SCALE];}
function half(poly,a,b){const out=[],d=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=d(p),v=d(q);if(u>=-1e-12)out.push(p);if(u>1e-12&&v< -1e-12||u< -1e-12&&v>1e-12){const t=u/(u-v);out.push(p.map((c,j)=>c+t*(q[j]-c)));}}return out;}
function clip(poly,axis,value,sign){const a=axis===0?[value,0]:[0,value],b=axis===0?[value,-sign]:[sign,value];return half(poly,a,b);}
function waveCell(x,z,seed,contrast,waves,relief){
 const center=site(x,z,seed),[cx,cz]=center;let poly=[[cx-2,cz-2],[cx+2,cz-2],[cx+2,cz+2],[cx-2,cz+2]];
 for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){if(!dx&&!dz)continue;const b=site(x+dx,z+dz,seed),mx=(cx+b[0])/2,mz=(cz+b[1])/2;poly=half(poly,[mx,mz],[mx-(b[1]-cz),mz+(b[0]-cx)]);}
 const border=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];border.push(a,[(a[0]+b[0])/2,(a[1]+b[1])/2]);}
 const height=(x,z)=>-.3+relief*(.6*Math.sin(x*1.5+seed)*Math.cos(z*.9+.4)+.4*Math.sin(x*.7+z*1.2+seed*.3));
 const make=(p,c)=>[p[0],p[1],height(...p),c.r,c.g,c.b],base=new T.Color(0x087fc5).lerp(new T.Color(0x1266b0),hash(x,z,seed+12)*.55*contrast);
 const centerV=make(center,base),outer=[],lip=[],inner=[];
 for(let i=0;i<border.length;i++){const p=border[i],n=.5+.25*Math.sin(p[0]*3.7+p[1]*2.1+seed)+.25*Math.sin(p[0]*1.8-p[1]*4.3+seed*.2),junction=i%2===0;
 // The same position gets the same boundary colour, regardless of owning cell.
 const brightness=Math.max(0,Math.min(1,(n-.28)*1.55)),cyan=new T.Color(0x27b7e3),white=new T.Color(0xc9f5f6),edge=cyan.clone().lerp(white,Math.pow(brightness,2.2)*.94);
 const power=Math.pow(Math.max(0,Math.min(1,(n-.34)/.48)),1.6);
 if(!waves)edge.copy(base);else edge.lerp(new T.Color(0x1086c6),1-power);
 outer.push(make(p,edge));
 const width=((junction?.16:.055)+.035*Math.sin(p[0]*4.1+p[1]*3.2+seed))*(.55+power*.85),r=1-width;
 const q=[cx+(p[0]-cx)*r,cz+(p[1]-cz)*r],mid=[cx+(p[0]-cx)*.53,cz+(p[1]-cz)*.53];
 const rim=base.clone().lerp(new T.Color(0x26a5d7),waves?.08+.28*power:.05),shade=base.clone().lerp(new T.Color(hash(x*41+i,z,seed+20)>.5?0x2098d1:0x076db8),.25*contrast);
 lip.push(make(q,rim));inner.push(make(mid,shade));
 }
 const triangles=[];
 const facet=(tri,i,k)=>{const factor=1+contrast*(hash(x*61+i,z*7+k,seed+40)-.5)*.15;return tri.map(v=>v.map((c,j)=>j<3?c:c*factor));};
 for(let i=0;i<border.length;i++){const j=(i+1)%border.length;triangles.push([outer[i],outer[j],lip[j]],[outer[i],lip[j],lip[i]],facet([lip[i],lip[j],inner[j]],i,0),facet([lip[i],inner[j],inner[i]],i,1),[inner[i],inner[j],centerV]);}return triangles;
}
export function createSeaStudy(cells,{seed=7,contrast=1,waves=true,relief=0}={}){
 if(!Number.isSafeInteger(seed)||!Array.isArray(cells)||cells.some(p=>p.length!==2||!p.every(Number.isSafeInteger)))throw Error('integer coordinates and seed required');
 const unique=[...new Map(cells.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),positions=[],colors=[],cache=new Map();
 for(const [cx,cz] of unique){const xmin=cx*2-1,xmax=xmin+2,zmin=cz*2-1,zmax=zmin+2;
 for(let x=Math.floor(xmin/SCALE)-2;x<=Math.ceil(xmax/SCALE)+1;x++)for(let z=Math.floor(zmin/SCALE)-2;z<=Math.ceil(zmax/SCALE)+1;z++){
 const key=x+','+z;if(!cache.has(key))cache.set(key,waveCell(x,z,seed,contrast,waves,relief));
 for(const original of cache.get(key)){if(Math.max(...original.map(v=>v[0]))<xmin||Math.min(...original.map(v=>v[0]))>xmax||Math.max(...original.map(v=>v[1]))<zmin||Math.min(...original.map(v=>v[1]))>zmax)continue;
 let poly=original;for(const [axis,value,sign] of [[0,xmin,1],[0,xmax,-1],[1,zmin,1],[1,zmax,-1]])poly=clip(poly,axis,value,sign);if(poly.length<3)continue;
 const ring=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];ring.push(a);const axis=Math.abs(a[0]-b[0])<1e-9&&(Math.abs(a[0]-xmin)<1e-9||Math.abs(a[0]-xmax)<1e-9)?1:Math.abs(a[1]-b[1])<1e-9&&(Math.abs(a[1]-zmin)<1e-9||Math.abs(a[1]-zmax)<1e-9)?0:-1;if(axis<0)continue;const list=[];for(let j=1;j<8;j++){const value=(axis===0?xmin:zmin)+j*.25,t=(value-a[axis])/(b[axis]-a[axis]);if(t>1e-9&&t<1-1e-9)list.push({t,p:a.map((v,k)=>v+t*(b[k]-v))});}list.sort((a,b)=>a.t-b.t);ring.push(...list.map(v=>v.p));}
 const center=ring.reduce((s,p)=>s.map((v,i)=>v+p[i]/ring.length),Array(6).fill(0));
 for(let i=0;i<(ring.length===3?1:ring.length);i++){let a=ring.length===3?ring[0]:center,b=ring.length===3?ring[1]:ring[i],c=ring.length===3?ring[2]:ring[(i+1)%ring.length];let signed=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);if(Math.abs(signed)<1e-12)continue;if(signed<0)[b,c]=[c,b];for(const v of [a,b,c]){positions.push(v[0],v[2],v[1]);colors.push(v[3],v[4],v[5]);}}
 }
 }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const mesh=new T.Mesh(g,MAT_WATER);mesh.name='sea_art_study';mesh.userData={cells:unique,tris:positions.length/9,seed,contrast,waves,relief};return mesh;
}
