"""Print da peca no navegador (ver.html, o three do app) sem janela.
    python foto_web.py peca saida.png "modo=B&tom=none"
Servidor estatico na raiz do repo (textura por file:// e barrada no WebGL)."""
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, "..", ".."))
peca, saida = sys.argv[1], sys.argv[2]
q = sys.argv[3] if len(sys.argv) > 3 else ""
C = json.load(open(os.path.join(AQUI, "web", peca, "peca.json")))["camera"]   # peca = pasta em web/
W, H = C["res"][0] * 2, C["res"][1] * 2


class Quieto(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quieto, directory=RAIZ))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/experimentos/moveis-referencia/ver.html?peca=%s&%s" % (srv.server_address[1], peca, q)
with sync_playwright() as pw:
    b = pw.chromium.launch(channel="chrome", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist"])
    p = b.new_page(viewport={"width": W, "height": H})
    erros = []
    p.on("pageerror", lambda e: erros.append(str(e)))
    p.on("console", lambda m: m.type == "error" and erros.append(m.text[:200]))
    p.goto(url)
    p.wait_for_function("window.PRONTO === true", timeout=180000)
    info = p.evaluate("window.ERRO || window.INFO")
    p.locator("canvas").screenshot(path=saida)
    b.close()
srv.shutdown()
print(json.dumps({"saida": os.path.basename(saida), "info": info, "erros": erros}))
