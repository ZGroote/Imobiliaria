"""Qualifica modelo/terreno, recorte, busca, cache, falha e retorno do mapa."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
from itertools import product
import json
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
spec = importlib.util.spec_from_file_location('map_baseline', ROOT/'experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py')
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)


class MapFrame:
    """Usa o mesmo ensaio regional dentro do iframe, capturando a página inteira."""
    def __init__(self, frame, page):
        self.frame, self.page = frame, page

    def __getattr__(self, name):
        return getattr(self.page if name == 'screenshot' else self.frame, name)


def expected_bounds(edition):
    path = 'modelo/entrada/candidato/modelo.json' if edition=='entrada' else 'modelo/variante/modelo.json'
    model = json.loads((EXP/path).read_bytes())
    low, high = np.full(3, np.inf), np.full(3, -np.inf)
    for group in model['groups']:
        positions = np.array(model['geometries'][group['geometry']]['position']).reshape(-1, 3)
        # O adaptador regional calcula o envelope de cada geometria local e
        # transforma seus oito cantos, inclusive em árvores/peças rotacionadas.
        corners = np.array(list(product(*zip(positions.min(0), positions.max(0)))))
        for instance in group['instances']:
            matrix = np.array(instance['matrix']).reshape(4, 4, order='F')
            points = corners @ matrix[:3, :3].T + matrix[:3, 3]
            low, high = np.minimum(low, points.min(0)), np.maximum(high, points.max(0))
    return low, high


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP/'evidencias/mapa-modelo')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((EXP/'mapa-runtime/manifest.json').read_bytes())
    report = {'status':'RUNNING', 'recordedAtUtc':datetime.now(timezone.utc).isoformat(), 'physicalMobile':False,
              'sourceSHA256':{p:hashlib.sha256((EXP/p).read_bytes()).hexdigest() for p in
               ['qa_mapa_modelo.py','edicoes.js','viewer.js','mapa-retorno.js','mapa-loader.js','preparar_mapa.py','modelo/registrar_mapa.py',
                'modelo/variante/mapa.json','modelo/entrada/candidato/mapa.json','mapa-runtime/manifest.json','transfer-worker.js','transfer-manifest.json']},
              'cases':[], 'modelManifest':manifest['models']}
    bounds = {edition:expected_bounds(edition) for edition in ['contorno','entrada']}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            for name, edition, width, height, blocked in [
                ('base-desktop','base',1440,900,False), ('contorno-desktop','contorno',1440,900,False),
                ('contorno-toque','contorno',390,844,False), ('contorno-sem-cache','contorno',1280,800,True),
                ('entrada-desktop','entrada',1440,900,False), ('entrada-toque','entrada',390,844,False),
                ('entrada-sem-cache','entrada',1280,800,True)]:
                case = {'name':name, 'edition':edition, 'viewport':[width,height], 'serviceWorkersBlocked':blocked, 'errors':[]}
                report['cases'].append(case)
                context = browser.new_context(viewport={'width':width,'height':height}, has_touch=width==390,
                                              is_mobile=width==390, service_workers='block' if blocked else 'allow')
                page = context.new_page()
                page.on('pageerror', lambda error, c=case: c['errors'].append(str(error)))
                suffix = '?geometria='+edition if edition!='base' else ''
                viewer_url = URL+'maquete-liv-ipanema.html'+suffix
                page.goto(viewer_url)
                page.wait_for_function('window.__livViewer?.ready', timeout=120000)
                page.locator('[data-unit-id]').first.click()
                selected = page.evaluate('__livViewer.selectedUnitId')
                page.locator('.map-link').click()
                page.wait_for_function('window.__livMapAdapter?.ready', timeout=120000)
                frame = page.frame_locator('#map')
                child = next(f for f in page.frames if f.parent_frame==page.main_frame)
                child.wait_for_function('window.__int?.livTerrain?.amount()>=.999', timeout=30000)
                child.wait_for_function('window.__livNearby?.ready', timeout=30000)
                assert page.locator('#failure').is_hidden()
                assert page.locator('#transferStatus').is_hidden()
                case['model'] = child.evaluate('__livModel.metadata')
                expected = manifest['models'][edition]
                model = case['model']
                assert model['edition']==edition and model['geometryVerified']
                assert model['assetSHA256']==expected['sha256'] and model['sourceModelSHA256']==expected['sourceModelSHA256']
                expected_counts={'base':(1825,87),'contorno':(1826,88),'entrada':(1815,97)}
                assert (model['sourceMeshes'],model['instancedBatches'])==expected_counts[edition]
                assert model['units']=='meters' and model['placementOffsetMeters']==[8,-6]
                assert abs(model['rotationRadians'] + np.pi/3) < 1e-8 and model['floorClearanceMeters']==.4
                if edition!='base':
                    assert np.allclose(model['boundsLocal']['min'],bounds[edition][0],atol=4e-4,rtol=0)
                    assert np.allclose(model['boundsLocal']['max'],bounds[edition][1],atol=4e-4,rtol=0)
                case['frameResources'] = child.evaluate("performance.getEntriesByType('resource').filter(r=>r.name.includes('.glb')).map(r=>({url:r.name,bytes:r.decodedBodySize}))")
                expected_url={'base':'site-baseline/liv-ipanema.glb','contorno':'modelo/variante/liv-contorno.glb',
                              'entrada':'modelo/entrada/candidato/liv-contorno.glb'}[edition]
                assert len(case['frameResources'])==1 and case['frameResources'][0]['url'].endswith(expected_url)
                case['ui'] = child.evaluate(baseline.UI)
                baseline.check_ui(case['ui'])
                case['regional'] = child.evaluate("()=>({radius:__livMapa.raio,center:__livMapa.centro,pois:JSON.parse(document.getElementById('__poidata').textContent).length,raster:__regionalRaster,circle:LivCircle.diagnostics()})")
                assert case['regional']['radius']==5000 and case['regional']['pois']==614
                assert case['regional']['circle']['radius']==5000
                assert all(r['max_sample_radius_m']<=5000 and r['outside']=='not-transmitted' for r in case['regional']['raster'].values())
                case['geometry'] = child.evaluate(baseline.GEOMETRY)
                baseline.check_geometry(case['geometry'])
                case['nearby'] = baseline.check_nearby(MapFrame(child,page), args.saida/f'{name}-busca.png')
                frame.locator('#livProximosToggle').click()
                frame.locator('#livFocar').click()
                child.wait_for_timeout(1100)
                case['focus'] = child.evaluate('({target:__int.target.toArray(),model:__livModel.object.position.toArray(),visible:__livModel.object.visible})')
                focus = case['focus']
                assert focus['visible'] and np.linalg.norm(np.array(focus['target'])[::2]-np.array(focus['model'])[::2])<1e-5, focus
                case['terrain'] = child.evaluate("""()=>{const t=__int.livTerrain,m=__livModel,p=m.object.position;return {
                  amount:t.amount(),anchor:t.sample(p.x,p.z),floor:p.y,footprint:m.footprintWorld.map(v=>t.sample(v[0],v[2])),
                  outsideDelta:t.sample(p.x+250,p.z+250)-t.sampleOriginal(p.x+250,p.z+250)};}""")
                terrain = case['terrain']
                assert abs(terrain['floor']-terrain['anchor']-.4)<.03 and terrain['amount']>=.999
                assert max(abs(h-terrain['anchor']) for h in terrain['footprint'])<.01 and abs(terrain['outsideDelta'])<1e-5
                page.screenshot(path=str(args.saida/f'{name}-perspectiva.png'))
                child.evaluate('__int.sph.radius=220;__int.sph.phi=.05;__int.sph.theta=-Math.PI/3')
                child.wait_for_timeout(300)
                page.screenshot(path=str(args.saida/f'{name}-cima.png'))
                if not blocked:
                    page.evaluate('__livTransfers.pause()')
                    # A fresh frame navigation reuses the exact URL allowlist despite its edition fragment.
                    child.goto(URL+'mapa-runtime/mapa-liv-ipanema-5km.html'+('#'+edition if edition!='base' else ''))
                    child.wait_for_function('window.__livModel && window.__livMapLoad?.ready', timeout=120000)
                    assert child.evaluate('__livModel.metadata.edition')==edition
                    case['cacheReload']=True
                link = frame.locator('#livMapaBar a')
                assert link.get_attribute('href')==viewer_url
                link.click()
                page.wait_for_function('window.__livViewer?.ready', timeout=120000)
                assert page.evaluate('__livViewer.geometry')==edition
                assert page.evaluate('__livViewer.selectedUnitId')==selected
                case['returnSelection']=selected
                assert not case['errors'], case['errors']
                case['status']='PASS'
                page.evaluate('__livViewer.dispose()')
                context.close()
                print(name+': PASS',flush=True)
            # Independent native loading also rejects a damaged GLB when cache is unavailable.
            report['corruptModels']=[]
            for edition, path in [('contorno','modelo/variante/liv-contorno.glb'),('entrada','modelo/entrada/candidato/liv-contorno.glb')]:
                context = browser.new_context(viewport={'width':1280,'height':800},service_workers='block')
                page = context.new_page()
                page.route('**/'+path, lambda route: route.fulfill(status=200, body=b'wrong model'))
                page.goto(URL+'mapa-liv-ipanema-5km.html?geometria='+edition)
                page.locator('#failure').wait_for(state='visible',timeout=120000)
                child = next(f for f in page.frames if f.parent_frame==page.main_frame)
                failure = child.evaluate('({load:__livMapLoad,modelPresent:!!window.__livModel})')
                assert not failure['load']['verified'] and not failure['modelPresent']
                assert page.locator('#failure a').nth(1).get_attribute('href').endswith('maquete-liv-ipanema.html?geometria='+edition)
                report['corruptModels'].append({'edition':edition,'status':'PASS', **failure})
                page.screenshot(path=str(args.saida/f'{edition}-modelo-incompativel.png'))
                context.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL'; report['failure']=str(error); raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
        print(json.dumps({'status':report['status'],'cases':len(report['cases'])}),flush=True)


if __name__=='__main__':
    main()
