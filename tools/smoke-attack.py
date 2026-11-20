# 攻击冒烟测试（0.70；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 把蓝军步兵摆到红军单位旁边 → 选中、点自己脚下（原地）→ 浮条出现「攻击」→ 点攻击进选目标（红格）→ 点空白处返回浮条 → 再点攻击、点红格 → 打完：目标掉血 / 倒下并移除、攻击方已行动、伤害数字出现。
# 跑两遍：作战动画开（默认）、关（localStorage gridmarch.combatAnim=0）；第二遍把目标血量压到 5 点，验证击杀移除。出错直接 assert。
from playwright.sync_api import sync_playwright
def run(pg, anim, kill):
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    pg.evaluate('()=>{window.__dmg=0;new MutationObserver(()=>{if(document.querySelector(".dmg"))window.__dmg++}).observe(document.querySelector("#battle"),{childList:true,subtree:true})}')
    scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
        const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
    def center(ex, ey):   # 把镜头对准这个格子（目标可能在屏幕外）
        pg.evaluate("([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]);B.cam.target.x=cx*2;B.cam.target.z=cz*2;B.mark()}", [ex, ey]); pg.wait_for_timeout(900)
    def tap(ex, ey): center(ex, ey); xy = scr(ex, ey); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(300)
    st = lambda: pg.evaluate('()=>window.battle.state()')
    # 摆放：蓝军步兵挪到红军单位的邻格（引擎和战场里一起挪）
    sc = pg.evaluate('''async()=>{const B=window.battle,g=B.game,D=await import('/src/rules/data.js');
        const a=g.units.find(o=>o.owner===0&&o.type==="inf"&&!o.moved&&!o.acted);
        for(const d of g.units.filter(o=>o.owner===1)){for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const x=d.x+dx,y=d.y+dy,t=g.terrain[y]&&g.terrain[y][x];
          if(!t||D.TERRAINS[t].cost.foot==null||g.units.some(o=>o.x===x&&o.y===y))continue;
          a.x=x;a.y=y;B.world.placeAt(B.world.unitById(a.id),B.toWorld([x,y]));return {a:a.id,ax:x,ay:y,d:d.id,dx:d.x,dy:d.y}}}return null}''')
    assert sc, '找不到能摆放的邻格'
    if kill: pg.evaluate('([id])=>{window.battle.game.units.find(o=>o.id===id).hp=5}', [sc['d']])
    hp = lambda id: pg.evaluate('([id])=>{const u=window.battle.game.units.find(o=>o.id===id);return u?u.hp:0}', [id])
    reds = lambda: pg.evaluate('()=>{let n=0;window.battle.world.scene.traverse(m=>{if(m.name==="tileFill"&&m.material.userData.hex===0xff3b30)n++});return n}')
    nunits0 = pg.evaluate('()=>window.battle.world.units.length')
    tap(sc['ax'], sc['ay']); assert st()['sel'] == sc['a'], ('应选中', st())
    tap(sc['ax'], sc['ay']); assert pg.is_visible('#abar') and st()['acting'] == sc['a'], '原地应出浮条'
    assert pg.is_visible('#abar [data-act=attack]'), '旁边有敌人，浮条里应有「攻击」'
    # 进选目标 → 红格 → 点空白处返回
    pg.click('#abar [data-act=attack]'); pg.wait_for_timeout(300)
    assert st()['targeting'] and reds() >= 1, ('应进入选目标并画出红格', st(), reds())
    fcs = pg.evaluate('()=>[...document.querySelectorAll(".fc")].map(e=>e.innerText)'); assert len(fcs) >= 1, ('每个红格上方应有伤害预估', fcs)
    center(sc['ax'], sc['ay']); pg.mouse.click(120, 330); pg.wait_for_timeout(300)
    assert pg.evaluate('()=>document.querySelectorAll(".fc").length') == 0, '退出选目标后预估牌应消失'
    assert not st()['targeting'] and pg.is_visible('#abar') and st()['acting'] == sc['a'] and reds() == 0, ('点空白应回到浮条（不撤销）', st(), reds())
    # 再来一次，点红格开打
    pg.click('#abar [data-act=attack]'); pg.wait_for_timeout(300)
    fcs = pg.evaluate('()=>[...document.querySelectorAll(".fc b")].map(e=>e.innerText)')
    hp0 = hp(sc['d']); tap(sc['dx'], sc['dy'])
    pg.wait_for_function('()=>{const u=window.battle.world.units;return u.every(o=>!o.path&&!o.atk&&!o.dying)}', timeout=90000); pg.wait_for_timeout(500)
    assert st()['acting'] is None and not pg.is_visible('#abar'), ('打完应结束操作', st())
    assert pg.evaluate('([id])=>window.battle.game.units.find(o=>o.id===id).acted', [sc['a']]) is True, '攻击方应已行动'
    assert pg.evaluate('()=>window.__dmg') >= 1, '应该飘出伤害数字'
    if kill:
        assert hp(sc['d']) == 0 and pg.evaluate('([id])=>!window.battle.game.units.some(o=>o.id===id)', [sc['d']]), '目标应被打掉'
        assert pg.evaluate('()=>window.battle.world.units.length') == nunits0 - 1, '战场里目标单位应被移除'
    else:
        assert hp(sc['d']) < hp0, ('目标应掉血', hp0, hp(sc['d']))
        dmg = hp0 - hp(sc['d']); assert fcs and fcs[0] == '-' + format(dmg / 10, 'g'), ('预估应和实际伤害一致', fcs, dmg)
        hb = pg.evaluate('([id])=>{const u=window.battle.world.unitById(id);return u&&u.hpBadge?[u.hpBadge.visible,u.hpBadge.userData.n]:null}', [sc['d']])
        assert hb and hb[0] and hb[1] == -(-hp(sc['d']) // 10), ('目标掉血后右下角应有血量角标', hb, hp(sc['d']))
    print('攻击冒烟通过', {'动画': anim, '击杀': kill, 'd血量': hp(sc['d'])})
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':874,'height':402}); errs=[]
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7'); pg.evaluate('()=>localStorage.setItem("gridmarch.combatAnim","1")')
    run(pg, True, False)
    pg.evaluate('()=>localStorage.setItem("gridmarch.combatAnim","0")')
    run(pg, False, True)
    print('errors:', errs)
    b.close()
