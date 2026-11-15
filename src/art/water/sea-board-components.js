import * as T from 'three';
import {createSeaStudy} from './sea-study.js';
import {compactSeaMeshes,describeRawSeaMesh} from './sea-performance.js';
import {MAT_WATER} from 'palette';
const hash=(x,z,s)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^s;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
export function exposedSeaEdges(cells,neighbors=cells){const mask=new Set(neighbors.map(p=>p.join(','))),out=[];for(const [x,z] of cells)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(!mask.has([x+dx,z+dz].join(',')))out.push({axis:dx?0:2,value:dx?2*x+dx:2*z+dz,along:dx?2*z:2*x,normal:new T.Vector3(dx,0,dz)});return out;}
export function createBoardCutaway(surface,{neighbors=surface.userData.cells,seed=7,bottom=-1.6,compact=true}={}){
 const edges=exposedSeaEdges(surface.userData.cells,neighbors);if(!edges.length)return null;if(!Number.isFinite(bottom)||bottom>=-.98)throw Error('bottom must be below -0.98');
 const p=surface.geometry.attributes.position,sourceColor=surface.geometry.attributes.color,positions=[],colors=[];let topPoints=0,facetPatches=0;
 for(const [edgeIndex,e] of edges.entries()){
 const other=e.axis?0:2,map=new Map();for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),arr=[v.x,v.y,v.z];if(arr[e.axis]!==e.value||Math.abs(arr[other]-e.along)>1.000001)continue;if(!map.has(arr[other]))map.set(arr[other],[arr[other],v.y,sourceColor.getX(i),sourceColor.getY(i),sourceColor.getZ(i)]);}
 const chain=[...map.values()].sort((a,b)=>a[0]-b[0]);if(chain.length<2)throw Error('missing exposed water edge');topPoints+=chain.length;
 const rows=[chain];for(let band=0;band<3;band++){const row=[];for(let j=0;j<=8;j++){const t=e.along-1+j*.25+(j&&j<8?(hash(Math.round(e.value*100)+band,j+Math.round(e.along*8),seed)-.5)*.14:0);const y=band===2?bottom:(band===0?-.62:-1.08)+(j&&j<8?(hash(j,Math.round(e.value*11)+band+Math.round(e.along*13),seed+80)-.5)*.22:0);row.push([t,y]);}rows.push(row);}
 const vertex=([t,y])=>e.axis===0?new T.Vector3(e.value,y,t):new T.Vector3(t,y,e.value);
 // All rows share one continuous depth colour function. No per-band tint reset.
 function topAt(t){let lo=0,hi=chain.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(chain[mid][0]<=t)lo=mid;else hi=mid;}const a=chain[lo],b=chain[hi],f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));return a.map((v,k)=>v+(b[k]-v)*f);}
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 function colourAt(v){const t=e.axis===0?v.z:v.x,top=topAt(t),depth=Math.max(0,top[1]-v.y),deep=smooth(depth/(top[1]-bottom)),fade=1-Math.exp(-depth*4.2),colour=new T.Color().setRGB(top[2],top[3],top[4]);
 const body=new T.Color(0x1184cb).lerp(new T.Color(0x0b4584),deep);
 const u=v.x*.82+v.z*1.06+depth*.18+seed*.13,fold=1-2*Math.abs((u-Math.floor(u))-.5);
 // Colour variation follows the existing irregular side vertices. Shared
 // positions get identical values, so facets do not reopen seams or row bands.
 // Leave the exact surface rim untouched; let broad blue facets emerge below it.
 const facet=hash(Math.round(v.x*104+v.z*179),Math.round(v.y*127),seed+131);
 const facetStrength=smooth(depth/.24)*(1-deep*.18);
 body.multiplyScalar(1+(fold-.5)*.18*smooth(depth/.5)+(facet-.5)*.55*facetStrength);
 body.lerp(new T.Color(0x168bd0),Math.max(0,facet-.58)*.36*facetStrength);
 return colour.lerp(body,fade);}
 function emit(aa,bb,cc,band){let a=vertex(aa),b=vertex(bb),c=vertex(cc);const n=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));if(n.dot(e.normal)<0)[b,c]=[c,b];if(n.lengthSq()<1e-18)return;
 const write=(vs,cs)=>{for(let i=0;i<3;i++){const v=vs[i],colour=cs[i];positions.push(v.x,v.y,v.z);colors.push(colour.r,colour.g,colour.b);}};
 const vs=[a,b,c],cs=vs.map(colourAt);
 if(band===0){write(vs,cs);return;}
 // Flat blue polygon interiors, with a narrow interpolation rim. The original
 // triangle perimeter stays exact in position and colour, including tile joins.
 const center=a.clone().add(b).add(c).multiplyScalar(1/3);
 const inner=vs.map(v=>v.clone().lerp(center,.08));
 const patch=new T.Color().setRGB(...[0,1,2].map(k=>cs.reduce((sum,q)=>sum+[q.r,q.g,q.b][k],0)/3));
 const variation=hash(Math.round(center.x*171+center.z*113),Math.round(center.y*211),seed+309);
 patch.multiplyScalar(.88+variation*.26);
 for(let i=0;i<3;i++){const j=(i+1)%3;write([vs[i],vs[j],inner[j]],[cs[i],cs[j],patch]);write([vs[i],inner[j],inner[i]],[cs[i],patch,patch]);}
 write(inner,[patch,patch,patch]);facetPatches++;}
 for(let band=0;band<3;band++){const a=rows[band],b=rows[band+1];let i=0,j=0;while(i<a.length-1||j<b.length-1){if(j===b.length-1||i<a.length-1&&a[i+1][0]<=b[j+1][0]){emit(a[i],a[i+1],b[j],band);i++;}else{emit(a[i],b[j+1],b[j],band);j++;}}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();const raw=new T.Mesh(g,MAT_WATER),out=compact?compactSeaMeshes([raw]):describeRawSeaMesh(raw);if(compact)raw.geometry.dispose();out.name='board_water_cutaway_v08';out.userData={...out.userData,exposedEdges:edges.length,topPoints,facetPatches,bottom};return out;
}
export function createSeaRegion(cells,{neighbors=cells,cutaway=false,surfaceFactory=createSeaStudy,compact=true,...options}={}){
 const raw=surfaceFactory(cells,options),surface=compact?compactSeaMeshes([raw]):describeRawSeaMesh(raw);surface.userData={...surface.userData,cells:raw.userData.cells};if(compact)raw.geometry.dispose();surface.name='sea_surface_07';const group=new T.Group();group.add(surface);let edge=null,disposed=false;const hasBoundary=exposedSeaEdges(surface.userData.cells,neighbors).length>0;
 const api={group,surface,surfaces:[surface],get cutaway(){return edge;},get cutaways(){return edge?[edge]:[];},hasBoundary,setCutawayEnabled(enabled){if(disposed)throw Error('region disposed');if(enabled&&hasBoundary&&!edge){edge=createBoardCutaway(surface,{neighbors,seed:options.seed,compact});group.add(edge);}if(edge)edge.visible=!!enabled;return edge;},releaseCutaway(){if(edge){group.remove(edge);edge.geometry.dispose();edge=null;}},dispose(){if(disposed)return;api.releaseCutaway();surface.geometry.dispose();group.clear();disposed=true;}};
 api.setCutawayEnabled(cutaway);return api;
}
// V08 original: independent, unindexed tile meshes. Same art and real-board
// boundary rules as the performance region; no internal walls or bottom caps.
export function createSeaOriginal(cells,{neighbors=cells,...options}={}){
 const tiles=cells.map(cell=>createSeaRegion([cell],{...options,neighbors,compact:false})),group=new T.Group();for(const tile of tiles)group.add(tile.group);
 return {group,surfaces:tiles.map(t=>t.surface),get cutaways(){return tiles.flatMap(t=>t.cutaways);},hasBoundary:tiles.some(t=>t.hasBoundary),setCutawayEnabled(enabled){for(const t of tiles)t.setCutawayEnabled(enabled);return this.cutaways;},releaseCutaway(){for(const t of tiles)t.releaseCutaway();},dispose(){for(const t of tiles)t.dispose();group.clear();}};
}
