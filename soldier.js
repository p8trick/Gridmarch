import * as THREE from 'three';
/** Infantry reconstruction V5. Forward +Z, feet Y=0. Geometry-only materials.
 * Named rigid groups are editable parts, not a verified skeletal rig. */
export function createSoldier(options={}) {
 const root=new THREE.Group();root.name='Infantry_V5';
 const seed=options.seed??31;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.86,flatShading:true,...extra});
 const M={cloth:material('#ffffff',{vertexColors:true}),sand:material('#b8a87d'),rim:material('#8e835f'),olive:material('#797956'),web:material('#918967'),dark:material('#444739'),skin:material('#f4be8c'),skinSide:material('#e3ac7e'),nose:material('#e8af7e'),black:material('#282d29'),boot:material('#484438'),sole:material('#292b26'),gun:material('#242c32',{metalness:.25,roughness:.65}),gunEdge:material('#39434a',{metalness:.3}),eye:material('#242b2d'),camoWeb:material('#fff',{vertexColors:true})};
 const colors=['#b5a57c','#b5a57c','#c1b187','#8a8963','#777e5b','#99946d'].map(c=>new THREE.Color(c));
 const meshes=[];
 const group=(name,p=root)=>{let g=new THREE.Group();g.name=name;p.add(g);return g};
 function mesh(g,m,p,pos=[0,0,0],name=''){const o=new THREE.Mesh(g,m);o.position.set(...pos);o.name=name;o.castShadow=o.receiveShadow=true;p.add(o);meshes.push(o);return o;}
 const v=a=>new THREE.Vector3(...a);
 function geometry(positions,indices){let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(indices)g.setIndex(indices);g.computeVertexNormals();return g;}
 // A chamfered rectangular cross-section, wound counter-clockwise viewed from above.
 function outline(w,d,b=.05,z=0,x=0){b=Math.min(b,w*.4,d*.4);return [[-w/2+b,d/2],[w/2-b,d/2],[w/2,d/2-b],[w/2,-d/2+b],[w/2-b,-d/2],[-w/2+b,-d/2],[-w/2,-d/2+b],[-w/2,d/2-b]].map(p=>[p[0]+x,p[1]+z]);}
 function loft(rings){let pts=[],ids=[],N=8;rings.forEach(r=>outline(r.w,r.d,r.b??.07,r.z??0,r.x??0).forEach(p=>pts.push(p[0],r.y,p[1])));for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){let a=j*N+i,b=j*N+(i+1)%N,c=b+N,d=a+N;ids.push(a,b,d,b,c,d);}for(let i=1;i<7;i++){ids.push(0,i+1,i);let t=(rings.length-1)*8;ids.push(t,t+i,t+i+1);}return geometry(pts,ids);}
 function bevel(w,h,d,b=.03){b=Math.min(b,w*.28,h*.28,d*.28);return loft([{y:-h/2,w:w-2*b,d:d-2*b,b:b*.4},{y:-h/2+b,w,d,b},{y:h/2-b,w,d,b},{y:h/2,w:w-2*b,d:d-2*b,b:b*.4}]);}
 function box(p,pos,size,m=M.cloth,b=.03,name=''){return mesh(bevel(...size,b),m,p,pos,name);}
 function rod(p,a,b,r1,r2,m=M.dark,n=8){let A=v(a),B=v(b),D=B.clone().sub(A);let o=mesh(new THREE.CylinderGeometry(r2,r1,D.length(),n),m,p,A.add(B).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),D.normalize());return o;}
 function strap(p,points,width,thick=.035,m=M.web){for(let i=1;i<points.length;i++){let a=v(points[i-1]),b=v(points[i]),d=b.clone().sub(a);let o=box(p,a.add(b).multiplyScalar(.5).toArray(),[width,d.length()+.02,thick],m,.008);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}}
 // Extruded profiles retain actual openings in the stock, sight and rails.
 function profile(points,depth,m,parent,pos=[0,0,0],holes=[],name=''){let sh=new THREE.Shape();points.forEach((q,i)=>i?sh.lineTo(...q):sh.moveTo(...q));sh.closePath();for(const poly of holes){let h=new THREE.Path();poly.forEach((q,i)=>i?h.lineTo(...q):h.moveTo(...q));h.closePath();sh.holes.push(h);}let geo=new THREE.ExtrudeGeometry(sh,{depth,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1,curveSegments:1});geo.translate(0,0,-depth/2);return mesh(geo,m,parent,pos,name);}
 function rounded(p,pos,size,m,name=''){let o=mesh(new THREE.IcosahedronGeometry(1,1),m,p,pos,name);o.scale.set(...size);return o;}
 function tube(p,points,r,m,name=''){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)),8,r,7,false),m,p,[0,0,0],name);}
 // Cross-sections follow the bent garment, preserving elbow and shoulder volume.
 function sleeve(p,points,radii,name,m=M.cloth,depth=.9){let pts=[],ids=[],N=8;points.forEach((q,i)=>{let tangent=v(points[Math.min(i+1,points.length-1)]).sub(v(points[Math.max(0,i-1)])).normalize(),u=new THREE.Vector3(0,0,1).cross(tangent).normalize(),w=tangent.clone().cross(u).normalize();for(let j=0;j<N;j++){let ang=(j+.5)/N*Math.PI*2;let a=v(q).addScaledVector(u,Math.cos(ang)*radii[i]).addScaledVector(w,Math.sin(ang)*radii[i]*depth);pts.push(...a.toArray());}});for(let i=0;i<points.length-1;i++)for(let j=0;j<N;j++){let a=i*N+j,b=i*N+(j+1)%N,c=b+N,d=a+N;ids.push(a,b,d,b,c,d);}let t=(points.length-1)*N;for(let i=1;i<N-1;i++)ids.push(0,i+1,i,t,t+i,t+i+1);return mesh(geometry(pts,ids),m,p,[0,0,0],name);}
 // Broad polygon camouflage assigned in model space; no repeated bitmap bands.
 function hash(x,y,z){let t=Math.sin(x*127.1+y*311.7+z*74.7+seed*13.31)*43758.5453;return t-Math.floor(t);}
 function paint(g,worldMatrix,tint=1){let src=g.index?g.toNonIndexed():g,attr=src.attributes.position,out=[],cols=[],inverse=worldMatrix.clone().invert(),cell=.285;const cache=new Map();
 function seedAt(x,y,z){let key=x+','+y+','+z;if(!cache.has(key))cache.set(key,{p:new THREE.Vector3((x+.18+.64*hash(x,y,z))*cell,(y+.18+.64*hash(y,z,x))*cell,(z+.18+.64*hash(z,x,y))*cell),color:colors[Math.floor(hash(x+17,y+8,z-9)*colors.length)].clone().multiplyScalar(tint)});return cache.get(key);}
 function emit(poly,color){if(poly.length<3)return;for(let i=1;i<poly.length-1;i++){let A=poly[0],B=poly[i],C=poly[i+1];if(B.clone().sub(A).cross(C.clone().sub(A)).lengthSq()<1e-14)continue;for(const q of [A,B,C]){let local=q.clone().applyMatrix4(inverse);out.push(...local.toArray());cols.push(color.r,color.g,color.b);}}}
 function clip(poly,n,k){let ret=[];for(let i=0;i<poly.length;i++){let A=poly[i],B=poly[(i+1)%poly.length],da=A.dot(n)-k,db=B.dot(n)-k;let ina=da<=1e-9,inb=db<=1e-9;if(ina)ret.push(A);if(ina!==inb)ret.push(A.clone().lerp(B,da/(da-db)));}return ret;}
 function tri(A,B,C,level=0){if(Math.max(A.distanceTo(B),B.distanceTo(C),C.distanceTo(A))>.32&&level<4){let AB=A.clone().lerp(B,.5),BC=B.clone().lerp(C,.5),CA=C.clone().lerp(A,.5);tri(A,AB,CA,level+1);tri(AB,B,BC,level+1);tri(CA,BC,C,level+1);tri(AB,BC,CA,level+1);return;}let q=A.clone().add(B).add(C).multiplyScalar(1/3),ix=Math.floor(q.x/cell),iy=Math.floor(q.y/cell),iz=Math.floor(q.z/cell),seeds=[];for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(let z=iz-1;z<=iz+1;z++)seeds.push(seedAt(x,y,z));let near=Math.min(...seeds.map(s=>s.p.distanceTo(q))),rad=Math.max(A.distanceTo(q),B.distanceTo(q),C.distanceTo(q));
 for(const owner of seeds){if(owner.p.distanceTo(q)>near+2*rad)continue;let poly=[A,B,C];for(const other of seeds){if(other===owner)continue;let n=other.p.clone().sub(owner.p),k=(other.p.lengthSq()-owner.p.lengthSq())*.5;poly=clip(poly,n,k);if(poly.length<3)break;}emit(poly,owner.color);}}
 for(let i=0;i<attr.count;i+=3)tri(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(worldMatrix),new THREE.Vector3().fromBufferAttribute(attr,i+1).applyMatrix4(worldMatrix),new THREE.Vector3().fromBufferAttribute(attr,i+2).applyMatrix4(worldMatrix));let ng=geometry(out);ng.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));return ng;
 }
 const hips=group('hips');mesh(loft([{y:1.49,w:.98,d:.55,b:.075},{y:1.57,w:1.00,d:.57,b:.085},{y:1.72,w:.94,d:.57,b:.09},{y:1.88,w:.88,d:.55,b:.08}]),M.cloth,hips,[0,0,0],'jacket_hem');
 mesh(loft([{y:1.32,w:.28,d:.31,b:.065},{y:1.42,w:.64,d:.42,b:.075},{y:1.63,w:.86,d:.48,b:.08}]),M.cloth,hips,[0,0,0],'trouser_seat');
 for(let side of [-1,1]){let hem=box(hips,[side*.245,1.535,.286],[.40,.045,.025],M.rim,.008,'hem_seam');hem.rotation.z=side*.025;}
 const legs=[];
 for(const side of [-1,1]){let leg=group(side<0?'right_leg':'left_leg');legs.push(leg);let x=side*.28,kx=side*.36,ax=side*.445;
  mesh(loft([{y:.95,x:kx,w:.37,d:.38,b:.07,z:.035},{y:1.12,x:kx,w:.40,d:.40,b:.08,z:.005},{y:1.47,x:x+side*.025,w:.46,d:.45,b:.075,z:0},{y:1.65,x,w:.45,d:.45,b:.08}]),M.cloth,leg,[0,0,0],'trouser_thigh');
  mesh(loft([{y:.29,x:ax,w:.27,d:.28,b:.055},{y:.42,x:ax,w:.29,d:.30,b:.06},{y:.64,x:(ax+kx)/2,w:.34,d:.34,b:.07,z:-.01},{y:.88,x:kx,w:.35,d:.37,b:.075,z:.015},{y:1.04,x:kx,w:.37,d:.38,b:.07,z:.035}]),M.cloth,leg,[0,0,0],'trouser_shin');
  mesh(loft([{y:.715,w:.20,d:.075,b:.035,z:.21},{y:.78,w:.31,d:.13,b:.055,z:.225},{y:1.00,w:.30,d:.13,b:.052,z:.225},{y:1.075,w:.20,d:.075,b:.035,z:.21}]),M.dark,leg,[kx,0,0],'knee_pad');
  mesh(loft([{y:.755,w:.175,d:.025,b:.025,z:.265},{y:.81,w:.245,d:.044,b:.035,z:.288},{y:.975,w:.237,d:.044,b:.034,z:.288},{y:1.035,w:.165,d:.025,b:.022,z:.265}]),M.olive,leg,[kx,0,0],'knee_face');
  box(leg,[kx,1.05,.01],[.39,.065,.39],M.web,.018,'knee_upper_strap');box(leg,[(ax+kx)/2,.79,0],[.35,.063,.36],M.rim,.015,'knee_lower_strap');
  let pocket=box(leg,[x+side*.19,1.32,.045],[.15,.39,.34],M.cloth,.032,'cargo_pocket');pocket.rotation.z=side*-.045;box(leg,[x+side*.20,1.5,.06],[.16,.10,.35],M.web,.018);
  if(side<0){box(leg,[x,1.285,.035],[.46,.075,.455],M.olive,.018,'thigh_webbing');let holster=box(leg,[x-.22,1.315,.11],[.16,.37,.245],M.dark,.025,'thigh_holster');holster.rotation.z=-.07;box(leg,[x-.225,1.33,.24],[.115,.28,.045],M.olive,.018,'holster_flap');box(leg,[x-.225,1.525,.115],[.10,.10,.16],M.black,.015,'holster_belt_loop');}
  box(leg,[ax,.31,0],[.285,.085,.295],M.rim,.015,'ankle_cuff');
  const boot=group(side<0?'right_boot':'left_boot',leg);boot.position.set(ax,0,.055);boot.rotation.y=side*.14;boot.scale.set(.91,.86,.90);
  mesh(loft([{y:.025,w:.41,d:.66,b:.08,z:.105},{y:.075,w:.41,d:.66,b:.075,z:.105},{y:.20,w:.39,d:.64,b:.09,z:.105},{y:.27,w:.33,d:.39,b:.065,z:-.01},{y:.36,w:.30,d:.31,b:.055,z:-.02}]),M.boot,boot,[0,0,0],'boot_upper');
  box(boot,[0,.034,.105],[.42,.069,.67],M.sole,.034,'boot_sole');for(let j=0;j<4;j++){let lace=box(boot,[0,.277-j*.024,.09+j*.043],[.19,.018,.025],M.dark,.004);lace.rotation.x=-.4;}
 }
 const torso=group('torso');mesh(loft([{y:1.80,w:.85,d:.54,b:.08},{y:2.02,w:.90,d:.58,b:.09},{y:2.52,w:1.01,d:.59,b:.11},{y:2.75,w:1.03,d:.55,b:.14},{y:2.86,w:.96,d:.49,b:.14},{y:2.94,w:.57,d:.36,b:.10}]),M.cloth,torso,[0,0,0],'jacket');
 box(torso,[0,1.86,.025],[.97,.12,.61],M.dark,.025,'belt');for(let x of [-.35,-.17,.17,.35])box(torso,[x,1.86,.343],[.045,.14,.032],M.web,.008);box(torso,[0,1.86,.355],[.15,.11,.049],M.rim,.016);
 // Plate carrier shaped around the chest with chamfered upper corners.
 mesh(loft([{y:2.02,w:.77,d:.16,b:.035,z:.32},{y:2.18,w:.86,d:.19,b:.045,z:.32},{y:2.68,w:.80,d:.17,b:.05,z:.32},{y:2.83,w:.58,d:.14,b:.035,z:.31}]),M.camoWeb,torso,[0,0,0],'plate_carrier');
 box(torso,[0,2.64,.424],[.57,.26,.055],M.web,.024,'chest_panel');box(torso,[0,2.72,.463],[.27,.085,.017],M.rim,.01,'name_patch');
 for(let side of [-1,1]){strap(torso,[[side*.31,2.69,.43],[side*.35,2.85,.34],[side*.37,2.89,.13],[side*.35,2.90,-.08],[side*.29,2.83,-.32]],.14,.045,M.web);box(torso,[side*.335,2.78,.414],[.12,.095,.045],M.dark,.01,'strap_buckle');box(torso,[side*.335,2.78,.445],[.072,.047,.018],M.rim,.005);}
 for(let x of [-.27,0,.27]){let pouch=box(torso,[x,2.20,.447],[.23,.35,.18],M.web,.035,'magazine_pouch');pouch.rotation.z=-x*.055;box(torso,[x,2.365,.462],[.235,.09,.18],M.olive,.022);box(torso,[x,2.23,.546],[.043,.22,.015],M.rim,.005);box(torso,[x,2.36,.561],[.066,.03,.017],M.dark,.006);}
 for(let y of [2.47,2.53])for(let x of [-.22,0,.22])box(torso,[x,y,.425],[.17,.045,.028],M.rim,.004);
 for(let side of [-1,1]){box(torso,[side*.5,2.08,.02],[.19,.34,.36],M.olive,.035,'belt_pouch');box(torso,[side*.5,2.235,.035],[.19,.09,.36],M.web,.015);box(torso,[side*.51,2.10,.209],[.048,.20,.02],M.rim,.004);}
 // Backpack is tapered and attached close to the spine.
 const pack=group('backpack',torso);mesh(loft([{y:1.99,w:.59,d:.28,b:.055,z:-.47},{y:2.08,w:.75,d:.36,b:.07,z:-.47},{y:2.76,w:.74,d:.34,b:.075,z:-.45},{y:2.88,w:.59,d:.28,b:.06,z:-.44}]),M.olive,pack,[0,0,0],'pack_main');
 box(pack,[0,2.40,-.666],[.655,.77,.10],M.dark,.055,'pack_panel_piping');
 box(pack,[0,2.28,-.716],[.60,.46,.13],M.web,.045,'pack_lower_pocket');
 box(pack,[0,2.64,-.70],[.60,.28,.14],M.olive,.045,'pack_top_flap');
 box(pack,[0,2.52,-.786],[.56,.045,.022],M.rim,.008,'pack_flap_lip');
 box(pack,[0,2.08,-.72],[.58,.085,.15],M.olive,.022,'pack_bottom_seam');
 strap(pack,[[-.17,2.87,-.43],[-.17,2.94,-.47],[.17,2.94,-.47],[.17,2.87,-.43]],.05,.04,M.dark);
 for(let side of [-1,1]){box(pack,[side*.405,2.31,-.47],[.15,.56,.30],M.olive,.04,'pack_side_pocket');box(pack,[side*.405,2.58,-.48],[.15,.085,.29],M.rim,.018);strap(pack,[[side*.255,2.83,-.63],[side*.255,2.70,-.79],[side*.255,2.19,-.795],[side*.255,2.08,-.77]],.052,.026,M.olive);box(pack,[side*.255,2.20,-.817],[.072,.10,.028],M.dark,.009,'pack_buckle');box(pack,[side*.255,2.20,-.837],[.038,.05,.014],M.rim,.004);}
 for(let y of [2.22,2.39,2.58,2.72])for(let x of [-.18,0,.18])box(pack,[x,y,y>2.5?-.785:-.795],[.15,.05,.024],M.rim,.005,'pack_webbing');
 rod(torso,[0,2.89,0],[0,3.13,0],.175,.16,M.skin);let collar=box(torso,[0,2.895,-.015],[.40,.10,.37],M.olive,.045,'collar');for(let s of [-1,1]){let c=box(torso,[s*.145,2.91,.20],[.145,.15,.055],M.web,.015,'collar_flap');c.rotation.z=s*.38;}
 const head=group('head');head.scale.y=1.08;head.position.y=-.328;mesh(loft([{y:3.125,w:.49,d:.43,b:.075,z:.04},{y:3.18,w:.65,d:.59,b:.085,z:.025},{y:3.33,w:.735,d:.62,b:.11,z:.01},{y:3.57,w:.76,d:.64,b:.115,z:0},{y:3.74,w:.71,d:.60,b:.09,z:-.01}]),M.skin,head,[0,0,0],'face');
 for(let s of [-1,1]){box(head,[s*.397,3.40,-.005],[.09,.18,.14],M.skinSide,.035,'ear');box(head,[s*.18,3.43,.329],[.063,.13,.026],M.eye,.014,'eye');let brow=box(head,[s*.18,3.55,.328],[.205,.047,.03],M.black,.013,'eyebrow');brow.rotation.z=s*.09;}
 mesh(loft([{y:3.305,w:.045,d:.025,b:.008,z:.337},{y:3.33,w:.064,d:.075,b:.012,z:.367},{y:3.35,w:.058,d:.074,b:.012,z:.367},{y:3.405,w:.031,d:.025,b:.007,z:.332}]),M.skin,head,[0,0,0],'nose');
 // Anatomical helmet skirt: high over the eyes, low around ears and occiput.
 const N=16,hr=[{y:3.43,rx:.615,rz:.51},{y:3.63,rx:.60,rz:.515},{y:3.88,rx:.555,rz:.48},{y:4.065,rx:.43,rz:.375},{y:4.165,rx:.225,rz:.21}];let hp=[],hi=[];
 hr.forEach((r,j)=>{for(let i=0;i<N;i++){let a=(i+.5)/N*Math.PI*2+(j>1?(j%2?.075:-.055):0),co=Math.cos(a),si=Math.sin(a);let yy=r.y+(j>1?.012*Math.sin(a*3+j):0)+(j===0?.22*Math.max(0,co)+.035*Math.max(0,-co):0);hp.push(si*r.rx,yy,co*r.rz-.035);}});for(let j=0;j<hr.length-1;j++)for(let i=0;i<N;i++){let a=j*N+i,b=j*N+(i+1)%N;hi.push(a,b,a+N,b,b+N,a+N);}hp.push(0,4.195,-.035);for(let i=0;i<N;i++)hi.push((hr.length-1)*N+i,(hr.length-1)*N+(i+1)%N,hr.length*N);let shellGeo=geometry(hp,hi).toNonIndexed(),shellColors=[];for(let i=0;i<shellGeo.attributes.position.count;i+=3){let c=new THREE.Color('#b8a87d').multiplyScalar(.965+.065*hash(i,5,8));for(let j=0;j<3;j++)shellColors.push(c.r,c.g,c.b);}shellGeo.setAttribute('color',new THREE.Float32BufferAttribute(shellColors,3));mesh(shellGeo,material('#ffffff',{vertexColors:true}),head,[0,0,0],'helmet_shell');
 for(let i=0;i<N;i++){let a=(i+.5)/N*Math.PI*2,b=(i+1.5)/N*Math.PI*2;let ya=3.43+.22*Math.max(0,Math.cos(a))+.035*Math.max(0,-Math.cos(a)),yb=3.43+.22*Math.max(0,Math.cos(b))+.035*Math.max(0,-Math.cos(b));rod(head,[Math.sin(a)*.613,ya,Math.cos(a)*.514-.035],[Math.sin(b)*.613,yb,Math.cos(b)*.514-.035],.018,.018,M.rim,5);}
 // Fabric helmet band, rails, front mounting bracket and rear retention block.
 for(let i=0;i<N;i++){let a=(i+.5)/N*Math.PI*2,b=(i+1.5)/N*Math.PI*2;let q=box(head,[(Math.sin(a)+Math.sin(b))*.297,3.72,(Math.cos(a)+Math.cos(b))*.256-.035],[.245,.085,.04],M.rim,.008);q.rotation.y=(a+b)/2;}
 box(head,[0,3.79,.509],[.18,.31,.052],M.black,.012,'night_vision_mount');box(head,[0,3.81,.546],[.127,.232,.031],M.gun,.009);for(let s of [-1,1]){box(head,[s*.104,3.77,.51],[.047,.13,.044],M.dark,.013,'mount_side_lug');box(head,[s*.105,3.78,.538],[.022,.045,.018],M.gunEdge,.004);}box(head,[0,4.195,-.035],[.19,.022,.12],M.dark,.004);
 for(let s of [-1,1]){
 const railOutline=[[-.29,3.66],[-.29,3.79],[.08,3.79],[.29,3.62],[.22,3.56],[.035,3.68]];
 const railHoles=[-.20,-.11,-.02].map(z=>[[-s*(z-.024),3.71],[-s*(z+.024),3.71],[-s*(z+.024),3.755],[-s*(z-.024),3.755]]);
 let rail=profile(railOutline.map(([z,y])=>[-s*z,y]),.042,M.olive,head,[s*.576,0,0],railHoles,'helmet_arc_rail');rail.rotation.y=s*Math.PI/2;
 rod(head,[s*.565,3.66,.04],[s*.565,3.59,.245],.035,.035,M.dark,6);
 for(let z of [-.255,.075]){rod(head,[s*.600,3.69,z],[s*.62,3.69,z],.020,.020,M.dark,8);rod(head,[s*.621,3.69,z],[s*.626,3.69,z],.010,.010,M.rim,8);}
 box(head,[s*.415,3.397,-.072],[.11,.245,.25],M.dark,.055,'ear_cushion');box(head,[s*.46,3.41,-.09],[.061,.17,.18],M.olive,.038,'earcup_shell');
 strap(head,[[s*.415,3.53,.21],[s*.365,3.30,.235],[s*.285,3.185,.275],[s*.18,3.125,.292]],.048,.035,M.dark);strap(head,[[s*.415,3.39,-.12],[s*.31,3.20,.08],[s*.18,3.125,.292]],.044,.03,M.dark);box(head,[s*.30,3.22,.23],[.085,.065,.055],M.rim,.014,'chin_buckle');}
 mesh(loft([{y:3.09,w:.32,d:.135,b:.04,z:.21},{y:3.125,w:.43,d:.16,b:.05,z:.21},{y:3.17,w:.39,d:.14,b:.04,z:.23}]),M.dark,head,[0,0,0],'chin_cup');box(head,[0,3.365,-.30],[.67,.25,.17],M.dark,.06,'rear_retention');box(head,[0,3.73,-.56],[.23,.24,.055],M.olive,.022,'rear_helmet_mount');box(head,[0,3.73,-.596],[.145,.16,.022],M.rim,.01);
 const arms=group('arms');
 sleeve(arms,[[-.33,2.74,0],[-.50,2.70,0],[-.63,2.59,0],[-.72,2.43,.02],[-.79,2.28,.045],[-.75,2.21,.14],[-.59,2.22,.39],[-.43,2.25,.60]],[.18,.215,.215,.205,.19,.188,.175,.14],'right_sleeve');
 sleeve(arms,[[.33,2.74,0],[.50,2.70,0],[.63,2.59,0],[.72,2.43,.02],[.79,2.25,.075],[.74,2.12,.22],[.58,2.065,.43],[.43,2.02,.65]],[.18,.215,.215,.205,.19,.19,.17,.137],'left_sleeve');
 for(let s of [-1,1]){let patch=box(arms,[s*.67,2.56,.187],[.18,.21,.035],M.olive,.03,'sleeve_patch');patch.rotation.z=s*.25;}
 rod(arms,[-.47,2.24,.55],[-.40,2.26,.65],.149,.143,M.rim,8);rod(arms,[.48,2.04,.59],[.41,2.02,.68],.146,.14,M.rim,8);
 // Rifle rebuilt from the supplied equipment close-up. Local +X points forward.
 const weapon=group('rifle');weapon.position.set(.035,2.29,.70);weapon.rotation.z=-.59;
 profile([[-.43,-.045],[-.44,.09],[-.35,.115],[.015,.115],[.075,.065],[.065,-.045]],.15,M.gun,weapon,[0,0,0],[],'upper_receiver');
 profile([[-.40,-.04],[-.015,-.04],[-.04,-.15],[-.21,-.16],[-.27,-.095],[-.39,-.095]],.14,M.gun,weapon,[0,0,0],[],'lower_receiver');
 box(weapon,[-.27,.02,.085],[.27,.064,.023],M.gunEdge,.008,'receiver_side_plate');box(weapon,[-.16,.034,.10],[.12,.035,.012],M.black,.003,'ejection_port');
 for(let x of [-.35,-.08])rod(weapon,[x,-.027,.079],[x,-.027,.10],.013,.013,M.black,8);
 rod(weapon,[-.50,.04,0],[-.39,.04,0],.042,.042,M.gunEdge,8);
 profile([[-.86,-.10],[-.86,.14],[-.79,.15],[-.49,.09],[-.49,.025],[-.61,-.075],[-.77,-.10]],.11,M.gun,weapon,[0,0,0],[[[-.80,-.058],[-.63,-.028],[-.565,.045],[-.80,.092]]],'skeleton_stock');
 box(weapon,[-.86,.02,0],[.042,.25,.15],M.black,.018,'rubber_buttpad');rod(weapon,[-.79,.122,0],[-.51,.065,0],.027,.027,M.gunEdge,6);box(weapon,[-.64,-.075,0],[.07,.04,.09],M.black,.015,'stock_latch');
 // Guard is a physical open frame.
 profile([[-.36,-.085],[-.12,-.085],[-.12,-.205],[-.32,-.205]],.085,M.gun,weapon,[0,0,0],[[[-.32,-.115],[-.15,-.115],[-.15,-.17],[-.30,-.17]]],'trigger_guard');
 let grip=profile([[-.39,-.10],[-.29,-.12],[-.34,-.34],[-.46,-.30]],.13,M.gun,weapon,[0,0,0],[],'pistol_grip');for(let y of [-.20,-.25,-.29])box(weapon,[-.389+(y+.20)*.3,y,.073],[.075,.012,.01],M.black,.002);
 const mag=mesh(loft([{y:-.47,w:.17,d:.13,b:.013,x:-.036},{y:-.31,w:.19,d:.14,b:.013,x:-.073},{y:-.11,w:.20,d:.145,b:.012,x:-.105}]),M.gun,weapon,[0,0,0],'curved_magazine');
 for(let x of [-.16,-.11,-.06])strap(weapon,[[x,-.14,.078],[x+.018,-.29,.079],[x+.05,-.435,.071]],.014,.009,M.gunEdge);box(weapon,[-.037,-.469,0],[.19,.035,.145],M.gunEdge,.008,'magazine_base');
 rod(weapon,[.03,.025,0],[.69,.025,0],.061,.061,M.black,10);
 const slots=[];for(let x=.105;x<.59;x+=.076){slots.push([[x-.019,-.052],[x+.019,-.052],[x+.019,-.009],[x-.019,-.009]]);slots.push([[x-.020,.018],[x+.020,.018],[x+.020,.046],[x-.020,.046]]);}
 for(let z of [-.082,.082])profile([[.055,-.08],[.59,-.08],[.625,-.04],[.625,.065],[.58,.092],[.055,.092]],.014,M.gun,weapon,[0,0,z],slots,'perforated_handguard');
 box(weapon,[.335,.092,0],[.58,.037,.15],M.gunEdge,.008,'upper_rail_base');box(weapon,[.335,-.085,0],[.55,.032,.15],M.gun,.007,'lower_rail');
 for(let x=-.40;x<.625;x+=.047)box(weapon,[x,.132,0],[.027,.022,.16],M.gunEdge,.003,'rail_tooth');
 for(let x of [.045,.625])rod(weapon,[x-.015,.01,0],[x+.015,.01,0],.101,.101,M.gunEdge,10);
 rod(weapon,[.64,.015,0],[1.03,.015,0],.025,.022,M.gunEdge,10);rod(weapon,[1.025,.015,0],[1.14,.015,0],.036,.036,M.gun,10);
 for(let x of [1.05,1.085,1.12])for(let z of [-.035,.035])box(weapon,[x,.015,z],[.018,.028,.009],M.black,.003,'muzzle_slot');
 // Open triangular front sight frame and post.
 rod(weapon,[.66,.055,0],[.715,.235,0],.015,.015,M.gunEdge,6);rod(weapon,[.785,.055,0],[.715,.235,0],.015,.015,M.gunEdge,6);box(weapon,[.715,.225,0],[.09,.025,.055],M.gun,.005);box(weapon,[.715,.253,0],[.018,.057,.018],M.black,.003);
 // Two mounting rings, optical tube, turrets and recessed objective.
 for(let x of [-.235,-.015]){box(weapon,[x,.176,0],[.09,.075,.105],M.gun,.008,'scope_foot');rod(weapon,[x-.025,.241,0],[x+.025,.241,0],.077,.077,M.gunEdge,12);box(weapon,[x,.227,.075],[.075,.06,.03],M.gun,.008);rod(weapon,[x,.228,.09],[x,.228,.107],.012,.012,M.black,8);}
 rod(weapon,[-.34,.241,0],[.115,.241,0],.058,.058,M.gun,12);rod(weapon,[-.37,.241,0],[-.305,.241,0],.072,.072,M.gunEdge,12);rod(weapon,[.08,.241,0],[.18,.241,0],.077,.077,M.gun,12);
 let rim=mesh(new THREE.RingGeometry(.052,.077,12),M.gunEdge,weapon,[.183,.241,0],'scope_objective_rim');rim.rotation.y=Math.PI/2;rod(weapon,[.176,.241,0],[.178,.241,0],.050,.05,material('#263b42',{metalness:.5,roughness:.3}),12);
 rod(weapon,[-.12,.278,0],[-.12,.332,0],.035,.035,M.gunEdge,10);rod(weapon,[-.12,.33,0],[-.12,.345,0],.041,.041,M.black,10);rod(weapon,[-.12,.241,.035],[-.12,.241,.09],.03,.03,M.gunEdge,10);
 function glove(name,local,kind){const g=group(name,arms);let anchor=v(local).applyAxisAngle(new THREE.Vector3(0,0,1),weapon.rotation.z).add(weapon.position);g.position.copy(anchor);g.rotation.z=weapon.rotation.z;
 mesh(loft([{y:-.10,w:.15,d:.12,b:.04,z:-.015},{y:-.045,w:.22,d:.18,b:.055},{y:.045,w:.24,d:.19,b:.06},{y:.10,w:.19,d:.15,b:.045}]),M.boot,g,[0,0,0],'glove_palm');
 rounded(g,[-.025,.02,.063],[.10,.083,.055],M.boot,'glove_back');
 if(kind==='trigger'){for(let i=0;i<3;i++){let yy=-.065+i*.046;tube(g,[[-.03,yy,.065],[.065,yy,.10],[.12,yy+.012,.04],[.115,yy+.015,-.025]],.024,M.boot,'curled_finger');}tube(g,[[-.055,.08,.045],[.035,.09,.095],[.15,.095,.045]],.025,M.boot,'index_finger');tube(g,[[-.10,-.005,-.015],[-.14,.08,-.01],[-.06,.13,.025]],.035,M.boot,'thumb');}
 else{for(let i=0;i<4;i++){let x=-.078+i*.049;tube(g,[[x,-.055,.045],[x,.005,.12],[x,.10,.07],[x,.09,-.015]],.024,M.boot,'support_finger');}tube(g,[[-.11,-.02,-.01],[-.15,.055,.015],[-.08,.11,.02]],.034,M.boot,'support_thumb');}
 }
 glove('trigger_hand',[-.365,-.18,.095],'trigger');glove('support_hand',[.36,-.105,.09],'support');
 // Sling lies behind the weapon and remains attached to the shoulder.
 strap(torso,[[-.36,2.87,.37],[-.30,2.69,.44],[-.12,2.40,.48],[.23,2.07,.43]],.065,.022,M.dark);
 root.updateMatrixWorld(true);for(const o of meshes)if(o.material===M.cloth||o.material===M.camoWeb){o.geometry=paint(o.geometry,o.matrixWorld,o.material===M.camoWeb?.82:1);}
 root.userData={version:'5.0.0',forward:'+Z',height:4.21,rig:'named rigid groups, no skeletal animation',parts:{}};root.traverse(o=>{if(o.name)root.userData.parts[o.name]=o.uuid});root.userData.triangles=meshes.reduce((s,m)=>s+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3,0);root.userData.meshes=meshes.length;return root;
}
