import * as T from 'three';
import {createSoldier as original} from './soldier-v5_2.js';
import {applyBootProfileToSource} from './boot-profile.js';
const V=a=>new T.Vector3(...a);
export function createSoldier({bootProfile='legacy',wristProfile='legacy',factionSupport=false}={}){
 if(!['legacy','W1','W2'].includes(wristProfile))throw Error('Unknown wrist profile: '+wristProfile);
 const source=original(),root=new T.Group();root.name='Infantry_V6_7';
 if(bootProfile==='B1')applyBootProfileToSource(source);
 else if(bootProfile!=='legacy')throw Error('Unknown boot profile: '+bootProfile);
 source.updateMatrixWorld(true);
 const joints={};
 function joint(name,p,parent=root){let g=new T.Group();g.name=name;parent.add(g);g.position.copy(V(p));joints[name]=g;return g;}
 const pelvis=joint('pelvis',[0,1.6,0]),chest=joint('chest',[0,.35,0],pelvis),neck=joint('neck',[0,1.07,0],chest);
 const rifle=joint('rifle',[0,0,0],chest);root.updateMatrixWorld(true);
 function transfer(o,parent){source.updateMatrixWorld(true);root.updateMatrixWorld(true);parent.attach(o);}
 transfer(source.getObjectByName('hips'),pelvis);transfer(source.getObjectByName('torso'),chest);transfer(source.getObjectByName('head'),neck);
 transfer(source.getObjectByName('rifle'),rifle);rifle.children[0].name='weapon_geometry';
 const stock=rifle.worldToLocal(rifle.children[0].localToWorld(new T.Vector3(-.86,.02,0)));
 const muzzle=rifle.worldToLocal(rifle.children[0].localToWorld(new T.Vector3(1.14,.015,0)));
 // Landmarks from the accepted meshes, captured before rigid-part merging.
 const opticRear=rifle.worldToLocal(rifle.children[0].localToWorld(new T.Vector3(-.37,.241,0)));
 const boreAxis=new T.Vector3(1,0,0).applyQuaternion(rifle.children[0].quaternion);
 // Use a point within the lower part of the tall stylized pupil, not below it.
 const rightEye=neck.worldToLocal(neck.children[0].localToWorld(new T.Vector3(-.18,3.39,.329)));
 const handTargets={},wrists={};for(let n of ['trigger_hand','support_hand']){let o=source.getObjectByName(n),right=n==='trigger_hand';if(!right)o.position.add(new T.Vector3(-.24,0,0).applyQuaternion(o.quaternion));else{o.position.add(new T.Vector3(-.02,-.03,-.01).applyQuaternion(o.quaternion));o.scale.setScalar(.92);o.rotateZ(-.18);}let h=joint(right?'right_hand':'left_hand',[0,0,0],rifle);transfer(o,h);handTargets[n]=o;root.updateMatrixWorld(true);wrists[right?'right_arm':'left_arm']=rifle.worldToLocal(o.localToWorld(right?new T.Vector3(-.135,-.015,.015):new T.Vector3(-.095,-.055,.015)));}
 const limb=[];
 function chain(name,A,B,C,parent){root.updateMatrixWorld(true);let upper=joint(name+'_upper',[0,0,0],parent);upper.position.copy(parent.worldToLocal(V(A)));root.updateMatrixWorld(true);let lower=joint(name+'_lower',V(B).sub(V(A)).toArray(),upper);let end=joint(name+'_end',V(C).sub(V(B)).toArray(),lower);let entry={name,upper,lower,end,A:V(A),B:V(B),C:V(C),ab:V(B).sub(V(A)),bc:V(C).sub(V(B))};limb.push(entry);return entry;}
 function ball(parent,pos,r,color){let o=new T.Mesh(new T.IcosahedronGeometry(r,1),new T.MeshStandardMaterial({color,roughness:.86,flatShading:true}));o.position.copy(pos);o.userData.factionRegion=parent.name.endsWith('_leg_end')?0:2;parent.add(o);}
 // Closed, tapered octagonal sleeves. Colours are sampled from the accepted
 // sleeve camouflage; end caps and short overlapping cuffs hide articulation seams.
 function segment(parent,A,B,r0,r1,sourceMesh){
  let axis=B.clone().sub(A),len=axis.length(),dir=axis.normalize(),u=new T.Vector3(0,0,1).cross(dir).normalize(),v=dir.clone().cross(u),rings=[[-.10,r0*.9],[.08,r0],[.78,r1*1.08],[1.08,r1]],pts=[],ids=[];
  for(let [t,r] of rings)for(let i=0;i<8;i++){let a=(i+.5)*Math.PI/4;pts.push(A.clone().addScaledVector(dir,t*len).addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r*.92));}
  for(let j=0;j<3;j++)for(let i=0;i<8;i++){let a=j*8+i,b=j*8+(i+1)%8;ids.push(a,b,a+8,b,b+8,a+8);}for(let i=1;i<7;i++)ids.push(0,i+1,i,24,24+i,24+i+1);
  let src=sourceMesh.geometry.attributes,nearest=p=>{let best=Infinity,k=0;for(let i=0;i<src.position.count;i+=9){let d=p.distanceToSquared(new T.Vector3().fromBufferAttribute(src.position,i));if(d<best){best=d;k=i;}}return new T.Color().fromBufferAttribute(src.color,k);},pos=[],colors=[];
  parent.updateWorldMatrix(true,false);let inv=parent.matrixWorld.clone().invert();for(let i=0;i<ids.length;i+=3){let center=pts[ids[i]].clone().add(pts[ids[i+1]]).add(pts[ids[i+2]]).multiplyScalar(1/3),c=nearest(center);for(let j=0;j<3;j++){pos.push(...pts[ids[i+j]].clone().applyMatrix4(inv).toArray());colors.push(c.r,c.g,c.b);}}
  let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();let mesh=new T.Mesh(g,sourceMesh.material);mesh.userData.factionRegion=2;parent.add(mesh);
 }
 for(let s of [-1,1]){let name=s<0?'right':'left',leg=chain(name+'_leg',[s*.28,1.6,0],[s*.36,.98,.035],[s*.445,.30,.055],pelvis),old=source.getObjectByName(name+'_leg');
  for(let o of [...old.children]){let n=o.name;if(n===name+'_boot')transfer(o,leg.end);else if(/shin|knee/.test(n)||n==='ankle_cuff')transfer(o,leg.lower);else transfer(o,leg.upper);}
  ball(leg.lower,new T.Vector3(),.17,0x8a8963);ball(leg.upper,new T.Vector3(),.19,0x99946d);
  ball(leg.end,new T.Vector3(),.115,0x484438);
  let wrist=s<0?[-.43,2.25,.60]:[.43,2.02,.65],elbow=s<0?[-.63,2.28,.10]:[.74,2.12,.22],arm=chain(name+'_arm',[s*.42,2.72,0],elbow,wrist,chest),sleeve=source.getObjectByName(name+'_sleeve');
  segment(arm.upper,arm.A,arm.B,.205,.178,sleeve);segment(arm.lower,arm.B,arm.C,.176,.139,sleeve);sleeve.removeFromParent();ball(arm.lower,new T.Vector3(),.173,0x99946d);ball(arm.upper,new T.Vector3(),.205,0xb5a57c);
 }
 // Sleeve insignia and cuffs follow their own limb, never the whole torso.
 for(let o of [...source.getObjectByName('arms').children]){let p=o.getWorldPosition(new T.Vector3()),arm=limb.find(l=>l.name===(p.x<0?'right_arm':'left_arm'));transfer(o,p.z>.35?arm.lower:arm.upper);}
 root.updateMatrixWorld(true);
 // Merge all rigid pieces per joint. Vertex colour retains material colour; rifle
 // remains separated by its material response so its accepted appearance survives.
 const rigid=[...Object.values(joints)];for(let g of rigid){let buckets=new Map(),objects=[];function collect(o){for(let ch of o.children){if(rigid.includes(ch))continue;if(ch.isMesh){objects.push(ch);let k=ch.material.metalness||0;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(ch);}collect(ch);}}collect(g);
  let inv=g.matrixWorld.clone().invert();for(let [metal,objs] of buckets){let pos=[],norm=[],col=[];for(let o of objs){let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry,m=inv.clone().multiply(o.matrixWorld),nm=new T.Matrix3().getNormalMatrix(m);for(let i=0;i<geo.attributes.position.count;i++){pos.push(...new T.Vector3().fromBufferAttribute(geo.attributes.position,i).applyMatrix4(m).toArray());norm.push(...new T.Vector3().fromBufferAttribute(geo.attributes.normal,i).applyNormalMatrix(nm).toArray());let color=o.material.color.clone();if(o.material.vertexColors&&geo.attributes.color)color.multiply(new T.Color().fromBufferAttribute(geo.attributes.color,i));col.push(color.r,color.g,color.b);}}
   let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));let m=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,flatShading:true,roughness:metal?.65:.86,metalness:metal}));m.name=g.name+'_merged';m.castShadow=m.receiveShadow=true;g.add(m);}
  objects.forEach(o=>o.removeFromParent());
  if(factionSupport){
   // Classify the original semantic parts BEFORE their identity is lost in the
   // rigid merge. Never tint a whole joint: chest includes skin, head includes
   // eyes/straps, and the ankle includes leather. Weapons/hands/boots are fixed.
   const outputs=g.children.filter(o=>o.isMesh),fixed=/^(rifle|right_hand|left_hand|right_leg_end|left_leg_end)$/.test(g.name);
   [...buckets.values()].forEach((objs,k)=>{const mask=[];for(const o of objs){
    let region=0;
    if(!fixed){
     if(o.name==='helmet_shell')region=1;
     else if(o.userData.factionRegion!==undefined)region=o.userData.factionRegion;
     else if(o.material.vertexColors)region=2;
     else if(['8e835f','797956','918967'].includes(o.material.color.getHexString()))region=3;
    }
    const count=o.geometry.index?.count??o.geometry.attributes.position.count;for(let i=0;i<count;i++)mask.push(region);
   }outputs[k].geometry.setAttribute('factionMask',new T.BufferAttribute(new Uint8Array(mask),1));});
  }
 }
 const rest={};for(let [n,g] of Object.entries(joints))rest[n]={p:g.position.clone(),q:g.quaternion.clone()};
 const firingQ=new T.Quaternion().setFromEuler(new T.Euler(0,-1.35,.59));
 const firingBore=boreAxis.clone().applyQuaternion(firingQ);
 const headAimQ=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),firingBore).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),.10));
 const eyeRelief=.18;
 // Stylized clearance allowance: above and to the character's left of the
 // optical axis. Preserve facing direction, rather than forcing pupil contact.
 const aimEyeOffset=new T.Vector3(.065,.105,0).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),firingBore));
 const carryQ=new T.Quaternion().setFromEuler(new T.Euler(0,-1.35,.25)),carryP=new T.Vector3(-.25,.82,.15).sub(stock.clone().applyQuaternion(carryQ));
 // W1 is a carry-only correction. The firing glove/stock/eye solution is frozen.
 // Keep glove geometry immutable (also used to make the AT launcher gloves).
 // Idle can use a forward grip; moving carry points the gun farther forwards,
 // so it retains its shorter grip reach. Both use the corrected sleeve entry.
 const carryHandOffset=new T.Vector3(.18,0,0).applyQuaternion(handTargets.support_hand.quaternion);
 const carryWrist=rifle.worldToLocal(handTargets.support_hand.localToWorld(new T.Vector3(.02,.04,-.04)));
 // W2 seats the palm UNDER / BEHIND the handguard. The sleeve enters the rear
 // palm edge instead of passing through the bore to a front-side wrist target.
 // Hand and rifle vertices remain immutable; only this rigid hand carrier moves.
 const gunFrame=new T.Matrix4().makeTranslation(.035,.34,.70).multiply(new T.Matrix4().makeRotationZ(-.59));
 const palmFrame=gunFrame.clone().multiply(new T.Matrix4().makeTranslation(.12,-.105,.09));
 const supportFrame=gunFrame.clone().multiply(new T.Matrix4().makeTranslation(.30,-.220,-.15));
 const supportTransform=supportFrame.clone().multiply(palmFrame.clone().invert());
 const supportPosition=new T.Vector3(),supportRotation=new T.Quaternion();supportTransform.decompose(supportPosition,supportRotation,new T.Vector3());
 const supportWrist=new T.Vector3(.02,.04,-.09).applyMatrix4(supportFrame);
 // Re-seat below AND ahead of the magazine, not through it on a straight line.
 const underBarrel=new T.Vector3(.12,-.08,0).applyMatrix3(new T.Matrix3().setFromMatrix4(gunFrame));
 // Height of the boot's actual sole after ankle pitch: toe contact rather than
 // the old heel-planted, toe-up pose. No scaling or vertex deformation is used.
 const footPoints={};for(let side of ['right','left']){let g=joints[side+'_leg_end'];footPoints[side]=g.children.filter(o=>o.isMesh).flatMap(o=>{let a=o.geometry.attributes.position;return Array.from({length:a.count},(_,i)=>new T.Vector3().fromBufferAttribute(a,i));});}
 function soleHeight(side,angle){let q=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle);return .001-Math.min(...footPoints[side].map(p=>p.clone().applyQuaternion(q).y));}
 function solve(l,target,pole){root.updateMatrixWorld(true);let a=root.worldToLocal(l.upper.getWorldPosition(new T.Vector3())),d=root.worldToLocal(target.clone()).sub(a),len=d.length(),L=l.ab.length(),M=l.bc.length(),dist=T.MathUtils.clamp(len,Math.abs(L-M)+.001,L+M-.001),u=d.normalize(),v=root.worldToLocal(pole.clone()).sub(a);v.addScaledVector(u,-v.dot(u)).normalize();let x=(L*L-M*M+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,L*L-x*x)),b=a.clone().addScaledVector(u,x).addScaledVector(v,h),end=a.clone().addScaledVector(u,dist),rootInv=root.getWorldQuaternion(new T.Quaternion()).invert();
  let parentQ=rootInv.clone().multiply(l.upper.parent.getWorldQuaternion(new T.Quaternion())).invert(),ab=b.clone().sub(a).normalize().applyQuaternion(parentQ);l.upper.quaternion.setFromUnitVectors(l.ab.clone().normalize(),ab);root.updateMatrixWorld(true);let uq=rootInv.clone().multiply(l.upper.getWorldQuaternion(new T.Quaternion())).invert(),bc=end.sub(b).normalize().applyQuaternion(uq);l.lower.quaternion.setFromUnitVectors(l.bc.clone().normalize(),bc);root.updateMatrixWorld(true);return len>L+M;}
 function pose(name='idle',amount=1,phase=0,recoil=0){let t=T.MathUtils.clamp(amount,0,1);for(let [n,g] of Object.entries(joints)){g.position.copy(rest[n].p);g.quaternion.copy(rest[n].q);}let moving=name==='walk'||name==='run',running=name==='run',aim=(name==='aim'||name==='kneel')?t:0,knee=name==='kneel'?t:0;
  pelvis.position.y-=.707*knee;pelvis.position.z-=.08*knee;chest.rotation.x=.12*knee;
  // Protract the shoulders slightly as the rifle is raised. This brings the
  // shoulder pocket to the unchanged buttpad without locking either elbow.
  joints.right_arm_upper.position.z+=.10*aim;
  joints.left_arm_upper.position.z+=.16*aim;
  joints.left_arm_upper.position.x-=.06*aim;
  // Weapon and hands are one constrained assembly; aiming raises the barrel.
  const shoulderAnchor=new T.Vector3(-.36,.88,.31),levelFiringQ=chest.quaternion.clone().invert().multiply(firingQ);
  rifle.quaternion.identity().slerp(levelFiringQ,aim);rifle.position.copy(stock).lerp(shoulderAnchor,aim).sub(stock.clone().applyQuaternion(rifle.quaternion));
  // Use a small visual eye/optic allowance to release the chibi jaw from the
  // stock. Head +Z stays parallel to the bore, including while kneeling.
  const neckAimQ=chest.quaternion.clone().invert().multiply(headAimQ);
  const eyeTarget=opticRear.clone().sub(stock).applyQuaternion(levelFiringQ).add(shoulderAnchor).addScaledVector(boreAxis.clone().applyQuaternion(levelFiringQ),-eyeRelief).add(aimEyeOffset.clone().applyQuaternion(chest.quaternion.clone().invert()));
  neck.quaternion.slerp(neckAimQ,aim);
  neck.position.lerp(eyeTarget.sub(rightEye.clone().applyQuaternion(neckAimQ)),aim);
  if(recoil>0&&aim){
   const kick=T.MathUtils.clamp(recoil,0,1)*aim,contact=stock.clone().applyQuaternion(rifle.quaternion).add(rifle.position);
   const right=new T.Vector3(1,0,0).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),firingBore)).applyQuaternion(chest.quaternion.clone().invert());
   rifle.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(right,-.010*kick));
   rifle.position.copy(contact).sub(stock.clone().applyQuaternion(rifle.quaternion)).addScaledVector(boreAxis.clone().applyQuaternion(levelFiringQ),-.035*kick);
  }
  if(moving){let a=phase*Math.PI*2;pelvis.position.y=(running?1.33:1.48)+(running?.045:.025)*Math.cos(a*2);pelvis.position.x=.025*Math.sin(a);chest.rotation.x=running?.13:.055;chest.rotation.y=.025*Math.sin(a);rifle.quaternion.copy(carryQ);rifle.position.copy(carryP);rifle.position.y+=.02*Math.cos(a*2);}
  if(wristProfile==='W1')joints.left_hand.position.addScaledVector(carryHandOffset,moving?0:1-aim);
  if(wristProfile==='W2'){
   if(moving)joints.left_hand.position.set(0,0,0);
   else{joints.left_hand.position.lerp(supportPosition,1-aim).addScaledVector(underBarrel,Math.sin(Math.PI*aim));joints.left_hand.quaternion.slerp(supportRotation,1-aim);}
  }
  root.updateMatrixWorld(true);
  for(let l of limb.filter(l=>l.name.endsWith('leg'))){let s=l.name.startsWith('right')?-1:1,target=l.C.clone(),pitch=s<0?1.05*knee:0;if(s<0){target.z-=.78*knee;target.y=soleHeight('right',pitch);}else{target.z+=.58*knee;target.y=soleHeight('left',0);}
   if(moving){let u=((phase+(s<0?0:.5))%1+1)%1,duty=running?.44:.62,reach=running?.65:.42;target.x=s*(running?.34:.32);if(u<duty){target.z=.055+reach*(1-2*u/duty);}else{let swing=(u-duty)/(1-duty);target.z=.055+reach*(-1+2*swing);target.y+=(running?.36:.19)*Math.sin(Math.PI*swing)**2;}}
   solve(l,root.localToWorld(target),root.localToWorld(new T.Vector3(s*.42,knee&&s<0?-1:1.1,1.5)));let q=l.lower.getWorldQuaternion(new T.Quaternion()).invert().multiply(root.getWorldQuaternion(new T.Quaternion()));l.end.quaternion.copy(q);l.end.rotateX(pitch);}
  root.updateMatrixWorld(true);let armError=0,maxWristError=0;for(let l of limb.filter(l=>l.name.endsWith('arm'))){let right=l.name.startsWith('right'),anchor=wrists[l.name].clone();if(!right&&wristProfile==='W1')anchor.lerp(carryWrist.clone().addScaledVector(carryHandOffset,moving?0:1),1-aim);if(!right&&wristProfile==='W2'){anchor.lerp(moving?carryWrist:supportWrist,1-aim);if(!moving)anchor.addScaledVector(underBarrel,Math.sin(Math.PI*aim));}let hand=rifle.localToWorld(anchor);if(solve(l,hand,root.localToWorld(new T.Vector3(right?-.76:.85,(right?2.45:2.35)-.707*knee,right?.24:.38))))armError++;maxWristError=Math.max(maxWristError,root.worldToLocal(l.end.getWorldPosition(new T.Vector3())).distanceTo(root.worldToLocal(hand)));}
  root.updateMatrixWorld(true);root.userData.pose=name;root.userData.unreachableArms=armError;root.userData.wristError=maxWristError;}
 root.userData={version:'6.7.0',rig:'rigid joints, no skinning',triangles:0,meshes:0,aimLandmarks:{rightEye:rightEye.toArray(),opticRear:opticRear.toArray(),boreAxis:boreAxis.toArray(),stock:stock.toArray(),eyeRelief,eyeOffset:aimEyeOffset.toArray()},fireLandmarks:{muzzle:muzzle.toArray(),boreAxis:boreAxis.toArray(),maxTravel:.035,maxRiseRadians:.010}};root.traverse(o=>{if(o.isMesh){root.userData.meshes++;root.userData.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 // Bake 48 samples once. Playback interpolates transforms, without per-frame IK.
 const cycles={};for(let name of ['walk','run']){let frames=[];for(let i=0;i<=48;i++){pose(name,1,i/48);frames.push(Object.values(joints).map(g=>({p:g.position.clone(),q:g.quaternion.clone()})));}cycles[name]=frames;}
 function sampleCycle(name,phase){if(!cycles[name])throw Error('Unknown cycle: '+name);let f=((phase%1+1)%1)*48,i=Math.floor(f),t=f-i;Object.values(joints).forEach((g,j)=>{g.position.copy(cycles[name][i][j].p).lerp(cycles[name][i+1][j].p,t);g.quaternion.copy(cycles[name][i][j].q).slerp(cycles[name][i+1][j].q,t);});root.updateMatrixWorld(true);root.userData.pose=name;}
 // Recoil is baked with both arms solving to their unchanged glove anchors.
 // Runtime fire playback only interpolates transforms; no per-frame IK.
 const firePoses={};for(let name of ['aim','kneel']){firePoses[name]=[];for(let i=0;i<=16;i++){pose(name,1,0,i/16);if(root.userData.unreachableArms)throw Error('Unreachable recoil pose');firePoses[name].push(Object.values(joints).map(g=>({p:g.position.clone(),q:g.quaternion.clone()})));}}
 root.sampleFirePose=(name,recoil=0)=>{if(!firePoses[name])throw Error('Firing pose must be aim or kneel');let f=T.MathUtils.clamp(recoil,0,1)*16,i=Math.min(15,Math.floor(f)),t=f-i;Object.values(joints).forEach((g,j)=>{g.position.copy(firePoses[name][i][j].p).lerp(firePoses[name][i+1][j].p,t);g.quaternion.copy(firePoses[name][i][j].q).slerp(firePoses[name][i+1][j].q,t);});root.updateMatrixWorld(true);root.userData.pose=name;};
 root.setPose=pose;root.sampleCycle=sampleCycle;root.joints=joints;root.userData.cycles={walk:{duration:1.2,speed:2*.42/(.62*1.2)},run:{duration:.72,speed:2*.65/(.44*.72)}};
 if(source.userData.bootProfile)root.userData.bootProfile={...source.userData.bootProfile};
 root.userData.wristProfile=wristProfile;
 pose('idle');return root;
}
