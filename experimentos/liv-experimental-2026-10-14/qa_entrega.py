"""Verifica exclusivamente os bytes empacotados, em servidor próprio de loopback."""
import argparse
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from PIL import Image
from playwright.sync_api import sync_playwright
from montar_entrega import verify
from servidor_medido import MeasuredServer
from qa_unidades import ready, child

EXP=Path(__file__).resolve().parent


def save(output,report):
    (output/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')


def click_facade(page,touch,floor,screenshot=None):
    frame=child(page)
    point=frame.evaluate('''floor=>{
      const p=__livProva,rect=p.renderer.domElement.getBoundingClientRect();p.camera.updateMatrixWorld();
      for(const u of p.units.units.filter(u=>u.floorIndex===floor)){
        const a=u.bounds.min,b=u.bounds.max,v=p.camera.position.clone().fromArray(u.pickPoint??[(a[0]+b[0])/2,(a[1]+b[1])/2,u.side==='lazer'?b[2]:a[2]]).project(p.camera);
        if(Math.abs(v.x)>.95||Math.abs(v.y)>.95)continue;
        const x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2;
        if(p.unitPicking.pick(x,y)===u.id)return {x,y,id:u.id,floor:u.floorIndex};
      }throw Error('Nenhum apartamento visível para o clique de teste.');
    }''',floor)
    box=page.locator('#stage iframe:not([hidden])').bounding_box();x,y=box['x']+point['x'],box['y']+point['y']
    before=frame.evaluate('({position:__livProva.camera.position.toArray(),target:__livProva.controls.target.toArray()})')
    if touch:page.touchscreen.tap(x,y)
    else:page.mouse.click(x,y)
    page.locator('#unitDetails').wait_for(state='visible')
    assert page.evaluate('__livViewer.selectedUnitId')==point['id']
    assert page.evaluate('__livViewer.floor')==floor
    assert page.locator('#floor').input_value()==str(floor)
    assert frame.evaluate('__livProva.unitPicking.getState().active')
    assert frame.evaluate('__livProva.camera.position.toArray()')==before['position']
    assert frame.evaluate('__livProva.controls.target.toArray()')==before['target']
    if screenshot:page.screenshot(path=str(screenshot))
    page.locator('#closeDetails').click();assert page.locator('#unitDetails').is_hidden()
    return {'id':point['id'],'floor':floor,'dialog':True,'cameraUnchanged':True,'touch':touch}


def main(package,output):
    package=package.resolve();output.mkdir(parents=True,exist_ok=True);site=package/'site'
    manifest=json.loads((site/'entrega-manifest.json').read_bytes())
    verify(site,manifest['files'],manifest=True);verify(package/'revisao',manifest['reviewFiles'])
    for name,record in manifest['configFiles'].items():
        raw=(package/name).read_bytes();assert len(raw)==record['bytes'] and hashlib.sha256(raw).hexdigest()==record['sha256']
    canonical=json.dumps({'site':manifest['files'],'review':manifest['reviewFiles'],'config':manifest['configFiles']},sort_keys=True,separators=(',',':')).encode()
    assert hashlib.sha256(canonical).hexdigest()==manifest['version']
    assert not manifest['published'] and not manifest['physicalMobileQualified']
    report={'status':'RUNNING','recordedAt':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
            'packageVersion':manifest['version'],'packageDirectory':str(package),'packageManifestSHA256':hashlib.sha256((site/'entrega-manifest.json').read_bytes()).hexdigest(),
            'recipeSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':[]}
    server=MeasuredServer(site).start();base=server.url.rstrip('/')
    browser=None
    try:
        # Real HTTP coverage of every runtime resource, independent of development.
        for name,expected in manifest['files'].items():
            with urllib.request.urlopen(base+'/'+quote(name),timeout=30) as response:
                assert response.status==200;data=response.read()
            assert len(data)==expected['bytes'] and hashlib.sha256(data).hexdigest()==expected['sha256'],name
        report['httpVerifiedFiles']=len(manifest['files']);save(output,report)
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            try:
                for backend,touch in [('webgpu',False),('webgl',False),('auto',True)]:
                    case={'backendRequested':backend,'touchEmulated':touch,'errors':[],'httpFailures':[],'externalRequests':[]}
                    report['cases'].append(case)
                    context=browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},
                                               is_mobile=touch,has_touch=touch,device_scale_factor=1,accept_downloads=True)
                    page=context.new_page();page.on('pageerror',lambda error:case['errors'].append(str(error)))
                    page.on('response',lambda response:case['httpFailures'].append([response.url,response.status]) if response.status>=400 else None)
                    page.on('request',lambda request:case['externalRequests'].append(request.url) if not request.url.startswith((base,'blob:','data:')) else None)
                    page.goto(base+'/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend='+backend);ready(page)
                    page.wait_for_function('__livViewer.commercialStatus==="ausente"&&__livViewer.relationStatus==="ausente"',timeout=30000)
                    assert page.evaluate('__livViewer.units.units.length')==170
                    assert page.evaluate('__livViewer.units.units.every(u=>!u.relation&&u.typology===null&&u.commercial.priceCents===null)')
                    case['backendEffective']=page.evaluate('__livViewer.backend')
                    if backend!='auto':assert case['backendEffective']==backend
                    assert page.evaluate('__livViewer.floor')==-1
                    case['directFacadeClicks']=[click_facade(page,touch,8,output/f'{backend}-{touch}-clique-fachada.png'),click_facade(page,touch,12)]
                    page.locator('#floor').select_option('-1')
                    page.locator('[data-view="implantacao"]').click()
                    assert child(page).evaluate('''()=>{let extra=false;__livProva.scene.traverse(o=>{if(o.name==='liv-parcela-contexto')extra=true;});return !extra;}''')
                    page.wait_for_timeout(400)
                    page.screenshot(path=str(output/f'{backend}-{touch}-implantacao.png'))
                    case['noArtificialParcelFill']=True
                    assert page.locator('#buildingMirror,#unitList,#unitCard').count()==0
                    page.evaluate('''__livViewer.selectUnit('liv-ipanema/pavimento-modelo-08/final-06',{showInformation:true})''')
                    selected=page.evaluate('__livViewer.selectedUnitId');assert selected.endswith('/final-06')
                    assert page.locator('#unitDetails').is_visible()
                    page.keyboard.press('Escape');assert page.locator('#unitDetails').is_hidden()
                    assert page.evaluate('__livViewer.floor')==8
                    assert child(page).evaluate('__livProva.unitPicking.getState().active')
                    case['facadeBounds']=child(page).evaluate('''()=>{
                      const p=__livProva,b=p.facadeBounds;p.camera.updateMatrixWorld();
                      for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){
                        const point=p.camera.position.clone().set(x,y,z).project(p.camera);
                        if(Math.abs(point.x)>.99||Math.abs(point.y)>.99)throw Error('Cobertura/torre fora do quadro.');
                      }return b;
                    }''')
                    page.locator('#ambience').select_option('entardecer');assert child(page).evaluate('__livProva.ambience')=='entardecer'
                    with page.expect_download(timeout=15000) as download:page.locator('#capture').click()
                    path=output/f'{backend}-{touch}-captura.png';download.value.save_as(path)
                    with Image.open(path) as image:assert image.format=='PNG' and min(image.size)>100;case['pngSize']=image.size
                    for typology in ['canto','meio']:
                        page.evaluate('id=>__livViewer.setTypology(id)',typology)
                        for mode in ['planta2d','planta3d','visita','maquete']:
                            page.locator(f'[data-mode="{mode}"]').click();ready(page,mode)
                            assert page.evaluate('__livViewer.selectedUnitId')==selected
                            if mode=='planta2d':assert f'plantas2d/{typology}.jpg' in page.locator('#stage img').get_attribute('src')
                            if mode=='visita':
                                walked=child(page).evaluate('''async()=>{
                                  const p=__livInterior,start=p.camera.position.clone();
                                  const route=p.getRoomRoutes().filter(r=>r.reachable).sort((a,b)=>b.path.length-a.path.length)[0];
                                  await p.goToRoom(route.id);return start.distanceTo(p.camera.position);
                                }''');assert walked>.05,(typology,walked)
                            if mode=='maquete':assert child(page).evaluate('__livProva.ambience')=='entardecer'
                    page.reload();ready(page);assert page.evaluate('__livViewer.selectedUnitId')==selected
                    assert page.evaluate('__livViewer.ambience')=='entardecer'
                    page.locator('.map-link').click();page.wait_for_function('window.__livMapAdapter?.ready',timeout=150000)
                    wrapper=page.locator('#mapPanel iframe').element_handle().content_frame()
                    map_frame=wrapper.locator('#map').element_handle().content_frame()
                    map_frame.wait_for_function('''window.__int?.exteriors&&(()=>{const s=__int.exteriors.stats();
                      return s.loadedTiles>0&&s.pendingTiles===0&&s.placedYards>0&&s.tileErrors===0;})()''',timeout=120000)
                    case['mapTiles']=map_frame.evaluate('__int.exteriors.stats()')
                    metadata=page.evaluate('__livMapAdapter.model');assert metadata['edition']=='entrada' and metadata['geometryVerified']
                    return_url=page.evaluate('__livMapAdapter.returnURL');assert 'unidades=edificio' in return_url and 'luz=entardecer' in return_url
                    page.locator('#closeMap').click();ready(page);assert page.evaluate('__livViewer.selectedUnitId')==selected
                    page.screenshot(path=str(output/f'{backend}-{touch}-pagina.png'),full_page=not touch)
                    assert page.locator('#stage iframe:not([hidden])').count()==1
                    assert page.locator('#stage iframe').count()<=3
                    assert not case['errors'] and not case['httpFailures'] and not case['externalRequests'],case
                    case.update(status='PASS',positions=170,twoTypologiesFourModes=True,png=True,mapReturn=True,sceneIframes=1)
                    context.close();save(output,report);print(json.dumps(case,ensure_ascii=False),flush=True)

                # Sample and real preserved Draco GLB use the packaged stock path.
                context=browser.new_context(viewport={'width':1280,'height':800});page=context.new_page()
                page.goto(base+'/materiais.html?backend=webgl')
                page.wait_for_function('window.__livMaterials?.ready&&!__livMaterials.busy',timeout=120000)
                assert page.evaluate('__livMaterials.report.compatible')
                page.locator('#files').set_input_files(str(site/'site-baseline/liv-ipanema.glb'))
                page.wait_for_function('!__livMaterials.busy&&(__livMaterials.ready||__livMaterials.lastLoadError)',timeout=120000)
                assert not page.evaluate('__livMaterials.lastLoadError')
                assert page.evaluate('__livMaterials.report.compatible')
                report['packagedPbrAndDraco']='PASS';context.close();save(output,report)

                # Reopen the actual baseline as a functioning recovery, beyond SHA.
                context=browser.new_context(viewport={'width':1280,'height':800});page=context.new_page()
                page.goto(base+'/site-baseline/maquete-liv-ipanema.html',timeout=120000)
                page.wait_for_function('window.__maq&&window.__livLightmap?.ready',timeout=120000)
                assert page.locator('canvas').count()>0
                report['baselineRecovery']='PASS';context.close();save(output,report)

                context=browser.new_context(viewport={'width':1280,'height':900},accept_downloads=True);page=context.new_page()
                page.goto(base+'/diagnostico.html');page.locator('#device').fill('Empacotamento QA — desktop')
                page.locator('#physical').select_option('desktop');page.locator('#backend').select_option('webgl');page.locator('#open').click()
                page.wait_for_function('__livDiagnostic.openings.at(-1)?.status==="carregado"',timeout=150000)
                page.locator('#segment').select_option('meio:visita');page.locator('#start').click()
                page.wait_for_function('!document.getElementById("stop").disabled',timeout=150000)
                page.evaluate('''async()=>{const p=document.querySelector('iframe').contentWindow.__livViewer.frame.contentWindow.__livInterior;
                  await p.goToRoom(p.getRoomRoutes().filter(r=>r.reachable).sort((a,b)=>b.path.length-a.path.length)[0].id);}''')
                page.wait_for_timeout(1200);page.locator('#stop').click()
                with page.expect_download() as download:page.locator('#export').click()
                path=output/'diagnostico-empacotado.json';download.value.save_as(path);data=json.loads(path.read_bytes())
                assert data['qualification']=='pendente-de-revisao' and data['segments'][0]['physicalDevice'] is False
                assert data['segments'][0]['measurement']['cameraDisplacementMeters']>.05
                assert not data['segments'][0]['interrupted'];report['packagedDiagnostic']='PASS';context.close();save(output,report)

                context=browser.new_context(viewport={'width':390,'height':844})
                context.add_init_script("Object.defineProperty(navigator,'gpu',{get:()=>undefined});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl'||t==='webgl2'?null:get.call(this,t,...a);};")
                page=context.new_page();page.goto(base+'/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio')
                page.wait_for_function('window.__livViewer?.error',timeout=120000);page.locator('#fallback').click();ready(page,'planta2d')
                assert page.locator('#stage img').is_visible();report['noGpu2DRecovery']='PASS';context.close()
            finally:browser.close();browser=None
        report['status']='PASS'
    except Exception as error:report['status']='FAIL';report['failure']=repr(error);raise
    finally:server.close();save(output,report)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pacote',type=Path,default=EXP/'entregas/liv-avaliacao-20261011-v4')
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/entrega-fachada-final')
    args=parser.parse_args();main(args.pacote,args.saida)
