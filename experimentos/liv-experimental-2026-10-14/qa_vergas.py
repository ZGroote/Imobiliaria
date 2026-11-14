"""Confere portas/janelas do LIV e Laranjeiras em WebGL2/WebGPU, dia/noite e viewport estreito."""
import argparse
import base64
from functools import partial
import http.server
import hashlib
import io
import json
import mimetypes
from pathlib import Path
import threading
from urllib.parse import urlsplit

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parents[2]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
SITES = [('liv', 'experimentos/liv-experimental-2026-10-14', ['canto', 'meio']),
         ('laranjeiras', 'experimentos/laranjeiras-2026-10-30/site', ['canto', 'meio', 'canto-espelhado', 'meio-espelhado'])]
POSE = """async kind=>{
 const api=__livInterior,{createLayout,inside}=await import('./interior-navigation.js');
 const unit=await (await fetch(`./interiores/${api.typology}/unidade.json`)).json(),layout=createLayout(unit);
 const openings=layout.joinery.filter(v=>v.y1<layout.pd-.1&&(kind==='porta'?v.porta&&!v.entrada:!v.porta));
 openings.sort((a,b)=>a.L-b.L);const v=openings[0];if(!v)throw Error('Vão de diagnóstico ausente');
 const mx=(v.a[0]+v.b[0])/2,mz=(v.a[1]+v.b[1])/2;
 const side=layout.rooms.some(r=>inside(r.poly,mx+v.nx*.6,mz+v.nz*.6))?1:-1;
 api.camera.position.set(mx+side*v.nx*.8,1.62,mz+side*v.nz*.8);
 api.camera.lookAt(mx+side*v.nx*.065,(v.y1+layout.pd)/2,mz+side*v.nz*.065);api.camera.updateMatrixWorld(true);
 return {opening:v.id,position:api.camera.position.toArray()};
}"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run(output, port, origin=None, package=None):
    output.mkdir(parents=True, exist_ok=True)
    base_url = origin.rstrip('/') if origin else f'http://127.0.0.1:{port}'
    server = None
    if not origin:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', port), partial(QuietHandler, directory=str(REPO)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
    report = {'status': 'RUNNING', 'environment': 'Chrome desktop; viewport estreito emulado, sem aparelho físico',
              'origin': base_url, 'packageOverlay': str(package) if package else None, 'cases': []}
    def overlay(route):
        path = (package / urlsplit(route.request.url).path.lstrip('/')).resolve()
        if path.is_relative_to(package) and path.is_file():
            route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:
            route.continue_()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
            try:
                for site, local_path, types in SITES:
                    path = {'liv': 'liv-classico', 'laranjeiras': 'laranjeiras'}[site] if origin else local_path
                    for typology in types:
                        for backend in ['webgl', 'webgpu']:
                            manifest_root = package / path if package else REPO / local_path
                            manifest = (manifest_root / f'interiores/{typology}/luz-horario/manifest.json').read_bytes()
                            assert json.loads(manifest).get('wallDenoise') == 'surface-plane-v1', 'Atlas ainda não corrigido'
                            context = browser.new_context(viewport={'width': 1188, 'height': 800})
                            if package:
                                context.route(origin.rstrip('/') + '/**', overlay)
                            page = context.new_page()
                            case = {'site': site, 'typology': typology, 'backend': backend,
                                    'manifestSHA256': hashlib.sha256(manifest).hexdigest(), 'errors': [], 'frames': []}
                            report['cases'].append(case)
                            page.on('pageerror', lambda error, case=case: case['errors'].append(str(error)))
                            try:
                                page.goto(f'{base_url}/{path}/interior.html?tipologia={typology}&backend={backend}')
                                page.wait_for_function('()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready}', timeout=120000)
                                page.evaluate("()=>{__livInterior.setActive(false);__livInterior.setMode('visita')}")
                                for hour in [14, 22]:
                                    page.evaluate('hour=>__livInterior.setTimeOfDay(hour)', hour)
                                    if hour == 22:
                                        page.wait_for_function("()=>__livInterior.getState().lighting.timeLight.loaded.includes('noite')", timeout=60000)
                                    for kind in ['porta', 'janela']:
                                        page.evaluate('__livInterior.capture()')
                                        pose = page.evaluate(POSE, kind)
                                        encoded = page.evaluate('async()=>{await new Promise(requestAnimationFrame);return __livInterior.capture()}')
                                        raw = base64.b64decode(encoded.split(',', 1)[1])
                                        image = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'))
                                        assert image.std() > 5, 'Captura vazia'
                                        filename = f'{site}-{typology}-{backend}-{hour}-{kind}.png'
                                        (output / filename).write_bytes(raw)
                                        case['frames'].append({'hour': hour, 'kind': kind, 'image': filename, 'pose': pose})
                                page.set_viewport_size({'width': 390, 'height': 844})
                                page.evaluate('async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)}')
                                page.evaluate(POSE, 'porta')
                                encoded = page.evaluate('async()=>{await new Promise(requestAnimationFrame);return __livInterior.capture()}')
                                (output / f'{site}-{typology}-{backend}-estreito.png').write_bytes(base64.b64decode(encoded.split(',', 1)[1]))
                                state = page.evaluate('__livInterior.getState()')
                                assert state['backend'] == backend and state['lighting']['bakedActive'], state['lighting']
                                assert not case['errors'], case['errors']
                                case.update(status='PASS', sourceSHA256=state['sourceSHA256'])
                                print(site, typology, backend, 'PASS', flush=True)
                            except Exception as error:
                                case.update(status='FAIL', error=str(error))
                                raise
                            finally:
                                context.close()
            finally:
                browser.close()
        report['status'] = 'PASS'
    finally:
        if server:
            server.shutdown()
        (output / 'runtime.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path(__file__).resolve().parent / 'evidencias/vergas')
    parser.add_argument('--port', type=int, default=8793)
    parser.add_argument('--origin', help='Origem publicada para validar no ar')
    parser.add_argument('--package', type=Path, help='Sobrepõe o pacote no navegador sem publicar')
    args = parser.parse_args()
    assert not args.package or args.origin, '--package exige --origin'
    run(args.out, args.port, args.origin, args.package.resolve() if args.package else None)
