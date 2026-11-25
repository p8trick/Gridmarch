# 镜头记忆冒烟测试（0.99；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 「找单位」键把镜头跳到单位上 → 该单位行动完（待命）、期间没手动拖镜头 → 结束回合：这一方的镜头记忆 = 跳过去的位置（0.99 修复；以前记成了「找单位」之前的位置）；
# 只是浏览（跳过去之后没有行动）就结束回合：仍记「找单位」之前的位置。读 window.battle.camMem。出错直接 assert。
from playwright.sync_api import sync_playwright
def run(act):
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
        pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(1000)
        scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
            const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
        tgt = lambda: pg.evaluate('()=>({x:window.battle.cam.target.x,z:window.battle.cam.target.z})')
        B0 = tgt()
        pg.click('#bNext'); pg.wait_for_function('()=>!window.battle.cam.glide', timeout=90000, polling=200); pg.wait_for_timeout(300)
        J = tgt(); assert abs(J['x'] - B0['x']) + abs(J['z'] - B0['z']) > 1, '镜头应该跳到了某个单位上'
        if act:   # 在跳过去的位置上让那个单位行动完：点单位 → 点自己（原地）→ 待命
            u = pg.evaluate('''()=>{const B=window.battle,g=B.game,w=B.cam.target;let best=null,d=1e9;for(const u of g.units){if(u.owner!==g.turn||u.acted)continue;const [cx,cz]=B.toWorld([u.x,u.y]);const dd=Math.hypot(cx*2-w.x,cz*2-w.z);if(dd<d){d=dd;best=u}}return best&&{id:best.id,x:best.x,y:best.y}}''')
            xy = scr(u['x'], u['y']); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(300); xy = scr(u['x'], u['y']); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(500)
            pg.click('#abar [data-act=wait]'); pg.wait_for_timeout(400)
            assert tgt()['x'] == J['x'] and tgt()['z'] == J['z'], '期间没动过镜头'
        pg.click('#hudL'); pg.wait_for_timeout(300); pg.click('#endm [data-act=ok]'); pg.wait_for_timeout(500)
        mem = pg.evaluate('()=>window.battle.camMem[0]'); assert mem, '结束回合后应记下蓝军的镜头'
        want = J if act else B0
        assert abs(mem['x'] - want['x']) < .7 and abs(mem['z'] - want['z']) < .7, (('行动后应记跳过去的位置' if act else '只浏览应记「找单位」之前的位置'), mem, want, B0, J)
        assert not errs, errs
        print('PASS smoke-camrem', '行动后' if act else '只浏览'); b.close()
for a in (True, False): run(a)
