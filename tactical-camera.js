// TacticalCamera — fixed-pitch strategy camera: drag = pan, pinch/wheel = zoom (tiles across the short screen edge), 90° rotate.
import * as THREE from 'three';
export class TacticalCamera{
 constructor(cam,dom,{tile=2,mapW=12,mapH=12,pitch=55,tiles=7,minTiles=5,maxTiles=9}={}){
  Object.assign(this,{cam,dom,tile,mapW,mapH,pitch:pitch*Math.PI/180,tiles,minTiles,maxTiles,yaw:0,target:new THREE.Vector3(),_tw:null});
  const P=new Map();let pd=0;dom.style.touchAction='none';
  const cl=(v,a,b)=>Math.min(b,Math.max(a,v));this.cl=cl;
  dom.addEventListener('pointerdown',e=>{dom.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);if(P.size===2){const[a,b]=[...P.values()];pd=Math.hypot(a[0]-b[0],a[1]-b[1])}});
  dom.addEventListener('pointermove',e=>{const o=P.get(e.pointerId);if(!o)return;const dx=e.clientX-o[0],dy=e.clientY-o[1];P.set(e.pointerId,[e.clientX,e.clientY]);
   if(P.size===1)this._pan(dx,dy);else if(P.size===2){const[a,b]=[...P.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);this.tiles=cl(this.tiles*pd/d,this.minTiles,this.maxTiles);pd=d}this.dirty=true});
  const up=e=>{P.delete(e.pointerId);if(P.size===2){const[a,b]=[...P.values()];pd=Math.hypot(a[0]-b[0],a[1]-b[1])}};dom.addEventListener('pointerup',up);dom.addEventListener('pointercancel',up);
  dom.addEventListener('wheel',e=>{e.preventDefault();this.tiles=cl(this.tiles*Math.exp(e.deltaY*.001),this.minTiles,this.maxTiles);this.dirty=true},{passive:false});
  this.dirty=true;this.place();
 }
 _short(){const c=this.cam,t=Math.tan(c.fov*Math.PI/360);return Math.min(t,t*c.aspect)}
 _pan(dx,dy){const W=Math.min(this.dom.clientWidth,this.dom.clientHeight),k=this.tiles*this.tile/W,s=Math.sin(this.yaw),c=Math.cos(this.yaw);
  this.target.x-= (c*dx+s*dy/Math.sin(this.pitch))*k;this.target.z+= (s*dx-c*dy/Math.sin(this.pitch))*k;
  const bx=this.mapW*this.tile/2,bz=this.mapH*this.tile/2;this.target.x=this.cl(this.target.x,-bx,bx);this.target.z=this.cl(this.target.z,-bz,bz)}
 setTiles(t){this.tiles=this.cl(t,this.minTiles,this.maxTiles);this.dirty=true}
 rotate(dir){this._tw={from:this.yaw,to:this.yaw+dir*Math.PI/2,t0:performance.now()}}
 resize(){this.cam.aspect=innerWidth/innerHeight;this.cam.updateProjectionMatrix();this.dirty=true}
 place(){const D=this.tiles*this.tile/(2*this._short()),cp=Math.cos(this.pitch);
  this.cam.position.set(this.target.x+D*cp*Math.sin(this.yaw),this.target.y+D*Math.sin(this.pitch),this.target.z+D*cp*Math.cos(this.yaw));this.cam.lookAt(this.target)}
 // returns true while the camera is moving/animating
 update(now){let busy=false;if(this._tw){const k=Math.min(1,(now-this._tw.t0)/260),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;this.yaw=this._tw.from+(this._tw.to-this._tw.from)*e;if(k>=1)this._tw=null;busy=true}
  if(this.dirty||busy){this.place();this.dirty=false;return true}return false}
}
