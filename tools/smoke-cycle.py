# 「找单位」循环冒烟测试（1.00；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 1.01：「找单位」只在闲置单位之间轮换：① 多个：依次轮转，轮完回到第 1 个；② 镜头已停在某单位上：第一下看下一个；③ 只剩一个：每按一下都对准它。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(1000)
    tg = lambda: pg.evaluate('()=>[window.battle.cam.target.x,window.battle.cam.target.z]')
    dist = lambda a, b: ((a[0]-b[0])**2 + (a[1]-b[1])**2) ** .5
    def click():
        pg.click('#bNext'); pg.wait_for_timeout(300); pg.wait_for_function('()=>!window.battle.cam.glide', timeout=60000, polling=100); pg.wait_for_timeout(150); return tg()
    def setcam(x, z):
        pg.evaluate("([x,z])=>{const c=window.battle.cam;c.target.x=x;c.target.z=z;window.battle.mark()}", [x, z]); pg.wait_for_timeout(300)
    def idle_pos(): return pg.evaluate('()=>{const B=window.battle,g=B.game;return g.units.filter(u=>u.owner===g.turn&&!u.acted).sort((a,b)=>a.id-b.id).map(u=>{const [cx,cz]=B.toWorld([u.x,u.y]);return [cx*2,cz*2]})}')
    # ① 多个闲置单位：n 下看 n 个单位，第 n+1 下回到第 1 个单位（只在闲置单位间轮换，不回开始前位置）
    start = tg(); units = idle_pos(); n = len(units); assert n >= 3, units
    pos = [click() for _ in range(n + 2)]
    for i, q in enumerate(pos): assert dist(q, units[i % n]) < .7, ('第 %d 下应对准第 %d 个单位' % (i + 1, i % n + 1), q, units[i % n])
    # ② 镜头正好停在「下一个」单位上（①结束时指针在第 2 个，镜头摆到第 3 个）：这一下跳过它，直接看再下一个
    setcam(*units[2]); first = click(); want = units[3 % n]
    assert dist(first, want) < .7, ('镜头已停在下一个单位上时应跳到再下一个', first, want)
    seq = [first] + [click() for _ in range(n)]
    assert all(any(dist(q, u) < .7 for u in units) for q in seq), ('镜头只应停在闲置单位上', seq, units)
    # ③ 只剩一个闲置单位：每按一下都对准它（从远处按、已在它身上再按，都不会离开）
    pg.evaluate('()=>{const g=window.battle.game;g.units.filter(u=>u.owner===g.turn).slice(1).forEach(u=>u.acted=true);window.battle.hud()}')
    one = idle_pos()[0]; far = [one[0] + 14, one[1] + 8]; setcam(*far)
    a1 = click(); a2 = click(); a3 = click()
    assert all(dist(a, one) < .7 for a in (a1, a2, a3)), ('只剩一个闲置单位时每次都应对准它', a1, a2, a3, one)
    assert not errs, errs
    print('PASS smoke-cycle'); b.close()
