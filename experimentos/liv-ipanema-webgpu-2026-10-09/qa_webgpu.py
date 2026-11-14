"""Verifica a prova real em WebGPU e WebGL2, sem tratar emulação como aparelho físico."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
GPU_STATE = """()=>{
  const p=window.__livProva,r=p.renderer,b=r.backend;
  const gl=b.isWebGLBackend?b.getContext():null,ext=gl?.getExtension('WEBGL_debug_renderer_info');
  let meshes=0,baked=0,instances=0;
  p.scene.traverse(o=>{if(o.isMesh){meshes++; if(o.userData.livBakedTransport)baked++;
    if(o.isInstancedMesh)instances+=o.count;}});
  const info=b.device?.adapterInfo;
  return {backend:p.backend,revision:r.isWebGPURenderer?r.type:null,
    stockMaterials:p.materials.filter(m=>!m.userData.livBakedTransport).map(m=>({type:m.type,nodeMaterial:!!m.isNodeMaterial})),
    gpu:info?{vendor:info.vendor,architecture:info.architecture,device:info.device,
      description:info.description,isFallbackAdapter:info.isFallbackAdapter}:null,
    webglRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
    meshes,baked,instances,camera:p.camera.position.toArray(),cameraType:p.camera.type,fov:p.camera.fov||null,
    target:p.controls.target.toArray(),renderInfo:{...r.info.render}};
}"""
BOUNDS = """()=>{
  const p=__livProva,b=p.visibleBounds,points=[];
  p.camera.updateMatrixWorld();
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])
    points.push(b.min.clone().set(x,y,z).project(p.camera));
  return {maxXY:Math.max(...points.flatMap(v=>[Math.abs(v.x),Math.abs(v.y)])),
    maxZ:Math.max(...points.map(v=>Math.abs(v.z)))};
}"""
COLOR_SUM = """()=>{
 const p=__livProva;let tower=0,site=0,green=0;
 for(const m of p.meshes){const c=m.isInstancedMesh?m.instanceColor:m.geometry.getAttribute('color');if(!c)continue;
   for(let i=0;i<c.count;i++){const sum=c.getX(i)+c.getY(i)+c.getZ(i);if(m.userData.tower===0){tower+=sum;
     if(c.getY(i)>.9&&c.getX(i)<.4)green++;}else site+=sum;}}
 return {tower,site,green};
}"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/prova-rgbm.html')
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias' / 'prova-webgpu')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'url': args.url,
              'headless': True, 'physicalMobile': False, 'cases': [], 'status': 'RUNNING'}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                headless=True)
            report['browserVersion'] = browser.version
            for backend in ['webgl', 'webgpu']:
                for width, height in [(1440, 900), (390, 844)]:
                    case = {'requestedBackend': backend, 'viewport': [width, height],
                            'mobileEmulated': width == 390, 'status': 'RUNNING', 'errors': [],
                            'httpFailures': [], 'views': {}}
                    report['cases'].append(case)
                    context = browser.new_context(viewport={'width': width, 'height': height},
                                                  device_scale_factor=1, is_mobile=width == 390,
                                                  has_touch=width == 390, accept_downloads=True)
                    page = context.new_page()
                    page.on('pageerror', lambda error, c=case: c['errors'].append(str(error)))
                    page.on('response', lambda response, c=case: c['httpFailures'].append(
                        {'url': response.url, 'status': response.status}) if response.status >= 400 else None)
                    page.goto(args.url + '?backend=' + backend, wait_until='load', timeout=120000)
                    page.wait_for_function('window.__livProva?.ready || window.__livProva?.error', timeout=120000)
                    error = page.evaluate('window.__livProva.error || null')
                    if error:
                        raise RuntimeError(str(error))
                    case['initial'] = page.evaluate(GPU_STATE)
                    assert case['initial']['backend'] == backend, case['initial']
                    assert case['initial']['meshes'] == 56 and case['initial']['baked'] == 41, case['initial']
                    assert case['initial']['stockMaterials'] and all(
                        m['type']=='MeshStandardMaterial' and not m['nodeMaterial']
                        for m in case['initial']['stockMaterials']), case['initial']
                    canvas = page.locator('canvas').first
                    canvas.scroll_into_view_if_needed()
                    for view in ['perspectiva', 'fachada', 'aerea', 'portaria', 'implantacao']:
                        page.evaluate('view=>window.__livProva.setView(view)', view)
                        page.wait_for_timeout(300)
                        case['views'][view] = page.evaluate(GPU_STATE)
                        if view == 'portaria':
                            assert case['views'][view]['fov'] == 60, case['views'][view]
                        if view == 'implantacao':
                            assert case['views'][view]['cameraType'] == 'OrthographicCamera', case['views'][view]
                        if view in ['perspectiva', 'aerea', 'implantacao']:
                            bounds=page.evaluate(BOUNDS)
                            assert bounds['maxXY'] < 1.01 and bounds['maxZ'] < 1.01, (view,bounds)
                            case['views'][view]['bounds']=bounds
                        canvas.screenshot(path=str(args.saida / f'{backend}-{width}-{view}.png'))
                    page.evaluate("window.__livProva.setView('perspectiva')")
                    page.wait_for_timeout(300)
                    before_colors=page.evaluate(COLOR_SUM)
                    page.evaluate('window.__livProva.setFloor(8)')
                    highlighted=page.evaluate(COLOR_SUM)
                    assert highlighted['green']>0 and highlighted['site']==before_colors['site'], highlighted
                    page.evaluate('window.__livProva.setFloor(-1)')
                    reset=page.evaluate(COLOR_SUM)
                    assert abs(reset['tower']-before_colors['tower'])<.01 and reset['site']==before_colors['site'], reset
                    case['floorHighlight']={'changed':highlighted['green'],'sitePreserved':True,'reset':True}
                    before = page.evaluate('window.__livProva.camera.position.toArray()')
                    rect = canvas.bounding_box()
                    x, y = rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] / 2
                    if width == 390:
                        session = context.new_cdp_session(page)
                        session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
                        for i in range(1, 9):
                            session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + 90*i/8, 'y': y + 20*i/8}]})
                            page.wait_for_timeout(30)
                        session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                        session.detach()
                    else:
                        page.mouse.move(x, y)
                        page.mouse.down()
                        page.mouse.move(x + 90, y + 20, steps=8)
                        page.mouse.up()
                    page.wait_for_timeout(300)
                    after = page.evaluate('window.__livProva.camera.position.toArray()')
                    assert sum(abs(a - b) for a, b in zip(before, after)) > .1, (before, after)
                    case['orbitChanged'] = True
                    with page.expect_download(timeout=15000) as download_info:
                        page.evaluate('window.__livProva.capture()')
                    download = download_info.value
                    path = args.saida / f'{backend}-{width}-captura.png'
                    download.save_as(path)
                    data = path.read_bytes()
                    assert data[:8] == b'\x89PNG\r\n\x1a\n' and len(data) > 10000
                    case['pngBytes'] = len(data)
                    assert not case['errors'] and not case['httpFailures'], case
                    case['status'] = 'PASS'
                    context.close()
            browser.close()
        report['status'] = 'PASS'
    except Exception as exc:
        report['status'] = 'FAIL'
        report['failure'] = str(exc)
        raise
    finally:
        path = args.saida / 'runtime.json'
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'report': str(path)}))


if __name__ == '__main__':
    main()
