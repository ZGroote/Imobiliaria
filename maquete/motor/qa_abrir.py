"""MG-2: abre o pacote de teste no motor, no WebGPU e no WebGL2, e confere que um recurso trocado é recusado.

    npm ci --prefix maquete/motor
    python maquete/motor/qa_abrir.py [--saida PASTA]

Precisa do Chrome instalado e de uma placa de vídeo (o WebGPU não roda sem ela); por isso fica fora do
CI, que roda os testes de Node do motor. Serve a raiz do repositório por HTTP, abre
maquete/motor/prova-rgbm.html e espera a maquete ficar pronta. Para a recusa, o servidor troca um byte
da luz pré-calculada servida.
"""
import argparse
import http.server
import json
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PAGINA = 'maquete/motor/prova-rgbm.html'
ESTRAGAR = {'ligado': False}


class Servidor(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(RAIZ), **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        caminho = self.path.split('?')[0]
        if ESTRAGAR['ligado'] and caminho.endswith('/dados/exterior/irradiance.rgbm.gz'):
            dado = bytearray((RAIZ / caminho.lstrip('/')).read_bytes())
            dado[-9] ^= 0xff                                   # um byte do meio do gzip, mesmo tamanho
            self.send_response(200)
            self.send_header('Content-Type', 'application/gzip')
            self.send_header('Content-Length', str(len(dado)))
            self.end_headers()
            self.wfile.write(bytes(dado))
            return
        super().do_GET()


def abrir(nav, porta, backend, saida, estragar):
    ESTRAGAR['ligado'] = estragar
    page = nav.new_page(viewport={'width': 1280, 'height': 800})
    erros = []
    page.on('pageerror', lambda e: erros.append(str(e)))
    page.goto(f'http://127.0.0.1:{porta}/{PAGINA}?backend={backend}', wait_until='load', timeout=120000)
    page.wait_for_function('()=>__livProva.ready||__livProva.error', timeout=120000)
    estado = page.evaluate('()=>({ready:__livProva.ready,error:__livProva.error,backend:__livProva.backend,'
                           'malhas:__livProva.meshes?.length??0,unidades:__livProva.units?.units?.length??0,'
                           'vistas:[...document.querySelectorAll("[data-view]")].map(b=>b.dataset.view)})')
    if estado['ready']:
        page.wait_for_timeout(1500)
        page.screenshot(path=str(saida / f'{backend}.png'))
    page.close()
    return {**estado, 'erros': erros}


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--saida', type=Path, default=Path(tempfile.gettempdir()) / 'maquete-motor-qa')
    a = p.parse_args()
    a.saida.mkdir(parents=True, exist_ok=True)
    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Servidor)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    porta = servidor.server_address[1]
    resultado = {}
    try:
        with sync_playwright() as pw:
            nav = pw.chromium.launch(executable_path=CHROME, headless=True,
                                     args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'])
            for backend in ('webgpu', 'webgl'):
                resultado[backend] = abrir(nav, porta, backend, a.saida, False)
            resultado['estragado'] = abrir(nav, porta, 'webgl', a.saida, True)
            nav.close()
    finally:
        servidor.shutdown()
    print(json.dumps(resultado, ensure_ascii=False, indent=1))
    ok = all(resultado[b]['ready'] and resultado[b]['backend'] == b and resultado[b]['malhas'] == 3
             and resultado[b]['unidades'] == 2 and not resultado[b]['erros'] for b in ('webgpu', 'webgl'))
    recusou = not resultado['estragado']['ready'] and 'Identidade do recurso irradiance.rgbm.gz' in str(resultado['estragado']['error'])
    print('abre nos dois:', ok, '| recusa o recurso trocado:', recusou)
    raise SystemExit(0 if ok and recusou else 1)


if __name__ == '__main__':
    main()
