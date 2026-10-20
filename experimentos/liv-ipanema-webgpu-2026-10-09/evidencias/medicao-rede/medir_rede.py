"""Abertura fria da base e da evolução sob rede móvel emulada (CDP), com servidor comprimindo."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8791/experimentos/liv-ipanema-webgpu-2026-10-09/'
OUT = Path(sys.argv[1])
RODADAS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
# Presets do DevTools/Lighthouse: kbps -> bytes/s; latency = RTT em ms.
PERFIS = {
    'fast4g': {'latency': 60, 'downloadThroughput': 9000 * 125, 'uploadThroughput': 1500 * 125},
    'slow4g': {'latency': 150, 'downloadThroughput': 1600 * 125, 'uploadThroughput': 750 * 125},
}
VARIANTES = [('base', 'site-baseline/maquete-liv-ipanema.html', 'window.__maq&&window.__livLightmap?.ready'),
             ('webgl', 'maquete-liv-ipanema.html?backend=webgl', 'window.__livViewer?.ready'),
             ('webgpu', 'maquete-liv-ipanema.html?backend=webgpu', 'window.__livViewer?.ready')]
BYTES = """()=>{const f=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')]
 .filter(r=>r.initiatorType!=='iframe');return f.reduce((n,r)=>n+r.transferSize,0)}"""

rows = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    for perfil, cond in PERFIS.items():
        for nome, path, pronto in VARIANTES:
            for n in range(RODADAS):
                ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
                page = ctx.new_page()
                cdp = ctx.new_cdp_session(page)
                cdp.send('Network.enable')
                cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
                cdp.send('Network.emulateNetworkConditions', {'offline': False, **cond})
                erros = []
                page.on('pageerror', lambda e: erros.append(str(e)))
                page.goto(URL + path, wait_until='commit', timeout=600000)
                page.wait_for_function(pronto, timeout=600000, polling=250)
                pronto_ms = page.evaluate('performance.now()')
                transfer = sum(f.evaluate(BYTES) for f in page.frames)
                row = {'perfil': perfil, 'variante': nome, 'rodada': n + 1, 'prontoMs': round(pronto_ms),
                       'transferBytes': transfer, 'erros': erros}
                rows.append(row)
                print(json.dumps(row), flush=True)
                ctx.close()
    browser.close()
OUT.write_text(json.dumps({'servidor': 'gzip 6 em texto; .gz/.png crus', 'perfis': PERFIS, 'rodadas': rows},
                          ensure_ascii=False, indent=2), encoding='utf-8')
