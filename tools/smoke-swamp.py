# 沼泽掉血动画冒烟测试（0.83；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 蓝军一个单位站沼泽（血 50）、另一个站沼泽（血 10，会被扣死），红军一个残血单位在己方总部 → 结束蓝军回合 →
# 沼泽红色「-1」飘字和修理绿色「+2」在同一刻（相差 < 250ms）出现；血 10 的那个倒下（画面里的模型被拿掉，引擎里也没了）；
# 动画期间点屏幕被挡，演完状态条资金 = 引擎资金。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    ids = pg.evaluate('''()=>{
      const B=window.battle,g=B.game; const hq=Object.keys(g.owners).find(k=>g.owners[k]===1&&g.terrain[+k.split(',')[1]][+k.split(',')[0]]==='hq');
      const [hx,hy]=hq.split(',').map(Number); const red=g.units.find(q=>q.owner===1&&!(q.x===hx&&q.y===hy)), occ=g.units.find(q=>q.x===hx&&q.y===hy);
      const blues=g.units.filter(q=>q.owner===0).slice(0,2);
      const put=(u,x,y)=>{u.x=x;u.y=y;B.world.placeAt(B.world.unitById(u.id),B.toWorld([x,y]));};
      if(occ) put(occ, red.x, red.y);
      put(red,hx,hy); red.hp=50;
      // 在红军总部旁边找两格平地当「沼泽」（只改引擎地形，画面不用管）
      const sw=[]; for(let y=0;y<g.h&&sw.length<2;y++)for(let x=0;x<g.w&&sw.length<2;x++){ if(g.terrain[y][x]==='plain'&&!g.units.some(q=>q.x===x&&q.y===y)) sw.push([x,y]); }
      put(blues[0],sw[0][0],sw[0][1]); put(blues[1],sw[1][0],sw[1][1]); g.terrain[sw[0][1]][sw[0][0]]='swamp'; g.terrain[sw[1][1]][sw[1][0]]='swamp'; blues[0].hp=50; blues[1].hp=10;
      window.__t={}; new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.classList&&n.classList.contains('dmg')){ const k=n.className+'|'+n.textContent; (window.__t[k]=window.__t[k]||[]).push(performance.now()); } }))).observe(document.querySelector('#battle')||document.body,{childList:true,subtree:true});
      B.world.setHp(blues[0].id, 5); B.world.setHp(red.id, 5); B.hud();
      return {alive:blues[0].id, dead:blues[1].id, red:red.id};}''')
    pg.click('#hudL'); pg.wait_for_timeout(200); pg.click('.endp .sbtn.gold'); pg.wait_for_timeout(250)
    eng = pg.evaluate('(i)=>({hp:window.battle.game.units.find(u=>u.id===i.alive)?.hp, dead:!window.battle.game.units.some(u=>u.id===i.dead), redhp:window.battle.game.units.find(u=>u.id===i.red).hp})', ids)
    assert eng == {'hp':40,'dead':True,'redhp':70}, ('引擎应已结算', eng)
    pg.wait_for_function('Object.keys(window.__t).length>=2', timeout=15000)
    pg.mouse.click(437,200); assert pg.evaluate('()=>document.querySelector("#dp").hidden'), '动画期间点击没被挡住'
    t = pg.evaluate('()=>window.__t'); keys = list(t)
    sw = [k for k in keys if k.endswith('|-1')]; heal = [k for k in keys if 'heal' in k and k.endswith('|+2')]
    assert sw and heal, ('应同时有沼泽 -1 和修理 +2 飘字', keys)
    assert abs(t[sw[0]][0] - t[heal[0]][0]) < 250, ('沼泽掉血和修理应同一刻', t)
    pg.wait_for_timeout(300)
    pg.wait_for_timeout(3500)
    fin = pg.evaluate('(i)=>({shown:document.querySelector("#hFunds").textContent, funds:window.battle.game.funds[1], gone:!window.battle.world.unitById(i.dead)})', ids)
    assert fin['shown'] == str(fin['funds']), ('演完状态条资金应等于引擎资金', fin); assert fin['gone'], ('被沼泽扣死的单位模型应被拿掉', fin)
    print('沼泽掉血动画冒烟测试通过', keys, 'errors:', errs)
    b.close()
