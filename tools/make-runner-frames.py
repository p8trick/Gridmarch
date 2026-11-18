# 生成加载画面里「跑步步兵」的帧图（0.65）：assets/loading/runner-00.webp … runner-11.webp（透明底、蓝军、面朝右、侧面正交相机、脚底对齐）。
# 用法：先在仓库根目录 python3 -m http.server 8099 放后台，再 python3 tools/make-runner-frames.py。需要 Playwright + 无头 Chromium + Pillow。
# 步兵模型和跑步循环是游戏里原有的（soldier-rig.js 的 sampleCycle('run', 0..1)），这里只是把一个循环等分成 N 帧拍下来。改了步兵美术就重跑一遍。
import base64, io, os
from PIL import Image
from playwright.sync_api import sync_playwright
N, W, H = 12, 150, 186
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'loading')
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 400, 'height': 300}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('http://localhost:8099/index.html'); pg.wait_for_selector('.item'); pg.wait_for_timeout(1000)
    frames = pg.evaluate('''async([N,W,H])=>{
      const T=await import('three'); const m=await import('./src/art/units/infantry/infantry-performance.js');
      const u=m.createInfantryBaseline(); u.setFaction('blue');
      const cv=document.createElement('canvas'); cv.width=W*2; cv.height=H*2;   // 2 倍超采样，导出时再缩小，边缘更平滑
      const r=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true}); r.setSize(W*2,H*2,false); r.setClearColor(0x000000,0);
      const sc=new T.Scene(); sc.add(new T.HemisphereLight(0xffffff,0x667788,1.7)); const d=new T.DirectionalLight(0xffffff,2.3); d.position.set(-3,5,4); sc.add(d); sc.add(u);
      const cy=2.2, half=2.35, cam=new T.OrthographicCamera(-half*W/H,half*W/H,half,-half,.1,50);   // 固定取景（站立时的包围盒），不按每帧调，跑动的起伏才自然
      const out=[]; for(let i=0;i<N;i++){ u.sampleCycle('run', i/N); cam.position.set(-6,cy,0); cam.lookAt(0,cy,0); r.render(sc,cam); out.push(cv.toDataURL('image/png')); }
      return out}''', [N, W, H])
    for i, u in enumerate(frames):
        im = Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGBA').resize((W, H), Image.LANCZOS)
        im.save(os.path.join(OUT, f'runner-{i:02d}.webp'), 'WEBP', quality=88, method=6)
    print('frames', len(frames), 'errors', errs[:3]); b.close()
