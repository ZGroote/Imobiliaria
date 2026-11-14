"""Confere o cadastro aleatório real do emulador e a maquete ligada a ele."""
import argparse
import hashlib
import json
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_unidades import ready,child
from qa_estoque_admin import edit_unit

EXP=Path(__file__).resolve().parent
BASE='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
PID='liv-demo-disponibilidade'


def main(url,output):
    output.mkdir(parents=True,exist_ok=True)
    distribution=json.loads((EXP/'evidencias/demo-disponibilidade/distribuicao.json').read_bytes())
    assert distribution['counts']['vendida']==136 and distribution['counts']['disponivel']==34
    report={'status':'RUNNING','syntheticOnly':True,'physicalMobile':False,'project':'demo-painel',
            'propertyId':PID,'recordedAt':datetime.now(timezone.utc).isoformat(),'cases':[]}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
        errors=[];changed_key=None;admin=None
        try:
            context=browser.new_context(viewport={'width':1440,'height':900});admin=context.new_page()
            admin.on('pageerror',lambda e:errors.append(str(e)))
            admin.goto('http://127.0.0.1:3017/login')
            admin.wait_for_function('''()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Operador · Operador');return b&&Object.keys(b).some(k=>k.startsWith('__reactProps')&&b[k]?.onClick);}''')
            admin.get_by_role('button',name='Operador · Operador',exact=True).click();admin.wait_for_url('**/admin')
            admin.goto('http://127.0.0.1:3017/admin/properties/units?id='+PID)
            admin.get_by_text('170 unidades cadastradas · 34 disponíveis · 136 vendidas',exact=False).wait_for()
            admin.screenshot(path=str(output/'painel-136-ocupados-34-disponiveis.png'))
            for backend,touch in [('webgpu',False),('webgl',False),('auto',True)]:
                c=browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},is_mobile=touch,has_touch=touch)
                page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(url+'?geometria=entrada&unidades=edificio&demonstracao=1&backend='+backend)
                ready(page);page.wait_for_function('__livViewer.stockStatus==="ao-vivo"&&__livViewer.availableUnitCount===34')
                assert page.locator('#unitList,#unitCard,#buildingMirror').count()==0
                assert page.locator('#demonstrationNote').is_visible()
                page.locator('#availability').select_option('disponiveis')
                assert child(page).evaluate('__livProva.unitPicking.availability.getState().ids')==distribution['availableTechnicalIds']
                assert page.evaluate('__livViewer.units.units.filter(u=>u.commercial.availability==="vendida").length')==136
                for side in ['estacionamento','lazer']:
                    page.evaluate('side=>__livViewer.showUnitSide(side,1)',side);page.locator('#floor').select_option('-1')
                    page.locator('#stage').scroll_into_view_if_needed();page.wait_for_timeout(300)
                    page.screenshot(path=str(output/f'{backend}-{touch}-{side}.png'))
                frame=child(page)
                point=frame.evaluate('''()=>{
                  const p=__livProva,r=p.renderer.domElement.getBoundingClientRect();p.camera.updateMatrixWorld();
                  for(const id of p.unitPicking.availability.getState().ids){
                    const u=p.units.units.find(u=>u.id===id);const v=p.camera.position.clone().fromArray(u.pickPoint).project(p.camera);
                    const x=r.left+(v.x+1)*r.width/2,y=r.top+(1-v.y)*r.height/2;
                    if(Math.abs(v.x)<.85&&Math.abs(v.y)<.6&&p.unitPicking.pick(x,y)===id)return {x,y,id,floor:u.floorIndex,final:u.final};
                  }throw Error('Disponível visível não encontrado.');
                }''')
                box=page.locator('#stage iframe').bounding_box();camera=frame.evaluate('__livProva.camera.position.toArray()')
                if touch:page.touchscreen.tap(box['x']+point['x'],box['y']+point['y'])
                else:page.mouse.click(box['x']+point['x'],box['y']+point['y'])
                page.locator('#unitDetails').wait_for(state='visible')
                assert 'Disponível' in page.locator('#unitSale').inner_text()
                assert 'Dado fictício' in page.locator('#detailsBody').inner_text()
                assert frame.evaluate('__livProva.camera.position.toArray()')==camera
                assert page.locator('#unitSale').count()==1
                if backend=='webgpu':
                    key=f'p{point["floor"]:02}-f{int(point["final"]):02}'
                    edit_unit(admin,key,'vendida');changed_key=key
                    page.wait_for_function('__livViewer.glowingUnitIds.length===33')
                    assert point['id'] not in frame.evaluate('__livProva.unitPicking.availability.getState().ids')
                    assert 'Vendida' in page.locator('#unitSale').inner_text()
                    edit_unit(admin,key,'disponivel');changed_key=None
                    page.wait_for_function('__livViewer.glowingUnitIds.length===34')
                page.locator('#closeDetails').click();assert page.locator('#unitDetails').is_hidden()
                page.locator('#availability').select_option('todos')
                assert frame.evaluate('__livProva.unitPicking.availability.getState().active') is False
                page.locator('#availability').select_option('disponiveis')
                assert len(frame.evaluate('__livProva.unitPicking.availability.getState().ids'))==34
                report['cases'].append({'backend':backend,'touchEmulated':touch,'sold':136,'available':34,
                    'allAvailableHighlightedAcrossAllFloors':True,'bothSides':True,'redundantBlocksAbsent':True,
                    'facadeClick':point['id'],'singleDialog':True,'cameraPreserved':True,'status':'PASS'})
                print(json.dumps(report['cases'][-1]),flush=True);c.close()
            assert not errors,errors
            report.update(status='PASS',errors=errors,liveAdminSaleAndRestore=True)
        except Exception as error:
            report.update(status='FAIL',failure=repr(error),errors=errors);raise
        finally:
            if changed_key and admin:edit_unit(admin,changed_key,'disponivel')
            browser.close();(output/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default=BASE+'maquete-liv-ipanema.html')
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/demo-disponibilidade')
    args=parser.parse_args();main(args.url,args.saida)
