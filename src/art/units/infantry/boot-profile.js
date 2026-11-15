import * as T from 'three';

/** B1: reshape only the two named boots, before rigid merging / foot-contact
 * baking. Same octagonal topology, materials, sole thickness and ankle rings.
 * No runtime vertex deformation, added meshes or added triangles. */
export function applyBootProfileToSource(source){
 if(source.userData.bootProfile?.id==='B1')return source;
 const required=['right_boot','left_boot'].map(name=>source.getObjectByName(name));
 if(required.some(boot=>!boot?.getObjectByName('boot_upper')||!boot.getObjectByName('boot_sole')))throw Error('B1 requires the named source boot parts');
 for(const boot of required){
  for(const name of['boot_upper','boot_sole']){
   const mesh=boot.getObjectByName(name),geometry=mesh.geometry.clone(),p=geometry.attributes.position;
   // Source lofts have eight vertices per horizontal ring. Leave the upper
   // two cuff/ankle rings exactly in place; trim only the forefoot and heel.
   const rings=p.count/8;
   for(let ring=0;ring<rings;ring++){
    if(name==='boot_upper'&&ring>=3)continue;
    const points=Array.from({length:8},(_,i)=>new T.Vector3().fromBufferAttribute(p,ring*8+i));
    const half=Math.max(...points.map(v=>Math.abs(v.x))),front=Math.max(...points.map(v=>v.z)),back=Math.min(...points.map(v=>v.z)),length=front-back;
    const toe=half*.42,forefoot=half*.97,heel=half*.90,heelFlat=half*.70;
    const outline=[[-toe,front],[toe,front],[forefoot,front-length*.17],[heel,back+length*.075],[heelFlat,back],[-heelFlat,back],[-heel,back+length*.075],[-forefoot,front-length*.17]];
    for(let i=0;i<8;i++){
     let y=points[i].y;
     if(name==='boot_upper'&&ring===2)y-=[0,1].includes(i)?.055:[2,7].includes(i)?.022:0;
     p.setXYZ(ring*8+i,outline[i][0],y,outline[i][1]);
    }
   }
   p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
  }
 }
 source.userData.bootProfile={id:'B1',sameTopology:true,extraMeshes:0,extraTriangles:0};
 return source;
}
