# 选中 / 移动 / 待命冒烟测试（0.67；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 点蓝军没动过的单位 → 出蓝格（引擎算的范围）→ 点一个蓝格 → 走过去 → 单位旁出「待命」浮条（走完前不出）→ 浮条期间点战场不响应 → 拖镜头浮条跟着单位 → 点空白处撤销（退回原格、蓝格重现）→ 重新走 → 点待命 → 单位已行动（脚下灰环）→ 已行动的单位点了不再选中。
# 另：点自己脚下 = 原地待命；点空地 = 取消选中。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    # 把某个引擎格换算成屏幕坐标（旋转 / 竖屏时这个测试不适用：视口是横的，舞台没旋转）
    scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
        const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
    tap = lambda ex, ey: (lambda xy: (pg.mouse.click(xy[0], xy[1]), pg.wait_for_timeout(250)))(scr(ex, ey))
    st = lambda: pg.evaluate('()=>window.battle.state()')
    rng = lambda: pg.evaluate('()=>{const u=window.battle.world.units.find(o=>o.rangeCells);return u?u.rangeCells.length:0}')
    # 找一个蓝军步兵 + 它能走到的格子（用引擎）
    info = pg.evaluate('''()=>{const g=window.battle.game;const u=g.units.find(o=>o.owner===0&&o.type==="inf"&&!o.moved&&!o.acted);return {id:u.id,x:u.x,y:u.y}}''')
    tap(info['x'], info['y'])
    assert st()['sel'] == info['id'], ('点单位应选中', st())
    n = rng(); assert n >= 3, ('应出蓝格', n)
    ts = []   # 格子特效（0.71）：共享的时间 uniform 在走（呼吸 / 流光 / 涟漪都靠它）；默认样式「描边」有轮廓线
    for _ in range(8):
        ts.append(pg.evaluate("()=>{let t=null;window.battle.world.scene.traverse(m=>{if(m.name==='tileFill')t=m.material.uniforms.uTime.value});return t}")); pg.wait_for_timeout(170)
    assert all(t is not None for t in ts) and max(ts) - min(ts) > .3, ('格子特效的时间应该在走', ts)
    edges = lambda: pg.evaluate("()=>{let n=0,v=0;window.battle.world.scene.traverse(m=>{if(m.name==='tileEdge'){n++;if(m.visible)v++}});return [n,v]}")
    n, v = edges(); assert n > 0 and v == n, ('默认「描边」应画出范围轮廓', n, v)
    pg.evaluate("()=>window.battle.world.setTileStyle(0)"); n, v = edges(); assert n > 0 and v == 0, ('「呼吸」样式不画轮廓', n, v)
    for k in (2, 3): pg.evaluate("k=>window.battle.world.setTileStyle(k)", k); n, v = edges(); assert v == n > 0, ('流光 / 涟漪也有轮廓', k, n, v)
    pg.evaluate("()=>window.battle.world.setTileStyle(1)")
    # 目的地：从引擎范围里找一个离起点 2 格以上、屏幕上在画面内的格子
    dest = pg.evaluate('''([id])=>{const B=window.battle,g=B.game,u=g.units.find(o=>o.id===id);const w=B.world.unitById(id);
        const c=w.rangeCells.map(c=>B.toEngine(c)).filter(([x,y])=>Math.abs(x-u.x)+Math.abs(y-u.y)>=2);return c[0]}''', [info['id']])
    assert dest, '范围里应有 2 格以外的格子'
    tap(dest[0], dest[1])
    pg.wait_for_function('()=>window.battle.world.units.every(u=>!u.path)', timeout=60000)
    pg.wait_for_timeout(300)
    u = pg.evaluate('([id])=>{const u=window.battle.game.units.find(o=>o.id===id);return {x:u.x,y:u.y,moved:u.moved,acted:u.acted}}', [info['id']])
    assert (u['x'], u['y']) == tuple(dest) and u['moved'] and not u['acted'], ('引擎里单位应已到达', u, dest)
    assert pg.is_visible('#abar') and st()['acting'] == info['id'], '走完应出浮条'
    assert rng() == 0, '走完蓝格应消失'
    pg.screenshot(path='/tmp/move_bar.png')
    # 拖镜头：浮条要跟着单位走（0.68 修的 bug：以前只在镜头动画时重新定位，直接拖动时浮条留在原地）
    def gap():
        r = pg.evaluate('()=>{const b=document.querySelector("#abar").getBoundingClientRect();return [b.left,b.right,(b.top+b.bottom)/2]}')
        sx, sy = scr(dest[0], dest[1]); return r, sx, sy
    T = lambda: pg.evaluate('()=>{const t=window.battle.cam.target;return [+t.x.toFixed(2),+t.z.toFixed(2)]}')
    t0 = T(); r0, sx0, sy0 = gap(); assert min(abs(r0[0] - sx0), abs(r0[1] - sx0)) < 60, ('浮条应贴着单位', r0, sx0)
    pg.wait_for_timeout(300)
    # 在页面里一次性派发「按下 → 12 次移动 → 抬起」：软件渲染（无头浏览器）每帧很慢，Playwright 一步步拖会超过 0.45 秒变成长按
    pg.evaluate("""([dx,dy])=>{const cv=document.querySelector('#battle canvas');cv.setPointerCapture=()=>{};const mk=(t,x,y)=>new PointerEvent(t,{pointerId:7,pointerType:'touch',clientX:x,clientY:y,bubbles:true});
        cv.dispatchEvent(mk('pointerdown',300,220));for(let i=1;i<=12;i++)cv.dispatchEvent(mk('pointermove',300+dx*i/12,220+dy*i/12));cv.dispatchEvent(mk('pointerup',300+dx,220+dy))}""", [60, -60])
    pg.wait_for_timeout(1500)
    r1, sx1, sy1 = gap()
    assert abs(sx1 - sx0) > 15 or abs(sy1 - sy0) > 15, ('镜头应该动了', sx0, sx1, sy0, sy1)
    assert min(abs(r1[0] - sx1), abs(r1[1] - sx1)) < 60 and abs(r1[2] - max(30, min(372, sy1))) < 30, ('拖镜头后浮条应跟着单位', r1, sx1, sy1)
    # 撤销：点浮条以外的空白处 → 单位退回原格、回到选中（蓝格重新出现）；然后重新走一次
    assert pg.is_visible('#abar'); tap(info['x'] + 3, info['y'] + 3) if False else pg.mouse.click(120, 330); pg.wait_for_timeout(300)
    u = pg.evaluate('([id])=>{const u=window.battle.game.units.find(o=>o.id===id);return {x:u.x,y:u.y,moved:u.moved}}', [info['id']])
    assert (u['x'], u['y'], u['moved']) == (info['x'], info['y'], False), ('撤销后应回到原格', u)
    assert not pg.is_visible('#abar') and st()['acting'] is None and st()['sel'] == info['id'] and rng() >= 3, ('撤销后应回到选中状态', st(), rng())
    wc = pg.evaluate('([id])=>window.battle.world.unitById(id).cell', [info['id']]); ec = pg.evaluate('([c])=>window.battle.toEngine(c)', [wc])
    assert tuple(ec) == (info['x'], info['y']), ('世界里的单位也应回到原格', ec)
    tap(dest[0], dest[1])
    pg.wait_for_function('()=>window.battle.world.units.every(u=>!u.path)', timeout=60000); pg.wait_for_timeout(300)
    assert pg.is_visible('#abar') and st()['acting'] == info['id'], ('撤销后重新走应再出浮条', st(), dest, scr(dest[0], dest[1]), rng())
    pg.click('#abar [data-act=wait]'); pg.wait_for_timeout(300)
    assert not pg.is_visible('#abar') and st()['acting'] is None
    assert pg.evaluate('([id])=>window.battle.game.units.find(o=>o.id===id).acted', [info['id']]) is True
    assert pg.evaluate('()=>window.battle.world.units.filter(u=>u.acted&&u.amark&&u.amark.visible).length') == 1, '待命后脚下应有灰环'
    # 已行动的单位点了不再选中
    tap(dest[0], dest[1]); assert st()['sel'] is None, '已行动的单位不该再选中'
    # 另一个单位：点自己脚下 = 原地待命；再点空地取消选中
    other = pg.evaluate('''()=>{const g=window.battle.game;const u=g.units.find(o=>o.owner===0&&!o.moved&&!o.acted&&o.type==="inf");return u?{id:u.id,x:u.x,y:u.y}:null}''')
    if other:
        tap(other['x'], other['y']); assert st()['sel'] == other['id']
        tap(other['x'], other['y']); assert pg.is_visible('#abar'), '点自己脚下应出浮条'
        pg.click('#abar [data-act=wait]'); pg.wait_for_timeout(200)
        assert pg.evaluate('([id])=>{const u=window.battle.game.units.find(o=>o.id===id);return u.acted&&u.x===%d&&u.y===%d}' % (other['x'], other['y']), [other['id']])
    print('选中 / 移动 / 待命冒烟测试通过', 'errors:', errs)
    b.close()
