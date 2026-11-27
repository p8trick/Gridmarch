# 自行火炮冒烟（1.07；需要 Playwright + 无头 Chromium，先 python3 -m http.server 8099 放后台）：
# 兵工厂造一台自行火炮 → 对红军单位放一次攻击：炮塔转向目标（aimLock）、炮管真的开火（fireState().active 出现过）、特效放完后攻击回调返回、
# 再让它沿路径走一小段：履带 / 轮子在转（advanceMotion 被调用，motionState 里的行驶距离变化）。页面不许有错误。出错直接 assert。
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 874, 'height': 402}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8099/index.html?go=battle&seed=7&units=1')
    pg.wait_for_function('window.battle && window.battle.world && !document.querySelector("#loading")', timeout=90000); pg.wait_for_timeout(800)
    r = pg.evaluate('''()=>{const B=window.battle,g=B.game;g.funds[0]=99999;
        let f=null;for(let y=0;y<g.terrain.length&&!f;y++)for(let x=0;x<g.terrain[y].length;x++)if(g.terrain[y][x]==="factory"&&g.owners[x+","+y]===0&&!g.units.some(u=>u.x===x&&u.y===y)){f=[x,y];break}
        if(!f)return {err:"no factory"};B.produce("arty",f[0],f[1]);
        const a=g.units.find(u=>u.type==="arty"&&u.owner===0);return a?{id:a.id}:{err:"not produced"}}''')
    assert 'id' in r, r
    pg.wait_for_timeout(1200)
    info = pg.evaluate('''([id])=>{const B=window.battle,u=B.world.unitById(id),e=B.game.units.find(o=>o.owner===1);return {k:u.spec.k,hasFire:typeof u.model.fire==="function",hasMotion:typeof u.model.advanceMotion==="function",enemy:e.id}}''', [r['id']])
    assert info['k'] == 'art' and info['hasFire'] and info['hasMotion'], ('自行火炮模型应带行进 / 开火接口', info)
    # 开火
    pg.evaluate('''([id,eid])=>{const B=window.battle;window.__done=false;window.__fired=false;window.__lock=false;const u=B.world.unitById(id);
        B.world.playAttack(id,eid,()=>{window.__done=true},"howitzer");
        const t0=performance.now();const iv=setInterval(()=>{if(u.model.fireState().active)window.__fired=true;if(u.aimLock)window.__lock=true;if(performance.now()-t0>6000)clearInterval(iv)},16)}''', [r['id'], info['enemy']])
    pg.wait_for_timeout(500); pg.screenshot(path='/tmp/arty_fire.png')
    pg.wait_for_function('()=>window.__done===true', timeout=20000)
    st = pg.evaluate('''([id])=>{const u=window.battle.world.unitById(id);return {fired:window.__fired,lock:window.__lock,active:u.model.fireState().active}}''', [r['id']])
    assert st['fired'], ('炮管应真的开过火', st); assert st['lock'], ('攻击期间炮塔应锁定朝向（aimLock）', st); assert not st['active'], ('特效应已放完', st)
    # 行进：直接驱动模型两次，轮 / 履带相位要变
    ph = pg.evaluate('''([id])=>{const u=window.battle.world.unitById(id),m=u.model,a=JSON.stringify(m.motionState);m.advanceMotion(1,1);return [a,JSON.stringify(m.motionState)]}''', [r['id']])
    assert ph[0] != ph[1], ('advanceMotion 后相位应变化', ph)
    assert not errs, errs
    print('PASS smoke-arty')
    b.close()
