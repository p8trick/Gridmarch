# 加载进度条冒烟测试（0.63；同 smoke-arsenal.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
#   从主页点开始 → 出现进度条（#loading .ld-fill）、进度只增不减、最后消失、战场可用；战场里「换图」→ 进度条再出现再消失。
import sys, time, re
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:8099/index.html'); pg.wait_for_selector('.item', timeout=30000); pg.wait_for_timeout(800)
    def sample(label, timeout=120):
        vals = []; t0 = time.time(); seen = False
        while time.time() - t0 < timeout:
            r = pg.evaluate('()=>{const l=document.querySelector("#loading");if(!l)return null;const f=l.querySelector(".ld-fill");return [getComputedStyle(f).transform,l.querySelector(".ld-label").textContent,!!l.querySelector(".ld-bar")]}')
            if r is None:
                if seen: break
            else:
                seen = True; m = re.findall(r'-?[\d.]+', r[0]); tx = float(m[4]) if len(m) >= 6 else 0; w = pg.evaluate('()=>document.querySelector("#loading .ld-bar").clientWidth'); vals.append((round(100 + 100 * tx / w if w else 0), r[1]))
            pg.wait_for_timeout(250)
        assert seen, label + '：没看到进度条'
        pct = [v[0] for v in vals]; print(label, '进度采样', pct[:3], '…', pct[-3:], '阶段文字', sorted(set(v[1] for v in vals)))
        assert all(b2 >= a2 - 1 for a2, b2 in zip(pct, pct[1:])), (label + '：进度出现倒退', pct)
        assert len(vals) >= 2, label + '：进度条只闪了一下'
    pg.click('.item[data-id=single]'); sample('进入战斗')
    pg.wait_for_function('window.battle && window.battle.world', timeout=30000); pg.wait_for_timeout(800)
    assert pg.evaluate('()=>!document.querySelector("#loading")'), '进度条没撤掉'
    pg.click('#bMenu'); pg.wait_for_timeout(400); pg.click('[data-act=reroll]'); sample('换图')
    pg.wait_for_function('window.battle && window.battle.world', timeout=30000)
    print('加载进度条冒烟测试通过', 'errors:', errs[:5]); b.close()
