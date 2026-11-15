// Centre cell is land. Cardinal bits first; a diagonal is relevant only when
// both adjacent cardinal cells are land. Raw 256 masks normalize to 47 cases.
export const COAST_NEIGHBORS=Object.freeze([
 ['N',0,1,1],['E',1,0,2],['S',0,-1,4],['W',-1,0,8],
 ['NE',1,1,16],['SE',1,-1,32],['SW',-1,-1,64],['NW',-1,1,128]
].map(([name,x,z,bit])=>Object.freeze({name,x,z,bit})));
export function normalizeCoastMask(raw){
 if(!Number.isInteger(raw)||raw<0||raw>255)throw Error('coast mask must be an integer 0..255');
 let out=raw&15;
 for(const [diag,a,b] of [[16,1,2],[32,2,4],[64,4,8],[128,8,1]])if((raw&a)&&(raw&b)&&(raw&diag))out|=diag;
 return out;
}
export const COAST_MASKS_47=Object.freeze([...new Set(Array.from({length:256},(_,i)=>normalizeCoastMask(i)))].sort((a,b)=>a-b));
export function coastMaskFromLand(isLand,x,z){return normalizeCoastMask(COAST_NEIGHBORS.reduce((m,n)=>isLand(x+n.x,z+n.z)?m|n.bit:m,0));}
export function rotateCoastMask(mask,q=1){
 mask=normalizeCoastMask(mask);
 if(!Number.isInteger(q))throw Error('integer quarter turn required');q=((q%4)+4)%4;
 let out=0;for(const n of COAST_NEIGHBORS)if(mask&n.bit){let x=n.x,z=n.z;for(let i=0;i<q;i++)[x,z]=[-z,x];out|=COAST_NEIGHBORS.find(p=>p.x===x&&p.z===z).bit;}return normalizeCoastMask(out);
}
const count=n=>{let s=0;while(n){s+=n&1;n>>>=1;}return s;};
export function describeCoastMask(raw){
 const mask=normalizeCoastMask(raw),degree=count(mask&15),inners=[];
 for(const [q,a,b,d] of [[0,1,2,16],[1,1,8,128],[2,4,8,64],[3,4,2,32]])if((mask&a)&&(mask&b)&&!(mask&d))inners.push(q);
 let kind='compound',rotation=0,legacy=false;
 if(degree===0)kind='islet';
 else if(degree===1){kind='cap';rotation=[1,8,4,2].findIndex(b=>mask&b);}
 else if(degree===2&&((mask&15)===5||(mask&15)===10)){kind='isthmus';rotation=mask&1?0:1;}
 else if(degree===4&&!inners.length){kind='land';legacy=true;}
 else if(degree===4&&inners.length===1){kind='inner';rotation=inners[0];legacy=true;}
 else if(degree===3&&!inners.length){kind='straight';rotation=[1,8,4,2].findIndex(b=>!(mask&b));legacy=true;}
 else if(degree===2&&!inners.length){kind='outer';rotation=[[1,2],[1,8],[4,8],[4,2]].findIndex(([a,b])=>!(mask&a)&&!(mask&b));legacy=true;}
 const names={islet:'单格岛屿',cap:'半岛尖端',isthmus:'双侧海岸陆条',land:'完整陆地',inner:'单内角',outer:'单外角',straight:'直线海岸'};
 const label=names[kind]||(degree===2?'细弯陆条':degree===3?`直岸＋${inners.length}内角`:`${inners.length}个内角`);
 return Object.freeze({mask,index:COAST_MASKS_47.indexOf(mask),degree,innerCorners:Object.freeze(inners),kind,rotation,legacy,label,narrow:!legacy});
}
export function landCellsForCoastMask(raw,origin=[0,0]){if(!Array.isArray(origin)||origin.length!==2||!origin.every(Number.isSafeInteger))throw Error('integer [x,z] origin required');const mask=normalizeCoastMask(raw);return [[...origin],...COAST_NEIGHBORS.filter(n=>mask&n.bit).map(n=>[origin[0]+n.x,origin[1]+n.z])];}
