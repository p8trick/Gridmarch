import * as T from 'three';
import {
 createMountain as createOriginalMountain,
 setMountainQuarter as originalQuarter,
 setMountainHeight as originalHeight,
 getMountainStandPoint as originalStandPoint
} from './terrain-mountain-a2.js';
export {MOUNTAIN_A2_SPEC,MOUNTAIN_B_SPEC,MOUNTAIN_A_HEIGHT,MOUNTAIN_A_GARRISON,MOUNTAIN_B_GARRISON,mountainSummitGrassColor} from './terrain-mountain-a2.js';

// P1 keeps every original triangle, normal and Float32 colour. The two states
// share one indexed vertex bank, so merging the meshes does not duplicate the
// fixed mountain body in GPU vertex buffers.
const banks=new Map(),attributes=['position','normal','color'];
function bytes(geometries){const arrays=new Set();for(const g of geometries){for(const a of Object.values(g.attributes))arrays.add(a.array);if(g.index)arrays.add(g.index.array);}return [...arrays].reduce((sum,a)=>sum+a.byteLength,0);}
function prepare(type){
 if(banks.has(type))return banks.get(type);
 const natural=createOriginalMountain(type),occupied=createOriginalMountain(type,0,{occupied:true}),parts=[natural.children[0],natural.children[1],occupied.children[1]];
 if(parts.some(m=>m.material!==parts[0].material))throw Error('Mountain performance merge requires one shared material');
 const values=Object.fromEntries(attributes.map(name=>[name,[]])),unique=new Map(),indices=[];
 for(const mesh of parts){
  const geometry=mesh.geometry,p=geometry.attributes.position,source=Object.fromEntries(attributes.map(name=>[name,geometry.attributes[name]])),bits=Object.fromEntries(attributes.map(name=>[name,new Uint32Array(source[name].array.buffer,source[name].array.byteOffset,source[name].array.length)])),list=[];
  const count=geometry.index?.count??p.count;
  for(let n=0;n<count;n++){
   const i=geometry.index?geometry.index.getX(n):n,key=attributes.flatMap(name=>[0,1,2].map(k=>bits[name][i*3+k])).join(',');let id=unique.get(key);
   if(id===undefined){id=unique.size;unique.set(key,id);for(const name of attributes)values[name].push(source[name].getX(i),source[name].getY(i),source[name].getZ(i));}
   list.push(id);
  }
  indices.push(list);
 }
 const shared=Object.fromEntries(attributes.map(name=>[name,new T.Float32BufferAttribute(values[name],3)])),Index=unique.size<=65535?Uint16Array:Uint32Array;
 function stateGeometry(list,name){
  const geometry=new T.BufferGeometry();geometry.name=name;for(const attribute of attributes)geometry.setAttribute(attribute,shared[attribute]);geometry.setIndex(new T.BufferAttribute(new Index(list),1));
  // Bounds must use the active index list, because the vertex bank also holds
  // the other state's summit. Keep occupied bounds at the actual flat top.
  const box=new T.Box3(),point=new T.Vector3();for(const i of list)box.expandByPoint(point.fromBufferAttribute(shared.position,i));geometry.boundingBox=box;
  const center=box.getCenter(new T.Vector3());let radiusSq=0;for(const i of list)radiusSq=Math.max(radiusSq,point.fromBufferAttribute(shared.position,i).distanceToSquared(center));geometry.boundingSphere=new T.Sphere(center,Math.sqrt(radiusSq));return geometry;
 }
 const geometry={natural:stateGeometry(indices[0].concat(indices[1]),'mountain_'+type+'_natural_P1'),garrison:stateGeometry(indices[0].concat(indices[2]),'mountain_'+type+'_garrison_P1')};
 const originalBytes=bytes(parts.map(m=>m.geometry)),performanceBytes=bytes(Object.values(geometry));
 const bank={geometry,material:parts[0].material,metadata:{natural:natural.userData,garrison:occupied.userData},capMetadata:{natural:natural.children[1].userData,garrison:occupied.children[1].userData},stats:{type,sourceVersion:natural.userData.version,performanceVersion:'P1',originalMeshesPerMountain:2,performanceMeshesPerMountain:1,naturalTriangles:indices[0].concat(indices[1]).length/3,garrisonTriangles:indices[0].concat(indices[2]).length/3,sharedVertexCount:unique.size,originalVertexCount:parts.reduce((n,m)=>n+m.geometry.attributes.position.count,0),originalGeometryBytes:originalBytes,performanceGeometryBytes:performanceBytes,geometryByteReduction:1-performanceBytes/originalBytes,indexBits:Index===Uint16Array?16:32}};
 banks.set(type,bank);return bank;
}
export function getMountainPerformanceStats(type='A'){return {...prepare(type).stats};}
export function setMountainOccupied(root,occupied=false){
 if(root.userData.renderVariant!=='performance')throw new TypeError('Use the performance API with a performance mountain');if(typeof occupied!=='boolean')throw new TypeError('Mountain occupied must be a boolean');
 const bank=prepare(root.userData.type),state=occupied?'garrison':'natural',mesh=root.children[0];mesh.geometry=bank.geometry[state];mesh.userData={...bank.capMetadata[state],merged:true};
 Object.assign(root.userData,{state,occupied,triangles:bank.metadata[state].triangles,bodyTriangles:bank.metadata[state].bodyTriangles,summitTriangles:bank.metadata[state].summitTriangles});originalHeight(root,root.userData.heightScale??1);return root;
}
export function createMountain(type='A',quarter=0,{occupied=false,heightScale=1}={}){
 const bank=prepare(type),root=new T.Group(),mesh=new T.Mesh(bank.geometry.natural,bank.material);root.name='mountain_'+type;mesh.name='mountain_body_and_summit';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 root.userData={...JSON.parse(JSON.stringify(bank.metadata.natural)),renderVariant:'performance',performanceVersion:'P1',geometryBytes:bank.stats.performanceGeometryBytes};
 originalQuarter(root,quarter);setMountainOccupied(root,occupied);originalHeight(root,heightScale);return root;
}
export function createMountainA(quarter=0,options={}){return createMountain('A',quarter,options);}
export function createMountainB(quarter=0,options={}){return createMountain('B',quarter,options);}
export {originalQuarter as setMountainQuarter,originalQuarter as setMountainAQuarter,originalQuarter as setMountainBQuarter,originalHeight as setMountainHeight,originalHeight as setMountainAHeight,originalHeight as setMountainBHeight,originalStandPoint as getMountainStandPoint,originalStandPoint as getMountainAStandPoint,originalStandPoint as getMountainBStandPoint};
export {setMountainOccupied as setMountainAOccupied,setMountainOccupied as setMountainBOccupied};
