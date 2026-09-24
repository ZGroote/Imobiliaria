"""Smoke test do pacote exato, local ou publicado; nunca modifica o site."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parent;Q=ROOT/'padrao-atual/qa';Q.mkdir(exist_ok=True)
remote=len(sys.argv)>1;base=sys.argv[1].rstrip('/') if remote else 'http://127.0.0.1:8771'
server=None
if not remote:
 class Quiet(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',8771),partial(Quiet,directory=str(ROOT/'publicado-atual')));Thread(target=server.serve_forever,daemon=True).start()
release=json.loads((ROOT/'padrao-atual/release.json').read_text())['release'];rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 for width in [1280,390]:
  c=b.new_context(viewport={'width':width,'height':900},is_mobile=width==390,has_touch=width==390);p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  p.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
  p.goto(base+'/');p.wait_for_load_state('networkidle');assert p.evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
  p.get_by_role('link',name='Explorar Monte dos Cedros').click();p.wait_for_function('window.__exteriorV3&&(__exteriorV3.ready||__exteriorV3.error)',timeout=90000);assert p.evaluate('__exteriorV3.error') is None
  assert p.locator('meta[name="maquete-release"]').get_attribute('content')==release
  assert p.evaluate('__maq.predio.children.some(o=>o.isMesh&&o.visible&&o.userData.tower===1)')
  p.screenshot(path=str(Q/f'{"live" if remote else "local"}-{width}-conjunto.png'))
  p.locator('#verConjunto').click();p.wait_for_timeout(200);assert p.evaluate('__maq.predio.children.filter(o=>o.isMesh&&o.visible).every(o=>o.userData.tower===0)')
  for mode in ['planta2d','planta3d','visita','maquete']:
   p.locator(f'[data-modo="{mode}"]').click()
   if mode in ['planta3d','visita']:p.wait_for_function('__bakeV3.ready||__bakeV3.error',timeout=90000);assert p.evaluate('__bakeV3.error') is None
   p.wait_for_timeout(300);assert p.evaluate('__maq.modo()')==mode
   assert not p.evaluate('document.documentElement.scrollWidth>innerWidth')
   if mode=='visita':p.screenshot(path=str(Q/f'{"live" if remote else "local"}-{width}-visita.png'))
  assert not errors,errors;rows.append({'width':width,'release':release,'modes':True,'errors':errors});c.close()
 if not remote:
  p=b.new_page();p.goto((ROOT/'publicado-atual/maquete-monte-dos-cedros-37-offline.html').as_uri()+'?modo=visita');p.wait_for_function('__bakeV3.ready',timeout=60000);p.locator('[data-modo="maquete"]').click();p.wait_for_function('__exteriorV3.ready',timeout=60000);p.close()
 b.close()
if server:server.shutdown()
(Q/('live.json' if remote else 'local.json')).write_text(json.dumps(rows,indent=2));print('PASSED',base,release)
