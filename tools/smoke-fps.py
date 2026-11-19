# 画质页 + 帧率小标冒烟测试（0.66；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 暂停 → 画质 → 打开帧率显示 → 小标出现在菜单按钮右侧、不遮挡、不改动菜单按钮位置 → 转动画面出帧后有数字和颜色 → 关闭后消失；设置跨局保留。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    box = lambda s: pg.evaluate('s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]}', s)
    menu0 = box('#bMenu')
    assert pg.evaluate('()=>document.querySelector("#fpsb").hidden'), '默认应关闭'
    pg.click('#bMenu'); pg.wait_for_timeout(200)
    assert pg.is_visible('#pMain') and not pg.is_visible('#pQual')
    pg.click('[data-act=quality]'); pg.wait_for_timeout(200)
    assert pg.is_visible('#pQual') and not pg.is_visible('#pMain') and pg.inner_text('#pTitle') == '画质'
    for want, v in (('涟漪', '1'), ('流光', '0'), ('涟漪', '1'), ('流光', '0')):   # 格子特效：点一下换下一种，存 localStorage
        pg.click('[data-act=tilefx]'); pg.wait_for_timeout(120)
        assert pg.inner_text('#pTileSt') == want and pg.evaluate('()=>localStorage.getItem("gridmarch.tileFx2")') == v, ('格子特效切换', want, v)
    pg.click('[data-act=fps]'); pg.wait_for_timeout(200)
    assert not pg.evaluate('()=>document.querySelector("#fpsb").hidden'), '打开后应出现小标'
    assert pg.inner_text('#pFpsSt') == '开'
    pg.screenshot(path='/tmp/fps_menu.png')
    pg.click('[data-act=back]'); pg.wait_for_timeout(100); assert pg.is_visible('#pMain')
    pg.click('[data-act=resume]'); pg.wait_for_timeout(200)
    assert box('#bMenu') == menu0, '暂停菜单按钮位置不能变'
    f = box('#fpsb'); W = pg.evaluate('()=>innerWidth')
    assert f[0] > menu0[2] - 1 and f[2] < W - 20, ('小标应在菜单按钮右侧且离右缘 ≥20px', f, menu0, W)
    # 转动画面 → 连续出帧 → 有数字
    for _ in range(3):
        pg.click('#bRot'); pg.wait_for_timeout(700)
    pg.wait_for_timeout(300)
    txt = pg.inner_text('#fpsb b'); cls = pg.get_attribute('#fpsb', 'class')
    print('fps text:', txt, cls)
    assert txt != '--' and txt.isdigit(), '出帧后应有数字'
    pg.screenshot(path='/tmp/fps_hud.png')
    # 持久化：换图重进后仍开着
    assert pg.evaluate('()=>localStorage.getItem("gridmarch.showFps")') == '1'
    pg.click('#bMenu'); pg.click('[data-act=quality]'); pg.click('[data-act=fps]'); pg.wait_for_timeout(100)
    assert pg.evaluate('()=>document.querySelector("#fpsb").hidden') and pg.evaluate('()=>localStorage.getItem("gridmarch.showFps")') == '0'
    print('画质 / 帧率冒烟测试通过', 'errors:', errs)
    b.close()
