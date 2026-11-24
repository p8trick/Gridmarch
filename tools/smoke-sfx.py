# 界面音效冒烟测试（0.94；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 给 AudioContext.createOscillator 打个计数补丁 → 点主页菜单 / 战场按钮要「出声」（计数增加）；0.95：两套声音分开——菜单（主页 / 暂停菜单）= ui 库，战场内的操作（右上角按钮、点棋盘选单位 / 点格）= game 库（用 sfx.last 看）；
# 主页设置「音效」关 → 不再出声、存 gridmarch.sfx=0；战场暂停菜单第二页「界面音效」开关同一个键；主页左边距：真横屏 56px、虚拟横屏（竖握）80px，标题左移半个斜切量（0.96）。出错直接 assert。
from playwright.sync_api import sync_playwright
INIT = "window.__osc=0;(function(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const o=AC.prototype.createOscillator;AC.prototype.createOscillator=function(){window.__osc++;return o.apply(this,arguments)}})();"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.add_init_script(INIT)
    n = lambda: pg.evaluate('()=>window.__osc')
    ls = lambda: pg.evaluate('()=>localStorage.getItem("gridmarch.sfx")')
    pg.goto('http://localhost:8099/index.html'); pg.wait_for_selector('.item'); pg.wait_for_timeout(1500)
    # 主页（0.96）：真横屏（这里 874×402 不转）左边距 56px；标题再左移半个斜切量（条高 × .0882）对齐菜单斜条的下角；竖握（舞台转 90°）= 80px
    pl = lambda: pg.evaluate('()=>getComputedStyle(document.querySelector(".home")).paddingLeft')
    assert pl() == '56px', ('真横屏主页左边距应是 56px', pl())
    ml = pg.evaluate('()=>parseFloat(getComputedStyle(document.querySelector(".title")).marginLeft)'); ih = pg.evaluate('()=>document.querySelector(".item").offsetHeight')
    assert abs(ml + ih * .0882) < .3, ('标题应左移半个斜切量', ml, ih)
    pg2 = b.new_page(viewport={'width':402,'height':874}); pg2.goto('http://localhost:8099/index.html'); pg2.wait_for_selector('.item'); pg2.wait_for_timeout(1500)
    assert pg2.evaluate('()=>getComputedStyle(document.querySelector(".home")).paddingLeft') == '80px', '竖握（虚拟横屏）主页左边距应是 80px'
    assert pg2.evaluate('()=>document.querySelector("#stage").classList.contains("vrot")'); pg2.close()
    last = lambda: pg.evaluate('()=>import("/src/battle/sfx.js").then(m=>m.sfx.last)')
    pg.click('.item[data-id=multi]'); pg.wait_for_timeout(200); assert n() > 0, '点主页菜单应出声'
    assert (last())['bank'] == 'ui', ('主页菜单 = ui 库', last())
    pg.click('.item[data-id=settings]'); pg.wait_for_timeout(200); n1 = n()
    assert pg.get_attribute('[data-sfx="1"]', 'aria-pressed') == 'true', '音效默认开'
    pg.click('[data-sfx="0"]'); pg.wait_for_timeout(200)
    assert ls() == '0' and pg.get_attribute('[data-sfx="0"]', 'aria-pressed') == 'true', '关了应存 0'
    n2 = n(); pg.click('#closeSettings'); pg.wait_for_timeout(200)
    assert n() == n2, '音效关了不该再出声'
    pg.click('.item[data-id=settings]'); pg.click('[data-sfx="1"]'); pg.wait_for_timeout(200)
    assert ls() == '1'; n3 = n(); pg.click('#closeSettings'); pg.wait_for_timeout(200)
    assert n() > n3, '重新打开后应出声'
    # 战场
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(1000)
    pg.click('#bNext'); pg.wait_for_timeout(300)
    assert last() == {'bank': 'game', 'name': 'tap'}, ('右上角「找单位」键 = game 库 tap', last())
    pg.wait_for_function('()=>!window.battle.cam.glide', timeout=90000, polling=200)
    sc = pg.evaluate('''()=>{const B=window.battle,g=B.game,u=g.units.find(o=>o.owner===g.turn&&!o.acted&&!o.moved);
        const [cx,cz]=B.toWorld([u.x,u.y]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam),cv=document.querySelector("#battle canvas").getBoundingClientRect();
        return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''')
    k = n(); pg.mouse.click(sc[0], sc[1]); pg.wait_for_timeout(300)
    assert n() > k and last() == {'bank': 'game', 'name': 'select'}, ('点自己的单位 = game 库 select', last())
    k = n(); pg.mouse.click(40, 380); pg.wait_for_timeout(300)   # 点远处别的格：取消选中
    assert n() > k and last()['bank'] == 'game', ('点别处 = game 库', last())
    pg.click('#bMenu'); pg.wait_for_timeout(200); assert last() == {'bank': 'ui', 'name': 'tap'}, ('右上角「菜单」键 = ui 库', last())
    pg.click('#pMain [data-act=quality]'); pg.wait_for_timeout(200); assert last()['bank'] == 'ui', '暂停菜单 = ui 库'
    pg.click('#pQual [data-act=back]'); pg.wait_for_timeout(200)
    assert pg.inner_text('#pSfxSt') == '开'
    pg.screenshot(path='/tmp/pause_sfx.png')
    pg.click('#pMain [data-act=sfx]'); pg.wait_for_timeout(200)
    assert pg.inner_text('#pSfxSt') == '关' and ls() == '0', '暂停菜单关音效'
    k2 = n(); pg.click('#pMain [data-act=quality]'); pg.wait_for_timeout(200); assert n() == k2, '关了不出声'
    pg.click('#pQual [data-act=back]'); pg.click('#pMain [data-act=sfx]'); pg.wait_for_timeout(200)
    assert pg.inner_text('#pSfxSt') == '开' and ls() == '1'
    assert not errs, errs
    print('PASS smoke-sfx')
    b.close()
