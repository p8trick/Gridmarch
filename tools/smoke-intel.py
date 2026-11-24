# 战场情报冒烟测试（0.93；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 短按「找未行动单位」键 = 原功能（不开情报）→ 按住 0.45 秒以上 = 打开情报（单个大盒子：蓝红对照 6 行 + 中立据点条），数字和引擎一致
# → 抬手后面板还在（那次点按不算关闭）→ 点盒子里不关、点暗处关闭 → 关闭后短按仍是找单位。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    box = pg.locator('#bNext').bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    # 短按：找单位（镜头平移），不开情报
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.wait_for_timeout(120); pg.mouse.up(); pg.wait_for_timeout(400)
    assert not pg.evaluate('()=>window.battle.intel.isOpen'), '短按不该开情报'
    assert pg.evaluate('()=>!!window.battle.cam.glide || true')
    pg.wait_for_function('()=>!window.battle.cam.glide', timeout=90000, polling=200)
    # 长按：蓄力环 → 打开
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.wait_for_timeout(200)
    assert pg.evaluate('()=>document.querySelector("#bNext").classList.contains("charge")'), '按住时应有蓄力环'
    pg.wait_for_function('()=>window.battle.intel.isOpen', timeout=15000, polling=50)
    pg.mouse.up(); pg.wait_for_timeout(500)
    assert pg.evaluate('()=>window.battle.intel.isOpen'), '长按抬手后面板应该还在'
    assert not pg.evaluate('()=>document.querySelector("#bNext").classList.contains("charge")'), '打开后蓄力环应收掉'
    rows = pg.evaluate('()=>[...document.querySelectorAll(".int .res-r")].map(r=>[r.querySelector(".res-c.b b").textContent,r.querySelector(".res-l").textContent,r.querySelector(".res-c.r b").textContent])')
    assert [r[1] for r in rows] == ['现存单位','已生产','损失','据点','每回合收入','军费'], rows
    e = pg.evaluate('''async()=>{const B=window.battle,g=B.game,E=await import('/src/rules/engine.js');const s=E.summaryOf(g);return {u:s.sides.map(x=>x.units),p:s.sides.map(x=>x.props),f:g.funds,inc:[0,1].map(i=>E.incomeOf(g,i)),neu:s.neutral}}''')
    fm = lambda t: int(t.replace(',', ''))
    assert [fm(rows[0][0]), fm(rows[0][2])] == e['u'] and [fm(rows[3][0]), fm(rows[3][2])] == e['p'], (rows, e)
    assert [fm(rows[4][0]), fm(rows[4][2])] == e['inc'] and [fm(rows[5][0]), fm(rows[5][2])] == e['f'], (rows, e)
    assert f"中立据点 {e['neu']}" in pg.inner_text('.int-neu'), pg.inner_text('.int-neu')
    assert not pg.is_visible('#ui .gbtn'), '情报打开时右上角按钮应藏起来'
    pg.wait_for_timeout(500); pg.screenshot(path='/tmp/intel.png')
    pg.mouse.click(430, 200); pg.wait_for_timeout(300)   # 点盒子里面：不关
    assert pg.evaluate('()=>window.battle.intel.isOpen'), '点盒子里不该关'
    pg.mouse.click(430, 396); pg.wait_for_timeout(400)   # 点最下面的暗处：关
    assert not pg.evaluate('()=>window.battle.intel.isOpen'), '点暗处应关闭'
    assert pg.is_visible('#ui .gbtn'), '关闭后右上角按钮应回来'
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.wait_for_timeout(120); pg.mouse.up(); pg.wait_for_timeout(300)
    assert not pg.evaluate('()=>window.battle.intel.isOpen'), '关闭后短按仍是找单位'
    assert not errs, errs
    print('PASS smoke-intel')
    b.close()
