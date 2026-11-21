# 海岸站位 / 步兵角标 / 浮条间距冒烟测试（0.82；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# ① 浅滩 / 断崖格：单位站位离格心不超过 0.5、站位高度在水面之上（-0.3），不会悬在海里；断崖格对陆军可走（规则层已有测试，这里查第一关真实地图里的引擎地形）；
# ② 步兵 / 反坦克兵血量角标相对脚下的屏幕位置，四个朝向完全一样（背包不影响）；
# ③ 行动浮条：「待命」和上面的「占领 / 攻击」之间留出至少 20px 空隙（防误触），只有「待命」一个按钮时不留空。出错直接 assert。
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(600)
    r = pg.evaluate('''()=>{
      const B=window.battle,g=B.game,THREE=B.THREE,out={cells:[],badge:{},bar:{}};
      const e=g.units.find(u=>u.owner===0&&u.type==='inf'), w=B.world.unitById(e.id);
      for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++){ if(!['cliff','shoal'].includes(g.terrain[y][x])) continue;
        const c=B.toWorld([x,y]); B.world.placeAt(w,c); out.cells.push([g.terrain[y][x], Math.hypot(w.x-c[0]*2,w.z-c[1]*2), w.baseY]); }
      B.world.setHp(e.id,5);
      for(const type of ['inf','mech']){ const q=g.units.find(u=>u.owner===0&&u.type===type); if(!q) continue; const v=B.world.unitById(q.id); B.world.setHp(q.id,5); out.badge[type]=[];
        for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){ v.yaw=yaw; B.world.setHpView({});
          const pr=(x,y,z)=>{const t=new THREE.Vector3(x,y,z).project(B.cam.cam);return [(t.x+1)/2*874,(1-t.y)/2*402]}, a=pr(v.x,v.baseY,v.z), c=pr(v.hpBadge.position.x,v.hpBadge.position.y,v.hpBadge.position.z);
          out.badge[type].push([+(c[0]-a[0]).toFixed(2),+(c[1]-a[1]).toFixed(2)]); } }
      const bar=document.querySelector('#abar'); bar.hidden=false; const bt=a=>bar.querySelector('[data-act='+a+']');
      bt('capture').hidden=false; bt('attack').hidden=false; out.bar.full=[bt('attack').offsetTop+bt('attack').offsetHeight, bt('wait').offsetTop];
      bt('capture').hidden=true; bt('attack').hidden=true; out.bar.solo=bt('wait').offsetTop; bar.hidden=true;
      return out;}''')
    assert len(r['cells']) >= 6, ('第一关应有浅滩 / 断崖格', len(r['cells']))
    for t, d, y in r['cells']:
        assert d <= .5, ('站位离格心太远', t, d); assert y > -.3, ('站位悬在水面下', t, y)
    for t, L in r['badge'].items():
        assert all(abs(q[0]-L[0][0]) < .05 and abs(q[1]-L[0][1]) < .05 for q in L), ('角标位置随朝向变了', t, L)
    gap = r['bar']['full'][1] - r['bar']['full'][0]
    assert gap >= 20, ('待命离攻击太近', r['bar']); assert r['bar']['solo'] == 0, ('只有待命时不该留空', r['bar'])
    print('海岸 / 角标 / 浮条冒烟测试通过', 'coast cells', len(r['cells']), 'bar gap', gap, 'errors:', errs)
    b.close()
