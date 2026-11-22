# 长按详细面板冒烟测试（0.60；0.62 起小窗是纯模型（单位模型 / 厚地块）、没有关闭按钮；0.61 加：展示窗里真的画了东西 / 点一项看说明 / 关闭按钮 / 拖动展示窗转视角；同 smoke-arsenal.py：不在 npm test 里，需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
#   长按有单位的格子 → 出两个盒（单位盒 + 地形盒）、不超出屏幕、手指没抬时不拖动战场、抬手后面板还在 → 点外面关闭；
#   长按空地 → 只有地形盒；长按自己的兵工厂 → 出详细面板而不是生产界面；普通点按仍然只出简要面板；
#   压力：每个兵种 × 每种地形各开一次，所有盒子都不能被截断 / 超出舞台。出错直接 assert。
import sys, time
T0 = time.time()
def log(m): print(f'[{time.time()-T0:5.0f}s] {m}', flush=True)
from playwright.sync_api import sync_playwright
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (874, 402)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':W,'height':H}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=11&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    scr = lambda c: pg.evaluate('''(c)=>{const b=window.battle,T=b.THREE,w=b.world;const v=new T.Vector3(c[0]*2,w.surfaceY(c[0],c[1])+.1,c[1]*2).project(b.cam.cam);const s=document.querySelector("#stage").getBoundingClientRect();return [(v.x+1)/2*window.__sw,(1-v.y)/2*window.__sh]}''', c)
    pg.evaluate('()=>{const s=document.querySelector("#stage");window.__sw=parseFloat(s.style.width);window.__sh=parseFloat(s.style.height)}')
    cellOf = lambda x, y: pg.evaluate('([x,y])=>{const b=window.battle;return [x+b.preset.x[0], y+b.preset.z[0]]}', [x, y])
    st = lambda: pg.evaluate('()=>({det:document.querySelectorAll(".det").length,boxes:document.querySelectorAll(".dt-box").length,ars:document.querySelectorAll(".ars").length,dp:!document.querySelector("#dp").hidden,cam:[window.battle.cam.target.x,window.battle.cam.target.z]})')
    def hold(pos, move=None):   # 按住直到面板出现（软件渲染下页面很卡，计时器会被拖后，不能靠固定等待时间；真机上约 0.45 秒触发）
        pg.mouse.move(*pos); pg.mouse.down(); pg.wait_for_selector('.det', state='attached', timeout=30000)
        if move: pg.mouse.move(pos[0]+move, pos[1]+move, steps=4); pg.wait_for_timeout(200)
    center = lambda c: (pg.evaluate('([x,z])=>{const B=window.battle;B.cam.target.x=x*2;B.cam.target.z=z*2;B.mark()}', c), pg.wait_for_timeout(500))   # 0.85：先把镜头对准要点的格子（默认镜头下它可能在屏幕外 / 压在界面下，换地图就点空）
    # 1 有单位的格子：长按 → 两个盒
    u = pg.evaluate('()=>{const u=window.battle.game.units.find(u=>u.owner===0);return [u.x,u.y,u.type]}')
    center(cellOf(u[0], u[1])); pos = scr(cellOf(u[0], u[1])); cam0 = st()['cam']
    hold(pos, move=30); s = st()
    assert s['det'] == 1 and s['boxes'] == 2, ('长按有单位的格子没出两个盒', s)
    assert s['cam'] == cam0, ('长按后手指移动把战场拖动了', cam0, s['cam'])
    pg.mouse.up(); pg.wait_for_timeout(500); assert st()['det'] == 1, '抬手后面板被关掉了'
    # 0.61：展示窗（两个，单位 + 地形）里画出来的不能是奶油底色，也不能是被压暗的战场（软件渲染很慢，多等一会儿）
    pg.wait_for_timeout(4000); assert pg.evaluate('()=>document.querySelectorAll(".dt-view").length') == 2, '应有两个展示窗'
    log('展示窗像素')
    from PIL import Image; import io
    def win_px(i):
        r = pg.evaluate('(i)=>{const r=document.querySelectorAll(".dt-view")[i].getBoundingClientRect();return [r.x,r.y,r.width,r.height]}', i)
        im = Image.open(io.BytesIO(pg.screenshot(clip={'x':r[0]+8,'y':r[1]+8,'width':r[2]-16,'height':r[3]-16}))).convert('RGB').resize((16,12))
        px = list(im.get_flattened_data()); n = len(px); avg = tuple(sum(c[k] for c in px)/n for k in range(3))
        var = sum(sum((c[k]-avg[k])**2 for k in range(3)) for c in px)/n
        return avg, var
    for i in (0, 1):
        avg, var = win_px(i)
        assert abs(avg[0]-255)+abs(avg[1]-246)+abs(avg[2]-220) > 40 and var > 150, ('展示窗里没画出战场内容（还是奶油底？）', i, avg, var)
    log('点选解释')
    # 0.61：点一项看说明：高亮 + 说明栏换字；再点取消；点盒子空白处不关闭
    pg.click('.dt-box[data-box=unit] [data-k=move]'); t = pg.inner_text('.dt-box[data-box=unit] .dt-exp'); assert t.startswith('机动') and pg.locator('.dt-box[data-box=unit] [data-k=move].sel').count() == 1, ('点机动没出说明', t)
    pg.click('.dt-box[data-box=terrain] [data-k="cost:wheel"]'); t = pg.inner_text('.dt-box[data-box=terrain] .dt-exp'); assert '轮式' in t, ('点轮式没出说明', t)
    pg.click('.dt-box[data-box=unit] [data-k=move]'); assert pg.locator('.dt-box[data-box=unit] .sel').count() == 0, '再点一次没取消高亮'
    pg.click('.dt-box[data-box=unit] .dt-exp'); assert st()['det'] == 1, '点盒子里的空白处不该关闭'
    log('拖动')
    # 0.61：拖动展示窗转视角：窗口画面变化、相机没被带动、面板还在
    cam1 = st()['cam']; r = pg.evaluate('()=>{const r=document.querySelectorAll(".dt-view")[0].getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}')
    a0 = win_px(0)[0]; pg.mouse.move(*r); pg.mouse.down(); pg.mouse.move(r[0]+40, r[1], steps=5); pg.mouse.up(); pg.wait_for_timeout(3500)
    assert st()['det'] == 1 and st()['cam'] == cam1, ('拖展示窗不该关面板 / 拖动战场', st())
    assert win_px(0)[0] != a0, '拖动后展示窗画面没变'
    pg.screenshot(path='/tmp/det_unit.png')
    pg.mouse.click(20, H // 2); pg.wait_for_timeout(400); assert st()['det'] == 0, '点外面没关闭'
    log('再开一次（关闭靠点空白处，没有关闭按钮）')
    pg.mouse.move(*pos); pg.mouse.down(); pg.wait_for_selector('.det', state='attached', timeout=30000); pg.mouse.up(); pg.wait_for_timeout(400)
    assert pg.locator('.det-x').count() == 0, '关闭按钮应已去掉'
    pg.mouse.click(W - 20, H // 2); pg.wait_for_timeout(300); assert st()['det'] == 0, '点右边空白没关'
    log('普通点按+空地')
    # 2 普通点按：只出简要面板
    pg.mouse.click(*pos); pg.wait_for_timeout(300); s = st(); assert s['det'] == 0 and s['dp'], ('点按应只出简要面板', s)
    # 3 空地：长按 → 只有地形盒
    empty = pg.evaluate('''(wh)=>{const b=window.battle,g=b.game,T=b.THREE,w=b.world;for(let y=0;y<g.terrain.length;y++)for(let x=0;x<g.terrain[0].length;x++){
      if(g.terrain[y][x]!=="plain"||g.units.find(u=>u.x===x&&u.y===y)||g.owners[x+","+y])continue;
      const c=[x+b.preset.x[0],y+b.preset.z[0]],v=new T.Vector3(c[0]*2,w.surfaceY(c[0],c[1])+.1,c[1]*2).project(b.cam.cam),sx=(v.x+1)/2*window.__sw,sy=(1-v.y)/2*window.__sh;
      if(sx>140&&sx<window.__sw-140&&sy>90&&sy<window.__sh-90)return [x,y]}return null}''', [W, H])
    assert empty, '画面里找不到空的平原格'
    pos2 = scr(cellOf(*empty)); hold(pos2); s = st(); assert s['det'] == 1 and s['boxes'] == 1, ('长按空地应只有地形盒', s)
    pg.mouse.up(); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/det_plain.png'); pg.mouse.click(20, H // 2); pg.wait_for_timeout(300)
    log('兵工厂')
    # 4 自己的兵工厂（本回合一方；0.84：种子换成 11——0.84 改了关卡生成，种子 7 的地图在屏幕左缘正好有个单位，第 78 行「点左缘关面板」会误选它，再点厂就成了「移动到厂上」；厂被占住时本来就打不开生产界面）：长按 → 详细面板，不是生产界面
    f = pg.evaluate('()=>{const b=window.battle,g=b.game;for(const k in g.owners){const [x,y]=k.split(",").map(Number);if(g.terrain[y][x]==="factory"&&g.owners[k]===g.turn&&!g.units.some(u=>u.x===x&&u.y===y))return [x,y]}}')
    center(cellOf(*f)); pos3 = scr(cellOf(*f)); hold(pos3); s = st(); assert s['det'] == 1 and s['ars'] == 0, ('长按己方兵工厂应出详细面板而不是生产界面', s)
    pg.mouse.up(); pg.wait_for_timeout(300); pg.mouse.click(20, H // 2); pg.wait_for_timeout(300)
    pg.mouse.click(*pos3); pg.wait_for_timeout(500); s = st(); assert s['ars'] == 1 and s['det'] == 0, ('点按己方兵工厂应仍是生产界面', s)
    pg.evaluate('()=>document.querySelector(".ars-close").click()'); pg.wait_for_timeout(300)
    log('压力')
    # 5 压力：每个兵种 × 每种地形（把这个单位的格子临时改成该地形），所有盒子不能被截断、不能超出舞台
    # 按兵种分 11 次执行（每次 17 种地形）：哪一步卡住 / 出错能立刻看出来
    res = {'n': 0, 'nbad': 0, 'bad': []}
    for t in ["inf","mech","recon","apc","tank","mdtank","neotank","arty","rocket","aa","missile"]:
        r = pg.evaluate('''(t)=>{const b=window.battle,g=b.game,eu=g.units.find(u=>u.owner===0),cell=[eu.x+b.preset.x[0],eu.y+b.preset.z[0]];
          const terr=["plain","forest","mountain","river","sea","shoal","road","bridge","hq","city_large","city_small","factory","airport","port","cliff","desert","swamp"];
          const old=g.terrain[eu.y][eu.x], oldT=eu.type, oldH=eu.hp, bad=[];let n=0;
          eu.type=t;eu.hp=47;
          for(const tr of terr){g.terrain[eu.y][eu.x]=tr;b.detail.open(cell);
            document.querySelectorAll(".dt-box").forEach(x=>{n++;if(x.scrollHeight>x.clientHeight+1)bad.push([t,tr,x.scrollHeight,x.clientHeight]);});b.detail.close();}
          g.terrain[eu.y][eu.x]=old;eu.type=oldT;eu.hp=oldH;return {n,bad}}''', t)
        res['n'] += r['n']; res['nbad'] += len(r['bad']); res['bad'] += r['bad'][:4]
        log('压力 ' + t)
    print('压力测试 盒子数', res['n'], '被截断', res['nbad'], res['bad'])
    assert res['nbad'] == 0, ('有盒子内容被截断', res)
    print('长按详细面板冒烟测试通过', 'errors:', errs[:5]); b.close()
