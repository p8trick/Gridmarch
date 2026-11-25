# 「找单位」循环冒烟测试（1.00；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# ① 多个闲置单位：每按一下镜头都动，轮完一圈后再按一下回到按之前的位置；② 镜头一开始就停在某个闲置单位上：第一下不会「没反应」，直接看下一个；
# ③ 只剩一个闲置单位：连按 = 单位 ↔ 开始前的位置来回切（镜头已停在它身上时，切到己方基地视角）。出错直接 assert。
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
    # ① 多个闲置单位：n 下看 n 个单位，第 n+1 下回到起点，镜头每一下都在动
    start = tg(); units = idle_pos(); n = len(units); assert n >= 3, units
    pos = [click() for _ in range(n)]
    for i, q in enumerate(pos): assert dist(q, units[i]) < .7, ('第 %d 下应对准第 %d 个单位' % (i + 1, i + 1), q, units[i])
    back = click(); assert dist(back, start) < .7, ('轮完一圈再按一下应回到按之前的位置', back, start)
    # ② 镜头一开始就停在第 1 个闲置单位上：每一下镜头都要动，第一下直接看第 2 个
    setcam(*units[0]); seq = [units[0]]
    for _ in range(n): seq.append(click())
    assert all(dist(seq[i], seq[i + 1]) > .7 for i in range(n)), ('每按一下镜头都应移动', seq)
    assert dist(seq[1], units[1]) < .7, ('停在第 1 个单位上时第一下应看第 2 个', seq[1], units[1])
    # ③ 只剩一个闲置单位：连按 = 单位 ↔ 开始前的位置
    pg.evaluate('()=>{const g=window.battle.game;g.units.filter(u=>u.owner===g.turn).slice(1).forEach(u=>u.acted=true);window.battle.hud()}')
    one = idle_pos()[0]; far = [one[0] + 14, one[1] + 8]; setcam(*far)
    a1 = click(); a2 = click(); a3 = click(); a4 = click()
    assert dist(a1, one) < .7 and dist(a2, far) < .7 and dist(a3, one) < .7 and dist(a4, far) < .7, ('单个闲置单位应在单位和开始前的位置间来回切', a1, a2, a3, a4, one, far)
    setcam(*one)   # 镜头已经停在它身上：再按应动（去己方基地视角），再按回来
    b1 = click(); b2 = click(); assert dist(b1, one) > 2 and dist(b2, one) < .7, ('镜头已停在唯一的闲置单位上时应切到基地视角再切回来', b1, b2, one)
    assert not errs, errs
    print('PASS smoke-cycle'); b.close()
