# 开局无单位 / 找未行动单位按钮 / 视距保存 / 浮条间距冒烟测试（0.86；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# ① 默认（不带 &units=1）开局双方都没有单位、能生产、没有判胜负、结束回合按钮不脉冲、找单位按钮灰着；
# ② &units=1：按钮角标 = 本方未行动单位数；点一下镜头平移到某个单位身上（镜头 target 到那个单位脚下），再点换下一个（按编号轮流）；单位行动完角标减少，全行动完变灰；
# ③ 视距：缩放到 9 格 → 重新进入同一张图，视距还是 9 格（存 localStorage gridmarch.camCells）；默认 7 格；
# ④ 右上角三个按钮间距 12px、菜单位置不变（0.87）；行动浮条三个按钮（占领 / 攻击 / 待命）之间空隙都是 12px。出错直接 assert。
from playwright.sync_api import sync_playwright
def load(ctx, url):
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(url); pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=120000); pg.wait_for_timeout(800)
    return pg, errs
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':874,'height':402})   # 同一个上下文里 localStorage 共用（测视距保存要用）
    # ① 默认开局：没有单位
    pg, errs = load(ctx, 'http://localhost:8099/index.html?go=battle&seed=7')
    r = pg.evaluate('''()=>{const B=window.battle,g=B.game;return {units:g.units.length,winner:g.winner,funds:g.funds[0],ready:document.querySelector('#hudL').classList.contains('ready'),off:document.querySelector('#bNext').classList.contains('off'),cnt:document.querySelector('#nCnt').textContent,cells:B.cam.cells}}''')
    assert r['units'] == 0 and r['winner'] is None and r['funds'] >= 3000, ('默认开局应没有单位、没判胜负、有钱', r)
    assert not r['ready'] and r['off'] and r['cnt'] == '', ('没有单位时结束回合不脉冲、找单位按钮灰着', r); assert r['cells'] == 7, ('默认视距 7 格', r['cells'])
    pg.close()
    # ② 带单位
    pg, errs = load(ctx, 'http://localhost:8099/index.html?go=battle&seed=7&units=1')
    r = pg.evaluate('''()=>({n:window.battle.game.units.filter(u=>u.owner===0&&!u.acted).length,cnt:document.querySelector('#nCnt').textContent,off:document.querySelector('#bNext').classList.contains('off')})''')
    assert r['n'] == 4 and r['cnt'] == '4' and not r['off'], ('角标应是本方未行动单位数', r)
    def focus():
        pg.click('#bNext'); pg.wait_for_function('()=>!window.battle.cam.busy', timeout=60000, polling=100); pg.wait_for_timeout(200)
        return pg.evaluate('''()=>{const B=window.battle,t=B.cam.target;let best=null;for(const u of B.game.units){if(u.owner!==0||u.acted)continue;const w=B.world.unitById(u.id),d=Math.hypot(w.x-t.x,w.z-t.z);if(!best||d<best[1])best=[u.id,d]}return best}''')
    # 数字在准星圆圈正中（0.87）
    ctr = pg.evaluate('''()=>{const s=document.querySelector('#bNext svg').getBoundingClientRect(),c=document.querySelector('#nCnt').getBoundingClientRect();return [Math.abs((s.left+s.width/2)-(c.left+c.width/2)),Math.abs((s.top+s.height/2)-(c.top+c.height/2)),s.width]}''')
    assert ctr[0] < 2 and ctr[1] < 2, ('数字应在准星正中', ctr)
    home = pg.evaluate("()=>[window.battle.cam.target.x,window.battle.cam.target.z]")
    seen = []
    for _ in range(4):
        f = focus(); assert f[1] < 1.0, ('镜头应已平移到单位身上', f); seen.append(f[0])
    assert seen == sorted(seen) and len(set(seen)) == 4, ('应按编号轮流切换', seen)
    # 轮完一圈再点：镜头回到开始前的位置（0.87），再点才重新从第一个开始
    pg.click('#bNext'); pg.wait_for_function('()=>!window.battle.cam.busy', timeout=60000, polling=100); pg.wait_for_timeout(200)
    back = pg.evaluate("([x,z])=>Math.hypot(window.battle.cam.target.x-x,window.battle.cam.target.z-z)", home); assert back < .05, ('轮完一圈应回到原镜头位置', back)
    f = focus(); assert f[0] == seen[0], ('回到原位后再点应重新从第一个开始', f, seen)
    pg.evaluate("()=>{const B=window.battle,g=B.game;for(const u of g.units){if(u.owner===0){u.moved=u.acted=true;B.world.setActed(u.id,true)}}B.hud()}")
    pg.wait_for_timeout(300)
    r = pg.evaluate('''()=>({cnt:document.querySelector('#nCnt').textContent,off:document.querySelector('#bNext').classList.contains('off')})''')
    assert r['cnt'] == '' and r['off'], ('全部行动完按钮应变灰', r)
    # ③ 视距保存
    pg.evaluate("()=>{const B=window.battle;B.cam.cellsGoal=9;}"); pg.wait_for_function('()=>window.battle.cam.cells===9', timeout=30000, polling=100); pg.wait_for_timeout(1500)
    saved = pg.evaluate("()=>localStorage.getItem('gridmarch.camCells')"); assert saved == '9', ('视距应已保存', saved)
    # ④ 浮条间距：三个按钮同时出现
    gaps = pg.evaluate('''()=>{const bar=document.querySelector('#abar');bar.hidden=false;const bt=a=>bar.querySelector('[data-act='+a+']');for(const a of ['capture','attack','wait'])bt(a).hidden=false;
      const o=['capture','attack','wait'].map(a=>[bt(a).offsetTop,bt(a).offsetHeight]);bar.hidden=true;return [o[1][0]-o[0][0]-o[0][1],o[2][0]-o[1][0]-o[1][1]]}''')
    assert gaps == [12, 12], ('浮条三个按钮间距都应是 12px', gaps)
    tr = pg.evaluate('''()=>{const g=id=>document.querySelector(id),n=g('#bNext'),r=g('#bRot'),m=g('#bMenu');return [r.offsetLeft-(n.offsetLeft+n.offsetWidth), m.offsetLeft-(r.offsetLeft+r.offsetWidth)]}''')
    assert tr == [12, 12], ('右上角三个按钮间距应是 12px', tr)
    pg.close()
    # 同一个浏览器上下文再进一次：视距还是 9
    pg2 = ctx.new_page(); pg2.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1'); pg2.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=120000)
    c = pg2.evaluate('()=>window.battle.cam.cells'); assert c == 9, ('重新进入后视距应还是 9 格', c)
    print('开局无单位 / 找单位按钮 / 视距保存 / 浮条冒烟测试通过', 'errors:', errs); b.close()
