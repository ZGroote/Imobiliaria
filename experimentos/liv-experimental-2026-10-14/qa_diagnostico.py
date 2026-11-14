"""Exercita o coletor no desktop e toque emulado; não declara teste físico."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/diagnostico.html'


def main(output):
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'RUNNING', 'recordedAt': datetime.now(timezone.utc).isoformat(), 'physicalMobile': False,
              'sources': {p: hashlib.sha256((EXP / p).read_bytes()).hexdigest() for p in
                          ['diagnostico.html', 'diagnostico.js', 'diagnostic-recorder.js', 'viewer.js', 'renderer.js', 'interior-renderer.js']}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            report['browserVersion'] = browser.version
            for backend, touch in [('webgpu', False), ('webgl', False), ('auto', True)]:
                errors = []
                context = browser.new_context(viewport={'width': 390 if touch else 1280, 'height': 844 if touch else 900},
                                              device_scale_factor=1, is_mobile=touch, has_touch=touch, accept_downloads=True)
                page = context.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(URL, wait_until='load')
                page.locator('#device').fill('Desktop QA · toque emulado' if touch else 'Desktop QA')
                page.locator('#physical').select_option('emulado' if touch else 'desktop')
                page.locator('#backend').select_option(backend)
                page.locator('#open').click()
                page.wait_for_function('__livDiagnostic.openings.at(-1)?.status==="carregado"', timeout=150000)
                for segment in ['maquete', 'canto:visita', 'meio:visita', 'canto:planta2d', 'meio:planta3d']:
                    page.locator('#segment').select_option(segment); page.locator('#start').click()
                    page.wait_for_function('!document.getElementById("stop").disabled', timeout=150000)
                    if ':visita' in segment:
                        page.evaluate('''async()=>{
                          const api=document.querySelector('iframe').contentWindow.__livViewer.frame.contentWindow.__livInterior;
                          const targets=api.getRoomRoutes().filter(r=>r.reachable);
                          const route=targets.sort((a,b)=>b.path.length-a.path.length)[0];
                          await api.goToRoom(route.id);
                        }''')
                    page.wait_for_timeout(1200);page.locator('#stop').click()
                with page.expect_download() as download:
                    page.locator('#export').click()
                target = output / f'{backend}-{touch}-aparelho.json'; download.value.save_as(target)
                data = json.loads(target.read_bytes())
                assert data['qualification'] == 'pendente-de-revisao'
                assert len(data['segments']) == 5 and not data['failures'] and not errors, (data['failures'], errors)
                assert all(not s['physicalDevice'] and not s['interrupted'] for s in data['segments'])
                for sample in data['segments']:
                    if sample['measurement']:
                        assert sample['measurement']['submissions'] > 0, sample['label']
                        assert sample['measurement']['cpuSubmitMs']['count'] > 0, sample['label']
                    if ':visita' in sample['label']:
                        assert sample['measurement']['submissions'] > 30, sample['label']
                        assert sample['measurement']['cameraDisplacementMeters'] > .05, sample['label']
                report['cases'].append({'backend': backend, 'touchEmulated': touch, 'segments': len(data['segments']),
                                        'physicalDeviceDeclared': False, 'errors': errors, 'status': 'PASS'})
                context.close()
                (output / 'runtime.json').write_text(json.dumps(report, indent=2), encoding='utf8')
                print(json.dumps(report['cases'][-1]), flush=True)
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL'; report['failure'] = repr(error); raise
    finally:
        (output / 'runtime.json').write_text(json.dumps(report, indent=2), encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias/diagnostico-aparelho')
    main(parser.parse_args().saida)
