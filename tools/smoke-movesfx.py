# 移动音效冒烟测试（0.98；同 smoke-result.py：需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 用法：python3 tools/smoke-movesfx.py [inf|tank]，不带参数 = 都跑。
# 蓝步兵走 ≥2 格 → sfx.log 里有若干 foot（脚步）；蓝轻坦走 ≥2 格 → 先 rev（起步）、中间若干 tread（履带）、最后 settle（到位）。
# 另外：点自己的兵工厂 → gear（齿轮机械声）。出错直接 assert。
import sys
from playwright.sync_api import sync_playwright
def run(kind):
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
        info = pg.evaluate('''([t])=>{const g=window.battle.game;const u=g.units.find(o=>o.owner===0&&o.type===t&&!o.moved&&!o.acted);return u&&{id:u.id,x:u.x,y:u.y}}''', [kind])
        assert info, '找不到蓝军 ' + kind
        tap(info['x'], info['y']); assert st()['sel'] == info['id'], ('点单位应选中', st())
        dest = pg.evaluate('''([id])=>{const B=window.battle,g=B.game,u=g.units.find(o=>o.id===id);const w=B.world.unitById(id);
            const c=w.rangeCells.map(c=>B.toEngine(c)).filter(([x,y])=>Math.abs(x-u.x)+Math.abs(y-u.y)>=3);return c[0]}''', [info['id']])
        assert dest, '范围里要有离起点 ≥3 格的格子'
        pg.evaluate("()=>import('/src/battle/sfx.js').then(m=>{m.sfx.log.length=0})")
        tap(dest[0], dest[1])
        pg.wait_for_function('()=>window.battle.world.units.every(u=>!u.path)', timeout=120000, polling=200); pg.wait_for_timeout(400)
        log = pg.evaluate("()=>import('/src/battle/sfx.js').then(m=>m.sfx.log.slice())")
        mv = [x for x in log if x in ('foot', 'tread', 'rev', 'settle')]
        if kind == 'inf': assert mv.count('foot') >= 3 and 'tread' not in mv, ('步兵应有若干脚步', mv)
        else: assert mv[0] == 'rev' and mv[-1] == 'settle' and mv.count('tread') >= 2, ('坦克应 rev → tread×n → settle', mv)
        if kind == 'inf':   # 兵工厂机械声：把一个蓝军步兵挪回自己的兵工厂格，点那一格
            fac = pg.evaluate('''()=>{const g=window.battle.game;let r=null;g.terrain.forEach((row,y)=>row.forEach((t,x)=>{if(t==='factory'&&g.owners[x+','+y]===g.turn)r=[x,y]}));return r}''')
            assert fac, '蓝军要有兵工厂'
            pg.evaluate("()=>import('/src/battle/sfx.js').then(m=>{m.sfx.log.length=0})")
            if pg.is_visible('#abar [data-act=wait]'): pg.click('#abar [data-act=wait]'); pg.wait_for_timeout(400)   # 先让走完的步兵「待命」，浮条收起，再点兵工厂
            tap(fac[0], fac[1]); pg.wait_for_timeout(500)
            lg = pg.evaluate("()=>import('/src/battle/sfx.js').then(m=>m.sfx.log.slice())")
            assert 'gear' in lg, ('点自己的兵工厂应出齿轮声', lg)
        assert not errs, errs
        print('PASS smoke-movesfx', kind, mv)
        b.close()
for k in (sys.argv[1:] or ['inf', 'tank']): run(k)
