"""Quarto da Cedros v5 em cada nivel da cama (q0 = cama do catalogo .. q4), mesma camera.
   python fotos_cama.py [niveis]     -> fotos/quarto-qN.png + fotos/niveis-quarto.png"""
import functools, json, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
import os
PAG = os.environ.get('PAG', 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v5/site') + '/maquete-monte-dos-cedros-37.html'
VISTAS = {'quarto': (2.4, -1.8, -2.58, -0.2),           # a mesma do fotos.py do Cedros PBR
          'perto': (2.98, -0.87, -2.58, -0.45)}         # 1,1 m a frente na mesma direcao, olhando mais pra baixo
NIV = sys.argv[1].split(',') if len(sys.argv) > 1 else ['q0', 'q1', 'q2', 'q3', 'q4']
EXTRA = sys.argv[2] if len(sys.argv) > 2 else ''
TAG = sys.argv[3] if len(sys.argv) > 3 else ''
OUT = AQUI / 'fotos'
OUT.mkdir(exist_ok=True)
INIT = """(() => { let LB; Object.defineProperty(window, 'LightBake', {configurable: true, get: () => LB,
  set: v => { LB = Object.freeze({...v, create: (...a) => (window.__m_bk = v.create(...a))}); }}); })();"""
PRONTO = """() => { const s = window.__pilotoVisual && __pilotoVisual.snapshot(), c = window.__camaAssada && __camaAssada.snapshot();
  return {modo: __maq.modo(), bake: !!(window.__m_bk && __m_bk.BAKE && __m_bk.BAKE.fila), pbr: s ? (s.installed || !s.enabled) : true, cama: c}; }"""


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=str(RAIZ)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
rel = {}
with sync_playwright() as pw:
    for q in NIV:
        nav = pw.chromium.launch(channel='chrome', headless=True)
        pg = nav.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=2)
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)[:300]))
        pg.on('console', lambda m: m.type == 'error' and erros.append(m.text[:300]))
        pg.add_init_script(INIT)
        pg.goto(f'http://127.0.0.1:{srv.server_port}/{PAG}?cama={q}{EXTRA}')
        pg.wait_for_function('window.__maq && __maq.ren.info.render.frame > 2')
        pg.evaluate("document.querySelector('#modos button[data-modo=visita]').click()")
        t0 = time.time()
        while True:
            e = pg.evaluate(PRONTO)
            ok_cama = q == 'q0' or (e['cama'] and (e['cama']['nivel'] == q or e['cama']['erro']))
            if e['modo'] == 'visita' and not e['bake'] and e['pbr'] and ok_cama:
                break
            if time.time() - t0 > 120:
                raise TimeoutError(e)
            time.sleep(0.25)
        time.sleep(1)
        for v, (x, z, yaw, pitch) in VISTAS.items():
            pg.evaluate(f'() => {{ const F = __maq.FP; F.x = {x}; F.z = {z}; F.yaw = {yaw}; F.pitch = {pitch}; }}')
            time.sleep(1.2)
            pg.locator('#c').screenshot(path=str(OUT / f'{v}-{q}{TAG}.png'))
        rel[q] = {'erros': erros, 'cama': e['cama'], 'render': pg.evaluate('() => __maq.ren.info.render')}
        print(q, json.dumps({'erros': erros, 'cama': e['cama'], 'calls': rel[q]['render']['calls'], 'tri': rel[q]['render']['triangles']}), flush=True)
        nav.close()
srv.shutdown()
for v in VISTAS:
    ims = [Image.open(OUT / f'{v}-{q}{TAG}.png').convert('RGB') for q in NIV]
    w, h = 640, 360
    folha = Image.new('RGB', (w * len(ims), h + 22), 'white')
    d = ImageDraw.Draw(folha)
    for i, (q, im) in enumerate(zip(NIV, ims)):
        folha.paste(im.resize((w, h), Image.LANCZOS), (w * i, 22)); d.text((w * i + 6, 5), q, fill='black')
    folha.save(OUT / f'niveis-{v}{TAG}.png')
(OUT / 'fotos.json').write_text(json.dumps(rel, indent=1), encoding='utf-8')
