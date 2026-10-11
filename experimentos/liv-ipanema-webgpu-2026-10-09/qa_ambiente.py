"""Confere CubeUV pré-calculado contra o gradiente filtrado na abertura real."""
import argparse
import base64
import hashlib
import io
import json
from datetime import datetime,timezone
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright,Error as PlaywrightError

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES={'webgpu':(1440,900,'webgpu'),'webgl':(1440,900,'webgl'),'toque':(390,844,'auto')}
VIEWS=['perspectiva','aerea','varandas','acesso','implantacao']


def ready(page):
    page.wait_for_function('()=>{if(__livViewer.error)throw Error(__livViewer.error);return __livViewer.ready;}',timeout=120000)
    page.evaluate('async()=>{await __livTransfers.pause();}')
    return page.frames[-1]


def capture(frame,path):
    encoded=frame.evaluate('__qaFrame()')
    raw=base64.b64decode(encoded.split(',',1)[1]);path.write_bytes(raw)
    pixels=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'),dtype=np.float32)
    assert pixels.std()>3,'Imagem vazia.'
    return pixels


def images(browser,profile,geometry,environment,out,result):
    width,height,backend=PROFILES[profile]
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=3 if profile=='toque' else 1,
                              is_mobile=profile=='toque',has_touch=profile=='toque')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        page.goto(URL+f'maquete-liv-ipanema.html?backend={backend}&geometria={geometry}&ambiente={environment}',timeout=120000)
        frame=ready(page)
        identity=frame.evaluate('''async()=>{const api=__livProva;await api.renderer.setAnimationLoop(null);
          window.__qaFrame=async()=>{await new Promise(requestAnimationFrame);return api.capture(false);};
          window.__qaDisposedEnv=0;api.scene.environment.addEventListener('dispose',()=>__qaDisposedEnv++);
          return {backend:api.backend,environment:api.environmentProfile,fallback:api.environmentFallbackError,
            sourceModelSHA256:api.data.sourceModelSHA256,canvas:[api.renderer.domElement.width,api.renderer.domElement.height]};}''')
        assert identity['environment']==environment and not identity.get('fallback'),identity
        if backend!='auto':assert identity['backend']==backend,identity
        result[environment]=identity
        views={}
        for view in VIEWS:
            frame.evaluate('view=>__livProva.setView(view)',view)
            views[view]=capture(frame,out/f'{profile}-{geometry}-{view}-{environment}.png')
        page.locator('[data-unit-side="lazer"]').click();page.locator('[data-unit-id]').first.click()
        selected=page.evaluate('__livViewer.selectedUnitId')
        assert selected and frame.evaluate('__livProva.getState().selectedUnitId')==selected
        views['final']=capture(frame,out/f'{profile}-{geometry}-final-{environment}.png')
        result[environment]['selectedUnitId']=selected
        result[environment]['disposed']=frame.evaluate('''async()=>{await __livProva.dispose();return {
          disposed:__livProva.disposed,ready:__livProva.ready,children:__livProva.scene.children.length,environmentDisposes:__qaDisposedEnv};}''')
        assert result[environment]['disposed']=={'disposed':True,'ready':False,'children':0,'environmentDisposes':1}
        assert not errors,errors
        return views
    finally:context.close()


def fallback(browser,backend,failure,out):
    context=browser.new_context(viewport={'width':1000,'height':750});page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    if failure=='http':page.route('**/assets-ambiente/ambiente.f16.gz*',lambda route:route.fulfill(status=503,body='Indisponível'))
    elif failure=='hash':
        record=json.loads((EXP/'assets-ambiente/manifest.json').read_bytes())['file']
        page.route('**/assets-ambiente/ambiente.f16.gz*',lambda route:route.fulfill(status=200,body=bytes(record['bytes'])))
    elif failure=='source':
        manifest=json.loads((EXP/'assets-ambiente/manifest.json').read_bytes());manifest['sourceRGBA_SHA256']='0'*64
        page.route('**/assets-ambiente/manifest.json',lambda route:route.fulfill(status=200,json=manifest))
    try:
        page.goto(URL+f'maquete-liv-ipanema.html?backend={backend}&geometria=contorno&ambiente=precalculado',timeout=120000)
        frame=ready(page)
        result=frame.evaluate('()=>({backend:__livProva.backend,environment:__livProva.environmentProfile,fallback:__livProva.environmentFallbackError,ready:__livProva.ready})')
        assert result['backend']==backend and result['environment']=='procedural' and result['fallback'] and result['ready'],result
        frame.evaluate('async()=>{await __livProva.renderer.setAnimationLoop(null);window.__qaFrame=async()=>__livProva.capture(false);}')
        capture(frame,out/f'{backend}-fallback-{failure}.png')
        frame.evaluate('async()=>{await __livProva.dispose();}');assert not errors,errors
        return {'failure':failure,**result,'status':'PASS'}
    finally:context.close()


