"""Mede abertura e submissão de quadros sem confundir viewport com celular físico."""
import argparse
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
EXP = Path(__file__).resolve().parent
SAMPLE = """async (duration) => {
  const m=window.__maq, renderer=m.ren, gl=renderer.getContext();
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  const original=renderer.render, times=[], costs=[];
  const initialTheta=m.orb.th, started=performance.now();
  renderer.render=function(...args) {
    const t=performance.now(); times.push(t);
    m.orb.th=initialTheta+(t-started)*0.00012;
    const result=original.apply(this,args); costs.push(performance.now()-t);
    return result;
  };
  try { await new Promise(resolve=>setTimeout(resolve,duration)); }
  finally { renderer.render=original; m.orb.th=initialTheta; m.poeCam(); }
  const intervals=times.slice(1).map((t,i)=>t-times[i]);
  const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);
    return sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]:null;};
  const nav=performance.getEntriesByType('navigation')[0];
  const resources=performance.getEntriesByType('resource');
  return {sampleMs:performance.now()-started,renderSubmissions:times.length,
    intervalP50Ms:percentile(intervals,.5),intervalP95Ms:percentile(intervals,.95),
    cpuSubmitP50Ms:percentile(costs,.5),cpuSubmitP95Ms:percentile(costs,.95),
    gpuVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,
    gpuRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
    webglVersion:gl.getParameter(gl.VERSION),runtime:THREE.REVISION,
    dpr:renderer.getPixelRatio(),camera:m.cam.position.toArray(),target:m.alvo.toArray(),
    renderInfo:{...renderer.info.render},memoryObjects:{...renderer.info.memory},
    jsHeap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,
    navigation:nav?{transferBytes:nav.transferSize,encodedBytes:nav.encodedBodySize,
      decodedBytes:nav.decodedBodySize,domContentLoadedMs:nav.domContentLoadedEventEnd,
      loadMs:nav.loadEventEnd,responseMs:nav.responseEnd}:null,
    resourceTransferBytes:resources.reduce((n,r)=>n+r.transferSize,0),
    meshes:m.predio.children.filter(o=>o.isMesh).length,
    visibleMeshes:m.predio.children.filter(o=>o.isMesh&&o.visible).length};
}"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/site-baseline')
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias' / 'medicao-baseline')
    parser.add_argument('--rodadas', type=int, default=3)
    parser.add_argument('--amostra-ms', type=int, default=6000)
    parser.add_argument('--software', action='store_true', help='Permite SwiftShader; resultados não comprovam desempenho físico.')
    args = parser.parse_args()
    args.saida.mkdir(parents=True, exist_ok=True)
    result = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(),
              'url': args.base_url, 'platform': platform.platform(), 'headless': True,
              'physicalMobile': False, 'network': 'loopback; sem simulação de 4G',
              'timingMeaning': 'intervalo entre submissões ao renderer; não tempo GPU',
              'softwareAllowed': args.software, 'rounds': [], 'status': 'RUNNING'}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True,
                                        args=['--enable-unsafe-swiftshader'] if args.software else [])
            result['browserVersion'] = browser.version
            for width, height in [(1440, 900), (390, 844)]:
                for round_id in range(args.rodadas):
                    context = browser.new_context(viewport={'width': width, 'height': height},
                                                  device_scale_factor=1, is_mobile=width == 390,
                                                  has_touch=width == 390)
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(args.base_url.rstrip('/') + '/maquete-liv-ipanema.html',
                              wait_until='load', timeout=120000)
                    page.wait_for_function('window.__maq && window.__livLightmap?.ready', timeout=120000)
                    page.locator('#c').scroll_into_view_if_needed()
                    ready_ms = page.evaluate('performance.now()')
                    page.wait_for_timeout(700)
                    cold = page.evaluate(SAMPLE, args.amostra_ms)
                    if round_id == 0:
                        for view in ['perspectiva', 'fachada', 'aerea']:
                            page.locator('[data-vista="' + view + '"]').click()
                            page.wait_for_timeout(200)
                            page.locator('#c').screenshot(path=str(args.saida / f'{width}-{view}.png'))
                    page.reload(wait_until='load', timeout=120000)
                    page.wait_for_function('window.__maq && window.__livLightmap?.ready', timeout=120000)
                    warm_ready_ms = page.evaluate('performance.now()')
                    page.locator('#c').scroll_into_view_if_needed()
                    page.wait_for_timeout(700)
                    warm = page.evaluate(SAMPLE, args.amostra_ms)
                    result['rounds'].append({'viewport': [width, height], 'mobileEmulated': width == 390,
                                             'round': round_id + 1, 'coldReadyMs': ready_ms,
                                             'warmReadyMs': warm_ready_ms, 'cold': cold, 'warm': warm,
                                             'errors': errors})
                    context.close()
                    if errors:
                        raise RuntimeError(str(errors))
            browser.close()
        result['status'] = 'PASS'
    except Exception as exc:
        result['status'] = 'FAIL'
        result['failure'] = str(exc)
        raise
    finally:
        path = args.saida / 'medicao.json'
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': result['status'], 'rounds': len(result['rounds']), 'report': str(path)}))


if __name__ == '__main__':
    main()
