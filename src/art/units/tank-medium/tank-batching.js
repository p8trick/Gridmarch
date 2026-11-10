import * as THREE from 'three';

// Only material colour is baked. All lighting parameters stay in the grouping key.
// No material arrays/groups: each resulting mesh submits one opaque colour pass.
export function createColourBatcher() {
  const paints=[];
  function key(mat){const j=mat.toJSON();for(const k of ['metadata','uuid','name','color','vertexColors'])delete j[k];return JSON.stringify(j);}
  function merge(parent,sources,name='batch') {
    parent.updateWorldMatrix(true,true);
    const inverse=parent.matrixWorld.clone().invert(),buckets=new Map(),output=[];
    for(const source of sources){
      const material=source.material;
      if(!material.isMeshStandardMaterial||material.transparent||material.map)throw new Error('Unsupported colour batching material');
      const signature=key(material);let bucket=buckets.get(signature);
      if(!bucket){bucket={material,positions:[],normals:[],colours:[],ranges:[]};buckets.set(signature,bucket);}
      const g=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld));
      const p=g.attributes.position,n=g.attributes.normal,c=material.vertexColors?g.attributes.color:null;
      const start=bucket.colours.length/3,base=new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++){
        bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));
        base.set(c?[c.getX(i),c.getY(i),c.getZ(i)]:[1,1,1],i*3);
        bucket.colours.push(base[i*3]*material.color.r,base[i*3+1]*material.color.g,base[i*3+2]*material.color.b);
      }
      bucket.ranges.push({start,base,material});g.dispose();
    }
    for(const b of buckets.values()){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(b.colours,3));
      const material=b.material.clone();material.color.setRGB(1,1,1);material.vertexColors=true;
      const mesh=new THREE.Mesh(geometry,material);mesh.name=name+'_'+output.length;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);output.push(mesh);
      const paint={geometry,ranges:b.ranges,active:true};paints.push(paint);geometry.addEventListener('dispose',()=>paint.active=false);
    }
    for(const source of sources){source.removeFromParent();source.geometry.dispose();}
    return output;
  }
  function refresh(){for(const paint of paints){if(!paint.active)continue;const attr=paint.geometry.attributes.color;for(const {start,base,material} of paint.ranges)for(let i=0;i<base.length;i+=3)attr.setXYZ(start+i/3,base[i]*material.color.r,base[i+1]*material.color.g,base[i+2]*material.color.b);attr.needsUpdate=true;}}
  return {merge,refresh};
}
