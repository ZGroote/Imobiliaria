"""QA dos acabamentos padrão da torre/implantação e vista de varandas, sem alterar a cena de origem.

As capturas base/referencia usam a mesma câmera. A imagem oficial é uma
referência de acabamento, sem alinhamento suficiente para uma métrica geométrica.
"""
import argparse
import base64
import hashlib
import gzip
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageStat
from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
BASE_URL = 'http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/'
MESH = 'Blender / esquadrias-varandas-esquadria / torre 0'
ENTRY_GLASS = 'Blender / SITE-implantacao-site-vidro / torre -1'
LETTERING = 'Blender / LIV-IPANEMA-tipografia / torre -1'
FINISHES = {MESH: (0, .55, 'painted-frames-v1'), ENTRY_GLASS: (4, .16, 'entry-glass-v1'),
            LETTERING: (0, .65, 'entry-lettering-v1')}
SOURCE_SHA = '89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919'
REFERENCES = [
    ('varanda', ROOT/'relatorios/liv-referencias-publicas-2026-10-09/varanda-render-oficial-1.png'),
    ('fachada', ROOT/'v1.5/miniaturas/liv-ipanema/referencias/fachada.jpg'),
]

SNAPSHOT = """async()=>{
 const p=__livProva;
 const hash=async value=>{
   const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
   return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 };
 const ids=new Map(),geometry=[];
 for(const mesh of p.meshes){
   const g=mesh.geometry;if(ids.has(g))continue;ids.set(g,geometry.length);
   const attributes={};
   for(const name of ['position','uv1']){
     const a=g.getAttribute(name);attributes[name]=a?{count:a.count,itemSize:a.itemSize,sha256:await hash(a.array)}:null;
   }
   geometry.push({attributes,index:g.index?await hash(g.index.array):null,groups:g.groups,drawRange:g.drawRange});
 }
 const props=m=>({type:m.type,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,
   opacity:m.opacity,transparent:m.transparent,side:m.side,depthWrite:m.depthWrite,depthTest:m.depthTest,
   envMapIntensity:m.envMapIntensity,emissive:m.emissive?.toArray(),emissiveIntensity:m.emissiveIntensity});
 const meshes=[];
 for(const [i,m] of p.meshes.entries()){
   const indices=Array.isArray(p.data.meshes[i].material)?p.data.meshes[i].material:[p.data.meshes[i].material];
   const materials=Array.isArray(m.material)?m.material:[m.material];
   meshes.push({name:m.name,geometry:ids.get(m.geometry),userData:m.userData,
     matrix:m.matrix.toArray(),instances:m.isInstancedMesh?{count:m.count,matrix:await hash(m.instanceMatrix.array)}:null,
     sourceMaterialIndices:indices,
     sourceBinding:materials.every((v,k)=>v===p.materials[indices[k]]),materials:materials.map(props),
     materialUserData:materials.map(v=>v.userData),sourceMaterialUserData:indices.map(k=>p.materials[k].userData),
     sourceMaterials:indices.map(k=>props(p.materials[k])),baked:indices.some(k=>p.data.materials[k].baked)});
 }
 const baked=p.data.meshes.filter(m=>{const ids=Array.isArray(m.material)?m.material:[m.material];return ids.some(i=>p.data.materials[i].baked);});
 return {backend:p.backend,finish:p.finish,state:p.getState(),meshCount:p.meshes.length,bakedMeshes:baked.length,
   sourceModelSHA256:p.data.sourceModelSHA256,geometry,
   sourceSceneSHA256:await hash(JSON.stringify(p.data)),
   bakedDataSHA256:await hash(JSON.stringify({bake:p.data.bake,rgbm:p.data.rgbm,materials:p.data.materials.filter(m=>m.baked),meshes:baked})),
   meshes};
}"""


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def same_camera(left, right):
    """OrbitControls introduces rounding at machine precision between RAFs."""
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(same_camera(left[k], right[k]) for k in left)
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(same_camera(a, b) for a, b in zip(left, right))
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return math.isclose(left, right, rel_tol=0, abs_tol=1e-9)
    return left == right


def wait_proof(page):
    page.wait_for_function('window.__livProva&&(!!__livProva.ready||!!__livProva.error)', timeout=120000)
    assert not page.evaluate('__livProva.error'), page.evaluate('__livProva.error')


