// 0.78 「已行动 = 变灰」（高战式）：给材质注入一小段着色器，按「灰度系数」把颜色去饱和 + 压暗。
// 两条通路：① 非实例化网格（坦克 / 火炮，材质是每个单位自己的）→ uniform uGray，world 每帧改 userData.grayShader；
//          ② 实例化批量绘制（步兵 / 反坦克兵，材质全队共享）→ 每个实例自己的 instanceColor.r = 1 − 0.2·灰度，顶点着色器读出来传给片元，
//             instanceColor 自带的乘法顺带把整体压暗 20%（anti-tank-batch.js 的 sync 里写）。
import * as THREE from 'three';
const GLSL_FRAG = `{ float gk = max(uGray, vGrayI);
  float gl = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(gl) * 0.9, gk * 0.88); }`;
export function patchGray(mat) {
  if (!mat || !mat.isMaterial || mat.userData.grayPatched || mat.isShaderMaterial || mat.isMeshBasicMaterial) return mat;
  mat.userData.grayPatched = true; mat.userData.gray = 0;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    shader.uniforms.uGray = {value: this.userData.gray || 0}; this.userData.grayShader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGrayI;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vGrayI = clamp((1.0 - instanceColor.r) / 0.2, 0.0, 1.0);\n#else\n vGrayI = 0.0;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGray;\nvarying float vGrayI;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + GLSL_FRAG);
  };
  mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|gray1'; };
  mat.needsUpdate = true; return mat;
}
export function setMatGray(mat, k) { mat.userData.gray = k; const s = mat.userData.grayShader; if (s) s.uniforms.uGray.value = k; }
export function patchGrayTree(root) { const mats = new Set(); root.traverse(o => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) mats.add(m); }); for (const m of mats) patchGray(m); return [...mats].filter(m => m.userData.grayPatched); }
