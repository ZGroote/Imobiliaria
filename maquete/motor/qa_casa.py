"""MG-3: a casa de teste no motor, sem e com luz pré-calculada, e a ficha lendo vitrine/<slug> no emulador.

    npm ci --prefix maquete/motor
    npm run qa:casa

O `qa:casa` roda este script dentro do emulador do Firestore. Precisa do Chrome e de uma placa de vídeo,
como o qa_abrir.py. Serve a raiz do repositório com a pasta pacote-casa/ no lugar de dados/, como o build
fará com a pasta de um imóvel, e confere:
  - as edições leve (sem luz pré-calculada) e premium (com a de 64 × 64), no WebGPU e no WebGL2;
  - a ficha, a Planta 2D e um telefone sem rolagem para o lado;
  - o vitrine_ao_vivo.js na página: o preço do painel, a situação no lugar dele, e o "fora do ar" cobrindo
    a tela. Até o #88 chegar à main, o script e a regra de vitrine/<slug> vêm do galho dele.
"""
import argparse
import json
import os
import subprocess
import tempfile
import threading
import http.server
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

from qa_abrir import CHROME, RAIZ, Servidor

PAGINA = 'maquete/motor/maquete.html'
SLUG = 'casa-de-teste'
GALHO_DA_VITRINE = 'origin/feat/imovel-no-ar'
SCRIPT, REGRAS = 'pipeline/vitrine_ao_vivo.js', 'firebase/firestore.rules'
URL_DE_PRODUCAO = 'https://firestore.googleapis.com/v1/projects/imobilaria-deccb/databases/(default)/documents/vitrine/'


VITRINE = {'script': None}


class ServidorCasa(Servidor):
    def translate_path(self, path):
        return super().translate_path(path.replace('/maquete/motor/dados/', '/maquete/motor/pacote-casa/', 1))

    def do_GET(self):
        if VITRINE['script'] is None or self.path.split('?')[0] != '/' + PAGINA:
            return super().do_GET()
        # O que o build fará: o script depois do casa.js, como módulo, com o slug do imóvel. Vem deste
        # servidor, e não de uma rota do Playwright: o Chrome só deixa a página ler o emulador (outra porta
        # do 127.0.0.1) quando a própria página veio da rede local.
        html = (RAIZ / PAGINA).read_text(encoding='utf-8').replace(
            '</html>', f'<script type="module">{VITRINE["script"]}\nvitrineAoVivo({json.dumps(SLUG)});</script>\n</html>').encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(html)))
        self.end_headers()
        self.wfile.write(html)


def da_vitrine(caminho, marca):
    """Da main quando ela já tem a vitrine; senão, do galho do #88."""
    arquivo = RAIZ / caminho
    if arquivo.exists() and marca in arquivo.read_text(encoding='utf-8'):
        return arquivo.read_text(encoding='utf-8')
    return subprocess.run(['git', 'show', f'{GALHO_DA_VITRINE}:{caminho}'], cwd=RAIZ, check=True,
                          capture_output=True, encoding='utf-8').stdout


class Emulador:
    def __init__(self):
        self.base = 'http://' + os.environ['FIRESTORE_EMULATOR_HOST']
        self.projeto = os.environ.get('GCLOUD_PROJECT', 'demo-painel')
        self.docs = f'{self.base}/v1/projects/{self.projeto}/databases/(default)/documents/vitrine/'

    def pedir(self, metodo, url, corpo):
        req = urllib.request.Request(url, method=metodo, data=json.dumps(corpo).encode(),
                                     headers={'Content-Type': 'application/json', 'Authorization': 'Bearer owner'})
        urllib.request.urlopen(req).read()

    def regras(self, texto):
        self.pedir('PUT', f'{self.base}/emulator/v1/projects/{self.projeto}:securityRules',
                   {'rules': {'files': [{'name': 'firestore.rules', 'content': texto}]}})

    def vitrine(self, online, situacao, preco):
        """Grava como dono (passa por cima da regra); a página lê sem login, pela regra."""
        self.pedir('PATCH', self.docs + SLUG, {'fields': {
            'propertyId': {'stringValue': 'imovel-de-teste'}, 'online': {'booleanValue': online},
            'situacao': {'stringValue': situacao}, 'precoCentavos': {'integerValue': str(preco)},
            'updatedAt': {'timestampValue': '2026-10-21T12:00:00Z'}}})


