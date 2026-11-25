# 存档 / 继续 / 解散 / 投降冒烟测试（0.99；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 暂停菜单 → 军务 → 解散部队 → 点己方单位 → 确认：单位少一个、stats.disbanded = 1
# → 暂停菜单「返回主页」= 存档：回到主页，「继续」亮起 → 点「继续」：同一张图、引擎状态完全一致（含解散结果 / 行动状态）、世界里单位的行动灰度跟着恢复
# → 暂停菜单 → 军务 → 投降撤退 → 确认：回主页、存档被清掉、「继续」重新变灰。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    def ready(): pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(1000)
    ready()
    scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
        const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
    def center(ex, ey):
        pg.evaluate("([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]);B.cam.target.x=cx*2;B.cam.target.z=cz*2;B.mark()}", [ex, ey]); pg.wait_for_timeout(900)
    def tap(ex, ey): center(ex, ey); xy = scr(ex, ey); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(300)
    snap = lambda: pg.evaluate('()=>import("/src/rules/save.js").then(m=>JSON.stringify(m.serializeGame(window.battle.game)))')
    pause = lambda *acts: (pg.click('#bMenu'), pg.wait_for_timeout(250), [(pg.click(f'#pause [data-act={a}]'), pg.wait_for_timeout(250)) for a in acts])
    # 1. 让一个蓝步兵原地待命（制造「已行动」状态）
    u = pg.evaluate('()=>{const g=window.battle.game,u=g.units.find(o=>o.owner===0&&o.type==="inf");return {id:u.id,x:u.x,y:u.y}}')
    tap(u['x'], u['y']); tap(u['x'], u['y']); pg.click('#abar [data-act=wait]'); pg.wait_for_timeout(400)
    assert pg.evaluate('([id])=>window.battle.game.units.find(o=>o.id===id).acted', [u['id']]), '步兵应已待命'
    # 2. 解散一个别的蓝军单位
    n0 = pg.evaluate('()=>window.battle.game.units.filter(o=>o.owner===0).length')
    v = pg.evaluate('([id])=>{const g=window.battle.game,u=g.units.find(o=>o.owner===0&&o.id!==id);return {id:u.id,x:u.x,y:u.y}}', [u['id']])
    pause('cmd', 'disband'); pg.wait_for_timeout(200)
    assert pg.is_visible('#gmHint') and '解散' in pg.inner_text('#gmHint'), '应出现解散提示条'
    tap(v['x'], v['y']); assert not pg.is_hidden('#endm') and '解散' in pg.inner_text('#eTitle'), ('应弹出解散确认', pg.inner_text('#eTitle'))
    pg.click('#endm [data-act=ok]'); pg.wait_for_timeout(700)
    assert pg.evaluate('()=>window.battle.game.units.filter(o=>o.owner===0).length') == n0 - 1, '蓝军应少一个单位'
    assert pg.evaluate('()=>window.battle.game.stats[0].disbanded') == 1 and pg.evaluate('()=>window.battle.game.stats[0].lost') == 0, '记入 disbanded，不算战损'
    assert pg.is_hidden('#gmHint'), '解散后提示条应收起'
    # 3. 存档并回主页
    before = snap(); gid = pg.evaluate('()=>window.battle.gid')
    pause('home'); pg.wait_for_timeout(500)
    assert pg.is_visible('#homeView') and pg.evaluate('()=>!!localStorage.getItem("gridmarch.save")'), '回到主页且有存档'
    assert pg.get_attribute('.item[data-id=continue]', 'aria-disabled') is None, '有存档时「继续」应亮'
    # 4. 继续
    pg.click('.item[data-id=continue]'); ready()
    assert pg.evaluate('()=>window.battle.resumed') is True, '应是继续存档'
    assert snap() == before, '继续后的引擎状态应与存档时完全一致'
    assert pg.evaluate('([id])=>!!window.battle.world.unitById(id).acted', [u['id']]), '已待命的步兵继续后应仍是灰的'
    assert pg.evaluate('([gid])=>window.battle.gid===gid', [gid]), '继续后仍是同一局（gid 相同）'
    # 5. 投降撤退：不存档，存档被清掉
    pause('cmd', 'surrender'); assert not pg.is_hidden('#endm') and '投降' in pg.inner_text('#eTitle'), pg.inner_text('#eTitle')
    pg.click('#endm [data-act=ok]'); pg.wait_for_timeout(600)
    assert pg.is_visible('#homeView') and pg.evaluate('()=>localStorage.getItem("gridmarch.save")') is None, '投降后存档应被清掉'
    assert pg.get_attribute('.item[data-id=continue]', 'aria-disabled') == 'true', '没有存档了「继续」应变灰'
    assert not errs, errs
    print('PASS smoke-save'); b.close()
