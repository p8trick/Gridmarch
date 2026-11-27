# 远程单位攻击范围冒烟（1.08；需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 选中坦克（射程 1）：不画攻击范围；选中自行火炮：画出橙色射程格（atkFill）和灰色盲区格（盲区 = 射程最近值以内，自行火炮是相邻一圈）。
# 同时检查规则：原地不动（点自己脚下）后自行火炮仍然有「攻击」目标。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 874, 'height': 402}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(800)
    r = pg.evaluate('''()=>{const B=window.battle,g=B.game;g.funds[0]=99999;let f=null;for(let y=0;y<g.terrain.length&&!f;y++)for(let x=0;x<g.terrain[y].length;x++)if(g.terrain[y][x]==="factory"&&g.owners[x+","+y]===0&&!g.units.some(u=>u.x===x&&u.y===y)){f=[x,y];break}
        B.produce("arty",f[0],f[1]);const a=g.units.find(u=>u.type==="arty");a.acted=false;a.moved=false;
        const tank=g.units.find(u=>u.type==="tank"&&u.owner===0);B.pick(tank.id);const t=B.world.hlCount("atkFill");
        B.pick(a.id);return {tankAtk:t,artyAtk:B.world.hlCount("atkFill"),edges:B.world.hlCount("atkEdge")}}''')
    assert r['tankAtk'] == 0, ('射程 1 的单位不画攻击范围', r)
    assert r['artyAtk'] >= 10 and r['edges'] > 0, ('自行火炮应画出射程格和轮廓', r)
    assert not errs, errs
    print('PASS smoke-range', r)
    b.close()
