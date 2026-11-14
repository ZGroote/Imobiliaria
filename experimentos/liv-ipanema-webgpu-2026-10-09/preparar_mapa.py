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
PARCEL_REPLACEMENTS = {
    'R.push({ pts, k, name: names[ni] || null });':'R.push(...LivMapPlacement.clipRoad({ pts, k, name: names[ni] || null }));',
    'function registerTerrain(geo) {': 'function registerTerrain(geo) {\n  if((geo.userData.chaoDetalhe||geo.attributes.aViaSurface)&&!geo.userData.presetDY&&!geo.userData.dynamicHeight)LivMapPlacement.clipContextGeometry(THREE,geo);',
    'var clearance=0.4;':'var clearance=1.05;',
    'buildFacingArrows(B);':'buildFacingArrows(B.filter(b=>!LivMapPlacement.excludeBuilding(b)));',
    'function buildingOverRoad(b) {': 'function buildingOverRoad(b) {\n  if (LivMapPlacement.excludeBuilding(b)) return true;',
    'item.parcels=parcels;for(const p of parcels)index(yardGrid,p);':
    'item.parcels=LivMapPlacement.filterParcels(parcels);for(const p of item.parcels)index(yardGrid,p);',
    'for(const [lo,hi] of roadSafety.clipSegment([x/10,z/10],[(x+dx)/10,(z+dz)/10])){':
    'for(const [lo,hi] of LivMapPlacement.wallIntervals(roadSafety.clipSegment([x/10,z/10],[(x+dx)/10,(z+dz)/10]),[x/10,z/10],[(x+dx)/10,(z+dz)/10])){',
    'window.__livModel=model;': 'window.__livModel=model;\n          window.__livParcel=LivMapPlacement.addParcel(THREE,I.scene,I.livTerrain);\n          model.metadata.parcelSource=LivMapPlacement.parcel.source;',
    'var moved=model.updateY(I.livTerrain.sample(anchor[0],anchor[1])*I.livTerrain.amount()+clearance);':
    'var moved=model.updateY(I.livTerrain.sample(anchor[0],anchor[1])*I.livTerrain.amount()+clearance);\n            window.__livParcel.update();',
    'I.sph.radius=290;I.sph.phi=1.05;I.sph.theta=-0.40;':
    'I.sph.radius=310;I.sph.phi=1.05;I.sph.theta=-0.40+Math.PI;'
}


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
    registrations = {'contorno':'modelo/variante/mapa.json', 'entrada':'modelo/entrada/candidato/mapa.json'}
    assets = {'base': {'url':'liv-ipanema.glb', **original['liv-ipanema.glb'], 'sourceModelSHA256':SOURCE_SHA}}
    model_files = {}
    for edition, registration in registrations.items():
        model_record = json.loads((root / registration).read_bytes())
        if (model_record.get('schema') != 'liv-map-model-v1' or model_record.get('edition') != edition or
                model_record.get('validation', {}).get('status') != 'PASS'):
            raise ValueError('GLB sem conferência da autoria e edição')
        for path, fingerprint in model_record['sources'].items():
            source = ROOT / path
            if sha(source.read_bytes()) != fingerprint:
                raise ValueError(f'Conferência desatualizada: {path}')
        checked(root, model_record['asset']['path'], model_record['asset'])
        identity = {k:model_record['asset'][k] for k in ['bytes', 'sha256']}
        model_files[model_record['asset']['path']] = identity
        assets[edition] = {'url':'../' + model_record['asset']['path'], **identity,
                          'sourceModelSHA256':model_record['sourceModelSHA256']}
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
        '          function focus(){\n            window.__livMapFlight = (window.__livMapFlight || 0) + 1;',
        "fetch(new URL(tileInfo.prefix+k+'.bin',location.href))":
        "fetch(new URL(tileInfo.prefix+k+'.bin',document.baseURI))"
    }
    for before, after in replacements.items():
        if app.count(before) != 1:
            raise ValueError('Contrato de inserção do modelo mudou')
        app = app.replace(before, after)
    placement = (root / 'mapa-implantacao.js').read_text('utf8')
    placement_replacements = {
        'center:[-3208.4283207855997,-3185.4802476268346],rotation:-Math.PI/3,':
        'center:LivMapPlacement.anchor,rotation:LivMapPlacement.rotation,',
        'var anchor=[map.centro[0]+8,map.centro[1]-6];': 'var anchor=LivMapPlacement.anchor.slice();',
        'center:anchor,rotation:-Math.PI/3,': 'center:anchor,rotation:LivMapPlacement.rotation,',
        'model.metadata.placementOffsetMeters=[8,-6];':
        'model.metadata.placementOffsetMeters=LivMapPlacement.offsetFromMapCenter.slice();\n          model.metadata.placementFacing=LivMapPlacement.facing;'
    }
    for before, after in placement_replacements.items():
        if app.count(before) != 1: raise ValueError('Contrato de implantação mudou')
        app = app.replace(before, after)
    parcel = json.loads((root/'mapa-parcela.json').read_bytes())
    if parcel.get('schema') != 'liv-map-parcel-v1' or len(parcel.get('polygonXZ', [])) != 19:
        raise ValueError('Referência de terreno inválida')
    for before,after in PARCEL_REPLACEMENTS.items():
        if app.count(before)!=1:raise ValueError('Contrato de recorte do terreno mudou')
        app=app.replace(before,after)
    compiled = (loader + '\nwindow.LivMapParcelData=' + json.dumps(parcel,separators=(',', ':')) + ';\n' + placement + '\n' + app).encode('utf8')
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
        'files': {'mapa-runtime/mapa-liv-ipanema-5km.html': {'bytes':len(output), 'sha256':sha(output)}, **model_files},
        'models':assets, 'changes':['verified model loader', 'asset provenance', 'relative URL base', 'tile fetch respects document base', 'keep edition fragment', 'cancel POI flight on Centralizar', 'half-turn and placement opposite the avenue as indicated by owner', 'approximate parcel outline and access', 'hide old regional buildings/yards and clip walls inside the indicated parcel'],
        'preserved':'source data blocks, streets, regional context outside the parcel, 120 tile source files, unchanged GLB geometry/materials and scale',
        'sources': {p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in
                    [Path(__file__), root/'mapa-loader.js', root/'mapa-implantacao.js', root/'mapa-parcela.json', *(root/path for path in registrations.values())]}
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
