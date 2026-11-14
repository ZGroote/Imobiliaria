"""Fotos do Cedros LEVE x PREMIUM x PBR na mesma camera, no Chrome headless com a GPU real.

    python experimentos/cedros-pbr-2026-10-04/fotos.py [--saida PASTA] [--so pbr,leve]

Serve a raiz do repositorio, entra na Visita 3D, espera o bake por vertice, o atlas do PREMIUM e a
instalacao dos acabamentos do PBR, e fotografa as mesmas posicoes FP em cada variante. Grava tambem
uma folha comparativa por vista (fotos-<vista>.png).
"""
import argparse, functools, json, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
PAGINA = 'maquete-monte-dos-cedros-37.html'
VARIANTES = {
    'leve': 'v1.5/miniaturas/publicado/' + PAGINA,
    'premium': 'v1.5/miniaturas/publicado-atual/' + PAGINA,
    'pbr': 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v4/site/' + PAGINA,
}
# x, z, yaw, pitch da camera da visita (referencial do predio; a unidade vai de x=-5,5 a 5,5)
VISTAS = {
    'sala': (-2.3, -1.6, 2.24, -0.15),
    'sala-tv': (-4.3, -1.5, -2.36, -0.15),
    'cozinha': (-1.6, -0.6, -1.5708, -0.2),
    'quarto': (2.4, -1.8, -2.58, -0.2),
    'banho': (1.25, -0.85, 3.1416, -0.45),
    'servico': (-0.6, 0.2, 3.1416, -0.35),
}
PRONTO = """() => { const s = window.__pilotoVisual && __pilotoVisual.snapshot();
  return {modo: __maq.modo(), bake: !!(window.__m_bk && __m_bk.BAKE && __m_bk.BAKE.fila),
    luz: window.__bakeV3 ? !!(__bakeV3.ready || __bakeV3.error) : true, pbr: s ? (s.installed || !s.enabled) : true}; }"""
# Captura o BK (bake por vertice) como medir_rede.py: as duas variantes publicam LightBake em globalThis.
INIT = """(() => { let LB; Object.defineProperty(window, 'LightBake', {configurable: true, get: () => LB,
  set: v => { LB = Object.freeze({...v, create: (...a) => (window.__m_bk = v.create(...a))}); }}); })();"""


def servidor():
    class H(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    s = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=str(RAIZ)))
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def espera(pg, cond, limite=120):
    t0 = time.time()
    while time.time() - t0 < limite:
        e = pg.evaluate(PRONTO)
        if cond(e):
            return e
        time.sleep(0.25)
    raise TimeoutError(e)


def fotografa(pw, url, saida, nome):
    nav = pw.chromium.launch(channel='chrome', headless=True)
    try:
        pg = nav.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=2)
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)[:300]))
        pg.on('console', lambda m: m.type == 'error' and erros.append(m.text[:300]))
        pg.add_init_script(INIT)
        pg.goto(url)
        pg.wait_for_function('window.__maq && __maq.ren.info.render.frame > 2')
        pg.evaluate("document.querySelector('#modos button[data-modo=visita]').click()")
        espera(pg, lambda e: e['modo'] == 'visita' and not e['bake'] and e['luz'] and e['pbr'])
        time.sleep(1)
        for vista, (x, z, yaw, pitch) in VISTAS.items():
            pg.evaluate(f'() => {{ const F = __maq.FP; F.x = {x}; F.z = {z}; F.yaw = {yaw}; F.pitch = {pitch}; }}')
            time.sleep(1.2)
            pg.locator('#c').screenshot(path=str(saida / f'{nome}-{vista}.png'))
        pg.evaluate("document.querySelector('#modos button[data-modo=planta3d]').click()")
        time.sleep(3)
        pg.locator('#c').screenshot(path=str(saida / f'{nome}-planta3d.png'))
        info = pg.evaluate('() => ({render: __maq.ren.info.render, memoria: __maq.ren.info.memory,'
                           ' pbr: window.__pilotoVisual ? __pilotoVisual.snapshot() : null})')
        return {'erros': erros, **info}
    finally:
        nav.close()


def folha(saida, nomes):
    for vista in [*VISTAS, 'planta3d']:
        ims = [Image.open(saida / f'{n}-{vista}.png').convert('RGB').resize((720, 360)) for n in nomes]
        w = Image.new('RGB', (720 * len(ims), 384), 'white')
        d = ImageDraw.Draw(w)
        for i, (n, im) in enumerate(zip(nomes, ims)):
            w.paste(im, (720 * i, 24))
            d.text((720 * i + 8, 6), n.upper(), fill='black')
        w.save(saida / f'fotos-{vista}.png')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--saida', default=str(RAIZ / 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v4/evidencias'))
    ap.add_argument('--so', default=','.join(VARIANTES))
    ap.add_argument('--variante', action='append', default=[], help='nome=caminho/da/pagina.html, relativo a raiz')
    a = ap.parse_args()
    VARIANTES.update(v.split('=', 1) for v in a.variante)
    saida = Path(a.saida)
    saida.mkdir(parents=True, exist_ok=True)
    nomes = a.so.split(',')
    srv = servidor()
    base = f'http://127.0.0.1:{srv.server_port}/'
    rel = {}
    with sync_playwright() as pw:
        for n in nomes:
            rel[n] = fotografa(pw, base + VARIANTES[n.split('?')[0]] + ('?' + n.split('?')[1] if '?' in n else ''), saida, n.replace('?', '-').replace('=', '-'))
            print(n, json.dumps({'erros': rel[n]['erros'], 'calls': rel[n]['render']['calls'], 'tri': rel[n]['render']['triangles'],
                                 'tex': rel[n]['memoria']['textures']}), flush=True)
    srv.shutdown()
    folha(saida, [n.replace('?', '-').replace('=', '-') for n in nomes])
    (saida / 'fotos.json').write_text(json.dumps(rel, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