def wait_viewer(page, mode):
    page.wait_for_function('m=>window.__livViewer&&__livViewer.ready&&__livViewer.mode===m', arg=mode, timeout=120000)
    assert not page.evaluate('__livViewer.error'), page.evaluate('__livViewer.error')
    assert page.locator('iframe').count() == (0 if mode == 'planta2d' else 1)


def png(page, path, expression='__livProva.capture(false)'):
    data_url = page.evaluate(expression)
    assert data_url.startswith('data:image/png;base64,'), data_url[:60]
    path.write_bytes(base64.b64decode(data_url.split(',', 1)[1], validate=True))
    with Image.open(path) as image:
        image.load()
        assert image.format == 'PNG' and image.width >= 200 and image.height >= 200
        assert max(ImageStat.Stat(image.convert('RGB')).var) > 10, 'Captura sem conteúdo visual suficiente'
        return {'file': path.name, 'sha256': sha(path), 'bytes': path.stat().st_size,
                'dimensions': [image.width, image.height]}


def watch_disposal(page, expression='__livProva'):
    page.evaluate("""expression=>{
      const p=eval(expression),target=p.meshes.find(m=>m.name==='Blender / esquadrias-varandas-esquadria / torre 0');
      const source=p.materials[p.data.meshes[p.meshes.indexOf(target)].material];
      window.__qaFinishDisposal={clone:0,source:0};
      target.material.addEventListener('dispose',()=>window.__qaFinishDisposal.clone++);
      source.addEventListener('dispose',()=>window.__qaFinishDisposal.source++);
    }""", expression)


def check_finish(snapshot, profile):
    assert snapshot['meshCount'] == 56 and snapshot['bakedMeshes'] == 41, snapshot
    assert snapshot['sourceModelSHA256'] == SOURCE_SHA, snapshot['sourceModelSHA256']
    finish = snapshot['finish']
    assert finish['profile'] == profile, finish
    changed = [m for m in snapshot['meshes'] if not m['sourceBinding']]
    if profile == 'base':
        assert not changed and not finish['changes'], finish
        return
    assert {m['name'] for m in changed} == set(FINISHES), changed
    assert {change['mesh'] for change in finish['changes']} == set(FINISHES), finish
    assert len(finish['changes']) == 3 and finish['revision'] == 'access-finishes-v1', finish
    for target in changed:
        index, roughness, revision = FINISHES[target['name']]
        change = next(c for c in finish['changes'] if c['mesh'] == target['name'])
        assert change == {'mesh': target['name'], 'sourceMaterialIndex': index,
                          'type': 'MeshStandardMaterial', 'metalness': 0, 'roughness': roughness}, change
        actual, source = target['materials'][0], target['sourceMaterials'][0]
        assert not target['baked'] and actual['type'] == source['type'] == 'MeshStandardMaterial', target
        assert actual == {**source, 'metalness': 0, 'roughness': roughness}, target
        assert target['materialUserData'][0] == {**target['sourceMaterialUserData'][0],
                                               'livReferenceFinish': revision}, target
    cars = next(m for m in snapshot['meshes'] if 'SITE-car-vidro' in m['name'])
    assert cars['sourceBinding'] and cars['sourceMaterialIndices'] == [4], cars



def compare(base, reference, paths):
    for key in ['geometry', 'sourceSceneSHA256', 'bakedDataSHA256']:
        assert base[key] == reference[key], f'{key} foi alterado pelo acabamento'
    assert same_camera(base['state']['camera'], reference['state']['camera']), 'Câmeras base/referencia diferentes'
    for name in FINISHES:
        original = next(m for m in base['meshes'] if m['name'] == name)
        refined = next(m for m in reference['meshes'] if m['name'] == name)
        for key in ['userData', 'matrix', 'instances', 'sourceMaterials', 'sourceMaterialUserData']:
            assert original[key] == refined[key], f'{name}: {key} foi alterado'
    expected = [m for m in base['meshes'] if m['name'] not in FINISHES]
    actual = [m for m in reference['meshes'] if m['name'] not in FINISHES]
    assert expected == actual, 'Materiais fora dos três grupos de acabamento foram alterados'
    with Image.open(paths[0]) as left, Image.open(paths[1]) as right:
        assert left.size == right.size
        delta = np.abs(np.asarray(left.convert('RGB'), dtype=np.int16) - np.asarray(right.convert('RGB'), dtype=np.int16))
        pixels = int(np.count_nonzero(np.max(delta, axis=2)))
        assert pixels > 0, 'O acabamento não produziu diferença na imagem'
        return {'sameCamera': True, 'samePositionUV1IndexGroups': True, 'sameMatrices': True, 'sameBakedData': True,
                'unchangedOtherMaterials': True, 'changedPixels': pixels, 'changedPixelFraction': pixels/(left.width*left.height),
                'meanAbsoluteRGBDifference255': float(delta.mean()),
                'metricMeaning': 'Verifica que o material alterou a imagem; não mede fidelidade ou melhoria artística.'}


