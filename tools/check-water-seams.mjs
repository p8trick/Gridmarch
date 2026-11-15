// 水域接缝检查：沿每条"不同组件相邻"的格边，两侧各取 49 个点，比较高度与顶点色
import * as THREE from 'three';
import {PRESETS,createWaterWorld,boardGrass} from '../src/game/map-builder.js';
import '../src/game/levels/index.js';   // 关卡预设也纳入检查
import {PALETTE as P} from 'palette';
const key=(x,z)=>x+','+z, preset=PRESETS[process.argv[2]||'bay'], w=createWaterWorld(preset,{cutaway:false});
const owner=w.plan.owner;   // 每格由哪个组件生成（plan 给出）
const regionOf=(name)=>w.parts[name]?.group;
const meshesOf=n=>{const m=[];regionOf(n)?.traverse(x=>x.isMesh&&x.visible&&m.push(x));return m;};
const cache={};const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
function sample(name,x,z){
  if(name==='land'){const c=new THREE.Color(P[(Math.round(x/2)+Math.round(z/2))&1?'grass':'grassAlt']);return{y:0,c:[c.r,c.g,c.b]};}
  const ms=cache[name]||(cache[name]=meshesOf(name));ray.set(new THREE.Vector3(x,5,z),down);const h=ray.intersectObjects(ms,false)[0];if(!h)return null;
  const g=h.object.geometry,col=g.attributes.color,idx=g.index,f=h.face,pos=g.attributes.position;
  const V=i=>new THREE.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)),bc=new THREE.Vector3();THREE.Triangle.getBarycoord(h.point,V(f.a),V(f.b),V(f.c),bc);
  const c=[0,1,2].map(k=>col?col.getX(f.a)*bc.x+col.getX(f.b)*bc.y+col.getX(f.c)*bc.z:0);
  const cc=[0,1,2].map(k=>[col.getX,col.getY,col.getZ][k].call(col,f.a)*bc.x+[col.getX,col.getY,col.getZ][k].call(col,f.b)*bc.y+[col.getX,col.getY,col.getZ][k].call(col,f.c)*bc.z);
  return{y:h.point.y,c:cc};
}
const stat={};let total=0;
const cells=[...owner.keys()].map(k=>k.split(',').map(Number));
for(const [cx,cz] of cells)for(const [dx,dz] of [[1,0],[0,1]]){
  const nx=cx+dx,nz=cz+dz,a=owner.get(key(cx,cz)),b=owner.get(key(nx,nz));if(!b||a===b)continue;
  const pair=[a,b].sort().join('|')+'  ['+w.typeAt(cx,cz)+'|'+w.typeAt(nx,nz)+']',s=stat[pair]||(stat[pair]={edges:0,n:0,gap:0,dy:0,dc:0,dyAt:null,dcAt:null,bad:0});s.edges++;
  const ex=2*cx+dx, ez=2*cz+dz; // 共享边中心（世界）
  for(let i=0;i<=48;i++){const t=-.96+1.92*i/48,px=dx?ex:ex+t*(dz?1:0),pz=dz?ez:ez+t,e=1e-5;
    // dx=1：边在 x=2cx+1，沿 z；dz=1：边在 z=2cz+1，沿 x
    const along=dx?t:t,bx=dx?2*cx+1:2*cx+t,bz=dx?2*cz+t:2*cz+1;
    const A=sample(a,dx?bx-e:bx,dx?bz:bz-e),B=sample(b,dx?bx+e:bx,dx?bz:bz+e);s.n++;
    if(!A||!B){s.gap++;continue;}
    const dy=Math.abs(A.y-B.y);
    // 颜色：草地格之间本来就是棋盘交错色，所以"相邻两侧不同"是正常的。草样本改比"是否等于所在格的棋盘草色"；非草样本（水/沙/岩）两侧直接比
    const grassy=q=>q.c[1]-Math.max(q.c[0],q.c[2])>.1, exp=(x,z)=>{const c=new THREE.Color(boardGrass(Math.round(x/2),Math.round(z/2)));return[c.r,c.g,c.b]};
    const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
    const ea=exp(dx?bx-1:bx, dx?bz:bz-1), eb=exp(dx?bx+1:bx, dx?bz:bz+1);   // 各自所在格的中心附近点（只用来取整到格）
    const dc=(grassy(A)||grassy(B))?Math.max(grassy(A)?dist(A.c,ea):0,grassy(B)?dist(B.c,eb):0):dist(A.c,B.c);
    if(dy>s.dy){s.dy=dy;s.dyAt=[bx.toFixed(2),bz.toFixed(2)];}if(dc>s.dc){s.dc=dc;s.dcAt=[bx.toFixed(2),bz.toFixed(2)];}
    if(dy>2e-3||dc>.08){s.bad++;if(process.env.VERBOSE&&(s.shown=(s.shown||0)+1)<=3){const f=v=>v.map(q=>q.toFixed(3)).join(',');console.log('   超差样本',pair,'点',[bx.toFixed(3),bz.toFixed(3)],a,f(A.c),'|',b,f(B.c),'Δy',dy.toFixed(4));}}total++;
  }
}
console.log('预设',preset.name);
for(const [k,s] of Object.entries(stat))console.log(k.padEnd(40),`边${s.edges} 采样${s.n} 缺口${s.gap} 超差${s.bad} 最大Δy ${s.dy.toFixed(4)} 最大Δ色 ${s.dc.toFixed(3)}`);
