import * as T from 'three';
import {createFinalCoast} from './coast-final.js';
import {createCliffCoastRegion,clearCliffCoastCache} from './cliff-coast-c1.js';
import {compactCoastMeshes,coastGeometryBytes,coastTriangleCount} from './coast-performance.js';
import {MAT_TERRAIN} from 'palette';
import {validateCoastCells} from './coast47-plan.js';

const key=c=>c.join(','),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const hash=(x,z,s)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(s,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
export function createCoast47SourceTile(plan,x,z,neighbors=plan.cells){return createCliffCoastRegion([[x,z]],{profile:plan.profileForCell(x,z),profileForCell:plan.profileForCell,typeForCell:plan.typeForCell,neighbors,cutaway:false});}
export function coast47EdgeSegments(group,x,z,dx,dz){
 const axis=dx?0:2,along=2-axis,value=(dx?x:z)*2+(dx||dz),out={land:[],water:[]},seen=new Set();
 group.traverse(m=>{
  if(!m.isMesh||m.name==='cliff_face')return;const name=m.name==='water'?'water':'land',p=m.geometry.attributes.position,c=m.geometry.attributes.color;
  for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
   const a=i+j,b=i+(j+1)%3;if(Math.abs(p.array[a*3+axis]-value)>1e-6||Math.abs(p.array[b*3+axis]-value)>1e-6)continue;
   let u=[p.getX(a),p.getY(a),p.getZ(a),c.getX(a),c.getY(a),c.getZ(a)],v=[p.getX(b),p.getY(b),p.getZ(b),c.getX(b),c.getY(b),c.getZ(b)];
   if(Math.abs(u[along]-v[along])<1e-8)continue;if(u[along]>v[along])[u,v]=[v,u];
   const id=name+':'+[...u,...v].map(v=>v.toFixed(8)).join(',');if(seen.has(id))continue;seen.add(id);out[name].push([u,v]);
  }
 });
 for(const rows of Object.values(out))rows.sort((a,b)=>a[0][along]-b[0][along]||a[1][along]-b[1][along]);
 return out;
}
function perimeterCutaway(plan,cells,neighbors,bottom){
 if(!Number.isFinite(bottom)||bottom>=-.31)throw Error('MT2: bottom must be below water');
 const occupied=new Set(neighbors.map(key)),positions=[],colours=[],exposed=[],runs=[];
 const emit=(a,b,c,dx,dz)=>{
  const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0];
  if(Math.hypot(nx,ny,nz)<1e-12)return;if(nx*dx+nz*dz<0)[b,c]=[c,b];for(const p of [a,b,c]){positions.push(...p.slice(0,3));colours.push(...p.slice(3,6));}
 };
 const bandColour=(v,top,name)=>{
  const depth=top[1]-v[1],f=clamp(depth/(top[1]-bottom)),c=new T.Color().setRGB(...top.slice(3,6)),body=name==='water'?new T.Color(0x239ac8).lerp(new T.Color(0x0b4e8c),smooth(f)):new T.Color(0xb99460).lerp(new T.Color(0x796347),smooth(f));
  body.multiplyScalar(.88+.22*hash(Math.round(v[0]*107+v[2]*173),Math.round(v[1]*157),plan.seed));c.lerp(body,1-Math.exp(-depth*(name==='water'?5:14)));return [...v,c.r,c.g,c.b];
 };
 try{for(const [x,z] of cells){
  const sides=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>!occupied.has(key([x+dx,z+dz])));if(!sides.length)continue;
  const part=createCoast47SourceTile(plan,x,z,neighbors);
  for(const [dx,dz] of sides){
   const along=dx?2:0;exposed.push({cx:x,cz:z,dx,dz});
   for(const [name,segments] of Object.entries(coast47EdgeSegments(part,x,z,dx,dz))){
    // A single edge may alternate water/land/water. Separate connected runs;
    // never bridge the empty interval with a fictitious flat cutaway rim.
    const groups=[];for(const s of segments){const last=groups.at(-1);if(!last||s[0][along]>last.hi+1e-6)groups.push({segments:[s],lo:s[0][along],hi:s[1][along]});else{last.segments.push(s);last.hi=Math.max(last.hi,s[1][along]);}}
    for(const run of groups){
     const {lo,hi}=run;if(hi-lo<1e-7)continue;runs.push({cx:x,cz:z,dx,dz,surface:name,lo,hi});
     const top=run.segments.flatMap(s=>s.map(v=>({s:v[along],v}))),at=t=>{
      const segment=run.segments.find(([a,b])=>t>=a[along]-1e-7&&t<=b[along]+1e-7)||run.segments.at(-1),[a,b]=segment,f=clamp((t-a[along])/(b[along]-a[along]));return a.map((v,k)=>v+(b[k]-v)*f);
     },bands=[top],count=Math.max(2,Math.ceil((hi-lo)/.3));
     for(const f of [.23,.60,1]){const row=[];for(let i=0;i<=count;i++){const t=lo+(hi-lo)*i/count,p=at(t),v=[p[0],p[1]+(bottom-p[1])*f,p[2]];row.push({s:t,v:bandColour(v,p,name)});}bands.push(row);}
     for(let b=0;b<3;b++){const a=bands[b],c=bands[b+1];let i=0,j=0;while(i<a.length-1||j<c.length-1){if(j===c.length-1||i<a.length-1&&a[i+1].s<=c[j+1].s){emit(a[i].v,a[i+1].v,c[j].v,dx,dz);i++;}else{emit(a[i].v,c[j+1].v,c[j].v,dx,dz);j++;}}}
    }
   }
  }
  part.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
 }}finally{clearCliffCoastCache();}
 if(!positions.length)return null;
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colours,3));g.computeVertexNormals();
 const mesh=new T.Mesh(g,MAT_TERRAIN);mesh.name='board_cutaway';mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={exposed,runs,bottom,internalWalls:0};return mesh;
}

