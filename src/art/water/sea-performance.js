import * as T from 'three';
// Unindexed reference: retain every original vertex and per-face normal.
export function describeRawSeaMesh(mesh){const g=mesh.geometry,bytes=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(g.index?.array.byteLength||0);mesh.userData={...mesh.userData,tris:(g.index?.count||g.attributes.position.count)/3,beforeMeshes:1,afterMeshes:1,beforeBytes:bytes,afterBytes:bytes,vertices:g.attributes.position.count,indexBits:0};return mesh;}
// Exact position+colour sharing. Flat shading derives each face normal from
// its unchanged positions in the shipped Three.js shader; never smooth-shade this mesh.
export function compactSeaMeshes(meshes){
 if(!meshes.length)throw Error('at least one mesh required');const material=meshes[0].material;
 if(!material.flatShading||!material.vertexColors)throw Error('requires flatShading vertex-colour material');
 const positions=[],colors=[],normals=[],indices=[],lookup=new Map();let beforeBytes=0,triangles=0;
 for(const m of meshes){if(m.material!==material||m.position.lengthSq()||m.rotation.x||m.rotation.y||m.rotation.z||m.scale.x!==1||m.scale.y!==1||m.scale.z!==1)throw Error('shared material and identity transform required');
 const g=m.geometry,p=g.attributes.position,c=g.attributes.color,n=g.attributes.normal,index=g.index;beforeBytes+=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(index?.array.byteLength||0);const count=index?index.count:p.count;triangles+=count/3;
 for(let i=0;i<count;i++){const j=index?index.getX(i):i,row=[p.getX(j),p.getY(j),p.getZ(j),c.getX(j),c.getY(j),c.getZ(j)],key=row.join(',');let id=lookup.get(key);if(id===undefined){id=positions.length/3;lookup.set(key,id);positions.push(...row.slice(0,3));colors.push(...row.slice(3));normals.push(n.getX(j),n.getY(j),n.getZ(j));}indices.push(id);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 const afterBytes=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength;const mesh=new T.Mesh(g,material);mesh.name='sea07_performance';mesh.userData={tris:triangles,beforeMeshes:meshes.length,afterMeshes:1,beforeBytes,afterBytes,vertices:positions.length/3,indexBits:g.index.array.BYTES_PER_ELEMENT*8,flatShadingRequired:true};return mesh;
}
