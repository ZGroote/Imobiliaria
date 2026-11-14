"""Filtro luminoso com oferta sintética apenas no navegador privado do ensaio."""
import argparse
import hashlib
import json
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_unidades import ready,child
from servidor_medido import MeasuredServer

EXP=Path(__file__).resolve().parent


def main(site,output):
    site=site.resolve();output.mkdir(parents=True,exist_ok=True)
    original=(site/'comercial.json').read_bytes()
    pilot=json.loads((site/'modelo/entrada/unidades-entrada.json').read_bytes())
    ids=[f'liv-ipanema/pavimento-modelo-{floor:02}/final-{final:02}'
         for floor in [2,5,8,11,14] for final in [2,4,6,8,10]]
    fixture={'schema':'liv-commercial-v1','status':'fornecido','bookSHA256':pilot['source']['bookSHA256'],
             'source':{'label':'DEMONSTRAÇÃO SINTÉTICA — SEM OFERTA REAL','asOf':'2026-10-11'},
             'units':[{'id':id_,'availability':'disponivel','priceCents':None,'commercialNumber':None} for id_ in ids]}
    report={'status':'RUNNING','recordedAt':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
            'syntheticCommercialOnly':True,'site':str(site),'sources':{
                name:hashlib.sha256((site/name).read_bytes()).hexdigest() for name in
                ['viewer.js','picking.js','renderer.js','disponibilidade.js','unit-ui.js','unit-ui.css','maquete-liv-ipanema.html']},'cases':[]}
    server=MeasuredServer(site).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            for backend,touch in [('webgpu',False),('webgl',False),('auto',True)]:
                context=browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},
                    is_mobile=touch,has_touch=touch,device_scale_factor=1)
                page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                payload={'data':json.loads(original),'status':200}
                page.route('**/comercial.json',lambda route:route.fulfill(status=payload['status'],
                    content_type='application/json',body=json.dumps(payload['data'])))
                page.goto(server.url.rstrip('/')+'/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend='+backend)
                ready(page);page.wait_for_function('__livViewer.commercialStatus==="ausente"')
                assert page.locator('#availabilityFilter').is_visible()
                page.locator('#availability').select_option('disponiveis')
                assert 'ainda não informada' in page.locator('#availabilitySummary').inner_text()
                assert child(page).evaluate('__livProva.unitPicking.availability.getState().active') is False
                payload['data']=fixture;assert page.evaluate('__livViewer.reloadCommercial()')
                assert page.evaluate('__livViewer.availableUnitCount')==25
                frame=child(page);assert frame.evaluate('__livProva.unitPicking.availability.getState().ids')==sorted(ids)
                lights=frame.evaluate('''()=>{const ids=[];__livProva.scene.traverse(o=>{if(o.isLight)ids.push(o.uuid);});return ids;}''')
                page.locator('#availability').select_option('todos')
                assert frame.evaluate('__livProva.unitPicking.availability.getState().active') is False
                page.locator('#availability').select_option('disponiveis')
                assert frame.evaluate('''()=>{const ids=[];__livProva.scene.traverse(o=>{if(o.isLight)ids.push(o.uuid);});return ids;}''')==lights
                assert frame.evaluate('__livProva.unitPicking.availability.group.children.length')==2
                builds=frame.evaluate('__livProva.unitPicking.availability.stats.geometryBuilds')
                page.locator('[data-view="varandas"]').click()
                assert frame.evaluate('__livProva.unitPicking.availability.stats.geometryBuilds')==builds
                page.locator('#stage').scroll_into_view_if_needed();page.wait_for_timeout(500)
                stage=page.locator('#stage').bounding_box();box=page.locator('#availabilityFilter').bounding_box()
                assert box['x']>=stage['x'] and box['x']+box['width']<=stage['x']+stage['width']
                assert page.locator('#availability').bounding_box()['height']>=44
                page.screenshot(path=str(output/f'{backend}-{touch}-disponiveis-demonstracao.png'))
                point=frame.evaluate('''()=>{
                  const p=__livProva,r=p.renderer.domElement.getBoundingClientRect();p.camera.updateMatrixWorld();
                  for(const id of p.unitPicking.availability.getState().ids){
                    const u=p.units.units.find(u=>u.id===id);if(u.floorIndex!==8)continue;
                    const v=p.camera.position.clone().fromArray(u.pickPoint).project(p.camera);
                    const x=r.left+(v.x+1)*r.width/2,y=r.top+(1-v.y)*r.height/2;
                    if(Math.abs(v.x)<.9&&Math.abs(v.y)<.9&&p.unitPicking.pick(x,y)===id)return {x,y,id};
                  }throw Error('Unidade disponível não visível.');
                }''')
                camera=frame.evaluate('__livProva.camera.position.toArray()');outer=page.locator('#stage iframe').bounding_box()
                if touch:page.touchscreen.tap(outer['x']+point['x'],outer['y']+point['y'])
                else:page.mouse.click(outer['x']+point['x'],outer['y']+point['y'])
                page.locator('#unitDetails').wait_for(state='visible')
                assert page.evaluate('__livViewer.selectedUnitId')==point['id']
                assert 'Disponível' in page.locator('#detailsBody').inner_text()
                assert frame.evaluate('__livProva.camera.position.toArray()')==camera
                page.locator('#closeDetails').click()
                sold=json.loads(json.dumps(fixture));next(u for u in sold['units'] if u['id']==point['id'])['availability']='vendida'
                payload['data']=sold;assert page.evaluate('__livViewer.reloadCommercial()')
                assert point['id'] not in frame.evaluate('__livProva.unitPicking.availability.getState().ids')
                assert page.evaluate('__livViewer.availableUnitCount')==24
                payload['status']=503;assert page.evaluate('__livViewer.reloadCommercial()') is False
                assert frame.evaluate('__livProva.unitPicking.availability.getState().active') is False
                payload['status']=200;assert page.evaluate('__livViewer.reloadCommercial()')
                assert len(frame.evaluate('__livProva.unitPicking.availability.getState().ids'))==24
                page.locator('[data-mode="planta2d"]').click();ready(page,'planta2d')
                assert page.locator('#availabilityFilter').is_hidden()
                page.locator('[data-mode="maquete"]').click();ready(page)
                assert len(child(page).evaluate('__livProva.unitPicking.availability.getState().ids'))==24
                payload['data']=json.loads(original);assert page.evaluate('__livViewer.reloadCommercial()')
                assert child(page).evaluate('__livProva.unitPicking.availability.getState().active') is False
                assert not errors,errors
                case={'status':'PASS','backendRequested':backend,'backendEffective':page.evaluate('__livViewer.backend'),
                      'touchEmulated':touch,'available':25,'soldRemoved':True,'failedRefreshClearsGlow':True,
                      'withdrawalClearsGlow':True,'actualFacadeClick':point['id'],'cameraUnchanged':True,
                      'twoOverlayDraws':True,'noDynamicLightsAdded':True,'noPerFrameGeometryBuilds':True,
                      'unknownNeverGlows':True,'modeReturnRestoresFilter':True,'mobileFilterFits':True,'errors':errors}
                report['cases'].append(case);context.close();print(json.dumps(case),flush=True)
            browser.close()
        assert (site/'comercial.json').read_bytes()==original
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=repr(error);raise
    finally:
        server.close();(output/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site',type=Path,default=EXP)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/disponibilidade-filtro')
    args=parser.parse_args();main(args.site,args.saida)
