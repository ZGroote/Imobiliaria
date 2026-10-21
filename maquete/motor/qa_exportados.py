"""MG-4: a maquete de hoje exportada pelo pipeline/maquete_dados.py, aberta no motor, lado a lado com ela.

    npm ci --prefix maquete/motor
    python maquete/motor/qa_exportados.py [--saida PASTA]

Precisa do Chrome e de uma placa de vídeo, como o qa_abrir.py. Para cada imóvel (LEVE e PREMIUM):
  - exporta duas vezes e confere que os bytes são os mesmos;
  - anota o tempo, a memória e o tamanho do pacote;
  - abre a página de hoje e o motor com o pacote no WebGPU e no WebGL2, e grava um print lado a lado.
"""
import argparse
import http.server
import json
import sys
import tempfile
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

from qa_abrir import CHROME, RAIZ, Servidor

sys.path.insert(0, str(RAIZ))
from pipeline import maquete_dados  # noqa: E402

CASOS = [('monte-das-colinas-39', 'leve'), ('monte-dos-cedros-37', 'leve'), ('monte-dos-cedros-37', 'premium')]
PACOTE = {'pasta': None}


class ServidorDoPacote(Servidor):
    def translate_path(self, path):
        if path.startswith('/maquete/motor/dados/') and PACOTE['pasta']:
            return str(PACOTE['pasta'] / path.split('?')[0][len('/maquete/motor/dados/'):])
        return super().translate_path(path)


def memoria_do_python():
    try:
        import psutil
        info = psutil.Process().memory_info()
        return round(getattr(info, 'peak_wset', info.rss) / 2**20)
    except ImportError:
        return None


def foto_de_hoje(nav, imovel, modo, arquivo):
    with tempfile.TemporaryDirectory() as tmp:
        pagina = maquete_dados.montar_pagina(imovel, modo, 'sao-carlos', Path(tmp))
        srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), lambda *a, **k: maquete_dados.Calado(*a, directory=tmp, **k))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        page = nav.new_page(viewport={'width': 1280, 'height': 800})
        page.add_init_script(maquete_dados.RELOGIO_PARADO)        # a vista inicial, sem o giro
        page.goto(f'http://127.0.0.1:{srv.server_address[1]}/maquete.html', wait_until='load', timeout=180000)
        page.wait_for_function('()=>window.__maq', timeout=180000)
        if modo == 'premium':
            page.wait_for_function('()=>window.__exteriorV3?.ready', timeout=300000)
        page.wait_for_timeout(2500)
        page.screenshot(path=str(arquivo))
        page.close()
        srv.shutdown()


def no_motor(nav, porta, backend, arquivo):
    page = nav.new_page(viewport={'width': 1280, 'height': 800})
    erros = []
    page.on('pageerror', lambda e: erros.append(str(e)))
    page.goto(f'http://127.0.0.1:{porta}/maquete/motor/maquete.html?backend={backend}', wait_until='load', timeout=180000)
    page.wait_for_function('()=>__maquete.ready||__maquete.error', timeout=300000)
    estado = page.frames[1].evaluate('''()=>{const p=__livProva;return {ready:p.ready,error:p.error,backend:p.backend,malhas:p.meshes?.length??0,
      atlas:!!p.atlas,bakeados:(p.materials??[]).filter(m=>m.userData.livBakedTransport).length}}''')
    if estado['ready']:
        page.wait_for_timeout(1500)
        page.screenshot(path=str(arquivo))
        # A Planta 2D da planta exportada, desenhada pelo floor-plan.js.
        page.click('[data-modo="planta"]')
        page.wait_for_selector('#planta svg')
        estado['planta'] = page.evaluate('''()=>Object.fromEntries(['comodo','parede','rotulo']
          .map(c=>[c,document.querySelectorAll('#planta .'+c).length]))''')
        page.screenshot(path=str(arquivo).replace('.png', '-planta.png'))
    page.close()
    return {**estado, 'erros': erros}


def lado_a_lado(hoje, motor, arquivo):
    a, b = Image.open(hoje), Image.open(motor)
    junto = Image.new('RGB', (a.width + b.width + 16, max(a.height, b.height)), (40, 44, 48))
    junto.paste(a, (0, 0))
    junto.paste(b, (a.width + 16, 0))
    junto.save(arquivo)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--saida', type=Path, default=Path(tempfile.gettempdir()) / 'maquete-motor-qa' / 'exportados')
    a = p.parse_args()
    a.saida.mkdir(parents=True, exist_ok=True)
    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', 0), ServidorDoPacote)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    porta = servidor.server_address[1]
    r = {}
    # Primeiro exporta (o exportador abre o navegador dele), depois abre a página de hoje e o motor.
    for imovel, modo in CASOS:
        nome = f'{imovel}-{modo}'
        pastas = [a.saida / f'{nome}-1', a.saida / f'{nome}-2']
        exportacoes = [maquete_dados.exportar(imovel, modo, pasta) for pasta in pastas]
        iguais = exportacoes[0]['arquivos'] == exportacoes[1]['arquivos'] and all(
            (pastas[0] / n).read_bytes() == (pastas[1] / n).read_bytes() for n in exportacoes[0]['arquivos'])
        medidas = {k: exportacoes[0][k] for k in ('montar_s', 'extrair_s', 'gravar_s', 'heap_js_mb', 'malhas')}
        medidas['pacote_mb'] = round(sum(f['bytes'] for f in exportacoes[0]['arquivos'].values()) / 2**20, 2)
        medidas['maior_arquivo'] = max(exportacoes[0]['arquivos'].items(), key=lambda kv: kv[1]['bytes'])[0]
        r[nome] = {'mesmos_bytes': iguais, **medidas}
    r['memoria_python_pico_mb'] = memoria_do_python()
    try:
        with sync_playwright() as pw:
            nav = pw.chromium.launch(executable_path=CHROME, headless=True,
                                     args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'])
            for imovel, modo in CASOS:
                nome = f'{imovel}-{modo}'
                pastas = [a.saida / f'{nome}-1']
                foto_de_hoje(nav, imovel, modo, a.saida / f'{nome}-hoje.png')
                PACOTE['pasta'] = pastas[0]
                motor = {b: no_motor(nav, porta, b, a.saida / f'{nome}-motor-{b}.png') for b in ('webgpu', 'webgl')}
                if motor['webgpu']['ready']:
                    lado_a_lado(a.saida / f'{nome}-hoje.png', a.saida / f'{nome}-motor-webgpu.png', a.saida / f'{nome}-lado-a-lado.png')
                r[nome]['motor'] = motor
            nav.close()
    finally:
        servidor.shutdown()
    print(json.dumps(r, ensure_ascii=False, indent=1))
    ok = all(r[f'{i}-{m}']['mesmos_bytes'] and all(
        e['ready'] and e['backend'] == b and e['malhas'] == r[f'{i}-{m}']['malhas'] and not e['erros']
        and e['planta']['comodo'] > 0 and e['planta']['parede'] > 0
        and e['atlas'] == (m == 'premium') and (e['bakeados'] > 0) == (m == 'premium')
        for b, e in r[f'{i}-{m}']['motor'].items()) for i, m in CASOS)
    print('exporta igual e abre no motor:', ok, '| prints em', a.saida)
    raise SystemExit(0 if ok else 1)


if __name__ == '__main__':
    main()
