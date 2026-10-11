"""Tabela comercial sintética em perfil privado; não altera comercial.json."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from qa_unidades import ready

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html'


def main(output):
    output.mkdir(parents=True, exist_ok=True)
    original = (EXP / 'comercial.json').read_bytes()
    pilot = json.loads((EXP / 'modelo/entrada/unidades-entrada.json').read_bytes())
    ids = [f'liv-ipanema/pavimento-modelo-{floor:02}/final-{final:02}' for floor, final in [(0, 1), (8, 2), (16, 10), (1, 4)]]
    fixture = {'schema': 'liv-commercial-v1', 'status': 'fornecido', 'bookSHA256': pilot['source']['bookSHA256'],
               'source': {'label': 'FIXTURE SINTETICA - SEM OFERTA REAL', 'asOf': '2026-10-11'}, 'units': [
                   {'id': id_, 'availability': status, 'priceCents': 100001 + i, 'commercialNumber': f'TESTE-{i}',
                    'conditions': '<img src=x onerror=alert(1)> EXEMPLO'} for i, (id_, status) in
                   enumerate(zip(ids, ['disponivel', 'reservada', 'vendida', 'bloqueada']))]}
    report = {'status': 'RUNNING', 'physicalMobile': False, 'syntheticCommercialOnly': True,
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'sources': {name: hashlib.sha256((EXP / name).read_bytes()).hexdigest()
                  for name in ['comercial.js', 'comercial.json', 'viewer.js', 'unit-ui.js', 'espelho.js', 'maquete-liv-ipanema.html', 'unit-ui.css', 'qa_comercial.py']}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            report['browserVersion'] = browser.version
            for backend, touch in [('webgpu', False), ('webgl', False), ('auto', True)]:
                context = browser.new_context(viewport={'width': 390 if touch else 1440, 'height': 844 if touch else 900},
                                              is_mobile=touch, has_touch=touch, device_scale_factor=1)
                page = context.new_page(); errors = []; page.on('pageerror', lambda error: errors.append(str(error)))
                payload = {'data': fixture, 'status': 200}
                page.route('**/comercial.json', lambda route: route.fulfill(status=payload['status'], content_type='application/json', body=json.dumps(payload['data'])))
                page.goto(URL + f'?geometria=entrada&unidades=edificio&backend={backend}');ready(page)
                page.wait_for_function('__livViewer.commercialStatus==="fornecido"')
                page.locator('#buildingMirror').evaluate('(e)=>e.open=true')
                for id_, expected in zip(ids, ['disponivel', 'reservada', 'vendida', 'bloqueada']):
                    page.locator(f'[data-mirror-unit-id="{id_}"]').click()
                    assert page.evaluate('__livViewer.selectedUnitId') == id_
                    assert page.locator('[data-unit-id][aria-pressed=true]').get_attribute('data-availability') == expected
                    assert page.locator(f'[data-mirror-unit-id="{id_}"]').get_attribute('data-availability') == expected
                    assert page.locator('#unitSale').inner_text() in page.locator('#selectedUnitLabel').inner_text()
                    assert 'FIXTURE SINTETICA' in page.locator('#commercialSource').inner_text()
                    assert '<img' in page.locator('#commercialConditions').inner_text()
                    assert page.locator('#commercialConditions img').count() == 0
                page.locator('#mirrorAvailability').select_option('vendida')
                assert page.locator('[data-mirror-unit-id]:visible').count() == 1
                assert page.locator('[data-mirror-unit-id]:visible').get_attribute('data-mirror-unit-id') == ids[2]
                invalid = json.loads(json.dumps(fixture)); invalid['units'].append(invalid['units'][0])
                payload['data'] = invalid
                assert page.evaluate('__livViewer.reloadCommercial()') is False
                assert page.locator('#commercialWarning').is_visible()
                assert len(page.evaluate('__livViewer.units.units.filter(u=>u.commercial.availability!=="nao_informada")')) == 4
                payload['status'] = 503
                assert page.evaluate('__livViewer.reloadCommercial()') is False
                assert page.evaluate('__livViewer.ready') is True
                payload.update(data=fixture, status=200)
                assert page.evaluate('__livViewer.reloadCommercial()') is True
                assert page.locator('#commercialWarning').is_hidden()
                page.locator('#mirrorAvailability').select_option('todos')
                page.evaluate('__livViewer.setMode("planta2d")');ready(page, 'planta2d')
                page.evaluate('__livViewer.setMode("maquete")');ready(page)
                assert len(page.evaluate('__livViewer.units.units.filter(u=>u.commercial.availability!=="nao_informada")')) == 4
                case = {'backendRequested': backend, 'touchEmulated': touch, 'syntheticRecords': 4,
                        'filters': True, 'invalidAndHTTPRecovery': True, 'textRenderedSafely': True, 'sourceFileUnchanged': True,
                        'errors': errors, 'status': 'PASS'}
                assert not errors, errors;report['cases'].append(case);context.close();print(json.dumps(case), flush=True)
            browser.close()
        assert (EXP / 'comercial.json').read_bytes() == original
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL';report['failure'] = repr(error);raise
    finally:
        (output / 'runtime.json').write_text(json.dumps(report, indent=2), encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias/comercial-sintetico')
    main(parser.parse_args().saida)
