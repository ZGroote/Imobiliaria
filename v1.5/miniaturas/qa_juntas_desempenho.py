"""Close-up jamb evidence and actual shadow-pass counts, desktop/mobile emulation."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json,sys
R=Path(__file__).resolve().parent;Q=R/'padrao-atual/qa'
remote=len(sys.argv)>1;base=sys.argv[1].rstrip('/') if remote else 'http://127.0.0.1:8774'
if not remote:
 class Quiet(SimpleHTTPRequestHandler):
  def log_message(self,*a):pass
 server=ThreadingHTTPServer(('127.0.0.1',8774),partial(Quiet,directory=str(R/'publicado-atual')));Thread(target=server.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 for mobile in [False,True]:
  p=b.new_page(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1000},device_scale_factor=3 if mobile else 1,is_mobile=mobile,has_touch=mobile)
  errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(base+'/maquete-monte-dos-cedros-37.html?modo=visita');p.wait_for_function('__bakeV3.ready&&__roomLights.ready',timeout=90000);p.wait_for_timeout(1000)
  p.evaluate('Object.assign(__maq.FP,{x:-1.4,z:-.4,yaw:-.7,pitch:.45})');p.wait_for_timeout(300)
  p.locator('#c').screenshot(path=str(Q/f'jamb-fixed-{remote}-{mobile}.png'))
  if not mobile:
   for i,(x,z,yaw,pitch) in enumerate([(-.7,-.4,-.7,.45),(-1.8,-1.6,2.4,.4),(2.8,-1.6,-2.4,.4),(-1.5,-1.65,3.14,.4)]):
    p.evaluate('(v)=>Object.assign(__maq.FP,v)',dict(x=x,z=z,yaw=yaw,pitch=pitch));p.wait_for_timeout(200)
    p.locator('#c').screenshot(path=str(Q/f'corner-fixed-{remote}-{i}.png'))
   p.evaluate('Object.assign(__maq.FP,{x:-1.4,z:-.4,yaw:-.7,pitch:.45})')
  p.evaluate('''()=>{window.shadowCalls=0;__maq.cena.traverse(o=>{if(o.isMesh)o.onBeforeShadow=()=>window.shadowCalls++;});}''')
  p.locator('#interruptores summary').click();p.get_by_role('switch').nth(0).click();p.wait_for_timeout(500)
  first=p.evaluate('shadowCalls');assert first>0
  p.evaluate('shadowCalls=0');p.wait_for_timeout(700);idle=p.evaluate('shadowCalls')
  assert idle==0,idle
  # Count only room-light shadow draws: exterior zero-intensity lights may still cast.
  p.evaluate('''()=>{__maq.cena.traverse(o=>{if(o.isMesh)o.onBeforeShadow=(renderer,obj,camera,shadowCamera)=>{if(__roomLights.rooms.some(r=>r.light.shadow.camera===shadowCamera))window.roomShadowCalls++;};});window.roomShadowCalls=0;}''')
  p.wait_for_timeout(500);cached=p.evaluate('roomShadowCalls');assert cached==0,cached
  p.evaluate('__maq.FP.yaw+=.1');p.wait_for_timeout(300);assert p.evaluate('roomShadowCalls')==0
  p.evaluate('''()=>{let o=__maq.planta().children.find(o=>o.userData.movel);o.position.x+=.1;}''');p.wait_for_timeout(300)
  moved=p.evaluate('roomShadowCalls');assert moved>0,moved
  p.evaluate('roomShadowCalls=0');p.wait_for_timeout(300);assert p.evaluate('roomShadowCalls')==0
  # Same scene, temporarily restore old per-frame work to measure avoided passes.
  p.evaluate('__roomLights.rooms.forEach(r=>r.light.shadow.autoUpdate=true)');p.wait_for_timeout(500);uncached=p.evaluate('roomShadowCalls');assert uncached>0
  p.evaluate('__roomLights.rooms.forEach(r=>r.light.shadow.autoUpdate=false)')
  dpr=p.evaluate('__maq.ren.getPixelRatio()');assert not mobile or dpr<=1.25
  p.locator('#interruptores summary').click();p.locator('#c').screenshot(path=str(Q/f'jamb-dynamic-{remote}-{mobile}.png'))
  assert not errors,errors
  results.append(dict(mobile=mobile,dpr=dpr,cachedRoomDraws=cached,uncachedRoomDrawsIn500ms=uncached,afterMoveDraws=moved,allIdleShadowDraws=idle,errors=errors));p.close()
 b.close()
if not remote:server.shutdown()
(Q/f'juntas-desempenho-{remote}.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
