"""Seleção técnica de dez finais, gestos, ficha e catálogo nos dois backends.

Perfil descartável do Chrome. Toque emulado; nenhum resultado de celular físico.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright
from shapely.geometry import Polygon
from shapely.ops import unary_union

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES = {'desktop-webgpu': (1440, 900, 'webgpu'), 'desktop-webgl': (1440, 900, 'webgl'), 'toque': (390, 844, 'auto')}
GEOMETRY = 'base'
FILES = ['qa_unidades.py', 'test_unidades.mjs', 'unidades.json', 'unidades.js', 'unit-footprint.js', 'picking.js', 'unit-ui.js', 'unit-ui.css',
         'viewer.js', 'renderer.js', 'cameras.js', 'exterior-finishes.js', 'maquete-liv-ipanema.html', 'prova-rgbm.html', 'tipologias.js',
         'assets-prova/manifest.json', 'assets-prova/scene.json.gz', 'assets-prova/irradiance.rgbm.gz',
         'interiores/catalogo.json', 'interior-renderer.js', 'interior-cutaway.js', 'plantas2d/canto.jpg', 'plantas2d/meio.jpg']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def address(backend):
    return f'{URL}?backend={backend}&geometria={GEOMETRY}'


def ready(page, mode='maquete'):
    page.wait_for_function('''mode=>{
      if(window.__livViewer?.error)throw Error(__livViewer.error);
      return window.__livViewer?.ready&&__livViewer.mode===mode;
    }''', arg=mode, timeout=120000)
    page.wait_for_function('__livViewer.pendingCleanup===0', timeout=35000)
    assert page.locator('#stage iframe').count() == (0 if mode == 'planta2d' else 1)


def child(page):
    return page.locator('#stage iframe').element_handle().content_frame()


def position(page, unit):
    page.evaluate('scrollTo(0,0)')
    frame = child(page)
    point = frame.evaluate('''unit=>{
      const p=__livProva, a=unit.bounds.min,b=unit.bounds.max;
      const point=p.camera.position.clone().fromArray(unit.pickPoint??[(a[0]+b[0])/2,4.35,unit.side==='lazer'?7.02:-7.02]).project(p.camera);
      const rect=p.renderer.domElement.getBoundingClientRect();
      return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
    }''', unit)
    box = page.locator('#stage iframe').bounding_box()
    return box['x'] + point['x'], box['y'] + point['y']


def assert_selected(page, unit):
    state = page.evaluate('__livViewer.getState()')
    assert state['floor'] == 1 and state['selectedUnitId'] == unit['id'], state
    assert page.locator(f'[data-unit-id="{unit["id"]}"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('[data-unit-id][aria-pressed=true]').count() == 1
    assert page.locator('#unitTitle').inner_text() == f'Final {unit["final"]} · 1º pavimento tipo'
    assert 'Não informados' in page.locator('#unitCard').inner_text()
    assert 'Em conferência' in page.locator('#unitCard').inner_text()
    render = child(page).evaluate('''()=>{
      const p=__livProva,h=p.unitPicking.highlight;
      return {selection:p.unitPicking.getState(),position:h.position.toArray(),scale:h.scale.toArray(),
        materials:h.children.map(o=>o.material.type),casts:h.children.some(o=>o.castShadow)};
    }''')
    assert render['selection'] == {'selectedId': unit['id'], 'active': True}, render
    assert render['materials'] == ['MeshBasicMaterial', 'LineBasicMaterial'] and not render['casts']
    assert render['position'] == [(a + b) / 2 for a, b in zip(unit['bounds']['min'], unit['bounds']['max'])]
    assert render['scale'] == [b - a for a, b in zip(unit['bounds']['min'], unit['bounds']['max'])]
    if 'footprint' in unit:
        triangles = child(page).evaluate('''()=>{
          const h=__livProva.unitPicking.highlight,g=h.children[0].geometry,a=g.getAttribute('position');
          h.updateMatrixWorld(true);const points=[],{start,count}=g.drawRange;
          for(let i=start;i<start+count;i++)points.push(h.position.clone().fromBufferAttribute(a,i).applyMatrix4(h.matrixWorld).toArray());
          return points;
        }''')
        polygon = Polygon(unit['footprint'])
        caps = []
        for i in range(0, len(triangles), 3):
            tri = triangles[i:i+3]
            if max(p[1] for p in tri) - min(p[1] for p in tri) < 1e-6:
                shape = Polygon([(p[0], p[2]) for p in tri])
                assert shape.difference(polygon).area < 1e-5, 'Highlight filled an empty notch'
                caps.append(shape)
        assert unary_union(caps).symmetric_difference(polygon).area < 1e-5
    return state


def source_snapshot(frame):
    return frame.evaluate('''async()=>{
      const p=__livProva,hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      const geometry=[];
      for(const mesh of p.meshes){
        const attrs={};for(const name of ['position','normal','uv','uv1']){
          const a=mesh.geometry.getAttribute(name);attrs[name]=a?await hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)):null;
        }geometry.push({attrs,matrix:mesh.matrix.toArray()});
      }
      return {geometry,atlas:p.atlas.uuid,source:p.data.sourceModelSHA256,meshCount:p.meshes.length,
        materials:p.meshes.map(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>({
          uuid:m.uuid,type:m.type,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,
          opacity:m.opacity,transparent:m.transparent,map:m.map?.uuid,normalMap:m.normalMap?.uuid,
          roughnessMap:m.roughnessMap?.uuid,envMapIntensity:m.envMapIntensity}))),
        model:await hash(new TextEncoder().encode(JSON.stringify(p.data)))};
    }''')


def run_case(browser, name, width, height, backend, output, report, catalog):
    case = {'profile': name, 'viewport': [width, height], 'requestedBackend': backend, 'errors': [], 'httpFailures': [], 'consoleErrors': [], 'status': 'RUNNING'}
    report['cases'].append(case)
    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=name == 'toque',
                                  is_mobile=name == 'toque', device_scale_factor=3 if name == 'toque' else 1)
    page = context.new_page()
    page.on('pageerror', lambda error: case['errors'].append(str(error)))
    page.on('console', lambda message: case['consoleErrors'].append(message.text) if message.type == 'error' else None)
    page.on('response', lambda response: case['httpFailures'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    try:
        page.goto(address(backend))
        ready(page)
        frame = child(page)
        case['actualBackend'] = frame.evaluate('__livProva.backend')
        assert backend == 'auto' or case['actualBackend'] == backend
        initial = source_snapshot(frame)
        assert initial['source'] == catalog['sourceModelSHA256'] and initial['meshCount'] == 56
        case['listSelections'] = []
        for unit in catalog['units']:
            button = page.locator(f'[data-unit-id="{unit["id"]}"]')
            button.click()
            case['listSelections'].append(assert_selected(page, unit))
        page.locator('[data-unit-id]').first.focus()
        page.keyboard.press('Enter')
        assert_selected(page, catalog['units'][0])
        page.keyboard.press('Tab')
        page.keyboard.press('Space')
        assert_selected(page, catalog['units'][1])
        case['keyboardSelection'] = True
        print(f'{name}: lista e teclado aprovados', flush=True)

        case['facadeSelections'] = []
        for unit in catalog['units']:
            page.evaluate('side=>__livViewer.showUnitSide(side)', unit['side'])
            x, y = position(page, unit)
            if name == 'toque':
                page.touchscreen.tap(x, y)
            else:
                page.mouse.click(x, y)
            assert_selected(page, unit)
            case['facadeSelections'].append(unit['id'])
        frame = child(page)
        selected = page.evaluate('__livViewer.selectedUnitId')
        queries = frame.evaluate('__livProva.unitPicking.stats.pickQueries')
        x, y = position(page, catalog['units'][-1])
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 80, y + 15, steps=8)
        page.mouse.move(x, y, steps=8)
        page.mouse.up()
        assert page.evaluate('__livViewer.selectedUnitId') == selected
        assert frame.evaluate('__livProva.unitPicking.stats.pickQueries') == queries
        case['dragDoesNotPick'] = True
        if name == 'toque':
            cdp = context.new_cdp_session(page)
            points = [{'x': x - 35, 'y': y, 'id': 1}, {'x': x + 35, 'y': y, 'id': 2}]
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': points})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{**p, 'x': p['x'] + (-15 if p['id'] == 1 else 15)} for p in points]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            assert page.evaluate('__livViewer.selectedUnitId') == selected
            assert frame.evaluate('__livProva.unitPicking.stats.pickQueries') == queries
            case['pinchDoesNotPick'] = True
        page.evaluate("__livViewer.setView('implantacao')")
        x, y = position(page, catalog['units'][0])
        page.mouse.click(x, y)
        assert page.evaluate('__livViewer.selectedUnitId') is None
        case['roofDoesNotSelectHiddenFloor'] = True
        page.evaluate('id=>__livViewer.selectUnit(id)', catalog['units'][5]['id'])
        page.evaluate('scrollTo(0,0)')
        page.locator('#stage').screenshot(path=str(output / f'{name}-final-06.png'))
        page.evaluate('scrollTo(0,0)')
        camera = frame.evaluate('__livProva.getState().camera')
        page.locator('#clearUnit').click()
        assert not frame.evaluate('__livProva.unitPicking.getState().active')
        assert page.evaluate('__livViewer.selectedUnitId') is None
        assert camera == frame.evaluate('__livProva.getState().camera')
        assert initial == source_snapshot(frame), 'Selection modified source geometry, materials or atlas'
        case['sourcePreserved'] = {'modelSHA256': initial['model'], 'meshes': initial['meshCount'], 'geometryUVMaterialsAtlasUnchanged': True}
        print(f'{name}: raios e gestos aprovados', flush=True)

        page.evaluate('id=>__livViewer.selectUnit(id)', catalog['units'][2]['id'])
        page.reload()
        ready(page)
        assert_selected(page, catalog['units'][2])
        page.select_option('#floor', '16')
        assert page.evaluate('__livViewer.selectedUnitId') is None
        assert not child(page).evaluate('__livProva.unitPicking.getState().active')
        page.evaluate('id=>__livViewer.selectUnit(id)', catalog['units'][4]['id'])
        camera = child(page).evaluate('__livProva.getState().camera')
        case['referenceCatalog'] = []
        for typology in ['canto', 'meio']:
            page.select_option('#typology', typology)
            for mode in ['planta2d', 'planta3d', 'visita']:
                page.locator(f'[data-mode={mode}]').click()
                ready(page, mode)
                assert page.evaluate('__livViewer.selectedUnitId') == catalog['units'][4]['id']
                assert f'referência de {typology}' in page.locator('#unitReferenceNote').inner_text()
                assert 'associação com o final 05 está em conferência' in page.locator('#unitReferenceNote').inner_text()
                assert 'sem vínculo com uma unidade específica' in page.locator('#interiorNote').inner_text()
                if mode == 'planta2d':
                    assert page.locator('#stage img').get_attribute('src') == f'plantas2d/{typology}.jpg'
                    current = {'typology': typology, 'mode': mode, 'source': f'plantas2d/{typology}.jpg'}
                else:
                    current = child(page).evaluate('__livInterior.getState()')
                    assert current['typology'] == typology and current['mode'] == mode
                    assert current['presentation']['active'] == (mode == 'planta3d')
                    current = {key: current[key] for key in ['typology', 'mode', 'unitSHA256', 'sourceSHA256', 'presentation']}
                case['referenceCatalog'].append(current)
        page.locator('[data-mode=maquete]').click()
        ready(page)
        assert page.evaluate('__livViewer.units.sourceModelSHA256')==catalog['sourceModelSHA256']
        assert_selected(page, catalog['units'][4])
        restored = child(page).evaluate('__livProva.getState().camera')
        assert all(math.isclose(a, b, abs_tol=1e-9) for a, b in zip(camera['position'], restored['position']))
        assert all(math.isclose(a, b, abs_tol=1e-9) for a, b in zip(camera['target'], restored['target']))
        case['sessionAndModeReturn'] = True
        page.evaluate('''()=>{
          const key=`liv-viewer-v1:${location.pathname}${__livViewer.geometry==='contorno'?':contorno':''}`,saved={version:1,...__livViewer.getState(),
            selectedUnitId:'liv-ipanema/pavimento-modelo-01/final-99',exteriorSnapshot:__livViewer.frame.contentWindow.__livProva.getState()};
          // Navigate via an anchor so pagehide normally saves the actual state;
          // the invalid persisted record is tested by the next new page instead.
          sessionStorage.setItem('qa-invalid-unit-record',JSON.stringify({key,saved}));
        }''')

        case['layouts'] = []
        for layout_width in [320, 768, 1024, 1440]:
            page.set_viewport_size({'width': layout_width, 'height': height})
            page.wait_for_function('document.documentElement.scrollWidth<=innerWidth+1')
            buttons = page.locator('[data-unit-id]').evaluate_all('(buttons)=>buttons.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))')
            assert all(b['w'] >= 44 and b['h'] >= 44 for b in buttons), buttons
            case['layouts'].append({'width': layout_width, 'minTouchTarget': min(min(b['w'], b['h']) for b in buttons), 'noHorizontalOverflow': True})
        page.set_viewport_size({'width': width, 'height': height})
        page.screenshot(path=str(output / f'{name}-ficha.png'), full_page=True)
        page.evaluate("window.__qaUnitDisposed={box:0,edges:0,fill:0,line:0}")
        child(page).evaluate('''()=>{
          const h=__livProva.unitPicking.highlight,objects={box:h.children[0].geometry,edges:h.children[1].geometry,fill:h.children[0].material,line:h.children[1].material};
          for(const [key,o] of Object.entries(objects))o.addEventListener('dispose',()=>parent.__qaUnitDisposed[key]++);
        }''')
        page.locator('[data-mode=planta2d]').click()
        ready(page, 'planta2d')
        case['disposed'] = page.evaluate('__qaUnitDisposed')
        assert case['disposed'] == {'box': 1, 'edges': 1, 'fill': 1, 'line': 1}
        page.locator('#clearUnit').click()
        assert page.evaluate('__livViewer.selectedUnitId') is None
        assert page.locator('#unitCard').is_hidden()
        invalid = page.evaluate("JSON.parse(sessionStorage.getItem('qa-invalid-unit-record'))")
        page.evaluate('record=>sessionStorage.setItem(record.key,JSON.stringify(record.saved))', invalid)
        # A second tab clones same-origin session storage from its opener without
        # invoking pagehide on the live page and overwriting the invalid record.
        with page.expect_popup() as popup_info:
            page.evaluate('url=>open(url)', address(backend))
        popup = popup_info.value
        ready(popup)
        assert popup.evaluate('__livViewer.selectedUnitId') is None
        assert popup.locator('#unitCard').is_hidden()
        popup.evaluate('__livViewer.dispose()')
        popup.close()
        case['unknownSavedIdRejected'] = True
        if GEOMETRY == 'contorno':
            case['contourHighlightVerifiedForEverySelection'] = True
            assert page.locator('.map-link').get_attribute('href').endswith('mapa-liv-ipanema-5km.html?geometria=contorno')
        assert not case['errors'] and not case['httpFailures'] and not case['consoleErrors'], case
        case['status'] = 'PASS'
        print(f'{name}: PASS', flush=True)
    finally:
        page.evaluate('__livViewer?.dispose()')
        context.close()


def run_recovery(browser, report, catalog):
    context=browser.new_context(viewport={'width':1280,'height':800})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    report['recoveryCases']=[]
    pattern='**/modelo/unidades-contorno.json' if GEOMETRY == 'contorno' else '**/unidades.json'
    try:
        page.route(pattern,lambda route:route.fulfill(status=404,body='Fixture: cadastro ausente'))
        page.goto(address('webgl'))
        page.wait_for_function('window.__livViewer?.error',timeout=15000)
        assert 'carregar os finais' in page.evaluate('__livViewer.error')
        assert page.evaluate('__livViewer.frame===null')
        page.locator('#fallback').click()
        ready(page,'planta2d')
        page.unroute(pattern)
        page.locator('[data-mode=maquete]').click()
        ready(page)
        page.evaluate('id=>__livViewer.selectUnit(id)',catalog['units'][0]['id'])
        assert_selected(page,catalog['units'][0])
        report['recoveryCases'].append({'fixture':'cadastro-404','fallback2D':True,'retryLoadsCatalogAndSelection':True,'status':'PASS'})

        wrong=json.loads(json.dumps(catalog))
        wrong['sourceModelSHA256']='0'*64
        page.route(pattern,lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(wrong)))
        page.reload()
        page.wait_for_function('window.__livViewer?.error',timeout=120000)
        assert 'outra edição' in page.evaluate('__livViewer.error')
        assert page.evaluate('__livViewer.frame===null')
        page.locator('#fallback').click()
        ready(page,'planta2d')
        page.unroute(pattern)
        page.locator('[data-mode=maquete]').click()
        ready(page)
        assert_selected(page,catalog['units'][0])
        assert page.evaluate('__livViewer.units.sourceModelSHA256')==catalog['sourceModelSHA256']
        report['recoveryCases'].append({'fixture':'modelo-incompativel','pickingRejected':True,'fallback2D':True,'retryRestoresSelection':True,'status':'PASS'})
        if GEOMETRY == 'contorno':
            invalid=json.loads(json.dumps(catalog))
            unit=invalid['units'][0];a,b=unit['bounds']['min'],unit['bounds']['max']
            unit['footprint']=[[a[0],a[2]],[b[0],a[2]],[b[0],b[2]],[a[0],b[2]]]
            page.route(pattern,lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(invalid)))
            page.reload()
            page.wait_for_function('window.__livViewer?.error',timeout=15000)
            assert 'inválido' in page.evaluate('__livViewer.error')
            assert page.evaluate('__livViewer.frame===null')
            page.locator('#fallback').click();ready(page,'planta2d')
            page.unroute(pattern)
            page.locator('[data-mode=maquete]').click();ready(page)
            assert_selected(page,catalog['units'][0])
            report['recoveryCases'].append({'fixture':'zona-preenche-recuo','invalidFootprintRejected':True,'fallback2D':True,'retryRestoresSelection':True,'status':'PASS'})
        assert not errors,errors
        print(f'Recuperação: {len(report["recoveryCases"])} PASS',flush=True)
    finally:
        page.evaluate('__livViewer?.dispose()')
        context.close()


def run_map_return(browser, report, catalog):
    context=browser.new_context(viewport={'width':1280,'height':800})
    page=context.new_page()
    try:
        page.goto(address('webgl'));ready(page)
        page.evaluate('id=>__livViewer.selectUnit(id)',catalog['units'][1]['id'])
        page.locator('.map-link').click()
        page.wait_for_function('window.__livMapAdapter?.ready',timeout=120000)
        destination=page.evaluate('__livMapAdapter.returnURL')
        assert destination.endswith('maquete-liv-ipanema.html?geometria=contorno')
        frame=page.locator('#map').element_handle().content_frame()
        link=frame.locator('a').filter(has_text='Maquete').first
        assert link.get_attribute('href') == destination and link.get_attribute('target') == '_top'
        # Navigate through the map's real return control, preserving this tab's
        # session, rather than constructing a fresh viewer for this assertion.
        link.click();ready(page)
        assert page.evaluate('__livViewer.geometry') == 'contorno'
        assert_selected(page,catalog['units'][1])
        assert child(page).evaluate('__livProva.data.sourceModelSHA256') == catalog['sourceModelSHA256']
        report['mapReturn']={'status':'PASS','returnURL':destination,'selectionRestored':True,
                             'exteriorEditionRestored':True,'mapGeometry':'baseline-preserved'}
        # A real transfer cache legitimately serves the valid map above. Block
        # workers only in a separate disposable context for this failure fixture.
        failure_context=browser.new_context(viewport={'width':1280,'height':800},service_workers='block')
        failure_page=failure_context.new_page()
        failure_page.goto(address('webgl'));ready(failure_page)
        failure_page.evaluate('id=>__livViewer.selectUnit(id)',catalog['units'][1]['id'])
        failure_page.route('**/site-baseline/mapa-liv-ipanema-5km.html',lambda route:route.fulfill(
            status=200,content_type='text/html',body='<p>Fixture: mapa indisponível</p>'))
        failure_page.locator('.map-link').click()
        failure_page.locator('#failure').wait_for(state='visible',timeout=120000)
        links=failure_page.locator('#failure a')
        assert links.nth(0).get_attribute('href').endswith('mapa-liv-ipanema-5km.html?geometria=contorno')
        assert links.nth(1).get_attribute('href') == destination
        links.nth(1).click();ready(failure_page)
        assert_selected(failure_page,catalog['units'][1])
        report['mapReturn']['failureLinksPreserveEditionAndSelection'] = True
        report['mapReturn']['failureFixtureServiceWorkersBlocked'] = True
        failure_page.evaluate('__livViewer?.dispose()');failure_context.close()
        print('Retorno do mapa: PASS',flush=True)
    finally:
        page.evaluate('__livViewer?.dispose()');context.close()


def main():
    global GEOMETRY
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--perfil', choices=['todos', *PROFILES], default='todos')
    parser.add_argument('--geometria', choices=['base', 'contorno'], default='base')
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias' / 'unidades-piloto')
    args = parser.parse_args()
    GEOMETRY = args.geometria
    args.saida.mkdir(parents=True, exist_ok=True)
    if GEOMETRY == 'contorno':
        FILES.extend(['test_contorno_unidades.mjs', 'modelo/registrar_unidades.py', 'modelo/unidades-contorno.json',
                      'modelo/contorno-torre.json', 'modelo/contorno.py', 'modelo/variante/modelo.json',
                      'modelo/variante/assets/manifest.json', 'modelo/variante/assets/scene.json.gz',
                      'modelo/variante/assets/irradiance.rgbm.gz', 'mapa-retorno.js'])
    catalog = json.loads((EXP / ('modelo/unidades-contorno.json' if GEOMETRY == 'contorno' else 'unidades.json')).read_text(encoding='utf-8'))
    image = ROOT / 'relatorios/liv-referencias-publicas-2026-10-09/implantacao-finais-e-vagas.png'
    assert digest(image) == catalog['source']['imageSHA256']
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING', 'physicalMobile': False, 'geometry': GEOMETRY,
              'sourceSHA256': {name: digest(EXP / name) for name in FILES}, 'reference': catalog['source'],
              'limitations': ['Registro proporcional e zonas aproximadas, sem planta executiva.',
                              'Tipologia/espelhamento por final, área por unidade e dados comerciais pendentes.',
                              'Toque emulado em Chrome desktop; Poco X6 e iPhone físicos não qualificados.'], 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            report['browserVersion'] = browser.version
            for name, (width, height, backend) in PROFILES.items():
                if args.perfil in ['todos', name]:
                    run_case(browser, name, width, height, backend, args.saida, report, catalog)
            run_recovery(browser,report,catalog)
            if GEOMETRY == 'contorno':
                run_map_return(browser,report,catalog)
            browser.close()
        report['status'] = 'PASS'
    except Exception as failure:
        report['status'] = 'FAIL'
        report['failure'] = str(failure)
        raise
    finally:
        (args.saida / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}), flush=True)


if __name__ == '__main__':
    main()
