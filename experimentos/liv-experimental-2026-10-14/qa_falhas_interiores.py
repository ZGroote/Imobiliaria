"""Falhas controladas e recuperação dos interiores canto/meio no Chrome real.

Service Workers ficam bloqueados para que cada rota injetada alcance o recurso
foreground. Perda WebGPU é simulação do callback, não perda física de dispositivo.
"""
import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
_case_deadline = None
CASES = ['sem-webgpu-auto', 'init-webgpu-falha-auto', 'init-dos-backends-falha', 'webgpu-obrigatorio-ausente-meio',
         'canto-atlas-http', 'canto-atlas-corrompido', 'meio-unidade-http', 'meio-unidade-corrompida',
         'meio-atlas-corrompido', 'meio-atlas-de-canto',
         'renderer-error-webgl', 'renderer-error-webgpu', 'device-lost-webgpu-simulado',
         'cancelamento-fetch', 'cancelamento-init-webgpu', 'cancelamento-init-sem-resposta',
         'snapshot-preservado-cancelamento-init', 'ready-antes-restore', 'snapshot-antigo-descartado']

CAPTURE_APIS = '''(()=>{
    let interior;
    Object.defineProperty(window,'__livInterior',{configurable:true,
        get:()=>interior,set:value=>{
            interior=value;
            const parent=window.parent;
            (parent.__qaInteriorInstances||(parent.__qaInteriorInstances=[])).push(value);
            const descriptor=Object.getOwnPropertyDescriptor(value,'ready');
            if(descriptor?.writable&&typeof value.ready==='boolean'){
                let ready=value.ready;
                Object.defineProperty(value,'ready',{configurable:true,enumerable:descriptor.enumerable,
                    get:()=>ready,set:next=>{
                        ready=next;
                        const trigger=parent.__qaCancelInteriorOnReady;
                        if(next===true&&trigger?.enabled&&parent.__livViewer?.frame?.contentWindow===window){
                            trigger.enabled=false;trigger.triggered=true;
                            trigger.childReady=value.ready;
                            trigger.parentPrepared=!!parent.__livViewer.frame.livPrepared;
                            trigger.apiIndex=parent.__qaInteriorInstances.length-1;
                            trigger.childSnapshot=value.getState();
                            void parent.__livViewer.setMode('planta2d');
                            trigger.frameReleasedSynchronously=parent.__livViewer.frame===null;
                        }
                    }});
            }
        }});
})();'''
NO_GPU = "Object.defineProperty(navigator,'gpu',{get:()=>undefined});"
FAIL_GPU_INIT = '''if(navigator.gpu){
    const isInterior=()=>!!document.getElementById('interior-canvas');
    const request=navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter=async(...args)=>{
        const adapter=await request(...args);
        if(adapter&&isInterior()){
            const create=adapter.requestDevice.bind(adapter);
            adapter.requestDevice=(...deviceArgs)=>{
                if(!isInterior())return create(...deviceArgs);
                window.parent.__qaInteriorGPUInitRejected=(window.parent.__qaInteriorGPUInitRejected||0)+1;
                return Promise.reject(Error('QA: falha de inicialização WebGPU'));
            };
        }
        return adapter;
    };
}'''
FAIL_INTERIOR_BACKENDS = '''(()=>{
    const isInterior=()=>!!document.getElementById('interior-canvas');
    const faults=()=>window.parent.__qaInteriorBackendFaults||
        (window.parent.__qaInteriorBackendFaults={webgpuRejected:0,webglRejected:0});
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
        if(kind==='webgl2'&&this.id==='interior-canvas'){
            faults().webglRejected++;
            throw Error('QA: falha de inicialização WebGL2');
        }
        return getContext.call(this,kind,...args);
    };
    if(navigator.gpu){
        const request=navigator.gpu.requestAdapter.bind(navigator.gpu);
        navigator.gpu.requestAdapter=async(...args)=>{
            const adapter=await request(...args);
            if(adapter&&isInterior()){
                const create=adapter.requestDevice.bind(adapter);
                adapter.requestDevice=(...deviceArgs)=>{
                    if(!isInterior())return create(...deviceArgs);
                    faults().webgpuRejected++;
                    return Promise.reject(Error('QA: falha de inicialização WebGPU'));
                };
            }
            return adapter;
        };
    }
})();'''
GATE_GPU_INIT = '''if(navigator.gpu){
    const isInterior=()=>!!document.getElementById('interior-canvas');
    const request=navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter=async(...args)=>{
        const adapter=await request(...args);
        if(adapter&&isInterior()){
            const create=adapter.requestDevice.bind(adapter);
            adapter.requestDevice=(...deviceArgs)=>{
                if(!isInterior())return create(...deviceArgs);
                const owner=window.parent;
                if(owner.__qaInteriorInitGateEnabled===false)return create(...deviceArgs);
                return new Promise((resolve,reject)=>{
                    const gate=owner.__qaInteriorInitGate={blocked:true,releaseCalled:false,
                        settled:false,requestDeviceResolved:false,error:null};
                    owner.__qaInteriorInitBlocked=true;
                    owner.__qaReleaseInteriorInit=async()=>{
                        gate.releaseCalled=true;
                        try{
                            const device=await create(...deviceArgs);
                            gate.requestDeviceResolved=true;resolve(device);
                        }catch(error){gate.error=String(error);reject(error);}
                        finally{gate.settled=true;}
                    };
                });
            };
        }
        return adapter;
    };
}'''


