"""Qualifica a comparação da forma da entrada no renderer nativo, sem bake novo."""
import argparse
import base64
import hashlib
import io
import json
from datetime import datetime,timezone
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent;EXP=HERE.parents[1]
URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/modelo/entrada/comparacao.html'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES={'webgpu':(1440,900,'webgpu'),'webgl':(1440,900,'webgl'),'toque':(390,844,'auto')}


def capture(page,path):
    data=page.evaluate('async()=>{await new Promise(requestAnimationFrame);return __livEntryStudy.capture(false);}')
    raw=base64.b64decode(data.split(',',1)[1]);path.write_bytes(raw)
    image=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
    assert image.std()>3,'Imagem vazia.'
    return image


def case(browser,profile,out):
    width,height,backend=PROFILES[profile]
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=3 if profile=='toque' else 1,
                               is_mobile=profile=='toque',has_touch=profile=='toque')
    page=context.new_page();result={'profile':profile,'errors':[],'views':[]}
    page.on('pageerror',lambda error:result['errors'].append(str(error)))
    try:
        page.goto(URL+'?backend='+backend,timeout=120000)
        page.wait_for_function('()=>{if(__livEntryStudy.error)throw Error(__livEntryStudy.error);return __livEntryStudy.ready;}',timeout=120000)
        initial=page.evaluate('''async()=>{const api=__livEntryStudy;await api.renderer.setAnimationLoop(null);
          return {backend:api.backend,model:api.model,loadedSHA256:api.loadedSHA256,materialReport:api.materialReport,
            canvas:[api.renderer.domElement.width,api.renderer.domElement.height],memory:{...api.renderer.info.memory},
            environmentFallbackError:api.environmentFallbackError};}''')
        result['initial']=initial
        assert initial['model']=='candidato' and initial['materialReport']['compatible']
        assert not initial.get('environmentFallbackError'),initial
        if backend!='auto':assert initial['backend']==backend
        assert all(not m['nodeMaterial'] and m['convertedBy'] for m in initial['materialReport']['materials'])
        for view in ['entrada','aerea']:
            page.select_option('#view',view)
            revised=capture(page,out/f'{profile}-{view}-revisada.png')
            page.locator('#stage').screenshot(path=out/f'{profile}-{view}-revisada-ui.png')
            page.locator('[data-model="original"]').click()
            page.wait_for_function('__livEntryStudy.ready&&__livEntryStudy.model==="original"',timeout=120000)
            original=capture(page,out/f'{profile}-{view}-anterior.png')
            page.locator('#stage').screenshot(path=out/f'{profile}-{view}-anterior-ui.png')
            assert original.shape==revised.shape
            difference=float(np.abs(original.astype('float32')-revised.astype('float32')).mean())
            assert difference>.05,'O botão não alterou o modelo.'
            page.locator('[data-model="candidato"]').click()
            page.wait_for_function('__livEntryStudy.ready&&__livEntryStudy.model==="candidato"',timeout=120000)
            result['views'].append({'view':view,'meanPixelChange':difference})
        result['serialization']=page.evaluate('''async()=>{const api=__livEntryStudy,first=api.show('original');
          const ignored=await api.show('candidato');await first;await api.show('candidato');
          return {ignored,model:api.model,assetsInScene:api.scene.children.filter(o=>o===api.asset.scene).length,
            memory:{...api.renderer.info.memory},lastDispose:api.lastDispose};}''')
        assert result['serialization']['ignored'] is False and result['serialization']['model']=='candidato'
        assert result['serialization']['assetsInScene']==1
        memory=result['serialization']['memory']
        # Renderer-owned attributes/uniform pools settle after the first swaps.
        # Count live model resources and bound allocations instead of requiring
        # the transient compile-time buffer pool to remain identical.
        assert all(memory[key]==initial['memory'][key] for key in ['geometries','textures','renderTargets']),memory
        assert memory['total']<=initial['memory']['total'],(initial['memory'],memory)
        assert result['serialization']['lastDispose']['geometries']>0
        # Failed candidate must retain the old scene, then recover after removing
        # the fault. Identity is checked before any replacement of the live GLB.
        page.evaluate('async()=>{await __livEntryStudy.show("original");}')
        manifest=json.loads((HERE/'manifest.json').read_bytes());record=manifest['files']['candidato']
        pattern='**/modelo/entrada/candidato/liv-contorno.glb*'
        page.route(pattern,lambda route:route.fulfill(status=200,body=bytes(record['bytes'])))
        result['rejection']=page.evaluate('''async()=>{try{await __livEntryStudy.show('candidato');}catch{}
          return {model:__livEntryStudy.model,ready:__livEntryStudy.ready,error:__livEntryStudy.error};}''')
        assert result['rejection']['model']=='original' and result['rejection']['ready'] and result['rejection']['error']
        page.unroute(pattern);page.evaluate('async()=>{await __livEntryStudy.show("candidato");}')
        assert page.evaluate('__livEntryStudy.ready&&!__livEntryStudy.error')
        page.select_option('#view','entrada')
        stage=page.locator('#canvas');box=stage.bounding_box()
        before=page.evaluate('__livEntryStudy.camera.position.toArray()')
        if profile=='toque':
            session=context.new_cdp_session(page)
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']*.5,'y':box['y']+box['height']*.5}]})
            for step in range(1,9):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+box['width']*(.5+step*.02),'y':box['y']+box['height']*.5}]})
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()
        else:
            page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down()
            page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.5,steps=8);page.mouse.up()
        page.evaluate('__livEntryStudy.controls.update()');capture(page,out/f'{profile}-orbita.png')
        result['gesture']={'kind':'touch' if profile=='toque' else 'mouse','positionChanged':page.evaluate('__livEntryStudy.camera.position.toArray()')!=before}
        assert result['gesture']['positionChanged']
        result['disposed']=page.evaluate('''async()=>{await __livEntryStudy.dispose();await __livEntryStudy.dispose();
          return {disposed:__livEntryStudy.disposed,ready:__livEntryStudy.ready,
            children:__livEntryStudy.scene.children.length,counts:__livEntryStudy.finalDispose};}''')
        assert result['disposed']['disposed'] and not result['disposed']['ready'] and result['disposed']['children']==0
        assert result['disposed']['counts']['geometries']>0 and not result['errors'],result
        result['status']='PASS';return result
    finally:context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,required=True)
    args=parser.parse_args();out=args.saida;out.mkdir(parents=True,exist_ok=True)
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
      'presentation':'GLB/PBR nas duas edições; sem bake da entrada nova; não é comparação de luz com o render oficial',
      'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
        ['modelo/entrada/qa_entrada.py','modelo/entrada/comparacao.html','modelo/entrada/comparacao.js','modelo/entrada/manifest.json',
         'modelo/entrada/candidato/liv-contorno.glb','modelo/variante/liv-contorno.glb','asset-loader.js','materials.js','ambiente.js']},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True);report['browserVersion']=browser.version
            for profile in PROFILES:
                report['cases'].append(case(browser,profile,out));print(f'{profile}: PASS',flush=True)
            browser.close()
        report['status']='PASS'
    except Exception as error:report['status']='FAIL';report['failure']=str(error);raise
    finally:(out/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':main()
