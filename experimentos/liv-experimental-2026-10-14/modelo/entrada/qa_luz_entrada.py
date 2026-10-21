"""Qualifica o bake próprio da entrada no mesmo transporte do exterior integrado."""
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

HERE=Path(__file__).resolve().parent; EXP=HERE.parents[1]
URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/modelo/entrada/candidato/prova.html'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES={'webgpu':(1440,900,'webgpu'),'webgl':(1440,900,'webgl'),'toque':(390,844,'auto')}


def capture(page,path):
    encoded=page.evaluate('async()=>{await new Promise(requestAnimationFrame);return __livProva.capture(false);}')
    raw=base64.b64decode(encoded.split(',',1)[1]);path.write_bytes(raw)
    pixels=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'),dtype=np.float32)
    assert pixels.std()>3,'Imagem vazia.'
    return pixels


def context_for(browser,profile):
    width,height,backend=PROFILES[profile]
    return browser.new_context(viewport={'width':width,'height':height},device_scale_factor=3 if profile=='toque' else 1,
                               is_mobile=profile=='toque',has_touch=profile=='toque'),backend


def case(browser,profile,out,cases):
    context,backend=context_for(browser,profile);page=context.new_page()
    result={'profile':profile,'errors':[]};cases.append(result)
    page.on('pageerror',lambda error:result['errors'].append(str(error)))
    try:
        page.goto(URL+'?geometria=entrada&backend='+backend,timeout=120000)
        page.wait_for_function('()=>{const api=window.__livProva;if(api?.error)throw Error(api.error);return api?.ready;}',timeout=120000)
        result['initial']=page.evaluate('''async()=>{
          const api=__livProva;await api.renderer.setAnimationLoop(null);api.setView('acesso');
          const lights=api.scene.children.filter(o=>o.isLight&&o.castShadow);
          window.__qaEntryLights=lights;window.__qaEntryUpdates=0;
          for(const light of lights){const original=light.shadow.updateMatrices.bind(light.shadow);
            light.shadow.updateMatrices=(...args)=>{__qaEntryUpdates++;return original(...args);};}
          const counts=window.__qaEntryDisposed={geometry:0,material:0,atlas:0,environment:0};
          for(const g of new Set(api.meshes.map(o=>o.geometry)))g.addEventListener('dispose',()=>counts.geometry++);
          for(const m of api.materials)m.addEventListener('dispose',()=>counts.material++);
          api.atlas.addEventListener('dispose',()=>counts.atlas++);api.scene.environment.addEventListener('dispose',()=>counts.environment++);
          return {backend:api.backend,sourceModelSHA256:api.data.sourceModelSHA256,atlasSHA256:api.data.rgbm.textureSHA256,
            canvas:[api.renderer.domElement.width,api.renderer.domElement.height],meshCount:api.meshes.length,
            environmentProfile:api.environmentProfile,environmentFallbackError:api.environmentFallbackError,
            automatic:lights.map(o=>o.shadow.autoUpdate),units:api.units,
            materials:api.materials.filter(m=>m.name.startsWith('MAT-entrada-')).map(m=>({name:m.name,type:m.type,
              node:!!m.isNodeMaterial,baked:m.userData.livBakedTransport,color:m.color.toArray(),roughness:m.roughness,
              metalness:m.metalness,emissive:m.emissive.toArray(),emissiveIntensity:m.emissiveIntensity}))};}''')
        initial=result['initial'];manifest=json.loads((HERE/'candidato/assets/manifest.json').read_bytes())
        assert initial['sourceModelSHA256']==manifest['sourceModelSHA256'] and initial['meshCount']==manifest['meshCount']
        assert initial['atlasSHA256']==json.loads((HERE/'candidato/luz/manifest.json').read_bytes())['textureSHA256']
        assert initial['environmentProfile']=='precalculado' and not initial.get('environmentFallbackError')
        assert initial['units'] is None and initial['automatic'] and not any(initial['automatic'])
        if backend!='auto':assert initial['backend']==backend
        import gzip
        specs={m['name']:m for m in json.loads(gzip.decompress((HERE/'candidato/assets/scene.json.gz').read_bytes()))['materials']}
        assert len(initial['materials'])==4
        for material in initial['materials']:
            source=specs[material['name']]
            for key in ['color','roughness','metalness','emissive','emissiveIntensity']:assert np.allclose(material[key],source[key]),(material,key)
            assert material['baked']==source['baked'] and material['node']==source['baked']
        glass=next(m for m in initial['materials'] if m['name']=='MAT-entrada-vidro')
        assert glass['type']=='MeshStandardMaterial' and not glass['node']
        result['framing']=[]
        for width,height in [(320,568),(390,844),(844,390),(768,1024),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            framing=page.evaluate('''async()=>{
              await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
              const api=__livProva,THREE=await import('three/webgpu');api.setView('acesso');
              const b=api.extraViewBounds.acesso,projected=[];
              for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){
                const p=new THREE.Vector3(x,y,z).project(api.camera);projected.push(p.toArray());}
              return {bounds:b,projected};}''')
            assert len(framing['projected'])==8 and all(abs(p[0])<1 and abs(p[1])<1 and -1<p[2]<1 for p in framing['projected']),framing
            result['framing'].append({'viewport':[width,height],**framing})
        width,height,_=PROFILES[profile];page.set_viewport_size({'width':width,'height':height})
        page.evaluate('async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);__livProva.setView("acesso");}')
        result['views']=[]
        for view in ['acesso','implantacao','perspectiva']:
            page.locator(f'[data-view="{view}"]').click()
            assert page.evaluate('__livProva.activeView')==view
            cached=capture(page,out/f'{profile}-{view}.png')
            page.locator('#stage').screenshot(path=out/f'{profile}-{view}-ui.png')
            page.evaluate('__qaEntryLights.forEach(o=>o.shadow.autoUpdate=true)')
            recalculated=capture(page,out/f'{profile}-{view}-recalculada.png')
            page.evaluate('__qaEntryLights.forEach(o=>o.shadow.autoUpdate=false)')
            delta=float(np.abs(cached-recalculated).max());assert delta<=1,(view,delta)
            result['views'].append({'view':view,'maxRgbDelta':delta})
        result['orbit']=page.evaluate('''async()=>{
          const api=__livProva,THREE=await import('three/webgpu');api.setView('acesso');
          const start=__qaEntryUpdates,initial=api.camera.position.clone(),target=api.controls.target.clone();
          for(let i=0;i<24;i++){api.camera.position.copy(initial).sub(target).applyAxisAngle(new THREE.Vector3(0,1,0),i*.01).add(target);
            api.camera.lookAt(target);await new Promise(requestAnimationFrame);await api.capture(false);}
          return {frames:24,shadowPasses:__qaEntryUpdates-start};}''')
        assert result['orbit']['shadowPasses']==0
        page.evaluate('__livProva.setView("acesso")');box=page.locator('#c').bounding_box()
        before=page.evaluate('__livProva.camera.position.toArray()')
        if profile=='toque':
            session=context.new_cdp_session(page)
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']*.5,'y':box['y']+box['height']*.5}]})
            for step in range(1,9):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+box['width']*(.5+step*.02),'y':box['y']+box['height']*.5}]})
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()
        else:
            page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down()
            page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.5,steps=8);page.mouse.up()
        page.evaluate('__livProva.controls.update()');capture(page,out/f'{profile}-gesto.png')
        result['gesture']={'kind':'touch' if profile=='toque' else 'mouse','positionChanged':page.evaluate('__livProva.camera.position.toArray()')!=before}
        assert result['gesture']['positionChanged']
        result['disposed']=page.evaluate('''async()=>{await __livProva.dispose();await __livProva.dispose();
          return {disposed:__livProva.disposed,ready:__livProva.ready,children:__livProva.scene.children.length,
            counts:__qaEntryDisposed,cleanupError:__livProva.cleanupError,canInvalidate:__livProva.invalidateShadows()};}''')
        disposed=result['disposed'];assert disposed['disposed'] and not disposed['ready'] and disposed['children']==0
        assert disposed['counts']['atlas']==disposed['counts']['environment']==1 and disposed['counts']['geometry']>0 and disposed['counts']['material']>0
        assert not disposed.get('cleanupError') and not disposed['canInvalidate'] and not result['errors'],result
        result['status']='PASS'
    finally:context.close()


