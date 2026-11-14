"""Confere RGBM próprio, estabilidade da parede e custo/atualização de sombras.

Comparação sequencial no Chrome desktop, incluindo viewport/toque emulados.
Contagem de passes é medição do renderer; não é medição de FPS em celular.
"""
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

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES = {'webgpu': ('webgpu', 1200, 900, False), 'webgl': ('webgl', 1200, 900, False),
            'toque': ('auto', 390, 844, True)}


def capture(page, path):
    encoded = page.evaluate('__qaFrame()')
    raw = base64.b64decode(encoded.split(',', 1)[1])
    path.write_bytes(raw)
    image = np.array(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=np.float32)
    assert image.std() > 3, 'Captura vazia ou uniforme.'
    return image


def run_case(browser, profile, typology, output, cases):
    backend, width, height, touch = PROFILES[profile]
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=3 if touch else 1,
                                  is_mobile=touch, has_touch=touch)
    page = context.new_page()
    result = {'profile': profile, 'typology': typology, 'status': 'RUNNING', 'errors': []}
    cases.append(result)
    page.on('pageerror', lambda error: result['errors'].append(str(error)))
    try:
        page.goto(URL+f'interior.html?tipologia={typology}&backend={backend}', timeout=120000)
        page.wait_for_function('()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready;}', timeout=120000)
        page.evaluate('''async()=>{await __livInterior.renderer.setAnimationLoop(null);
          // ShadowNode updates once per animation frame, even for manual renders.
          window.__qaFrame=async()=>{await new Promise(requestAnimationFrame);return __livInterior.capture();};
          await __qaFrame();}''')
        result['initial'] = page.evaluate('__livInterior.getState()')
        result['viewport'] = page.evaluate('({css:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:[document.querySelector("canvas").width,document.querySelector("canvas").height]})')
        assert result['initial']['lighting']['bakedActive'] and not result['initial']['shadows']['autoUpdate']
        if backend != 'auto':
            assert result['initial']['backend'] == backend
        prefix = output/f'{profile}-{typology}'
        result['shadowFrustum'] = page.evaluate('''async()=>{
          const api=__livInterior, THREE=await import('three/webgpu');
          const sun=api.scene.children.find(o=>o.isDirectionalLight&&o.castShadow);
          window.__qaShadow={sun,updates:0};const original=sun.shadow.updateMatrices.bind(sun.shadow);
          sun.shadow.updateMatrices=function(...args){__qaShadow.updates++;return original(...args);};
          api.scene.updateMatrixWorld(true);const box=new THREE.Box3();
          api.scene.traverse(o=>{if(o.isMesh&&o.castShadow)box.expandByObject(o);});
          const corners=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
            corners.push(new THREE.Vector3(x,y,z).project(sun.shadow.camera).toArray());
          const helper=new THREE.CameraHelper(sun.shadow.camera);api.scene.add(helper);window.__qaShadow.helper=helper;
          return {corners,maxAbs:Math.max(...corners.flat().map(Math.abs)),worldBounds:[box.min.toArray(),box.max.toArray()]};
        }''')
        assert result['shadowFrustum']['maxAbs'] <= 1.01, result['shadowFrustum']
        capture(page, prefix.with_name(prefix.name+'-frustum.png'))
        page.evaluate('()=>{__livInterior.scene.remove(__qaShadow.helper);__qaShadow.helper.dispose();}')
        result['walking'] = page.evaluate('''async()=>{
          const api=__livInterior, stats=[];api.setMode('visita');await __qaFrame();
          for(const automatic of [false,true]){
            __qaShadow.sun.shadow.autoUpdate=automatic;
            const updates=__qaShadow.updates,passes=api.renderer.info.render.calls, positions=[];
            for(let i=0;i<24;i++){
              api.move({forward:i%2?.015:-.015});positions.push(api.camera.position.toArray());
              api.camera.rotation.y+=(i%3-1)*.025;await __qaFrame();
            }
            stats.push({automatic,frames:24,shadowPasses:__qaShadow.updates-updates,
              totalPasses:api.renderer.info.render.calls-passes,drawCallsLastFrame:api.renderer.info.render.drawCalls,
              moved:positions.some(p=>p.some((v,i)=>Math.abs(v-positions[0][i])>.001))});
          }
          __qaShadow.sun.shadow.autoUpdate=false;return stats;
        }''')
        cached, automatic = result['walking']
        assert cached['moved'] and automatic['moved']
        assert cached['shadowPasses'] == 0 and automatic['shadowPasses'] >= automatic['frames'], result['walking']
        assert automatic['totalPasses'] >= cached['totalPasses']+automatic['frames'], result['walking']
        result['refresh'] = page.evaluate('''async()=>{
          const api=__livInterior, stats=[];
          async function check(name,change){const before=__qaShadow.updates;change();const pending=api.getState().shadows.needsUpdate;
            await __qaFrame();const updates=__qaShadow.updates-before,settled=api.getState().shadows.needsUpdate;
            await __qaFrame();stats.push({name,pending,updates,settled,repeatedUpdates:__qaShadow.updates-before-updates});}
          await check('forro oculto',()=>api.setMode('planta3d'));
          await check('mesmo modo',()=>api.setMode('planta3d'));
          window.__qaNominal=api.getState();window.__qaFurniture=__qaNominal.furniture[0].id;
          await check('móvel deslocado',()=>{if(!api.moveFurniture(__qaFurniture,.1,0))throw Error('Móvel não deslocou.');});
          if(api.getState().lighting.bakedActive)throw Error('Bake incompatível permaneceu ativo.');
          return stats;
        }''')
        for item in result['refresh']:
            expected = item['name'] != 'mesmo modo'
            assert item['pending'] == expected and not item['settled'] and item['repeatedUpdates'] == 0, item
            assert (item['updates'] >= 1) == expected, item
        moved = capture(page, prefix.with_name(prefix.name+'-movido-cache.png'))
        page.evaluate('__qaShadow.sun.shadow.autoUpdate=true')
        reference = capture(page, prefix.with_name(prefix.name+'-movido-recalculado.png'))
        page.evaluate('__qaShadow.sun.shadow.autoUpdate=false')
        result['movedShadowReferenceMaxRgbDelta'] = float(np.max(np.abs(moved-reference)))
        assert result['movedShadowReferenceMaxRgbDelta'] <= 1, 'Sombra após mover difere do recálculo de referência.'
        result['restore'] = page.evaluate('''async()=>{
          const before=__qaShadow.updates,started=performance.now(),ok=__livInterior.restoreState(__qaNominal),cpuMs=performance.now()-started,pending=__livInterior.getState().shadows.needsUpdate;
          await __qaFrame();return {ok,pending,cpuMs,shadowPasses:__qaShadow.updates-before,state:__livInterior.getState()};
        }''')
        assert result['restore']['ok'] and result['restore']['pending'] and result['restore']['shadowPasses'] >= 1
        assert result['restore']['state']['lighting']['bakedActive']
        restored = capture(page, prefix.with_name(prefix.name+'-restaurado-cache.png'))
        page.evaluate('__qaShadow.sun.shadow.autoUpdate=true')
        reference = capture(page, prefix.with_name(prefix.name+'-restaurado-recalculado.png'))
        page.evaluate('__qaShadow.sun.shadow.autoUpdate=false')
        result['restoredShadowReferenceMaxRgbDelta'] = float(np.max(np.abs(restored-reference)))
        assert result['restoredShadowReferenceMaxRgbDelta'] <= 1
        # A parede é amostrada no mesmo ponto/UV1 apesar de aparecer em outro pixel.
        result['wall'] = page.evaluate('''async()=>{
          const api=__livInterior, THREE=await import('three/webgpu');api.setMode('visita');await __qaFrame();
          // Keep this regression pose independent of the Tour's editorial focus.
          api.camera.rotation.set(0,api.typology==='canto'?4*Math.PI/9:-Math.PI/2,0,'YXZ');api.camera.updateMatrixWorld(true);
          let wall;api.scene.traverse(o=>{if(o.isMesh&&o.userData.livSlot===0)wall=o;});
          const ray=new THREE.Raycaster();let hit;
          for(const y of [.65,.5,.8,.35]){
            ray.setFromCamera(new THREE.Vector2(0,y),api.camera);
            const first=ray.intersectObjects(api.scene.children,true).find(h=>{
              const m=Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;
              return !m.transparent||m.opacity>=.7;
            });
            if(first?.object===wall&&first.point.y>2.1){hit=first;break;}
          }
          if(!hit)throw Error('Parede visível acima da porta não encontrada na pose de regressão.');
          window.__qaWall={point:hit.point.clone(),wall,rotation:api.camera.rotation.y};
          return {point:hit.point.toArray(),face:hit.faceIndex,uv1:hit.uv1?.toArray(),firstOpaque:true,regressionYaw:api.camera.rotation.y};
        }''')
        samples = []
        for turn in [0, .08]:
            sample = page.evaluate('''async turn=>{
              const api=__livInterior, THREE=await import('three/webgpu');api.camera.rotation.y=__qaWall.rotation+turn;
              await __qaFrame();api.camera.updateMatrixWorld();const p=__qaWall.point.clone().project(api.camera);
              const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),api.camera);
              const hit=ray.intersectObject(__qaWall.wall)[0];
              const first=ray.intersectObjects(api.scene.children,true).find(h=>{
                const m=Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;
                return !m.transparent||m.opacity>=.7;
              });
              if(first?.object!==__qaWall.wall)throw Error('Uma superfície encobriu o ponto da parede.');
              return {ndc:p.toArray(),face:hit.faceIndex,uv1:hit.uv1.toArray(),distance:hit.point.distanceTo(__qaWall.point),firstOpaque:true};
            }''', turn)
            pixels = capture(page, prefix.with_name(prefix.name+f'-parede-{turn}.png'))
            x = round((sample['ndc'][0]+1)/2*pixels.shape[1])
            y = round((1-sample['ndc'][1])/2*pixels.shape[0])
            assert 4 <= x < pixels.shape[1]-4 and 4 <= y < pixels.shape[0]-4
            sample['rgb'] = pixels[y-2:y+3, x-2:x+3].mean(axis=(0, 1)).tolist()
            assert sample['face'] == result['wall']['face'] and sample['distance'] < 1e-6, sample
            assert max(abs(a-b) for a,b in zip(sample['uv1'], result['wall']['uv1'])) < 1e-6
            samples.append(sample)
        result['wall']['samples'] = samples
        result['wall']['maxMeanRgbDelta'] = max(abs(a-b) for a,b in zip(samples[0]['rgb'], samples[1]['rgb']))
        assert result['wall']['maxMeanRgbDelta'] <= 3, result['wall']
        result['disposed'] = page.evaluate('async()=>{await __livInterior.dispose();return __livInterior.getState();}')
        assert result['disposed']['ownership']['created'] == result['disposed']['ownership']['disposed']
        assert not result['errors'], result['errors']
        result['status'] = 'PASS'
    finally:
        context.close()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--perfil', choices=['todos', *PROFILES], default='todos')
    parser.add_argument('--saida', type=Path, default=EXP/'evidencias/luz-estatica')
    args = parser.parse_args();args.saida.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING', 'physicalMobile': False,
              'sourceSHA256': {name: hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
                ['qa_luz_estatica.py', 'interior-renderer.js', 'interior-camera.js', 'interior-cutaway.js', 'material-rgbm.js', 'interiores/catalogo.json']}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True);report['browserVersion'] = browser.version
            for profile in (PROFILES if args.perfil == 'todos' else [args.perfil]):
                for typology in ['canto', 'meio']:
                    run_case(browser, profile, typology, args.saida, report['cases'])
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL';report['failure'] = str(error);raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}))


if __name__ == '__main__':
    main()
