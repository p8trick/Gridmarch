import * as THREE from 'three';
export const PALETTE={grass:0x8cc63f,grassAlt:0x7db836,trunk:0x6b4a2b,pine:0x3e8e3a,rock:0x8a8494,road:0x7a7a80,curb:0xd8c9a0,mark:0xf2f2f2};
export const MAT_TERRAIN=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,metalness:0});
export const MAT_WATER=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,metalness:0});

export const MAT_ACCENT=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85,metalness:0});
