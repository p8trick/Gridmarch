import * as THREE from 'three';
import {createTrackPath} from './track-path.js';

// Medium tank V2.2. +Y up, +Z forward, ground at Y=0. Geometry only.
// Dimensions are stylized gameplay units, not measurements of a real vehicle.
export function createTank({faction='sand', batch=true, paint=true}={}) {
  const root=new THREE.Group(); root.name='MediumTank_V2_2';
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
  const turret=new THREE.Group();turret.name='turret';turret.position.set(0,1.1836,-.18);root.add(turret);
  const gun=new THREE.Group();gun.name='gun';gun.position.set(0,.43,.85);gun.scale.z=.86;turret.add(gun);
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
      const shade=radius>.063 && radius<.182 && depth<.003 ? .57 : radius>.182 ? 1.04 : .93;
      for(let j=0;j<3;j++)c.push(shade,shade,shade);
    }g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return g;
  }
  function wheelFace(parent,x,y,z,side,geometry,material){let m=add(geometry,material,parent,[x,y,z]);m.rotation.z=-side*Math.PI/2;return m;}
  function surfaceBox(parent,pos,size,normal,material,b=.025,name=''){
    let m=box(parent,pos,size,material,b,name);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal).normalize());return m;
  }

  // Faceted hull with a narrower, bevelled lower nose and a divided upper glacis.
  add(loft([
    {y:.29,points:outline(1.43,3.23,.23,-.01)},
    {y:.52,points:outline(1.63,3.75,.24,.04)},
    {y:.82,points:outline(1.78,3.99,.18,.025)},
    {y:1.18,points:outline(1.76,2.96,.15,-.24)}
  ],true),mats.armor,hull,[0,0,0],'hull_core');
  // Raised glacis: selected planar facets, with a central ridge rather than a flat rectangle.
  const glacisPoints=[[-.86,1.18,1.22],[-.31,1.205,1.22],[.31,1.205,1.22],[.86,1.18,1.22],[-.84,.84,2.035],[-.32,.84,2.05],[.32,.84,2.05],[.84,.84,2.035],[-.79,.62,1.99],[-.30,.61,2.03],[.30,.61,2.03],[.79,.62,1.99],[-.65,.35,1.76],[.65,.35,1.76]];
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
    const shoulder=box(hull,[s*1.065,1.04,1.59],[.73,.28,.80],mats.armor,.032,'sloped_front_fender');shoulder.rotation.x=.50;
    // A cap on each shoulder creates the layered armor silhouette.
    box(hull,[s*1.06,1.27,.90],[.63,.13,.70],mats.light,.045);
    box(hull,[s*1.07,1.41,1.23],[.40,.16,.25],mats.edge,.025,'front_lamp_housing');
    box(hull,[s*1.15,1.41,1.361],[.105,.075,.018],mats.amber,.003);
    box(hull,[s*.995,1.41,1.361],[.105,.075,.018],mats.lamp,.003);
    const n=[0,.38,.925];
    surfaceBox(hull,[s*.63,1.012,1.763],[.205,.12,.065],n,mats.edge,.012,'glacis_headlight');
    surfaceBox(hull,[s*.63,1.025,1.795],[.125,.064,.015],n,mats.lamp,.003);
    for(const z of [.52,-.06])box(hull,[s*1.08,1.277,z],[.40,.05,.36],mats.armor,.018);
    box(hull,[s*1.12,1.284,-.67],[.43,.11,.68],mats.olive,.022,'side_tool_box');
    box(hull,[s*1.13,1.297,-1.45],[.45,.11,.51],mats.armor,.025);
    // Six plates with an angled lower edge and recessed panel joints.
    for(let i=0;i<6;i++){
      const z=1.24-i*.49,h=i===0?.60:.55,y=1.23-h/2;
      box(hull,[s*1.405,y,z],[.145,h,.475],mats.armor,.033,'side_skirt_'+i);
      box(hull,[s*1.408,1.22,z],[.17,.045,.44],mats.light,.01);
    }
    box(hull,[s*1.405,1.03,-1.73],[.15,.35,.32],mats.edge,.025,'rear_corner');
  }

  // Chunky tracks: polygonal end arcs, individual pads, hinge tabs and recessed wheel dishes.
  const roadZ=1.17*1.12,roadY=.407,roadRadius=.326*.73,endZ=1.61*1.12,endY=.65,endRadius=.31*.82;
  const belt=createTrackPath({roadZ,roadY,roadRadius,endZ,endY,endRadius});
  const trackLength=belt.length,trackPoint=belt.pointAt;
  // Place the lowest outside pad face at ground level, retaining all wheel-to-belt relations.
  const trackGroundOffset=-(roadY-roadRadius-.055-.058-.095/2);
  for(const side of [-1,1]){
    const track=new THREE.Group(),x=side*1.075;track.name=side<0?'right_track':'left_track';track.position.y=trackGroundOffset;hull.add(track);
    const N=belt.contour.length,p=[],ids=[],outer=[],inner=[];
    for(let i=0;i<N;i++){let q=belt.contour[i];outer.push([q.z-q.dy*.055,q.y+q.dz*.055]);inner.push([q.z+q.dy*.055,q.y-q.dz*.055]);}
    for(const xx of [x-.292,x+.292])for(const contour of [outer,inner])contour.forEach(q=>p.push(xx,q[1],q[0]));
    function quad(a,b,c,d){ids.push(a,b,c,a,c,d);}
    for(let i=0;i<N;i++){let j=(i+1)%N;quad(i,j,2*N+j,2*N+i);quad(N+j,N+i,3*N+i,3*N+j);quad(j,i,N+i,N+j);quad(2*N+i,2*N+j,3*N+j,3*N+i);}
    let beltVolume=0;for(let i=0;i<ids.length;i+=3){const a=new THREE.Vector3().fromArray(p,ids[i]*3),b=new THREE.Vector3().fromArray(p,ids[i+1]*3),c=new THREE.Vector3().fromArray(p,ids[i+2]*3);beltVolume+=a.dot(b.cross(c));}
    if(beltVolume<0)for(let i=0;i<ids.length;i+=3)[ids[i+1],ids[i+2]]=[ids[i+2],ids[i+1]];
    add(geom(p,ids),mats.rubber,track);
    for(let i=0;i<46;i++){
      let q=trackPoint(trackLength*(i+.5)/46);
      let pad=add(bevel(.635,.095,.19,.016),mats.tread,track,[x,q.y+q.dz*.058,q.z-q.dy*.058]);pad.rotation.x=-Math.atan2(q.dy,q.dz);
      // Thin connector plates stay inside the outer pad width.
      const link=box(track,[x+side*.281,q.y,q.z],[.075,.075,.225],mats.edge,.01);link.rotation.x=pad.rotation.x;
    }
    const dishProfile=[[0,-.07],[.275,-.07],[.288,-.04],[.288,.018],[.271,.037],[.245,.031],[.226,-.023],[.145,-.048],[.079,-.027],[.067,.018],[0,.018]];
    const tireProfile=[[.260,-.205],[.278,-.205],[.317,-.175],[.326,-.13],[.326,.14],[.312,.188],[.278,.205],[.260,.205],[.260,-.205]];
    for(let i=0;i<6;i++){
      const z=-roadZ+i*(2*roadZ/5),y=roadY;
      wheelFace(track,x,y,z,side,turned(tireProfile.map(([r,a])=>[r*.73,a]),16),mats.rubber);
      wheelFace(track,x+side*.195,y,z,side,recessedDish(turned(dishProfile.map(([r,a])=>[r*.73,a]),16)),mats.armor);
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

  // Layered rear plate, engine grille, towing fixtures and lamp clusters.
  box(hull,[0,.85,-1.94],[1.67,.64,.12],mats.armor,.04);
  box(hull,[0,.97,-2.012],[.68,.29,.04],mats.shade,.01);
  for(let i=0;i<6;i++)box(hull,[0,.854+i*.043,-2.041],[.59,.017,.03],mats.steel,.003);
  for(const s of [-1,1]){
    box(hull,[s*.64,.96,-2.02],[.27,.39,.11],mats.edge,.03);
    for(let i=0;i<5;i++)box(hull,[s*.64,.824+i*.055,-2.08],[.15,.025,.014],mats.black,.002);
    box(hull,[s*1.065,1.13,-1.94],[.50,.19,.12],mats.edge,.022);
    box(hull,[s*1.065,.90,-1.94],[.50,.24,.14],mats.armor,.025,'rear_fender_cap');
    box(hull,[s*1.105,1.14,-2.006],[.25,.083,.015],mats.tail,.002);
    box(hull,[s*.951,1.14,-2.006],[.045,.083,.015],mats.amber,.002);
    box(hull,[s*.43,.53,-2.003],[.16,.18,.065],mats.shade,.02);
    cyl(hull,[s*.44,.52,-2.05],.047,.047,.08,mats.edge,'z',8);
  }
  for(let i=0;i<7;i++)box(hull,[0,1.272,-1.29-i*.065],[.70,.025,.028],mats.shade,.003);

  // The turret shell has a broad lower belly and a smaller, offset roof outline.
  // Wide swept cheek wedges continue into the sides instead of separate small blocks.
  cyl(turret,[0,.018,0],.77,.82,.12,mats.edge,'y',24);
  add(loft([
    {y:.10,points:outline(1.70,2.05,.30,-.045)},
    {y:.23,points:outline(1.86,2.17,.35,-.045)},
    {y:.60,points:outline(1.67,1.98,.31,-.10)},
    {y:.73,points:outline(1.56,1.75,.28,-.14)}
  ],true),mats.armor,turret,[0,0,0],'turret_shell');
  for(const side of [-1,1]){
    // Broad seven-sided cheek cross section, mirrored with consistent winding.
    const shape=(coords)=>{const p=coords.map(([x,z])=>[side*x,z]);return side===1?p:p.reverse();};
    const cheek=loft([
      {y:.115,points:shape([[.30,.93],[.39,1.08],[.76,1.00],[1.04,.63],[1.04,.08],[.79,.03],[.39,.56]])},
      {y:.275,points:shape([[.30,1.00],[.44,1.15],[.85,1.04],[1.115,.61],[1.10,.05],[.84,.00],[.41,.56]])},
      {y:.60,points:shape([[.33,.88],[.45,.98],[.75,.89],[.96,.57],[.96,.08],[.77,.03],[.41,.52]])},
      {y:.69,points:shape([[.38,.78],[.47,.88],[.70,.81],[.86,.53],[.87,.10],[.74,.05],[.44,.49]])}
    ],true);
    // Polygon order above runs the other way from the standard hull ring.
    const ci=cheek.index; // toNonIndexed geometry: reverse per triangle if volume is negative.
    const pp=cheek.attributes.position,cc=cheek.attributes.color;let volume=0;
    for(let i=0;i<pp.count;i+=3){let a=new THREE.Vector3().fromBufferAttribute(pp,i),b=new THREE.Vector3().fromBufferAttribute(pp,i+1),c=new THREE.Vector3().fromBufferAttribute(pp,i+2);volume+=a.dot(b.cross(c));}
    if(volume<0){for(let i=0;i<pp.count;i+=3)for(const attribute of [pp,cc]){const x=attribute.getX(i+1),y=attribute.getY(i+1),z=attribute.getZ(i+1);attribute.setXYZ(i+1,attribute.getX(i+2),attribute.getY(i+2),attribute.getZ(i+2));attribute.setXYZ(i+2,x,y,z);}cheek.computeVertexNormals();}
    add(cheek,mats.armor,turret,[0,0,0],'cheek_wedge');
    surfaceBox(turret,[side*.635,.58,1.005],[.092,.15,.048],[side*.18,.33,.92],mats.shade,.008);
    surfaceBox(turret,[side*.639,.59,1.031],[.052,.10,.018],[side*.18,.33,.92],mats.edge,.005);
    // Rear turret bustle, segmented storage bins and two protective horizontal rails.
    for(let i=0;i<2;i++)box(turret,[side*.99,.43,-.44-i*.43],[.30,.48,.41],mats.armor,.034,'bustle_bin');
    for(const y of [.25,.58])rod(turret,[side*1.18,y,-1.16],[side*1.18,y,-.19],.024,mats.edge,8);
    for(const z of [-1.10,-.64,-.22])rod(turret,[side*1.176,.18,z],[side*1.176,.67,z],.024,mats.edge,8);
    // Two dark framed side fittings, proud of the armor instead of painted rectangles.
    for(const z of [.00,.235]){
      box(turret,[side*1.04,.44,z],[.16,.28,.19],mats.black,.025);
      box(turret,[side*1.13,.44,z],[.045,.32,.225],mats.edge,.018);
      box(turret,[side*1.158,.44,z],[.016,.22,.13],mats.well,.003);
      for(const y of [.295,.585])box(turret,[side*1.165,y,z],[.035,.029,.18],mats.steel,.004);
    }
    cyl(turret,[side*.63,.778,-.72],.073,.087,.10,mats.shade,'y',10);
    cyl(turret,[side*.63,.839,-.72],.048,.052,.065,mats.edge,'y',8);
    rod(turret,[side*.63,.87,-.72],[side*.63,.87+(side===1?.83:.68),-.72],.010,mats.edge,6);
  }
  cyl(turret,[-.36,.77,-1.04],.05,.065,.10,mats.shade,'y',8);
  rod(turret,[-.36,.82,-1.04],[-.36,1.16,-1.04],.009,mats.edge,6);
  box(turret,[0,.40,-1.16],[1.69,.49,.21],mats.armor,.035,'rear_bustle');
  for(const x of [-.58,0,.58])box(turret,[x,.42,-1.275],[.024,.43,.03],mats.shade,.004);
  box(turret,[.31,.40,-1.30],[.38,.25,.08],mats.olive,.02);
  for(const x of [.19,.41])box(turret,[x,.40,-1.345],[.023,.24,.014],mats.shade,.003);
  // Hatches and optics use shallow mounting plates rather than stacked tall blocks.
  cyl(turret,[.27,.755,-.12],.235,.245,.07,mats.shade,'y',12);
  cyl(turret,[.27,.804,-.12],.197,.223,.037,mats.armor,'y',12);
  rod(turret,[.20,.85,-.12],[.34,.85,-.12],.017,mats.shade,6);
  const sight=new THREE.Group();sight.name='commander_sight';sight.position.set(-.82,0,.12);turret.add(sight);
  box(sight,[.37,.755,.12],[.44,.07,.39],mats.shade,.028);
  cyl(sight,[.37,.817,.12],.135,.15,.08,mats.edge,'y',12);
  box(sight,[.37,.972,.12],[.37,.29,.34],mats.armor,.036,'commander_sight_housing');
  box(sight,[.37,.985,.302],[.30,.235,.04],mats.edge,.024);
  box(sight,[.37,.985,.325],[.21,.15,.012],mats.glass,.008);
  box(sight,[.564,.985,.12],[.025,.19,.25],mats.edge,.016);
  box(sight,[.580,.985,.12],[.014,.12,.16],mats.glass,.004);
  for(const x of [-.32,.08]){
    box(turret,[x,.775,.59],[.255,.08,.19],mats.shade,.018);
    box(turret,[x,.811,.60],[.20,.052,.14],mats.armor,.012);
    box(turret,[x,.81,.676],[.13,.027,.014],mats.glass,.003);
  }
  box(turret,[-.31,.76,-.72],[.43,.065,.20],mats.armor,.02);

  // Thick octagonal mantlet and distinct stepped barrel sections, matching the blueprint.
  box(gun,[0,0,.08],[.56,.51,.44],mats.armor,.085,'mantlet');
  cyl(gun,[0,0,.338],.227,.227,.12,mats.edge,'z',8);
  cyl(gun,[0,0,.472],.202,.227,.17,mats.armor,'z',8);
  cyl(gun,[0,0,.69],.168,.202,.30,mats.armor,'z',8);
  cyl(gun,[0,0,.89],.183,.183,.08,mats.edge,'z',8);
  cyl(gun,[0,0,1.12],.178,.178,.38,mats.light,'z',8);
  cyl(gun,[0,0,1.37],.145,.178,.12,mats.armor,'z',8);
  cyl(gun,[0,0,1.46],.163,.163,.07,mats.edge,'z',8);
  cyl(gun,[0,0,1.91],.139,.143,.83,mats.armor,'z',8);
  // Muzzle is a closed annular profile with a genuinely recessed bore.
  const muzzle=turned([[.106,-.075],[.155,-.17],[.181,-.11],[.181,.035],[.158,.085],[.106,.085],[.106,-.075]],8);
  add(muzzle,mats.edge,gun,[0,0,2.40]).rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(.106,8),mats.black,gun,[0,0,2.34]);

  // Blueprint proportion correction: extend armor longitudinally and lower the upper body.
  // Keep tracks outside this group so all wheels remain circular. Their new centres above
  // drive the taut belt path instead of stretching a finished wheel/track mesh.
  const hullArmor=new THREE.Group();hullArmor.name='armor_layout';
  for(const child of [...hull.children])if(child.isMesh)hullArmor.add(child);
  hullArmor.scale.set(1,.94,1.12);hullArmor.position.y=.018;hull.add(hullArmor);

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
  if(batch){mergeRigid(hull);mergeRigid(gun);mergeRigid(turret,new Set([gun]));}
  function mergeRigid(parent,skip=new Set()){
    parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),groups=new Map(),remove=[];
    function collect(o){if(skip.has(o))return;if(o.isMesh){const material=o.material;let bucket=groups.get(material);if(!bucket){bucket={positions:[],normals:[],colors:[]};groups.set(material,bucket);}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.colors.push(c?c.getX(i):1,c?c.getY(i):1,c?c.getZ(i):1);}g.dispose();remove.push(o);}o.children.forEach(collect);}parent.children.forEach(collect);remove.forEach(o=>{o.removeFromParent();o.geometry.dispose();});
    for(const [material,b]of groups){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));add(g,material,parent,[0,0,0],parent.name+'_'+Object.keys(mats).find(k=>mats[k]===material));}
  }
  let triangles=0,meshes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  root.userData={version:'2.2',triangles,meshes,sourceMeshes,coordinateSystem:'+Y up / +Z forward',faction:palette[faction]?faction:'sand'};
  root.setFaction=(value)=>{if(!palette[value])return;['armor','light','shade'].forEach((key,i)=>mats[key].color.set(palette[value][i]));root.userData.faction=value;};
  root.setAim=(yaw=0,elevation=0)=>{turret.rotation.y=THREE.MathUtils.degToRad(yaw);gun.rotation.x=-THREE.MathUtils.degToRad(THREE.MathUtils.clamp(elevation,-5,22));};
  return root;
}
