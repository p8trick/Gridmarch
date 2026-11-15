import * as THREE from 'three';

// 战术相机（正交）。规则沿用测试页：
//  · 视距三档 5 / 7 / 9 格 = 屏幕【短边】方向（横屏时的上下）能看到的地面格数。俯角 55° 下地面在纵向被压缩，所以
//    屏幕宽度（世界单位）= 格数 × 2 × 宽高比 × sin(俯角)；按格数记录视距，换设备 / 宽高比不同时"几格"不变。
//    双指 / 滚轮可在 CELLS 范围内自由缩放，松手后吸附到最近的一档
//  · 固定俯角 55°，90° 旋转（带过渡动画）
//  · 旋转中心 = 屏幕正中心对应的地面点（target）：转的时候你正在看的东西留在原地，只有周围绕着它转。
//    这是最不会"丢位置"的方式；以后若要"绕选中单位转"，只需要在旋转前先把 target 平移到那个单位上。
export const CAMERA = {
  ZOOMS: [5, 7, 9],            // 视距三档（短边格数）
  CELLS: [3.5, 11],            // 自由缩放范围
  PITCH: 55,
  YAW_BIAS: 0.08 * Math.PI,    // 测试页的既定细节：相机相对格子轴向有一点点偏角（不是正对正北）
  ROT_SEC: 0.4,                // 90° 旋转用时
  DIST: 30,
};
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // easeInOutCubic
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TacticalCamera {
  // bounds：棋盘的世界坐标范围 {x0,x1,z0,z1}，平移时把 target 限制在里面
  constructor({bounds, target = [0, 0], cells = 7} = {}) {
    this.cam = new THREE.OrthographicCamera();
    this.bounds = bounds;
    this.target = new THREE.Vector3(target[0], 0, target[1]);
    this.yaw = 0; this.cells = cells; this.cellsGoal = null; this.rot = null; this.aspect = 16 / 9;
    this.pitch = CAMERA.PITCH;
    this.clampTarget();
  }
  get camA() { return this.yaw + CAMERA.YAW_BIAS; }
  // 当前视角所属的 90° 象限（0..3）：建筑朝向 / 附楼布局按它切换
  get quarter() { return ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4; }
  // 屏幕横向可视宽度（世界单位）：由短边格数换算，平移速度也用它
  get span() { return this.cells * 2 * this.aspect * Math.sin(this.pitch * Math.PI / 180); }

  resize(w, h) { this.aspect = w / h; this.applyFrustum(); }
  applyFrustum() {
    const c = this.cam, s = this.span, a = this.aspect;
    c.left = -s / 2; c.right = s / 2; c.top = s / (2 * a); c.bottom = -s / (2 * a); c.near = .1; c.far = 150; c.updateProjectionMatrix();
  }
  place() {
    const a = this.camA, e = this.pitch * Math.PI / 180, d = CAMERA.DIST, c = this.cam;
    c.position.set(this.target.x + Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, this.target.z + Math.cos(a) * Math.cos(e) * d);
    c.lookAt(this.target);
  }
  clampTarget() { const b = this.bounds; if (!b) return; this.target.x = clamp(this.target.x, b.x0, b.x1); this.target.z = clamp(this.target.z, b.z0, b.z1); }

  // 单指拖动：屏幕位移（像素）→ 地面平移。viewW 为屏幕宽度（像素）
  pan(dxPx, dyPx, viewW) {
    const dx = dxPx * this.span / viewW, dz = dyPx * this.span / viewW / Math.sin(this.pitch * Math.PI / 180), a = this.camA;
    this.target.x -= dx * Math.cos(a) + dz * Math.sin(a);
    this.target.z += dx * Math.sin(a) - dz * Math.cos(a);
    this.clampTarget();
  }
  // 双指 / 滚轮：ratio = 上一次手指间距 / 现在的间距（>1 拉近视野变小）
  zoomBy(ratio) { this.cellsGoal = null; this.cells = clamp(this.cells * ratio, CAMERA.CELLS[0], CAMERA.CELLS[1]); this.applyFrustum(); }
  snap() { let b = CAMERA.ZOOMS[0]; for (const z of CAMERA.ZOOMS) if (Math.abs(z - this.cells) < Math.abs(b - this.cells)) b = z; this.cellsGoal = b; }
  cycleZoom() {   // 按钮：5 → 7 → 9 → 5 格
    const Z = CAMERA.ZOOMS; let i = 0; for (let k = 1; k < Z.length; k++) if (Math.abs(Z[k] - this.cells) < Math.abs(Z[i] - this.cells)) i = k;
    this.cellsGoal = Z[(i + 1) % Z.length];
  }
  // 旋转 90°：dir = +1 / -1。旋转途中再点会接着往下转（目标累加），不会被打断
  rotate(dir) {
    const base = this.rot ? this.rot.to : this.yaw;
    this.rot = {from: this.yaw, to: base + dir * Math.PI / 2, t: 0};
  }
  get busy() { return !!this.rot || this.cellsGoal !== null; }
  // 每帧推进动画；返回 true 表示相机变了，需要重绘
  update(dt) {
    let changed = false;
    if (this.rot) {
      const r = this.rot; r.t += dt / CAMERA.ROT_SEC;
      if (r.t >= 1) { this.yaw = r.to % (Math.PI * 2); this.rot = null; } else this.yaw = r.from + (r.to - r.from) * ease(r.t);
      changed = true;
    }
    if (this.cellsGoal !== null) {
      this.cells += (this.cellsGoal - this.cells) * Math.min(1, dt * 14);
      if (Math.abs(this.cells - this.cellsGoal) < .01) { this.cells = this.cellsGoal; this.cellsGoal = null; }
      this.applyFrustum(); changed = true;
    }
    return changed;
  }
}
