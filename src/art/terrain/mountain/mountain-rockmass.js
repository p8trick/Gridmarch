import * as T from 'three';

// A small union of broad, tapered rock volumes. The exposed faces themselves
// form the hill; there is no ring wall hidden behind a necklace of boulders.
const EPS=1e-8,SEAM=.55,ROCK=[0xa49aa0,0x948c99,0xaea0a3,0x867f90,0xb3a6a3];
const plane=(x,y,z,d,kind='rock',tone=0)=>{const n=new T.Vector3(x,y,z),l=n.length();return {n:n.divideScalar(l),d:d/l,kind,tone};};
const distance=(p,q)=>q.n.x*p[0]+q.n.y*p[1]+q.n.z*p[2]-q.d;
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const vector=p=>new T.Vector3(...p);
const faceArea=poly=>{const normal=new T.Vector3();for(let i=1;i<poly.length-1;i++)normal.add(vector(poly[i]).sub(vector(poly[0])).cross(vector(poly[i+1]).sub(vector(poly[0]))));return normal.length()*.5;};
function rockFacets(poly,q,owner){
 const center=poly.reduce((s,p)=>s.add(vector(p)),new T.Vector3()).divideScalar(poly.length).toArray(),area=faceArea(poly),edgeLengths=poly.map((p,i)=>vector(p).distanceTo(vector(poly[(i+1)%poly.length]))),perimeter=edgeLengths.reduce((a,b)=>a+b,0);
 // Buried faces and narrow CSG slivers retain their original triangles.
 // Only visible, broad surfaces receive shaped inset facets.
 if(q.kind==='base'||Math.max(...poly.map(p=>p[1]))<.035||area<.009||4*area/perimeter<.065)return {triangles:poly.map((p,i)=>[center,p,poly[(i+1)%poly.length]]),refined:false,area};
 const dense=q.kind!=='grass'&&area>.045&&4*area/perimeter>.12,outer=poly.flatMap((p,i)=>dense?[p,mix(p,poly[(i+1)%poly.length],.46+.065*Math.sin(i*1.8+owner))]:[p]);
 const phase=owner*1.73+q.n.x*2.8-q.n.z*1.6;
 const radius=outer.map((_,i)=>.66+.035*Math.sin(phase+i*1.77)),baseDepth=q.kind==='grass'?Math.min(.012,Math.sqrt(area)*.05):Math.min(.043,Math.sqrt(area)*.11);
 const u=(Math.abs(q.n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).cross(q.n).normalize(),v=q.n.clone().cross(u),tilt=u.clone().multiplyScalar(Math.cos(phase)).addScaledVector(v,Math.sin(phase)),extent=Math.max(...outer.map(p=>vector(p).distanceTo(vector(center))));
 // A shallow broad central face and differently inclined bevels create actual
 // rock relief. Boundary vertices stay fixed, keeping neighbouring faces closed.
 let depth=baseDepth;
 for(let attempt=0;attempt<7;attempt++,depth*=.5){
  const displace=(p,amount)=>{const v=vector(p).addScaledVector(q.n,amount);v.x=T.MathUtils.clamp(v.x,-.985,.985);v.z=T.MathUtils.clamp(v.z,-.985,.985);v.y=Math.min(v.y,.82);return v.toArray();};
  const ring=outer.map((p,i)=>{const inner=mix(center,p,radius[i]),amount=q.kind==='grass'?.32:1+.30*vector(inner).sub(vector(center)).dot(tilt)/extent;return displace(inner,depth*amount);}),mid=displace(center,depth*.9);
  const triangles=[];for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;triangles.push([outer[i],outer[j],ring[j]],[outer[i],ring[j],ring[i]]);if(q.kind==='grass')triangles.push([ring[i],ring[j],mid]);}
  if(q.kind!=='grass'){
   const outline=ring.map(p=>{const d=vector(p).sub(vector(center));return new T.Vector2(d.dot(u),d.dot(v));});
   for(const face of T.ShapeUtils.triangulateShape(outline,[]))triangles.push(face.map(i=>ring[i]));
  }
  const valid=triangles.every(([a,b,c])=>{const n=vector(b).sub(vector(a)).cross(vector(c).sub(vector(a)));return n.lengthSq()>1e-13&&n.dot(q.n)>0&&(q.n.y<1e-8||n.y>=-1e-12);});
  if(valid&&depth>=.004)return {triangles,refined:true,dense,depth,area};
  if(depth<.004)break;
 }
 return {triangles:poly.map((p,i)=>[center,p,poly[(i+1)%poly.length]]),refined:false,area};
}
function clean(poly){
 const out=[];for(const p of poly)if(!out.length||new T.Vector3(...p).distanceToSquared(new T.Vector3(...out.at(-1)))>1e-16)out.push(p);
 if(out.length>1&&new T.Vector3(...out[0]).distanceToSquared(new T.Vector3(...out.at(-1)))<1e-16)out.pop();
 return out.length>=3?out:[];
}
function clip(poly,q,inside=true){
 const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a,q),db=distance(b,q),ia=inside?da<=EPS:da>=-EPS,ib=inside?db<=EPS:db>=-EPS;
  if(ia)out.push(a);if(ia!==ib)out.push(mix(a,b,da/(da-db)));
 }return clean(out);
}
function subtract(poly,planes){
 let overlap=poly;for(const q of planes){overlap=clip(overlap,q,true);if(!overlap.length)return [poly];}
 let remainder=poly;const visible=[];
 for(const q of planes){
  if(!remainder.length)break;
  if(remainder.some(p=>distance(p,q)>EPS)){const part=clip(remainder,q,false);if(part.length)visible.push(part);}
  remainder=clip(remainder,q,true);
 }return visible;
}
function volume({footprint,base=-.20,taper=.5,roofs,roofKind='grass',tone=0,bevels=[],shoulders=[]}){
 const planes=footprint.map((a,i)=>{
  const b=footprint[(i+1)%footprint.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=dz/l,nz=-dx/l,ny=Array.isArray(taper)?taper[i]:taper;
  return plane(nx,ny,nz,nx*a[0]+nz*a[1]+ny*base,'rock',tone+i%3);
 });
 for(const [edge,height,ny]of shoulders){
  const old=planes[edge],horizontal=Math.hypot(old.n.x,old.n.z),oldY=old.n.y/horizontal,d=old.d/horizontal;
  planes.push(plane(old.n.x/horizontal,ny,old.n.z/horizontal,d+(ny-oldY)*height,'rock',tone+edge%3+1));
 }
 for(const [sx,sz,h,cx=0,cz=0]of roofs)planes.push(plane(sx,1,sz,h+sx*cx+sz*cz,roofKind,tone));
 planes.push(plane(0,-1,0,-base,'base',tone));
 for(const q of bevels)planes.push(plane(...q,'rock',tone+2));
 // These affect only buried toes. Visible rocks stay inside the logical cell.
 planes.push(plane(1,0,0,.985),plane(-1,0,0,.985),plane(0,0,1,.985),plane(0,0,-1,.985));
 const vertices=[];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const a=planes[i],b=planes[j],c=planes[k],bc=b.n.clone().cross(c.n),det=a.n.dot(bc);if(Math.abs(det)<1e-9)continue;
  const v=bc.multiplyScalar(a.d).add(c.n.clone().cross(a.n).multiplyScalar(b.d)).add(a.n.clone().cross(b.n).multiplyScalar(c.d)).divideScalar(det),p=v.toArray();
  if(planes.every(q=>distance(p,q)<1e-7)&&!vertices.some(w=>v.distanceToSquared(new T.Vector3(...w))<1e-14))vertices.push(p);
 }
 const faces=[];
 for(const q of planes){
  const points=vertices.filter(p=>Math.abs(distance(p,q))<1e-7);if(points.length<3)continue;
  const center=points.reduce((s,p)=>s.add(new T.Vector3(...p)),new T.Vector3()).divideScalar(points.length),u=(Math.abs(q.n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).cross(q.n).normalize(),v=q.n.clone().cross(u);
  points.sort((a,b)=>{const pa=new T.Vector3(...a).sub(center),pb=new T.Vector3(...b).sub(center);return Math.atan2(pa.dot(v),pa.dot(u))-Math.atan2(pb.dot(v),pb.dot(u));});
  faces.push({plane:q,points});
 }return {planes,faces};
}
function chip(x,z,rx,rz,h,tone){
 const footprint=Array.from({length:5},(_,i)=>{const a=i*Math.PI*2/5+.2;return [x+rx*Math.cos(a),z+rz*Math.sin(a)];});
 return volume({footprint,taper:.5,roofs:[[.12,-.07,h,x,z],[0,0,h+.015]],roofKind:'rock',tone});
}
export function buildRockHillA(body,summit,grassColor){return buildRockHill(body,summit,grassColor,'A');}
export function buildRockHillB(body,summit,grassColor){return buildRockHill(body,summit,grassColor,'B');}
function buildRockHill(body,summit,grassColor,type){
 const masses=type==='B'?[
  // Two substantial lobes, joined by a lower saddle. Both crowns grow directly
  // out of the same hill; neither is a small stone placed on top of a platform.
  volume({footprint:[[-.26,-.63],[.04,-.92],[.49,-.86],[.83,-.54],[.91,-.08],[.70,.31],[.18,.27],[-.22,-.05]],taper:[.28,.22,.34,.32,.32,.30,.23,.21],shoulders:[[0,.65,.95],[1,.67,1],[2,.61,.95],[3,.66,1],[4,.63,.90]],roofs:[[.10,.18,.84,.35,-.28],[-.13,-.07,.822,.35,-.28],[0,0,.82]],tone:0}),
  volume({footprint:[[-.90,.04],[-.65,-.22],[-.24,-.18],[.13,.09],[.10,.52],[-.20,.89],[-.68,.86],[-.95,.49]],taper:[.21,.30,.30,.24,.32,.28,.21,.18],shoulders:[[0,.50,1],[3,.55,.95],[4,.50,1],[5,.46,.9],[6,.53,1]],roofs:[[.12,-.12,.722,-.43,.28],[-.12,.1,.708,-.43,.28],[0,0,.72]],tone:2}),
  volume({footprint:[[-.68,-.38],[-.25,-.66],[.36,-.47],[.66,.10],[.38,.69],[-.17,.79],[-.65,.50],[-.77,.05]],taper:[.19,.25,.27,.27,.20,.18,.17,.18],shoulders:[[0,.49,.90],[3,.48,.90],[4,.46,1],[5,.50,.85],[6,.48,.95]],roofs:[[.03,.055,.646,-.12,.05],[-.06,-.03,.64,-.12,.05],[0,0,.652]],tone:1}),
  volume({footprint:[[.45,-.76],[.82,-.65],[.98,-.24],[.91,.23],[.65,.40],[.47,.12]],taper:[.40,.58,.58,.48,.40,.38],roofs:[[.13,-.10,.47,.73,-.13],[0,0,.49]],roofKind:'rock',tone:3}),
  volume({footprint:[[.00,.39],[.46,.18],[.89,.40],[.78,.80],[.28,.97],[-.04,.77]],taper:[.32,.50,.55,.48,.36,.30],roofs:[[.08,.13,.40,.42,.59],[0,0,.43]],roofKind:'rock',tone:1}),
  volume({footprint:[[-.96,-.47],[-.64,-.64],[-.39,-.35],[-.41,.04],[-.71,.17],[-.97,-.10]],taper:[.30,.39,.44,.34,.30,.28],roofs:[[-.10,.12,.41,-.68,-.26],[0,0,.43]],roofKind:'rock',tone:2}),
  chip(-.80,.68,.10,.10,.14,3),chip(.72,.67,.11,.09,.16,0),chip(.56,-.76,.11,.08,.14,1)
 ]:[
  // Continuous grassy crest: the separate summit stone from A2.5 is removed.
  volume({footprint:[[-.88,-.50],[-.53,-.83],[.02,-.91],[.49,-.64],[.72,-.12],[.60,.48],[.05,.74],[-.62,.58],[-.87,.16]],taper:[.16,.26,.40,.51,.57,.34,.25,.16,.13],shoulders:[[0,.49,.9],[1,.55,1.05],[2,.64,1],[3,.50,.95],[4,.64,1.10],[5,.58,.95],[6,.62,.85],[7,.46,1.05],[8,.60,.8]],roofs:[[.10,.12,.823,-.1,-.1],[-.09,-.035,.82,-.1,-.1],[0,0,.82]],tone:0}),
  volume({footprint:[[-.92,.10],[-.55,-.10],[-.06,.09],[.10,.53],[-.18,.90],[-.65,.83],[-.93,.46]],taper:[.23,.28,.33,.30,.27,.22,.19],shoulders:[[0,.41,.95],[2,.45,1],[3,.40,.85],[4,.43,1.05],[5,.35,.9],[6,.46,.85]],roofs:[[.08,.16,.645,-.43,.35],[-.12,-.035,.635,-.43,.35],[0,0,.66]],tone:2}),
  volume({footprint:[[-.05,.03],[.49,-.09],[.95,.26],[.84,.77],[.32,.96],[-.13,.72],[-.34,.34]],taper:[.28,.36,.40,.33,.28,.27,.24],shoulders:[[1,.40,.95],[2,.36,1.1],[3,.48,.95],[4,.42,.90],[5,.49,1]],roofs:[[.13,.10,.68,.25,.36],[-.11,-.03,.66,.25,.36],[0,0,.69]],tone:1}),
  volume({footprint:[[.40,-.68],[.77,-.55],[.97,-.13],[.93,.25],[.57,.37],[.35,.05]],taper:[.36,.58,.60,.47,.40,.40],roofs:[[.12,-.1,.49,.68,-.08],[0,0,.51]],roofKind:'rock',tone:3}),
  volume({footprint:[[-.96,-.46],[-.70,-.63],[-.45,-.27],[-.54,.13],[-.85,.29],[-.98,-.03]],taper:[.28,.35,.42,.32,.28,.25],roofs:[[-.1,.12,.50,-.72,-.15],[0,0,.52]],roofKind:'rock',tone:1}),
  chip(-.68,.72,.12,.10,.16,3),chip(.77,.56,.10,.13,.15,0),chip(.65,-.60,.13,.08,.18,1)
 ];
 const grassSamples=[],depths=[],stats={primaryMasses:type==='B'?6:5,peaks:type==='B'?2:1,summitPebbles:0,footChips:3,exposedFaces:0,refinedFaces:0,refinedRockFaces:0,refinedGrassFaces:0,denseRockFaces:0,maxSurfaceRelief:0};
 function emit(poly,q,owner){
  if(poly.length<3)return;
  const center=poly.reduce((s,p)=>s.add(new T.Vector3(...p)),new T.Vector3()).divideScalar(poly.length).toArray();
  if(q.kind==='grass')grassSamples.push([center[0],center[2]]);
  const colored=p=>{
   if(q.kind==='grass')return grassColor(p[0],p[2]);
   const shade=.95+.075*Math.max(0,q.n.y),contact=Math.max(0,...masses.map((m,j)=>j===owner?0:Math.max(0,1-Math.max(...m.planes.map(k=>distance(p,k)))/.075)));
   return new T.Color(ROCK[q.tone%ROCK.length]).multiplyScalar(shade*(1-.10*contact));
  };
  const facets=rockFacets(poly,q,owner);if(facets.refined){stats.refinedFaces++;stats[q.kind==='grass'?'refinedGrassFaces':'refinedRockFaces']++;stats.denseRockFaces+=Number(facets.dense);depths.push(facets.depth);stats.maxSurfaceRelief=Math.max(stats.maxSurfaceRelief,...facets.triangles.flat().map(p=>Math.abs(distance(p,q))));}
  for(const triangle of facets.triangles)for(const [b,part]of [[body,clip(triangle,plane(0,1,0,SEAM))],[summit,clip(triangle,plane(0,1,0,SEAM),false)]]){
   for(let i=1;i<part.length-1;i++){const points=[part[0],part[i],part[i+1]],n=vector(points[1]).sub(vector(points[0])).cross(vector(points[2]).sub(vector(points[0])));if(n.lengthSq()>1e-12)b.tri(...points,points.map(colored));}
  }
 }
 for(let i=0;i<masses.length;i++)for(const face of masses[i].faces){
  let pieces=[face.points];
  for(let j=0;j<masses.length&&pieces.length;j++)if(j!==i){
   const same=masses[j].planes.some(q=>q.n.dot(face.plane.n)>1-1e-9&&Math.abs(q.d-face.plane.d)<EPS);
   if(same&&i<j)continue;
   pieces=pieces.flatMap(p=>subtract(p,masses[j].planes));
  }
  for(const p of pieces){stats.exposedFaces++;emit(p,face.plane,i);}
 }
 stats.baseReliefRange=[Math.min(...depths),Math.max(...depths)];return {grassSamples,stats};
}
