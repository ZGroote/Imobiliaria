"""Compacta PNG16 embutidos e fecha o catálogo portátil, sem alterar o Blender."""
import hashlib
import io
import json
import math
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
SOURCE = ROOT / 'entrega/LIV_Luz_Natural.blend'
SHEEN = json.loads((ROOT / 'fontes/materiais-web/sheen-source-lookup.json').read_text(encoding='utf-8'))['materials']


def read_glb(path):
    blob = path.read_bytes()
    size = struct.unpack_from('<I', blob, 12)[0]
    return json.loads(blob[20:20 + size]), blob[28 + size:]


def compact(path):
    model, binary = read_glb(path)
    sheen_changes = []
    for material in model.get('materials', []):
        name = material.get('extras', {}).get('web_source_material')
        extension = material.get('extensions', {}).get('KHR_materials_sheen')
        if name in SHEEN and extension is not None:
            source = SHEEN[name]
            factor = [float(value) * float(source['weight']) for value in source['tintRGB']]
            if extension.get('sheenColorFactor') != factor:
                sheen_changes.append({'sourceMaterial': name, 'weight': source['weight'], 'tintRGB': source['tintRGB'], 'before': extension.get('sheenColorFactor'), 'after': factor, 'roughnessPreserved': extension.get('sheenRoughnessFactor')})
                extension['sheenColorFactor'] = factor
    image_views = {image['bufferView']: image for image in model.get('images', [])}
    output = bytearray()
    converted = []
    for index, view in enumerate(model['bufferViews']):
        start = view.get('byteOffset', 0)
        payload = binary[start:start + view['byteLength']]
        if index in image_views and payload.startswith(b'\x89PNG\r\n\x1a\n') and payload[24] == 16:
            image = Image.open(io.BytesIO(payload))
            before_size = image.size
            target = io.BytesIO()
            image.save(target, format='PNG', optimize=True, compress_level=9)
            replacement = target.getvalue()
            assert replacement[24] == 8 and Image.open(io.BytesIO(replacement)).size == before_size
            converted.append({'image': image_views[index].get('name'), 'size': list(before_size), 'beforeBytes': len(payload), 'afterBytes': len(replacement), 'precision': '16 to 8 bits; no spatial resize'})
            payload = replacement
        output.extend(b'\0' * ((-len(output)) % 4))
        view['byteOffset'] = len(output)
        view['byteLength'] = len(payload)
        output.extend(payload)
    if not converted and not sheen_changes:
        return [], []
    model['buffers'][0]['byteLength'] = len(output)
    output.extend(b'\0' * ((-len(output)) % 4))
    header = json.dumps(model, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    header += b' ' * ((-len(header)) % 4)
    result = struct.pack('<III', 0x46546C67, 2, 28 + len(header) + len(output)) + struct.pack('<II', len(header), 0x4E4F534A) + header + struct.pack('<II', len(output), 0x004E4942) + output
    temporary = path.with_suffix('.glb.tmp')
    temporary.write_bytes(result)
    temporary.replace(path)
    return converted, sheen_changes


catalog_path = DEST / 'catalogo.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == catalog['sourceBlendSha256']
native = json.loads((DEST.parent / 'canto/unidade.json').read_text(encoding='utf-8'))['planta']['moveis']
source_bounds = json.loads((ROOT / 'fontes/export_web_source_bounds.json').read_text(encoding='utf-8'))
chairs = {entry['id']: entry for entry in next(a for a in source_bounds['assets'] if a['id'] == 'cadeira-jantar')['instances']}
for asset in catalog['assets']:
    path = DEST / asset['path']
    conversion, sheen_changes = compact(path)
    if conversion:
        asset['texturePrecisionConversion'] = conversion
    asset['bytes'] = path.stat().st_size
    asset['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    if asset['id'] == 'cadeira-jantar':
        asset['namePattern'] = 'jantar|varanda.*1'
        asset['replaces'] = ['movel-11', 'movel-12', 'movel-13', 'movel-14', 'movel-25']
    reference = next((f for f in native if f['tipo'] in asset['types'] and (not asset.get('namePattern') or __import__('re').search(asset['namePattern'], f['nome'], __import__('re').I))), None)
    if reference:
        asset['referenceFootprintCanto'] = {key: reference[key] for key in ('w', 'h', 'd')}
    if asset['id'] in ('cadeira-jantar', 'cadeira-varanda-lateral'):
        ids = [('movel-11', 0), ('movel-12', 0), ('movel-13', 2), ('movel-14', 2), ('movel-25', 0)] if asset['id'] == 'cadeira-jantar' else [('movel-26', 1)]
        asset['instances'] = []
        for furniture_id, rotation in ids:
            bounds = chairs[furniture_id]['threeBounds']
            position = [(bounds['min'][0] + bounds['max'][0]) / 2, bounds['min'][1], (bounds['min'][2] + bounds['max'][2]) / 2]
            asset['instances'].append({'furnitureId': furniture_id, 'positionThree': position, 'rotationQuarterTurns': rotation})
    # Public provenance stays portable; full local bake report remains in fontes/.
    report = asset.get('materialConversion', {})
    asset['materialConversion'] = {'bakeLighting': False, 'bakedImages': report.get('bakedImages', len(report.get('images', []))), 'warnings': report.get('warnings', []), 'method': report.get('method', 'material-channel bake; image PBR preserved')}
    if sheen_changes or report.get('sheenCorrections'):
        asset['materialConversion']['sheenCorrections'] = sheen_changes or report['sheenCorrections']
    model, _ = read_glb(path)
    positions = [model['accessors'][primitive['attributes']['POSITION']] for mesh in model['meshes'] for primitive in mesh['primitives']]
    lower = [min(a['min'][i] for a in positions) for i in range(3)]
    upper = [max(a['max'][i] for a in positions) for i in range(3)]
    asset['canonicalBounds'] = {'min': lower, 'max': upper}
    yaw = asset['source']['rotationQuarterTurns'] * math.pi / 2
    location = asset['source']['positionThree']
    world = [(location[0] + math.cos(yaw) * x + math.sin(yaw) * z, location[1] + y, location[2] - math.sin(yaw) * x + math.cos(yaw) * z) for x in (lower[0], upper[0]) for y in (lower[1], upper[1]) for z in (lower[2], upper[2])]
    asset['worldBoundsCanto'] = {'min': [min(v[i] for v in world) for i in range(3)], 'max': [max(v[i] for v in world) for i in range(3)]}
    assert asset['bytes'] < 15 * 1024 * 1024, (asset['id'], asset['bytes'])

by_id = {asset['id']: asset for asset in catalog['assets']}
catalog['decorations'] = [
    {'assetId': 'planta', 'typology': 'canto', 'position': by_id['planta']['source']['positionThree'], 'yaw': 0, 'dimensions': by_id['planta']['dimensions']},
    {'assetId': 'planta', 'typology': 'meio', 'anchorType': 'mesa', 'anchorNamePattern': 'jantar', 'offset': [-.63, 0, -.895], 'yaw': 0, 'dimensions': by_id['planta']['dimensions']},
    {'assetId': 'quadro', 'typology': 'canto', 'position': by_id['quadro']['source']['positionThree'], 'yaw': math.pi, 'dimensions': by_id['quadro']['dimensions']},
    {'assetId': 'quadro', 'typology': 'meio', 'position': [-1.175, 1.30, 2.58], 'yaw': math.pi, 'dimensions': by_id['quadro']['dimensions']},
]
sofa = by_id['sofa']['source']
for asset_id, anchor_type, anchor_position, anchor_yaw in (
    ('mesa-apoio', 'sofa', sofa['positionThree'], sofa['rotationQuarterTurns'] * math.pi / 2),
    ('livros-rack', 'rack', [-.45, .03, 2.025], math.pi / 2),
):
    if asset_id not in by_id:
        continue
    asset = by_id[asset_id]
    position = asset['source']['positionThree']
    yaw = asset['source']['rotationQuarterTurns'] * math.pi / 2
    dx, dy, dz = [position[i] - anchor_position[i] for i in range(3)]
    offset = [math.cos(anchor_yaw) * dx - math.sin(anchor_yaw) * dz, dy, math.sin(anchor_yaw) * dx + math.cos(anchor_yaw) * dz]
    catalog['decorations'].extend((
        {'assetId': asset_id, 'typology': 'canto', 'position': position, 'yaw': yaw, 'dimensions': asset['dimensions']},
        {'assetId': asset_id, 'typology': 'meio', 'anchorType': anchor_type, 'offset': offset, 'yaw': yaw - anchor_yaw, 'dimensions': asset['dimensions']},
    ))
catalog['sourceBlend']['path'] = 'experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend'
catalog['environment'] = json.loads((DEST / 'ceu.json').read_text(encoding='utf-8'))
catalog['legacyHideSourceSlots'] = sorted({row['sourceSlot'] for row in catalog.get('hiddenSourceObjects', []) if row['sourceSlot'] >= 0})
catalog['legacyHideNodeNames'] = [row['name'] for row in catalog.get('hiddenSourceObjects', [])]
catalog['complete'] = True
temporary = catalog_path.with_suffix('.json.tmp')
temporary.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding='utf-8')
temporary.replace(catalog_path)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == catalog['sourceBlendSha256']
print('WEB_CATALOG_COMPLETE', len(catalog['assets']), sum(a['bytes'] for a in catalog['assets']), catalog['sourceBlendSha256'])
for asset in catalog['assets']:
    print(asset['id'], asset['bytes'], asset['triangles'])