def nova_pagina(nav, largura=1280, altura=860):
    page = nav.new_page(viewport={'width': largura, 'height': altura})
    erros = []
    page.on('pageerror', lambda e: erros.append(str(e)))
    return page, erros


def esperar(page):
    page.wait_for_function('()=>__maquete.ready||__maquete.error', timeout=120000)


def exterior(page, porta, backend, edicao, saida):
    page.goto(f'http://127.0.0.1:{porta}/{PAGINA}?backend={backend}&geometria={edicao}', wait_until='load', timeout=120000)
    esperar(page)
    quadro = page.frames[1]
    estado = quadro.evaluate('''()=>{const p=__livProva,sol=[];p.scene?.traverse(o=>{if(o.isLight&&o.castShadow)sol.push(o);});
      return {ready:p.ready,error:p.error,backend:p.backend,malhas:p.meshes?.length??0,atlas:!!p.atlas,unidades:p.units?.units?.length??0,
        bakeados:(p.materials??[]).filter(m=>m.userData.livBakedTransport).length,
        sombra:p.renderer?.shadowMap.enabled===true&&sol.length===1&&!!sol[0].shadow.map}}''')
    ficha = page.evaluate('''()=>({titulo:fTitulo.textContent,preco:fPreco.lastChild.nodeValue,linhas:fLinhas.querySelectorAll('dt').length,
      perto:perto.getAttribute('href')})''')
    if estado['ready']:
        page.wait_for_timeout(1200)
        page.screenshot(path=str(saida / f'casa-{edicao}-{backend}.png'))
    return {**estado, 'ficha': ficha}


def planta(page, saida):
    page.click('[data-modo="planta"]')
    page.wait_for_selector('#planta svg')
    contagem = page.evaluate('''()=>Object.fromEntries(['comodo','parede','janela','folha','arco','rotulo']
      .map(c=>[c,document.querySelectorAll('#planta .'+c).length]))''')
    page.screenshot(path=str(saida / 'casa-planta.png'))
    pausado = page.frames[1].evaluate('()=>__livProva.active===false')
    page.click('[data-modo="maquete"]')
    return {**contagem, 'exterior_pausado': pausado,
            'voltou': page.frames[1].evaluate('()=>__livProva.active===true') and page.is_hidden('#planta')}


def telefone(nav, porta, saida):
    page, erros = nova_pagina(nav, 390, 844)
    page.goto(f'http://127.0.0.1:{porta}/{PAGINA}', wait_until='load', timeout=120000)
    esperar(page)
    page.wait_for_timeout(800)
    page.screenshot(path=str(saida / 'casa-telefone.png'), full_page=True)
    largura = page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
    page.close()
    return {'sem_rolagem_lateral': largura, 'erros': erros}


