"""Fotos do movel dentro do Cedros (v7): a camera da visita na frente do movel do TIPO pedido, com e sem
a peca nova (?movelweb=0 = movel do catalogo).
    python foto_cedros.py geladeira [dist_m] [altura_olho_pitch] [extra_query] [tag]
-> fotos/<tipo>-catalogo.png, fotos/<tipo>-novo.png, fotos/<tipo>-lado.png"""
import functools, json, os, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
PAG = os.environ.get('PAG', 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v7/site-leve') + '/maquete-monte-dos-cedros-37.html'
TIPO = sys.argv[1]
DIST = float(sys.argv[2]) if len(sys.argv) > 2 else 1.8
PITCH = float(sys.argv[3]) if len(sys.argv) > 3 else -0.15
EXTRA = sys.argv[4] if len(sys.argv) > 4 else ''
TAG = sys.argv[5] if len(sys.argv) > 5 else ''
OUT = AQUI / 'fotos'
OUT.mkdir(exist_ok=True)
# frente do movel = +Z local (catalogo); a camera fica DIST a frente, olhando pra ele.
# Yaw da visita: olha pra (-sin yaw, -cos yaw) (convencao do three pra rotacao em Y).
MIRA = """([tipo, dist]) => { const h = __maq.planta(); const o = h.children.find(c => c.userData && c.userData.registroMovel
  && c.userData.registroMovel.tipo === tipo); if (!o) return null; o.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  const f = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld); f.y = 0; f.normalize();
  const c = p.clone().addScaledVector(f, dist); const d = p.clone().sub(c);
  return {alvo: [p.x, p.y, p.z], cam: [c.x, c.z], yaw: Math.atan2(-d.x, -d.z), F: {x: __maq.FP.x, z: __maq.FP.z}}; }"""


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=str(RAIZ)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
rel = {}
with sync_playwright() as pw:
    for nome, q in (('catalogo', '?movelweb=0'), ('novo', '?' + EXTRA.lstrip('?&'))):
        nav = pw.chromium.launch(channel='chrome', headless=True)
        pg = nav.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=2)
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)[:300]))
        pg.on('console', lambda m: m.type == 'error' and erros.append(m.text[:300]))
        pg.goto(f'http://127.0.0.1:{srv.server_port}/{PAG}{q}')
        pg.wait_for_function('window.__maq && __maq.ren.info.render.frame > 2', timeout=120000)
        # direto na visita a casa demora a ganhar os moveis no headless; pela Planta 3D sai na hora
        pg.evaluate("document.querySelector('#modos button[data-modo=planta3d]').click()")
        time.sleep(3)
        pg.evaluate("document.querySelector('#modos button[data-modo=visita]').click()")
        t0 = time.time()
        while True:
            s = pg.evaluate('() => ({modo: __maq.modo(), m: window.__movelWeb && __movelWeb.snapshot()})')
            # ESPERA=0: o movel nao vem pelo movel-web (ex.: a cama assada do v8) -- so assenta
            ok = nome == 'catalogo' or os.environ.get('ESPERA') == '0' or (s['m'] and (('instalado_' + TIPO) in s['m']['t'] or s['m']['erro']))
            if s['modo'] == 'visita' and ok and pg.evaluate(MIRA, [TIPO, DIST]):
                break
            if time.time() - t0 > 90:
                raise TimeoutError(s)
            time.sleep(0.3)
        time.sleep(2.5)                       # bake de luz e sonda assentarem
        m = pg.evaluate(MIRA, [TIPO, DIST])
        for vista, dyaw, dist in (('', 0.0, DIST), ('-lado', 0.55, DIST * 0.8)):
            m = pg.evaluate(MIRA, [TIPO, dist])
            pg.evaluate(f'() => {{ const F = __maq.FP; F.x = {m["cam"][0]}; F.z = {m["cam"][1]}; F.yaw = {m["yaw"] + dyaw}; F.pitch = {PITCH}; }}')
            if dyaw:   # gira em volta do movel: reposiciona a camera no arco
                pg.evaluate(f'''() => {{ const F = __maq.FP, a = {m["alvo"]}, r = {dist}, y = F.yaw;
                  F.x = a[0] + Math.sin(y) * r; F.z = a[2] + Math.cos(y) * r; }}''')
            time.sleep(1.2)
            pg.locator('#c').screenshot(path=str(OUT / f'{TIPO}-{nome}{vista}{TAG}.png'))
        rel[nome] = {'mira': m, 'snap': s['m'], 'erros': erros, 'render': pg.evaluate('() => __maq.ren.info.render')}
        print(nome, json.dumps(rel[nome])[:600], flush=True)
        nav.close()
srv.shutdown()
for vista in ('', '-lado'):
    ims = [Image.open(OUT / f'{TIPO}-{n}{vista}{TAG}.png').convert('RGB') for n in ('catalogo', 'novo')]
    w, h = ims[0].size
    folha = Image.new('RGB', (w * 2 + 10, h + 22), 'white')
    d = ImageDraw.Draw(folha)
    for i, (n, im) in enumerate(zip(('movel do catalogo (hoje)', 'peca nova'), ims)):
        folha.paste(im, (i * (w + 10), 22)); d.text((i * (w + 10) + 6, 5), n, fill='black')
    folha.save(OUT / f'{TIPO}-comparacao{vista}{TAG}.png')
