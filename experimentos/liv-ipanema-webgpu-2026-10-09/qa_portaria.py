"""Acesso próximo: PBR nativo, enquadramento, gestos, sessão e descarte.

Chrome descartável; o perfil de toque é emulado em desktop.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from qa_refinamento import (EXP, ROOT, BASE_URL, SNAPSHOT, check_finish,
                           compare, png, sha, same_camera, wait_proof, wait_viewer)

PROFILES = {'desktop-webgpu': ('webgpu', 1440, 900), 'desktop-webgl': ('webgl', 1440, 900),
            'toque': ('auto', 390, 844)}
FILES = ['qa_portaria.py', 'qa_refinamento.py', 'renderer.js', 'viewer.js', 'cameras.js',
         'exterior-finishes.js', 'maquete-liv-ipanema.html', 'prova-rgbm.html', 'material-rgbm.js',
         'picking.js', 'unidades.json', 'transfer-manifest.json', 'interiores/catalogo.json',
         'assets-prova/scene.json.gz', 'assets-prova/irradiance.rgbm.gz', 'assets-prova/manifest.json']


def settle(page):
    page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def frame_bounds(page):
    return page.evaluate("""async()=>{
      const {Vector3}=await import('./node_modules/three/build/three.webgpu.js');
      const {ENTRY_DETAIL_BOUNDS:b}=await import('./cameras.js');
      const p=__livProva,points=[];
      p.camera.updateMatrixWorld();
      for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]])
        points.push(new Vector3(x,y,z).project(p.camera).toArray());
      return {points,aspect:p.camera.aspect,camera:p.getState().camera};
    }""")


def sheet(output, paths, reference):
    canvas = Image.new('RGB', (1536, 570), '#102030')
    draw = ImageDraw.Draw(canvas)
    for i, (path, label) in enumerate(zip([reference, *paths], ['Render oficial', 'Modelo: acabamento base', 'Modelo: PBR revisado'])):
        draw.text((i * 512 + 16, 16), label, fill='white')
        with Image.open(path) as source:
            content = source.convert('RGBA'); content.thumbnail((500, 460))
            background = Image.new('RGBA', content.size, '#dce2e1'); background.alpha_composite(content)
            canvas.paste(background.convert('RGB'), (i * 512 + (512-content.width)//2, 60+(460-content.height)//2))
    draw.text((16, 538), 'Fonte e modelo têm luz/câmera distintas. Base/PBR usam a mesma câmera; a forma da entrada ainda é aproximada.', fill='white')
    path = output / 'comparativo-acesso.png'; canvas.save(path)
    return {'file': path.name, 'sha256': sha(path)}


def run_case(browser, name, backend, width, height, output, report):
    case = {'profile': name, 'backendRequested': backend, 'viewport': [width, height],
            'status': 'RUNNING', 'errors': [], 'httpFailures': []}
    report['cases'].append(case)
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  is_mobile=name == 'toque', has_touch=name == 'toque')
    page = context.new_page()
    def press(selector):
        control = page.locator(selector)
        control.tap() if name == 'toque' else control.click()
    page.on('pageerror', lambda error: case['errors'].append(str(error)))
    page.on('response', lambda response: case['httpFailures'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    snapshots, paths = {}, []
    for profile in ['base', 'referencia']:
        page.goto(BASE_URL + f'prova-rgbm.html?embedded=1&backend={backend}&acabamento={profile}', wait_until='load')
        wait_proof(page); page.evaluate("__livProva.setView('acesso')"); settle(page)
        snapshots[profile] = page.evaluate(SNAPSHOT); check_finish(snapshots[profile], profile)
        assert snapshots[profile]['state']['view'] == 'acesso'
        if backend != 'auto':
            assert snapshots[profile]['backend'] == backend
        path = output / f'{name}-acesso-{profile}.png'; paths.append(path)
        case[profile] = {'capture': png(page, path), 'camera': snapshots[profile]['state']['camera'],
                         'finish': snapshots[profile]['finish']}
        if profile == 'referencia':
            case['frames'] = []
            for w, h in [(320, 568), (390, 844), (768, 1024), (1024, 768), (1440, 900)]:
                page.set_viewport_size({'width': w, 'height': h}); settle(page)
                bounds = frame_bounds(page)
                assert all(abs(x) < .99 and abs(y) < .99 and -1 < z < 1 for x, y, z in bounds['points']), bounds
                case['frames'].append({'viewport': [w, h], **bounds})
        page.evaluate('__livProva.dispose()')
    case['comparison'] = compare(snapshots['base'], snapshots['referencia'], paths)
    if name == 'desktop-webgpu':
        case['referenceSheet'] = sheet(output, paths, ROOT/'v1.5/miniaturas/liv-ipanema/referencias/portaria.jpg')
    page.set_viewport_size({'width': width, 'height': height})
    page.goto(BASE_URL + f'maquete-liv-ipanema.html?backend={backend}', wait_until='load'); wait_viewer(page, 'maquete')
    press('[data-unit-id$="final-06"]')
    selected = page.evaluate('__livViewer.selectedUnitId')
    assert selected and selected.endswith('/final-06'), selected
    press('[data-view="acesso"]'); settle(page)
    initial = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
    assert initial['view'] == 'acesso' and initial['selectedUnitId'] == selected and initial['floor'] == 1, initial
    page.evaluate("""()=>{
      const p=__livViewer.frame.contentWindow.__livProva;
      const targets=p.meshes.filter(mesh=>mesh.material.userData.livReferenceFinish);
      const originals=[...new Set(targets.map(mesh=>p.materials[p.data.meshes[p.meshes.indexOf(mesh)].material]))];
      window.__qaAccessDisposal=[...targets.map(mesh=>mesh.material),...originals,p.atlas].map(resource=>{
        const record={type:resource.type,disposed:0};resource.addEventListener('dispose',()=>record.disposed++);return record;
      });
    }""")
    press('[data-mode="planta2d"]'); wait_viewer(page, 'planta2d')
    page.wait_for_function('__qaAccessDisposal.every(resource=>resource.disposed===1)', timeout=15000)
    case['disposal'] = page.evaluate('__qaAccessDisposal')
    assert len(case['disposal']) == 6, case['disposal']
    press('[data-mode="maquete"]'); wait_viewer(page, 'maquete')
    restored = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
    assert restored['view'] == 'acesso' and restored['selectedUnitId'] == selected
    assert same_camera(initial['camera'], restored['camera'])
    page.reload(wait_until='load'); wait_viewer(page, 'maquete')
    reloaded = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
    assert reloaded['view'] == 'acesso' and reloaded['selectedUnitId'] == selected
    assert same_camera(restored['camera'], reloaded['camera'])
    page.evaluate('scrollTo(0,0)')
    box = page.locator('#stage iframe').bounding_box()
    x, y = box['x']+box['width']*.5, box['y']+box['height']*.6
    if name == 'toque':
        cdp = context.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x+i*6, 'y': y+i, 'id': 1}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        case['touchOrbit'] = True
    else:
        page.mouse.move(x, y); page.mouse.down()
        page.mouse.move(x+box['width']*.15, y+box['height']*.04, steps=8); page.mouse.up()
    settle(page)
    manual = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
    assert manual['view'] == 'livre' and manual['selectedUnitId'] == selected
    assert manual['camera']['position'] != reloaded['camera']['position']
    page.set_viewport_size({'width': height, 'height': width}); settle(page)
    resized = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
    for key in ['position', 'target', 'fov']:
        assert same_camera(manual['camera'][key], resized['camera'][key])
    press('[data-view="acesso"]'); settle(page)
    case['layout'] = page.evaluate("""()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,
      pressed:document.querySelector('[data-view="acesso"]').getAttribute('aria-pressed'),
      height:document.querySelector('[data-view="acesso"]').getBoundingClientRect().height})""")
    assert not case['layout']['overflow'] and case['layout']['pressed'] == 'true' and case['layout']['height'] >= 44
    case['integrated'] = {'selectionPreserved': selected, 'cameraRestored': True, 'sessionRestored': True,
                          'manualOrbitPreservedOnResize': True, 'oneActiveFrame': page.locator('iframe').count() == 1}
    assert case['integrated']['oneActiveFrame'] and not case['errors'] and not case['httpFailures'], case
    page.screenshot(path=str(output/f'{name}-integrado-acesso.png'), full_page=True)
    case['status'] = 'PASS'; context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--perfil', choices=['todos', *PROFILES], default='todos')
    parser.add_argument('--saida', type=Path, default=EXP/'evidencias'/'portaria-final')
    args = parser.parse_args(); args.saida.mkdir(parents=True, exist_ok=True)
    reference = ROOT/'v1.5/miniaturas/liv-ipanema/referencias/portaria.jpg'
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING', 'physicalMobile': False,
              'sourceSHA256': {name: sha(EXP/name) for name in FILES},
              'reference': {'path': str(reference), 'sha256': sha(reference),
                            'source': 'https://www.livonincorporadora.com.br/produtos/liv-ipanema/'},
              'limitations': ['Parâmetros PBR estimados; reflexo/cor não foram medidos na fonte.',
                              'Vidros continuam opacos; forma da entrada, posição da placa e cores da marca pendentes.',
                              'Enquadramento de uma caixa aproximada, sem cotas/câmera executivas.',
                              'Toque emulado; não mede FPS ou ganho de abertura e não qualifica Poco X6/iPhone físicos.'], 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            report['browserVersion'] = browser.version
            for name, (backend, width, height) in PROFILES.items():
                if args.perfil in ['todos', name]:
                    run_case(browser, name, backend, width, height, args.saida, report)
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL'; report['failure'] = str(error); raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}), flush=True)


if __name__ == '__main__':
    main()