def cancellation(browser,backend,phase):
    context=browser.new_context(viewport={'width':1000,'height':750});page=context.new_page();errors=[];held=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    pattern='**/assets-ambiente/ambiente.f16.gz*' if phase=='environment' else '**/modelo/variante/assets/texture-00.png*'
    def hold(route):
        held.append(route)
        route.request.frame.evaluate('''()=>{
          const api=__livProva,owner=window.parent;
          owner.__qaCancelled=api;owner.__qaCancelCounts={atlas:0,environment:0};
          api.atlas.addEventListener('dispose',()=>owner.__qaCancelCounts.atlas++);
          api.scene.environment?.addEventListener('dispose',()=>owner.__qaCancelCounts.environment++);
          owner.__qaHeld=true;
        }''')
    page.route(pattern,hold)
    try:
        page.goto(URL+f'maquete-liv-ipanema.html?backend={backend}&geometria=contorno&ambiente=precalculado',
                  wait_until='domcontentloaded',timeout=120000)
        page.wait_for_function('window.__qaHeld===true',timeout=120000)
        assert held,'Não interceptou o recurso da abertura.'
        page.evaluate('async()=>{await __livViewer.setMode("planta2d");}')
        page.wait_for_function('__livViewer.ready&&__livViewer.mode==="planta2d"&&__livViewer.pendingCleanup===0',timeout=120000)
        result=page.evaluate('''()=>({mode:__livViewer.mode,ready:__livViewer.ready,disposed:__qaCancelled.disposed,
          sceneChildren:__qaCancelled.scene.children.length,counts:__qaCancelCounts,cleanupError:__livViewer.cleanupError,
          cleanupTimeouts:__livViewer.cleanupTimeouts})''')
        assert result['disposed'] and result['ready'] and result['sceneChildren']==0,result
        assert result['counts']=={'atlas':1,'environment':0 if phase=='environment' else 1},result
        assert not result.get('cleanupError') and result['cleanupTimeouts']==0 and not errors,(result,errors)
        return {'backend':backend,'phase':phase,**result,'status':'PASS'}
    finally:
        # Resolve intercepted routes explicitly after the navigation cancelled
        # their fetches, so Playwright does not leave handler futures pending.
        for route in held:
            try:route.abort('aborted')
            except PlaywrightError as error:
                if 'closed' not in str(error) and 'already handled' not in str(error):raise
        context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,required=True)
    args=parser.parse_args();out=args.saida;out.mkdir(parents=True,exist_ok=True)
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
      'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
        ['qa_ambiente.py','ambiente.js','renderer.js','viewer.js','material-rgbm.js','assets-ambiente/manifest.json','assets-ambiente/ambiente.f16.gz',
         'assets-prova/manifest.json','modelo/variante/assets/manifest.json']},'cases':[],'fallbacks':[],'cancellations':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True);report['browserVersion']=browser.version
            for profile in PROFILES:
                for geometry in ['base','contorno']:
                    row={'profile':profile,'geometry':geometry};report['cases'].append(row)
                    before=images(browser,profile,geometry,'procedural',out,row)
                    after=images(browser,profile,geometry,'precalculado',out,row)
                    assert row['procedural']['canvas']==row['precalculado']['canvas']
                    assert row['procedural']['sourceModelSHA256']==row['precalculado']['sourceModelSHA256']
                    assert row['procedural']['selectedUnitId']==row['precalculado']['selectedUnitId']
                    row['views']=[]
                    for view in before:
                        delta=np.abs(before[view]-after[view]);maximum=float(delta.max())
                        row['views'].append({'view':view,'maxRgbDelta':maximum,'meanRgbDelta':float(delta.mean())})
                        assert maximum<=1,(profile,geometry,view,maximum)
                    row['status']='PASS';print(f'{profile}/{geometry}: PASS',flush=True)
            for backend in ['webgpu','webgl']:
                for failure in ['http','hash','source']:
                    report['fallbacks'].append(fallback(browser,backend,failure,out))
                    print(f'{backend}/fallback/{failure}: PASS',flush=True)
                for phase in ['environment','texture']:
                    report['cancellations'].append(cancellation(browser,backend,phase))
                    print(f'{backend}/cancel/{phase}: PASS',flush=True)
            browser.close()
        report['status']='PASS'
    except Exception as error:report['status']='FAIL';report['failure']=str(error);raise
    finally:(out/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':main()