export function createCoast47(plan,{cells=plan?.cells,neighbors=plan?.cells,edition='performance',cutaway=false,bottom=-.7}={}){
 if(plan?.version!=='MT2')throw Error('MT2: planCoast47 result required');validateCoastCells(cells,'render cells');validateCoastCells(neighbors,'neighbors');
 const allowed=new Set(plan.cells.map(key)),occupied=new Set(neighbors.map(key));if(cells.some(c=>!allowed.has(key(c))||!occupied.has(key(c))))throw Error('MT2: render cells must be in both the complete plan and neighbors');
 const base=createFinalCoast(plan.coastType==='shoal'?'shoal':'cliff',cells,{profile:plan.profileForCell(...cells[0]),profileForCell:plan.profileForCell,...(plan.coastType==='mixed'?{typeForCell:plan.typeForCell}:{}),edition,cutaway:false,neighbors}),group=base.group;
 for(const m of group.userData.cells){const r=plan.recordAt(m.cx,m.cz);Object.assign(m,{kind:r.kind,mask:r.mask,atlasIndex:r.atlasIndex,terrain:r.terrain,rules:r.rules,logicalCellSize:2,stationDiscValidated:false});}
 // Expanded elbow/islet shapes need not contain the logical centre. Supply a
 // point on an actual dry triangle, not a claim that a whole unit fits there.
 const metadata=new Map(group.userData.cells.map(m=>[`${m.cx},${m.cz}`,m])),anchors=new Map();
 for(const mesh of base.surfaces){
  const g=mesh.geometry,p=g.attributes.position,ranges=mesh.userData.coastSources||[{name:mesh.name,firstTriangle:0,triangles:(g.index?.count||p.count)/3}];
  for(const range of ranges){if(!['land','grass','sand'].includes(range.name))continue;
   for(let i=range.firstTriangle*3;i<(range.firstTriangle+range.triangles)*3;i+=3){
    const ids=[0,1,2].map(k=>g.index?g.index.getX(i+k):i+k),x=ids.reduce((s,j)=>s+p.getX(j)/3,0),y=ids.reduce((s,j)=>s+p.getY(j)/3,0),z=ids.reduce((s,j)=>s+p.getZ(j)/3,0),cx=Math.floor(x/2+.5),cz=Math.floor(z/2+.5),id=`${cx},${cz}`,m=metadata.get(id);
    if(!m||m.terrain==='sea')continue;const u=x-cx*2,v=z-cz*2,clearance=Math.min(1-Math.abs(u),1-Math.abs(v)),shore=Math.max(0,Math.min(.8,-plan.profileForCell(cx,cz).distance(x,z))),score=y*5+clearance*.4+shore*.5-Math.hypot(u,v)*.1;
    if(!anchors.has(id)||score>anchors.get(id).score)anchors.set(id,{score,point:[u,y,v]});
   }
  }
 }
 for(const [id,m] of metadata){m.groundAnchor=anchors.get(id)?.point||null;m.anchorPointValidated=!!m.groundAnchor;}
 group.userData.topologyVersion='MT2';group.userData.coastMode=plan.coastType;
 let edge=null,rawBytes=0,disposed=false;
 const alive=()=>{if(disposed)throw Error('MT2 coast component disposed');};
 const api={group,surfaces:base.surfaces,plan,edition,type:plan.coastType,hasBoundary:base.hasBoundary,get cutaway(){return edge;},
  setCutawayEnabled(enabled){alive();if(enabled&&base.hasBoundary&&!edge){const raw=perimeterCutaway(plan,cells,neighbors,bottom);if(raw){rawBytes=coastGeometryBytes(raw);edge=edition==='performance'?compactCoastMeshes([raw])[0]:raw;if(edge!==raw)raw.geometry.dispose();edge.name='board_cutaway';group.add(edge);}}if(edge)edge.visible=!!enabled;group.userData.cutaway=!!edge?.visible;return edge;},
  releaseCutaway(){alive();if(edge){group.remove(edge);edge.geometry.dispose();edge=null;}rawBytes=0;group.userData.cutaway=false;},
  stats(){alive();const s=base.stats(),visible=!!edge?.visible;return {...s,type:plan.coastType,triangles:s.triangles+(visible?coastTriangleCount(edge):0),meshes:s.meshes+(visible?1:0),geometryBytes:s.geometryBytes+(edge?coastGeometryBytes(edge):0),referenceMeshes:s.referenceMeshes+(visible?1:0),referenceGeometryBytes:s.referenceGeometryBytes+rawBytes,cutawayLoaded:!!edge,cutawayVisible:visible,indexBits:[...new Set([...s.indexBits,...(edge?[edge.geometry.index?edge.geometry.index.array.BYTES_PER_ELEMENT*8:0]:[])])]};},
  dispose(){if(disposed)return;api.releaseCutaway();base.dispose();disposed=true;}
 };if(cutaway)api.setCutawayEnabled(true);return api;
}
