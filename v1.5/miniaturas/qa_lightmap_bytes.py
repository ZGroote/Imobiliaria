"""Regression: packed alpha survives GPU upload, including software rendering."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parent;Q=ROOT/'padrao-atual/qa';remote=len(sys.argv)>1
base=sys.argv[1].rstrip('/') if remote else 'http://127.0.0.1:8772'
if not remote:
 class Quiet(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',8772),partial(Quiet,directory=str(ROOT/'publicado-atual')));Thread(target=server.serve_forever,daemon=True).start()
GPU=r'''()=>{
 const map=__bakeV3.materials[0].lightMap,ren=__maq.ren;
 if(!map.isDataTexture)throw Error('Packed light is still using an image decoder');
 const scene=new THREE.Scene(),camera=new THREE.Camera(),target=new THREE.WebGLRenderTarget(16,16,{depthBuffer:false,stencilBuffer:false});
 target.texture.colorSpace=THREE.NoColorSpace;
 const mat=new THREE.ShaderMaterial({uniforms:{packed:{value:map},size:{value:new THREE.Vector2(map.image.width,map.image.height)}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D packed;uniform vec2 size;varying vec2 v;void main(){gl_FragColor=texture2D(packed,(floor(v*size)+.5)/size);}',blending:THREE.NoBlending,depthTest:false,depthWrite:false,toneMapped:false});
 const geo=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geo,mat));ren.setRenderTarget(target);ren.render(scene,camera);
 const bytes=new Uint8Array(16*16*4);ren.readRenderTargetPixels(target,0,0,16,16,bytes);ren.setRenderTarget(null);
 let maxError=0,lowAlpha=0;
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){let sx=Math.floor((x+.5)/16*map.image.width),sy=Math.floor((y+.5)/16*map.image.height),a=(sy*map.image.width+sx)*4,b=(y*16+x)*4;for(let k=0;k<4;k++)maxError=Math.max(maxError,Math.abs(map.image.data[a+k]-bytes[b+k]));if(map.image.data[a+3]<32)lowAlpha++;}
 target.dispose();geo.dispose();mat.dispose();return {maxError,lowAlpha,samples:256,format:'RGBM raw bytes',width:map.image.width};
}'''
rows=[]
with sync_playwright() as pw:
 for gpu,args in [('native',[]),('software',['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]:
  b=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True,args=args);p=b.new_page(viewport={'width':1440,'height':1000});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(base+'/maquete-monte-dos-cedros-37.html?modo=visita');p.wait_for_function('__bakeV3.ready||__bakeV3.error',timeout=90000);assert p.evaluate('__bakeV3.error') is None
  result=p.evaluate(GPU);assert result['maxError']<=1,result;assert result['lowAlpha']>100,result
  p.evaluate('__maq.FP.pitch=.35');p.wait_for_timeout(700);p.locator('#c').screenshot(path=str(Q/f'bandas-corrigidas-{gpu}-{"live" if remote else "local"}.png'))
  assert not errors;rows.append({'gpu':gpu,**result});b.close()
if not remote:server.shutdown()
(Q/f'lightmap-bytes-{"live" if remote else "local"}.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
