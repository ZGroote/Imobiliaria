"""Dia/entardecer: materiais padrão, reversão visual, sombras estáticas e sessão."""
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
from qa_unidades import ready, child, source_snapshot

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html'


def capture(frame, path):
    raw = base64.b64decode(frame.evaluate('''async()=>{
      await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
      return __livProva.capture(false);
    }''').split(',', 1)[1])
    path.write_bytes(raw)
    pixels = np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA'), dtype=np.int16)
    assert pixels[..., :3].std() > 3
    return pixels


def main(output):
    output.mkdir(parents=True, exist_ok=True)
    paths = ['ambiencia.js', 'ambiencia-perfis.js', 'renderer.js', 'viewer.js', 'mapa-retorno.js',
             'maquete-liv-ipanema.html', 'qa_ambiencia.py']
    report = {'status': 'RUNNING', 'physicalMobile': False, 'recordedAt': datetime.now(timezone.utc).isoformat(),
              'sources': {p: hashlib.sha256((EXP/p).read_bytes()).hexdigest() for p in paths}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            report['browserVersion'] = browser.version
            for backend, touch in [('webgpu', False), ('webgl', False), ('auto', True)]:
                case = {'backendRequested': backend, 'touchEmulated': touch, 'errors': [], 'views': []}
                report['cases'].append(case)
                context = browser.new_context(viewport={'width': 390 if touch else 1440, 'height': 844 if touch else 900},
                                              is_mobile=touch, has_touch=touch, device_scale_factor=1)
                page = context.new_page();page.on('pageerror', lambda error: case['errors'].append(str(error)))
                page.goto(URL+f'?geometria=entrada&unidades=edificio&backend={backend}&luz=dia');ready(page)
                page.evaluate('async()=>{await __livTransfers.pause()}')
                frame = child(page)
                case['backendEffective'] = frame.evaluate('__livProva.backend')
                initial = source_snapshot(frame)
                frame.evaluate('''()=>{
                  const p=__livProva;p.renderer.setAnimationLoop(null);
                  window.__qaShadowUpdates=0;
                  p.scene.traverse(o=>{if(o.isLight&&o.castShadow){const fn=o.shadow.updateMatrices.bind(o.shadow);
                    o.shadow.updateMatrices=(...args)=>{__qaShadowUpdates++;return fn(...args);};}});
                }''')
                requests=[];page.on('request', lambda request: requests.append(request.url))
                prefix=f'{backend}-{touch}'
                for view in ['perspectiva','varandas','acesso']:
                    page.evaluate('view=>__livViewer.setView(view)',view)
                    day=capture(frame,output/f'{prefix}-{view}-dia.png')
                    page.locator('#ambience').select_option('entardecer')
                    sunset=capture(frame,output/f'{prefix}-{view}-entardecer.png')
                    difference=float(np.abs(day-sunset).mean());assert difference>2,(view,difference)
                    page.locator('#ambience').select_option('dia')
                    restored=capture(frame,output/f'{prefix}-{view}-dia-restaurado.png')
                    delta=int(np.abs(day-restored).max());assert delta<=1,(view,delta)
                    assert source_snapshot(frame)==initial
                    case['views'].append({'view':view,'meanRgbaChange':difference,'restoredMaxDelta':delta})
                assert frame.evaluate('__qaShadowUpdates')==0
                assert not any('irradiance.rgbm' in u or 'ambiente.f16' in u for u in requests), requests
                case['shadowUpdatesOnChange']=0;case['additionalAtlasOrEnvironmentDownloads']=0
                page.locator('[data-unit-id]').first.click()
                selected=page.evaluate('__livViewer.selectedUnitId')
                page.locator('#ambience').select_option('entardecer')
                assert frame.evaluate('__livProva.unitPicking.getState().active')
                # Repeat without creating other scenes or replacing materials.
                case['uniformChangeMs']=page.evaluate('''()=>{
                  const start=performance.now();for(let i=0;i<20;i++)__livViewer.setAmbience(i%2?'entardecer':'dia');
                  return performance.now()-start;
                }''')
                assert frame.evaluate('__livProva.ambience')=='entardecer'
                for typology in ['canto','meio']:
                    page.evaluate('id=>__livViewer.setTypology(id)',typology)
                    for mode in ['planta2d','planta3d','visita']:
                        page.evaluate('mode=>__livViewer.setMode(mode)',mode);ready(page,mode)
                        assert page.locator('#ambience').is_disabled()
                    page.evaluate('__livViewer.setMode("maquete")');ready(page)
                    assert child(page).evaluate('__livProva.ambience')=='entardecer'
                    assert page.evaluate('__livViewer.selectedUnitId')==selected
                page.reload();ready(page)
                assert child(page).evaluate('__livProva.ambience')=='dia'  # explicit query wins
                page.locator('#ambience').select_option('entardecer')
                page.locator('.map-link').click()
                page.wait_for_function('window.__livMapAdapter?.ready',timeout=120000)
                assert 'luz=entardecer' in page.evaluate('__livMapAdapter.returnURL')
                page.goto(page.evaluate('__livMapAdapter.returnURL'));ready(page)
                assert page.evaluate('__livViewer.ambience')=='entardecer'
                assert child(page).evaluate('__livProva.ambience')=='entardecer'
                assert page.evaluate('__livViewer.selectedUnitId')==selected
                assert not case['errors'],case['errors']
                case['status']='PASS';context.close()
                (output/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(case),flush=True)
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=repr(error);raise
    finally:
        (output/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,default=EXP/'evidencias/ambiencia')
    main(parser.parse_args().saida)
