import * as THREE from 'three';
import {createTank as createOriginal} from './tank.js';
import {createTrackPath} from './track-path.js';
import {attachHeavyTankAnimations} from './heavy-tank-animation.js';

// V1.2 performance variant: standard materials only, no texture atlas or shader
// overrides. Identical opaque material properties share a vertex-colour batch.
export function createTank(options={}){
  const root=createOriginal({...options,batch:true});
  const originalStats={...root.userData};
  root.disposeAnimation();
  const originalSetFaction=root.setFaction;
  const materials=new Map(),tints=[],replacedGeometries=new Set();
  function keyOf(m){
    return JSON.stringify([m.type,m.roughness,m.metalness,m.emissive?.getHex(),m.emissiveIntensity,m.flatShading,m.side,m.transparent,m.opacity,m.depthTest,m.depthWrite,m.alphaTest,m.blending,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.toneMapped]);
  }
  function sharedMaterial(source){
    const key=keyOf(source);if(!materials.has(key)){
      const material=source.clone();material.color.set(0xffffff);material.vertexColors=true;material.name='heavy_packed_'+materials.size;materials.set(key,material);
    }return materials.get(key);
  }
  // Deduplicate exact attribute tuples; palette identity is included so vertices
  // which happen to share a sand colour never lose independent faction tinting.
  function packedGeometry(records){
    const positions=[],normals=[],colours=[],baseColours=[],indices=[],lookup=new Map(),runs=new Map();
    const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
    for(const {mesh,transform}of records){
      const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,c=mesh.material.vertexColors?g.attributes.color:null;
      normalMatrix.getNormalMatrix(transform);
      for(let j=0;j<(g.index?.count??p.count);j++){
        const i=g.index?g.index.getX(j):j;
        point.fromBufferAttribute(p,i).applyMatrix4(transform);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
        const values=[point.x,point.y,point.z,normal.x,normal.y,normal.z,c?c.getX(i):1,c?c.getY(i):1,c?c.getZ(i):1];
        const key=mesh.material.uuid+','+values.join(',');let index=lookup.get(key);
        if(index===undefined){
          index=positions.length/3;lookup.set(key,index);positions.push(...values.slice(0,3));normals.push(...values.slice(3,6));baseColours.push(...values.slice(6));
          colours.push(values[6]*mesh.material.color.r,values[7]*mesh.material.color.g,values[8]*mesh.material.color.b);
          if(!runs.has(mesh.material))runs.set(mesh.material,[]);runs.get(mesh.material).push(index);
        }indices.push(index);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);
    tints.push({geometry,base:new Float32Array(baseColours),runs});return geometry;
  }
  function replaceRigid(parent,skip=new Set()){
    parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),groups=new Map(),old=[];
    function collect(o){if(skip.has(o))return;if(o.isMesh){
      if(o.isInstancedMesh)throw new Error('Moving batch crossed a rigid merge boundary');
      const material=sharedMaterial(o.material);if(!groups.has(material))groups.set(material,[]);
      groups.get(material).push({mesh:o,transform:new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)});old.push(o);
    }o.children.forEach(collect);}
    parent.children.forEach(collect);
    for(const [material,records]of groups){const mesh=new THREE.Mesh(packedGeometry(records),material);mesh.name=parent.name+'_'+material.name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);}
    for(const mesh of old){mesh.removeFromParent();replacedGeometries.add(mesh.geometry);}
  }
  const hull=root.getObjectByName('hull'),turret=root.getObjectByName('turret'),gun=root.getObjectByName('gun'),recoil=root.getObjectByName('barrel_recoil'),muzzle=root.getObjectByName('muzzle_point');
  const sides={};
  for(const side of [1,-1]){
    const label=side===1?'left':'right',track=root.getObjectByName(label+'_track');
    const path=createTrackPath({roadZ:1.55,roadY:.49,roadRadius:.326*.94,endZ:2.02,endY:.76,endRadius:.31*.96});
    const bindings={track,path,belts:[],wheels:[]};sides[label]=bindings;
    // Keep the two metallic pad/link materials separate; their reflectance differs.
    for(const [part,normalOffset]of [['pads',.058],['links',0]])bindings.belts.push({object:root.getObjectByName(label+'_track_'+part),normalOffset});
    for(const [kind,count,radius,y]of [['road',6,.326*.94,.49],['end',2,.31*.96,.76]]){
      const old=['Tires','Dishes','Hubs'].map(suffix=>root.getObjectByName(label+'_track_'+kind+suffix));
      if(old.some(o=>!o?.isInstancedMesh||o.count!==count))throw new Error('Unexpected V1.2 wheel layout');
      // All three pieces rotate around the same physical axle. Bake their face
      // orientation and axial offsets into one wheel geometry, then instance it.
      const first=old[0],center=new THREE.Vector3(),m=new THREE.Matrix4();first.getMatrixAt(0,m);center.setFromMatrixPosition(m);
      const inverse=new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z);
      const records=old.map(mesh=>{mesh.getMatrixAt(0,m);return {mesh,transform:new THREE.Matrix4().multiplyMatrices(inverse,m)};});
      const material=sharedMaterial(first.material);
      if(old.some(o=>sharedMaterial(o.material)!==material))throw new Error('Wheel materials must have identical non-colour properties');
      const wheel=new THREE.InstancedMesh(packedGeometry(records),material,count);wheel.name=label+'_track_'+kind+'Wheels';wheel.castShadow=wheel.receiveShadow=true;
      for(let i=0;i<count;i++){first.getMatrixAt(i,m);center.setFromMatrixPosition(m);wheel.setMatrixAt(i,new THREE.Matrix4().makeTranslation(center.x,center.y,center.z));}
      track.add(wheel);bindings.wheels.push({object:wheel,radius});
      for(const mesh of old){mesh.removeFromParent();replacedGeometries.add(mesh.geometry);}
    }
  }
  const moving=new Set(Object.values(sides).flatMap(s=>[...s.belts,...s.wheels].map(b=>b.object)));
  replaceRigid(hull,moving);replaceRigid(turret,new Set([gun]));replaceRigid(gun,new Set([recoil]));replaceRigid(recoil);
  replacedGeometries.forEach(g=>g.dispose());
  root.setFaction=value=>{
    originalSetFaction(value);
    for(const {geometry,base,runs}of tints){
      const colour=geometry.attributes.color;
      for(const [material,vertices]of runs)for(const i of vertices)colour.setXYZ(i,base[i*3]*material.color.r,base[i*3+1]*material.color.g,base[i*3+2]*material.color.b);
      colour.needsUpdate=true;
    }
  };
  let triangles=0,meshes=0,vertexBytes=0;root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);vertexBytes+=Object.values(o.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(o.geometry.index?.array.byteLength??0);}});
  root.name='HeavyTank_V1_2_Performance';root.userData={...originalStats,variant:'performance',triangles,meshes,geometryBytes:vertexBytes,optimization:{originalMeshes:originalStats.meshes,originalTriangles:originalStats.triangles,sharedMaterials:materials.size,geometry:'all original triangles retained',method:'exact material grouping / packed wheel instances / indexed buffers'}};
  attachHeavyTankAnimations({root,left:sides.left,right:sides.right,recoil,muzzle});return root;
}
