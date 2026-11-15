import * as THREE from 'three';
import {createTrackPath} from './track-path.js';

// Self-propelled howitzer V1.0; medium tank V2.2 chassis derivative. +Y up, +Z forward, ground at Y=0. Geometry only.
// Dimensions are stylized gameplay units, not measurements of a real vehicle.
export function createArtillery({faction='sand', batch=true, paint=true}={}) {
  const root=new THREE.Group(); root.name='SelfPropelledHowitzer_V2_0';
  const palette={sand:['#b9a16c','#cbb583','#8b784f'],blue:['#527ca9','#7199c2','#3c5e86'],red:['#ae5149','#cc6a5e','#843b36'],green:['#7c8750','#a0aa68','#5b673b']};
  const mats={};
  const mat=(name,color,extra={})=>mats[name]=new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...extra});
  palette.sand=['#c2a16a','#dbbd80','#8d7446'];
  const colors=palette[faction]||palette.sand;
  mat('armor',colors[0],{vertexColors:true});mat('light',colors[1]);mat('shade',colors[2]);
  mat('rubber','#303338');mat('tread','#42464b',{metalness:.18});mat('edge','#555956',{metalness:.22});
  mat('well','#424846');mat('suspension','#60645d');mat('wheel',colors[0],{vertexColors:true});mat('opticsBody',colors[0]);mat('steel','#6c6d61',{metalness:.2});
  mat('olive','#62664e');mat('glass','#293b43',{metalness:.25,roughness:.36});mat('black','#171e22');
  mat('lamp','#e6d6a2',{emissive:'#e6d6a2',emissiveIntensity:.1});mat('amber','#b3733e');mat('tail','#9c4a3d');
  const hull=new THREE.Group();hull.name='hull';root.add(hull);
  const turret=new THREE.Group();turret.name='turret';turret.position.set(0,1.045,-.43);root.add(turret);
  const gun=new THREE.Group();gun.name='gun';gun.position.set(0,.49,.72);gun.scale.z=.82;turret.add(gun);
  function add(geometry,material,parent,pos=[0,0,0],name='') {const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function geom(pos,indices){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();return g;}
  // Rings run clockwise in XZ, so their top-facing normals are +Y.
  function outline(w,d,b=.07,z=0){return [[-w/2+b,d/2+z],[w/2-b,d/2+z],[w/2,d/2-b+z],[w/2,-d/2+b+z],[w/2-b,-d/2+z],[-w/2+b,-d/2+z],[-w/2,-d/2+b+z],[-w/2,d/2-b+z]];}
  function loft(rings,variation=false){let p=[],ids=[];const N=rings[0].points.length;rings.forEach(r=>r.points.forEach(q=>p.push(q[0],r.y,q[1])));for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=b+N,d=a+N;ids.push(a,b,d,b,c,d);}for(let i=1;i<N-1;i++){ids.push(0,i+1,i);let t=(rings.length-1)*N;ids.push(t,t+i,t+i+1);}let g=geom(p,ids);if(variation){g=g.toNonIndexed();let c=[];for(let i=0;i<g.attributes.position.count;i+=3){const shade=[1,.96,1.025,.985,.94,1.01][Math.floor(i/6)%6];for(let j=0;j<3;j++)c.push(shade,shade,shade);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();}return g;}
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
      const shade=radius>.068 && radius<.207 && depth<.010 ? .36 : radius>.207 ? 1.12 : .85;
      for(let j=0;j<3;j++)c.push(shade,shade,shade);
    }g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return g;
  }
  function wheelFace(parent,x,y,z,side,geometry,material){let m=add(geometry,material,parent,[x,y,z]);m.rotation.z=-side*Math.PI/2;return m;}
  function surfaceBox(parent,pos,size,normal,material,b=.025,name=''){
    let m=box(parent,pos,size,material,b,name);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal).normalize());return m;
  }

  // Faceted hull with a narrower, bevelled lower nose and a divided upper glacis.
  add(loft([
    {y:.43,points:outline(1.43,3.23,.23,-.01)},
    {y:.52,points:outline(1.63,3.75,.24,.04)},
    {y:.82,points:outline(1.78,3.99,.18,.025)},
    {y:1.18,points:outline(1.76,2.96,.15,-.24)}
  ],true),mats.armor,hull,[0,0,0],'hull_core');
  // Raised glacis: selected planar facets, with a central ridge rather than a flat rectangle.
  const glacisPoints=[[-.86,1.18,1.22],[-.31,1.205,1.22],[.31,1.205,1.22],[.86,1.18,1.22],[-.84,.94,2.035],[-.32,.94,2.05],[.32,.94,2.05],[.84,.94,2.035],[-.79,.62,1.99],[-.30,.61,2.03],[.30,.61,2.03],[.79,.62,1.99],[-.70,.40,1.76],[.70,.40,1.76]];
  const gp=glacisPoints.flat(),gi=[0,4,1,1,4,5,1,5,2,2,5,6,2,6,3,3,6,7,4,8,5,5,8,9,5,9,6,6,9,10,6,10,7,7,10,11,8,12,9,9,12,13,9,13,10,10,13,11];
  const glacis=geom(gp,gi).toNonIndexed();let gc=[];for(let i=0;i<glacis.attributes.position.count;i+=3){let v=[1.03,.97,1.00,.94,.98,1.02,.91,.96][Math.floor(i/3)%8];for(let j=0;j<3;j++)gc.push(v,v,v);}glacis.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));
  add(glacis,mats.armor,hull,[0,0,0],'faceted_glacis');
  box(hull,[0,1.205,-.36],[1.88,.115,2.84],mats.armor,.035,'deck');
  // Slightly raised driver plate, hatch and narrow periscope at the turret foot.
  let driver=box(hull,[-.37,1.235,.93],[.56,.065,.44],mats.light,.028,'driver_hatch');
  box(hull,[-.37,1.29,1.03],[.27,.09,.14],mats.edge,.018);
  box(hull,[-.37,1.29,1.105],[.18,.04,.012],mats.glass,.002);
  for(const s of [-1,1]){
    // Shoulder decks lie close to the tracks, with a pronounced front slope.
    box(hull,[s*1.065,1.155,-.30],[.72,.16,3.25],mats.armor,.055,'fender_top');
    // Short folded nose plate meets the shoulder at z=1.64, without stacked caps.
    const shoulder=box(hull,[s*1.065,1.06,1.89],[.76,.13,.59],mats.armor,.032,'sloped_front_fender');shoulder.rotation.x=.47;
    box(hull,[s*1.065,1.20,1.475],[.74,.10,.35],mats.armor,.018,'front_lamp_deck');
    // Lamp sits directly on the deck, with its lower edge slightly seated into it.
    box(hull,[s*1.07,1.32375,1.62],[.38,.1875,.20],mats.black,.022,'front_lamp_housing');
    box(hull,[s*1.07+.083,1.32375,1.729],[.108,.10875,.022],mats.amber,.003,'front_amber_lens');
    box(hull,[s*1.07-.083,1.32375,1.729],[.108,.10875,.022],mats.lamp,.003,'front_white_lens');
    // Clipped triangular skirt: top stays below the deck and rear edge leaves a .018 seam.
    const cheekX=s*1.405,cheekP=[];
    const cheekOutline=[[1.21,1.494],[1.21,1.66],[.965,2.10],[.90,1.494]];
    for(const x of [cheekX-.0375,cheekX+.0375])for(const [y,z]of cheekOutline)cheekP.push(x,y,z);
    const cheekI=[0,2,1,0,3,2,4,5,6,4,6,7];
    for(let i=0;i<4;i++){const j=(i+1)%4;cheekI.push(i,j,j+4,i,j+4,i+4);}
    add(geom(cheekP,cheekI),mats.armor,hull,[0,0,0],'front_skirt_triangle');
    for(const [y,z]of [[1.16,1.55],[.965,1.55],[.995,1.94]]){
      const rivet=cyl(hull,[s*1.46,y,z],.018,.018,.018,mats.shade,'x',6);rivet.name='front_skirt_rivet';
    }
    const n=[0,.38,.925];
    surfaceBox(hull,[s*.64,1.012,1.763],[.17,.15,.045],n,mats.shade,.009,'front_tow_mount');
    const hook=add(new THREE.TorusGeometry(.053,.017,6,10),mats.edge,hull,[s*.64,1.047,1.816],'front_tow_eye');hook.rotation.x=-.38;
    rod(hull,[s*.64,.99,1.79],[s*.64,1.05,1.82],.022,mats.edge,8);
    for(const z of [.52,-.06])box(hull,[s*1.08,1.277,z],[.40,.05,.36],mats.armor,.018);
    box(hull,[s*1.12,1.284,-.67],[.43,.11,.68],mats.olive,.022,'side_tool_box');
    box(hull,[s*1.13,1.297,-1.45],[.45,.11,.51],mats.armor,.025);
    // Thin steel side plates: visibly tall panels, small thickness, sharp seams.
    for(let i=0;i<6;i++){
      const z=1.24-i*.49,h=.33,y=1.23-h/2;
      box(hull,[s*1.405,y,z],[.075,h,.472],mats.armor,.014,'side_skirt_'+i);
      box(hull,[s*1.41,1.228,z],[.095,.025,.465],mats.light,.006,'skirt_folded_lip');
      for(const zz of [z-.174,z+.174])for(const yy of [y-.102,y+.105])
        cyl(hull,[s*1.46,yy,zz],.018,.018,.018,mats.shade,'x',6);
      box(hull,[s*1.46,1.175,z],[.018,.034,.075],mats.steel,.004,'skirt_hinge');
    }
    box(hull,[s*1.405,1.06,-1.73],[.075,.31,.32],mats.armor,.014,'rear_corner');
    for(const yy of [.96,1.17])cyl(hull,[s*1.46,yy,-1.73],.018,.018,.018,mats.shade,'x',6);
  }

  // Recessed dark-grey wheel well; visible suspension arms break up the dark area.
  for(const side of [-1,1]){
    box(hull,[side*.94,.66,0],[.05,.43,3.16],mats.well,.012,'suspension_well');
    for(let i=0;i<4;i++){
      const z=-.96+i*.64;
      rod(hull,[side*1.05,.70,z+.13],[side*1.05,.47,z],.043,mats.suspension,8);
      cyl(hull,[side*1.06,.69,z+.13],.065,.065,.05,mats.edge,'x',10);
    }
  }

  // Chunky tracks: polygonal end arcs, individual pads, hinge tabs and recessed wheel dishes.
  const roadZ=.96,roadY=.435,roadRadius=.326*.84,endZ=1.53,endY=.59,endRadius=.31*.82;
  const belt=createTrackPath({roadZ,roadY,roadRadius,endZ,endY,endRadius});
  const trackLength=belt.length,trackPoint=belt.pointAt;
  // Place the lowest outside pad face at ground level, retaining all wheel-to-belt relations.
  const trackGroundOffset=-(roadY-roadRadius-.055-.058-.095/2);
  for(const side of [-1,1]){
    const track=new THREE.Group(),x=side*.975;track.name=side<0?'right_track':'left_track';track.position.y=trackGroundOffset;hull.add(track);
    const N=belt.contour.length,p=[],ids=[],outer=[],inner=[];
    for(let i=0;i<N;i++){let q=belt.contour[i];outer.push([q.z-q.dy*.055,q.y+q.dz*.055]);inner.push([q.z+q.dy*.055,q.y-q.dz*.055]);}
    for(const xx of [x-.255,x+.255])for(const contour of [outer,inner])contour.forEach(q=>p.push(xx,q[1],q[0]));
    function quad(a,b,c,d){ids.push(a,b,c,a,c,d);}
    for(let i=0;i<N;i++){let j=(i+1)%N;quad(i,j,2*N+j,2*N+i);quad(N+j,N+i,3*N+i,3*N+j);quad(j,i,N+i,N+j);quad(2*N+i,2*N+j,3*N+j,3*N+i);}
    let beltVolume=0;for(let i=0;i<ids.length;i+=3){const a=new THREE.Vector3().fromArray(p,ids[i]*3),b=new THREE.Vector3().fromArray(p,ids[i+1]*3),c=new THREE.Vector3().fromArray(p,ids[i+2]*3);beltVolume+=a.dot(b.cross(c));}
    if(beltVolume<0)for(let i=0;i<ids.length;i+=3)[ids[i+1],ids[i+2]]=[ids[i+2],ids[i+1]];
    add(geom(p,ids),mats.rubber,track);
    for(let i=0;i<40;i++){
      let q=trackPoint(trackLength*(i+.5)/40);
      const padAngle=-Math.atan2(q.dy,q.dz);
      for(const dx of [-.142,.142]){const pad=add(bevel(.271,.095,.19,.016),mats.tread,track,[x+dx,q.y+q.dz*.058,q.z-q.dy*.058]);pad.rotation.x=padAngle;}
      // Thin connector plates stay inside the outer pad width.
      const link=box(track,[x+side*.245,q.y,q.z],[.075,.075,.225],mats.edge,.01);link.rotation.x=padAngle;
    }
    const dishProfile=[[0,-.07],[.275,-.07],[.288,-.04],[.288,.018],[.271,.037],[.245,.031],[.226,-.023],[.145,-.048],[.079,-.027],[.067,.018],[0,.018]];
    const tireProfile=[[.260,-.205],[.278,-.205],[.317,-.175],[.326,-.13],[.326,.14],[.312,.188],[.278,.205],[.260,.205],[.260,-.205]];
    for(let i=0;i<4;i++){
      const z=-roadZ+i*(2*roadZ/3),y=roadY;
      wheelFace(track,x,y,z,side,turned(tireProfile.map(([r,a])=>[r*.84,a]),16),mats.rubber);
      wheelFace(track,x+side*.195,y,z,side,recessedDish(turned(dishProfile.map(([r,a])=>[r*.84,a]),16)),mats.wheel);
      cyl(track,[x+side*.226,y,z],.048,.048,.026,mats.shade,'x',10);
    }
    for(const z of [-endZ,endZ]){
      const y=endY;
      wheelFace(track,x,y,z,side,turned([[.235,-.20],[.27,-.20],[.31,-.16],[.31,.16],[.27,.20],[.235,.20],[.235,-.20]].map(([r,a])=>[r*.82,a]),14),mats.rubber);
      wheelFace(track,x+side*.19,y,z,side,turned([[0,-.04],[.25,-.04],[.27,-.01],[.27,.025],[.23,.035],[.19,-.016],[.10,-.025],[.075,.02],[0,.02]].map(([r,a])=>[r*.82,a]),14),mats.shade);
      cyl(track,[x+side*.221,y,z],.092,.092,.035,mats.armor,'x',10);
    }
  }

  // Include rotated pad corners when seating each complete track on the ground.
  for(const track of hull.children.filter(o=>o.name==='left_track'||o.name==='right_track')){
    track.updateWorldMatrix(true,true);track.position.y-=new THREE.Box3().setFromObject(track).min.y;
  }

  // Artillery rear: broad access plate, lower central door and square lamp clusters.
  box(hull,[0,.85,-1.94],[1.70,.68,.12],mats.armor,.025,'rear_hull_plate');
  box(hull,[0,.87,-2.012],[1.06,.51,.035],mats.shade,.012,'lower_rear_door_seam');
  box(hull,[0,.87,-2.065],[.99,.46,.085],mats.armor,.014,'lower_rear_door');
  for(const x of [-.42,.42])for(const y of [.69,1.05])cyl(hull,[x,y,-2.119],.022,.022,.025,mats.shade,'z',6);
  for(const y of [.73,1.02])box(hull,[-.49,y,-2.124],[.13,.052,.035],mats.edge,.008,'lower_door_hinge');
  rod(hull,[.32,.81,-2.14],[.32,.95,-2.14],.020,mats.edge,8);
  for(const side of [-1,1]){
    box(hull,[side*.69,.87,-2.04],[.16,.41,.08],mats.edge,.014,'rear_vertical_mount');
    for(const y of [.73,1.02])cyl(hull,[side*.69,y,-2.09],.027,.027,.022,mats.steel,'z',8);
    box(hull,[side*1.065,1.13,-1.99],[.45,.22,.13],mats.edge,.018,'rear_lamp_housing');
    for(const dx of [-.095,.095])box(hull,[side*1.065+dx,1.14,-2.061],[.125,.125,.019],mats.tail,.006,'rear_red_lens');
    box(hull,[side*1.28,1.14,-2.061],[.025,.11,.02],mats.amber,.003);
    box(hull,[side*1.065,.91,-1.99],[.48,.20,.13],mats.armor,.016,'rear_fender_cap');
    for(const x of [side*.94,side*1.19])cyl(hull,[x,.91,-2.06],.019,.019,.018,mats.shade,'z',6);
    box(hull,[side*.43,.52,-2.003],[.16,.12,.065],mats.shade,.012);
    cyl(hull,[side*.43,.51,-2.06],.042,.042,.07,mats.edge,'z',8);
  }
  for(let i=0;i<7;i++)box(hull,[0,1.272,-1.29-i*.065],[.70,.025,.028],mats.shade,.003);

  // New rear-set, tall box fighting compartment. Narrow front cheeks flank the trunnion.
  cyl(turret,[0,.015,0],.64,.69,.09,mats.edge,'y',20);
  // Continuous inclined front, with an actual central notch for the gun cradle.
  // The cheek overlays sit on this slope instead of bridging a vertical front wall.
  function frontRing(w,d,b,z,front,y){
    const q=outline(w,d,b,z),edge=front-.075;
    q[0][1]=front;q[1][1]=front;q[2][1]=edge;q[7][1]=edge;
    q.splice(1,0,[-.32,front],[-.32,.50],[.32,.50],[.32,front]);
    return {y,points:q};
  }
  const shellRings=[frontRing(1.69,1.91,.10,-.12,.89,.07),frontRing(1.72,1.94,.10,-.12,.92,.18),frontRing(1.46,1.70,.08,-.24,.57,.85),frontRing(1.43,1.67,.07,-.24,.54,.91)];
  const shellP=[],shellI=[],shellN=shellRings[0].points.length;
  for(const r of shellRings)for(const [x,z]of r.points)shellP.push(x,r.y,z);
  for(let j=0;j<shellRings.length-1;j++)for(let i=0;i<shellN;i++){const a=j*shellN+i,b=j*shellN+(i+1)%shellN;shellI.push(a,b,a+shellN,b,b+shellN,a+shellN);}
  for(const j of [0,shellRings.length-1]){
    const points=shellRings[j].points,triangles=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]);
    for(let [a,b,c]of triangles){const A=points[a],B=points[b],C=points[c],ny=(B[1]-A[1])*(C[0]-A[0])-(B[0]-A[0])*(C[1]-A[1]);if((j===0&&ny>0)||(j!==0&&ny<0))[b,c]=[c,b];shellI.push(j*shellN+a,j*shellN+b,j*shellN+c);}
  }
  add(geom(shellP,shellI),mats.armor,turret,[0,0,0],'turret_shell');
  // Dark recessed back wall; the armor cheeks stand forward with exposed inner returns.
  box(turret,[0,.46,.55],[.65,.67,.025],mats.black,.010,'gun_recess_back');
  box(turret,[0,.14,.77],[.61,.09,.38],mats.edge,.012,'gun_recess_floor');
  for(const side of [-1,1]){
    const face=(x0,x1,z0,z1)=>{const points=[[side*x0,z1],[side*x1,z1],[side*x1,z0],[side*x0,z0]];return side>0?points:points.reverse();};
    add(loft([
      {y:.10,points:face(.33,.68,.92,1.02)},
      {y:.20,points:face(.32,.70,.92,1.04)},
      {y:.84,points:face(.34,.60,.57,.69)},
      {y:.90,points:face(.35,.58,.55,.65)}
    ],true),mats.armor,turret,[0,0,0],'cheek_wedge');
    // Narrow dark inner return: separate from the yellow external face.
    add(loft([
      {y:.16,points:face(.272,.321,.89,.99)},
      {y:.23,points:face(.272,.321,.89,1.01)},
      {y:.82,points:face(.292,.341,.54,.675)},
      {y:.87,points:face(.302,.351,.53,.65)}
    ]),mats.edge,turret,[0,0,0],'cheek_inner_return');
    rod(turret,[side*.265,.25,.68],[side*.265,.62,.61],.022,mats.steel,8);
    cyl(turret,[side*.30,.49,.75],.13,.13,.035,mats.shade,'x',12);
    // Surface fittings follow the slope instead of being buried in the armor.
    for(const y of [.26,.74]){
      const z=1.02-(y-.20)*.547;
      surfaceBox(turret,[side*.50,y,z+.025],[.075,y>.5?.105:.075,.055],[0,.48,.877],mats.edge,.010,'front_cheek_fastener');
    }
    box(turret,[side*.81,.47,-.23],[.06,.56,.73],mats.shade,.012,'panel_seam');
    box(turret,[side*.85,.47,-.23],[.035,.51,.68],mats.armor,.012,'side_access_panel');
    for(const z of [-.51,.05])for(const y of [.27,.67])cyl(turret,[side*.88,y,z],.023,.023,.023,mats.shade,'x',6);
    box(turret,[side*.882,.48,.025],[.024,.13,.035],mats.edge,.004,'panel_latch');
    box(turret,[side*.845,.40,.23],[.055,.31,.28],mats.edge,.018,'side_tool_case');
    box(turret,[side*.89,.40,.23],[.035,.25,.22],mats.well,.008);
    for(const z of [.14,.32])rod(turret,[side*.915,.27,z],[side*.915,.54,z],.012,mats.steel,6);
    for(const y of [.28,.53])box(turret,[side*.90,y,.23],[.025,.023,.25],mats.steel,.004);
    box(turret,[side*.83,.51,-.66],[.14,.60,.31],mats.olive,.025,'rear_stowage');
    for(const z of [-.77,-.55]){
      box(turret,[side*.915,.51,z],[.03,.57,.035],mats.steel,.004);
      box(turret,[side*.94,.47,z],[.025,.075,.065],mats.edge,.006,'stowage_buckle');
    }
    box(turret,[side*.93,.73,-.66],[.03,.045,.12],mats.edge,.006,'stowage_handle');
    for(const z of [-.92,-.41,.02,.51])for(const y of [.22,.73])cyl(turret,[side*(y>.5?.755:.86),y,z],.023,.023,.035,mats.shade,'x',6);
    // Long tools and clamp rack sit outside the side plates, centered on the hull.
    box(hull,[side*1.46,1.065,-.30],[.035,.20,1.18],mats.shade,.008,'tool_rack_back');
    for(const yy of [1.005,1.13])rod(hull,[side*1.49,yy,-.86],[side*1.49,yy,.28],.022,mats.steel,8);
    rod(hull,[side*1.51,1.07,-.80],[side*1.51,1.07,.20],.021,mats.well,8);
    box(hull,[side*1.51,1.07,.30],[.04,.13,.22],mats.steel,.012,'shovel_head');
    for(const z of [-.71,-.14,.17])box(hull,[side*1.525,1.065,z],[.04,.23,.038],mats.edge,.005,'tool_clamp');
  }
  // Rear fighting compartment: narrow central hatch, asymmetric corner fittings.
  box(turret,[0,.49,-1.106],[.90,.67,.030],mats.shade,.014,'rear_door_seam');
  box(turret,[0,.49,-1.158],[.84,.62,.085],mats.armor,.014,'rear_door');
  for(const y of [.29,.68])box(turret,[-.42,y,-1.215],[.14,.048,.032],mats.steel,.006,'rear_door_hinge');
  rod(turret,[.34,.41,-1.222],[.34,.56,-1.222],.017,mats.edge,8);
  for(const x of [-.32,.32])for(const y of [.23,.75])cyl(turret,[x,y,-1.215],.019,.019,.018,mats.shade,'z',6);
  for(const x of [.61,.78]){
    box(turret,[x,.54,-1.15],[.14,.48,.14],mats.olive,.014,'rear_strapped_case');
    for(const y of [.37,.69])box(turret,[x,y,-1.227],[.15,.028,.026],mats.edge,.004,'rear_case_strap');
    box(turret,[x,.80,-1.15],[.07,.035,.05],mats.edge,.005,'rear_case_handle');
  }
  box(turret,[-.69,.43,-1.16],[.22,.28,.15],mats.edge,.014,'rear_small_case');
  box(turret,[-.69,.43,-1.244],[.16,.21,.020],mats.well,.006);
  for(const y of [.32,.54])box(turret,[-.69,y,-1.26],[.18,.023,.025],mats.steel,.004);
  // Cylindrical container remains on the rear quarter, not on the central door.
  cyl(turret,[.87,.48,-.72],.13,.13,.57,mats.armor,'y',10);
  for(const y of [.28,.67])cyl(turret,[.87,y,-.72],.14,.14,.04,mats.edge,'y',10);
  box(turret,[0,.49,-1.207],[.012,.60,.012],mats.shade,.002,'rear_door_center_seam');
  box(hull,[0,.87,-2.114],[.012,.44,.012],mats.shade,.002,'lower_door_center_seam');
  // Low crew hatch replaces the tank-like raised optoelectronic box.
  cyl(turret,[.12,.935,-.34],.27,.29,.055,mats.shade,'y',12);
  cyl(turret,[.12,.969,-.34],.25,.27,.030,mats.armor,'y',12);
  rod(turret,[.02,1.006,-.35],[.22,1.006,-.35],.017,mats.edge,8);
  for(const z of [-.49,-.20])box(turret,[.36,.98,z],[.10,.045,.07],mats.shade,.006,'hatch_hinge');
  box(turret,[-.31,.95,.15],[.24,.055,.13],mats.shade,.010,'low_periscope');
  box(turret,[-.31,.958,.22],[.16,.025,.012],mats.glass,.002);
  for(const side of [-1,1]){
    cyl(turret,[side*.60,.96,-.86],.065,.085,.14,mats.shade,'y',10);
    cyl(turret,[side*.60,1.07,-.86],.039,.05,.12,mats.edge,'y',8);
    rod(turret,[side*.60,1.10,-.86],[side*.60,side>0?2.05:1.69,-.86],.008,mats.edge,6);
  }
  for(const x of [-.51,.30])box(turret,[x,.945,.33],[.18,.07,.14],mats.shade,.013);
  // Articulated cradle, trunnion caps and recoil housing all follow the gun elevation.
  cyl(gun,[0,0,0],.18,.18,.54,mats.edge,'x',12);
  for(const side of [-1,1])cyl(gun,[side*.285,0,0],.14,.14,.045,mats.shade,'x',10);
  for(const side of [-1,1]){
    const plate=box(gun,[side*.225,.005,.18],[.085,.55,.49],mats.edge,.025,'moving_cradle_plate');
    plate.rotation.x=.18;
    box(gun,[side*.225,.005,.43],[.085,.44,.045],mats.steel,.012,'moving_plate_front_edge');
  }
  box(gun,[0,-.09,.23],[.33,.26,.60],mats.edge,.04,'recoil_cradle');
  box(gun,[0,-.19,.37],[.25,.12,.73],mats.shade,.018);
  cyl(gun,[0,0,.28],.205,.205,.55,mats.armor,'z',8);
  cyl(gun,[0,0,.59],.18,.20,.12,mats.edge,'z',8);
  cyl(gun,[0,0,.94],.157,.18,.60,mats.light,'z',8);
  cyl(gun,[0,0,1.26],.165,.165,.09,mats.edge,'z',8);
  cyl(gun,[0,0,1.82],.127,.153,1.04,mats.armor,'z',8);
  cyl(gun,[0,0,2.36],.14,.14,.08,mats.edge,'z',8);
  cyl(gun,[0,0,2.70],.113,.126,.60,mats.light,'z',8);
  // Open three-baffle muzzle brake: actual annular openings and lateral gaps, no solid plug.
  function muzzleRing(z,depth,r){
    const g=turned([[.087,-depth/2],[r,-depth/2],[r,depth/2],[.087,depth/2],[.087,-depth/2]],8);
    add(g,mats.edge,gun,[0,0,z],'muzzle_baffle').rotation.x=Math.PI/2;
  }
  muzzleRing(3.035,.13,.16);muzzleRing(3.19,.075,.18);muzzleRing(3.36,.085,.18);
  for(const y of [-.137,.137])box(gun,[0,y,3.20],[.16,.055,.32],mats.edge,.008,'brake_bridge');
  add(new THREE.CircleGeometry(.087,8),mats.black,gun,[0,0,2.985],'recessed_bore');

  // Lower the fighting compartment without distorting the articulated barrel.
  for(const child of turret.children){if(child===gun)continue;child.position.y*=.84;if(child.isMesh)child.geometry.scale(1,.84,1);}
  gun.position.y*=.84;

  // Blueprint proportion correction: extend armor longitudinally and lower the upper body.
  // Keep tracks outside this group so all wheels remain circular. Their new centres above
  // drive the taut belt path instead of stretching a finished wheel/track mesh.
  const hullArmor=new THREE.Group();hullArmor.name='armor_layout';
  for(const child of [...hull.children])if(child.isMesh)hullArmor.add(child);
  hullArmor.scale.set(.91,.83,.94);hullArmor.position.y=.035;hull.add(hullArmor);

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
  const groundMin=new THREE.Box3().setFromObject(hull).min.y;
  hull.position.y-=groundMin;turret.position.y-=groundMin;
  root.updateMatrixWorld(true);
  if(paint)root.traverse(o=>{if(o.isMesh && ['hull_core','faceted_glacis','turret_shell','cheek_wedge'].includes(o.name))paintArmor(o);});
  let sourceMeshes=0;root.traverse(o=>{if(o.isMesh)sourceMeshes++;});
  if(batch){mergeRigid(hull);mergeRigid(gun);mergeRigid(turret,new Set([gun]));}
  function mergeRigid(parent,skip=new Set()){
    parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),groups=new Map(),remove=[];
    function collect(o){if(skip.has(o))return;if(o.isMesh){const material=o.material;let bucket=groups.get(material);if(!bucket){bucket={positions:[],normals:[],colors:[]};groups.set(material,bucket);}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.colors.push(c?c.getX(i):1,c?c.getY(i):1,c?c.getZ(i):1);}g.dispose();remove.push(o);}o.children.forEach(collect);}parent.children.forEach(collect);remove.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
    for(const [material,b]of groups){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));add(g,material,parent,[0,0,0],parent.name+'_'+Object.keys(mats).find(k=>mats[k]===material));}
  }
  root.updateMatrixWorld(true);
  const finalGround=new THREE.Box3().setFromObject(hull,true).min.y;
  hull.position.y-=finalGround;turret.position.y-=finalGround;
  let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  root.userData={version:'2.0',type:'artillery',chassisSource:'medium V2.2',roadWheelsPerSide:4,triangles,meshes,sourceMeshes,coordinateSystem:'+Y up / +Z forward',faction:palette[faction]?faction:'sand'};
  root.setFaction=(value)=>{if(!palette[value])return;['armor','light','shade'].forEach((key,i)=>mats[key].color.set(palette[value][i]));mats.wheel.color.set(palette[value][0]);root.userData.faction=value;};
  root.setAim=(yaw=0,elevation=0)=>{turret.rotation.y=THREE.MathUtils.degToRad(yaw);gun.rotation.x=-THREE.MathUtils.degToRad(THREE.MathUtils.clamp(elevation,-3,65));};
  root.setAim(0,30);
  return root;
}

// Common vehicle-factory alias.
export {createArtillery as createTank};
