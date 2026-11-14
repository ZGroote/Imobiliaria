"""QA integrado de canto/meio, navegação, móveis e descarte dos interiores.

Chrome usa um perfil descartável. Toque é emulado, não qualificação de celular físico.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES = {
    'desktop-webgpu': (1440, 900, 'webgpu'),
    'desktop-webgl': (1440, 900, 'webgl'),
    'toque': (390, 844, 'auto'),
}


def ready(page, mode, typology=None):
    page.wait_for_function('''expected=>{
        const api=window.__livViewer;
        if(api?.error)throw Error(api.error);
        return api?.ready&&api.mode===expected.mode&&
          (!expected.typology||api.typology===expected.typology);
    }''', arg={'mode': mode, 'typology': typology}, timeout=120000)
    count = page.locator('#stage iframe:not([hidden])').count()
    assert count == (0 if mode == 'planta2d' else 1), {'mode': mode, 'iframes': count}


def interior_frame(page):
    return page.locator('#stage iframe:not([hidden])').element_handle().content_frame()


def snapshot(page):
    return page.evaluate('''()=>{
        const api=__livViewer.frame?.contentWindow.__livInterior;
        if(!api?.ready)throw Error('Interior não pronto.');
        return api.getState();
    }''')


def drag(page, locator, mobile):
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    assert box and box['width'] > 50 and box['height'] > 50, box
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    if mobile:
        session = page.context.new_cdp_session(page)
        try:
            session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            for i in range(1, 8):
                session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [
                    {'x': x + 65 * i / 7, 'y': y + 14 * i / 7}]})
                page.wait_for_timeout(25)
            session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        finally:
            session.detach()
    else:
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 65, y + 14, steps=7)
        page.mouse.up()
    page.wait_for_timeout(250)


def decoded_png(path):
    with Image.open(path) as image:
        image.load()
        assert image.format == 'PNG' and min(image.size) >= 200, str(path)
        variance = max(ImageStat.Stat(image.convert('RGB')).var)
        assert variance > 10, {'file': str(path), 'variance': variance}
        return {'file': path.name, 'size': list(image.size), 'maxRgbVariance': variance,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def capture(page, path):
    with page.expect_download(timeout=20000) as download:
        page.locator('#capture').click()
    download.value.save_as(path)
    return decoded_png(path)


def geometry_signature(page):
    # This comes from rendered buffers/matrices, independent of a declared layout hash.
    return page.evaluate('''async()=>{
        const api=__livViewer.frame.contentWindow.__livInterior;
        const scene=api.scene||api.renderer?.scene;
        if(!scene)throw Error('API não expõe a cena para conferir geometria.');
        const meshes=[];
        scene.updateMatrixWorld(true);
        scene.traverse(object=>{
            if(!object.isMesh)return;
            const positions=object.geometry?.getAttribute('position');
            if(!positions)return;
            meshes.push({name:object.name,positions:Array.from(positions.array),
                indices:object.geometry.index?Array.from(object.geometry.index.array):null,
                world:object.matrixWorld.toArray()});
        });
        if(!meshes.length)throw Error('Interior sem geometria renderizada.');
        meshes.sort((a,b)=>a.name.localeCompare(b.name));
        const bytes=new TextEncoder().encode(JSON.stringify(meshes));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        return {sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),
            meshes:meshes.length,vertices:meshes.reduce((sum,m)=>sum+m.positions.length/3,0)};
    }''')


def assert_suspended_old(page):
    assert page.evaluate('window.__qaOldInterior?.ready&&!__qaOldInterior.active&&!__qaOldInterior.disposed'), 'Cena anterior não foi preservada e pausada.'


def save_layout(page, out, name, mobile):
    # Chrome 154 fullPage screenshot changes touch media emulation; use the viewport on touch.
    page.screenshot(path=str(out / name), full_page=not mobile)


def source_hashes():
    names = {'viewer.js', 'maquete-liv-ipanema.html', 'interior.html', 'interior.js',
             'interior-navigation.js', 'interior-camera.js', 'interior-geometria.js', 'interior-catalogo.js',
             'tipologias.js', 'gerar_pacote_interiores.py', 'gerar_manifesto_transferencias.py',
             'transfers.js', 'transfer-worker.js', 'transfer-manifest.json', 'qa_interiores.py'}
    names.update(path.name for path in EXP.glob('interior*.js'))
    paths = {EXP / name for name in sorted(names) if (EXP / name).is_file()}
    catalog_path = EXP / 'interiores' / 'catalogo.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    paths.add(catalog_path)
    records = list(catalog['shared'].values())
    records += [record for item in catalog['tipologias'].values() for record in item['files'].values()]
    for record in records:
        path = EXP / record['path']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == record['sha256'], record['path']
        assert path.stat().st_size == record['bytes'], record['path']
        paths.add(path)
    paths.update((EXP / 'interiores' / 'meio').glob('*.json'))
    paths.update((EXP / 'interiores' / 'meio').glob('*.ts'))
    paths.update((EXP / 'plantas2d').glob('*'))
    return {str(path.relative_to(EXP)).replace('\\', '/'): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(paths) if path.is_file()}


def image_catalog():
    manifest = json.loads((EXP / 'plantas2d' / 'manifest.json').read_text(encoding='utf-8'))
    result = {}
    for name, item in manifest['files'].items():
        path = EXP / 'plantas2d' / name
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest == item['sha256'] and path.stat().st_size == item['bytes'], str(path)
        result[item['typology']] = {'path': 'plantas2d/' + name, 'sha256': digest, 'bytes': item['bytes']}
    assert set(result) == {'canto', 'meio'}, 'As duas plantas comerciais devem estar no manifesto.'
    assert result['canto']['sha256'] != result['meio']['sha256'], 'Canto e meio não podem mostrar a mesma planta.'
    return result


def rendered_image(page, expected):
    observed = page.evaluate('''async()=>{
        const image=document.querySelector('#stage img');
        if(!image?.complete||!image.naturalWidth)throw Error('Planta 2D não decodificada.');
        const response=await fetch(image.currentSrc||image.src);
        if(!response.ok)throw Error('Planta 2D indisponível.');
        const bytes=await response.arrayBuffer();
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        return {src:image.currentSrc||image.src,alt:image.alt,width:image.naturalWidth,height:image.naturalHeight,
            bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
    }''')
    assert observed['sha256'] == expected['sha256'] and observed['bytes'] == expected['bytes'], observed
    assert observed['width'] > 100 and observed['height'] > 100, observed
    return observed


def interior_state(frame):
    return frame.evaluate('__livInterior.getState()')


def camera_state(frame):
    return frame.evaluate('JSON.stringify(__livInterior.getState().camera)')


def hold_touch(page, locator, duration_ms=350):
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    session = page.context.new_cdp_session(page)
    try:
        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        page.wait_for_timeout(duration_ms)
        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    finally:
        session.detach()


def assert_identity(details, typology):
    assert details['typology'] == typology, details
    for field in ['sourceSHA256', 'unitSHA256']:
        value = details[field]
        assert isinstance(value, str) and len(value) == 64 and all(c in '0123456789abcdef' for c in value.lower()), details
    assert details['geometry']['objects'] > 0 and details['geometry']['vertices'] > 0, details


def furniture_test(frame, typology):
    baseline = interior_state(frame)
    assert baseline['lighting']['bakedActive'], baseline['lighting']
    furniture = baseline['furniture']
    assert furniture, 'Interior sem móveis selecionáveis.'
    if not frame.locator('#furniture-panel').evaluate('node=>node.open'):
        frame.locator('#furniture-panel summary').click()
    options = frame.locator('#furniture-select option').evaluate_all('nodes=>nodes.map(n=>n.value).filter(Boolean)')
    assert options, 'Seletor de móveis vazio.'
    frame.locator('#furniture-select').select_option(options[0])
    frame.locator('#furniture-right').click()
    moved = interior_state(frame)
    assert moved['furniture'] != furniture, 'O botão de mover não alterou o móvel.'
    assert moved['lighting']['bakedActive'], 'Mover o móvel desligou a luz gravada.'
    frame.locator('#furniture-rotate').click()
    rotated = interior_state(frame)
    assert rotated['furniture'] != moved['furniture'], 'O botão de girar não alterou o móvel.'
    frame.evaluate('''()=>{const api=__livInterior,original=api.getRoomRoutes;
        window.__qaRestoreRouteQueries=0;api.getRoomRoutes=function(...args){__qaRestoreRouteQueries++;return original(...args);};}''')
    frame.locator('#furniture-reset').click()
    queries = frame.evaluate('__qaRestoreRouteQueries')
    assert queries == 1, f'Restaurar o conjunto recalculou as rotas {queries} vezes.'
    reset = interior_state(frame)
    assert reset['furniture'] == furniture, 'Reset não restaurou a posição e rotação originais.'
    assert reset['lighting']['bakedActive'], reset['lighting']
    frame.locator('#furniture-panel summary').click()
    return {'selectedFurniture': options[0], 'movementChanged': True, 'rotationChanged': True,
            'bakeAfterMove': moved['lighting'], 'bakeAfterReset': reset['lighting'], 'resetExact': True,
            'restoreRouteQueries': queries}


def rooms_test(page, frame, mobile):
    options = frame.locator('#room-select option').evaluate_all('nodes=>nodes.map(n=>({id:n.value,label:n.textContent})).filter(n=>n.id)')
    assert len(options) == 6 and len({room['id'] for room in options}) == 6, options
    routes = frame.evaluate('__livInterior.getRoomRoutes()')
    visits = []
    for room in options:
        target = next(item['target'] for item in interior_state(frame)['rooms'] if item['id'] == room['id'])
        assert target is not None, room
        frame.locator('#room-select').select_option(room['id'])
        frame.locator('#room-go').click()
        frame.wait_for_function('''target=>{
            const navigation=__livInterior.navigationDiagnostics();
            if(!navigation.safe)throw Error('A rota atravessou uma região bloqueada.');
            return Math.hypot(navigation.current[0]-target[0],navigation.current[1]-target[1])<.16;
        }''', arg=target, timeout=30000)
        diagnostics = frame.evaluate('__livInterior.navigationDiagnostics()')
        details = interior_state(frame)
        assert diagnostics['safe'], {'room': room, 'diagnostics': diagnostics}
        assert all(item['reachable'] for item in details['rooms']), details['rooms']
        visits.append({'room': room, 'camera': details['camera'], 'navigation': diagnostics})
    # Start from a named safe target, then walk through actual keyboard/touch input.
    frame.locator('#room-select').select_option(options[0]['id'])
    frame.locator('#room-go').click()
    target = next(item['target'] for item in interior_state(frame)['rooms'] if item['id'] == options[0]['id'])
    frame.wait_for_function('''target=>{
        const navigation=__livInterior.navigationDiagnostics();
        if(!navigation.safe)throw Error('Caminho inicial inseguro.');
        return Math.hypot(navigation.current[0]-target[0],navigation.current[1]-target[1])<.16;
    }''', arg=target, timeout=30000)
    before = camera_state(frame)
    moved = False
    for direction, key in [('forward', 'w'), ('back', 's'), ('left', 'a'), ('right', 'd')]:
        if mobile:
            hold_touch(page, frame.locator('#touch-' + direction))
        else:
            frame.locator('#interior-canvas').click()
            page.keyboard.down(key)
            page.wait_for_timeout(300)
            page.keyboard.up(key)
        moved = moved or camera_state(frame) != before
        diagnostics = frame.evaluate('__livInterior.navigationDiagnostics()')
        assert diagnostics['safe'], diagnostics
    assert moved, 'Comandos de caminhada não deslocaram a câmera.'
    return {'routes': routes, 'visited': visits, 'realInputWalked': True}


def run_case(browser, profile, width, height, backend, out, report):
    mobile = profile == 'toque'
    case = {'profile': profile, 'viewport': [width, height], 'backendRequested': backend,
            'errors': [], 'httpFailures': [], 'typologies': {}}
    report['cases'].append(case)
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                  is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    page = context.new_page()
    page.on('pageerror', lambda failure: case['errors'].append(str(failure)))
    page.on('response', lambda response: case['httpFailures'].append({'url': response.url, 'status': response.status})
            if response.status >= 400 else None)
    try:
        plants = image_catalog()
        page.goto(URL + '?backend=' + backend, wait_until='load', timeout=120000)
        ready(page, 'maquete')
        assert set(page.locator('#typology option').evaluate_all('nodes=>nodes.map(n=>n.value)')) == {'canto', 'meio'}
        page.locator('#floor').select_option('8')
        for typology in ['canto', 'meio']:
            details = {'captures': []}
            case['typologies'][typology] = details
            page.locator('#typology').select_option(typology)
            page.locator('[data-mode="planta2d"]').click()
            ready(page, 'planta2d', typology)
            assert page.evaluate('__livViewer.frame===null')
            details['image2D'] = rendered_image(page, plants[typology])
            details['captures'].append(capture(page, out / f'{profile}-{typology}-planta2d.png'))
            page.locator('[data-mode="planta3d"]').click()
            ready(page, 'planta3d', typology)
            frame = interior_frame(page)
            frame.wait_for_function('window.__livInterior?.ready', timeout=120000)
            state3d = interior_state(frame)
            assert_identity(state3d, typology)
            assert state3d['ceiling']['count'] > 0 and not state3d['ceiling']['visible'], 'Forro encobre a planta 3D ou está ausente.'
            assert frame.evaluate('__livInterior.mode') == 'planta3d'
            if backend != 'auto':
                assert frame.evaluate('__livInterior.backend') == backend
            details['backend'] = frame.evaluate('__livInterior.backend')
            details['state3D'] = state3d
            if mobile:
                assert frame.locator('#furniture-panel summary').bounding_box()['height'] >= 44
                boxes = frame.evaluate('''()=>{
                  const a=document.querySelector('#interior-note').getBoundingClientRect();
                  const b=document.querySelector('#furniture-panel').getBoundingClientRect();
                  return {overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
                }''')
                assert not boxes['overlap'], 'Ajustar móveis cobre o texto de ajuda.'
                details['mobileHelpUncovered'] = True

            details['renderedGeometry'] = geometry_signature(page)
            before = camera_state(frame)
            drag(page, frame.locator('#interior-canvas'), mobile)
            assert camera_state(frame) != before, 'Arrasto não girou a planta 3D.'
            details['furniture'] = furniture_test(frame, typology)
            details['captures'].append(capture(page, out / f'{profile}-{typology}-planta3d.png'))
            save_layout(page, out, f'{profile}-{typology}-planta3d-layout.png', mobile)
            page.evaluate('window.__qaInteriorFrame=__livViewer.frame;window.__qaInteriorApi=__livViewer.frame.contentWindow.__livInterior')
            page.locator('[data-mode="visita"]').click()
            ready(page, 'visita', typology)
            assert page.evaluate('__livViewer.frame===window.__qaInteriorFrame&&__livViewer.frame.contentWindow.__livInterior===window.__qaInteriorApi'), 'Planta/Tour não reutilizaram a mesma cena.'
            state_tour = interior_state(frame)
            assert state_tour['ceiling']['visible'], 'Forro ausente no Tour.'
            before = camera_state(frame)
            drag(page, frame.locator('#interior-canvas'), mobile)
            assert camera_state(frame) != before, 'Arrasto não alterou o olhar no Tour.'
            details['navigation'] = rooms_test(page, frame, mobile)
            details['captures'].append(capture(page, out / f'{profile}-{typology}-visita.png'))
            save_layout(page, out, f'{profile}-{typology}-visita-layout.png', mobile)
            page.evaluate('window.__qaOldInterior=__livViewer.frame.contentWindow.__livInterior')
            page.locator('[data-mode="maquete"]').click()
            ready(page, 'maquete')
            assert_suspended_old(page)
            assert page.evaluate('__livViewer.frame.contentWindow.__livProva.getState().floor') == 8
        canto, meio = case['typologies']['canto'], case['typologies']['meio']
        assert canto['state3D']['unitSHA256'] != meio['state3D']['unitSHA256'], 'Tipologias usam a mesma unidade de origem.'
        assert canto['renderedGeometry']['sha256'] != meio['renderedGeometry']['sha256'], 'Tipologias renderizaram a mesma geometria.'
        page.locator('[data-mode="visita"]').click()
        ready(page, 'visita', 'meio')
        page.evaluate('__livViewer.setTypology("canto")')
        ready(page, 'visita', 'canto')
        assert page.locator('#typology').input_value() == 'canto'
        page.evaluate('''async()=>{
            window.__qaOldInterior=__livViewer.frame.contentWindow.__livInterior;
            const calls=[__livViewer.setTypology('meio'),__livViewer.setTypology('canto'),__livViewer.setTypology('meio')];
            return Promise.allSettled(calls);
        }''')
        ready(page, 'visita', 'meio')
        assert_suspended_old(page)
        assert page.locator('#typology').input_value() == 'meio'
        case['rapidTypologyLastWins'] = True
        page.reload(wait_until='load', timeout=120000)
        ready(page, 'visita', 'meio')
        assert page.locator('#typology').input_value() == 'meio'
        assert interior_frame(page).evaluate('__livInterior.typology') == 'meio'
        case['sessionRestored'] = {'mode': 'visita', 'typology': 'meio'}
        # A direct Tour start must also have a valid saved orbit camera.
        frame = interior_frame(page)
        frame.locator('#mode-planta3d').click()
        ready(page, 'planta3d', 'meio')
        orbit = interior_state(frame)['camera']
        assert sum(value*value for value in orbit['position']) > 9, orbit
        assert page.locator('[data-mode="planta3d"]').get_attribute('aria-pressed') == 'true'
        frame.locator('#mode-visita').click()
        ready(page, 'visita', 'meio')
        case['embeddedModesSynced'] = True
        case['directTourOrbitFramed'] = True

        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Layout transborda horizontalmente.'
        assert not case['errors'] and not case['httpFailures'], case
        case['status'] = 'PASS'
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias' / 'interiores')
    parser.add_argument('--perfil', choices=['todos', *PROFILES], default='todos')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING',
              'physicalMobile': False, 'sourceSHA256': source_hashes(), 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            report['browserVersion'] = browser.version
            selected = PROFILES if args.perfil == 'todos' else {args.perfil: PROFILES[args.perfil]}
            for profile, (width, height, backend) in selected.items():
                run_case(browser, profile, width, height, backend, args.saida, report)
            browser.close()
        report['status'] = 'PASS'
    except Exception as failure:
        report['status'] = 'FAIL'
        report['failure'] = str(failure)
        raise
    finally:
        (args.saida / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}))


if __name__ == '__main__':
    main()
