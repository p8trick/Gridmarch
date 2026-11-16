# 长按详细面板冒烟测试（0.60；同 smoke-arsenal.py：不在 npm test 里，需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
#   长按有单位的格子 → 出两个盒（单位盒 + 地形盒）、不超出屏幕、手指没抬时不拖动战场、抬手后面板还在 → 点外面关闭；
#   长按空地 → 只有地形盒；长按自己的兵工厂 → 出详细面板而不是生产界面；普通点按仍然只出简要面板；
#   压力：每个兵种 × 每种地形各开一次，所有盒子都不能被截断 / 超出舞台。出错直接 assert。
import sys
from playwright.sync_api import sync_playwright
W, H = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (874, 402)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':W,'height':H}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000)
    pg.wait_for_timeout(800)
    scr = lambda c: pg.evaluate('''(c)=>{const b=window.battle,T=b.THREE,w=b.world;const v=new T.Vector3(c[0]*2,w.surfaceY(c[0],c[1])+.1,c[1]*2).project(b.cam.cam);const s=document.querySelector("#stage").getBoundingClientRect();return [(v.x+1)/2*window.__sw,(1-v.y)/2*window.__sh]}''', c)
    pg.evaluate('()=>{const s=document.querySelector("#stage");window.__sw=parseFloat(s.style.width);window.__sh=parseFloat(s.style.height)}')
    cellOf = lambda x, y: pg.evaluate('([x,y])=>{const b=window.battle;return [x+b.preset.x[0], y+b.preset.z[0]]}', [x, y])
    st = lambda: pg.evaluate('()=>({det:document.querySelectorAll(".det").length,boxes:document.querySelectorAll(".dt-box").length,ars:document.querySelectorAll(".ars").length,dp:!document.querySelector("#dp").hidden,cam:[window.battle.cam.target.x,window.battle.cam.target.z]})')
    def hold(pos, move=None):   # 按住直到面板出现（软件渲染下页面很卡，计时器会被拖后，不能靠固定等待时间；真机上约 0.45 秒触发）
        pg.mouse.move(*pos); pg.mouse.down(); pg.wait_for_selector('.det', state='attached', timeout=30000)
        if move: pg.mouse.move(pos[0]+move, pos[1]+move, steps=4); pg.wait_for_timeout(200)
    # 1 有单位的格子：长按 → 两个盒
    u = pg.evaluate('()=>{const u=window.battle.game.units.find(u=>u.owner===0);return [u.x,u.y,u.type]}')
    pos = scr(cellOf(u[0], u[1])); cam0 = st()['cam']
    hold(pos, move=30); s = st()
    assert s['det'] == 1 and s['boxes'] == 2, ('长按有单位的格子没出两个盒', s)
    assert s['cam'] == cam0, ('长按后手指移动把战场拖动了', cam0, s['cam'])
    pg.mouse.up(); pg.wait_for_timeout(500); assert st()['det'] == 1, '抬手后面板被关掉了'
    pg.screenshot(path='/tmp/det_unit.png')
    pg.mouse.click(20, H // 2); pg.wait_for_timeout(400); assert st()['det'] == 0, '点外面没关闭'
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
    # 4 自己的兵工厂（本回合一方）：长按 → 详细面板，不是生产界面
    f = pg.evaluate('()=>{const b=window.battle,g=b.game;for(const k in g.owners){const [x,y]=k.split(",").map(Number);if(g.terrain[y][x]==="factory"&&g.owners[k]===g.turn)return [x,y]}}')
    pos3 = scr(cellOf(*f)); hold(pos3); s = st(); assert s['det'] == 1 and s['ars'] == 0, ('长按己方兵工厂应出详细面板而不是生产界面', s)
    pg.mouse.up(); pg.wait_for_timeout(300); pg.mouse.click(20, H // 2); pg.wait_for_timeout(300)
    pg.mouse.click(*pos3); pg.wait_for_timeout(500); s = st(); assert s['ars'] == 1 and s['det'] == 0, ('点按己方兵工厂应仍是生产界面', s)
    pg.evaluate('()=>document.querySelector(".ars-close").click()'); pg.wait_for_timeout(300)
    # 5 压力：每个兵种 × 每种地形（把这个单位的格子临时改成该地形），所有盒子不能被截断、不能超出舞台
    res = pg.evaluate('''async()=>{const b=window.battle,g=b.game,eu=g.units.find(u=>u.owner===0),cell=[eu.x+b.preset.x[0],eu.y+b.preset.z[0]];
      const types=["inf","mech","recon","apc","tank","mdtank","neotank","arty","rocket","aa","missile"], terr=["plain","forest","mountain","river","sea","shoal","road","bridge","hq","city_large","city_small","factory","airport","port","cliff","desert","swamp"];
      const old=g.terrain[eu.y][eu.x], bad=[], S=document.querySelector("#stage").getBoundingClientRect();let n=0;
      for(const t of types){eu.type=t;eu.hp=47;for(const tr of terr){g.terrain[eu.y][eu.x]=tr;b.detail.open(cell);await new Promise(r=>requestAnimationFrame(r));
        document.querySelectorAll(".dt-box").forEach(x=>{const r=x.getBoundingClientRect();n++;if(x.scrollHeight>x.clientHeight+1||r.height<20)bad.push([t,tr,"overflow",x.scrollHeight,x.clientHeight]);});
        b.detail.close();}}
      g.terrain[eu.y][eu.x]=old;return {n,bad:bad.slice(0,8),nbad:bad.length}}''')
    print('压力测试 盒子数', res['n'], '被截断', res['nbad'], res['bad'])
    assert res['nbad'] == 0, ('有盒子内容被截断', res)
    print('长按详细面板冒烟测试通过', 'errors:', errs[:5]); b.close()
