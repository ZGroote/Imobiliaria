"""Mede trocas com bytes pré-carregados e verifica reuso/suspensão dos interiores."""
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from qa_interiores import CHROME

EXP=Path(__file__).resolve().parent
BASE='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/'

def main(args):
    args.saida.mkdir(parents=True,exist_ok=True)
    report={'status':'RUNNING','url':args.url,'physicalMobile':False,'recordedAt':datetime.now(timezone.utc).isoformat(),'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            report['browserVersion']=browser.version
            for backend,touch in [('webgpu',False),('webgl',False),*([('auto',True)] if args.verificar else [])]:
                ctx=browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},is_mobile=touch,has_touch=touch)
                page=ctx.new_page();errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('request',lambda r:requests.append(r.url) if '/interiores/' in r.url or '/interior.html?' in r.url else None)
                page.goto(args.url+'?geometria=entrada&unidades=edificio&backend='+backend)
                page.wait_for_function('()=>{if(window.__livViewer?.error)throw Error(__livViewer.error);return window.__livViewer?.ready;}',timeout=120000)
                page.wait_for_function('''()=>{const q=__livTransfers.getState(),g=q.groups?.tour;return g&&g.cached===g.total;}''',timeout=180000)
                page.evaluate("async()=>{await __livViewer.setMode('planta3d');window.__qaScenes={canto:__livViewer.frame.contentWindow.__livInterior};}")
                first=page.evaluate('__livViewer.frame.contentWindow.__livInterior.getState()')
                case={'backend':backend,'touchEmulated':touch,'tourBytesCachedBeforeOpening':True,'firstWallCut':first['presentation']['enabled'],'swaps':[]}
                report['cases'].append(case)
                if args.verificar:assert not first['presentation']['enabled'] and not first['presentation']['active']
                ownership={'canto':first['ownership']}
                for target in ['meio','canto','meio','canto','meio','canto']:
                    request_count=len(requests)
                    row=page.evaluate('''async target=>{
                      const v=__livViewer,old=v.frame.contentWindow.__livInterior,expected=__qaScenes[target],started=performance.now();
                      await v.setTypology(target);if(v.error)throw Error(v.error);
                      const active=v.frame.contentWindow.__livInterior,s=active.getState();__qaScenes[target]=active;
                      return {target,ms:performance.now()-started,reused:expected===active,oldDisposed:old.disposed,
                        active:{typology:s.typology,backend:s.backend,unitSHA256:s.unitSHA256,sourceSHA256:s.sourceSHA256,
                          ownership:s.ownership,presentation:s.presentation,camera:s.camera,renderer:s.renderer},frames:document.querySelectorAll('#stage iframe').length};
                    }''',target)
                    case['swaps'].append(row)
                    row['interiorRequests']=len(requests)-request_count
                    if args.verificar:
                        assert row['frames']<=2 and not row['active']['presentation']['enabled']
                        assert page.locator('#stage iframe:not([hidden])').count()==1
                        if len(case['swaps'])>1:
                            assert row['reused'] and row['interiorRequests']==0,row
                            assert ownership[target]==row['active']['ownership']
                        ownership[target]=row['active']['ownership']
                        assert not row['oldDisposed']
                        frozen=page.evaluate('''()=>{const a=__qaScenes[__livViewer.typology==='canto'?'meio':'canto'];return {active:a.active,frames:a.renderer.info.render.calls,camera:a.getState().camera};}''')
                        page.wait_for_timeout(300)
                        assert frozen==page.evaluate('''()=>{const a=__qaScenes[__livViewer.typology==='canto'?'meio':'canto'];return {active:a.active,frames:a.renderer.info.render.calls,camera:a.getState().camera};}''')
                        assert not frozen['active']
                if args.verificar:
                    page.locator('#stage').scroll_into_view_if_needed();page.screenshot(path=str(args.saida/f'{backend}-{touch}-paredes-inteiras.png'))
                    # Explicit low-wall preference and furniture edits survive warm switches.
                    page.evaluate('''()=>{const a=__qaScenes.canto,s=a.getState();s.camera.autoFrame=false;s.camera.position[0]+=.7;
                      a.restoreState(s);a.setWallCut(true);a.rotateFurniture(a.getState().furniture[0].id);}''')
                    saved=page.evaluate('__qaScenes.canto.getState().furniture')
                    camera=page.evaluate('__qaScenes.canto.getState().camera')
                    page.evaluate("async()=>{await __livViewer.setTypology('meio');await __livViewer.setTypology('canto');}")
                    assert page.evaluate('__qaScenes.canto.getState().presentation.enabled')
                    assert saved==page.evaluate('__qaScenes.canto.getState().furniture')
                    returned_camera=page.evaluate('__qaScenes.canto.getState().camera')
                    assert all(abs(a-b)<1e-7 for field in ['position','target'] for a,b in zip(camera[field],returned_camera[field]))
                    assert returned_camera['autoFrame'] is False
                    page.evaluate('__qaScenes.canto.setWallCut(false)')
                    page.evaluate("async()=>{await __livViewer.setMode('visita');await __livViewer.setTypology('meio');}")
                    assert page.evaluate('__qaScenes.meio.getState().ceiling.visible')
                    page.evaluate("async()=>{await Promise.all([__livViewer.setTypology('canto'),__livViewer.setTypology('meio'),__livViewer.setTypology('canto')]);}")
                    assert page.evaluate('__livViewer.ready&&__livViewer.typology==="canto"&&__livViewer.frame.contentWindow.__livInterior===__qaScenes.canto')
                    assert page.locator('#stage iframe:not([hidden])').count()==1
                    assert page.locator('#stage iframe').count()==2
                    case['otherModes']=[]
                    for mode in ['planta2d','maquete','mapa']:
                        request_count=len(requests)
                        if mode=='mapa':
                            page.locator('.map-link').click()
                            page.wait_for_function('window.__livMapAdapter?.ready',timeout=150000)
                        else:page.evaluate('async m=>__livViewer.setMode(m)',mode)
                        parked=page.evaluate('''()=>Object.fromEntries(Object.entries(__qaScenes).map(([t,a])=>[t,
                          {active:a.active,disposed:a.disposed,calls:a.renderer.info.render.calls,camera:a.getState().camera,ownership:a.getState().ownership}]))''')
                        assert all(not s['active'] and not s['disposed'] for s in parked.values())
                        page.wait_for_timeout(300)
                        assert parked==page.evaluate('''()=>Object.fromEntries(Object.entries(__qaScenes).map(([t,a])=>[t,
                          {active:a.active,disposed:a.disposed,calls:a.renderer.info.render.calls,camera:a.getState().camera,ownership:a.getState().ownership}]))''')
                        if mode=='mapa':
                            wrapper=page.locator('#mapPanel iframe').element_handle().content_frame()
                            runtime=wrapper.locator('#map').element_handle().content_frame()
                            page.screenshot(path=str(args.saida/f'{backend}-{touch}-mapa-sobre-visualizacao.png'))
                            runtime.locator('#livMapaBar a').click()
                            page.wait_for_function('__livViewer.ready&&!__livViewer.mapOpen',timeout=120000)
                        started=page.evaluate('performance.now()')
                        page.evaluate("async()=>__livViewer.setMode('planta3d')")
                        ms=page.evaluate('s=>performance.now()-s',started)
                        assert page.evaluate('__livViewer.frame.contentWindow.__livInterior===__qaScenes.canto')
                        after=page.evaluate('__qaScenes.canto.getState()')
                        assert after['furniture']==saved
                        assert all(abs(a-b)<1e-7 for field in ['position','target'] for a,b in zip(camera[field],after['camera'][field]))
                        assert len(requests)==request_count
                        case['otherModes'].append({'from':mode,'returnMs':ms,'sameInstance':True,'suspendedStable':True,'interiorRequests':0})
                    # Escape and a close while loading must return without a late map reappearing.
                    page.locator('.map-link').click();page.keyboard.press('Escape')
                    page.wait_for_function('__livViewer.ready&&!__livViewer.mapOpen',timeout=120000)
                    assert page.locator('#mapPanel iframe').count()==0
                    assert page.evaluate('__livViewer.frame.contentWindow.__livInterior===__qaScenes.canto')
                    page.locator('#stage').scroll_into_view_if_needed();page.screenshot(path=str(args.saida/f'{backend}-{touch}-retorno.png'))
                    # A lost suspended device is evicted without disrupting the visible Tour.
                    page.evaluate('__qaScenes.meio.renderer.onDeviceLost({reason:"QA: perda no interior suspenso"})')
                    page.wait_for_function('__livViewer.pendingCleanup===0',timeout=35000)
                    assert page.evaluate('__livViewer.ready&&!__livViewer.error&&__qaScenes.meio.disposed')
                    case['rapidSelectionLatestWins']=True;case['suspendedDeviceLossIsolated']=True
                    page.evaluate("async()=>{await __livViewer.setMode('planta2d');}")
                    page.wait_for_function('__livViewer.pendingCleanup===0',timeout=35000)
                    assert page.locator('#stage iframe:not([hidden])').count()==0
                    assert page.evaluate('__qaScenes.canto.ready&&!__qaScenes.canto.active&&!__qaScenes.canto.disposed')
                    page.evaluate('__livViewer.dispose()')
                    page.wait_for_function('__livViewer.pendingCleanup===0',timeout=35000)
                    assert page.locator('#stage iframe').count()==0
                    assert page.evaluate('Object.values(__qaScenes).every(a=>a.disposed&&a.ownership.created===a.ownership.disposed)')
                    case['suspendedSceneStable']=True;case['preferencesAndFurniturePreserved']=True;case['allResourcesDisposedOnExit']=True
                assert not errors,errors
                case['status']='PASS';case['errors']=errors
                print(json.dumps({'backend':backend,'touch':touch,'ms':[round(r['ms']) for r in case['swaps']],'reused':[r['reused'] for r in case['swaps']]}),flush=True)
                ctx.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:report.update(status='FAIL',failure=repr(error));raise
    finally:(args.saida/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default=BASE+'maquete-liv-ipanema.html');p.add_argument('--verificar',action='store_true');p.add_argument('--saida',type=Path,required=True);main(p.parse_args())