def remaining_timeout(maximum=120000):
    if _case_deadline is None:
        return maximum
    remaining = int((_case_deadline - time.monotonic()) * 1000)
    if remaining <= 0:
        raise TimeoutError('O orçamento de tempo do caso terminou.')
    return min(maximum, remaining)


def persist_report(report, output):
    report['updatedAtUtc'] = datetime.now(timezone.utc).isoformat()
    (output / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


def source_records():
    paths = {path for pattern in ['interior*.js', 'interior*.html', 'viewer.js', 'tipologias.js',
                                 'renderer.js', 'material-rgbm.js', 'maquete-liv-ipanema.html',
                                 'gerar_pacote_interiores.py', 'gerar_manifesto_transferencias.py',
                                 'transfers.js', 'transfer-worker.js', 'transfer-manifest.json',
                                 'qa_falhas_interiores.py'] for path in EXP.glob(pattern)}
    paths.update((EXP / 'interiores' / 'meio').glob('*.json'))
    paths.update((EXP / 'interiores' / 'meio').glob('*.ts'))
    paths.update(path for path in (EXP / 'plantas2d').glob('*') if path.is_file())
    catalog_path = EXP / 'interiores' / 'catalogo.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    assert catalog['schema'] == 'liv-interior-catalog-v1'
    paths.add(catalog_path)
    recorded = {'catalogo': hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
                'assets': {}, 'sourceSHA256': {}}
    groups = list(catalog['shared'].values())
    groups += [record for typology in catalog['tipologias'].values() for record in typology['files'].values()]
    for record in groups:
        path = EXP / record['path']
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest == record['sha256'] and path.stat().st_size == record['bytes'], record['path']
        recorded['assets'][record['path']] = {'bytes': record['bytes'], 'sha256': digest,
                                             'decodedSHA256': record.get('decodedSHA256')}
        paths.add(path)
    for path in sorted(paths):
        recorded['sourceSHA256'][str(path.relative_to(EXP)).replace('\\', '/')] = hashlib.sha256(path.read_bytes()).hexdigest()
    return catalog, recorded


def ready(page, mode, typology=None):
    page.wait_for_function('''expected=>{
        const api=window.__livViewer;
        if(api?.error)throw Error(api.error);
        return api?.ready&&api.mode===expected.mode&&(!expected.typology||api.typology===expected.typology);
    }''', arg={'mode': mode, 'typology': typology}, timeout=remaining_timeout())
    assert page.locator('#stage iframe:not([hidden])').count() == (0 if mode == 'planta2d' else 1)


def handled_error(page, case):
    page.wait_for_function('window.__livViewer?.error', timeout=remaining_timeout())
    case['handledError'] = page.evaluate('__livViewer.error')
    assert not page.evaluate('__livViewer.ready')
    assert page.locator('#retry').is_visible() and page.locator('#fallback').is_visible()


def open_interior(page, typology, mode='visita'):
    page.locator('#typology').select_option(typology)
    page.locator('[data-mode="' + mode + '"]').click()


def retry_once(page, mode, typology, case):
    assert page.locator('#retry').is_visible()
    page.locator('#retry').click()
    ready(page, mode, typology)
    case['retryClicks'] = 1
    assert page.evaluate('__livViewer.frame.contentWindow.__livInterior.typology') == typology
    assert page.evaluate('__livViewer.frame.contentWindow.__livInterior.mode') == mode


def state(page):
    return page.evaluate('__livViewer.frame.contentWindow.__livInterior.getState()')


def owned_cleanup(page, index=-1, timeout=20000):
    page.wait_for_function('''index=>{
        const api=window.__qaInteriorInstances?.at(index);
        if(!api?.disposed)return false;
        const result=api.getState();
        if(result.ready)return false;
        const ownership=result.ownership;
        if(!ownership)throw Error('API não expõe propriedade dos recursos.');
        function balanced(created,disposed){
            if(typeof created==='number')return created===disposed;
            if(!created||typeof created!=='object')throw Error('Contadores de recursos ausentes.');
            return Object.keys(created).every(key=>balanced(created[key],disposed?.[key]));
        }
        return balanced(ownership.created,ownership.disposed);
    }''', arg=index, timeout=remaining_timeout(timeout))
    return page.evaluate('index=>window.__qaInteriorInstances.at(index).getState().ownership', index)


def corrupted_bytes(record):
    body = bytearray((EXP / record['path']).read_bytes())
    body[len(body) // 2] ^= 1
    assert len(body) == record['bytes'] and hashlib.sha256(body).hexdigest() != record['sha256']
    return bytes(body)


def wait_pending(page, pending, timeout=15000):
    deadline = time.monotonic() + remaining_timeout(timeout) / 1000
    while not pending and time.monotonic() < deadline:
        page.wait_for_timeout(50)
    assert pending, 'O recurso selecionado não chegou à rota bloqueada.'


def compare_restored(before, after):
    assert after['typology'] == before['typology'] and after['mode'] == before['mode']
    assert after['unitSHA256'] == before['unitSHA256'] and after['sourceSHA256'] == before['sourceSHA256']
    assert after['furniture'] == before['furniture'], 'Retry perdeu o layout dos móveis.'
    assert after['lighting']['bakedActive'] == before['lighting']['bakedActive'], 'Retry ativou um bake incompatível.'
    for key in ['position', 'target']:
        assert max(abs(a - b) for a, b in zip(before['camera'][key], after['camera'][key])) < .02, key
    for key in ['yaw', 'pitch']:
        assert abs(before['camera'][key] - after['camera'][key]) < .01, key


def run_case(browser, name, catalog, report, output, timeout_ms=None):
    global _case_deadline
    started = time.monotonic()
    _case_deadline = started + timeout_ms / 1000 if timeout_ms else None
    case = {'name': name, 'errors': [], 'status': 'RUNNING',
            'startedAtUtc': datetime.now(timezone.utc).isoformat()}
    report['cases'].append(case)
    report['currentCase'] = name
    persist_report(report, output)
    context = browser.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
    context.set_default_timeout(remaining_timeout())
    context.add_init_script(CAPTURE_APIS)
    if name in ['sem-webgpu-auto', 'webgpu-obrigatorio-ausente-meio']:
        context.add_init_script(NO_GPU)
    if name == 'init-webgpu-falha-auto':
        context.add_init_script(FAIL_GPU_INIT)
    if name == 'init-dos-backends-falha':
        context.add_init_script(FAIL_INTERIOR_BACKENDS)
    if name in ['cancelamento-init-webgpu', 'cancelamento-init-sem-resposta', 'snapshot-preservado-cancelamento-init']:
        context.add_init_script(GATE_GPU_INIT)
    if name == 'snapshot-preservado-cancelamento-init':
        context.add_init_script('window.__qaInteriorInitGateEnabled=false;')
    backend = 'auto' if name in ['sem-webgpu-auto', 'init-webgpu-falha-auto', 'init-dos-backends-falha',
                                'cancelamento-init-webgpu', 'cancelamento-init-sem-resposta',
                                'snapshot-preservado-cancelamento-init', 'ready-antes-restore'] else \
        'webgpu' if name in ['webgpu-obrigatorio-ausente-meio', 'renderer-error-webgpu', 'device-lost-webgpu-simulado'] else 'webgl'
    page = context.new_page()
    page.on('pageerror', lambda error: case['errors'].append(str(error)))
    try:
        page.goto(URL + '?backend=' + backend, wait_until='load', timeout=remaining_timeout())
        if name == 'webgpu-obrigatorio-ausente-meio':
            handled_error(page, case)
            open_interior(page, 'meio')
            handled_error(page, case)
            page.locator('#fallback').click()
            ready(page, 'planta2d', 'meio')
            image = page.locator('#stage img')
            assert image.is_visible() and 'meio' in image.get_attribute('src')
            assert page.evaluate('__livViewer.frame===null')
            case['fallback'] = {'typology': 'meio', 'renderersActive': 0}
        else:
            ready(page, 'maquete')
            if name in ['sem-webgpu-auto', 'init-webgpu-falha-auto']:
                open_interior(page, 'meio', 'planta3d')
                ready(page, 'planta3d', 'meio')
                case['backend'] = state(page)['backend']
                assert case['backend'] == 'webgl', case
                if name == 'init-webgpu-falha-auto':
                    case['requestDeviceRejected'] = page.evaluate('window.__qaInteriorGPUInitRejected||0')
                    assert case['requestDeviceRejected'] > 0, \
                        'Este caso exige adapter WebGPU: a injeção requestDevice não foi alcançada.'
            elif name == 'init-dos-backends-falha':
                open_interior(page, 'meio')
                handled_error(page, case)
                case['injection'] = 'requestDevice e getContext(webgl2) rejeitados somente no iframe interior'
                case['rejections'] = page.evaluate('window.__qaInteriorBackendFaults')
                assert case['rejections']['webgpuRejected'] > 0, \
                    'Este caso exige adapter WebGPU: a rejeição requestDevice não foi alcançada.'
                assert case['rejections']['webglRejected'] > 0, 'A rejeição do fallback WebGL2 não foi alcançada.'
                assert 'QA: falha de inicialização WebGL2' in case['handledError'], case
                old_index = page.evaluate('__qaInteriorInstances.length-1')
                assert old_index >= 0
                case['ownership'] = owned_cleanup(page, old_index)
                assert case['ownership']['created'] > 0, 'O teste deve liberar pelo menos um renderer criado.'
                assert not page.evaluate('__livViewer.cleanupError'), 'Cleanup da inicialização falhou.'
                assert not page.evaluate('index=>__qaInteriorInstances[index].disposalError', old_index), \
                    'Dispose do interior deixou erro oculto.'
                page.locator('#fallback').click()
                ready(page, 'planta2d', 'meio')
                image = page.locator('#stage img')
                assert image.is_visible() and 'meio' in image.get_attribute('src')
                assert page.locator('#typology').input_value() == 'meio'
                assert page.evaluate('__livViewer.frame===null')
                case['fallback'] = {'typology': 'meio', 'renderersActive': 0}
            elif name == 'meio-atlas-de-canto':
                mixed = json.loads(json.dumps(catalog))
                mixed['tipologias']['meio']['files']['atlas'] = mixed['tipologias']['canto']['files']['atlas']
                pattern = '**/interiores/catalogo.json*'
                context.route(pattern, lambda route: route.fulfill(json=mixed))
                case['injection'] = 'Atlas íntegro do canto associado à fonte/UV1/light manifest próprios de meio'
                open_interior(page, 'meio')
                handled_error(page, case)
                assert 'identidade do bake' in case['handledError'].lower(), case
                context.unroute(pattern)
                retry_once(page, 'visita', 'meio', case)
                assert state(page)['lighting']['bakedActive'], 'Retry deve usar somente o atlas próprio de meio.'
            elif name.startswith('canto-atlas-') or name.startswith('meio-unidade-') or name.startswith('meio-atlas-'):
                typology = 'canto' if name.startswith('canto') else 'meio'
                key = 'atlas' if '-atlas-' in name else 'unit'
                record = catalog['tipologias'][typology]['files'][key]
                pattern = '**/' + record['path'] + '*'
                if name.endswith('http'):
                    context.route(pattern, lambda route: route.fulfill(status=503, body='QA: recurso indisponível'))
                    case['injection'] = 'HTTP 503 no recurso foreground'
                else:
                    body = corrupted_bytes(record)
                    context.route(pattern, lambda route: route.fulfill(status=200, body=body))
                    case['injection'] = 'Bytes alterados com o tamanho original; hash divergente'
                open_interior(page, typology)
                handled_error(page, case)
                case['asset'] = record['path']
                if name.endswith('corrompido') or name.endswith('corrompida'):
                    assert any(word in case['handledError'].lower() for word in ['hash', 'identidade', 'sha', 'confere']), case
                context.unroute(pattern)
                retry_once(page, 'visita', typology, case)
            elif name.startswith('renderer-error-') or name.startswith('device-lost-'):
                typology = 'canto'
                open_interior(page, typology)
                ready(page, 'visita', typology)
                page.evaluate('''()=>{
                    const api=__livViewer.frame.contentWindow.__livInterior;
                    const room=api.getRoomRoutes().find(route=>route.reachable);
                    api.goToRoom(room.id,{instant:true});
                    const furniture=api.getState().furniture[0];
                    api.moveFurniture(furniture.id,.2,0);api.rotateFurniture(furniture.id);
                }''')
                page.wait_for_timeout(200)
                before = state(page)
                assert not before['lighting']['bakedActive'], 'O cenário precisa de layout modificado antes da falha.'
                old_index = page.evaluate('__qaInteriorInstances.length-1')
                if name.startswith('device-lost-'):
                    page.evaluate("__livViewer.frame.contentWindow.__livInterior.renderer.onDeviceLost({api:'WebGPU',reason:'unknown',message:'QA: callback de perda'})")
                    case['injection'] = 'Callback onDeviceLost simulado; não representa perda física do dispositivo'
                else:
                    page.evaluate("__livViewer.frame.contentWindow.__livInterior.renderer.onError(Error('QA: erro do renderer após pronto'))")
                    case['injection'] = 'Callback onError simulado após primeiro frame'
                handled_error(page, case)
                retry_once(page, 'visita', typology, case)
                after = state(page)
                compare_restored(before, after)
                case['restored'] = {'typology': typology, 'mode': 'visita', 'camera': after['camera'],
                                    'furniture': after['furniture'], 'lighting': after['lighting']}
                case['oldOwnership'] = owned_cleanup(page, old_index)
            elif name == 'cancelamento-fetch':
                record = catalog['tipologias']['canto']['files']['atlas']
                pending = []
                pattern = '**/' + record['path'] + '*'
                context.route(pattern, lambda route: pending.append(route))
                page.evaluate("void __livViewer.setMode('visita')")
                wait_pending(page, pending)
                old_index = page.evaluate('__qaInteriorInstances.length-1')
                assert old_index >= 0
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                for route in pending:
                    try:
                        route.abort('aborted')
                    except Exception:
                        pass  # The disposed iframe may already have canceled the route.
                case['ownership'] = owned_cleanup(page, old_index)
                assert page.evaluate('__livViewer.frame===null')
                case['injection'] = 'Atlas foreground bloqueado; mudança para 2D antes de concluir'
            elif name == 'cancelamento-init-webgpu':
                page.evaluate("void __livViewer.setMode('visita')")
                page.wait_for_function('window.__qaInteriorInitBlocked', timeout=remaining_timeout(20000))
                old_index = page.evaluate('__qaInteriorInstances.length-1')
                assert old_index >= 0
                case['phase'] = 'requestDevice bloqueado'
                case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                persist_report(report, output)
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                page.evaluate('void window.__qaReleaseInteriorInit()')
                case['phase'] = 'release disparado sem aguardar Promise'
                case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                persist_report(report, output)
                try:
                    page.wait_for_function('window.__qaInteriorInitGate?.settled', timeout=remaining_timeout(10000))
                except Exception:
                    case['gateResolutionTimedOut'] = True
                    case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                    case['ownershipAtTimeout'] = page.evaluate('index=>__qaInteriorInstances[index].getState().ownership', old_index)
                    persist_report(report, output)
                    raise
                case['gateResolutionTimedOut'] = False
                case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                assert case['gate']['releaseCalled'] and case['gate']['requestDeviceResolved'], case['gate']
                case['ownership'] = owned_cleanup(page, old_index, timeout=30000)
                page.wait_for_function("!document.querySelector('iframe[data-disposing]')", timeout=remaining_timeout(5000))
                case['disposingFramesAfterCleanup'] = page.locator('iframe[data-disposing]').count()
                assert page.locator('#stage iframe').count() == 0
                assert page.evaluate('__livViewer.frame===null')
                assert page.evaluate('__qaInteriorInstances.at(-1).ready===false')
                case['injection'] = 'requestDevice retido no iframe; dispositivo liberado após navegação para 2D'
            elif name == 'cancelamento-init-sem-resposta':
                page.evaluate("void __livViewer.setMode('visita')")
                page.wait_for_function('window.__qaInteriorInitBlocked', timeout=remaining_timeout(20000))
                old_index = page.evaluate('__qaInteriorInstances.length-1')
                assert old_index >= 0
                assert page.evaluate('__livViewer.cleanupTimeouts') == 0
                navigation_started = page.evaluate('performance.now()')
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                case['fallbackReadyMs'] = page.evaluate('started=>performance.now()-started', navigation_started)
                assert case['fallbackReadyMs'] < 5000, 'O fallback 2D ficou bloqueado pela Promise do driver.'
                assert page.evaluate('__livViewer.pendingCleanup') > 0
                assert page.locator('iframe[data-disposing]').count() > 0
                assert page.evaluate('__livViewer.frame===null')
                case['phase'] = '2D pronto; gate permanece retida; aguardando limite real de 30 s'
                case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                assert not case['gate']['releaseCalled'] and not case['gate']['settled']
                persist_report(report, output)
                page.wait_for_function('''()=>__livViewer.pendingCleanup===0&&
                    __livViewer.cleanupTimeouts===1&&!document.querySelector('iframe[data-disposing]')''',
                    timeout=remaining_timeout(35000))
                case['observedTeardownMs'] = page.evaluate('started=>performance.now()-started', navigation_started)
                assert case['observedTeardownMs'] >= 29500, 'O teste deve observar o limite real de 30 s.'
                case['pendingCleanup'] = page.evaluate('__livViewer.pendingCleanup')
                case['cleanupTimeouts'] = page.evaluate('__livViewer.cleanupTimeouts')
                case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                assert not case['gate']['releaseCalled'] and not case['gate']['settled']
                assert page.locator('#stage iframe').count() == 0
                assert page.evaluate('index=>__qaInteriorInstances[index].disposed&&!__qaInteriorInstances[index].ready', old_index)
                case['nativeTeardownOnly'] = True
                case['gpuMemoryReleaseVerified'] = False
                case['injection'] = 'requestDevice retido sem release; iframe removido pelo limite nativo de 30 s'
            elif name == 'snapshot-preservado-cancelamento-init':
                open_interior(page, 'canto')
                ready(page, 'visita', 'canto')
                original = state(page)
                page.evaluate('''async()=>{
                    const api=__livViewer.frame.contentWindow.__livInterior;
                    const furniture=api.getState().furniture[0];
                    api.moveFurniture(furniture.id,.2,0);api.rotateFurniture(furniture.id);
                    const current=api.getState().camera.position;
                    const route=api.getRoomRoutes().find(room=>room.reachable&&
                        Math.hypot(room.target[0]-current[0],room.target[1]-current[2])>.5);
                    if(!route||!await api.goToRoom(route.id,{instant:true}))throw Error('Câmera não chegou à sala escolhida após ajustar o móvel.');
                }''')
                before = state(page)
                assert sum((a-b)**2 for a, b in zip(before['camera']['position'], original['camera']['position'])) > .25
                assert any(item['modified'] for item in before['furniture']) and not before['lighting']['bakedActive']
                first_index = page.evaluate('__qaInteriorInstances.length-1')
                # Force a cache miss to test a genuinely new canceled init;
                # normal navigation now keeps healthy ready scenes suspended.
                page.evaluate('__livViewer.dispose()')
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                saved = page.evaluate('__livViewer.interiorSnapshots.canto')
                compare_restored(before, saved)
                case['firstOwnership'] = owned_cleanup(page, first_index)
                page.wait_for_function("!document.querySelector('iframe[data-disposing]')", timeout=remaining_timeout(5000))
                page.evaluate('''()=>{
                    window.__qaInteriorInitGateEnabled=true;
                    window.__qaInteriorInitBlocked=false;
                    void __livViewer.setMode('visita');
                }''')
                page.wait_for_function('window.__qaInteriorInitBlocked', timeout=remaining_timeout(20000))
                canceled_index = page.evaluate('__qaInteriorInstances.length-1')
                assert canceled_index > first_index
                assert not page.evaluate('index=>__qaInteriorInstances[index].ready', canceled_index)
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                after_cancellation = page.evaluate('__livViewer.interiorSnapshots.canto')
                assert after_cancellation == saved, 'Cancelar a segunda inicialização sobrescreveu o snapshot válido anterior.'
                case['snapshotPreservedDuringCancellation'] = True
                case['phase'] = 'snapshot válido preservado; liberando apenas a segunda inicialização'
                persist_report(report, output)
                page.evaluate('void window.__qaReleaseInteriorInit()')
                page.wait_for_function('window.__qaInteriorInitGate?.settled', timeout=remaining_timeout(10000))
                case['gate'] = page.evaluate('window.__qaInteriorInitGate')
                assert case['gate']['releaseCalled'] and case['gate']['requestDeviceResolved'], case['gate']
                case['canceledOwnership'] = owned_cleanup(page, canceled_index)
                assert case['canceledOwnership']['created'] == case['canceledOwnership']['disposed'] == 1
                page.wait_for_function("__livViewer.pendingCleanup===0&&!document.querySelector('iframe[data-disposing]')", timeout=remaining_timeout(5000))
                page.evaluate('window.__qaInteriorInitGateEnabled=false')
                page.locator('[data-mode="visita"]').click()
                ready(page, 'visita', 'canto')
                restored = state(page)
                compare_restored(before, restored)
                case['restored'] = {'camera': restored['camera'], 'furniture': restored['furniture'],
                                    'lighting': restored['lighting'], 'typology': restored['typology'], 'mode': restored['mode']}
                assert page.evaluate('__livViewer.cleanupTimeouts') == 0
                case['injection'] = 'Gate somente na segunda init; cancelamento preserva câmera/layout salvos antes de reabrir sem gate'
            elif name == 'ready-antes-restore':
                open_interior(page, 'canto')
                ready(page, 'visita', 'canto')
                original = state(page)
                page.evaluate('''async()=>{
                    const api=__livViewer.frame.contentWindow.__livInterior;
                    const furniture=api.getState().furniture[0];
                    api.moveFurniture(furniture.id,.2,0);api.rotateFurniture(furniture.id);
                    const current=api.getState().camera.position;
                    const route=api.getRoomRoutes().find(room=>room.reachable&&
                        Math.hypot(room.target[0]-current[0],room.target[1]-current[2])>.5);
                    if(!route||!await api.goToRoom(route.id,{instant:true}))throw Error('Câmera não chegou à sala escolhida após ajustar o móvel.');
                }''')
                before = state(page)
                assert sum((a-b)**2 for a, b in zip(before['camera']['position'], original['camera']['position'])) > .25
                assert any(item['modified'] for item in before['furniture']) and not before['lighting']['bakedActive']
                first_index = page.evaluate('__qaInteriorInstances.length-1')
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                saved = page.evaluate('__livViewer.interiorSnapshots.canto')
                compare_restored(before, saved)
                case['firstOwnership'] = owned_cleanup(page, first_index)
                page.wait_for_function("!document.querySelector('iframe[data-disposing]')", timeout=remaining_timeout(5000))
                page.evaluate('''()=>{
                    window.__qaCancelInteriorOnReady={enabled:true,triggered:false};
                    void __livViewer.setMode('visita');
                }''')
                page.wait_for_function('window.__qaCancelInteriorOnReady?.triggered', timeout=remaining_timeout())
                ready(page, 'planta2d', 'canto')
                trigger = page.evaluate('window.__qaCancelInteriorOnReady')
                assert trigger['childReady'] and not trigger['parentPrepared'], 'A injeção não atingiu ready antes do restore do pai.'
                assert trigger['frameReleasedSynchronously'], 'A navegação não cancelou o frame dentro do setter ready.'
                assert trigger['apiIndex'] > first_index
                assert not any(item['modified'] for item in trigger['childSnapshot']['furniture']), \
                    'O pai já havia restaurado o layout antes da injeção.'
                assert trigger['childSnapshot']['camera'] != before['camera'], 'A injeção precisa anteceder a restauração da câmera.'
                assert page.evaluate('__livViewer.interiorSnapshots.canto') == saved, \
                    'Cancelar em child.ready antes do restore sobrescreveu o snapshot válido.'
                case['readyBeforeParentRestore'] = True
                case['snapshotPreservedDuringCancellation'] = True
                case['trigger'] = {'childReady': trigger['childReady'], 'parentPrepared': trigger['parentPrepared'],
                                   'frameReleasedSynchronously': trigger['frameReleasedSynchronously'], 'apiIndex': trigger['apiIndex']}
                case['phase'] = 'cancelamento síncrono em ready; snapshot anterior preservado'
                persist_report(report, output)
                case['canceledOwnership'] = owned_cleanup(page, trigger['apiIndex'])
                page.wait_for_function("__livViewer.pendingCleanup===0&&!document.querySelector('iframe[data-disposing]')", timeout=remaining_timeout(5000))
                assert page.evaluate('__qaCancelInteriorOnReady.enabled===false')
                page.locator('[data-mode="visita"]').click()
                ready(page, 'visita', 'canto')
                restored = state(page)
                compare_restored(before, restored)
                case['restored'] = {'camera': restored['camera'], 'furniture': restored['furniture'],
                                    'lighting': restored['lighting'], 'typology': restored['typology'], 'mode': restored['mode']}
                assert page.evaluate('__livViewer.cleanupTimeouts') == 0
                case['injection'] = 'Setter ready na segunda abertura chama 2D antes do restore do pai; terceira abertura restaura câmera/layout'
            elif name == 'snapshot-antigo-descartado':
                open_interior(page, 'canto')
                ready(page, 'visita', 'canto')
                page.evaluate('''()=>{
                    const api=__livViewer.frame.contentWindow.__livInterior;
                    api.moveFurniture(api.getState().furniture[0].id,.2,0);
                }''')
                assert not state(page)['lighting']['bakedActive']
                page.locator('[data-mode="planta2d"]').click()
                ready(page, 'planta2d', 'canto')
                page.evaluate('''()=>{
                    const old=__livViewer.interiorSnapshots.canto;
                    if(!old)throw Error('Snapshot do interior ausente.');
                    old.sourceSHA256='0'.repeat(64);old.unitSHA256='1'.repeat(64);
                }''')
                page.reload(wait_until='load', timeout=remaining_timeout())
                ready(page, 'planta2d', 'canto')
                persisted = page.evaluate('__livViewer.interiorSnapshots.canto')
                assert persisted and persisted['sourceSHA256'] == '0' * 64 and persisted['unitSHA256'] == '1' * 64, \
                    'O snapshot adulterado não foi carregado da sessão; o descarte não foi exercitado.'
                assert any(item['modified'] for item in persisted['furniture']), 'O snapshot persistido perdeu o layout modificado.'
                case['staleSnapshotLoaded'] = {'sourceSHA256': persisted['sourceSHA256'],
                                               'unitSHA256': persisted['unitSHA256']}
                page.locator('[data-mode="visita"]').click()
                ready(page, 'visita', 'canto')
                restored = state(page)
                assert restored['sourceSHA256'] == catalog['tipologias']['canto']['sourceSHA256']
                assert restored['unitSHA256'] == catalog['tipologias']['canto']['unitSHA256']
                assert restored['lighting']['bakedActive'] and not any(item['modified'] for item in restored['furniture'])
                assert page.evaluate('__livViewer.interiorSnapshots.canto===undefined')
                case['injection'] = 'Snapshot persistido com identidade de uma versão antiga; nova fonte abre normalmente'
                case['staleSnapshotDiscarded'] = True
        assert not case['errors'], case
        case['status'] = 'PASS'
    except Exception as failure:
        case['status'] = 'FAIL'
        case['failure'] = str(failure)
        raise
    finally:
        case['finishedAtUtc'] = datetime.now(timezone.utc).isoformat()
        case['durationMs'] = round((time.monotonic() - started) * 1000)
        report['currentCase'] = None
        persist_report(report, output)
        context.close()
        _case_deadline = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias' / 'falhas-interiores')
    parser.add_argument('--caso', choices=['todos', *CASES], default='todos')
    parser.add_argument('--timeout-ms', type=int, help='Orçamento opcional de tempo por caso; usado na reprodução isolada.')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING',
              'physicalMobile': False, 'serviceWorkers': 'blocked for foreground fault injection',
              'caseTimeoutMs': args.timeout_ms, 'cases': []}
    persist_report(report, args.saida)
    try:
        catalog, records = source_records()
        report['records'] = records
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            report['browserVersion'] = browser.version
            for name in CASES if args.caso == 'todos' else [args.caso]:
                run_case(browser, name, catalog, report, args.saida, args.timeout_ms)
            browser.close()
        report['status'] = 'PASS'
    except Exception as failure:
        report['status'] = 'FAIL'
        report['failure'] = str(failure)
        raise
    finally:
        persist_report(report, args.saida)
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}))


if __name__ == '__main__':
    main()
