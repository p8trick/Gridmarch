import * as T from 'three';
import {createWaterRegion,bankNoise} from './river-r61-footprint.js';
import {createSeaStudy} from './sea-study.js';
import {MAT_WATER} from 'palette';
// Clip the actual V08 water art against the validated river footprint.
const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
function cut(poly,d){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],u=d(a),v=d(b);if(u>=-1e-10)out.push(a);if(u>1e-10&&v< -1e-10||u< -1e-10&&v>1e-10){const t=u/(u-v);out.push(a.map((x,k)=>x+(b[k]-x)*t));}}return out;}
function mesh(rows,name,shore){const p=[],c=[];for(const poly of rows)for(let j=1;j<poly.length-1;j++){let t=[poly[0],poly[j],poly[j+1]];const area=cross(t[0],t[1],t[2]);if(Math.abs(area)<1e-12)continue;if(area>0)[t[1],t[2]]=[t[2],t[1]];const emit=tri=>{for(const v of tri){p.push(...v.slice(0,3));c.push(...v.slice(3));}};
 if(name==='water_bank'&&shore!=='beach'&&Math.abs(area)>.018&&Math.min(...t.map((v,k)=>Math.hypot(v[0]-t[(k+1)%3][0],v[2]-t[(k+1)%3][2])))>.12&&t.every(v=>v[1]<-.035)){
 const center=t[0].map((_,k)=>t.reduce((sum,v)=>sum+v[k],0)/3),n=bankNoise(center[0]+1.6,center[2]-4.3);center[1]=Math.max(-.295,Math.min(-.045,center[1]+(n-.5)*.03));for(let k=3;k<6;k++)center[k]*=.88+n*.24;
 for(let k=0;k<3;k++)emit([t[k],t[(k+1)%3],center]);
 }else emit(t);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();const m=new T.Mesh(g,MAT_WATER);m.name=name;m.receiveShadow=true;return m;}
const rgb=h=>{const c=new T.Color(h);return [c.r,c.g,c.b];};
export function createRiverArt(cells,{isLand,seed=7,shore='river',landY=0}={}){
 if(shore!=='river')throw Error('R6.1 is an inland river component');
 if(!Number.isFinite(landY)||landY<0)throw Error('landY must be nonnegative');const out=new T.Group(),water=[],banks=[],foam=[];
 const color=(p,band)=>{const noise=.5+.25*Math.sin(p[0]*7.3+p[2]*3.9)+.25*Math.cos(p[0]*4.1-p[2]*6.7),a=band===0?0x789f41:band===1?0x9c7947:0xe2c58a,b=band===0?0x90b84e:band===1?0xbe975f:0xf0d9a2;const earthA=band===0?a:shore==='beach'?0xe2c58a:band===2?0x655d4e:0x887358,earthB=band===0?b:shore==='beach'?0xf0d9a2:band===2?0x887e68:0xad9572;const c=new T.Color(earthA).lerp(new T.Color(earthB),noise);if(shore==='beach'&&band===0&&p[1]<-.01)c.set(0x9b7d50).lerp(new T.Color(0xb39765),noise);return [c.r,c.g,c.b];};
 for(const cell of cells){const base=createWaterRegion([cell],{isLand,shore,seed:1}),foot=base.getObjectByName('water_surface').geometry.attributes.position.array,bank=base.getObjectByName('water_bank')?.geometry.attributes.position.array||[],sea=createSeaStudy([cell],{seed,relief:0}),sp=sea.geometry.attributes.position.array,sc=sea.geometry.attributes.color.array;
 const shoreSegments=[];
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const cc=[cell[0]+dx,cell[1]+dz];if(isLand(...cc))continue;const g=createWaterRegion([cc],{isLand,shore,seed:1}),p=g.getObjectByName('water_bank')?.geometry.attributes.position.array||[];for(let i=0;i<p.length;i+=9){const vs=[0,3,6].map(k=>[...p.slice(i+k,i+k+3)]);for(let k=0;k<3;k++)if(Math.abs(vs[k][1]+.3)<1e-6&&Math.abs(vs[(k+1)%3][1]+.3)<1e-6&&vs[(k+2)%3][1]>-.29999)shoreSegments.push([vs[k],vs[(k+1)%3]]);}for(const m of g.children)m.geometry.dispose();}
 const edgeColor=p=>{let d=Infinity;for(const [a,b] of shoreSegments){const x=b[0]-a[0],z=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));d=Math.min(d,Math.hypot(p[0]-a[0]-t*x,p[2]-a[2]-t*z));}const coverage=Math.max(0,Math.min(1,(Math.sin(p[0]*3.1+p[2]*4.7)+.35)*2)),f=Math.max(0,1-d/.055)*coverage*(shore==='river'?.24:.85),c=new T.Color().setRGB(...p.slice(3));if(shore==='river')c.lerp(new T.Color(0x58b9d5),.28);c.lerp(new T.Color(0xe3f5ec),f);return [...p.slice(0,3),c.r,c.g,c.b];};
 const masks=[];for(let i=0;i<foot.length;i+=9){const tri=[0,3,6].map(j=>[...foot.slice(i+j,i+j+3)]);if(cross(...tri)<0)tri.reverse();masks.push(tri);}
 for(let i=0;i<sp.length;i+=9){const tri=[0,3,6].map(j=>[...sp.slice(i+j,i+j+3),...sc.slice(i+j,i+j+3)]),xmin=Math.min(...tri.map(v=>v[0])),xmax=Math.max(...tri.map(v=>v[0])),zmin=Math.min(...tri.map(v=>v[2])),zmax=Math.max(...tri.map(v=>v[2]));for(const mask of masks){if(Math.max(...mask.map(v=>v[0]))<xmin||Math.min(...mask.map(v=>v[0]))>xmax||Math.max(...mask.map(v=>v[2]))<zmin||Math.min(...mask.map(v=>v[2]))>zmax)continue;let poly=tri;for(let k=0;k<3&&poly.length;k++)poly=cut(poly,p=>cross(mask[k],mask[(k+1)%3],p));if(poly.length>=3)water.push(poly.map(edgeColor));}}
 for(let i=0;i<bank.length;i+=9){const tri=[0,3,6].map(j=>[...bank.slice(i+j,i+j+3)]),sand=p=>-.12-.15*bankNoise(p[0]-2.3,p[2]+1.8);
 for(const band of [0,1,2]){let poly=cut(tri,p=>band===0?-p[1]:-.05-p[1]);if(band===1)poly=cut(poly,p=>p[1]-sand(p));if(band===0)poly=cut(poly,p=>p[1]+.05);if(band===2)poly=cut(poly,p=>sand(p)-p[1]);
 if(poly.length>=3)banks.push(poly.map(p=>{const t=Math.max(0,Math.min(1,(-p[1]-.05)/.25)),y=shore==='beach'?p[1]:p[1]>=-.05?p[1]*.8:-.04-.26*Math.pow(t,shore==='cliff'?.35:.4+.9*bankNoise(p[0],p[2]));return [p[0],y,p[2],...color(p,band)];}));}
 }

 sea.geometry.dispose();for(const m of base.children)m.geometry.dispose();
 }
 for(const [rows,name] of [[water,'water_surface'],[banks,'water_bank'],[foam,'water_foam']])if(rows.length)out.add(mesh(rows,name,shore));const bankMesh=out.getObjectByName('water_bank');if(bankMesh){const p=bankMesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setY(i,shore==='beach'?(y>=-.05?landY+(y/.05)*(landY-.08):.08-.38*Math.pow(Math.max(0,Math.min(1,(-y-.05)/.25)),2)):landY+(y/.3)*(landY+.3));}p.needsUpdate=true;bankMesh.geometry.computeVertexNormals();}out.name='river_r61';out.userData={cells,waterY:-.3,landY,shore,landingAllowed:shore==='beach',stationRadius:.6,stationDiscValidated:false,nominalRiverWidth:.60,version:'R6.1',tris:{surface:out.getObjectByName('water_surface')?.geometry.attributes.position.count/3||0,bank:out.getObjectByName('water_bank')?.geometry.attributes.position.count/3||0,foam:out.getObjectByName('water_foam')?.geometry.attributes.position.count/3||0}};return out;
}
