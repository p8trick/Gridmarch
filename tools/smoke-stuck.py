# 「无事可做」提醒冒烟测试（0.69；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 蓝军单位全部行动完、钱够、兵工厂空着 → 状态条脉冲但不弹结束确认 → 把每座空兵工厂都造上兵 → 最后一座造完的那一刻弹出确认。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    st = lambda: pg.evaluate('()=>({endOpen:!document.querySelector("#endm").hidden,ready:document.querySelector("#hudL").classList.contains("ready"),funds:window.battle.game.funds[0]})')
    fac = pg.evaluate('''()=>{const g=window.battle.game;g.funds[0]=90000;g.units.filter(u=>u.owner===0).forEach(u=>u.acted=true);window.battle.hud();
        return Object.keys(g.owners).filter(k=>g.owners[k]===0&&g.terrain[+k.split(",")[1]][+k.split(",")[0]]==="factory"&&!g.units.some(u=>u.x===+k.split(",")[0]&&u.y===+k.split(",")[1])).map(k=>k.split(",").map(Number))}''')
    assert len(fac) >= 1, '蓝军应至少有一座空兵工厂'
    pg.wait_for_timeout(400); s = st(); assert s['ready'] and not s['endOpen'], ('还能造兵：只脉冲不弹确认', s)
    for i, (x, y) in enumerate(fac):
        r = pg.evaluate('([x,y])=>window.battle.produce("inf",x,y).ok', [x, y]); assert r, ('生产失败', x, y)
        pg.wait_for_timeout(500); s = st()
        if i < len(fac) - 1: assert not s['endOpen'], ('还有兵工厂没造，不该弹', i, len(fac), s)
    assert s['endOpen'] and s['ready'], ('所有兵工厂都造完了，应弹确认', s)
    # 取消后不再重复弹
    pg.mouse.click(600, 320); pg.wait_for_timeout(300); pg.evaluate('()=>window.battle.hud()'); pg.wait_for_timeout(300)
    assert not st()['endOpen'], '取消后不该再弹'
    print('无事可做提醒冒烟测试通过', 'factories:', len(fac), 'errors:', errs)
    b.close()
