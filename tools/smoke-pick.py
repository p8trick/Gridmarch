# 山体点击冒烟（1.10）：整屏每隔 6px 发一条射线，打到哪座山的网格，cellFromRay 就必须返回那座山的格子（以前山脚外缘会被算成南边一格）。
# 需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 874, 'height': 402}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(800)
    r = pg.evaluate('''()=>{const B=window.battle,W=B.world,T=B.THREE,cam=B.cam.cam,rc=new T.Raycaster();let tot=0,bad=0;const sample=[];
        for(let px=0;px<874;px+=6)for(let py=0;py<402;py+=6){rc.setFromCamera(new T.Vector2(px/874*2-1,-(py/402)*2+1),cam);
          const hit=rc.intersectObject(W.mountain,true)[0];if(!hit)continue;let o=hit.object;while(o&&o.parent!==W.mountain)o=o.parent;if(!o)continue;
          const c=W.cellFromRay(rc.ray);tot++;if(c[0]!==Math.round(o.position.x/2)||c[1]!==Math.round(o.position.z/2)){bad++;if(sample.length<5)sample.push([px,py,c])}}
        return {tot,bad,sample}}''')
    assert r['tot'] > 200 and r['bad'] == 0, ('山体点击和屏幕上看到的山不一致', r)
    assert not errs, errs
    print('PASS smoke-pick', r)
    b.close()
