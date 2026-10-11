"""Adapta somente o carregador do LIV; dados/runtime regional da base são preservados."""
import base64
import hashlib
import json
from pathlib import Path
import re
import zlib

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
APP_SHA = 'a51f9ec7e1134d2b2e1cdb7c1748e4e142edec333d1e833f1b565976f60cecdc'
SOURCE_SHA = '89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919'
APP_PATTERN = r'(<script\b[^>]*id="__app"[^>]*>)([\s\S]*?)(</script>)'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def checked(root, path, record):
    data = (root / path).read_bytes()
    if len(data) != record['bytes'] or sha(data) != record['sha256']:
        raise ValueError(f'Arquivo de outra revisão: {path}')
    return data


def build(root=EXP):
    original = json.loads((root / 'manifesto.json').read_bytes())['arquivos']
    html_bytes = checked(root, 'site-baseline/mapa-liv-ipanema-5km.html', original['mapa-liv-ipanema-5km.html'])
    checked(root, 'site-baseline/liv-ipanema.glb', original['liv-ipanema.glb'])
    model_record = json.loads((root / 'modelo/variante/mapa.json').read_bytes())
    if model_record.get('schema') != 'liv-map-model-v1' or model_record.get('validation', {}).get('status') != 'PASS':
        raise ValueError('GLB sem conferência da autoria')
    for path, fingerprint in model_record['sources'].items():
        source = ROOT / path
        if sha(source.read_bytes()) != fingerprint:
            raise ValueError(f'Conferência desatualizada: {path}')
    checked(root, model_record['asset']['path'], model_record['asset'])
    assets = {
        'base': {'url':'liv-ipanema.glb', **original['liv-ipanema.glb'], 'sourceModelSHA256':SOURCE_SHA},
        'contorno': {'url':'../' + model_record['asset']['path'],
                    **{k:model_record['asset'][k] for k in ['bytes', 'sha256']},
                    'sourceModelSHA256':model_record['sourceModelSHA256']}
    }
    loader = (root / 'mapa-loader.js').read_text('utf8')
    if loader.count('__LIV_MAP_ASSETS__') != 1:
        raise ValueError('Contrato do carregador alterado')
    loader = loader.replace('__LIV_MAP_ASSETS__', json.dumps(assets, separators=(',', ':')))
    html = html_bytes.decode('utf8')
    match = re.search(APP_PATTERN, html)
    app_bytes = zlib.decompress(base64.b64decode(match[2]), -15)
    if sha(app_bytes) != APP_SHA:
        raise ValueError('Aplicação regional diferente da base')
    app = app_bytes.decode('utf8')
    replacements = {
        "new THREE.GLTFLoader().load('liv-ipanema.glb',": 'LivVerifiedMap.load(',
        'model.metadata.floorClearanceMeters=clearance;':
        'model.metadata.floorClearanceMeters=clearance;\n          Object.assign(model.metadata,gltf.scene.userData.livMapAsset);',
        'function flyTo(x, z, radius) {':
        'function flyTo(x, z, radius) {\n  const livFlight = window.__livMapFlight = (window.__livMapFlight || 0) + 1;',
        '  function step(now) {\n    const t = Math.min(1, (now - t0) / dur);':
        '  function step(now) {\n    if (livFlight !== window.__livMapFlight) return;\n    const t = Math.min(1, (now - t0) / dur);',
        '          function focus(){':
        '          function focus(){\n            window.__livMapFlight = (window.__livMapFlight || 0) + 1;'
    }
    for before, after in replacements.items():
        if app.count(before) != 1:
            raise ValueError('Contrato de inserção do modelo mudou')
        app = app.replace(before, after)
    compiled = (loader + '\n' + app).encode('utf8')
    deflater = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = base64.b64encode(deflater.compress(compiled) + deflater.flush()).decode('ascii')
    html = html[:match.start(2)] + packed + html[match.end(2):]
    charset = '<meta charset="utf-8">'
    if html.count(charset) != 1 or '<base' in html:
        raise ValueError('Base de URLs inesperada')
    html = html.replace(charset, charset + '\n<base href="../site-baseline/">')
    history = "history.replaceState(null,'',location.pathname+'?'+p.toString());"
    if html.count(history) != 1:
        raise ValueError('Inicialização da URL regional mudou')
    html = html.replace(history, history.replace('p.toString()', 'p.toString()+location.hash'))
    output = html.encode('utf8')
    manifest = {
        'schema':'liv-map-runtime-v1', 'baselineSHA256':sha(html_bytes), 'baselineAppSHA256':APP_SHA,
        'files': {'mapa-runtime/mapa-liv-ipanema-5km.html': {'bytes':len(output), 'sha256':sha(output)},
                  model_record['asset']['path']: {k:model_record['asset'][k] for k in ['bytes','sha256']}},
        'models':assets, 'changes':['verified model loader', 'asset provenance', 'relative URL base', 'keep edition fragment', 'cancel POI flight on Centralizar'],
        'preserved':'all other embedded blocks, regional geometry/materials, terrain, 120 tiles and remaining camera behavior',
        'sources': {p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in
                    [Path(__file__), root/'mapa-loader.js', root/'modelo/variante/mapa.json']}
    }
    return output, manifest


def write(root=EXP):
    output, manifest = build(root)
    path = root / 'mapa-runtime/mapa-liv-ipanema-5km.html'
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != output:
        path.write_bytes(output)
    manifest_path = path.parent / 'manifest.json'
    manifest_bytes = (json.dumps(manifest, indent=2) + '\n').encode('utf8')
    if not manifest_path.exists() or manifest_path.read_bytes() != manifest_bytes:
        manifest_path.write_bytes(manifest_bytes)
    return manifest


if __name__ == '__main__':
    result = write()
    print(json.dumps({'status':'PASS', 'files':result['files']}))
