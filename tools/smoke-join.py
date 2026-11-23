# 合流冒烟测试（0.89；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 两个蓝军步兵，一个满血、一个血 40 站在旁边：点满血的 → 点旁边残血的格子（蓝格里有它）→ 走过去 → 浮条里只有「合流」（没有待命）→ 点合流 →
# 移动的单位消失、目标血量 100、头顶飘绿色「+6」、多出的 40 血折成 400 资金（状态条下方飘「+400」，演完状态条资金 = 引擎资金）；
# 另一条：走到合流格后不点合流直接点别处 = 撤销，两个单位原样退回。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1'); pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=120000); pg.wait_for_timeout(800)
    info = pg.evaluate('''()=>{const B=window.battle,g=B.game,infs=g.units.filter(u=>u.owner===0&&u.type==='inf'),a=infs[0],t=infs[1];
      const used=new Set(g.units.map(u=>u.x+','+u.y)); let cell=null;
      const offs=[]; for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const d=Math.abs(dx)+Math.abs(dy); if(d>=1&&d<=2)offs.push([d,dx,dy])} offs.sort((p,q)=>p[0]-q[0]);
      for(const [,dx,dy] of offs){const x=a.x+dx,y=a.y+dy; if(['plain','road'].includes(g.terrain[y]?.[x])&&!used.has(x+','+y)&&(g.terrain[a.y+Math.sign(dy)]?.[a.x]!==undefined)){cell=[x,y];break}}
      t.x=cell[0];t.y=cell[1];t.hp=40; B.world.placeAt(B.world.unitById(t.id),B.toWorld(cell)); B.world.setHp(t.id,4); a.hp=100; B.hud();
      window.__pop=[]; new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('dmg'))window.__pop.push(n.className+'|'+n.textContent)}))).observe(document.querySelector('#battle')||document.body,{childList:true,subtree:true});
      return {a:[a.id,a.x,a.y],t:[t.id,t.x,t.y],funds:g.funds[0],n:g.units.length}}''')
    def scr(c):
        pg.evaluate('([x,y])=>{const B=window.battle,w=B.toWorld([x,y]);B.cam.target.x=w[0]*2;B.cam.target.z=w[1]*2;B.mark()}', c); pg.wait_for_timeout(500)
        return pg.evaluate('([x,y])=>{const B=window.battle,c=B.toWorld([x,y]),v=new B.THREE.Vector3(c[0]*2,B.world.surfaceY(c[0],c[1]),c[1]*2).project(B.cam.cam);return [(v.x+1)/2*874,(1-v.y)/2*402]}', c)
    def tap(c): pg.mouse.click(*scr(c)); pg.wait_for_timeout(400)
    wait_bar = lambda: pg.wait_for_function('()=>!document.querySelector("#abar").hidden', timeout=90000, polling=100)
    # ① 走到合流格：浮条只有「合流」；点别处 = 撤销
    tap(info['a'][1:]); tap(info['t'][1:]); wait_bar()
    vis = pg.evaluate('''()=>{const bar=document.querySelector('#abar');const v=a=>!bar.querySelector('[data-act='+a+']').hidden;return {join:v('join'),wait:v('wait'),capture:v('capture'),attack:v('attack')}}''')
    assert vis == {'join': True, 'wait': False, 'capture': False, 'attack': False}, ('合流格上浮条只应有「合流」', vis)
    pg.mouse.click(60, 340); pg.wait_for_timeout(800)   # 点别处 = 撤销
    s = pg.evaluate('([a,t])=>{const g=window.battle.game,A=g.units.find(u=>u.id===a[0]),T=g.units.find(u=>u.id===t[0]);return {ax:A.x,ay:A.y,am:A.moved,tx:T.x,ty:T.y,thp:T.hp,n:g.units.length}}', [info['a'], info['t']])
    assert (s['ax'], s['ay'], s['am'], s['n'], s['thp']) == (info['a'][1], info['a'][2], False, info['n'], 40), ('点别处应撤销、两个单位原样', s)
    # ② 真合流
    pg.wait_for_function('()=>!window.battle.world.busy()', timeout=60000, polling=100)
    assert pg.evaluate('()=>window.battle.state().sel') == info['a'][0], '撤销后应回到选中状态'
    tap(info['t'][1:]); wait_bar(); pg.click('[data-act=join]')   # 撤销后单位仍是选中的，直接点残血友军格
    pg.wait_for_function("()=>window.__pop.some(p=>p.includes('heal')&&p.endsWith('|+6'))", timeout=60000, polling=100)
    r = pg.evaluate('([a,t])=>{const B=window.battle,g=B.game;return {n:g.units.length,aGone:!g.units.some(u=>u.id===a[0])&&!B.world.unitById(a[0]),thp:g.units.find(u=>u.id===t[0]).hp,funds:g.funds[0]}}', [info['a'], info['t']])
    assert r['aGone'] and r['n'] == info['n'] - 1 and r['thp'] == 100 and r['funds'] == info['funds'] + 400, ('合流后：移动的单位消失、目标满血、退款 400', r, info)
    pg.wait_for_function('()=>document.querySelector("#hFunds").textContent===String(window.battle.game.funds[0])', timeout=60000, polling=100)
    assert not errs, errs
    print('合流冒烟测试通过', 'errors:', errs); b.close()
