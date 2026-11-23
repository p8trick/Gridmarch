# 歼灭获胜冒烟测试（0.92；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 红军只留一个残血单位、蓝步兵摆在它旁边 → 点攻击打死 → 全歼：winReason = wipe、winCell = 蓝步兵所在格；结算面板写「歼灭…」；
# 镜头平移到那个格子、并且开始缓慢绕场（yaw 在变）。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
        const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
    def center(ex, ey):
        pg.evaluate("([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]);B.cam.target.x=cx*2;B.cam.target.z=cz*2;B.mark()}", [ex, ey]); pg.wait_for_timeout(900)
    def tap(ex, ey): center(ex, ey); xy = scr(ex, ey); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(300)
    st = lambda: pg.evaluate('()=>window.battle.state()')
    sc = pg.evaluate('''async()=>{const B=window.battle,g=B.game,D=await import('/src/rules/data.js');
        const a=g.units.find(o=>o.owner===0&&o.type==="inf"&&!o.moved&&!o.acted), d=g.units.find(o=>o.owner===1);
        g.units=g.units.filter(o=>o.owner===0||o===d); d.hp=5;   // 红军只剩这一个残血单位
        for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const x=d.x+dx,y=d.y+dy,t=g.terrain[y]&&g.terrain[y][x];
          if(!t||D.TERRAINS[t].cost.foot==null||g.units.some(o=>o.x===x&&o.y===y))continue;
          a.x=x;a.y=y;B.world.placeAt(B.world.unitById(a.id),B.toWorld([x,y]));return {a:a.id,ax:x,ay:y,dx:d.x,dy:d.y}}return null}''')
    assert sc, '找不到能摆放的邻格'
    tap(sc['ax'], sc['ay']); assert st()['sel'] == sc['a'], ('应选中', st())
    tap(sc['ax'], sc['ay']); assert pg.is_visible('#abar [data-act=attack]'), '旁边有敌人，浮条里应有「攻击」'
    pg.click('#abar [data-act=attack]'); pg.wait_for_timeout(300)
    yaw0 = pg.evaluate('()=>window.battle.cam.yaw')
    tap(sc['dx'], sc['dy'])
    pg.wait_for_function('()=>window.battle.game.winner===0', timeout=60000, polling=100)
    g = pg.evaluate('()=>({r:window.battle.game.winReason,c:window.battle.game.winCell})')
    assert g['r'] == 'wipe' and g['c'] == [sc['ax'], sc['ay']], ('winCell 应是打出最后一击的蓝步兵所在格', g, sc)
    pg.wait_for_function('()=>window.battle.result.isOpen', timeout=60000, polling=100)
    assert '歼灭' in pg.inner_text('.res-how'), pg.inner_text('.res-how')
    pg.wait_for_function('()=>!window.battle.cam.glide', timeout=90000, polling=200)   # 无头软件渲染帧率很低，平移要等一阵
    t = pg.evaluate('''()=>{const B=window.battle,c=B.toWorld(B.game.winCell);return {dx:Math.abs(B.cam.target.x-c[0]*2),dz:Math.abs(B.cam.target.z-c[1]*2),yaw:B.cam.yaw}}''')
    assert t['dx'] < 0.5 and t['dz'] < 0.5, ('镜头应对准打出最后一击的单位', t)
    pg.wait_for_function('(y)=>window.battle.cam.yaw!==y', arg=t['yaw'], timeout=30000, polling=200)   # 应在缓慢绕场（yaw 在变）
    assert not errs, errs
    print('PASS smoke-wipe')
    b.close()
