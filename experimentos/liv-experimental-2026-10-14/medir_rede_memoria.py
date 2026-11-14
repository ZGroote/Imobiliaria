"""Abertura com gzip, cache HTTP e rede emulada; memória amostrada por CDP."""
import argparse
import hashlib
import json
import platform
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from servidor_medido import MeasuredServer

EXP = Path(__file__).resolve().parent
PROBE = '''()=>{
 const viewer=window.__livViewer,p=viewer?.frame?.contentWindow?.__livProva||window.__maq;
 const renderer=p?.renderer||p?.ren;
 return {ready:viewer?.ready??!!(window.__maq&&window.__livLightmap?.ready),error:viewer?.error||null,
   backend:p?.backend||'webgl-legacy',trackedMemory:renderer?.info.memory||null,
   rendererTimings:p?.timings||null,canvas:renderer?[renderer.domElement.width,renderer.domElement.height]:null,
   physicalMobile:false};
}'''
RESOURCES = '''()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')]
 .filter(e=>e.initiatorType!=='iframe').map(e=>({path:new URL(e.name).pathname,type:e.initiatorType||'navigation',
 encodedBytes:e.encodedBodySize,decodedBytes:e.decodedBodySize,transferBytes:e.transferSize,durationMs:e.duration}))'''
CANVAS = '''(()=>{const install=()=>{if(!document.documentElement)return false;
 const style=document.createElement('style');style.textContent='#stage{box-sizing:content-box!important;width:720px!important;height:390px!important}';
 document.documentElement.append(style);return true;};if(!install()){const observer=new MutationObserver(()=>{if(install())observer.disconnect();});observer.observe(document,{childList:true});}})();'''


def save(output, report):
    (output / 'medicao.json').write_text(json.dumps(report, indent=2), encoding='utf8')


def main(output, rounds, mbps, latency, compression):
    output.mkdir(parents=True, exist_ok=True)
    sources = ['medir_rede_memoria.py', 'servidor_medido.py', 'viewer.js', 'renderer.js', 'catalogo-unidades.js',
               'comercial.js', 'comercial.json', 'espelho.js', 'unidades.js', 'picking.js', 'unit-ui.js', 'unit-ui.css',
               'cameras.js', 'maquete-liv-ipanema.html', 'transfer-worker.js', 'transfers.js', 'transfer-manifest.json',
               'assets-ambiente/manifest.json', 'modelo/entrada/candidato/assets/manifest.json',
               'modelo/entrada/unidades-entrada.json', 'site-baseline/maquete-liv-ipanema.html']
    report = {'status': 'RUNNING', 'recordedAt': datetime.now(timezone.utc).isoformat(), 'physicalMobile': False,
              'platform': platform.platform(), 'sources': {p: hashlib.sha256((EXP / p).read_bytes()).hexdigest() for p in sources},
              'networkEmulation': {'downloadMbps': mbps, 'uploadMbps': mbps, 'latencyMs': latency},
              'httpCompression': 'gzip level 6' if compression else 'identity', 'canvas': [720, 390], 'dpr': 1,
              'serviceWorkers': 'blocked to isolate initial screen and HTTP cache', 'sampleIntervalMs': 250,
              'limitations': ['Synthetic network, local server, no TLS/CDN; not physical mobile or real hosting.',
                             'CDP sampling adds overhead and may miss peaks; driver cache/other apps are uncontrolled.',
                             'Runtime heap/backing storage and renderer accounting are separate; not total process/VRAM memory.'], 'cases': []}
    server = MeasuredServer(EXP, compression).start()
    variants = [('base-publicada', 'site-baseline/maquete-liv-ipanema.html'),
                ('entrada-webgl', 'maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend=webgl'),
                ('entrada-webgpu', 'maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend=webgpu')]
    try:
        with sync_playwright() as pw:
            for number in range(rounds):
                for label, path in (variants if number % 2 == 0 else list(reversed(variants))):
                    browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
                    report['browserVersion'] = browser.version
                    context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, service_workers='block')
                    context.add_init_script(CANVAS);page = context.new_page();errors=[]
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    cdp = context.new_cdp_session(page);cdp.send('Network.enable')
                    cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': latency,
                             'downloadThroughput': mbps * 1000000 / 8, 'uploadThroughput': mbps * 1000000 / 8})
                    for cache in ['cold', 'reload']:
                        case = {'variant': label, 'round': number + 1, 'cache': cache, 'samples': [], 'status': 'RUNNING'}
                        report['cases'].append(case);save(output, report)
                        if cache == 'cold': page.goto(server.url + path, wait_until='commit', timeout=180000)
                        else: page.reload(wait_until='commit', timeout=180000)
                        deadline = time.monotonic() + 300
                        while time.monotonic() < deadline:
                            heap = cdp.send('Runtime.getHeapUsage');state = page.evaluate(PROBE)
                            case['samples'].append({'atMs': page.evaluate('performance.now()'), 'heap': heap,
                                                    'rendererTrackedBytes': (state['trackedMemory'] or {}).get('total')})
                            if state['error']: raise RuntimeError(state['error'])
                            if state['ready']: break
                            page.wait_for_timeout(250)
                        else: raise TimeoutError('No usable scene in five minutes')
                        case['readyMs'] = page.evaluate('performance.now()');case['backend'] = state['backend']
                        case['trackedMemoryAtReady'] = state['trackedMemory'];case['rendererTimings'] = state['rendererTimings']
                        assert state['canvas'] == [720, 390], state['canvas']
                        case['resources'] = [row for frame in page.frames for row in frame.evaluate(RESOURCES)]
                        case['resourceEncodedBytes'] = sum(row['encodedBytes'] for row in case['resources'])
                        case['resourceTransferBytes'] = sum(row['transferBytes'] for row in case['resources'])
                        case['heapPeakSampled'] = {key: max((s['heap'].get(key, 0) for s in case['samples']), default=0)
                                                  for key in ['usedSize', 'totalSize', 'embedderHeapUsedSize', 'backingStorageSize']}
                        case['rendererPeakSampledBytes'] = max((s['rendererTrackedBytes'] or 0 for s in case['samples']), default=0) or None
                        case['errors'] = list(errors);assert not errors, errors;case['status'] = 'PASS'
                        save(output, report);print(json.dumps({k:case[k] for k in ['variant','round','cache','readyMs','resourceEncodedBytes','heapPeakSampled']}), flush=True)
                    cdp.detach();context.close();browser.close()
        report['medians'] = [{ 'variant': label, 'cache': cache, 'readyMs': statistics.median(c['readyMs'] for c in report['cases'] if c['variant']==label and c['cache']==cache),
            'resourceEncodedBytes': statistics.median(c['resourceEncodedBytes'] for c in report['cases'] if c['variant']==label and c['cache']==cache)}
            for label, _ in variants for cache in ['cold','reload']]
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL';report['failure'] = repr(error);raise
    finally:
        report['serverResponses'] = server.records;server.close();save(output, report)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP / 'evidencias/rede-memoria-gzip')
    parser.add_argument('--rodadas', type=int, default=3);parser.add_argument('--mbps', type=float, default=6)
    parser.add_argument('--latencia', type=float, default=80);parser.add_argument('--sem-gzip', action='store_true')
    args = parser.parse_args()
    if args.rodadas < 1 or args.mbps <= 0 or args.latencia < 0: parser.error('Use rodadas/mbps positivos e latência não negativa.')
    main(args.saida, args.rodadas, args.mbps, args.latencia, not args.sem_gzip)
