"""Confere o corte de apresentação no renderer real, sem modificar a cena fonte.

Aparelhos/toque são emulados. Capturas usam o canvas, sem cobrir pixels com UI.
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
from qa_interiores import CHROME
from qa_cameras_interiores import scene_identity

EXP = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/interior.html'
PROFILES = {'webgpu': (1200, 900, 'webgpu'), 'webgl': (1200, 900, 'webgl'), 'toque': (390, 844, 'auto')}


def capture(page, path):
    encoded = page.evaluate('async()=>{await new Promise(requestAnimationFrame);return __livInterior.capture();}')
    raw = base64.b64decode(encoded.split(',', 1)[1])
    path.write_bytes(raw)
    pixels = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'), dtype=np.float32)
    assert pixels.std() > 3
    return pixels


def run_case(browser, profile, typology, out, cases):
    width, height, backend = PROFILES[profile]
    mobile = profile == 'toque'
    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=mobile,
                                  is_mobile=mobile, device_scale_factor=3 if mobile else 1)
    page = context.new_page()
    case = {'profile': profile, 'typology': typology, 'errors': [], 'status': 'RUNNING'}
    cases.append(case)
    page.on('pageerror', lambda error: case['errors'].append(str(error)))
    try:
        page.goto(URL + f'?tipologia={typology}&backend={backend}', timeout=120000)
        page.wait_for_function('()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready;}', timeout=120000)
        page.evaluate('async()=>{await __livInterior.renderer.setAnimationLoop(null);await __livInterior.capture();}')
        initial = page.evaluate('__livInterior.getState()')
        case['backend'] = initial['backend']
        case['presentation'] = initial['presentation']
        assert backend == 'auto' or case['backend'] == backend
        assert not initial['presentation']['active'] and initial['lighting']['bakedActive']
        assert not initial['presentation']['clipShadows'] and not initial['shadows']['needsUpdate']
        before = scene_identity(page)
        prefix = out / f'{profile}-{typology}'
        assert page.locator('#cut-interior').get_attribute('aria-pressed') == 'false'
        full = capture(page, prefix.with_name(prefix.name + '-inteiras.png'))
        page.locator('#cut-interior').click()
        assert page.evaluate('__livInterior.getState().presentation.active')
        cut = capture(page, prefix.with_name(prefix.name + '-corte.png'))
        assert page.locator('#cut-interior').get_attribute('aria-pressed') == 'true'
        page.locator('#cut-interior').click()
        assert not page.evaluate('__livInterior.getState().presentation.active')
        assert full.shape == cut.shape
        # An independent raycast locates an opaque wall in the full source, then
        # a room/furniture surface beyond the display plane. Pixel deltas prove
        # the real GPU shader discarded upper walls, on both renderer backends.
        case['probes'] = page.evaluate('''async()=>{
          const api=__livInterior,T=await import('three/webgpu'),ray=new T.Raycaster(),s=api.getState();
          const group=api.scene.getObjectByName('Corte da Planta 3D'),caps=api.scene.getObjectByName('Topo do corte das paredes');
          const upper=[],lower=[],width=api.renderer.domElement.width,height=api.renderer.domElement.height;
          api.scene.updateMatrixWorld(true);api.camera.updateMatrixWorld(true);
          const clipped=o=>{for(let p=o;p;p=p.parent)if(p===group)return true;return false;};
          const visible=(o,cut)=>{if(o===caps)return cut;for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
          const opaque=h=>{const m=Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;return !m.transparent||m.opacity>=.7;};
          const sample=(x,y)=>{
            ray.setFromCamera(new T.Vector2(x,y),api.camera);
            const hits=ray.intersectObjects(api.scene.children,true).filter(opaque);
            const a=hits.find(h=>visible(h.object,false)),b=hits.find(h=>visible(h.object,true)&&(!clipped(h.object)||h.point.y<=s.presentation.height));
            return {a,b};
          };
          const unchanged=({a,b})=>a?.object.userData.livSlot===0&&b?.object===a.object&&
            a.point.y<s.presentation.height-.15&&a.point.distanceTo(b.point)<1e-6;
          for(let iy=-14;iy<=14;iy++)for(let ix=-16;ix<=16;ix++){
            const px=Math.floor((ix*.05+1)*.5*width),py=Math.floor((1-iy*.05)*.5*height);
            const x=2*(px+.5)/width-1,y=1-2*(py+.5)/height,{a,b}=sample(x,y);
            if(a?.object.userData.livSlot!==0||!b)continue;
            const data={ndc:[x,y],pixel:[px,py],sourcePoint:a.point.toArray(),revealedSlot:b.object.userData.livSlot??null,
              revealedFurniture:b.object.userData.furnitureId??null};
            if(a.point.y>s.presentation.height+.15&&b.object!==a.object&&b.object!==caps&&upper.length<40)upper.push(data);
            // Exclude silhouettes/window edges: the whole pixel patch must see
            // the same uncut wall, including a two-pixel antialiasing margin.
            if(lower.length<40&&unchanged({a,b})&&[-2,0,2].every(dx=>[-2,0,2].every(dy=>unchanged(sample(x+2*dx/width,y+2*dy/height)))))lower.push(data);
          }
          return {upper,lower};
        }''')
        for kind in ('upper', 'lower'):
            assert len(case['probes'][kind]) >= 5, case['probes']
            for probe in case['probes'][kind]:
                x, y = probe['pixel']
                probe['maxMeanRgbDelta'] = float(np.max(np.abs(
                    cut[y-1:y+2, x-1:x+2].mean(axis=(0, 1)) - full[y-1:y+2, x-1:x+2].mean(axis=(0, 1)))))
        upper = [p['maxMeanRgbDelta'] for p in case['probes']['upper']]
        lower = [p['maxMeanRgbDelta'] for p in case['probes']['lower']]
        assert sum(d > 5 for d in upper) >= 5, upper
        assert max(lower) <= 3, lower
        case['capVoids'] = page.evaluate('''async()=>{
          const api=__livInterior,T=await import('three/webgpu'),{createLayout}=await import('./interior-navigation.js');
          const c=await (await fetch('./interiores/catalogo.json')).json(),unit=await (await fetch('./'+c.tipologias[api.typology].files.unit.path)).json();
          const layout=createLayout(unit),caps=api.scene.getObjectByName('Topo do corte das paredes'),ray=new T.Raycaster();
          return unit.planta.portas.map(door=>{
            const p=[door.p[0]-layout.center[0],door.p[1]-layout.center[1]];
            ray.set(new T.Vector3(p[0],api.getState().presentation.height+.2,p[1]),new T.Vector3(0,-1,0));ray.far=.4;
            return {point:p,hits:ray.intersectObject(caps).length};
          });
        }''')
        assert case['capVoids'] and all(p['hits'] == 0 for p in case['capVoids']), case['capVoids']
        saved_full = page.evaluate('__livInterior.getState()')
        assert page.evaluate('__livInterior.setWallCut(true)')
        capture(page, prefix.with_name(prefix.name + '-corte-retorno.png'))
        assert not page.evaluate('__livInterior.getState().shadows.needsUpdate'), 'Corte recalculou a sombra física.'
        assert before == scene_identity(page), 'Corte alterou os mapas/materiais/geometria da cena fonte.'
        page.locator('#mode-visita').click()
        case['tour'] = page.evaluate('__livInterior.getState()')
        assert case['tour']['ceiling']['visible'] and not case['tour']['presentation']['active']
        assert case['tour']['lighting']['bakedActive'] and case['tour']['navigation']['safe']
        assert page.locator('#cut-interior').is_hidden()
        assert not page.evaluate('__livInterior.setWallCut(false)')
        capture(page, prefix.with_name(prefix.name + '-tour.png'))
        page.locator('#mode-planta3d').click()
        assert page.evaluate('__livInterior.getState().presentation.active')
        assert page.evaluate('s=>__livInterior.restoreState(s)', saved_full)
        assert page.locator('#cut-interior').get_attribute('aria-pressed') == 'false'
        assert not page.evaluate('__livInterior.getState().presentation.active')
        # Older session snapshots have no presentation field and remain valid.
        old_snapshot = dict(saved_full)
        old_snapshot.pop('presentation')
        assert page.evaluate('s=>__livInterior.restoreState(s)', old_snapshot)
        assert before == scene_identity(page)
        page.evaluate('async()=>{await __livInterior.dispose();}')
        case['ownership'] = page.evaluate('__livInterior.getState().ownership')
        assert case['ownership']['created'] == case['ownership']['disposed'], case['ownership']
        assert not case['errors'], case['errors']
        case['status'] = 'PASS'
        print(json.dumps({'profile': profile, 'typology': typology, 'status': 'PASS'}), flush=True)
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--perfil', choices=['todos', *PROFILES], default='todos')
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias/corte-interiores')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    pins = ('interior-cutaway.js', 'interior-renderer.js', 'interior.html', 'material-rgbm.js',
            'interior-camera.js', 'interior-navigation.js', 'interiores/catalogo.json',
            'qa_corte_interiores.py', 'qa_cameras_interiores.py', 'qa_interiores.py')
    report = {'status': 'RUNNING', 'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'physicalMobile': False,
              'sourceSHA256': {name: hashlib.sha256((EXP / name).read_bytes()).hexdigest() for name in pins}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            report['browserVersion'] = browser.version
            for profile in (PROFILES if args.perfil == 'todos' else [args.perfil]):
                for typology in ('canto', 'meio'):
                    run_case(browser, profile, typology, args.saida, report['cases'])
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report.update(status='FAIL', failure=str(error))
        raise
    finally:
        (args.saida / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}))


if __name__ == '__main__':
    main()
