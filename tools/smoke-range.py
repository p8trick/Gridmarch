# 远程单位攻击范围冒烟（1.08 起，1.10 按新规则重写；需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 1) 移动范围 + 最远射程够得到的地方没有敌人 = 不画轮廓；有敌人（哪怕在蓝格外侧）= 画；射程 1 的单位（坦克）永远不画。
# 2) 轮廓是射程环 [最近, 最远]：贴身十字 5 格（盲区）在内圈轮廓里面，所以单位身边必须有内圈边（自行火炮：2~3 格，内圈 = 贴身十字外缘）。
# 3) 山格的轮廓边画在格子边界上（离格心 1.84 / 2 = .92），不再缩进格子里。
# 4) 规则：原地不动后自行火炮仍然有「攻击」目标。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 874, 'height': 402}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(800)
    r = pg.evaluate('''()=>{const B=window.battle,g=B.game;g.funds[0]=99999;let f=null;for(let y=0;y<g.terrain.length&&!f;y++)for(let x=0;x<g.terrain[y].length;x++)if(g.terrain[y][x]==="factory"&&g.owners[x+","+y]===0&&!g.units.some(u=>u.x===x&&u.y===y)){f=[x,y];break}
        B.produce("arty",f[0],f[1]);const a=g.units.find(u=>u.type==="arty");a.acted=false;a.moved=false;
        const tank=g.units.find(u=>u.type==="tank"&&u.owner===0);const foe=g.units.find(u=>u.owner===1);
        const W=g.terrain[0].length,H=g.terrain.length;
        // 离自行火炮曼哈顿距离 > 8（移动 5 + 射程 3）的格子，保证够不到
        let far=null;for(let y=0;y<H&&!far;y++)for(let x=0;x<W;x++)if(Math.abs(x-a.x)+Math.abs(y-a.y)>9&&!g.units.some(u=>u!==foe&&u.x===x&&u.y===y)){far=[x,y];break}
        foe.x=far[0];foe.y=far[1];B.pick(a.id);const none=B.world.hlCount("atkEdge");
        // 敌人在射程环里（原地就能打）
        foe.x=a.x+2;foe.y=a.y;B.pick(a.id);const near=B.world.hlCount("atkEdge");
        // 敌人在蓝格外侧（距离 6：移动范围之外、移动 + 射程之内）
        foe.x=a.x;foe.y=a.y-6;if(!g.terrain[foe.y]){foe.y=a.y+6}B.pick(a.id);const outer=B.world.hlCount("atkEdge");
        // 内圈：自行火炮脚边（世界距离 < 3.2）要有轮廓边
        foe.x=a.x+2;foe.y=a.y;B.pick(a.id);const aw=B.toWorld([a.x,a.y]);
        const hl=B.world.scene.children.find(o=>o.children&&o.children.some(c=>c.name==="atkEdge"));
        const inner=hl.children.filter(c=>c.name==="atkEdge"&&Math.hypot(c.position.x-aw[0]*2,c.position.z-aw[1]*2)<3.2).length;
        foe.x=a.x+2;foe.y=a.y;B.pick(tank.id);const tankE=B.world.hlCount("atkEdge");
        return {none,near,outer,inner,tankE}}''')
    assert r['none'] == 0, ('够不到时不应画轮廓', r)
    assert r['near'] > 0, ('射程环里有敌人应画轮廓', r)
    assert r['outer'] > 0, ('敌人在蓝格外侧（移动 + 射程够得到）应画轮廓', r)
    assert r['inner'] > 0, ('应有最近射程（内圈）轮廓', r)
    assert r['tankE'] == 0, ('射程 1 的单位不画', r)
    # 山格轮廓边：站在山旁让射程环盖住山格，检查边的位置贴着格子边界（|偏移| ≈ .92）
    m = pg.evaluate('''()=>{const B=window.battle,g=B.game,W=B.world;const mt=[];W.mountain.children.forEach(h=>mt.push([Math.round(h.position.x/2),Math.round(h.position.z/2)]));
        const a=g.units.find(u=>u.type==="arty"),foe=g.units.find(u=>u.owner===1),c=mt[0],e=B.toEngine([c[0],c[1]+2]);
        a.x=e[0];a.y=e[1];foe.x=e[0];foe.y=e[1]-2;B.pick(a.id);
        const hl=W.scene.children.find(o=>o.children&&o.children.some(k=>k.name==="atkEdge"));
        const edges=hl.children.filter(k=>k.name==="atkEdge"&&Math.abs(k.position.x-c[0]*2)<=1.2&&Math.abs(k.position.z-c[1]*2)<=1.2);
        return {n:edges.length,offs:edges.map(k=>[+(k.position.x-c[0]*2).toFixed(2),+(k.position.z-c[1]*2).toFixed(2)])}}''')
    assert m['n'] > 0, ('山格应有轮廓边', m)
    for ox, oz in m['offs']:
        assert abs(max(abs(ox), abs(oz)) - .92) < .02, ('山格轮廓边必须在格子边界上', m)
    assert not errs, errs
    print('PASS smoke-range', r, m['n'])
    b.close()
