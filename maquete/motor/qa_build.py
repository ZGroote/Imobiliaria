"""MG-5: um build novo (schema 2) do canal ao ar, e o anterior antigo (schema 1) de volta, tudo local.

    npm ci --prefix maquete/motor
    python maquete/motor/qa_build.py [--imovel monte-das-colinas-39] [--saida PASTA]

Precisa do Chrome e de uma placa de vídeo, como o qa_abrir.py. Numa pasta temporária:
  1. monta o build antigo (--formato 1) e o novo (--formato 2) do imóvel; monta o novo de novo e
     confere que sai o mesmo build (o portão do robô: duas montagens, o mesmo build);
  2. põe o antigo no ar; monta o canal (preview) com o novo e abre a maquete dele, servida só
     daquela pasta;
  3. promove o novo e abre /maquete/<imóvel> no site: o ponteiro leva ao motor;
  4. reverte e abre de novo: volta a página antiga.
O servidor faz o que o firebase.imoveis.json faz com os ponteiros: serve imovel/* e maquete/* como HTML.
"""
import argparse
import contextlib
import hashlib
import http.server
import json
import sys
import tempfile
import threading
import time
from functools import partial
from pathlib import Path

from playwright.sync_api import sync_playwright

from qa_abrir import CHROME, RAIZ

sys.path.insert(0, str(RAIZ))
from pipeline import build_imovel, publicar_imovel  # noqa: E402


class Hosting(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def guess_type(self, path):
        partes = Path(self.translate_path(self.path.split('?')[0])).relative_to(self.directory).parts
        if partes and partes[0] in ('imovel', 'maquete'):
            return 'text/html; charset=utf-8'
        return super().guess_type(path)


def servir(pasta):
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(Hosting, directory=str(pasta)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def abrir(nav, url, arquivo):
    """O que a página aberta é: o motor (pronto, com ficha) ou a página antiga (window.__maq)."""
    page = nav.new_page(viewport={'width': 1280, 'height': 800})
    erros = []
    page.on('pageerror', lambda e: erros.append(str(e)))
    page.goto(url, wait_until='load', timeout=180000)
    page.wait_for_function('()=>window.__maquete?.ready||window.__maquete?.error||window.__maq', timeout=180000)
    page.wait_for_timeout(1500)
    r = page.evaluate('''()=>({url:location.pathname,motor:!!window.__maquete,pronto:window.__maquete?.ready??null,
      erro:window.__maquete?.error??null,antiga:!!window.__maq,titulo:document.getElementById('fTitulo')?.textContent??null})''')
    if r['motor'] and r['pronto']:
        r['malhas'] = page.frames[1].evaluate('()=>__livProva.meshes.length')
    page.screenshot(path=str(arquivo))
    page.close()
    return {**r, 'erros': erros}


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--imovel', default='monte-das-colinas-39')
    p.add_argument('--saida', type=Path, default=Path(tempfile.gettempdir()) / 'maquete-motor-qa' / 'build')
    a = p.parse_args()
    a.saida.mkdir(parents=True, exist_ok=True)
    uid, r = a.imovel, {}
    with tempfile.TemporaryDirectory(prefix='qa-build-') as tmp:
        tmp = Path(tmp)
        builds = tmp / 'builds'
        with contextlib.redirect_stdout(sys.stderr):
            t = time.perf_counter()
            antigo = build_imovel.construir(uid, builds=builds, formato=1)
            r['antigo_s'] = round(time.perf_counter() - t, 1)
            t = time.perf_counter()
            novo = build_imovel.construir(uid, builds=builds, formato=2)
            r['novo_s'] = round(time.perf_counter() - t, 1)
            de_novo = build_imovel.construir(uid, builds=builds, formato=2)
        A, N = antigo['build'], novo['build']
        pasta = builds / uid / N
        manifesto = json.loads((pasta / 'manifest.json').read_text(encoding='utf-8'))
        r.update(antigo=A, novo=N, mesmo_build_de_novo=de_novo['build'] == N and de_novo['reutilizado'],
                 schema_novo=manifesto['schema'], arquivos_novo=len(manifesto['arquivos']),
                 mb_novo=round(sum(f['bytes'] for f in manifesto['arquivos'].values()) / 2**20, 2),
                 mb_antigo=round(sum(f['bytes'] for f in json.loads(
                     (builds / uid / A / 'manifest.json').read_text(encoding='utf-8'))['arquivos'].values()) / 2**20, 2))
        aprovado = lambda b: hashlib.sha256((builds / uid / b / 'manifest.json').read_bytes()).hexdigest()
        site, canal = tmp / 'publicacao' / 'site', tmp / 'publicacao' / 'canal'
        publicar_imovel.montar_live('promover', uid, A, {'schema': 1, 'imoveis': {}}, manifest_aprovado=aprovado(A),
                                    builds=builds, site=site)
        prev = publicar_imovel.montar_preview(uid, N, builds=builds, site=canal)
        with sync_playwright() as pw:
            nav = pw.chromium.launch(executable_path=CHROME, headless=True,
                                     args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'])
            srv = servir(canal)
            r['canal'] = abrir(nav, f'http://127.0.0.1:{srv.server_address[1]}{prev["maquete"]}', a.saida / 'canal.png')
            srv.shutdown()
            estado = json.loads((site / 'estado.json').read_text(encoding='utf-8'))
            publicar_imovel.montar_live('promover', uid, N, estado, manifest_aprovado=aprovado(N), builds=builds, site=site)
            srv = servir(site)
            r['no_ar'] = abrir(nav, f'http://127.0.0.1:{srv.server_address[1]}/maquete/{uid}', a.saida / 'no-ar.png')
            srv.shutdown()
            estado = json.loads((site / 'estado.json').read_text(encoding='utf-8'))
            r['estado_depois_de_promover'] = estado['imoveis'][uid]
            publicar_imovel.montar_live('reverter', uid, None, estado, builds=builds, site=site)
            srv = servir(site)
            r['revertido'] = abrir(nav, f'http://127.0.0.1:{srv.server_address[1]}/maquete/{uid}', a.saida / 'revertido.png')
            srv.shutdown()
            r['estado_depois_de_reverter'] = json.loads((site / 'estado.json').read_text(encoding='utf-8'))['imoveis'][uid]
            nav.close()
    print(json.dumps(r, ensure_ascii=False, indent=1))
    motor_ok = lambda x, b: x['motor'] and x['pronto'] and x['url'] == f'/b/{uid}/{b}/maquete.html' and x['malhas'] > 0 and not x['erros']
    ok = (r['schema_novo'] == 2 and r['mesmo_build_de_novo'] and motor_ok(r['canal'], N) and motor_ok(r['no_ar'], N)
          and r['estado_depois_de_promover']['atual'] == N and r['estado_depois_de_promover']['anterior'] == A
          and r['revertido']['antiga'] and r['revertido']['url'] == f'/b/{uid}/{A}/maquete.html'
          and r['estado_depois_de_reverter']['atual'] == A)
    print('do canal ao ar, e o antigo de volta:', ok, '| prints em', a.saida)
    raise SystemExit(0 if ok else 1)


if __name__ == '__main__':
    main()
