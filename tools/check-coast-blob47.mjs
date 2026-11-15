// 高战式 47 种邻域完备性：中心陆格的 8 邻域去冗余后共 47 种，规划器必须全部接受（海岸补全后的回归）。运行：node --no-warnings --loader ./tools/loader.mjs tools/check-coast-blob47.mjs
import {planCoast47} from '../src/art/water/coast47-performance.js';
const rect=(x0,x1,z0,z1)=>{const o=[];for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)o.push([x,z]);return o;};
const board=rect(-3,3,-3,3), D=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const norm=m=>{let n=m;for(const i of [1,3,5,7]){const oa=m>>((i+7)%8)&1,ob=m>>((i+1)%8)&1;if(!(oa&&ob))n&=~(1<<i);}return n;};
const set=new Set();for(let m=0;m<256;m++)set.add(norm(m));
let ok=0,bad=0;const kinds={};
for(const n of [...set]){const land=[[0,0],...D.filter((d,i)=>n>>i&1)];
  try{const p=planCoast47({cells:board,landCells:land,coastType:'shoal',seed:7});const r=p.recordAt(0,0);ok++;const k=r.shape?.kind??r.kind;kinds[k]=(kinds[k]||0)+1;}catch(e){bad++;console.log('拒绝',n,e.message.slice(0,100));}}
console.log('47 种（去冗余）接受',ok,'拒绝',bad); console.log('形态分布',JSON.stringify(kinds));
