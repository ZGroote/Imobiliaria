"""Exporta os interiores canto e meio (cena real do navegador) para o SketchUp.

Mesmo caminho do LIV: exportar_bake_meio.py (exporter-native.js sobre a cena de autoria) e
liv-sketchup-2026-10-26/preparar_dados.py (cores sRGB, texturas em PNG). A cena de autoria já tem
os móveis aprovados no lugar do cadastro. Precisa do servidor na raiz do repositório:
python -m http.server 8765
python experimentos/laranjeiras-2026-10-30/sketchup/exportar_apartamentos.py
"""
import base64
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
DADOS = AQUI/'dados'
URL = 'http://localhost:8765/experimentos/laranjeiras-2026-10-30/site/'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

EXPORT = '''async tip=>{
  const api=__livInterior, THREE=await import('three/webgpu');
  const {createLayout}=await import('./interior-navigation.js');
  const unit=await (await fetch('./interiores/'+tip+'/unidade.json')).json(), layout=createLayout(unit);
  const catalog=await (await fetch('./interiores/catalogo.json')).json();
  await api.renderer.setAnimationLoop(null);
  await import('./exporter-native.js');
  const root=api.authoringScene;
  if(!root)throw Error('Cena de autoria ausente.');
  guardarAlbedoInteriorLiv(root);
  return exportarCenaInteriorLiv({THREE,root,unitId:unit.id,unitHash:catalog.tipologias[tip].unitSHA256,
    height:layout.pd,mode:'planta3d',rooms:layout.rooms.map(r=>({name:r.name,x:r.cx,z:r.cz}))});
}'''


def srgb(v):
    v = max(0.0, min(1.0, v))
    return round(255*(12.92*v if v <= .0031308 else 1.055*v**(1/2.4)-.055))


def converter(tip, cena):
    texdir = DADOS/'texturas'
    texdir.mkdir(parents=True, exist_ok=True)
    texturas = {}
    for chave, t in cena['textures'].items():
        caminho = texdir/f'{tip}-{chave}.png'
        caminho.write_bytes(base64.b64decode(t['data'].split(',', 1)[1]))
        texturas[chave] = {'path': caminho.as_posix(), 'repeat': t.get('repeat', [1, 1]), 'offset': t.get('offset', [0, 0])}
    materiais = {}
    for chave, m in cena['materials'].items():
        materiais[chave] = {'name': m['name'] or f'{tip}-{chave}', 'color': [srgb(c) for c in m['color']],
                            'opacity': m['opacity'], 'roughness': m['roughness'], 'metalness': m['metalness']}
        if m.get('map') in texturas:
            materiais[chave]['texture'] = texturas[m['map']]
    objetos = []
    for o in cena['objects']:
        if not o.get('include', True):
            continue
        objetos.append({'slot': o['slot'], 'name': o['name'], 'geometry': o['geometry'], 'material': o['materials'][0],
                        'matrix': o['matrix'], 'kind': o['kind'],
                        'ceiling': o['name'] in ('forro-original', 'forro') or 'forro' in o['name'].lower()})
    dados = {'tipologia': tip, 'height': cena['height'], 'rooms': cena['rooms'],
             'geometries': cena['geometries'], 'materials': materiais, 'objects': objetos}
    saida = DADOS/f'apartamento-{tip}.json'
    saida.write_text(json.dumps(dados, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')
    kinds = {}
    for o in objetos:
        kinds[o['kind']] = kinds.get(o['kind'], 0)+1
    print(tip, 'objetos', len(objetos), kinds, 'texturas', len(texturas), 'MB', round(saida.stat().st_size/2**20, 1), flush=True)


def main():
    DADOS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=True)
        for tip in ('canto', 'meio'):
            page = browser.new_page(viewport={'width': 1200, 'height': 900})
            erros = []
            page.on('pageerror', lambda e: erros.append(str(e)))
            page.goto(URL+f'interior.html?tipologia={tip}&modo=planta3d&backend=webgl', timeout=120000)
            page.wait_for_function('()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready;}', timeout=180000)
            cena = page.evaluate(EXPORT, tip)
            if erros:
                raise SystemExit(f'{tip}: {erros}')
            converter(tip, cena)
            page.close()
        browser.close()


if __name__ == '__main__':
    main()
