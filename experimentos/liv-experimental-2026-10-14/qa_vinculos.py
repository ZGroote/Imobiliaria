"""Associações sintéticas isoladas; nenhum final real recebe uma tipologia inventada."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_unidades import ready, child

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html'


def main(output):
    output.mkdir(parents=True,exist_ok=True)
    paths=['vinculos.js','vinculos.json','viewer.js','unit-ui.js','maquete-liv-ipanema.html','qa_vinculos.py','interiores/catalogo.json']
    actual=(EXP/'vinculos.json').read_bytes();interiors=json.loads((EXP/'interiores/catalogo.json').read_bytes())
    pilot=json.loads((EXP/'modelo/entrada/unidades-entrada.json').read_bytes())
    fixture={'schema':'liv-unit-relations-v1','status':'fornecido','source':{'label':'FIXTURE SINTÉTICA — SEM VÍNCULO REAL','asOf':'2026-10-11'},
             'bookSHA256':pilot['source']['bookSHA256'],'units':[]}
    for floor,final,typology in [(4,'03','canto'),(8,'07','meio')]:
        data=interiors['tipologias'][typology]
        fixture['units'].append({'id':f'liv-ipanema/pavimento-modelo-{floor:02d}/final-{final}','typology':typology,'orientation':'original',
            'interiorUnitSHA256':data['unitSHA256'],'interiorSourceSHA256':data['sourceSHA256'],
            'planSHA256':hashlib.sha256((EXP/f'plantas2d/{typology}.jpg').read_bytes()).hexdigest()})
    report={'status':'RUNNING','physicalMobile':False,'syntheticDataOnly':True,'recordedAt':datetime.now(timezone.utc).isoformat(),
            'sources':{p:hashlib.sha256((EXP/p).read_bytes()).hexdigest() for p in paths},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            for backend,touch in [('webgpu',False),('webgl',False),('auto',True)]:
                case={'backendRequested':backend,'touchEmulated':touch,'errors':[]};report['cases'].append(case)
                context=browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},
                                           is_mobile=touch,has_touch=touch,device_scale_factor=1)
                payload={'data':json.loads(actual)}
                context.route('**/vinculos.json*',lambda route:route.fulfill(content_type='application/json',body=json.dumps(payload['data'])))
                page=context.new_page();page.on('pageerror',lambda error:case['errors'].append(str(error)))
                page.goto(URL+f'?geometria=entrada&unidades=edificio&backend={backend}');ready(page)
                assert page.evaluate('__livViewer.reloadRelations()')
                assert page.evaluate('__livViewer.units.units.filter(u=>u.relation).length')==0
                page.evaluate('''__livViewer.selectUnit('liv-ipanema/pavimento-modelo-01/final-01',{showInformation:true})''');assert page.locator('[data-unit-open="planta2d"]').is_hidden()
                assert page.locator('#unitDetails').is_visible()
                page.keyboard.press('Escape');assert page.locator('#unitDetails').is_hidden()
                payload['data']=fixture;assert page.evaluate('__livViewer.reloadRelations()')
                for row in fixture['units']:
                    page.evaluate('id=>__livViewer.selectUnit(id,{showInformation:true})',row['id'])
                    assert page.evaluate('__livViewer.typology')==row['typology']
                    assert 'orientação original' in page.locator('#unitLayout').inner_text()
                    assert 'FIXTURE SINTÉTICA' in page.locator('#relationSource').inner_text()
                    page.locator('[data-unit-open="planta2d"]').click();ready(page,'planta2d')
                    assert f'plantas2d/{row["typology"]}.jpg' in page.locator('#stage img').get_attribute('src')
                    assert 'associada ao final' in page.locator('#interiorNote').inner_text()
                    for mode in ['planta3d','visita']:
                        page.locator(f'[data-mode="{mode}"]').click();ready(page,mode)
                        assert child(page).evaluate('__livInterior.getState().unitSHA256')==row['interiorUnitSHA256']
                        assert 'associada ao final' in page.locator('#interiorNote').inner_text()
                    page.locator('[data-mode="maquete"]').click();ready(page)
                    assert page.evaluate('__livViewer.selectedUnitId')==row['id']
                # A manually chosen other reference remains clearly distinguished.
                page.evaluate('__livViewer.setTypology("canto")');page.evaluate('__livViewer.setMode("planta2d")');ready(page,'planta2d')
                assert 'Planta de canto' in page.locator('#interiorNote').inner_text()
                assert 'sem vínculo com uma unidade específica' in page.locator('#interiorNote').inner_text()
                page.evaluate('__livViewer.openUnitLayout()');ready(page,'planta2d');assert page.evaluate('__livViewer.typology')=='meio'
                page.locator('[data-mode="maquete"]').click();ready(page)
                bad=json.loads(json.dumps(fixture));bad['units'][0]['orientation']='espelhada';payload['data']=bad
                assert not page.evaluate('__livViewer.reloadRelations()');assert page.locator('#relationWarning').is_visible()
                assert page.evaluate('__livViewer.units.units.filter(u=>u.relation).length')==2
                bad=json.loads(json.dumps(fixture));bad['units'][0]['interiorSourceSHA256']='0'*64;payload['data']=bad
                assert not page.evaluate('__livViewer.reloadRelations()')
                payload['data']=json.loads(actual);assert page.evaluate('__livViewer.reloadRelations()')
                assert page.evaluate('__livViewer.units.units.filter(u=>u.relation).length')==0
                page.evaluate('id=>__livViewer.selectUnit(id,{showInformation:true})',fixture['units'][0]['id'])
                assert page.locator('[data-unit-open="planta2d"]').is_hidden();assert page.locator('#relationWarning').is_hidden()
                assert 'Em conferência' in page.locator('#unitLayout').inner_text()
                assert not case['errors'],case['errors'];case['status']='PASS';case['typologiesVerified']=['canto','meio']
                context.close();(output/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(case),flush=True)
            browser.close()
        assert (EXP/'vinculos.json').read_bytes()==actual
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=repr(error);raise
    finally:(output/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,default=EXP/'evidencias/vinculos-sinteticos')
    main(parser.parse_args().saida)