def rejection(browser,kind):
    context,backend=context_for(browser,'webgpu');page=context.new_page();downloads=[];errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:downloads.append(request.url))
    query='?geometria=entrada&backend='+backend
    if kind=='catalog':
        query+='&selecao=piloto'
        catalog=json.loads((HERE/'unidades-entrada.json').read_bytes())
        catalog['sourceModelSHA256']='0'*64
        page.route('**/modelo/entrada/unidades-entrada.json',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(catalog)))
    else:
        manifest=json.loads((HERE/'candidato/assets/manifest.json').read_bytes())
        manifest['sourceModelSHA256']='0'*64
        page.route('**/modelo/entrada/candidato/assets/manifest.json*',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(manifest)))
    try:
        page.goto(URL+query,timeout=120000);page.wait_for_function('window.__livProva?.error',timeout=120000)
        page.wait_for_function('!__livProva.renderer||__livProva.disposed',timeout=10000)
        result=page.evaluate('({error:__livProva.error,ready:__livProva.ready,disposed:__livProva.disposed,retry:document.querySelector("#retry").href})')
        assert not result['ready'] and page.locator('#failure').is_visible()
        assert 'geometria=entrada' in result['retry'] and 'backend=webgl' in result['retry']
        if kind=='catalog':
            assert 'finais pertencem a outra edição' in result['error'] and result['disposed']
            assert page.evaluate('__livProva.scene.children.length===0&&!__livProva.unitPicking')
        else:
            assert 'mesma edição' in result['error'] and result['disposed']
            assert not any('/candidato/assets/irradiance' in url for url in downloads)
        assert not errors,errors
        return {'kind':kind,**result,'status':'PASS'}
    finally:context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,required=True)
    args=parser.parse_args();out=args.saida;out.mkdir(parents=True,exist_ok=True)
    names=['renderer.js','ambiente.js','assets-ambiente/manifest.json','material-rgbm.js','cameras.js','edicoes.js','unidades.js',
           'modelo/entrada/unidades-entrada.json',
           'modelo/entrada/qa_luz_entrada.py','modelo/entrada/candidato/prova.html',
           'modelo/entrada/candidato/assets/manifest.json','modelo/entrada/candidato/luz/manifest.json']
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
            'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in names},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True);report['browserVersion']=browser.version
            for profile in PROFILES:case(browser,profile,out,report['cases']);print(profile+': PASS',flush=True)
            report['rejections']=[rejection(browser,kind) for kind in ['catalog','edition']]
            browser.close()
        report['status']='PASS'
    except Exception as error:report['status']='FAIL';report['failure']=str(error);raise
    finally:(out/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':main()
