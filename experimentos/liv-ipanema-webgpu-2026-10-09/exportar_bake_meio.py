"""Exporta a cena nominal de Meio pelas fábricas nativas congeladas.

Usa um perfil Chrome descartável e o servidor local 8790. A rota de catálogo
do perfil seleciona a receita autoral, mesmo depois de adotar o bake no produto.
Não altera a cena do Blender aberta nem os arquivos canônicos do LIV.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
MEIO = EXP / 'interiores/meio'
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validar', action='store_true', help='Compara com a cena congelada sem regravá-la.')
    args = parser.parse_args()
    catalog = json.loads((EXP/'interiores/catalogo.json').read_bytes())
    record = catalog['tipologias']['meio']
    recipe = json.loads((MEIO/'recipe.json').read_bytes())
    for key, field in [('runtime', 'runtimeSHA256'), ('materials', 'materialsSHA256'), ('furniture', 'furnitureSHA256')]:
        asset = catalog['shared'][key]
        assert sha(EXP/asset['path']) == asset['sha256'] == recipe[field], key
    assert sha(MEIO/'unidade.json') == recipe['unitSHA256'] == record['unitSHA256']
    record.update(geometryKind='native-factories', lighting='dynamic', sourceSHA256=sha(MEIO/'recipe.json'))
    record['files'] = {key: {'path': 'interiores/meio/'+name, 'bytes': (MEIO/name).stat().st_size, 'sha256': sha(MEIO/name)}
                       for key, name in [('unit', 'unidade.json'), ('recipe', 'recipe.json')]}
    renderer_source = (EXP/'interior-renderer.js').read_text(encoding='utf-8')
    factory_source = renderer_source[renderer_source.index('function nativeFactory('):renderer_source.index('function bindFrozenFurniture(')]
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING',
              'unitSHA256': record['unitSHA256'], 'recipeSHA256': record['sourceSHA256'],
              'sharedSHA256': {key: item['sha256'] for key, item in catalog['shared'].items()},
              'exporterSHA256': sha(EXP/'exporter-native.js'),
              'nativeFactorySHA256': hashlib.sha256(factory_source.encode()).hexdigest(), 'errors': []}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=True)
        context = browser.new_context(viewport={'width': 1200, 'height': 900})
        context.route('**/interiores/catalogo.json', lambda route: route.fulfill(json=catalog))
        page = context.new_page()
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        try:
            page.goto(URL+'interior.html?tipologia=meio&modo=planta3d&backend=webgl', timeout=120000)
            page.wait_for_function('()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready;}', timeout=120000)
            source = page.evaluate('''async options=>{
              const api=__livInterior, THREE=await import('three/webgpu');
              const {createLayout}=await import('./interior-navigation.js');
              const unit=await (await fetch('./interiores/meio/unidade.json')).json(), layout=createLayout(unit);
              await api.renderer.setAnimationLoop(null);
              await import('./exporter-native.js');
              guardarAlbedoInteriorLiv(api.scene);
              const slots=[]; api.scene.traverse(mesh=>{if(mesh.isMesh)slots.push(mesh.userData.furnitureId||null);});
              const data=await exportarCenaInteriorLiv({THREE,root:api.scene,unitId:unit.id,unitHash:options.unitSHA256,
                unitPath:options.unitPath,height:layout.pd,mode:'planta3d',
                rooms:layout.rooms.map(r=>({name:r.name,x:r.cx,z:r.cz})),
                lighting:{name:'LIV Meio, luz diurna ilustrativa e plafons por ambiente',
                  world:{color:[.72,.82,1],strength:.45},
                  sun:{position:[-7,9,10],target:[0,0,0],energy:2.2,angleDegrees:4,color:[1,1,1]},
                  ceiling:{energy:45,size:.32,color:[1,.95,.86]}}});
              for(const object of data.objects){object.furnitureId=slots[object.slot];if(object.furnitureId)object.kind='furniture';}
              const furnitureSlots=api.getState().furniture.map((item,index)=>({id:item.id,index,
                slots:data.objects.filter(o=>o.furnitureId===item.id).map(o=>o.slot)}));
              if(furnitureSlots.some(m=>!m.slots.length))throw Error('Móvel nominal sem geometria exportada.');
              Object.assign(data.metadata,{nativeRecipeSHA256:options.recipeSHA256,nativeAssetsSHA256:options.sharedSHA256,
                nativeFactorySHA256:options.nativeFactorySHA256,
                exporterSHA256:options.exporterSHA256,furnitureSlots,materialOrigin:'native PBR snapshots',
                source2DSHA256:options.source2DSHA256});
              return data;
            }''', {**report, 'unitPath': str((MEIO/'unidade.json').resolve()),
                   'source2DSHA256': sha(EXP/'plantas2d/meio.jpg')})
            assert not report['errors'], report['errors']
            raw = (json.dumps(source, ensure_ascii=False, separators=(',', ':'))+'\n').encode()
            if args.validar:
                assert raw == (MEIO/'source.json').read_bytes(), 'A cena autoral difere do snapshot congelado; requalificar antes de adotar outro bake.'
            else:
                temporary = MEIO/'source.json.tmp'
                temporary.write_bytes(raw)
                temporary.replace(MEIO/'source.json')
            report.update(status='PASS', sourceSHA256=hashlib.sha256(raw).hexdigest(), sourceBytes=len(raw),
                          objects=len(source['objects']), bakeObjects=sum(o['bake'] for o in source['objects']),
                          furnitureCount=len(source['metadata']['furnitureSlots']), browserVersion=browser.version,
                          validatedExistingSource=args.validar)
            if not args.validar:
                page.screenshot(path=str(MEIO/'autoria-topo.png'))
                report['topImageSHA256'] = sha(MEIO/'autoria-topo.png')
                page.evaluate("__livInterior.setMode('visita')")
                page.evaluate('__livInterior.capture()')
                page.screenshot(path=str(MEIO/'autoria-tour.png'))
                report['tourImageSHA256'] = sha(MEIO/'autoria-tour.png')
        finally:
            (MEIO/('cena-reproduzida.json' if args.validar else 'cena-exportada.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
            context.close()
            browser.close()
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
