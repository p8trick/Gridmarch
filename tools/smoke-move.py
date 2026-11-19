# 选中 / 移动 / 待命冒烟测试（0.67；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 点蓝军没动过的单位 → 出蓝格（引擎算的范围）→ 点一个蓝格 → 走过去 → 单位旁出「待命」浮条（走完前不出）→ 浮条期间点战场不响应 → 点待命 → 单位已行动（脚下灰环）→ 已行动的单位点了不再选中。
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
    # 浮条期间点别处不响应
    tap(info['x'], info['y']); assert st()['sel'] is None and pg.is_visible('#abar'), '浮条期间点战场不该选中别的'
    pg.click('#abar .abtn'); pg.wait_for_timeout(300)
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
        pg.click('#abar .abtn'); pg.wait_for_timeout(200)
        assert pg.evaluate('([id])=>{const u=window.battle.game.units.find(o=>o.id===id);return u.acted&&u.x===%d&&u.y===%d}' % (other['x'], other['y']), [other['id']])
    print('选中 / 移动 / 待命冒烟测试通过', 'errors:', errs)
    b.close()
