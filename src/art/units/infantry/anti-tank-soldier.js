import * as T from 'three';
import {createSoldier} from './soldier-rig.js';

const V=(x,y,z)=>new T.Vector3(x,y,z), Z=V(0,0,1), X=V(1,0,0);
const mix=(a,b,t)=>a.clone().lerp(b,t);

// Toy-scale visual geometry, +X is the tube axis. All fixed details are merged
// into two material buckets. No changes to the accepted infantry source mesh.
export function createLauncher(){
 const root=new T.Group();root.name='rocket_launcher';const pieces=[];
 const olive=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88,flatShading:true});
 const metal=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.72,metalness:.22,flatShading:true});
 function add(g,color,bucket=0,p=[0,0,0],q=null){const o=new T.Mesh(g);o.position.fromArray(p);if(q)o.quaternion.copy(q);o.updateMatrix();pieces.push({g:g.index?g.toNonIndexed():g,m:o.matrix.clone(),c:new T.Color(color),bucket});return o;}
 const alongX=new T.Quaternion().setFromUnitVectors(V(0,1,0),X);
 function cylinder(x0,x1,r0,r1,color,bucket=0,open=false){return add(new T.CylinderGeometry(r1,r0,x1-x0,12,1,open),color,bucket,[(x0+x1)/2,0,0],alongX);}
 function box(p,size,color,bucket=1,q=null){return add(new T.BoxGeometry(...size),color,bucket,p,q);}
 // Subtle stepped taper, not a featureless cylinder or closed black cap.
 cylinder(-1.10,-.72,.177,.177,'#525a35',0,true);cylinder(-.72,.52,.166,.161,'#59623b',0,true);
 cylinder(.52,.82,.161,.181,'#536039',0,true);cylinder(.82,1.13,.181,.181,'#56603a',0,true);
 cylinder(-1.11,-1.04,.186,.186,'#303535',1,true);
 cylinder(-.955,-.84,.183,.183,'#d4a23a',0,true);
 function rim(x0,x1,r0,r1,inner){
  // A short chamfer at both ends avoids a blunt, square-cut rubber rim.
  cylinder(x0,x0+.022,r0-.010,r0,'#343b3b',1,true);
  cylinder(x0+.022,x1-.022,r0,r1,'#303536',1,true);
  cylinder(x1-.022,x1,r1,r1-.010,'#3a4140',1,true);
  // Reverse the inner wall winding so the bore is visible from its opening.
  const a=x0>0?.64:x0,b=x0>0?x1:-.72;
  const wall=new T.CylinderGeometry(inner,inner,b-a,12,1,true),idx=wall.index.array;
  for(let i=0;i<idx.length;i+=3){const b=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=b;}wall.computeVertexNormals();
  add(wall,'#171e20',1,[(a+b)/2,0,0],alongX);
  for(const [x,r,flip]of[[x0,r0-.010,true],[x1,r1-.010,false]]){
   let q=new T.Quaternion().setFromUnitVectors(Z,flip?X.clone().negate():X);
   add(new T.RingGeometry(inner,r,12),'#3a4040',1,[x,0,0],q);
  }
 }
 rim(-1.23,-1.095,.218,.195,.142);rim(1.105,1.245,.197,.229,.159);
 // Recessed end disks leave an actual visible inner wall at both ends.
 add(new T.CircleGeometry(.143,12),'#101719',1,[-.72,0,0],new T.Quaternion().setFromUnitVectors(Z,X.clone().negate()));
 add(new T.CircleGeometry(.16,12),'#101719',1,[.64,0,0],new T.Quaternion().setFromUnitVectors(Z,X));
 for(const x of[-.61,.32]){
  cylinder(x-.035,x+.035,.18,.18,'#303837',1,true);box([x,-.174,0],[.105,.07,.15],'#303837');
  box([x,-.045,.177],[.10,.075,.032],'#3d4540');box([x,-.045,.197],[.030,.028,.012],'#717564');
 }
 cylinder(.785,.815,.184,.184,'#626a43',0,true);
 // Carry/sight handle and small raised sight, recognizable at tactical scale.
 for(const x of[-.35,.02])box([x,.192,.085],[.055,.095,.065],'#252d2d');
 box([-.165,.241,.085],[.43,.045,.07],'#343c3c');
 box([.51,.204,0],[.07,.095,.055],'#252d2d');box([.51,.25,0],[.10,.025,.07],'#353e3b');
 // Underside pistol grip and trigger guard; hands have independent wrist pivots.
 const rake=new T.Quaternion().setFromAxisAngle(Z,-.13);
 box([.035,-.265,.025],[.105,.245,.105],'#303633',1,rake);
 box([.12,-.17,.025],[.21,.035,.085],'#303633');
 box([.19,-.235,.025],[.025,.15,.07],'#303633');
 box([.105,-.30,.025],[.17,.028,.07],'#303633');
 box([-.49,-.187,0],[.26,.075,.25],'#414a37',0);
 // Sling lugs, no loose floating strap across the silhouette.
 for(const x of[-.73,.72])box([x,-.17,-.05],[.08,.07,.04],'#343d34');
 for(let bucket=0;bucket<2;bucket++){
  const p=[],n=[],c=[];
  for(const part of pieces.filter(x=>x.bucket===bucket)){
   const a=part.g.attributes,nm=new T.Matrix3().getNormalMatrix(part.m);
   for(let i=0;i<a.position.count;i++){
    p.push(...new T.Vector3().fromBufferAttribute(a.position,i).applyMatrix4(part.m).toArray());
    n.push(...new T.Vector3().fromBufferAttribute(a.normal,i).applyNormalMatrix(nm).toArray());c.push(part.c.r,part.c.g,part.c.b);
   }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));
  const o=new T.Mesh(g,bucket?metal:olive);o.name=bucket?'launcher_fittings':'launcher_tube';o.castShadow=o.receiveShadow=true;root.add(o);
 }
 pieces.forEach(x=>x.g.dispose());
 root.userData.landmarks={muzzle:[1.245,0,0],rear:[-1.23,0,0],boreAxis:[1,0,0],shoulder:[-.48,0,0],pistolGrip:[.035,-.265,.025]};return root;
}

