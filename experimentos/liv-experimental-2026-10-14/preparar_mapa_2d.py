"""Extrai os POIs originais sem carregar a cidade 3D no navegador."""
import base64
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import shutil
import zlib

ROOT = Path(__file__).resolve().parent


def build(root=ROOT):
    source = root / 'site-baseline/mapa-liv-ipanema-5km.html'
    html = source.read_text(encoding='utf8')
    def unpack(identifier):
        match = re.search(r'<script[^>]*id="' + identifier + r'"[^>]*>([\s\S]*?)</script>', html)
        return zlib.decompress(base64.b64decode(match[1]), -15).decode('utf8')
    pois = json.loads(unpack('__poidata'))
    app = unpack('__app')
    categories = {}
    for key, label, color in re.findall(r"^\s*(\w+):\s*\{\s*lbl:[\"']([^\"']+)[\"'].*?col:[\"'](#[0-9A-Fa-f]+)", app, re.M):
        categories[key] = {'label': label, 'color': color}
    if len(categories) != 21 or not pois or any(p['c'] not in categories for p in pois):
        raise ValueError('O catálogo de pontos de interesse mudou.')
    city = json.loads(re.search(r'id="__cidade">([\s\S]*?)</script>', html)[1])
    x, z = json.loads((root / 'mapa-parcela.json').read_text(encoding='utf8'))['anchor']
    lat0, lon0 = city['centro']['lat'], city['centro']['lon']
    center = [lat0 - z / 111132.92, lon0 + x / (111319.49 * math.cos(math.radians(lat0)))]
    original = json.loads((root/'manifesto.json').read_bytes())['arquivos']
    models = {'base': {'edition': 'base', 'url': 'site-baseline/liv-ipanema.glb', **original['liv-ipanema.glb']}}
    for edition, path in [('contorno', 'modelo/variante/mapa.json'), ('entrada', 'modelo/entrada/candidato/mapa.json')]:
        record = json.loads((root/path).read_bytes())
        if record['validation']['status'] != 'PASS' or record['edition'] != edition:
            raise ValueError('Modelo sem validação da geometria.')
        models[edition] = {'edition': edition, 'url': record['asset']['path'], **{k: record['asset'][k] for k in ['bytes', 'sha256']}}
    lara = root.parent/'laranjeiras-2026-10-30'
    metadata = json.loads((lara/'modelo/modelo.json').read_bytes())['metadata']
    source = (lara/'modelo/laranjeiras.glb').read_bytes()
    lara_asset = {'edition': 'base', 'url': 'mapa-modelos/laranjeiras.glb', 'bytes': len(source), 'sha256': hashlib.sha256(source).hexdigest()}
    lara_center = [sum(point[i] for point in metadata['lote_geo'])/len(metadata['lote_geo']) for i in [0, 1]]
    properties = [
        {'id': 'liv-ipanema', 'name': 'LIV Ipanema', 'center': center, 'rotation': math.radians(120), 'models': models, 'viewer': 'https://conectaimoveis3d.com.br/maquetes/liv/'},
        {'id': 'parque-das-laranjeiras', 'name': 'Parque das Laranjeiras', 'center': lara_center, 'rotation': math.radians(-metadata['rumo_cima_graus']), 'models': {'base': lara_asset}, 'viewer': 'https://conectaimoveis3d.com.br/laranjeiras/'},
    ]
    data = {'schema': 'liv-map-2d-v1', 'rendererSHA256': hashlib.sha256((root/'mapa-edificio.bundle.js').read_bytes()).hexdigest(), 'models': models, 'property': properties[0], 'properties': properties,
            'categories': categories, 'pois': pois}
    image = root/'mapa-runtime/imagem-tratada.json'
    if image.exists():
        data['imagery'] = json.loads(image.read_bytes())
    return (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf8')


def write(root=ROOT):
    (root/'mapa-modelos').mkdir(exist_ok=True)
    shutil.copyfile(root.parent/'laranjeiras-2026-10-30/modelo/laranjeiras.glb', root/'mapa-modelos/laranjeiras.glb')
    subprocess.run(['node', '--input-type=module', '-e',
                    "import {build} from 'esbuild';await build({entryPoints:[process.argv[1]],outfile:process.argv[2],bundle:true,format:'esm',minify:true,target:'es2022'});",
                    str(root/'mapa-edificio.js'), str(root/'mapa-edificio.bundle.js')], cwd=root.parents[1], check=True)
    (root / 'mapa-pois.json').write_bytes(build(root))
    paths = ['mapa-runtime/mapa-2d.html', 'mapa-2d.js', 'mapa-2d.css', 'mapa-pois.json',
             'vendor/maplibre/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css', 'vendor/maplibre/LICENSE.txt', 'mapa-edificio.bundle.js', 'horario-solar.js']
    files = {path: {'bytes': len((root/path).read_bytes()), 'sha256': hashlib.sha256((root/path).read_bytes()).hexdigest()} for path in paths}
    imagery = json.loads((root/'mapa-pois.json').read_bytes()).get('imagery')
    if imagery:
        for path in ['mapa-runtime/imagem-tratada.json', imagery['url']]:
            content = (root/path).read_bytes()
            files[path] = {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
    for model in [model for prop in json.loads((root/'mapa-pois.json').read_bytes())['properties'] for model in prop['models'].values()]:
        content = (root/model['url']).read_bytes()
        if len(content) != model['bytes'] or hashlib.sha256(content).hexdigest() != model['sha256']:
            raise ValueError('O GLB diverge da edição verificada.')
        files[model['url']] = {k: model[k] for k in ['bytes', 'sha256']}
    (root / 'mapa-2d-manifest.json').write_text(json.dumps({'schema': 'liv-map-2d-v1', 'files': files}, indent=2) + '\n', encoding='utf8')
    return files


if __name__ == '__main__':
    print(json.dumps(write()))
