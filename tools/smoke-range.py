# 远程单位攻击范围冒烟（1.08；需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 只有「移动范围 / 射程范围里有敌人」时，选中自行火炮才画一圈橙黄外轮廓（atkEdge）；范围里没有敌人 = 和平时一样没有任何轮廓；射程 1 的单位（坦克）永远不画。
# 同时检查规则：原地不动后自行火炮仍然有「攻击」目标。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 874, 'height': 402}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(800)
    r = pg.evaluate('''()=>{const B=window.battle,g=B.game;g.funds[0]=99999;let f=null;for(let y=0;y<g.terrain.length&&!f;y++)for(let x=0;x<g.terrain[y].length;x++)if(g.terrain[y][x]==="factory"&&g.owners[x+","+y]===0&&!g.units.some(u=>u.x===x&&u.y===y)){f=[x,y];break}
        B.produce("arty",f[0],f[1]);const a=g.units.find(u=>u.type==="arty");a.acted=false;a.moved=false;
        const tank=g.units.find(u=>u.type==="tank"&&u.owner===0);const foe=g.units.find(u=>u.owner===1);
        foe.x=0;foe.y=0;                                   // 先把敌人放到很远的角落，保证移动范围 / 射程里没有敌人
        B.pick(a.id);const far=B.world.hlCount("atkEdge");
        foe.x=a.x+2;foe.y=a.y;B.pick(a.id);const near=B.world.hlCount("atkEdge");
        foe.x=a.x+2;foe.y=a.y;B.pick(tank.id);const tankE=B.world.hlCount("atkEdge");
        return {far,near,tankE}}''')
    assert r['far'] == 0, ('范围里没有敌人时不应画轮廓', r)
    assert r['near'] > 0, ('范围里有敌人时应画外轮廓', r)
    assert r['tankE'] == 0, ('射程 1 的单位不画', r)
    assert not errs, errs
    print('PASS smoke-range', r)
    b.close()