// Closed webbing keeper loops. They are equipment children, never part of the
// body's accepted geometry, and share the launcher's cloth-response material.
function keepers(loops,material,name){
 const p=[],n=[],c=[],color=new T.Color('#74734e');
 function box(center,size,tint=1){const indexed=new T.BoxGeometry(...size),g=indexed.toNonIndexed();g.translate(...center);const a=g.attributes;for(let i=0;i<a.position.count;i++){p.push(a.position.getX(i),a.position.getY(i),a.position.getZ(i));n.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));c.push(color.r*tint,color.g*tint,color.b*tint);}indexed.dispose();g.dispose();}
 for(const [x,y,hy,hz]of loops){
  for(const z of[-hz,hz])box([x,y,z],[.055,hy*2,.018]);
  for(const yy of[y-hy,y+hy])box([x,yy,0],[.055,.018,hz*2]);
  box([x,y,hz+.018],[.087,.070,.022],.72);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 const m=new T.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;return m;
}

export function createAntiTankSoldier(options={}){
 const unit=createSoldier(options),j=unit.joints,chest=j.chest;
 unit.name='AntiTank_Infantry_V1_1';
 const base={setPose:unit.setPose.bind(unit),sampleCycle:unit.sampleCycle.bind(unit),sampleFirePose:unit.sampleFirePose.bind(unit)};
 const rifleMeshes=j.rifle.children.filter(o=>o.isMesh);
 const gunRest=new T.Matrix4().makeTranslation(.035,.34,.70).multiply(new T.Matrix4().makeRotationZ(-.59));
 const inverseGun=gunRest.clone().invert();
 const stowedRifle=new T.Group();stowedRifle.name='back_stowed_rifle';chest.add(stowedRifle);
 const normalize=new T.Group();normalize.name='rifle_original_local';normalize.matrix.copy(inverseGun);normalize.matrixAutoUpdate=false;stowedRifle.add(normalize);
 rifleMeshes.forEach(o=>{let m=o.clone();m.name='stowed_'+o.name;normalize.add(m);});
 // Roll the intact gun so its magazine points inboard across the pack, rather
 // than jutting out sideways. Receiver stays just outside the pack's rear face.
 stowedRifle.position.set(-.36,.40,-.915);
 stowedRifle.quaternion.setFromAxisAngle(Z,-1.62).multiply(new T.Quaternion().setFromAxisAngle(X,Math.PI));
 const launcher=createLauncher();chest.add(launcher);
 const rifleKeepers=keepers([[-.48,.03,.12,.105],[.48,.02,.13,.11]],launcher.children[0].material,'rifle_pack_keepers');stowedRifle.add(rifleKeepers);
 const launcherKeepers=keepers([[-.58,0,.185,.185],[.48,0,.177,.177]],launcher.children[0].material,'empty_launcher_keepers');launcher.add(launcherKeepers);
 const gloves={};
 // Original merged glove attributes remain immutable. Recenter clones by their
 // original palm pivots, rather than treating chest-space vertices as a palm.
 for(const side of['right','left']){
  const right=side==='right',carrier=new T.Group();carrier.name=side+'_launcher_glove';launcher.add(carrier);gloves[side]=carrier;
  const center=V(...(right?[-.385,-.21,.085]:[.12,-.105,.09])).applyAxisAngle(Z,-.59).add(V(.035,.34,.70));
  const unbake=new T.Matrix4().makeRotationZ(right?.77:.59).multiply(new T.Matrix4().makeTranslation(-center.x,-center.y,-center.z));
  j[side+'_hand'].children.filter(o=>o.isMesh).forEach(o=>{let m=o.clone();m.matrix.copy(unbake);m.matrixAutoUpdate=false;carrier.add(m);});
  carrier.userData.wrist=right?[-.135*.92,-.015*.92,.015*.92]:[-.095,-.055,.015];
 }
 const arms={};for(const side of['right','left'])arms[side]={upper:j[side+'_arm_upper'],lower:j[side+'_arm_lower'],end:j[side+'_arm_end'],ab:j[side+'_arm_lower'].position.clone(),bc:j[side+'_arm_end'].position.clone()};
 const transforms=[...Object.values(j),launcher,gloves.right,gloves.left];
 let weaponMode='launcher',ammo=1,currentPose='idle',currentAmount=1,currentPhase=0,currentRecoil=0;
 const carryQ=new T.Quaternion().setFromAxisAngle(Z,-.48),aimQ=new T.Quaternion().setFromAxisAngle(V(0,1,0),-1.46);
 const carryP=V(0,.57,.69),headQ=new T.Quaternion().setFromAxisAngle(V(0,1,0),Math.PI/2-1.46).multiply(new T.Quaternion().setFromAxisAngle(Z,.045));
 function visibility(){
  const held=weaponMode==='launcher';rifleMeshes.forEach(o=>o.visible=!held);j.right_hand.visible=j.left_hand.visible=!held;
  stowedRifle.visible=held;gloves.right.visible=gloves.left.visible=held;launcher.visible=true;launcherKeepers.visible=!held;
  unit.userData.weaponMode=weaponMode;unit.userData.rocketAmmo=ammo;
 }
 function solveArm(arm,target,pole){
  unit.updateMatrixWorld(true);
  const a=unit.worldToLocal(arm.upper.getWorldPosition(new T.Vector3())),goal=unit.worldToLocal(target.clone()),d=goal.clone().sub(a),length=d.length(),L=arm.ab.length(),M=arm.bc.length();
  const dist=T.MathUtils.clamp(length,Math.abs(L-M)+.001,L+M-.001),u=d.normalize(),v=pole.clone().sub(a);v.addScaledVector(u,-v.dot(u)).normalize();
  const x=(L*L-M*M+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,L*L-x*x)),b=a.clone().addScaledVector(u,x).addScaledVector(v,h),end=a.clone().addScaledVector(u,dist),rootInv=unit.getWorldQuaternion(new T.Quaternion()).invert();
  const pq=rootInv.clone().multiply(arm.upper.parent.getWorldQuaternion(new T.Quaternion())).invert();
  arm.upper.quaternion.setFromUnitVectors(arm.ab.clone().normalize(),b.clone().sub(a).normalize().applyQuaternion(pq));unit.updateMatrixWorld(true);
  const uq=rootInv.clone().multiply(arm.upper.getWorldQuaternion(new T.Quaternion())).invert();
  arm.lower.quaternion.setFromUnitVectors(arm.bc.clone().normalize(),end.sub(b).normalize().applyQuaternion(uq));unit.updateMatrixWorld(true);
  return {unreachable:length>L+M-.001,error:unit.worldToLocal(arm.end.getWorldPosition(new T.Vector3())).distanceTo(goal)};
 }
 function launcherPose(name='idle',amount=1,phase=0,recoil=0){
  base.setPose(name,amount,phase,0);
  const t=T.MathUtils.clamp(amount,0,1),aim=(name==='aim'||name==='kneel')?t:0,knee=name==='kneel'?t:0,moving=name==='walk'||name==='run';
  // Preserve all accepted leg / foot transforms. Only shoulder, neck and arms
  // are overridden; the tube and both palms are a constrained rigid assembly.
  j.right_arm_upper.position.set(-.42,.77,.055+.055*aim);
  j.left_arm_upper.position.set(.42-.025*aim,.77,.09+.075*aim);
  const level=chest.quaternion.clone().invert().multiply(aimQ),pivot=V(-.555,1.095,.070);
  const target=pivot.clone().sub(V(-.48,0,0).applyQuaternion(level));
  launcher.position.copy(carryP).lerp(target,aim);launcher.quaternion.copy(carryQ).slerp(level,aim);
  if(moving){launcher.position.y+=.014*Math.cos(phase*Math.PI*4);launcher.rotation.x+=.025*Math.sin(phase*Math.PI*2);}
  if(recoil&&aim)launcher.position.addScaledVector(X.clone().applyQuaternion(level),-.010*recoil*aim);
  j.neck.position.set(.018*aim,1.07+.025*aim,.01*aim);
  j.neck.quaternion.identity().slerp(chest.quaternion.clone().invert().multiply(headQ),aim);
  // Pistol hand stays on the trigger grip; support hand wraps the opposite
  // lower side of the tube so it can reach without a straight locked elbow.
  gloves.right.position.set(-.02,-.285,.105);gloves.right.rotation.set(0,0,-.13);
  gloves.left.position.copy(mix(V(.43,-.21,.025),V(.48,-.20,-.11),aim));gloves.left.rotation.set(1.05+.20*aim,0,.03);
  unit.updateMatrixWorld(true);let errors=0,maxError=0;
  for(const side of['right','left']){
   const g=gloves[side],wrist=g.localToWorld(new T.Vector3(...g.userData.wrist));
   const pole=side==='right'?V(-.87,2.29-.707*knee,.12):V(.64,2.19-.707*knee,.40);
   const r=solveArm(arms[side],wrist,pole);errors+=+r.unreachable;maxError=Math.max(maxError,r.error);
  }
  unit.userData.unreachableArms=errors;unit.userData.wristError=maxError;unit.userData.pose=name;unit.updateMatrixWorld(true);
 }
 const snapshot=()=>transforms.map(g=>({p:g.position.clone(),q:g.quaternion.clone()}));
 function interpolate(frames,f){const i=Math.min(frames.length-2,Math.floor(f)),t=f-i;transforms.forEach((g,k)=>{g.position.copy(frames[i][k].p).lerp(frames[i+1][k].p,t);g.quaternion.copy(frames[i][k].q).slerp(frames[i+1][k].q,t);});unit.updateMatrixWorld(true);}
 const clips={};let maxBakeError=0,unreachableSamples=0;
 for(const name of['walk','run']){clips[name]=[];for(let i=0;i<=48;i++){launcherPose(name,1,i/48);maxBakeError=Math.max(maxBakeError,unit.userData.wristError);unreachableSamples+=unit.userData.unreachableArms;clips[name].push(snapshot());}}
 for(const name of['aim','kneel']){clips[name]=[];for(let i=0;i<=16;i++){launcherPose(name,1,0,i/16);maxBakeError=Math.max(maxBakeError,unit.userData.wristError);unreachableSamples+=unit.userData.unreachableArms;clips[name].push(snapshot());}}
 function stowLauncher(){launcher.position.set(.66,.30,-.65);launcher.quaternion.setFromAxisAngle(Z,Math.PI/2);}
 unit.setPose=(name='idle',amount=1,phase=0,recoil=0)=>{
  currentPose=name;currentAmount=amount;currentPhase=phase;currentRecoil=recoil;
  if(weaponMode==='launcher')launcherPose(name,amount,phase,recoil);else{base.setPose(name,amount,phase,recoil);stowLauncher();}visibility();
 };
 unit.sampleCycle=(name,phase)=>{
  currentPose=name;currentPhase=phase;currentAmount=1;currentRecoil=0;
  if(weaponMode==='launcher'){interpolate(clips[name],((phase%1+1)%1)*48);unit.userData.pose=name;}else{base.sampleCycle(name,phase);stowLauncher();}visibility();
 };
 unit.sampleFirePose=(name,recoil=0)=>{
  currentPose=name;currentAmount=1;currentRecoil=recoil;
  if(weaponMode==='launcher'){interpolate(clips[name],T.MathUtils.clamp(recoil,0,1)*16);unit.userData.pose=name;}else{base.sampleFirePose(name,recoil);stowLauncher();}visibility();
 };
 unit.setWeaponMode=mode=>{if(!['launcher','rifle'].includes(mode))throw Error('Unknown weapon mode');weaponMode=mode;unit.setPose(currentPose,currentAmount,currentPhase,currentRecoil);return unit;};
 // Game logic owns ammo consumption. This setter chooses a visual loadout only;
 // firing previews do not silently subtract ammunition or apply game damage.
 unit.setRocketAmmo=n=>{ammo=Math.max(0,Math.floor(Number.isFinite(n)?n:0));unit.setWeaponMode(ammo?'launcher':'rifle');return unit;};
 unit.launcher=launcher;unit.stowedRifle=stowedRifle;unit.launcherGloves=gloves;unit.equipmentKeepers={rifle:rifleKeepers,launcher:launcherKeepers};
 unit.userData.version='AT1.1.0';unit.userData.launcherLandmarks=launcher.userData.landmarks;
 unit.userData.atBake={maxWristError:maxBakeError,unreachableSamples,frames:132};
 unit.userData.atNotes='V1.1: cupped support palm, tighter pistol grip, raised/outboard shoulder seat, low offset handle, magazine-inboard pack stow and two keeper loops. Same V6.7 body/legs and rifle fallback. Instant weapon switch.';
 unit.setPose('idle');let meshes=0,triangles=0;unit.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});unit.userData.totalMeshes=meshes;unit.userData.totalTriangles=triangles;
 return unit;
}