def comparison_sheet(output, base_path, reference_path):
    width, gap, panel_width, image_height = 1800, 24, 568, 560
    image = Image.new('RGB', (width, 730), '#101b20')
    draw = ImageDraw.Draw(image)
    draw.text((24, 18), 'LIV Ipanema | pintura das esquadrias | referencia oficial e capturas locais', fill='white')
    panels = [('Render oficial: varanda', REFERENCES[0][1]), ('Base: metalness 1 / roughness 0.38', base_path),
              ('Perfil referencia: pintura 0 / 0.55', reference_path)]
    for i, (label, path) in enumerate(panels):
        x = gap+i*(panel_width+gap)
        draw.text((x, 56), label, fill='#d1e4e8')
        with Image.open(path) as original:
            original = original.convert('RGBA')
            original.thumbnail((panel_width, image_height))
            background = Image.new('RGBA', original.size, '#f1f1ed')
            background.alpha_composite(original)
            image.paste(background.convert('RGB'), (x+(panel_width-original.width)//2, 94+(image_height-original.height)//2))
    draw.text((24, 675), 'Base e perfil: mesma camera de varandas; geometria, UVs e atlas preservados.', fill='#d1e4e8')
    draw.text((24, 697), 'O render oficial tem outra camera e iluminacao. Parametros PBR sao calibracao visual, sem especificacao executiva.', fill='#d1e4e8')
    path = output/'comparativo-metais.png'
    image.save(path)
    return {'file': path.name, 'sha256': sha(path), 'bytes': path.stat().st_size}


def check_rejected_finish(browser):
    """Exercise the real pre-camera identity rejection and its resource owner."""
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = context.new_page()
    renderer_source = (EXP/'renderer.js').read_text('utf-8')
    finish_source = (EXP/'exterior-finishes.js').read_text('utf-8')
    hook = """scene.add(building);
      window.__qaOwned=[...new Set([...geometries,...materials,...textures,atlas,environment])].map(resource=>{
        const record={type:resource.type||resource.constructor.name,disposed:0};
        resource.addEventListener('dispose',()=>record.disposed++);return record;
      });
      window.__qaBitmaps=textures.map(texture=>{
        const record={closed:0},image=texture.image,close=image.close.bind(image);
        image.close=()=>{record.closed++;close();};return record;
      });"""
    assert renderer_source.count('scene.add(building);') == 1
    assert finish_source.count('!near(source.roughness,.38)') == 1
    page.route('**/renderer.js', lambda route: route.fulfill(status=200, content_type='text/javascript',
        body=renderer_source.replace('scene.add(building);', hook)))
    page.route('**/exterior-finishes.js', lambda route: route.fulfill(status=200, content_type='text/javascript',
        body=finish_source.replace('!near(source.roughness,.38)', '!near(source.roughness,.48)')))
    page.goto(BASE_URL+'prova-rgbm.html?embed=1&backend=webgl&acabamento=referencia', wait_until='load', timeout=120000)
    page.wait_for_function('__livProva.error&&__livProva.disposed', timeout=120000)
    resources = page.evaluate('({owned:__qaOwned,bitmaps:__qaBitmaps,error:__livProva.error,retry:document.querySelector("#retry").href})')
    assert 'material original das esquadrias' in resources['error'], resources
    source_data = json.loads(gzip.decompress((EXP/'assets-prova/scene.json.gz').read_bytes()))
    expected = len(source_data['geometries'])+len(source_data['materials'])+len(source_data['textures'])+2
    assert len(resources['owned']) == expected and all(r['disposed'] == 1 for r in resources['owned']), resources
    assert len(resources['bitmaps']) == len(source_data['textures']) and all(r['closed'] == 1 for r in resources['bitmaps']), resources
    assert 'backend=webgl' in resources['retry'] and 'acabamento=referencia' in resources['retry'] and 'embed=1' in resources['retry'], resources
    page.unroute('**/renderer.js')
    page.unroute('**/exterior-finishes.js')
    page.locator('#retry').click()
    wait_proof(page)
    assert page.evaluate('__livProva.finish.profile') == 'referencia'
    assert page.evaluate('__livProva.backend') == 'webgl'
    assert page.evaluate('document.body.classList.contains("embedded")')
    context.close()
    return {'status': 'PASS', 'ownedResourcesReleased': expected,
            'bitmapsClosed': len(resources['bitmaps']), 'retryPreservesFinishAndEmbed': True,
            'recoveredProfile': 'referencia', 'recoveredBackend': 'webgl'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP/'evidencias'/'refinamento-pintura')
    parser.add_argument('--perfil', choices=['todos', 'desktop-webgpu', 'desktop-webgl', 'toque'], default='todos')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING', 'physicalMobile': False,
              'sourceSHA256': {name: sha(EXP/name) for name in ['qa_refinamento.py', 'renderer.js', 'viewer.js',
                  'exterior-finishes.js', 'cameras.js', 'prova-rgbm.html', 'maquete-liv-ipanema.html',
                  'assets-prova/scene.json.gz', 'assets-prova/irradiance.rgbm.gz', 'assets-prova/manifest.json']},
              'references': [{'id': label, 'path': str(path), 'sha256': sha(path), 'bytes': path.stat().st_size,
                  'source': 'https://www.livonincorporadora.com.br/produtos/liv-ipanema/' if label == 'fachada' else
                            'https://www.livonincorporadora.com.br/wp-content/uploads/2024/08/BOOK_LIV_Ipanema.pdf'}
                  for label, path in REFERENCES],
              'limitations': ['Viewport de toque emulado; sem aparelho físico.',
                  'Referência oficial é render comercial com câmera/luz distintas; não fornece especificação PBR ou medidas executivas.',
                  'A diferença entre imagens mede alteração do material, sem afirmar ganho artístico, FPS ou fidelidade geométrica.',
                  'Atlas, tipologias, estoque comercial e geometria permanecem preservados; vidros seguem opacos.'],
              'cases': []}
    profiles = {'desktop-webgpu': ('webgpu', 1440, 900), 'desktop-webgl': ('webgl', 1440, 900),
                'toque': ('auto', 390, 844)}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
            report['browserVersion'] = browser.version
            names = profiles if args.perfil == 'todos' else [args.perfil]
            for name in names:
                backend, width, height = profiles[name]
                case = {'profile': name, 'backendRequested': backend, 'viewport': [width, height],
                        'errors': [], 'httpFailures': [], 'status': 'RUNNING'}
                report['cases'].append(case)
                context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                              is_mobile=width == 390, has_touch=width == 390, accept_downloads=True)
                page = context.new_page()
                page.on('pageerror', lambda error, c=case: c['errors'].append(str(error)))
                page.on('response', lambda response, c=case: c['httpFailures'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
                snapshots, paths = {}, []
                for finish in ['base', 'referencia']:
                    query = '?backend='+backend+('&acabamento=referencia' if finish == 'referencia' else '')
                    page.goto(BASE_URL+'prova-rgbm.html'+query, wait_until='load', timeout=120000)
                    wait_proof(page)
                    page.evaluate("__livProva.setView('varandas')")
                    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                    snapshot = page.evaluate(SNAPSHOT)
                    check_finish(snapshot, finish)
                    assert snapshot['state']['view'] == 'varandas', snapshot['state']
                    if backend != 'auto':
                        assert snapshot['backend'] == backend, snapshot['backend']
                    snapshots[finish] = snapshot
                    path = args.saida/f'{name}-varandas-{finish}.png'
                    case[finish] = {'state': snapshot['state'], 'finish': snapshot['finish'], 'png': png(page, path),
                                    'sourceSceneSHA256': snapshot['sourceSceneSHA256'], 'bakedDataSHA256': snapshot['bakedDataSHA256'],
                                    'meshCount': snapshot['meshCount'], 'bakedMeshes': snapshot['bakedMeshes']}
                    paths.append(path)
                    if finish == 'referencia':
                        watch_disposal(page)
                    page.evaluate('async()=>{await __livProva.dispose();await __livProva.dispose();}')
                    if finish == 'referencia':
                        case['cloneDisposal'] = page.evaluate('__qaFinishDisposal')
                        assert case['cloneDisposal'] == {'clone': 1, 'source': 1}, case['cloneDisposal']
                case['comparison'] = compare(snapshots['base'], snapshots['referencia'], paths)
                if name == 'desktop-webgpu':
                    case['referenceSheet'] = comparison_sheet(args.saida, *paths)
                page.goto(BASE_URL+'maquete-liv-ipanema.html?backend='+backend, wait_until='load', timeout=120000)
                wait_viewer(page, 'maquete')
                page.locator('[data-view="varandas"]').click()
                page.locator('#floor').select_option('8')
                initial = page.evaluate('()=>({viewer:__livViewer.getState(),proof:__livViewer.frame.contentWindow.__livProva.getState(),finish:__livViewer.frame.contentWindow.__livProva.finish})')
                assert initial['viewer']['view'] == initial['proof']['view'] == 'varandas', initial
                assert initial['proof']['floor'] == 8 and initial['finish']['profile'] == 'referencia', initial
                page.evaluate("()=>{const p=__livViewer.frame.contentWindow.__livProva,t=p.meshes.find(m=>m.name==='Blender / esquadrias-varandas-esquadria / torre 0');window.__qaIntegratedDispose=0;t.material.addEventListener('dispose',()=>window.__qaIntegratedDispose++);}")
                page.locator('[data-mode="planta2d"]').click()
                wait_viewer(page, 'planta2d')
                page.wait_for_function('__qaIntegratedDispose===1', timeout=15000)
                page.locator('[data-mode="maquete"]').click()
                wait_viewer(page, 'maquete')
                restored = page.evaluate('()=>({viewer:__livViewer.getState(),proof:__livViewer.frame.contentWindow.__livProva.getState(),finish:__livViewer.frame.contentWindow.__livProva.finish})')
                assert restored['viewer']['view'] == restored['proof']['view'] == 'varandas', restored
                assert restored['proof']['floor'] == 8 and restored['finish']['profile'] == 'referencia', restored
                assert same_camera(initial['proof']['camera'], restored['proof']['camera']), 'A câmera de varandas não foi restaurada'
                layout = page.evaluate("""()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,
                   minControlHeight:Math.min(...[...document.querySelectorAll('button,[data-view],select')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height)),
                   varandasText:document.querySelector('[data-view="varandas"]').textContent.trim(),
                   varandasPressed:document.querySelector('[data-view="varandas"]').getAttribute('aria-pressed')})""")
                assert not layout['overflow'] and layout['minControlHeight'] >= 44, layout
                assert layout['varandasText'] == 'Varandas' and layout['varandasPressed'] == 'true', layout
                case['integrated'] = {'initial': initial, 'restored': restored, 'layout': layout,
                                      'cloneReleasedBefore2D': True, 'oneActiveFrame': page.locator('iframe').count() == 1}
                page.screenshot(path=str(args.saida/f'{name}-integrado-varandas.png'), full_page=True)
                page.reload(wait_until='load', timeout=120000)
                wait_viewer(page, 'maquete')
                reloaded = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
                assert reloaded['view'] == 'varandas' and reloaded['floor'] == 8, reloaded
                assert same_camera(restored['proof']['camera'], reloaded['camera']), 'A sessão perdeu a câmera de varandas'
                case['integrated']['reloadSessionRestore'] = True
                page.evaluate("__livViewer.frame.contentWindow.__livProva.renderer.onError({api:'QA',type:'validation',message:'QA: erro recuperável após ready'})")
                page.wait_for_function('__livViewer.error&&__livViewer.frame===null', timeout=15000)
                page.locator('#retry').click()
                wait_viewer(page, 'maquete')
                recovered = page.evaluate('__livViewer.frame.contentWindow.__livProva.getState()')
                assert recovered['view'] == 'varandas' and recovered['floor'] == 8, recovered
                assert same_camera(reloaded['camera'], recovered['camera']), 'A recuperação perdeu a câmera de varandas'
                assert page.evaluate('__livViewer.frame.contentWindow.__livProva.finish.profile') == 'referencia'
                case['integrated']['singleClickErrorRecovery'] = True
                assert not case['errors'] and not case['httpFailures'], case
                case['status'] = 'PASS'
                context.close()
            report['rejectedFinish'] = check_rejected_finish(browser)
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL'
        report['failure'] = str(error)
        raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}))


if __name__ == '__main__':
    main()
