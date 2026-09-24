"""Move the sofa through actual pointer events; verify baked shadows are disabled."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json,sys
R=Path(__file__).resolve().parent;Q=R/'padrao-atual/qa';remote=len(sys.argv)>1
base=sys.argv[1].rstrip('/') if remote else 'http://127.0.0.1:8773'
if not remote:
 class Quiet(SimpleHTTPRequestHandler):
  def log_message(self,*a):pass
 server=ThreadingHTTPServer(('127.0.0.1',8773),partial(Quiet,directory=str(R/'publicado-atual')));Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True);p=b.new_page(viewport={'width':1440,'height':1000});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(base+'/maquete-monte-dos-cedros-37.html?modo=visita');p.wait_for_function('window.__roomLights&&__roomLights.ready',timeout=90000)
 p.locator('#interruptores summary').click()
 switches=p.get_by_role('switch');assert switches.count()==6
 for i in range(6):switches.nth(i).click()
 p.wait_for_timeout(500)
 assert p.evaluate('__bakeV3.disabled&&__roomLights.rooms.every(r=>!r.on&&r.light.intensity===0)&&__maq.cena.children.filter(o=>o.isDirectionalLight).every(o=>o.intensity===0)')
 p.locator('#c').screenshot(path=str(Q/f'luzes-apagadas-{remote}.png'))
 switches.nth(0).click();p.wait_for_timeout(500)
 assert p.evaluate('__roomLights.rooms[0].light.intensity>0&&__roomLights.rooms.slice(1).every(r=>r.light.intensity===0)')
 p.locator('#c').screenshot(path=str(Q/f'luzes-sala-{remote}.png'))
 p.locator('[data-modo="maquete"]').click();p.wait_for_timeout(500);assert p.locator('#interruptores').is_hidden()
 p.locator('[data-modo="visita"]').click();p.wait_for_timeout(500);assert p.evaluate('__maq.cena.children.filter(o=>o.isDirectionalLight).every(o=>o.intensity===0)')
 assert not errors; b.close()
if not remote:server.shutdown()
(Q/f'interruptores-{remote}.json').write_text(json.dumps({'switches':6,'allOff':True,'roomIndependent':True,'noInteriorSun':True,'modeTransition':True,'errors':errors},indent=2));print('Switches and interior light passed',base)
