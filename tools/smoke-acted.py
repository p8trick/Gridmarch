# 「已行动」标记冒烟测试（0.65；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 蓝军在兵工厂生产 → 新单位头顶出现「休」标记 → 结束回合（红军）→ 蓝军单位仍标记 → 红军结束 → 回到蓝军，标记全部消失。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    marks = lambda: pg.evaluate('()=>window.battle.world.units.filter(u=>u.acted&&u.abadge&&u.abadge.visible).length')
    eng = lambda: pg.evaluate('()=>window.battle.game.units.filter(u=>u.acted).length')
    assert marks() == 0 and eng() == 0, '开局不该有已行动单位'
    # 直接调引擎+同步（等价于兵工厂点「生产」）：用 UI 路径太依赖点击位置，这里走 main.js 暴露的 produce 回调
    r = pg.evaluate('''()=>{const g=window.battle.game;const k=Object.keys(g.owners).find(k=>g.owners[k]===0&&g.terrain[+k.split(",")[1]][+k.split(",")[0]]==="factory"&&!g.units.some(u=>u.x===+k.split(",")[0]&&u.y===+k.split(",")[1]));
      const [x,y]=k.split(",").map(Number); return window.battle.produce?window.battle.produce('inf',x,y):'no-hook'}''')
    assert r != 'no-hook', 'window.battle.produce 钩子不存在'
    pg.wait_for_timeout(300)
    assert eng() == 1 and marks() == 1, ('生产后应有 1 个已行动标记', eng(), marks())
    pg.click('#hudL'); pg.wait_for_timeout(200); pg.click('.endp .sbtn.gold'); pg.wait_for_timeout(2200)
    assert eng() == 1 and marks() == 1, '红军回合：蓝军新兵仍应是已行动'
    pg.click('#hudL'); pg.wait_for_timeout(200); pg.click('.endp .sbtn.gold'); pg.wait_for_timeout(2200)
    assert eng() == 0 and marks() == 0, ('回到蓝军，标记应全部消失', eng(), marks())
    print('已行动标记冒烟测试通过', 'errors:', errs)
    b.close()
