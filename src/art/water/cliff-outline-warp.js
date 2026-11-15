// C2: piecewise-affine shoreline displacement on the *existing* A7.3 grid.
// Land, rock foot and clipped water share this map, so extra water vertices
// remain on the same transformed land/water segments. All grid borders stay fixed.
const N=16,STEP=2/N,clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const hash=(x,z,s)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(s,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const noise=(t,seed)=>{const k=Math.floor(t),f=t-k;return (hash(k,0,seed)*2-1)*(1-f)+(hash(k+1,0,seed)*2-1)*f;};
export function createCliffOutlineWarp(cx,cz,profile){
 const nodes=[],buckets=[];let maxDisplacement=0,minAreaRatio=Infinity,gain=1;
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
  const inside=i>0&&i<N&&j>0&&j<N,x=-1+i*STEP+(inside?(hash(cx*N+i,cz*N+j,profile.seed)-.5)*STEP*.25:0),z=-1+j*STEP+(inside?(hash(cx*N+i,cz*N+j,profile.seed+1)-.5)*STEP*.25:0),wx=x+cx*2,wz=z+cz*2,d=profile.distance(wx,wz);
  const gx=profile.distance(wx+.001,wz)-profile.distance(wx-.001,wz),gz=profile.distance(wx,wz+.001)-profile.distance(wx,wz-.001),length=Math.hypot(gx,gz);
  const edge=smooth((1-Math.abs(x))/.24)*smooth((1-Math.abs(z))/.24),shore=1-smooth((Math.abs(d)-.08)/.48);
  const uneven=.18*noise((wx*.91+wz*.53+profile.seed*.17)/.62,profile.seed+41)+.085*noise((wx*.67-wz*.61)/.27,profile.seed+89),offset=inside&&length>.0001?edge*shore*uneven:0;
  const dx=length?gx/length*offset:0,dz=length?gz/length*offset:0;nodes.push({p:[x,z],q:[x+dx,z+dz],delta:[dx,dz]});maxDisplacement=Math.max(maxDisplacement,Math.hypot(dx,dz));
 }
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const a=j*(N+1)+i,b=a+1,c=b+N+1,d=a+N+1,tris=((i+j+cx+cz)%2?[[a,b,d],[b,c,d]]:[[a,b,c],[a,c,d]]).map(ids=>ids.map(k=>nodes[k]));
  buckets.push(tris);
 }
 // Reduce the whole cell's displacement only when needed to keep a healthy
 // orientation. Border anchors remain fixed at every strength and every seed.
 const measure=()=>{let minimum=Infinity;for(const tris of buckets)for(const tri of tris)minimum=Math.min(minimum,cross(...tri.map(v=>v.q))/cross(...tri.map(v=>v.p)));return minimum;};
 minAreaRatio=measure();while(minAreaRatio<.25){gain*=.8;for(const v of nodes)v.q=v.p.map((x,k)=>x+v.delta[k]*gain);minAreaRatio=measure();}
 const map=(x,z)=>{
  if(Math.abs(Math.abs(x)-1)<1e-6||Math.abs(Math.abs(z)-1)<1e-6||maxDisplacement===0)return [x,z];
  const ix=Math.max(0,Math.min(N-1,Math.floor((x+1)/STEP))),iz=Math.max(0,Math.min(N-1,Math.floor((z+1)/STEP))),p=[x,z];
  for(let j=Math.max(0,iz-1);j<=Math.min(N-1,iz+1);j++)for(let i=Math.max(0,ix-1);i<=Math.min(N-1,ix+1);i++)for(const [a,b,c] of buckets[j*N+i]){
   const den=cross(a.p,b.p,c.p),u=cross(b.p,c.p,p)/den,v=cross(c.p,a.p,p)/den,w=1-u-v;
   if(Math.min(u,v,w)>=-1e-6)return [x+gain*(u*a.delta[0]+v*b.delta[0]+w*c.delta[0]),z+gain*(u*a.delta[1]+v*b.delta[1]+w*c.delta[1])];
  }
  throw Error('C2 source vertex outside its terrain grid');
 };
 return {map,maxDisplacement:maxDisplacement*gain,minAreaRatio,gain};
}
