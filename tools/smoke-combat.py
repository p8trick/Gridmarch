# 战斗音效冒烟测试（0.97；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 用法：python3 tools/smoke-combat.py [场景]，不带参数 = 全跑（每个场景重新开一局）。
# 场景：蓝步兵打死红步兵 → 声音顺序 mg（机枪开火）→ hitl（机枪命中）→ poof（步兵被消灭）；
#       蓝轻坦打死红轻坦 → cannon（炮响）→ hith（炮弹命中）→ blast（机械爆炸）。读 sfx.log。出错直接 assert。
import sys
from playwright.sync_api import sync_playwright
SCEN = {'inf': ('inf', 'inf', ['mg', 'hitl', 'poof']), 'tank': ('tank', 'tank', ['cannon', 'hith', 'blast'])}
def run(name):
    a_t, d_t, want = SCEN[name]
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        pg = b.new_page(viewport={'width':874,'height':402}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
        pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(800)
        scr = lambda ex, ey: pg.evaluate('''([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]),v=new B.THREE.Vector3(cx*2,B.world.surfaceY(cx,cz),cz*2).project(B.cam.cam);
            const cv=document.querySelector("#battle canvas").getBoundingClientRect();return [cv.left+(v.x+1)/2*cv.width, cv.top+(1-v.y)/2*cv.height]}''', [ex, ey])
        def center(ex, ey):
            pg.evaluate("([ex,ey])=>{const B=window.battle,[cx,cz]=B.toWorld([ex,ey]);B.cam.target.x=cx*2;B.cam.target.z=cz*2;B.mark()}", [ex, ey]); pg.wait_for_timeout(900)
        def tap(ex, ey): center(ex, ey); xy = scr(ex, ey); pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(300)
        st = lambda: pg.evaluate('()=>window.battle.state()')
        sc = pg.evaluate('''async([at,dt])=>{const B=window.battle,g=B.game,D=await import('/src/rules/data.js');
            const a=g.units.find(o=>o.owner===0&&o.type===at&&!o.moved&&!o.acted), d=g.units.find(o=>o.owner===1&&o.type===dt); if(!a||!d)return null; d.hp=5;
            for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const x=d.x+dx,y=d.y+dy,t=g.terrain[y]&&g.terrain[y][x];
              if(!t||D.TERRAINS[t].cost.foot==null||g.units.some(o=>o.x===x&&o.y===y))continue;
              a.x=x;a.y=y;B.world.placeAt(B.world.unitById(a.id),B.toWorld([x,y]));return {a:a.id,ax:x,ay:y,dx:d.x,dy:d.y}}return null}''', [a_t, d_t])
        assert sc, '找不到能摆放的邻格 / 兵种'
        tap(sc['ax'], sc['ay']); assert st()['sel'] == sc['a'], ('应选中', st())
        tap(sc['ax'], sc['ay']); assert pg.is_visible('#abar [data-act=attack]'), '旁边有敌人，浮条里应有「攻击」'
        pg.click('#abar [data-act=attack]'); pg.wait_for_timeout(300)
        pg.evaluate("()=>import('/src/battle/sfx.js').then(m=>{m.sfx.log.length=0})")
        tap(sc['dx'], sc['dy'])
        pg.wait_for_function('()=>window.battle.game.units.every(u=>u.hp>0)&&!window.battle.world.busy()', timeout=120000, polling=200); pg.wait_for_timeout(1200)
        log = pg.evaluate("()=>import('/src/battle/sfx.js').then(m=>m.sfx.log.slice())")
        seq = [x for x in log if x in ('mg','rocket','cannon','howitzer','hitl','hith','blast','poof')]
        assert seq[:3] == want, (name, '战斗音顺序', seq, log)
        assert not errs, errs
        print('PASS smoke-combat', name, seq)
        b.close()
for n in (sys.argv[1:] or SCEN): run(n)
