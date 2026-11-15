import * as T from 'three';

// One shared, opaque, unlit mesh. No textures, lights, shadow pass or particles.
function buildFlashGeometry(){
 const n=12,rings=[{z:.012,r:.018},{z:.075,r:.102},{z:.20,r:.027}],p=[],c=[];
 const colors=['#fff6ce','#ffd15d','#ee8c28'].map(x=>new T.Color(x));
 function point(r,i){const a=i/n*Math.PI*2,s=i%2?.44:1;return new T.Vector3(Math.cos(a)*r.r*s,Math.sin(a)*r.r*s,r.z);}
 function tri(a,b,d,color){p.push(...a.toArray(),...b.toArray(),...d.toArray());for(let j=0;j<3;j++)c.push(color.r,color.g,color.b);}
 for(let row=0;row<rings.length-1;row++)for(let i=0;i<n;i++){const a=point(rings[row],i),b=point(rings[row],i+1),d=point(rings[row+1],i),e=point(rings[row+1],i+1);const color=colors[row].clone().lerp(colors[row+1],i%2?.40:.12);tri(a,b,d,color);tri(b,e,d,color);}
 for(let i=0;i<n;i++){tri(new T.Vector3(0,0,.012),point(rings[0],i+1),point(rings[0],i),colors[0]);tri(point(rings[2],i),point(rings[2],i+1),new T.Vector3(0,0,.36),colors[2]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}
const geometry=buildFlashGeometry();
const material=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,toneMapped:false});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const smooth=t=>t*t*(3-2*t);

export function createInfantryFire(unit){
 if(!unit.sampleFirePose||!unit.userData.fireLandmarks)throw Error('Infantry firing requires the V6.7 rig');
 const marks=unit.userData.fireLandmarks,anchor=new T.Group();anchor.name='muzzle_fx';
 anchor.position.fromArray(marks.muzzle);anchor.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...marks.boreAxis));unit.joints.rifle.add(anchor);
 const flash=new T.Mesh(geometry,material);flash.name='muzzle_flash';flash.visible=false;flash.castShadow=flash.receiveShadow=false;flash.userData.softwareUnlit=true;anchor.add(flash);
 const interval=.12,flashDuration=.055,tail=.24;
 let pose='aim',shots=3,time=0,active=false,hasClip=false,readability=1,disposed=false,recoil=0;
 const duration=()=>interval*(shots-1)+tail;
 function render(t){
  time=clamp(Number.isFinite(t)?t:0,0,duration());let flashAge=Infinity,shotIndex=-1;recoil=0;
  for(let i=0;i<shots;i++){
   const age=time-i*interval;if(age<0)continue;
   if(age<flashDuration){flashAge=age;shotIndex=i;}
   const impulse=age<.012?Math.sin(age/.012*Math.PI/2):age<.19?1-smooth((age-.012)/.178):0;
   recoil=clamp(recoil+impulse,0,1);
  }
  unit.sampleFirePose(pose,recoil);
  flash.visible=shotIndex>=0;
  if(flash.visible){const a=flashAge/flashDuration,s=readability*(1-.45*smooth(a)),variation=1+.07*Math.sin((shotIndex+1)*4.7);flash.scale.set(s*variation,s*variation,s*(1.07+.08*Math.cos(shotIndex*2.4)));flash.rotation.z=shotIndex*1.31;}
  unit.updateMatrixWorld(true);return {time,recoil,flashVisible:flash.visible,shotIndex};
 }
 const api={
  anchor,flash,triangles:geometry.attributes.position.count/3,extraMeshes:1,
  get active(){return active;},get hasClip(){return hasClip;},get time(){return time;},get duration(){return duration();},get shots(){return shots;},get pose(){return pose;},get recoil(){return recoil;},
  start(options={}){if(disposed)throw Error('Firing controller disposed');pose=options.pose||'aim';if(!['aim','kneel'].includes(pose))throw Error('Firing pose must be aim or kneel');shots=clamp(Math.round(options.shots||3),1,5);hasClip=true;active=true;return render(0);},
  update(dt){if(!active||disposed)return;const result=render(time+Math.max(0,Number.isFinite(dt)?dt:0));if(time>=duration())active=false;return result;},
  seek(seconds){if(disposed)throw Error('Firing controller disposed');hasClip=true;active=false;return render(seconds);},
  pause(){active=false;},
  resume(){if(!hasClip||disposed)return;if(time>=duration())time=0;active=true;render(time);},
  cancel({restore=true}={}){active=false;flash.visible=false;recoil=0;time=0;if(restore&&hasClip)unit.sampleFirePose(pose,0);hasClip=false;},
  setReadabilityScale(value){const next=clamp(Number.isFinite(value)?value:1,.75,1.5);if(next===readability)return;readability=next;if(hasClip)render(time);},
  dispose(){if(disposed)return;api.cancel();anchor.removeFromParent();disposed=true;}
 };
 return api;
}
