# 单位上限 / 提示 / 各方镜头记忆冒烟测试（0.88；同 smoke-endturn.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# ① 蓝军一口气造 40 个步兵（0.87 及以前步兵批容量只有 24，造到约 20 个就红色横幅报错）：全部成功、页面没有任何报错，第 41 个被引擎拒绝（提示「已达到单位上限（40）」、不扣钱）；
# ② 满员时点自己的兵工厂：不开生产界面，屏幕上方出现「已达到单位上限（40）」红色提示；
# ③ 各方镜头记忆：结束蓝军回合 → 镜头自动平移到红军总部附近（红军第一回合）；把镜头拖到别处再结束红军回合 → 回到蓝军结束时的位置；再结束蓝军回合 → 回到红军刚才的位置。出错直接 assert。
from playwright.sync_api import sync_playwright
import math
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':874,'height':402}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1'); pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=120000); pg.wait_for_timeout(800)
    r = pg.evaluate('''()=>{const B=window.battle,g=B.game; let fx=null; for(const k in g.owners){const [x,y]=k.split(',').map(Number); if(g.owners[k]===0&&g.terrain[y][x]==='factory'&&!fx) fx=[x,y];}
      const used=new Set(g.units.map(u=>u.x+','+u.y)); const free=[]; for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++){const t=g.terrain[y][x]; if((t==='plain'||t==='road')&&!used.has(x+','+y)&&!(x===fx[0]&&y===fx[1])) free.push([x,y]);}
      let ok=0,last=null,mine=()=>g.units.filter(u=>u.owner===0).length; const n0=mine();
      for(let i=0;i<60&&mine()<40;i++){ g.funds[0]=9999; g.built.clear(); const res=B.produce('inf',fx[0],fx[1]); if(!res.ok){last=res.err;break} ok++; const u=res.unit,c=free.shift(); u.x=c[0];u.y=c[1]; B.world.placeAt(B.world.unitById(u.id),B.toWorld(c)); }
      g.funds[0]=9999; g.built.clear(); const over=B.produce('inf',fx[0],fx[1]); return {fx,ok,n:mine(),n0,last,overOk:over.ok,overErr:over.err,funds:g.funds[0]}}''')
    assert r['n'] == 40 and not r['overOk'] and '上限' in r['overErr'] and r['funds'] == 9999, ('应造满 40 个、第 41 个被拒绝且不扣钱', r)
    # ② 点自己的兵工厂：提示、不开生产界面
    pg.evaluate('''([x,y])=>{const B=window.battle,c=B.toWorld([x,y]);B.cam.target.x=c[0]*2;B.cam.target.z=c[1]*2;B.mark()}''', r['fx']); pg.wait_for_timeout(600)
    pos = pg.evaluate('''([x,y])=>{const B=window.battle,c=B.toWorld([x,y]),v=new B.THREE.Vector3(c[0]*2,B.world.surfaceY(c[0],c[1]),c[1]*2).project(B.cam.cam);return [(v.x+1)/2*874,(1-v.y)/2*402]}''', r['fx'])
    pg.mouse.click(*pos); pg.wait_for_timeout(500)
    s = pg.evaluate('''()=>({toast:document.querySelector('#gmToast')?.textContent||null,on:document.querySelector('#gmToast')?.classList.contains('on')||false,ars:document.querySelector('#battle').classList.contains('ars-open')})''')
    assert s['toast'] == '已达到单位上限（40）' and s['on'] and not s['ars'], ('满员点兵工厂应提示且不开生产界面', s)
    # ③ 各方镜头记忆
    def end_turn():
        for _ in range(80):
            pg.click('#hudL'); pg.wait_for_timeout(400)
            if pg.evaluate('()=>!document.querySelector("#endm").hidden'): break
        pg.click('.endp .sbtn.gold')
        pg.wait_for_timeout(600); pg.wait_for_function('()=>!window.battle.cam.busy', timeout=90000, polling=100); pg.wait_for_timeout(300)
    tgt = lambda: pg.evaluate('()=>[window.battle.cam.target.x,window.battle.cam.target.z]')
    dist = lambda a, c: math.hypot(a[0]-c[0], a[1]-c[1])
    p_blue = tgt(); end_turn()
    red_hq = pg.evaluate('''()=>{const B=window.battle,g=B.game;for(const k in g.owners){const [x,y]=k.split(',').map(Number);if(g.owners[k]===1&&g.terrain[y][x]==='hq'){const c=B.toWorld([x,y]);return [c[0]*2,c[1]*2]}}}''')
    assert pg.evaluate('()=>window.battle.game.turn') == 1 and dist(tgt(), red_hq) < 14, ('红军第一回合镜头应在红军总部附近', tgt(), red_hq)
    pg.evaluate("()=>{const B=window.battle;B.cam.target.x+=7;B.cam.target.z+=3;B.mark()}"); p_red = tgt(); end_turn()
    assert pg.evaluate('()=>window.battle.game.turn') == 0 and dist(tgt(), p_blue) < .1, ('换回蓝军应回到蓝军结束时的位置', tgt(), p_blue)
    end_turn(); assert dist(tgt(), p_red) < .1, ('再换到红军应回到红军上次的位置', tgt(), p_red)
    assert not errs, errs
    print('单位上限 / 提示 / 镜头记忆冒烟测试通过', 'errors:', errs); b.close()
