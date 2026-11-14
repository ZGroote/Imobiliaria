"""Cedros v5 com rede de celular emulada: quando a pagina abre e quando cada nivel da cama chega.
   python medir_cama.py [perfis] [rodadas]
Reusa o medir_rede.py do estudo de 04/10 (mesma instrumentacao, mesmos perfis, servidor que entrega
brotli como o Hosting) e acrescenta o perfil 3G do WebPageTest (1,6 Mbps, 300 ms)."""
import json, statistics, sys, time
from pathlib import Path
import brotli
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ / 'experimentos/qualidade-progressiva-cedros'))
import medir_rede as MR                                     # noqa: E402

import os
NOME = os.environ.get('SITE', 'site')            # site (v4 + cama) | site-leve (LEVE + cama)
SITE = RAIZ / os.environ.get('VERSAO', 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v5') / NOME
CACHE = AQUI / ('_cache_br_' + os.environ.get('VERSAO', 'v5').split('/')[-1] + '_' + NOME)
PERFIS = {**MR.PERFIS, '3g': (300, 1.6e6 / 8, 768e3 / 8, 1)}
ORDEM = sys.argv[1].split(',') if len(sys.argv) > 1 else ['4g-bom', '4g-fraco', '3g', 'celular-lighthouse']
RODADAS = int(sys.argv[2]) if len(sys.argv) > 2 else 1

for f in SITE.rglob('*'):
    if f.is_file():
        d = CACHE / (f.relative_to(SITE).as_posix() + '.br')
        if not d.exists() or d.stat().st_mtime < f.stat().st_mtime:
            d.parent.mkdir(parents=True, exist_ok=True)
            d.write_bytes(brotli.compress(f.read_bytes(), quality=11))
faltou = []
srv = MR.servidor(CACHE, faltou)
URL = f'http://127.0.0.1:{srv.server_port}/maquete-monte-dos-cedros-37.html?cama=q3'


def roda(pw, perfil):
    lat, desce, sobe, cpu = PERFIS[perfil]
    nav = pw.chromium.launch(channel='chrome', headless=True)
    try:
        ctx = nav.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
        pg = ctx.new_page()
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)[:200]))
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Network.enable')
        cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})
        if desce:
            cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': lat, 'downloadThroughput': desce, 'uploadThroughput': sobe})
        if cpu > 1:
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        pg.add_init_script(MR.INSTR)
        pg.goto(URL, wait_until='commit', timeout=0)
        t0 = time.time()
        while not pg.evaluate("() => !!(window.__m && __m.t.quadro1)"):
            time.sleep(0.05)
        # o visitante entra na visita assim que a pagina abre (o pior caso pra cama: disputa tudo)
        pg.evaluate("() => { __m.marca('clique'); const b = document.querySelector('#modos button[data-modo=visita]'); b && b.click(); }")
        while time.time() - t0 < 240:
            c = pg.evaluate("() => window.__camaAssada && __camaAssada.snapshot()")
            if c and (c['nivel'] == 'q3' or c['erro']):
                break
            time.sleep(0.2)
        time.sleep(0.5)
        d = pg.evaluate("""() => ({m: __m.t, cama: __camaAssada.snapshot(),
          nav: performance.getEntriesByType('navigation')[0].transferSize,
          res: performance.getEntriesByType('resource').map(e => ({u: e.name.split('/').slice(-2).join('/'), fim: e.responseEnd, rede: e.transferSize}))})""")
        d['erros'] = erros
        return d
    finally:
        nav.close()


out = {}
with sync_playwright() as pw:
    for p in ORDEM:
        rs = []
        for _ in range(RODADAS):
            d = roda(pw, p)
            c = d['cama']
            pbr = [r for r in d['res'] if r['u'].endswith('.webp') and not r['u'].startswith('cama/')]
            cam = [r for r in d['res'] if r['u'].startswith('cama/')]
            rs.append({'quadro1': d['m']['quadro1'] / 1000,
                       **{k: (c['t0'] + v) / 1000 for k, v in c['t'].items()},
                       'pbr_fim': max((r['fim'] for r in pbr), default=0) / 1000,
                       'kb_pagina': (d['nav'] + sum(r['rede'] for r in d['res'] if not r['u'].startswith('cama/'))) / 1024,
                       'kb_cama': sum(r['rede'] for r in cam) / 1024, 'erro': c['erro'], 'erros': d['erros']})
        med = {k: round(statistics.median(r[k] for r in rs), 2) for k in rs[0] if isinstance(rs[0][k], (int, float))}
        out[p] = {'mediana': med, 'rodadas': rs}
        print(p, json.dumps(med), rs[0]['erro'] or '', rs[0]['erros'][:2] or '', flush=True)
srv.shutdown()
arq = AQUI / f"medicao-cama-rede-{os.environ.get('VERSAO', 'v5').split('/')[-1]}-{NOME}.json"
velho = json.loads(arq.read_text(encoding='utf-8')) if arq.exists() else {'perfis': {}, 'res': {}}
velho['perfis'].update({p: PERFIS[p] for p in ORDEM}); velho['res'].update(out); velho['faltou'] = faltou
arq.write_text(json.dumps(velho, indent=1), encoding='utf-8')       # acumula perfis entre rodadas
print('404:', faltou[:5])
