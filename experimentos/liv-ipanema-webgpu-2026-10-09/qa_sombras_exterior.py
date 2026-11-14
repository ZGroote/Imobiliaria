"""Compara sombras reutilizadas com recálculo, em ambas as edições do exterior."""
import argparse
import base64
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES = {'webgpu': (1440, 900, 'webgpu'), 'webgl': (1440, 900, 'webgl'), 'toque': (390, 844, 'auto')}


def capture(frame, path):
    encoded = frame.evaluate('__qaFrame()')
    raw = base64.b64decode(encoded.split(',', 1)[1])
    path.write_bytes(raw)
    pixels = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=np.float32)
    assert pixels.std() > 3, 'Imagem vazia.'
    return pixels


def case(browser, profile, geometry, output, cases):
    width, height, backend = PROFILES[profile]
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=3 if profile=='toque' else 1,
                                  is_mobile=profile=='toque', has_touch=profile=='toque')
    page = context.new_page()
    result = {'profile': profile, 'geometry': geometry, 'errors': []}
    cases.append(result)
    page.on('pageerror', lambda error: result['errors'].append(str(error)))
    try:
        page.goto(URL+f'maquete-liv-ipanema.html?backend={backend}&geometria={geometry}', timeout=120000)
        page.wait_for_function('window.__livViewer?.ready', timeout=120000)
        page.evaluate('async()=>{await __livTransfers.pause();}')
        frame = page.locator('#stage iframe').element_handle().content_frame()
        result['initial'] = frame.evaluate('''async()=>{
          const api=__livProva;await api.renderer.setAnimationLoop(null);
          window.__qaFrame=async()=>{await new Promise(requestAnimationFrame);return api.capture(false);};
          const lights=api.scene.children.filter(o=>o.isLight&&o.castShadow);
          window.__qaShadow={lights,updates:0};
          for(const light of lights){const original=light.shadow.updateMatrices.bind(light.shadow);
            light.shadow.updateMatrices=(...args)=>{__qaShadow.updates++;return original(...args);};}
          await __qaFrame();
          return {backend:api.backend,sourceModelSHA256:api.data.sourceModelSHA256,
            canvas:[api.renderer.domElement.width,api.renderer.domElement.height],
            lightCount:lights.length,automatic:lights.map(o=>o.shadow.autoUpdate)};
        }''')
        assert result['initial']['lightCount'] > 0
        assert not any(result['initial']['automatic']), 'Sombras estáticas ainda são recalculadas automaticamente.'
        if backend!='auto':assert result['initial']['backend']==backend
        prefix = f'{profile}-{geometry}'
        result['views'] = []
        for view in ['perspectiva', 'aerea', 'varandas', 'acesso', 'implantacao']:
            frame.evaluate('view=>__livProva.setView(view)', view)
            cached = capture(frame, output/f'{prefix}-{view}-cache.png')
            frame.evaluate('__qaShadow.lights.forEach(o=>o.shadow.autoUpdate=true)')
            reference = capture(frame, output/f'{prefix}-{view}-referencia.png')
            frame.evaluate('__qaShadow.lights.forEach(o=>o.shadow.autoUpdate=false)')
            delta = float(np.abs(cached-reference).max())
            assert delta <= 1, (view, delta)
            result['views'].append({'view':view, 'maxRgbDelta':delta})
        page.locator('[data-unit-side="lazer"]').click()
        page.locator('[data-unit-id]').first.click()
        selected = page.evaluate('__livViewer.selectedUnitId')
        assert selected and frame.evaluate('__livProva.getState().selectedUnitId')==selected
        cached = capture(frame, output/f'{prefix}-final-cache.png')
        frame.evaluate('__qaShadow.lights.forEach(o=>o.shadow.autoUpdate=true)')
        reference = capture(frame, output/f'{prefix}-final-referencia.png')
        frame.evaluate('__qaShadow.lights.forEach(o=>o.shadow.autoUpdate=false)')
        result['selection']={'id':selected,'maxRgbDelta':float(np.abs(cached-reference).max())}
        assert result['selection']['maxRgbDelta'] <= 1
        result['refresh'] = frame.evaluate('''async()=>{
          const api=__livProva,before=__qaShadow.updates;
          if(!api.invalidateShadows())throw Error('Sombra não foi invalidada.');
          const pending=__qaShadow.lights.every(o=>o.shadow.needsUpdate);
          await __qaFrame();const updates=__qaShadow.updates-before;
          await __qaFrame();return {pending,updates,repeatedUpdates:__qaShadow.updates-before-updates,
            settled:__qaShadow.lights.every(o=>!o.shadow.needsUpdate)};
        }''')
        assert result['refresh']['pending'] and result['refresh']['settled']
        assert result['refresh']['updates']>=result['initial']['lightCount'] and result['refresh']['repeatedUpdates']==0
        result['orbit'] = frame.evaluate('''async()=>{
          const api=__livProva, THREE=await import('three/webgpu'), rows=[],snapshot=api.getState();
          for(const automatic of [false,true]){
            api.restoreState(snapshot);__qaShadow.lights.forEach(o=>o.shadow.autoUpdate=automatic);await __qaFrame();
            const start=__qaShadow.updates,passes=api.renderer.info.render.calls;
            const initial=api.camera.position.clone(),target=api.controls.target.clone(),axis=new THREE.Vector3(0,1,0);
            for(let i=0;i<24;i++){
              api.camera.position.copy(initial).sub(target).applyAxisAngle(axis,i*.02).add(target);
              api.camera.lookAt(target);await __qaFrame();
            }
            rows.push({automatic,frames:24,shadowPasses:__qaShadow.updates-start,
              totalPasses:api.renderer.info.render.calls-passes,drawCallsLastFrame:api.renderer.info.render.drawCalls});
          }
          __qaShadow.lights.forEach(o=>o.shadow.autoUpdate=false);api.restoreState(snapshot);return rows;
        }''')
        cached, automatic = result['orbit']
        assert cached['shadowPasses']==0 and automatic['shadowPasses']>=automatic['frames']
        assert automatic['totalPasses']>=cached['totalPasses']+automatic['frames']
        result['disposed']=frame.evaluate('async()=>{await __livProva.dispose();return {disposed:__livProva.disposed,ready:__livProva.ready,sceneChildren:__livProva.scene.children.length,canInvalidate:__livProva.invalidateShadows()};}')
        assert result['disposed']=={'disposed':True,'ready':False,'sceneChildren':0,'canInvalidate':False}
        assert not result['errors'], result['errors']
        result['status']='PASS'
        return result
    finally:
        context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--perfil',choices=['todos',*PROFILES],default='todos')
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/sombras-exterior')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
      'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
        ['qa_sombras_exterior.py','renderer.js','material-rgbm.js','viewer.js','picking.js',
        'assets-prova/manifest.json','modelo/variante/assets/manifest.json',
        'ambiente.js','assets-ambiente/manifest.json','assets-ambiente/ambiente.f16.gz']},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True);report['browserVersion']=browser.version
            for profile in (PROFILES if args.perfil=='todos' else [args.perfil]):
                for geometry in ['base','contorno']:
                    result=case(browser,profile,geometry,args.saida,report['cases'])
                    print(f'{profile}/{geometry}: PASS',flush=True)
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':main()
