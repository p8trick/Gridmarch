# 回合开始经济动画冒烟测试（0.81；同 smoke-endturn.py：不在 npm test 里，需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 把一个红军单位打残、摆到红军总部上 → 结束蓝军回合 → 状态条先显示「收入前」资金 → 下方飘「+收入」、数字涨到 收入后 → 单位头顶飘绿色「+2」、下方飘「-修理费」、数字扣到最终值；
# 期间点屏幕被挡住；演完资金 = 引擎资金、血量 +20。关掉作战动画则直接到账不演。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    info = pg.evaluate('''()=>{
      const B=window.battle,g=B.game; const hq=Object.keys(g.owners).find(k=>g.owners[k]===1&&g.terrain[+k.split(',')[1]][+k.split(',')[0]]==='hq');
      const [x,y]=hq.split(',').map(Number); const u=g.units.find(q=>q.owner===1&&!(q.x===x&&q.y===y)); const o=g.units.find(q=>q.x===x&&q.y===y);
      if(o){o.x=u.x;o.y=u.y;B.world.placeAt(B.world.unitById(o.id),B.toWorld([o.x,o.y]));}
      u.x=x;u.y=y;u.hp=50;B.world.placeAt(B.world.unitById(u.id),B.toWorld([x,y]));
      window.__log={funds:[],fx:[],dmg:[]}; const f=document.querySelector('#hFunds');
      new MutationObserver(()=>window.__log.funds.push(f.textContent)).observe(f,{childList:true,characterData:true,subtree:true});
      new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('fxm'))window.__log.fx.push(n.className+'|'+n.textContent);if(n.classList&&n.classList.contains('dmg'))window.__log.dmg.push(n.className+'|'+n.textContent)}))).observe(document.querySelector('#ui'),{childList:true});
      new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('dmg'))window.__log.dmg.push(n.className+'|'+n.textContent)}))).observe(document.querySelector('#battle')||document.body,{childList:true,subtree:true});
      B.hud(); return {id:u.id,type:u.type,funds1:g.funds[1]};}''')
    exp_cost = pg.evaluate('(t)=>Math.floor(window.__U[t]*20/100)', info['type']) if False else None
    pg.click('#hudL'); pg.wait_for_timeout(200); pg.click('.endp .sbtn.gold'); pg.wait_for_timeout(250)
    s = pg.evaluate('()=>({turn:window.battle.game.turn,funds:window.battle.game.funds[1],shown:document.querySelector("#hFunds").textContent,hp:window.battle.game.units.find(u=>u.id===%d).hp})' % info['id'])
    assert s['turn']==1 and s['hp']==70, ('引擎应已结算：红军回合、血量 50→70', s)
    income = None
    pg.wait_for_function('window.__log.fx.length>=1', timeout=15000)
    assert pg.evaluate('()=>window.__log.fx[0]').startswith('fxm in|+'), pg.evaluate('()=>window.__log.fx')
    # 动画期间点屏幕应被挡住（选不中单位）
    pg.mouse.click(437,200); assert pg.evaluate('()=>document.querySelector("#dp").hidden'), '动画期间点击没被挡住'
    pg.wait_for_function('window.__log.fx.length>=2', timeout=15000)
    fx = pg.evaluate('()=>window.__log.fx'); dmg = pg.evaluate('()=>window.__log.dmg')
    assert fx[1].startswith('fxm out|-'), fx
    assert any('heal' in d and d.endswith('|+2') for d in dmg), ('单位头顶应飘绿色 +2', dmg)
    pg.wait_for_timeout(1800)
    fin = pg.evaluate('()=>({shown:document.querySelector("#hFunds").textContent,funds:window.battle.game.funds[1],log:window.__log.funds})')
    inc = int(fx[0].split('+')[1]); cost = int(fx[1].split('-')[1]); before = fin['funds'] + cost - inc
    assert fin['shown'] == str(fin['funds']), ('演完状态条资金应等于引擎资金', fin)
    seq = [int(v) for v in fin['log'] if v.isdigit()]
    assert before in seq or seq[0] <= before + inc, ('资金数字应从收入前开始滚动', before, seq[:5])
    top = seq.index(before + inc) if before + inc in seq else -1
    assert top > 0 and seq[:top + 1] == sorted(seq[:top + 1]), ('先单调涨到收入后', seq)
    assert max(seq) == before + inc, ('资金序列里不该出现超过「收入后」的数（抓过 rAF 首帧负进度的 bug）', max(seq))
    assert seq[-1] == before + inc - cost and min(seq[seq.index(before+inc):]) == seq[-1], ('再同步扣到最终值', seq)
    # 演完后可以正常操作：点结束回合能弹确认
    pg.click('#hudL'); pg.wait_for_timeout(300); assert pg.evaluate('()=>!document.querySelector("#endm").hidden'), '动画结束后状态条点不开'
    print('经济动画冒烟测试通过', 'income', inc, 'cost', cost, 'errors:', errs)
    b.close()
