"""Confere enquadramento e vistas dos dois interiores nos backends reais.

Chrome descartável; celulares/toque são emulados, sem medir FPS físico.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright
from qa_interiores import CHROME, URL, capture, drag, interior_frame, ready

EXP = Path(__file__).resolve().parent
PROFILES = {'webgpu': (1440, 900, 'webgpu'), 'webgl': (1440, 900, 'webgl'), 'toque': (390, 844, 'auto')}


def projection(frame):
    data = frame.evaluate('''async()=>{
      const api=__livInterior,T=await import('three/webgpu');api.scene.updateMatrixWorld(true);api.camera.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(api.scene),corners=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
        corners.push(new T.Vector3(x,y,z).project(api.camera).toArray());
      const stage=document.querySelector('#interior-stage').getBoundingClientRect();
      return {corners,limits:api.getState().framing.limits,camera:api.getState().camera,
        viewport:[stage.width,stage.height],canvas:[api.renderer.domElement.width,api.renderer.domElement.height]};
    }''')
    limits = data['limits']
    assert all(abs(x) <= limits['x'] + 1e-5 and abs(y) <= limits['y'] + 1e-5 and abs(z) < 1
               for x, y, z in data['corners']), data
    return data


def scene_identity(frame):
    return frame.evaluate('''async()=>{
      const api=__livInterior,parts=[];api.scene.updateMatrixWorld(true);
      api.scene.traverse(mesh=>{if(mesh.isMesh)parts.push({slot:mesh.userData.livSlot,matrix:mesh.matrixWorld.toArray(),
        geometry:mesh.geometry.uuid,materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>({
          id:m.uuid,type:m.type,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,
          maps:['map','normalMap','roughnessMap','metalnessMap'].map(k=>m[k]?.uuid||null)}))});});
      return {baked:api.getState().lighting.bakedActive,parts};
    }''')


def run_case(browser, profile, width, height, backend, out, report):
    mobile = profile == 'toque'
    case = {'profile': profile, 'backendRequested': backend, 'viewport': [width, height], 'errors': [], 'typologies': {}}
    report['cases'].append(case)
    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=mobile,
                                  is_mobile=mobile, device_scale_factor=3 if mobile else 1, accept_downloads=True)
    page = context.new_page()
    page.on('pageerror', lambda error: case['errors'].append(str(error)))
    try:
        page.goto(URL + '?backend=' + backend, wait_until='load', timeout=120000)
        ready(page, 'maquete')
        for typology in ('canto', 'meio'):
            details = {'rooms': [], 'resizes': [], 'captures': []}
            case['typologies'][typology] = details
            page.locator('#typology').select_option(typology)
            page.locator('[data-mode="planta3d"]').click()
            ready(page, 'planta3d', typology)
            frame = interior_frame(page)
            details['backend'] = frame.evaluate('__livInterior.backend')
            assert backend == 'auto' or details['backend'] == backend
            details['initialFrame'] = projection(frame)
            before = scene_identity(frame)
            drag(page, frame.locator('#interior-canvas'), mobile)
            assert frame.evaluate('__livInterior.getState().camera.autoFrame') is False
            frame.locator('#frame-interior').click()
            details['resetFrame'] = projection(frame)
            assert frame.evaluate('__livInterior.getState().camera.autoFrame') is True
            details['captures'].append(capture(page, out / f'{profile}-{typology}-planta.png'))
            if mobile:
                for viewport in ({'width': 320, 'height': 568}, {'width': 844, 'height': 390}, {'width': width, 'height': height}):
                    page.set_viewport_size(viewport)
                    page.wait_for_timeout(300)
                    details['resizes'].append(projection(frame))
                assert frame.locator('#frame-interior').bounding_box()['height'] >= 44
            # Real UI walking, followed by deterministic inspections of all room views.
            room_ids = frame.evaluate('__livInterior.getState().rooms.map(r=>r.id)')
            frame.locator('#room-select').select_option(room_ids[0])
            frame.locator('#room-go').click()
            frame.wait_for_function('''()=>{
              const api=__livInterior;if(!api.navigationDiagnostics().safe)throw Error('Câmera atravessou um obstáculo.');
              return !api.navigationDiagnostics().followingRoute;
            }''', timeout=30000)
            details['realArrival'] = frame.evaluate('__livInterior.getState().roomView')
            assert details['realArrival']['roomId'] == room_ids[0]
            assert frame.locator('#frame-interior').is_hidden()
            for room_id in room_ids:
                assert frame.evaluate('id=>__livInterior.goToRoom(id,{instant:true})', room_id)
                data = frame.evaluate('''()=>{
                  const api=__livInterior,s=api.getState();return {roomId:s.roomView?.roomId,view:s.roomView,
                    camera:s.camera,safe:s.navigation.safe,ceiling:s.ceiling.visible};
                }''')
                assert data['safe'] and data['ceiling']
                assert data['view'] is None or data['roomId'] == room_id
                assert all(isinstance(data['camera'][k], (int, float)) for k in ('yaw', 'pitch'))
                details['rooms'].append({'requested': room_id, **data})
                if data['view'] and data['view']['focusId']:
                    details['captures'].append(capture(page, out / f'{profile}-{typology}-{room_id}.png'))
            frame.locator('#mode-planta3d').click()
            ready(page, 'planta3d', typology)
            details['returnedFrame'] = projection(frame)
            assert before == scene_identity(frame), 'Câmeras alteraram geometria, materiais ou bake.'
            # A manually changed camera survives resize and snapshot restoration.
            drag(page, frame.locator('#interior-canvas'), mobile)
            frame.evaluate('async()=>{await __livInterior.renderer.setAnimationLoop(null);await __livInterior.capture();window.__qaCameraSnapshot=__livInterior.getState();}')
            saved = frame.evaluate('__qaCameraSnapshot.camera')
            page.set_viewport_size({'width': width + 30, 'height': height})
            page.wait_for_timeout(300)
            assert frame.evaluate('__livInterior.getState().camera.position') == saved['position'], 'Resize apagou a órbita manual.'
            assert frame.evaluate('__livInterior.restoreState(__qaCameraSnapshot)')
            restored = frame.evaluate('__livInterior.getState().camera.position')
            details['snapshotMaxPositionDelta'] = max(abs(a-b) for a,b in zip(restored,saved['position']))
            assert details['snapshotMaxPositionDelta'] < 1e-9, 'Snapshot apagou a órbita manual.'
            details['manualCameraPreserved'] = True
            page.set_viewport_size({'width': width, 'height': height})
            frame.locator('#frame-interior').click()
            details['finalFrame'] = projection(frame)
            frame.evaluate('async()=>{await __livInterior.dispose();}')
            ownership = frame.evaluate('__livInterior.getState().ownership')
            assert ownership['created'] == ownership['disposed'], ownership
            details['ownership'] = ownership
            page.locator('[data-mode="planta2d"]').click()
            ready(page, 'planta2d', typology)
        assert not case['errors'], case['errors']
        case['status'] = 'PASS'
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias/cameras-interiores')
    parser.add_argument('--perfil', choices=['todos', *PROFILES], default='todos')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'status': 'RUNNING', 'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'physicalMobile': False,
              'sourceSHA256': {name: hashlib.sha256((EXP / name).read_bytes()).hexdigest() for name in
                ('interior-camera.js', 'interior-cutaway.js', 'interior-renderer.js', 'interior.html', 'interior-navigation.js',
                 'interiores/catalogo.json', 'qa_cameras_interiores.py')}, 'cases': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            report['browserVersion'] = browser.version
            profiles = PROFILES if args.perfil == 'todos' else {args.perfil: PROFILES[args.perfil]}
            for profile, (width, height, backend) in profiles.items():
                run_case(browser, profile, width, height, backend, args.saida, report)
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report.update(status='FAIL', failure=str(error))
        raise
    finally:
        (args.saida / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(args.saida)}))


if __name__ == '__main__':
    main()
