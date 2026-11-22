# 占领冒烟测试（0.77；同 smoke-attack.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 把蓝步兵放到中立建筑上 → 点它 → 点自己脚下（原地）→ 浮条出「占领」→ 点占领 → 第一次只累加（10/20）：进度环 + 灯带渐变、建筑还是中立 → 另一个已有 10 点进度的步兵再占 → 满 20 点易主：
# 引擎 owners 变、战场建筑 owner 变、进度环清掉、单位已行动 → 走开后进度清零。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    pg.evaluate("()=>window.battle.world.setCapStyle('ring')")   # 默认样式是「条+染色」，这里先按「脚下环」数进度环；最后再单独验条 / 染色
    scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
        const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
    tap = lambda ex, ey: (lambda xy: (pg.mouse.click(xy[0], xy[1]), pg.wait_for_timeout(250)))(scr(ex, ey))
    st = lambda: pg.evaluate('()=>window.battle.state()')
    # 两座中立建筑 + 两个蓝步兵（传送过去；第二个预先带 10 点进度）
    setup = pg.evaluate('''()=>{const B=window.battle,g=B.game,w=B.world;
      const P=[];g.terrain.forEach((r,y)=>r.forEach((t,x)=>{if(['city_large','city_small','airport'].includes(t)&&g.owners[x+','+y]===undefined)P.push([x,y])}));
      const us=g.units.filter(o=>o.owner===0&&o.type==='inf').slice(0,2);
      if(P.length<2||us.length<2)return null;
      us.forEach((u,i)=>{u.x=P[i][0];u.y=P[i][1];if(i===1)u.cap=10;w.placeAt(w.unitById(u.id),B.toWorld(P[i]));});
      B.cam.target.x=B.toWorld(P[0])[0]*2;B.cam.target.z=B.toWorld(P[0])[1]*2;B.mark();
      return {a:{id:us[0].id,c:P[0]},b:{id:us[1].id,c:P[1]}}}''')
    assert setup, '需要两座中立建筑和两个蓝步兵'
    pg.wait_for_timeout(500)
    def capture(info):
        c = info['c']
        tap(*c); assert st()['sel'] == info['id'], ('点单位应选中', st())
        tap(*c); pg.wait_for_function('()=>window.battle.world.units.every(u=>!u.path)', timeout=90000); pg.wait_for_timeout(300)
        assert pg.is_visible('#abar') and st()['acting'] == info['id'], '原地待命应出浮条'
        assert pg.is_visible('#abar [data-act=capture]'), '站在中立建筑上应出「占领」'
        pg.click('#abar [data-act=capture]')
    pg.evaluate("()=>{window.__pop=[];new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('dmg')&&n.classList.contains('cap'))window.__pop.push(n.textContent)}))).observe(document.querySelector('#battle')||document.body,{childList:true,subtree:true})}")
    # ① 第一次：10/20，只累加
    capture(setup['a'])
    pg.wait_for_function("()=>window.__pop.includes('占领 10/20')", timeout=8000, polling=100)   # 头顶应飘「占领 10/20」（0.85：用 MutationObserver 记录，不靠轮询 DOM——无头软件渲染只有 ~2 帧/秒，飘字只活 1.3 秒，按帧轮询会漏）
    pg.wait_for_timeout(300); pg.screenshot(path='/tmp/cap_mid.png')
    assert pg.evaluate('()=>window.battle.world.busy()'), '占领动画期间 world.busy() 应为真（挡住点击）'
    pg.wait_for_function('()=>!window.battle.world.busy()', timeout=90000); pg.wait_for_timeout(300)
    r = pg.evaluate('([id,c])=>{const B=window.battle,u=B.game.units.find(o=>o.id===id),[ex,ey]=B.toEngine(B.toWorld(c));return {cap:u.cap,acted:u.acted,owner:B.game.owners[c[0]+","+c[1]]}}', [setup['a']['id'], setup['a']['c']])
    assert r['cap'] == 10 and r['acted'] and r['owner'] is None, ('第一次占领只累加 10 点、仍是中立', r)
    rings = pg.evaluate('()=>{let n=0;window.battle.world.scene.traverse(m=>{if(m.name==="capRing")n++});return n}')
    assert rings == 2, ('进度环应有 2 个（刚占的这座 10/20 + 预设了 10 点进度的那座）', rings)
    pg.screenshot(path='/tmp/cap_partial.png')
    # ② 第二个步兵：10 + 10 = 20，易主
    pg.evaluate('()=>{const B=window.battle;B.cam.target.x=B.toWorld(%s)[0]*2;B.cam.target.z=B.toWorld(%s)[1]*2;B.mark()}' % (setup['b']['c'], setup['b']['c']))
    pg.wait_for_timeout(500)
    capture(setup['b'])
    pg.wait_for_timeout(700); pg.screenshot(path='/tmp/cap_flash.png')
    pg.wait_for_function('()=>!window.battle.world.busy()', timeout=90000); pg.wait_for_timeout(400)
    r = pg.evaluate('([id,c])=>{const B=window.battle,u=B.game.units.find(o=>o.id===id),b=B.world.buildings.find(x=>x.cell[0]===B.toWorld(c)[0]&&x.cell[1]===B.toWorld(c)[1]);return {cap:u.cap,acted:u.acted,owner:B.game.owners[c[0]+","+c[1]],visual:b&&b.owner}}', [setup['b']['id'], setup['b']['c']])
    assert r['owner'] == 0 and r['visual'] == 'blue' and r['cap'] == 0 and r['acted'], ('占满 20 点应易主（引擎 + 战场）', r)
    pg.screenshot(path='/tmp/cap_done.png')
    # ③ 走开 → 第一座建筑的进度清零，进度环消失（下一回合单位才能动，这里直接用引擎回合）
    pg.evaluate('()=>{const B=window.battle,g=B.game;g.turn=0;g.units.forEach(u=>{u.moved=u.acted=false});}')
    pg.evaluate('([id])=>{window.battle.world.setActed(id,false)}', [setup['a']['id']])
    pg.evaluate('()=>{const B=window.battle;B.mark()}')
    pg.evaluate('''([id])=>{const B=window.battle,g=B.game,u=g.units.find(o=>o.id===id);import('/src/rules/engine.js').then(E=>{const r=E.reachable(g,u);const k=[...r.keys()].find(k=>k!==u.x+','+u.y);window.__dest=k})}''', [setup['a']['id']])
    pg.wait_for_function('()=>window.__dest', timeout=5000)
    dest = pg.evaluate('()=>window.__dest.split(",").map(Number)')
    c = setup['a']['c']
    pg.evaluate('([c])=>{const B=window.battle;B.cam.target.x=B.toWorld(c)[0]*2;B.cam.target.z=B.toWorld(c)[1]*2;B.mark()}', [c]); pg.wait_for_timeout(500)   # 0.84：先把镜头对准这个单位（之前镜头还停在第二座建筑上，换了地图后它可能在屏幕外 / 压在界面下）
    tap(*c); tap(*dest)
    pg.wait_for_function('()=>window.battle.world.units.every(u=>!u.path)', timeout=90000); pg.wait_for_timeout(400)
    r = pg.evaluate('([id])=>{const u=window.battle.game.units.find(o=>o.id===id);let n=0;window.battle.world.scene.traverse(m=>{if(m.name==="capRing")n++});return {cap:u.cap,rings:n}}', [setup['a']['id']])
    assert r['cap'] == 0 and r['rings'] == 0, ('走开后进度清零、进度环消失', r)
    # ④ 已行动单位变灰（grayT = 1）；复位后 grayT = 0
    g = pg.evaluate('([id])=>{const w=window.battle.world,u=w.units.find(o=>o.spec.id===id);return [u.grayT,u.acted]}', [setup['b']['id']])
    assert g == [1, True], ('占领完成后这个单位已行动 → 灰化目标应为 1', g)
    # ⑤ 另外三种样式：条 / 染色 / 条+染色 各自出现对应部件，清掉后消失
    for st, want in [('bar', ['capBar']), ('wipe', ['capWipe']), ('combo', ['capBar', 'capWipe'])]:
        n = pg.evaluate('''([st,c])=>{const B=window.battle,w=B.world;w.setCapStyle(st);w.setCaptureMarks([{cell:B.toWorld(c),f:.5,cap:10,need:20,team:'blue',from:'neutral'}]);
          const names=new Set();w.scene.traverse(m=>{if(m.name==='capBar'||m.name==='capWipe'||m.name==='capRing')names.add(m.name)});
          const a=[...names];w.setCaptureMarks([]);let left=0;w.scene.traverse(m=>{if(m.name==='capBar'||m.name==='capWipe'||m.name==='capRing')left++});return [a,left]}''', [st, setup['a']['c']])
        assert sorted(n[0]) == sorted(want) and n[1] == 0, (st, n)
    # ⑥ 头顶条的位置必须在建筑正上方（0.79 的注释吃掉了定位语句，条全跑到原点，当时只查了「存在」没查位置）
    pos = pg.evaluate('''([c])=>{const B=window.battle,w=B.world,wc=B.toWorld(c);w.setCapStyle('bar');w.setCaptureMarks([{cell:wc,f:.5,cap:10,need:20,team:'blue',from:'neutral'}]);
      let p=null;w.scene.traverse(m=>{if(m.name==='capBar')p=[m.position.x/2,m.position.y,m.position.z/2]});const r={want:wc,got:p};w.setCaptureMarks([]);return r}''', [setup['a']['c']])
    assert pos['got'] and abs(pos['got'][0] - pos['want'][0]) < .01 and abs(pos['got'][2] - pos['want'][1]) < .01 and pos['got'][1] > 1, ('头顶条应在建筑正上方', pos)
    assert not errs, errs
    print('占领冒烟 OK', r)
    b.close()
