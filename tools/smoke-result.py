# 胜利结算面板冒烟测试（0.91；同 smoke-capture.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 蓝步兵带 10 点进度站到红总部上 → 点占领 → 获胜：横幅 → 败方压灰 → 约 1.5 秒后弹出结算面板（胜利牌 + 6 行对照表，数字和引擎统计表一致）
# → 「看战场」收成底部横幅 → 点横幅再展开 → 「再来一局」= 同一张图重开（面板消失、地图没变）。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
        const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
    tap = lambda ex, ey: (lambda xy: (pg.mouse.click(xy[0], xy[1]), pg.wait_for_timeout(250)))(scr(ex, ey))
    st = lambda: pg.evaluate('()=>window.battle.state()')
    terrain0 = pg.evaluate('()=>JSON.stringify(window.battle.game.terrain)')
    setup = pg.evaluate('''()=>{const B=window.battle,g=B.game,w=B.world;
      let H=null;g.terrain.forEach((r,y)=>r.forEach((t,x)=>{if(t==='hq'&&g.owners[x+','+y]===1)H=[x,y]}));
      const u=g.units.find(o=>o.owner===0&&o.type==='inf'); if(!H||!u)return null;
      u.x=H[0];u.y=H[1];u.cap=10;w.placeAt(w.unitById(u.id),B.toWorld(H));
      B.cam.target.x=B.toWorld(H)[0]*2;B.cam.target.z=B.toWorld(H)[1]*2;B.mark();return {id:u.id,c:H}}''')
    assert setup, '需要红总部和蓝步兵'
    pg.wait_for_timeout(500)
    tap(*setup['c']); assert st()['sel'] == setup['id'], ('点单位应选中', st())
    tap(*setup['c']); pg.wait_for_function('()=>window.battle.world.units.every(u=>!u.path)', timeout=90000); pg.wait_for_timeout(300)
    assert pg.is_visible('#abar [data-act=capture]'), '红总部上应出「占领」'
    assert not pg.evaluate('()=>window.battle.result.exists'), '获胜前不该有结算面板'
    pg.click('#abar [data-act=capture]')
    pg.wait_for_function('()=>window.battle.game.winner===0', timeout=30000, polling=100)
    pg.wait_for_function('()=>window.battle.result.isOpen', timeout=60000, polling=100)
    g = pg.evaluate('''()=>{const B=window.battle,g=B.game;return {reason:g.winReason,cell:g.winCell,stats:g.stats,
      gray:g.units.map(u=>[u.owner,!!B.world.unitById(u.id).acted])}}''')
    assert g['reason'] == 'hq' and g['stats'][0]['captured'] >= 1, g
    assert all(a == (o == 1) for o, a in g['gray']), ('败方压灰、胜方原色', g['gray'])
    assert pg.inner_text('.res-ribbon') == '胜利' and '蓝军' in pg.inner_text('.res-team'), '胜利牌文字'
    assert '占领' in pg.inner_text('.res-how'), pg.inner_text('.res-how')
    rows = pg.evaluate('()=>[...document.querySelectorAll(".res-r")].map(r=>[r.querySelector(".res-c.b b").textContent,r.querySelector(".res-l").textContent,r.querySelector(".res-c.r b").textContent])')
    assert [r[1] for r in rows] == ['已生产','损失','击毁','据点','累计收入','累计军费'], rows
    assert rows[3][0].replace(',', '') == str(pg.evaluate('()=>Object.entries(window.battle.game.owners).filter(([k,o])=>o===0).length')), ('据点数 = 引擎归属数', rows)
    assert rows[4][0].replace(',', '') == str(g['stats'][0]['income']), ('累计收入一致', rows)
    pg.wait_for_timeout(700); pg.screenshot(path='/tmp/res_panel.png')
    # 看战场 → 底部横幅 → 再展开
    pg.click('.res-btn[data-act=view]'); pg.wait_for_timeout(200)
    assert pg.evaluate('()=>window.battle.result.minimized') and pg.is_visible('.res-tag') and not pg.is_visible('.res-row'), '收起后只剩横幅'
    assert '蓝军 胜利' in pg.inner_text('.res-tag'), pg.inner_text('.res-tag')
    pg.screenshot(path='/tmp/res_tag.png')
    pg.click('.res-tag'); pg.wait_for_timeout(300)
    assert pg.evaluate('()=>window.battle.result.isOpen') and pg.is_visible('.res-row'), '点横幅应重新展开'
    # 再来一局：同图重开
    pg.click('.res-btn[data-act=again]')
    pg.wait_for_function('()=>window.battle && window.battle.world && !document.querySelector("#loading") && !window.battle.result.exists && window.battle.game.winner===null', timeout=90000)
    assert pg.evaluate('()=>JSON.stringify(window.battle.game.terrain)') == terrain0, '再来一局应是同一张地图'
    assert not errs, errs
    print('PASS smoke-result')
    b.close()
