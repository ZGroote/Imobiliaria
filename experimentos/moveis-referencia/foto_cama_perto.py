"""Cama de perto (1 m do pe, olhando pra baixo) em varias paginas/niveis: mesma camera em todas.
    python foto_cama_perto.py tag "pagina|query" ["pagina|query" ...]   -> fotos/cama-perto-<tag>.png"""
import functools, json, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
TAG, CASOS = sys.argv[1], [c.split("|") for c in sys.argv[2:]]
MIRA = """([dist, lado]) => { const h = __maq.planta(); const o = h.children.find(c => c.userData && c.userData.registroMovel
  && c.userData.registroMovel.tipo === 'cama'); if (!o) return null; o.updateWorldMatrix(true, false);
  const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
  const f = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld); f.y = 0; f.normalize();
  const s = new THREE.Vector3(1, 0, 0).transformDirection(o.matrixWorld); s.y = 0; s.normalize();
  const c = p.clone().addScaledVector(f, dist).addScaledVector(s, lado); const d = p.clone().sub(c);
  return {cam: [c.x, c.z], yaw: Math.atan2(-d.x, -d.z)}; }"""


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=str(RAIZ)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
fotos = []
with sync_playwright() as pw:
    for i, (pag, q) in enumerate(CASOS):
        nav = pw.chromium.launch(channel='chrome', headless=True)
        pg = nav.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=2)
        erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{srv.server_port}/{pag}/maquete-monte-dos-cedros-37.html?{q}')
        pg.wait_for_function('window.__maq && __maq.ren.info.render.frame > 2', timeout=120000)
        pg.evaluate("document.querySelector('#modos button[data-modo=planta3d]').click()")
        time.sleep(3)
        pg.evaluate("document.querySelector('#modos button[data-modo=visita]').click()")
        t0 = time.time()
        while time.time() - t0 < 90:
            c = pg.evaluate("() => window.__camaAssada && __camaAssada.snapshot()")
            if c and c['instalado'] and (c['t'].get('detalhe') or c['nivel'] in ('q3', 'q4') or c['erro']) and pg.evaluate(MIRA, [1.0, 0.0]):
                break
            time.sleep(0.3)
        time.sleep(2.5)
        m = pg.evaluate(MIRA, [1.0, 0.25])
        pg.evaluate(f'() => {{ const F = __maq.FP; F.x = {m["cam"][0]}; F.z = {m["cam"][1]}; F.yaw = {m["yaw"]}; F.pitch = -0.55; }}')
        time.sleep(1.5)
        arq = AQUI / 'fotos' / f'cama-perto-{TAG}-{i}.png'
        arq.parent.mkdir(exist_ok=True)
        pg.locator('#c').screenshot(path=str(arq))
        fotos.append((f'{Path(pag).parent.name} ?{q}', arq))
        print(i, pag, q, json.dumps(c)[:300], erros[:2], flush=True)
        nav.close()
srv.shutdown()
ims = [(t, Image.open(a).convert('RGB')) for t, a in fotos]
w, h = ims[0][1].size
out = Image.new('RGB', (w, (h + 20) * len(ims)), 'white')
d = ImageDraw.Draw(out)
for i, (t, im) in enumerate(ims):
    out.paste(im, (0, i * (h + 20) + 20)); d.text((4, i * (h + 20) + 4), t, fill='black')
out.save(AQUI / 'fotos' / f'cama-perto-{TAG}.png')
