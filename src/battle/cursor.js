// 战场格子光圈（选择框）。风格对齐模型：亮色、厚实、带深色描边的"玩具贴纸"感，在亮草地 / 沙滩 / 水面上都看得清。
// 组成：四个转角厚护角（浅金色 + 深蓝描边底）+ 一层柔和的底色 + 轻微的呼吸 / 落下弹一下的动画。
// 点到建筑时（kind = 'building'）：护角更粗、底色更亮，并在建筑上方多一颗缓缓自转、上下浮动的菱形标记（水晶），远看也知道点中的是建筑。
// 以后单位选中、可移动范围等光圈沿用这套颜色（COLORS），界面和战场保持一个风格。
export const COLORS = {light: 0xfff0b0, dark: 0x22304a, fill: 0xfff0b0, building: 0xffd45e};
export const SIZE = {arm: .42, thick: .13, edge: .075};   // 护角臂长 / 臂宽 / 描边宽：觉得粗了细了改这里
const GHOST = .55;                                        // 被挡住部分的不透明度

export function createCursor(THREE) {
  const group = new THREE.Group(); group.visible = false; group.renderOrder = 30;
  // 光圈贴在格子的真实地面上：没被挡住的部分实心显示；被建筑 / 山体挡住的部分用半透明显示（GreaterDepth = 只画被挡住的地方），既有"站在地上"的立体感又不会看丢
  const solid = c => new THREE.MeshBasicMaterial({color: c, depthWrite: false});
  const ghost = c => new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: GHOST, depthWrite: false, depthFunc: THREE.GreaterDepth});
  const mat = (c, o = 1, side) => new THREE.MeshBasicMaterial({color: c, transparent: o < 1, opacity: o, depthTest: false, depthWrite: false, side});
  const H = .93, A = SIZE.arm, T = SIZE.thick, O = SIZE.edge, EXT = .05;     // 护角离中心 / 臂长 / 臂宽 / 描边宽 / 厚度
  const ex = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
    return new THREE.ExtrudeGeometry(s, {depth: EXT, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2}).rotateX(-Math.PI / 2); };
  const L = (a, t, o) => ex([[-o, -o], [a + o, -o], [a + o, t + o], [t + o, t + o], [t + o, a + o], [-o, a + o]]);
  const geoTop = L(A, T, 0), geoDark = L(A, T, O);
  const matTop = solid(COLORS.light), matDark = solid(COLORS.dark), gTop = ghost(COLORS.light), gDark = ghost(COLORS.dark);
  const corners = [];
  [[-1, 1, 0], [1, 1, Math.PI / 2], [1, -1, Math.PI], [-1, -1, Math.PI * 1.5]].forEach(([sx, sz, rot]) => {
    const g = new THREE.Group(); g.rotation.y = rot; g.userData.dir = [sx, sz];
    const parts = [[geoDark, gDark, 28, 0], [geoTop, gTop, 29, .02], [geoDark, matDark, 30, 0], [geoTop, matTop, 31, .02]];   // 先画被挡住的半透明层，再画实心层
    for (const [geo, m, ro, y] of parts) { const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = ro; mesh.position.y = y; g.add(mesh); }
    group.add(g); corners.push(g);
  });
  const fillMat = new THREE.MeshBasicMaterial({color: COLORS.fill, transparent: true, opacity: .2, depthWrite: false}), fill = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 1.84).rotateX(-Math.PI / 2), fillMat);
  fill.renderOrder = 27; fill.position.y = -.02; group.add(fill);
  // 建筑标记：菱形水晶 + 深色描边壳
  const gem = new THREE.Group(), gemGeo = new THREE.OctahedronGeometry(.3);
  const gemTop = new THREE.Mesh(gemGeo, mat(COLORS.building)), gemOut = new THREE.Mesh(gemGeo, mat(COLORS.dark, 1, THREE.BackSide));
  gemOut.scale.setScalar(1.28); gemTop.renderOrder = 33; gemOut.renderOrder = 32; gem.add(gemOut, gemTop); gem.scale.y = 1.7; gem.visible = false; group.add(gem);
  const st = {kind: 'cell', t0: 0, base: 0, now: 0};
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  function show(x, y, z, kind = 'cell', now = performance.now() / 1000) {   // y = 格子地面高度（world.baseY）
    st.kind = kind; st.t0 = now; st.base = y; group.position.set(x, y + .08, z); group.visible = true;
    const b = kind === 'building'; gem.visible = b; fillMat.color.setHex(b ? COLORS.building : COLORS.fill); fillMat.opacity = b ? .28 : .2;
  }
  function hide() { group.visible = false; }
  // 返回 true = 光圈在动，调用方应继续渲染
  function update(now) {
    if (!group.visible) return false;
    const k = now - st.t0, pop = 1 + .38 * (1 - ease(k / .22)), breathe = Math.sin(now * 5) * .045, b = st.kind === 'building';
    const h = (H + breathe) * pop, th = b ? 1.25 : 1;
    corners.forEach(c => { const [sx, sz] = c.userData.dir; c.position.set(sx * h, 0, sz * h); c.scale.set(1, th, 1); });
    fill.scale.setScalar(pop); fillMat.opacity = (b ? .28 : .2) + Math.sin(now * 5) * .05;
    if (b) { gem.rotation.y = now * 1.6; gem.position.y = 2.5 + Math.sin(now * 3) * .16 + (1 - ease(k / .3)) * .9; }
    return true;
  }
  return {group, show, hide, update};
}
