"""Catálogo técnico de 170 posições: espelho, fachada, modos e retorno do mapa."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_unidades import ready, child, position, source_snapshot

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html'


def selected(page, unit):
    state = page.evaluate('__livViewer.getState()')
    assert state['selectedUnitId'] == unit['id'] and state['floor'] == unit['floorIndex'], state
    assert page.locator('[data-unit-id][aria-pressed=true]').count() == 1
    assert page.locator('[data-mirror-unit-id][aria-pressed=true]').count() == 1
    assert page.locator('#floor').input_value() == str(unit['floorIndex'])
    assert 'Em conferência' in page.locator('#unitCard').inner_text()
    highlight = child(page).evaluate('__livProva.unitPicking.getState()')
    assert highlight == {'selectedId': unit['id'], 'active': True}, highlight


def main(output):
    output.mkdir(parents=True, exist_ok=True)
    files = ['catalogo-unidades.js', 'viewer.js', 'renderer.js', 'picking.js', 'unit-ui.js', 'espelho.js',
             'cameras.js', 'maquete-liv-ipanema.html', 'unit-ui.css', 'mapa-retorno.js', 'qa_catalogo.py',
             'unidades.json', 'modelo/unidades-contorno.json', 'modelo/entrada/unidades-entrada.json']
    report = {'status': 'RUNNING', 'physicalMobile': False, 'recordedAt': datetime.now(timezone.utc).isoformat(),
              'sources': {p: hashlib.sha256((EXP / p).read_bytes()).hexdigest() for p in files}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            report['browserVersion'] = browser.version
            for backend, touch in [('webgpu', False), ('webgl', False), ('auto', True)]:
                case = {'backendRequested': backend, 'touchEmulated': touch, 'status': 'RUNNING', 'errors': []}
                report['cases'].append(case)
                context = browser.new_context(viewport={'width': 390 if touch else 1440, 'height': 844 if touch else 900},
                                              is_mobile=touch, has_touch=touch, device_scale_factor=1)
                page = context.new_page(); page.on('pageerror', lambda error: case['errors'].append(str(error)))
                page.goto(URL + f'?geometria=entrada&unidades=edificio&backend={backend}');ready(page)
                page.locator('#buildingMirror').evaluate('(e)=>e.open=true')
                assert page.locator('[data-mirror-unit-id]').count() == 170
                assert page.locator('#unitList button').count() == 10
                catalog = page.evaluate('__livViewer.units');assert len(catalog['units']) == 170
                initial = source_snapshot(child(page));case['backendEffective'] = page.evaluate('__livViewer.backend')
                result = page.evaluate('''()=>{
                  const viewer=__livViewer,failed=[];
                  for(const unit of viewer.units.units){
                    viewer.selectUnit(unit.id);
                    const p=viewer.frame.contentWindow.__livProva,h=p.unitPicking.highlight;
                    if(viewer.floor!==unit.floorIndex||viewer.selectedUnitId!==unit.id||!h.visible||
                      document.querySelector('[data-mirror-unit-id][aria-pressed=true]')?.dataset.mirrorUnitId!==unit.id||
                      document.querySelector('[data-unit-id][aria-pressed=true]')?.dataset.unitId!==unit.id||
                      h.position.y!==(unit.bounds.min[1]+unit.bounds.max[1])/2)failed.push(unit.id);
                  }
                  return {tested:viewer.units.units.length,failed};
                }''')
                assert not result['failed'], result;case['synchronizedPositions'] = result['tested']
                for floor in [0, 1, 8, 16]:
                    for final in ['01', '10']:
                        unit = next(u for u in catalog['units'] if u['floorIndex'] == floor and u['final'] == final)
                        page.locator(f'[data-mirror-unit-id="{unit["id"]}"]').click();selected(page, unit)
                        assert page.locator('#gardenNote').is_visible() == (floor == 0)
                        page.evaluate('__livViewer.selectUnit(null)')
                        x, y = position(page, unit)
                        if touch: page.touchscreen.tap(x, y)
                        else: page.mouse.click(x, y)
                        selected(page, unit)
                page.locator('#mirrorFloor').select_option('8')
                assert page.locator('#mirrorRows tr:visible').count() == 1
                assert page.locator('[data-mirror-unit-id]:visible').count() == 10
                first = page.locator('[data-mirror-unit-id]:visible').first;first.focus();page.keyboard.press('ArrowRight');page.keyboard.press('Enter')
                selected(page, next(u for u in catalog['units'] if u['floorIndex'] == 8 and u['final'] == '02'))
                page.evaluate('__livViewer.selectUnit(null)')
                assert page.locator('[data-mirror-unit-id][aria-pressed=true]').count() == 0
                page.locator('#floor').select_option('-1')
                assert not child(page).evaluate('__livProva.unitPicking.highlight.visible')
                assert source_snapshot(child(page)) == initial, 'Selection changed source geometry/materials/atlas'
                case['sourceUnchanged'] = True
                for typology in ['canto', 'meio']:
                    page.evaluate('t=>__livViewer.setTypology(t)', typology)
                    for mode in ['planta2d', 'planta3d', 'visita', 'maquete']:
                        page.evaluate('m=>__livViewer.setMode(m)', mode);ready(page, mode)
                        assert page.evaluate('__livViewer.typology') == typology
                        if mode != 'maquete':
                            assert 'sem vínculo com uma unidade específica' in page.locator('#interiorNote').inner_text()
                case['twoTypologiesFourModes'] = True
                unit = next(u for u in catalog['units'] if u['floorIndex'] == 16 and u['final'] == '10')
                page.locator('#mirrorFloor').select_option('todos')
                page.evaluate('id=>__livViewer.selectUnit(id)', unit['id']);selected(page, unit)
                page.reload();ready(page);selected(page, unit)
                page.locator('#buildingMirror').evaluate('(e)=>e.open=true')
                page.screenshot(path=str(output / f'{backend}-{touch}.png'), full_page=not touch)
                page.locator('.map-link').click()
                page.wait_for_function('window.__livMapAdapter?.ready', timeout=150000)
                assert 'unidades=edificio' in page.evaluate('__livMapAdapter.returnURL')
                page.go_back();ready(page);selected(page, unit)
                case['reloadAndMapReturn'] = True;case['status'] = 'PASS'
                assert not case['errors'], case['errors']
                context.close();(output / 'runtime.json').write_text(json.dumps(report, indent=2), encoding='utf8')
                print(json.dumps(case), flush=True)
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL';report['failure'] = repr(error);raise
    finally:
        (output / 'runtime.json').write_text(json.dumps(report, indent=2), encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias/catalogo-edificio')
    main(parser.parse_args().saida)
