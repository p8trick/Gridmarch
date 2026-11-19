# 结束回合冒烟测试（同 smoke-arsenal.py：不在 npm test 里，需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 点左上状态条 → 弹确认 → 点外面取消 → 再点 → 确认结束 → 换成红军、金币到账、横幅出现 → 本方单位全部行动完：兵工厂还能造兵时只脉冲不弹确认，没有有效操作了（钱不够 / 兵工厂都造过 / 被占）才自动弹确认 → 再结束 → 第 2 天回到蓝军。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    st = lambda: pg.evaluate('()=>({day:window.battle.game.day,turn:window.battle.game.turn,funds:[...window.battle.game.funds],endOpen:!document.querySelector("#endm").hidden,ready:document.querySelector("#hudL").classList.contains("ready"),banner:!document.querySelector("#banner").hidden})')
    pg.click('#hudL'); pg.wait_for_timeout(250); assert st()['endOpen'], '点状态条没弹确认'
    pg.mouse.click(600,320); pg.wait_for_timeout(200); assert not st()['endOpen'], '点外面没取消'
    pg.evaluate('()=>{window.__bn=false;new MutationObserver(()=>{if(!document.querySelector("#banner").hidden)window.__bn=true}).observe(document.querySelector("#banner"),{attributes:true})}')   # 软件渲染下页面可能很卡，横幅 1.7 秒内被错过：用观察器记录「出现过」
    pg.click('#hudL'); pg.wait_for_timeout(200); pg.click('.endp .sbtn.gold'); pg.wait_for_timeout(700)
    s = st(); assert s['turn'] == 1 and s['day'] == 1 and s['funds'][1] > 0, ('结束回合后状态不对', s)
    assert pg.evaluate('()=>window.__bn'), '换回合横幅没出现'
    pg.wait_for_timeout(1500)
    pg.evaluate('()=>{const g=window.battle.game;g.units.filter(u=>u.owner===g.turn).forEach(u=>u.acted=true)}')
    pg.evaluate('()=>window.battle.hud()'); pg.wait_for_timeout(400)
    s = st(); assert s['ready'] and not s['endOpen'], ('单位全行动完、兵工厂还能造兵：只该脉冲，不弹确认（0.69）', s)
    pg.evaluate('()=>{const g=window.battle.game;g.funds[g.turn]=0;window.battle.hud()}'); pg.wait_for_timeout(400)
    s = st(); assert s['endOpen'] and s['ready'], ('单位全行动完 + 钱不够造任何单位：应自动弹确认', s)
    pg.click('.endp .sbtn.gold'); pg.wait_for_timeout(800)
    s = st(); assert s['turn'] == 0 and s['day'] == 2 and not s['ready'], ('第二次结束回合后状态不对', s)
    print('结束回合冒烟测试通过', s, 'errors:', errs)
    b.close()
