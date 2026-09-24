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
 p.goto(base+'/maquete-monte-dos-cedros-37.html?modo=planta3d');p.wait_for_function('__bakeV3.ready',timeout=90000);p.locator('#botaoMoveis').click();p.wait_for_timeout(500)
 target=p.evaluate('''()=>{let e=__maq.editor(),i=e.estado.moveis.findIndex(m=>m.tipo==='sofa'),m=e.estado.moveis[i],pl=__estudo.planta(),dest=null;window.oldSofa=m.obj;window.oldUV={u:m.u,v:m.v};
 for(let du of [.4,-.4,.6,-.6,1,-1]){for(let dv of [0,.4,-.4,.8,-.8]){let u=m.u,v=m.v;m.u=Math.round((u+du)*10)/10;m.v=Math.round((v+dv)*10)/10;let valid=e.cabe(m),candidate={...m};m.u=u;m.v=v;if(valid){dest=candidate;break;}}if(dest)break;}
 if(!dest)throw Error('No valid sofa destination');e.seleciona(i);let a=pl.W(dest.u,dest.v),point=__maq.planta().localToWorld(new THREE.Vector3(a[0],.02,a[1]));point.project(__maq.cam);let rect=__maq.ren.domElement.getBoundingClientRect();return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2,u:dest.u,v:dest.v};}''')
 p.mouse.move(target['x'],target['y']);p.mouse.down();p.mouse.move(target['x']+1,target['y'],steps=3);p.mouse.up();p.wait_for_timeout(700)
 result=p.evaluate('''()=>{let m=__maq.editor().estado.moveis.find(m=>m.tipo==='sofa');return {replaced:m.obj!==oldSofa,moved:Math.abs(m.u-oldUV.u)+Math.abs(m.v-oldUV.v)>.1,disabled:__bakeV3.disabled,allMapsOff:__bakeV3.materials.every(m=>m.lightMapIntensity===0),allShadersDynamic:__bakeV3.materials.every(m=>!m.userData.shader||m.userData.shader.uniforms.v3Active.value===0),u:m.u,v:m.v};}''')
 
 assert all(result[k] for k in ['replaced','moved','disabled','allMapsOff','allShadersDynamic']),result
 p.screenshot(path=str(Q/f'editor-sombra-{"live" if remote else "local"}.png'))
 p.locator('[data-modo="visita"]').click();p.wait_for_timeout(300);assert p.evaluate('__bakeV3.disabled&&__bakeV3.materials.every(m=>m.lightMapIntensity===0)')
 assert not errors,errors;result['errors']=errors;b.close()
if not remote:server.shutdown()
(Q/f'editor-sombra-{"live" if remote else "local"}.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
