# 兵工厂界面冒烟测试（不在 npm test 里，需要 Playwright + 无头 Chromium）：
#   python3 -m http.server 8099 放后台（setsid nohup ... &），再 python3 tools/smoke-arsenal.py
# 做的事：打开战场 → 点蓝方兵工厂 → 选兵种 → 关闭按钮 → 再打开，连做 3 轮，打印页面报错。0.46 的 resetView 作用域 bug 就是它能抓到、npm test 抓不到的那类。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&debug=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    pos = pg.evaluate('''()=>{const b=window.battle,T=b.THREE;const f=b.preset.layout.buildings.find(x=>x.type==="bld_factory"&&x.owner==="blue");
      const w=b.world;const v=new T.Vector3(f.cell[0]*2,w.surfaceY(f.cell[0],f.cell[1])+.1,f.cell[1]*2).project(b.cam.cam);
      return [(v.x+1)/2*874,(1-v.y)/2*402]}''')
    for rnd in range(3):
        pg.mouse.click(pos[0],pos[1]); pg.wait_for_selector('.ars', state='attached', timeout=60000)
        pg.evaluate('()=>document.querySelector(".ars-card[data-u=inf]").click()'); pg.wait_for_timeout(300)
        print(rnd, 'armed:', pg.evaluate('()=>{const c=document.querySelector(".ars-card.arm");return c&&c.dataset.u+":"+c.querySelector(".pr").textContent}'), 'no team btn:', pg.evaluate('()=>!document.querySelector(".ars-sw")&&!document.querySelector(".ars-pop")'))
        pg.evaluate('()=>document.querySelector(".ars-card[data-u=tank]").click()'); pg.wait_for_timeout(150)
        print(rnd, 'switch arms tank only:', pg.evaluate('()=>[...document.querySelectorAll(".ars-card.arm")].map(c=>c.dataset.u).join()'))
        pg.evaluate('()=>document.querySelector(".ars-card[data-u=tank]").click()'); pg.wait_for_timeout(150)
        print(rnd, 'tap again disarms:', pg.evaluate('()=>document.querySelectorAll(".ars-card.arm").length===0'))
        pg.evaluate('()=>document.querySelector(".ars-card[data-u=inf]").click()'); pg.wait_for_timeout(150)
        pg.evaluate('()=>document.querySelector(".ars-card[data-u=inf] .pr").click()'); pg.wait_for_timeout(200)
        print(rnd, 'after buy disarmed:', pg.evaluate('()=>document.querySelectorAll(".ars-card.arm").length===0'))
        pg.evaluate('()=>document.querySelector(".ars-close").click()'); pg.wait_for_timeout(300)
        print(rnd, 'open after close:', pg.evaluate('()=>!!document.querySelector(".ars")'))
    # open twice without closing (tap factory while open path)
    pg.mouse.click(pos[0],pos[1]); pg.wait_for_selector('.ars', state='attached'); 
    pg.evaluate('()=>window.battle.__ars && 0')
    print('errors:', errs[:5]); b.close()