def vitrine(nav, porta, emulador, saida):
    script = da_vitrine(SCRIPT, 'function vitrineAoVivo')
    assert script.count(URL_DE_PRODUCAO) == 1
    VITRINE['script'] = script.replace(URL_DE_PRODUCAO, emulador.docs)
    emulador.regras(da_vitrine(REGRAS, 'match /vitrine/'))
    page, erros = nova_pagina(nav)
    preco = '()=>fPreco.lastChild.nodeValue.replace(/\\s/g," ")'
    resultado = {}
    for nome, online, situacao, centavos, espera in (
            ('preco', True, 'disponivel', 51234567, 'R$ 512.345,67'), ('vendido', True, 'vendido', 51234567, 'Vendido')):
        emulador.vitrine(online, situacao, centavos)
        page.goto(f'http://127.0.0.1:{porta}/{PAGINA}', wait_until='load', timeout=120000)
        page.wait_for_function(f'()=>({preco})()==={json.dumps(espera)}', timeout=20000)
        resultado[nome] = page.evaluate(preco)
    emulador.vitrine(False, 'disponivel', 51234567)
    page.goto(f'http://127.0.0.1:{porta}/{PAGINA}', wait_until='load', timeout=120000)
    page.wait_for_function('()=>[...document.querySelectorAll("[role=alert]")].some(e=>e.textContent.includes("não está no ar"))', timeout=20000)
    # Coberta: o centro do palco (a maquete) e o da ficha mostram o aviso, não a página.
    resultado['fora_do_ar_cobre'] = page.evaluate('''()=>[palco,ficha].every(el=>{const r=el.getBoundingClientRect();
      return document.elementFromPoint(r.left+r.width/2,Math.min(innerHeight-1,r.top+r.height/2))?.textContent.includes('não está no ar');})''')
    page.screenshot(path=str(saida / 'casa-fora-do-ar.png'))
    page.close()
    return {**resultado, 'erros': erros}


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--saida', type=Path, default=Path(tempfile.gettempdir()) / 'maquete-motor-qa')
    a = p.parse_args()
    a.saida.mkdir(parents=True, exist_ok=True)
    if 'FIRESTORE_EMULATOR_HOST' not in os.environ:
        raise SystemExit('Rode dentro do emulador: npm run qa:casa')
    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', 0), ServidorCasa)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    porta = servidor.server_address[1]
    r = {}
    try:
        with sync_playwright() as pw:
            nav = pw.chromium.launch(executable_path=CHROME, headless=True,
                                     args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'])
            for edicao in ('leve', 'premium'):
                for backend in ('webgpu', 'webgl'):
                    page, erros = nova_pagina(nav)
                    r[f'{edicao}-{backend}'] = {**exterior(page, porta, backend, edicao, a.saida), 'erros': erros}
                    if edicao == 'leve' and backend == 'webgpu':
                        r['planta'] = planta(page, a.saida)
                    page.close()
            r['telefone'] = telefone(nav, porta, a.saida)
            r['vitrine'] = vitrine(nav, porta, Emulador(), a.saida)
            nav.close()
    finally:
        servidor.shutdown()
    print(json.dumps(r, ensure_ascii=False, indent=1))
    ficha = {'titulo': 'Casa de teste', 'preco': 'R$ 450.000', 'linhas': 5, 'perto': 'tour.html'}
    abre = all(r[f'{e}-{b}']['ready'] and r[f'{e}-{b}']['backend'] == b and r[f'{e}-{b}']['malhas'] == 3
               and r[f'{e}-{b}']['unidades'] == 0 and r[f'{e}-{b}']['sombra'] and r[f'{e}-{b}']['ficha'] == ficha
               and r[f'{e}-{b}']['atlas'] == (e == 'premium') and r[f'{e}-{b}']['bakeados'] == (2 if e == 'premium' else 0)
               and not r[f'{e}-{b}']['erros'] for e in ('leve', 'premium') for b in ('webgpu', 'webgl'))
    pl = r['planta']
    mostra_planta = (pl['comodo'], pl['janela'], pl['folha'], pl['arco'], pl['rotulo']) == (6, 5, 4, 4, 6) \
        and pl['parede'] > 0 and pl['exterior_pausado'] and pl['voltou']
    v = r['vitrine']
    ao_vivo = v['preco'] == 'R$ 512.345,67' and v['vendido'] == 'Vendido' and v['fora_do_ar_cobre'] and not v['erros']
    tel = r['telefone']['sem_rolagem_lateral'] and not r['telefone']['erros']
    print('abre sem e com luz:', abre, '| ficha e planta:', mostra_planta, '| vitrine ao vivo:', ao_vivo, '| telefone:', tel)
    raise SystemExit(0 if abre and mostra_planta and ao_vivo and tel else 1)


if __name__ == '__main__':
    main()
