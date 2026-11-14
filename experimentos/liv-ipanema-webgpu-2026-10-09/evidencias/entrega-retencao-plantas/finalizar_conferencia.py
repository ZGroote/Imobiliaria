"""Retoma somente diagnóstico/fallback após interrupção da conferência v12."""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent
EXP = OUTPUT.parent.parent
sys.path.insert(0, str(EXP))
from montar_entrega import verify
from servidor_medido import MeasuredServer
from playwright.sync_api import sync_playwright

report = json.loads((OUTPUT / 'runtime.json').read_bytes())
package = Path(report['packageDirectory'])
site = package / 'site'
manifest = json.loads((site / 'entrega-manifest.json').read_bytes())
assert manifest['version'] == report['packageVersion']
verify(site, manifest['files'], manifest=True)
verify(package / 'revisao', manifest['reviewFiles'])
assert report['httpVerifiedFiles'] == len(manifest['files'])
assert len(report['cases']) == 3 and all(c['status'] == 'PASS' for c in report['cases'])
assert report['packagedPbrAndDraco'] == report['baselineRecovery'] == 'PASS'
report['resumedAt'] = datetime.now(timezone.utc).isoformat()
report['completionRecipeSHA256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
server = MeasuredServer(site).start()
base = server.url.rstrip('/')
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
        assert browser.version == report['browserVersion']
        context = browser.new_context(viewport={'width':1280, 'height':900}, accept_downloads=True)
        page = context.new_page()
        page.goto(base + '/diagnostico.html')
        page.locator('#device').fill('Empacotamento QA — desktop')
        page.locator('#physical').select_option('desktop')
        page.locator('#backend').select_option('webgl')
        page.locator('#open').click()
        page.wait_for_function('__livDiagnostic.openings.at(-1)?.status==="carregado"', timeout=150000)
        page.locator('#segment').select_option('meio:visita')
        page.locator('#start').click()
        page.wait_for_function('!document.getElementById("stop").disabled', timeout=150000)
        page.evaluate('''async()=>{const p=document.querySelector('iframe').contentWindow.__livViewer.frame.contentWindow.__livInterior;
          await p.goToRoom(p.getRoomRoutes().filter(r=>r.reachable).sort((a,b)=>b.path.length-a.path.length)[0].id);}''')
        page.wait_for_timeout(1200)
        page.locator('#stop').click()
        with page.expect_download() as download:
            page.locator('#export').click()
        path = OUTPUT / 'diagnostico-empacotado.json'
        download.value.save_as(path)
        data = json.loads(path.read_bytes())
        assert data['qualification'] == 'pendente-de-revisao' and data['segments'][0]['physicalDevice'] is False
        assert data['segments'][0]['measurement']['cameraDisplacementMeters'] > .05
        assert not data['segments'][0]['interrupted']
        report['packagedDiagnostic'] = 'PASS'
        context.close()
        context = browser.new_context(viewport={'width':390, 'height':844})
        context.add_init_script("Object.defineProperty(navigator,'gpu',{get:()=>undefined});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl'||t==='webgl2'?null:get.call(this,t,...a);};")
        page = context.new_page()
        page.goto(base + '/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio')
        page.wait_for_function('window.__livViewer?.error', timeout=120000)
        page.locator('#fallback').click()
        page.wait_for_function('__livViewer.ready&&__livViewer.mode==="planta2d"', timeout=120000)
        assert page.locator('#stage img').is_visible()
        report['noGpu2DRecovery'] = 'PASS'
        context.close()
        browser.close()
    report['status'] = 'PASS'
except Exception as error:
    report.update(status='FAIL', failure=repr(error))
    raise
finally:
    server.close()
    (OUTPUT / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
print('PASS: diagnóstico e fallback; conferência v12 concluída.')
