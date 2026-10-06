"""Cedros v7 (v6 + moveis novos) com rede de celular emulada: quando a pagina abre, quando a cama chega
no q3 e quando cada movel novo fica pronto/instalado; KB de pagina, cama e moveis.
    python medir_cedros.py [perfis] [rodadas]
Reusa o medir_rede.py do estudo de 04/10 (instrumentacao, perfis, servidor que entrega brotli como o
Hosting) e o perfil 3G do WebPageTest, como o medir_cama.py."""
import json, os, statistics, sys, time
from pathlib import Path
import brotli
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
sys.path.insert(0, str(RAIZ / 'experimentos/qualidade-progressiva-cedros'))
import medir_rede as MR                                     # noqa: E402

SITE = RAIZ / os.environ.get('SITE', 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v7/site-leve')
CACHE = AQUI / ('_cache_br_' + SITE.parent.name + '_' + SITE.name)
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
TIPOS = [p['tipo'] for p in json.loads((SITE / 'manifesto.json').read_text())['pecas']]


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
        # o visitante entra na visita assim que a pagina abre (o pior caso: tudo disputa a rede)
        pg.evaluate("() => { __m.marca('clique'); const b = document.querySelector('#modos button[data-modo=visita]'); b && b.click(); }")
        while time.time() - t0 < 300:
            c = pg.evaluate("() => window.__camaAssada && __camaAssada.snapshot()")
            m = pg.evaluate("() => window.__movelWeb && __movelWeb.snapshot()")
            cama_ok = c and (c['nivel'] == 'q3' or c['erro'])
            mov_ok = m and (m['erro'] or all(('instalado_' + t) in m['t'] for t in TIPOS))
            if cama_ok and mov_ok:
                break
            time.sleep(0.2)
        time.sleep(0.5)
        d = pg.evaluate("""() => ({m: __m.t, cama: __camaAssada.snapshot(), mov: __movelWeb.snapshot(),
          nav: performance.getEntriesByType('navigation')[0].transferSize,
          res: performance.getEntriesByType('resource').map(e => ({u: e.name.split('/').slice(-3).join('/'), fim: e.responseEnd, rede: e.transferSize}))})""")
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
            c, mv = d['cama'], d['mov']
            cam = [r for r in d['res'] if '/cama/' in '/' + r['u']]
            mov = [r for r in d['res'] if 'moveis/' in r['u'] or r['u'].endswith('movel-web.js')]
            rs.append({'quadro1': d['m']['quadro1'] / 1000,
                       'cama_q3': (c['t0'] + c['t'].get('q3', 0)) / 1000,
                       **{k: (mv['t0'] + v) / 1000 for k, v in mv['t'].items() if k.startswith(('pedido', 'pronto_', 'instalado_'))},
                       'kb_pagina': (d['nav'] + sum(r['rede'] for r in d['res'] if r not in cam and r not in mov)) / 1024,
                       'kb_cama': sum(r['rede'] for r in cam) / 1024, 'kb_moveis': sum(r['rede'] for r in mov) / 1024,
                       'erro': c['erro'] or mv['erro'], 'erros': d['erros']})
        med = {k: round(statistics.median(r[k] for r in rs), 2) for k in rs[0] if isinstance(rs[0][k], (int, float))}
        out[p] = {'mediana': med, 'rodadas': rs}
        print(p, json.dumps(med), rs[0]['erro'] or '', rs[0]['erros'][:2] or '', flush=True)
srv.shutdown()
arq = AQUI / f'medicao-rede-{SITE.parent.name}-{SITE.name}.json'
velho = json.loads(arq.read_text(encoding='utf-8')) if arq.exists() else {'perfis': {}, 'res': {}}
velho['perfis'].update({p: PERFIS[p] for p in ORDEM}); velho['res'].update(out); velho['faltou'] = faltou
arq.write_text(json.dumps(velho, indent=1), encoding='utf-8')
print('404:', faltou[:5])
