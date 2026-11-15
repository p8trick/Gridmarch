import * as THREE from 'three';
import {attachVehicleAnimations} from './animation/vehicle-animation.js';
import {instanceMovingParts} from './animation/instance-moving-parts.js';
import {createTrackPath} from './light-track-v1_4.js';

// Light reconnaissance tank V1.4. +Y up, +Z forward, ground at Y=0. Geometry only.
// Dimensions are stylized gameplay units, not measurements of a real vehicle.
export function createTank({faction='sand', batch=true, paint=true, optimized=false}={}) {
  const root=new THREE.Group(); root.name=optimized?'LightTank_Animated_Performance':'LightTank_Animated_Original';
  const palette={sand:['#b9a16c','#cbb583','#8b784f'],blue:['#527ca9','#7199c2','#3c5e86'],red:['#ae5149','#cc6a5e','#843b36'],green:['#7c8750','#a0aa68','#5b673b']};
  const mats={};
  const mat=(name,color,extra={})=>mats[name]=new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...extra});
  const colors=palette[faction]||palette.sand;
  mat('armor',colors[0],{vertexColors:true});mat('light',colors[1]);mat('shade',colors[2]);
  mat('rubber','#303338');mat('tread','#42464b',{metalness:.18});mat('edge','#555956',{metalness:.22});
  mat('well','#5d5844');mat('opticsBody',colors[0]);mat('steel','#6c6d61',{metalness:.2});
  mat('olive','#62664e');mat('glass','#293b43',{metalness:.25,roughness:.36});mat('black','#171e22');
  mat('lamp','#e6d6a2',{emissive:'#e6d6a2',emissiveIntensity:.1});mat('amber','#b3733e');mat('tail','#9c4a3d');
  const hull=new THREE.Group();hull.name='hull';root.add(hull);
  const turret=new THREE.Group();turret.name='turret';turret.position.set(0,1.105,-.34);root.add(turret);
  const movingNodes=new Set(),sides={};
  const gun=new THREE.Group();gun.name='gun';gun.position.set(0,.255,.89);turret.add(gun);
  const recoil=new THREE.Group();recoil.name='barrel_recoil';gun.add(recoil);
  function add(geometry,material,parent,pos=[0,0,0],name='') {const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function geom(pos,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();return g;}
  // Rings run clockwise in XZ, so their top-facing normals are +Y.
  function outline(w,d,b=.07,z=0){return [[-w/2+b,d/2+z],[w/2-b,d/2+z],[w/2,d/2-b+z],[w/2,-d/2+b+z],[w/2-b,-d/2+z],[-w/2+b,-d/2+z],[-w/2,-d/2+b+z],[-w/2,d/2-b+z]];}
  function loft(rings,variation=false){let p=[],ids=[];const N=rings[0].points.length;rings.forEach(r=>r.points.forEach(q=>p.push(q[0],r.y+(q[2]||0),q[1])));for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=b+N,d=a+N;ids.push(a,b,d,b,c,d);}for(let i=1;i<N-1;i++){ids.push(0,i+1,i);let t=(rings.length-1)*N;ids.push(t,t+i,t+i+1);}let g=geom(p,ids);if(variation){g=g.toNonIndexed();let c=[];for(let i=0;i<g.attributes.position.count;i+=3){const shade=[1,.96,1.025,.985,.94,1.01][Math.floor(i/6)%6];for(let j=0;j<3;j++)c.push(shade,shade,shade);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();}return g;}
  function bevel(w,h,d,b=.035){b=Math.min(b,w*.24,h*.24,d*.24);return loft([{y:-h/2,points:outline(w-2*b,d-2*b,b*.4)},{y:-h/2+b,points:outline(w,d,b)},{y:h/2-b,points:outline(w,d,b)},{y:h/2,points:outline(w-2*b,d-2*b,b*.4)}]);}
  function box(parent,pos,size,material=mats.armor,b=.025,name=''){return add(b<=.018?new THREE.BoxGeometry(...size):bevel(...size,b),material,parent,pos,name);}
  function rod(parent,a,b,r,material=mats.edge,n=8){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),delta=B.clone().sub(A);const m=add(new THREE.CylinderGeometry(r,r,delta.length(),n),material,parent,A.clone().add(B).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  function cyl(parent,pos,rt,rb,h,material,axis='y',n=12,open=false){let o=add(new THREE.CylinderGeometry(rt,rb,h,n,1,open),material,parent,pos);if(axis==='x')o.rotation.z=-Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;}

  function slab(parent,points,y0,y1,material=mats.armor,name=''){
    return add(loft([{y:y0,points},{y:y1,points}],true),material,parent,[0,0,0],name);
  }
  // Revolve a radial/axial profile. Skip zero-area pole faces deliberately.
  function turned(profile,segments=16){
    const p=[],ids=[];for(let j=0;j<profile.length;j++)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;p.push(profile[j][0]*Math.sin(a),profile[j][1],profile[j][0]*Math.cos(a));}
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){let a=j*segments+i,b=j*segments+(i+1)%segments,c=b+segments,d=a+segments;if(profile[j][0]>1e-8)ids.push(a,b,d);if(profile[j+1][0]>1e-8)ids.push(b,c,d);}
    const g=geom(p,ids);let v=0;for(let i=0;i<ids.length;i+=3){const a=new THREE.Vector3().fromArray(p,ids[i]*3),b=new THREE.Vector3().fromArray(p,ids[i+1]*3),c=new THREE.Vector3().fromArray(p,ids[i+2]*3);v+=a.dot(b.cross(c));}if(v<0){for(let i=0;i<ids.length;i+=3)[ids[i+1],ids[i+2]]=[ids[i+2],ids[i+1]];g.setIndex(ids);g.computeVertexNormals();}return g;
  }
  function recessedDish(geometry){
    const g=geometry.toNonIndexed();geometry.dispose();const p=g.attributes.position,c=[];
    for(let i=0;i<p.count;i+=3){let radius=0,depth=0;for(let j=0;j<3;j++){radius+=Math.hypot(p.getX(i+j),p.getZ(i+j))/3;depth+=p.getY(i+j)/3;}
      const shade=radius>.063 && radius<.182 && depth<.003 ? .57 : radius>.182 ? 1.04 : .93;
      for(let j=0;j<3;j++)c.push(shade,shade,shade);
    }g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return g;
  }
  function wheelFace(parent,x,y,z,side,geometry,material){let m=add(geometry,material,parent,[x,y,z]);m.rotation.z=-side*Math.PI/2;return m;}
  function surfaceBox(parent,pos,size,normal,material,b=.025,name=''){
    let m=box(parent,pos,size,material,b,name);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal).normalize());return m;
  }

  // Bespoke shallow reconnaissance hull. All dimensions are native, no medium-hull scaling.
  add(loft([
    {y:.28,points:outline(1.18,2.96,.19,-.02)},
    {y:.49,points:outline(1.46,3.48,.19,0)},
    {y:.75,points:outline(1.49,3.52,.14,0)},
    {y:1.04,points:outline(1.43,2.56,.13,-.39)}
  ],true),mats.armor,hull,[0,0,0],'hull_core');
  box(hull,[0,1.025,-.38],[1.46,.065,2.53],mats.armor,.025,'central_deck');
  cyl(hull,[0,1.065,-.34],.60,.63,.09,mats.shade,'y',24);
  // Side-profile extrusion defines the rising rear engine shoulders and short front mudguard.
  function sidePanel(side,profile,x0,x1,material,name){
    const shape=new THREE.Shape();profile.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:x1-x0,bevelEnabled:false,steps:1,curveSegments:1});
    const a=g.attributes.position;for(let i=0;i<a.count;i++){const z=a.getX(i),y=a.getY(i),x=a.getZ(i)+x0;a.setXYZ(i,side*x,y,z);}
    // (z,y,x) swaps axes; the positive side needs reversed winding.
    if(side===1)for(let i=0;i<a.count;i+=3){const q=new THREE.Vector3().fromBufferAttribute(a,i+1);a.setXYZ(i+1,a.getX(i+2),a.getY(i+2),a.getZ(i+2));a.setXYZ(i+2,q.x,q.y,q.z);}
    g.computeVertexNormals();return add(g,material,hull,[0,0,0],name);
  }
  for(const side of [-1,1]){
    // Thin fender ribbon follows the wheel envelope; no continuous slab of heavy armor.
    sidePanel(side,[[1.80,.80],[1.58,.95],[1.17,.95],[.83,1.02],[-.86,1.02],[-1.64,1.04],[-1.75,.99],[-1.75,.90],[-1.46,.93],[-.82,.89],[.85,.89],[1.54,.89],[1.76,.74]],.67,1.12,mats.armor,'fender_ribbon');
    // Forward wedge / middle plate / raised engine box: three distinct silhouettes.
    sidePanel(side,[[1.27,.95],[.83,1.065],[.42,1.065],[.42,.87],[1.05,.87]],.69,1.065,mats.armor,'front_side_wedge');
    sidePanel(side,[[1.00,.97],[.45,.97],[.45,.74],[.94,.74],[1.00,.80]],1.06,1.135,mats.armor,'forward_short_plate');
    sidePanel(side,[[.40,1.055],[-.55,1.055],[-.82,.99],[-.68,.76],[.40,.76]],.70,1.12,mats.armor,'middle_side_panel');
    sidePanel(side,[[-.55,1.055],[-.72,1.15],[-1.56,1.15],[-1.73,1.07],[-1.73,.93],[-.55,.93]],.69,1.09,mats.armor,'raised_engine_shoulder');
    box(hull,[side*1.139,.895,.425],[.012,.29,.014],mats.shade,.002,'side_panel_joint');
    box(hull,[side*1.112,1.095,-.73],[.013,.10,.014],mats.shade,.002,'engine_panel_joint');
    // Rear shallow continuation and separate dark equipment box.
    box(hull,[side*1.105,.92,-1.30],[.10,.17,.74],mats.shade,.02,'rear_side_strip');
    box(hull,[side*1.13,1.045,-1.31],[.13,.18,.56],mats.edge,.025,'rear_equipment_box');
    box(hull,[side*1.10,.86,.03],[.18,.36,.54],mats.olive,.025,'hull_tool_box');
    for(const z of [-.20,.25])rod(hull,[side*1.21,.72,z],[side*1.21,1.015,z],.018,mats.edge,6);
    for(const y of [.76,.97])rod(hull,[side*1.21,y,-.23],[side*1.21,y,.28],.018,mats.edge,6);
    for(const z of [-1.5,-1.12,-.68,.51,.87])cyl(hull,[side*1.14,.94,z],.018,.018,.015,mats.shade,'x',6);
    box(hull,[side*.91,1.105,.875],[.29,.13,.21],mats.edge,.02,'front_lamp_housing');
    box(hull,[side*.97,1.105,.987],[.075,.06,.012],mats.amber,.002);
    box(hull,[side*.85,1.105,.987],[.085,.06,.012],mats.lamp,.002);
    const normal=[0,.32,.95];
    surfaceBox(hull,[side*.51,.86,1.49],[.14,.075,.04],normal,mats.edge,.008);
    box(hull,[side*.89,1.175,-1.18],[.29,.045,.37],mats.light,.015);
  }
  // Driver hatch lies on the long nose slope.
  const hatch=box(hull,[-.29,1.057,.70],[.44,.05,.32],mats.light,.018);hatch.rotation.x=.19;
  box(hull,[-.29,1.105,.82],[.22,.065,.095],mats.edge,.01);
  box(hull,[-.29,1.108,.872],[.15,.026,.008],mats.glass,.002);

  // Chunky tracks: polygonal end arcs, individual pads, hinge tabs and recessed wheel dishes.
  const roadZ=.88,roadY=.36,roadRadius=.25,endZ=1.40,endY=.51,endRadius=.235;
  const belt=createTrackPath({roadZ,roadY,roadRadius,endZ,endY,endRadius,beltHalfThickness:.035,returnZ:roadZ*2/3,returnY:.535,returnRadius:.078});
  const trackLength=belt.length,trackPoint=belt.pointAt;
  // Place the lowest outside pad face at ground level, retaining all wheel-to-belt relations.
  const trackGroundOffset=-(roadY-roadRadius-.055-.058-.095/2);
  for(const side of [-1,1]){
    const track=new THREE.Group(),x=side*.88;track.name=side<0?'right_track':'left_track';track.position.y=trackGroundOffset;hull.add(track);
    const N=belt.contour.length,p=[],ids=[],outer=[],inner=[];
    for(let i=0;i<N;i++){let q=belt.contour[i];outer.push([q.z-q.dy*.035,q.y+q.dz*.035]);inner.push([q.z+q.dy*.035,q.y-q.dz*.035]);}
    for(const xx of [x-.205,x+.205])for(const contour of [outer,inner])contour.forEach(q=>p.push(xx,q[1],q[0]));
    function quad(a,b,c,d){ids.push(a,b,c,a,c,d);}
    for(let i=0;i<N;i++){let j=(i+1)%N;quad(i,j,2*N+j,2*N+i);quad(N+j,N+i,3*N+i,3*N+j);quad(j,i,N+i,N+j);quad(2*N+i,2*N+j,3*N+j,3*N+i);}
    let beltVolume=0;for(let i=0;i<ids.length;i+=3){const a=new THREE.Vector3().fromArray(p,ids[i]*3),b=new THREE.Vector3().fromArray(p,ids[i+1]*3),c=new THREE.Vector3().fromArray(p,ids[i+2]*3);beltVolume+=a.dot(b.cross(c));}
    if(beltVolume<0)for(let i=0;i<ids.length;i+=3)[ids[i+1],ids[i+2]]=[ids[i+2],ids[i+1]];
    add(geom(p,ids),mats.rubber,track);
    const pads=new THREE.Group(),links=new THREE.Group(),wheels=[];pads.name='moving_pads';links.name='moving_links';track.add(pads,links);movingNodes.add(pads);movingNodes.add(links);
    sides[side===1?'left':'right']={path:belt,belts:[],wheels,track};
    for(let i=0;i<42;i++){
      let q=trackPoint(trackLength*(i+.5)/42);
      let pad=add(bevel(.45,.065,.175,.012),mats.tread,pads,[x,q.y+q.dz*.042,q.z-q.dy*.042]);pad.rotation.x=-Math.atan2(q.dy,q.dz);
      // Thin connector plates stay inside the outer pad width.
      const link=box(links,[x+side*.195,q.y,q.z],[.06,.055,.19],mats.edge,.01);link.rotation.x=pad.rotation.x;
    }
    pads.children.forEach((object,i)=>sides[side===1?'left':'right'].belts.push({object,normalOffset:.042,phases:[trackLength*(i+.5)/42]}));
    links.children.forEach((object,i)=>sides[side===1?'left':'right'].belts.push({object,normalOffset:0,phases:[trackLength*(i+.5)/42]}));
    function rotatingWheel(y,z,radius,build){const first=track.children.length;build();const group=new THREE.Group();group.name='wheel_'+radius+'_'+z;group.position.set(x,y,z);const parts=track.children.slice(first);parts.forEach(o=>{o.position.sub(group.position);group.add(o);});track.add(group);movingNodes.add(group);wheels.push({object:group,radius});}
    // Three small return rollers support the visibly lowered upper run.
    for(const z of [-roadZ*2/3,0,roadZ*2/3]){rotatingWheel(.535,z,.078,()=>{
      cyl(track,[x,.535,z],.078,.078,.27,mats.rubber,'x',12);
      cyl(track,[x+side*.15,.535,z],.049,.049,.018,mats.edge,'x',10);
      cyl(track,[x+side*.165,.535,z],.019,.019,.02,mats.shade,'x',8);
    });}
    const dishProfile=[[0,-.07],[.275,-.07],[.288,-.04],[.288,.018],[.271,.037],[.245,.031],[.226,-.023],[.145,-.048],[.079,-.027],[.067,.018],[0,.018]];
    const tireProfile=[[.260,-.205],[.278,-.205],[.317,-.175],[.326,-.13],[.326,.14],[.312,.188],[.278,.205],[.260,.205],[.260,-.205]];
    for(let i=0;i<4;i++){
      const z=-roadZ+i*(2*roadZ/3),y=roadY;rotatingWheel(y,z,roadRadius,()=>{
      wheelFace(track,x,y,z,side,turned(tireProfile.map(([r,a])=>[r*(.25/.326),a*.78]),16),mats.rubber);
      wheelFace(track,x+side*.153,y,z,side,recessedDish(turned(dishProfile.map(([r,a])=>[r*(.25/.326),a*.78]),16)),mats.armor);
      cyl(track,[x+side*.18,y,z],.048,.048,.026,mats.shade,'x',10);
    });}
    for(const z of [-endZ,endZ]){
      const y=endY;rotatingWheel(y,z,endRadius,()=>{
      wheelFace(track,x,y,z,side,turned([[.235,-.20],[.27,-.20],[.31,-.16],[.31,.16],[.27,.20],[.235,.20],[.235,-.20]].map(([r,a])=>[r*(.235/.31),a*.78]),14),mats.rubber);
      wheelFace(track,x+side*.15,y,z,side,turned([[0,-.04],[.25,-.04],[.27,-.01],[.27,.025],[.23,.035],[.19,-.016],[.10,-.025],[.075,.02],[0,.02]].map(([r,a])=>[r*(.235/.31),a*.78]),14),mats.shade);
      cyl(track,[x+side*.18,y,z],.092,.092,.035,mats.armor,'x',10);
    });}
  }

  // Include rotated pad corners when seating each complete track on the ground.
  for(const track of hull.children.filter(o=>o.name==='left_track'||o.name==='right_track')){
    track.updateWorldMatrix(true,true);track.position.y-=new THREE.Box3().setFromObject(track).min.y;
  }

  // Shallow rear face with inset central louvers and separate narrow vertical vents.
  box(hull,[0,.79,-1.72],[1.43,.48,.10],mats.armor,.03,'rear_plate');
  box(hull,[0,.86,-1.779],[.54,.25,.035],mats.shade,.008);
  for(let i=0;i<6;i++)box(hull,[0,.76+i*.037,-1.802],[.47,.015,.02],mats.steel,.002);
  for(const side of [-1,1]){
    box(hull,[side*.55,.86,-1.79],[.18,.30,.06],mats.edge,.018);
    for(let i=0;i<5;i++)box(hull,[side*.55,.76+i*.044,-1.827],[.11,.018,.009],mats.black,.002);
    box(hull,[side*.91,1.04,-1.73],[.34,.13,.09],mats.edge,.017);
    box(hull,[side*.93,1.04,-1.78],[.21,.065,.012],mats.tail,.002);
    box(hull,[side*1.01,.85,-1.72],[.28,.20,.075],mats.armor,.015);
    cyl(hull,[side*.38,.58,-1.79],.035,.035,.07,mats.edge,'z',8);
  }
  for(let i=0;i<7;i++)box(hull,[0,1.047,-1.15-i*.065],[.57,.02,.026],mats.shade,.002);

  // Twelve-point rings add explicit side-profile breaks at the front and rear of the belly.
  function turretOutline(w,d,b,z=0){
    const f=d/2+z,r=-d/2+z;
    return [[-w/2+b,f],[w/2-b,f],[w/2,f-b],[w/2,.48],[w/2,-.38],[w/2,r+b],
      [w/2-b,r],[-w/2+b,r],[-w/2,r+b],[-w/2,-.38],[-w/2,.48],[-w/2,f-b]];
  }
  const bellyY=z=>z>.48?.025+(z-.48)*.27:z<-.38?.025+(-z-.38)*.24:.025;
  const belly=turretOutline(1.27,1.94,.25,-.02).map(([x,z])=>[x,z,bellyY(z)]);
  const waist=turretOutline(1.40,2.02,.28,-.02).map(([x,z])=>[x,z,Math.max(.11,bellyY(z)+.055)]);
  // Thin bearing remains beneath the low center; raised ends belong to the shell itself.
  cyl(turret,[0,0,0],.58,.60,.04,mats.edge,'y',24);
  add(loft([
    {y:0,points:belly},
    {y:0,points:waist},
    {y:.40,points:turretOutline(1.13,1.78,.23,-.09)},
    {y:.44,points:turretOutline(1.04,1.64,.21,-.12)}
  ],true),mats.armor,turret,[0,0,0],'turret_shell');
  for(const side of [-1,1]){
    surfaceBox(turret,[side*.40,.30,.90],[.10,.15,.04],[side*.12,.36,.92],mats.edge,.008);
    box(turret,[side*.69,.255,-.06],[.18,.27,.49],mats.olive,.028,'side_stowage');
    for(const z of [-.25,.15])rod(turret,[side*.80,.14,z],[side*.80,.39,z],.017,mats.edge,6);
    for(const y of [.16,.36])rod(turret,[side*.80,y,-.29],[side*.80,y,.19],.017,mats.edge,6);
    box(turret,[side*.73,.255,-.06],[.19,.03,.46],mats.steel,.008);
  }
  for(const side of [-1,1]){
    box(turret,[side*.65,.28,-.72],[.21,.20,.34],mats.edge,.025,'rear_turret_bin');
    box(turret,[side*.62,.43,-.64],[.23,.16,.25],mats.armor,.02);
  }
  box(turret,[0,.29,-1.04],[.90,.19,.16],mats.armor,.03);
  cyl(turret,[.23,0.460,-.24],.17,.19,.06,mats.shade,'y',12);
  cyl(turret,[.23,0.498,-.24],.15,.16,.025,mats.armor,'y',12);
  rod(turret,[.16,0.530,-.24],[.28,0.530,-.24],.012,mats.edge,6);
  box(turret,[-.25,0.480,.05],[.32,.06,.30],mats.shade,.02);
  cyl(turret,[-.25,0.540,.05],.10,.12,.09,mats.edge,'y',12);
  box(turret,[-.25,0.710,.05],[.30,.29,.29],mats.armor,.025,'commander_sight_housing');
  box(turret,[-.25,0.710,.204],[.25,.23,.028],mats.edge,.014);
  cyl(turret,[-.25,0.710,.225],.081,.081,.02,mats.black,'z',12);
  cyl(turret,[-.25,0.710,.238],.057,.057,.009,mats.glass,'z',12);
  box(turret,[.12,0.470,.37],[.24,.06,.13],mats.shade,.015);
  cyl(turret,[.46,0.480,-.88],.06,.08,.12,mats.armor,'y',10);
  cyl(turret,[.46,0.570,-.88],.037,.045,.09,mats.edge,'y',8);
  rod(turret,[.46,0.610,-.88],[.46,1.30,-.88],.009,mats.edge,6);
  // Thin, mostly constant-diameter barrel; recessed dark muzzle.
  box(gun,[0,0,.07],[.33,.30,.32],mats.armor,.055,'mantlet');
  cyl(gun,[0,0,.25],.105,.105,.12,mats.edge,'z',10);
  cyl(gun,[0,0,.43],.077,.091,.25,mats.armor,'z',10);
  cyl(gun,[0,0,1.10],.056,.073,1.12,mats.armor,'z',10);
  for(const z of [.70,1.28])cyl(gun,[0,0,z],.079,.079,.035,mats.shade,'z',10);
  // Parallel-sided sleeve with a narrow circumferential joint and deep visible bore.
  add(turned([[.044,-.12],[.080,-.12],[.080,.015],[.077,.015],[.077,.032],[.080,.032],[.080,.13],[.044,.13],[.044,-.12]],12),mats.edge,gun,[0,0,1.77],'muzzle_sleeve').rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(.044,12),mats.black,gun,[0,0,1.675],'muzzle_bore');

  // Separate the barrel from the fixed mantlet before rigid merging.
  for(const o of [...gun.children])if(o.isMesh&&o.name!=='mantlet')recoil.add(o);
  const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(0,0,1.90);recoil.add(muzzle);

  // Large, quiet polygonal paint patches; the armor geometry retains its exact silhouette.
  // A deterministic 3D Voronoi field keeps colors continuous across adjacent surfaces.
  function paintArmor(mesh){
    const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    const attr=source.attributes.position,world=mesh.matrixWorld,inverse=world.clone().invert();
    const positions=[],colors=[],cache=new Map(),cell=.66;
    const shadeValues=[1.08,1.00,.94,.78,1.04,.88,1.12,1.00];
    const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7+31)*43758.5453;return v-Math.floor(v);};
    function seed(x,y,z){const key=x+','+y+','+z;if(!cache.has(key))cache.set(key,{p:new THREE.Vector3((x+.15+.7*hash(x,y,z))*cell,(y+.15+.7*hash(x+9,y,z))*cell,(z+.15+.7*hash(x,y+13,z))*cell),shade:shadeValues[Math.floor(hash(x+8,y-7,z+4)*shadeValues.length)]});return cache.get(key);}
    function clip(poly,n,k){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a.dot(n)-k,db=b.dot(n)-k,ia=da<=1e-10,ib=db<=1e-10;if(ia)result.push(a);if(ia!==ib)result.push(a.clone().lerp(b,da/(da-db)));}return result;}
    function emit(poly,shade){for(let i=1;i<poly.length-1;i++){const a=poly[0],b=poly[i],c=poly[i+1];if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-14)continue;for(const v of [a,b,c]){positions.push(...v.clone().applyMatrix4(inverse).toArray());colors.push(shade,shade,shade);}}}
    function triangle(a,b,c,depth=0){if(depth<3&&Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>.95){const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;}
      const q=a.clone().add(b).add(c).multiplyScalar(1/3),ix=Math.floor(q.x/cell),iy=Math.floor(q.y/cell),iz=Math.floor(q.z/cell),seeds=[];
      for(let x=ix-1;x<=ix+1;x++)for(let y=iy-1;y<=iy+1;y++)for(let z=iz-1;z<=iz+1;z++)seeds.push(seed(x,y,z));
      const distance=Math.min(...seeds.map(s=>s.p.distanceTo(q))),radius=Math.max(q.distanceTo(a),q.distanceTo(b),q.distanceTo(c));
      for(const owner of seeds){if(owner.p.distanceTo(q)>distance+2*radius)continue;let poly=[a,b,c];for(const other of seeds){if(owner===other)continue;const n=other.p.clone().sub(owner.p),k=(other.p.lengthSq()-owner.p.lengthSq())*.5;poly=clip(poly,n,k);if(poly.length<3)break;}emit(poly,owner.shade);}
    }
    for(let i=0;i<attr.count;i+=3)triangle(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(world),new THREE.Vector3().fromBufferAttribute(attr,i+1).applyMatrix4(world),new THREE.Vector3().fromBufferAttribute(attr,i+2).applyMatrix4(world));
    const painted=new THREE.BufferGeometry();painted.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));painted.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));painted.computeVertexNormals();source.dispose();mesh.geometry.dispose();mesh.geometry=painted;
  }
  root.updateMatrixWorld(true);
  if(paint)root.traverse(o=>{if(o.isMesh && ['hull_core','faceted_glacis','turret_shell','cheek_wedge'].includes(o.name))paintArmor(o);});
  let sourceMeshes=0;root.traverse(o=>{if(o.isMesh)sourceMeshes++;});
  if(optimized)instanceMovingParts({sides,movingNodes});
  if(batch){mergeRigid(hull,movingNodes);mergeRigid(recoil);mergeRigid(gun,new Set([recoil]));mergeRigid(turret,new Set([gun]));}

  function mergeRigid(parent,skip=new Set()){
    parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),groups=new Map(),remove=[];
    function collect(o){if(skip.has(o))return;if(o.isMesh){const material=o.material;let bucket=groups.get(material);if(!bucket){bucket={positions:[],normals:[],colors:[]};groups.set(material,bucket);}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.colors.push(c?c.getX(i):1,c?c.getY(i):1,c?c.getZ(i):1);}g.dispose();remove.push(o);}o.children.forEach(collect);}parent.children.forEach(collect);remove.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
    for(const [material,b]of groups){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));add(g,material,parent,[0,0,0],parent.name+'_'+Object.keys(mats).find(k=>mats[k]===material));}
  }
  let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
  root.userData={version:'1.5',modelRevision:'1.4',animationRevision:'1.0',variant:optimized?'performance':'original',triangles,meshes,sourceMeshes,coordinateSystem:'+Y up / +Z forward',faction:palette[faction]?faction:'sand'};
  root.setFaction=(value)=>{if(!palette[value])return;['armor','light','shade'].forEach((key,i)=>mats[key].color.set(palette[value][i]));root.userData.faction=value;};
  root.setAim=(yaw=0,elevation=0)=>{turret.rotation.y=THREE.MathUtils.degToRad(yaw);gun.rotation.x=-THREE.MathUtils.degToRad(THREE.MathUtils.clamp(elevation,-5,22));};
  // Unmodified common animation kit; only light-tank bindings and effect parameters vary.
  attachVehicleAnimations({root,gauge:1.76,left:sides.left,right:sides.right,recoil,muzzle,
    fire:{recoilDistance:.14,recoilPeak:.055,recoveryEnd:.34,duration:.90,flashDuration:.085,effectScale:.65}});
  root.userData.idleDrawCalls=meshes;
  root.userData.trianglesPerPose=triangles;
  return root;
}
