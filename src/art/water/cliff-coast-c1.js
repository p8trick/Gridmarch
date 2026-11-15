import * as T from 'three';
import {MAT_TERRAIN,MAT_WATER} from 'palette';
import {makeBlueprintProfile,createBlueprintTile,getBlueprintStraightPorts,clearBlueprintCache} from './shoal-blueprint-a7.js';
import {CLIFF_COAST_RULES} from './cliff-coast-rules.js';
import {SHOAL_RULES} from './shoal-rules.js';
import {createCliffOutlineWarp} from './cliff-outline-warp.js';

const cache=new Map(),clamp=x=>Math.max(0,Math.min(1,x)),eps=1e-6;
const hash=(x,z,s)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(s,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const pointKey=v=>[v[0],v[2]].map(x=>Math.round(x*1e6)).join(',');
const grass=(x,z)=>new T.Color(0x83ad47).lerp(new T.Color(0x91ba52),.50+.26*Math.sin(x*.43+z*.27)+.17*Math.cos(z*.61-x*.19));
const world=(v,cx,cz)=>[v[0]+cx*2,v[1],v[2]+cz*2,...v.slice(3,6)];
export const makeCliffCoastProfile=options=>makeBlueprintProfile({...options,waterStyle:'shore'});
export const getCliffStraightPorts=getBlueprintStraightPorts;
// A point on the plateau, not a claim that every unit's complete footprint fits.
export function getCliffGroundAnchor(cx,cz,profile=makeCliffCoastProfile()){
 let best=null,score=0;for(const x of [0,-.5,.5])for(const z of [0,-.5,.5]){const clearance=Math.min(1-Math.abs(x),1-Math.abs(z),-profile.distance(x+cx*2,z+cz*2));if(clearance>score+.000001){score=clearance;best=[x,0,z];}}return best;
}

function makeMesh(rows,name,material){
 const positions=[],colours=[];for(const tri of rows)for(const v of tri){positions.push(...v.slice(0,3));colours.push(...v.slice(3,6));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colours,3));g.computeVertexNormals();
 const mesh=new T.Mesh(g,material);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=name!=='water';return mesh;
}
function normal(a,b,c){const u=b.map((v,k)=>v-a[k]),v=c.map((q,k)=>q-a[k]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];}
function emit(rows,a,b,c,direction){
 const n=normal(a,b,c);if(Math.hypot(...n)<1e-11)return;
 if(n.reduce((s,v,k)=>s+v*direction[k],0)<0)[b,c]=[c,b];rows.push([a,b,c]);
}
function edgePairs(rows,axis,value){
 const out=[],seen=new Set();for(const tri of rows)for(let i=0;i<3;i++){
  const a=tri[i],b=tri[(i+1)%3];if(Math.abs(a[axis]-value)>eps||Math.abs(b[axis]-value)>eps||Math.abs(a[2-axis]-b[2-axis])<1e-8)continue;
  const key=[pointKey(a),pointKey(b)].sort().join(':');if(!seen.has(key)){seen.add(key);out.push([a,b]);}
 }return out;
}
function edgeChain(rows,axis,value){
 const points=new Map();for(const [a,b] of edgePairs(rows,axis,value))for(const v of [a,b])points.set(v[2-axis].toFixed(7),v);
 return [...points.values()].sort((a,b)=>a[2-axis]-b[2-axis]);
}
function contours(sandRows){
 const edges=new Map();for(const tri of sandRows)for(let i=0;i<3;i++){
  const a=tri[i],b=tri[(i+1)%3];if(Math.abs(a[1]+.3)>eps||Math.abs(b[1]+.3)>eps||Math.hypot(a[0]-b[0],a[2]-b[2])<1e-7)continue;
  const ka=pointKey(a),kb=pointKey(b),key=[ka,kb].sort().join(':');if(!edges.has(key))edges.set(key,{ka,kb,a,b});
 }
 const graph=new Map();for(const [key,e] of edges)for(const k of [e.ka,e.kb]){if(!graph.has(k))graph.set(k,[]);graph.get(k).push(key);}
 const unused=new Set(edges.keys()),out=[];
 while(unused.size){const first=edges.get(unused.values().next().value);let cursor=[first.ka,first.kb].find(k=>graph.get(k).filter(e=>unused.has(e)).length===1)||first.ka;
  // Find the end of this component before walking it.
  const component=new Set([cursor]),queue=[cursor];for(let i=0;i<queue.length;i++)for(const id of graph.get(queue[i])){const e=edges.get(id),next=e.ka===queue[i]?e.kb:e.ka;if(!component.has(next)){component.add(next);queue.push(next);}}
  cursor=[...component].filter(k=>graph.get(k).length===1).sort()[0]||cursor;
  const line=[];while(true){const id=graph.get(cursor).find(k=>unused.has(k));if(!id)break;const e=edges.get(id),forward=e.ka===cursor;if(!line.length)line.push((forward?e.a:e.b).slice());line.push((forward?e.b:e.a).slice());unused.delete(id);cursor=forward?e.kb:e.ka;}
  if(line.length>1)out.push(line);
 }return out;
}
function cliffColour(x,y,z,seed){
 if(y>=-.045001){const c=grass(x,z);return c.multiplyScalar(1-.18*clamp(-y/.045));}
 const t=clamp((-y-.045)/.255),c=new T.Color(0xb59a72).lerp(new T.Color(0x716b59),t),variation=hash(Math.floor(x*3.4+z*.6),Math.floor(z*3.1-x*.4),seed);
 return c.multiplyScalar(.88+.24*variation);
}
function strip(rows,upper,lower,direction){
 let i=0,j=0;while(i<upper.length-1||j<lower.length-1){
  if(j===lower.length-1||i<upper.length-1&&upper[i+1].s<=lower[j+1].s){const tri=[upper[i].v,upper[i+1].v,lower[j].v];emit(rows,...tri,direction(tri));i++;}
  else{const tri=[upper[i].v,lower[j+1].v,lower[j].v];emit(rows,...tri,direction(tri));j++;}
 }
}
function cliffFace(line,part){
 const rows=[],{cx,cz,profile}=part,dist=[0];for(let i=1;i<line.length;i++)dist.push(dist.at(-1)+Math.hypot(line[i][0]-line[i-1][0],line[i][2]-line[i-1][2]));
 const total=dist.at(-1),at=s=>{let i=0;while(i<dist.length-2&&dist[i+1]<s)i++;const t=clamp((s-dist[i])/(dist[i+1]-dist[i]));return line[i].map((v,k)=>v+(line[i+1][k]-v)*t);};
 const vertex=(p,y)=>{const c=cliffColour(p[0]+cx*2,y,p[2]+cz*2,profile.seed);return [p[0],y,p[2],c.r,c.g,c.b];};
 const top=line.map((p,i)=>({s:dist[i],v:vertex(p,0)})),lip=line.map((p,i)=>({s:dist[i],v:vertex(p,-.045)})),foot=line.map((p,i)=>({s:dist[i],v:vertex(p,-.3)})),mid=[];
 const count=Math.max(2,Math.ceil(total/.29));for(let i=0;i<=count;i++){
  const s=total*i/count,p=at(s),wx=p[0]+cx*2,wz=p[2]+cz*2,y=-.16+.028*Math.sin(wx*5.2+wz*3.4+profile.seed*.11);mid.push({s,v:vertex(p,y)});
 }
 const direction=tri=>{const x=tri.reduce((s,v)=>s+v[0]/3,0)+cx*2,z=tri.reduce((s,v)=>s+v[2]/3,0)+cz*2;
  return [profile.distance(x+.001,z)-profile.distance(x-.001,z),0,profile.distance(x,z+.001)-profile.distance(x,z-.001)];};
 strip(rows,top,lip,direction);strip(rows,lip,mid,direction);strip(rows,mid,foot,direction);return rows;
}
function data(cx,cz,profile,type){
 if(!['cliff','shoal'].includes(type)||profile.waterStyle!=='shore')throw Error('C1 requires cliff/shoal type and final A7.3 shore water');
 const key=[cx,cz,type,profile.key].join(':');if(cache.has(key))return cache.get(key);
 const source=createBlueprintTile({cx,cz,profile}),rows={land:[],cliff:[],water:[]},sand=[],warp=type==='cliff'?createCliffOutlineWarp(cx,cz,profile):null;
 for(const m of source.children){const p=m.geometry.attributes.position.array,c=m.geometry.attributes.color.array;for(let i=0;i<p.length;i+=9){const tri=[0,3,6].map(k=>{const v=[...p.slice(i+k,i+k+3),...c.slice(i+k,i+k+3)];if(warp){const [x,z]=warp.map(v[0],v[2]);v[0]=x;v[2]=z;}return v;});
  if(m.name==='water')rows.water.push(tri);else{if(m.name==='sand')sand.push(tri);rows.land.push(type==='shoal'?tri:tri.map(v=>{const colour=grass(v[0]+cx*2,v[2]+cz*2);return [v[0],0,v[2],colour.r,colour.g,colour.b];}));}
 }}
 const projected=tris=>tris.reduce((sum,tri)=>sum+Math.abs(normal(...tri)[1])/2,0);
 const part={cx,cz,profile,type,rows,areas:{land:projected(rows.land),water:projected(rows.water)},outline:warp?{maxDisplacement:warp.maxDisplacement,minAreaRatio:warp.minAreaRatio,gain:warp.gain}:null,contours:type==='cliff'?contours(sand):[]};
 if(type==='cliff')for(const line of part.contours)rows.cliff.push(...cliffFace(line,part));
 source.traverse(m=>{if(m.isMesh)m.geometry.dispose();});cache.set(key,part);return part;
}
function shoulder(part,neighbor,dx,dz){
 const rows=[],axis=dx?0:2,value=-(dx||dz),direction=[dx,0,dz];
 for(const [a,b] of edgePairs(neighbor.rows.land,axis,value)){
  const aa=world(a,neighbor.cx,neighbor.cz),bb=world(b,neighbor.cx,neighbor.cz),mx=(aa[0]+bb[0])/2,mz=(aa[2]+bb[2])/2;
  if(Math.min(a[1],b[1])>-.000001||part.profile.distance(mx,mz)>.012)continue;
  const vertex=(v,y)=>{const c=cliffColour(v[0],y,v[2],part.profile.seed);return [v[0],y,v[2],c.r,c.g,c.b];};
  const levels=v=>[0,-.045,-.16+.028*Math.sin(v[0]*5.2+v[2]*3.4+part.profile.seed*.11),-.3].map(y=>Math.max(v[1],y)),ya=levels(aa),yb=levels(bb);
  for(let i=0;i<3;i++){const ta=vertex(aa,ya[i]),tb=vertex(bb,yb[i]),ba=vertex(aa,ya[i+1]),bc=vertex(bb,yb[i+1]);emit(rows,ta,tb,bc,direction);emit(rows,ta,bc,ba,direction);}
 }return rows;
}
function boardCutaway(parts,neighbors,bottom){
 if(!Number.isFinite(bottom)||bottom>=-.31)throw Error('bottom must be below water');const occupied=new Set(neighbors.map(c=>c.join(','))),rows=[],exposed=[];
 for(const part of parts)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const {cx,cz}=part;if(occupied.has([cx+dx,cz+dz].join(',')))continue;exposed.push({cx,cz,dx,dz});const axis=dx?0:2,along=2-axis,value=dx||dz;
  for(const name of ['land','water']){const chain=edgeChain(part.rows[name],axis,value);if(chain.length<2)continue;
   const lo=chain[0][along],hi=chain.at(-1)[along],at=t=>{let k=0;while(k<chain.length-2&&chain[k+1][along]<t)k++;const a=chain[k],b=chain[k+1],f=clamp((t-a[along])/(b[along]-a[along]));return a.map((v,j)=>v+(b[j]-v)*f);};
   const top=chain.map(v=>({s:v[along],v:world(v,cx,cz)})),bands=[top],count=Math.max(2,Math.ceil((hi-lo)/.30));
   for(let band=1;band<=3;band++){const row=[];for(let j=0;j<=count;j++){
    const t=lo+(hi-lo)*j/count,ref=at(t),v=world(ref,cx,cz),f=[0,.23,.60,1][band];v[1]=ref[1]+(bottom-ref[1])*f;
    const depth=ref[1]-v[1],c=new T.Color().setRGB(...ref.slice(3)),body=name==='water'?new T.Color(0x239ac8).lerp(new T.Color(0x0b4e8c),smooth(f)):new T.Color(0xb99460).lerp(new T.Color(0x796347),smooth(f));
    body.multiplyScalar(.88+.22*hash(Math.round(v[0]*107+v[2]*173),Math.round(v[1]*157),7));c.lerp(body,1-Math.exp(-depth*(name==='water'?5:14)));v.splice(3,3,c.r,c.g,c.b);row.push({s:t,v});
   }bands.push(row);}
   for(let i=0;i<3;i++)strip(rows,bands[i],bands[i+1],()=>[dx,0,dz]);
  }
 }
 return {rows,exposed};
}
export function createCliffCoastTile({cx=0,cz=0,profile=makeCliffCoastProfile()}={}){
 const part=data(cx,cz,profile,'cliff'),g=new T.Group();for(const [name,rows] of Object.entries(part.rows))if(rows.length)g.add(makeMesh(rows,name==='cliff'?'cliff_face':name,name==='water'?MAT_WATER:MAT_TERRAIN));
 g.userData={cx,cz,cellSize:2,profile:profile.key,areas:part.areas,outline:part.outline,coastline:part.contours.map(line=>line.map(v=>[v[0],-.3,v[2]])),groundAnchor:getCliffGroundAnchor(cx,cz,profile),terrain:part.areas.water<1e-6?'land_context':part.areas.land<1e-6?'sea_context':'cliff_coast',rules:part.areas.water>1e-6&&part.areas.land>1e-6?CLIFF_COAST_RULES:null};return g;
}
export function createCliffCoastRegion(cells,{profile=makeCliffCoastProfile(),profileForCell=()=>profile,typeForCell=()=> 'cliff',cutaway=false,bottom=-.7,neighbors=cells}={}){
 if(!Array.isArray(cells)||!cells.length||cells.some(c=>!Array.isArray(c)||c.length!==2||!c.every(Number.isSafeInteger))||new Set(cells.map(c=>c.join(','))).size!==cells.length)throw Error('unique nonempty integer cell coordinates required');
 const parts=cells.map(([x,z])=>data(x,z,profileForCell(x,z),typeForCell(x,z))),rows={land:[],cliff:[],water:[]},shoulders=[],occupied=new Set(neighbors.map(c=>c.join(',')));
 for(const part of parts){for(const name of Object.keys(rows))for(const tri of part.rows[name])rows[name].push(tri.map(v=>world(v,part.cx,part.cz)));
  if(part.type==='cliff')for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=part.cx+dx,z=part.cz+dz;if(!occupied.has([x,z].join(','))||typeForCell(x,z)!=='shoal')continue;
   const cap=shoulder(part,data(x,z,profileForCell(x,z),'shoal'),dx,dz);rows.cliff.push(...cap);if(cap.length)shoulders.push({cx:part.cx,cz:part.cz,dx,dz,triangles:cap.length});
  }
 }
 const group=new T.Group();for(const [name,r] of Object.entries(rows))if(r.length)group.add(makeMesh(r,name==='cliff'?'cliff_face':name,name==='water'?MAT_WATER:MAT_TERRAIN));
 let exposed=[];if(cutaway){const cut=boardCutaway(parts,neighbors,bottom);exposed=cut.exposed;if(cut.rows.length){const m=makeMesh(cut.rows,'board_cutaway',MAT_TERRAIN);m.userData={exposed,bottom,internalWalls:0};group.add(m);}}
 group.userData={cells:parts.map(p=>({cx:p.cx,cz:p.cz,profile:p.profile.key,type:p.type,areas:p.areas,groundAnchor:p.type==='cliff'?getCliffGroundAnchor(p.cx,p.cz,p.profile):null,rules:p.areas.land>1e-6&&p.areas.water>1e-6?(p.type==='cliff'?CLIFF_COAST_RULES:SHOAL_RULES):null})),cellSize:2,waterY:-.3,landY:0,bottom,cutaway,exposed,shoulders};return group;
}
export function getCliffCoastBoundary(cx,cz,{profile=makeCliffCoastProfile(),type='cliff'}={}){
 const part=data(cx,cz,profile,type),out=[];for(const [axis,value] of [[0,-1],[0,1],[2,-1],[2,1]])for(const name of ['land','water']){const chain=edgeChain(part.rows[name],axis,value);if(chain.length>1)out.push({name,points:chain.map(v=>world(v,cx,cz))});}
 if(type==='cliff')for(const line of part.contours)for(const p of [line[0],line.at(-1)])if(Math.abs(Math.abs(p[0])-1)<eps||Math.abs(Math.abs(p[2])-1)<eps)out.push({name:'cliff_step',points:[world([p[0],0,p[2]],cx,cz),world([p[0],-.3,p[2]],cx,cz)]});return out;
}
export function clearCliffCoastCache(){cache.clear();clearBlueprintCache();}
