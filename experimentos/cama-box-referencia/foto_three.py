"""Print da cama assada no navegador (o mesmo three do app), sem abrir janela.

    python foto_three.py saida.png "k=2.2&f=0.6"     # parametros da pagina na URL

Sobe um servidor estatico na raiz do repo (textura por file:// e barrada no WebGL)."""
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, "..", ".."))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "three.png")
q = sys.argv[2] if len(sys.argv) > 2 else ""


class Quieto(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0),
                                      functools.partial(Quieto, directory=RAIZ))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = "http://127.0.0.1:%d/experimentos/cama-box-referencia/cama_three.html?%s" % (
    srv.server_address[1], q)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, headless=True,
                           args=["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
    p = b.new_page(viewport={"width": 1210, "height": 1190})
    erros = []
    p.on("pageerror", lambda e: erros.append(str(e)))
    p.goto(url)
    p.wait_for_function("window.PRONTO === true", timeout=180000)
    info = p.evaluate("window.ERRO || window.INFO")
    p.locator("canvas").screenshot(path=saida)
    b.close()
srv.shutdown()
print(json.dumps({"saida": os.path.basename(saida), "info": info, "erros": erros}))
