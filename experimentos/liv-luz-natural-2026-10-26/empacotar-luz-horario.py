"""Limpa o ruído (OIDN RTLightmap) e empacota a luz por hora de uma planta (canto ou meio) em RGBM para o site.

python experimentos/liv-luz-natural-2026-10-26/empacotar-luz-horario.py [canto|meio]
Lê fontes/luz-horario[-meio]/{medidas.json,chaves.json,sondas.json,<id>.f32,<id>-sondas.f32}; escreve
liv-experimental-2026-10-14/interiores/<planta>/luz-horario/{manifest.json,<id>.rgbm.gz,<id>-sondas.bin.gz}.
As sondas viram uma textura 3D RGBA16F por chave: x = coluna da grade, y = nível, z = face * soma(nz) +
início do cômodo + linha. Sonda inválida (dentro de móvel ou parede) herda a válida mais próxima do mesmo
cômodo; o mapa de cômodos (5 cm, visto de cima) diz ao site qual grade cada ponto usa, sem vazar parede.
"""
from pathlib import Path
import base64
import gzip
import hashlib
import json
import os
import sys

import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
TYPOLOGY = sys.argv[1] if len(sys.argv) > 1 else 'canto'
if TYPOLOGY not in ('canto', 'meio'):
    raise SystemExit('Planta: canto ou meio')
RAW = ROOT / ('fontes/luz-horario' if TYPOLOGY == 'canto' else 'fontes/luz-horario-meio')
DEST = ROOT.parent / f'liv-experimental-2026-10-14/interiores/{TYPOLOGY}/luz-horario'
sys.path.insert(0, str(ROOT.parents[1] / 'v1.5/miniaturas/liv-ipanema/interior'))
from denoise_luz import oidn_filter  # noqa: E402

OIDN = Path(os.environ['LOCALAPPDATA']) / 'CodexBlenderStudy/oidn-2.3.3.x64.windows/bin'
RANGE = 16.0
# Ilhas do UV1 têm 6,8 px de folga em 2048 (unwrap.json); a guarda fica abaixo da metade na resolução usada.
GUARD_AT_2048 = 3.15


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(rgba, guard):
    mask = rgba[:, :, 3] > 0
    distance, nearest = ndimage.distance_transform_edt(~mask, return_indices=True)
    border = (~mask) & (distance <= guard)
    rgb = np.ascontiguousarray(rgba[:, :, :3]); rgb[border] = rgba[nearest[0][border], nearest[1][border], :3]
    denoised = oidn_filter(rgb, OIDN); denoised[~mask] = 0
    denoised[border] = denoised[nearest[0][border], nearest[1][border]]
    clipped = int((denoised.max(axis=2) > RANGE).sum())
    if clipped:
        raise RuntimeError(f'RGBM {RANGE} cortaria {clipped} pixels')
    # linear-rgbm2-u8: luz = rgb * a² * RANGE. Com a linear, o passo de a=1 para a=2 no escuro dobrava a luz
    # entre vizinhos e o bilinear do site desenhava um contorno claro em degraus na parede.
    alpha = np.clip(np.ceil(np.sqrt(denoised.max(axis=2) / RANGE) * 255), 1, 255)
    scale = (alpha / 255) ** 2 * RANGE
    encoded = np.empty((*rgba.shape[:2], 4), dtype=np.uint8)
    encoded[:, :, :3] = np.rint(np.clip(denoised / scale[:, :, None], 0, 1) * 255).astype(np.uint8)
    encoded[:, :, 3] = alpha.astype(np.uint8)
    return encoded.tobytes(), float(denoised.max())


def probe_layout(spec):
    rooms, offset = [], 0
    for room in spec['rooms']:
        rooms.append({'room': room['room'], 'name': room['name'], 'origin': room['origin'], 'step': room['step'],
                      'n': room['n'], 'zOffset': offset})
        offset += room['n'][2]
    width = max(r['n'][0] for r in spec['rooms']); levels = spec['rooms'][0]['n'][1]
    return rooms, {'width': width, 'height': levels, 'depth': 6 * offset, 'rows': offset}


def encode_probes(raw, spec, rooms, dims):
    """Média de cada bloco de face; inválidas copiam a válida mais próxima do cômodo; meia precisão."""
    image = np.frombuffer(raw, dtype=np.float32).reshape(spec['height'], spec['width'], 4)
    b, per_row = spec['block'], spec['perRow']
    faces = image[:, :, :3].reshape(spec['height'] // b, b, per_row, b, 3).mean(axis=(1, 3)).reshape(-1, 3)[:spec['probes'] * 6]
    faces = faces.reshape(spec['probes'], 6, 3)
    volume = np.zeros((dims['depth'], dims['height'], dims['width'], 4), dtype=np.float32)
    start = 0
    for room, layout in zip(spec['rooms'], rooms):
        nx, ny, nz = room['n']; count = nx * ny * nz
        values = faces[start:start + count].reshape(nz, ny, nx, 6, 3); start += count
        valid = np.asarray(room['valid']).reshape(nz, ny, nx) & (values.max(axis=(3, 4)) > 1e-6)
        if not valid.any():
            raise RuntimeError(f'{room["name"]}: nenhuma sonda válida')
        _, nearest = ndimage.distance_transform_edt(~valid, return_indices=True)
        values = values[nearest[0], nearest[1], nearest[2]]
        for face in range(6):
            z0 = face * dims['rows'] + layout['zOffset']
            volume[z0:z0 + nz, :, :nx, :3] = values[:, :, :, face]
            volume[z0:z0 + nz, :, :nx, 3] = 1
    return volume.astype(np.float16).tobytes()


def room_map(spec, cell=.05):
    """Índice do cômodo a cada 5 cm; fora de todos, o cômodo mais próximo."""
    plan = json.loads((ROOT.parent / f'liv-experimental-2026-10-14/interiores/{TYPOLOGY}/unidade.json').read_text(encoding='utf8'))['planta']
    points = [p for c in plan['comodos'] for p in c['poly']]
    lo = [min(p[i] for p in points) for i in (0, 1)]; hi = [max(p[i] for p in points) for i in (0, 1)]
    center = [(lo[i] + hi[i]) / 2 for i in (0, 1)]
    width, height = int(np.ceil((hi[0] - lo[0]) / cell)), int(np.ceil((hi[1] - lo[1]) / cell))
    labels = np.zeros((height, width), dtype=np.int32)
    ids = [r['room'] for r in spec['rooms']]
    for index, room in enumerate(plan['comodos']):
        poly = room['poly']; slot = ids.index(room.get('id')) + 1
        for j in range(height):
            z = lo[1] + (j + .5) * cell
            for i in range(width):
                x = lo[0] + (i + .5) * cell; hit = False
                for k in range(len(poly)):
                    a, c = poly[k], poly[k - 1]
                    if (a[1] > z) != (c[1] > z) and x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]:
                        hit = not hit
                if hit:
                    labels[j, i] = slot
    _, nearest = ndimage.distance_transform_edt(labels == 0, return_indices=True)
    labels = labels[nearest[0], nearest[1]] - 1
    return {'x0': lo[0] - center[0], 'z0': lo[1] - center[1], 'cell': cell, 'width': width, 'height': height,
            'data': base64.b64encode(labels.astype(np.uint8).tobytes()).decode()}


def main():
    measured = json.loads((RAW / 'medidas.json').read_text(encoding='utf8'))
    keys = json.loads((RAW / 'chaves.json').read_text(encoding='utf8'))
    size = measured['size']; guard = GUARD_AT_2048 * size / 2048
    DEST.mkdir(parents=True, exist_ok=True)
    spec = json.loads((RAW / 'sondas.json').read_text(encoding='utf8'))
    rooms, dims = probe_layout(spec)
    entries = []
    for key in [*keys['keys'], {'id': 'noite'}]:
        info = measured['keys'].get(key['id'])
        if not info:
            raise RuntimeError(f'Chave {key["id"]} ainda não foi gravada no Blender')
        raw = (RAW / f'{key["id"]}.f32').read_bytes()
        if sha(raw) != info['rawSHA256']:
            raise RuntimeError(f'{key["id"]}: bruto diferente do registrado')
        texture, peak = encode(np.frombuffer(raw, dtype=np.float32).reshape(size, size, 4).copy(), guard)
        packed = gzip.compress(texture, compresslevel=9, mtime=0)
        (DEST / f'{key["id"]}.rgbm.gz').write_bytes(packed)
        entry = {k: v for k, v in info.items() if k not in ('rawSHA256', 'seconds', 'max')}
        entry.update(id=key['id'], path=f'interiores/{TYPOLOGY}/luz-horario/{key["id"]}.rgbm.gz', bytes=len(packed),
                     sha256=sha(packed), compression='gzip', decodedBytes=len(texture), decodedSHA256=sha(texture), peak=peak)
        probe_raw = (RAW / f'{key["id"]}-sondas.f32').read_bytes()
        if sha(probe_raw) != info['probesSHA256']:
            raise RuntimeError(f'{key["id"]}: sondas diferentes do registrado')
        volume = encode_probes(probe_raw, spec, rooms, dims); probe_packed = gzip.compress(volume, compresslevel=9, mtime=0)
        (DEST / f'{key["id"]}-sondas.bin.gz').write_bytes(probe_packed)
        entry.pop('probesSHA256', None)
        entry['probes'] = {'id': key['id'] + '-sondas', 'path': f'interiores/{TYPOLOGY}/luz-horario/{key["id"]}-sondas.bin.gz',
                           'bytes': len(probe_packed), 'sha256': sha(probe_packed), 'compression': 'gzip',
                           'decodedBytes': len(volume), 'decodedSHA256': sha(volume)}
        entries.append(entry)
        print(key['id'], len(packed), len(probe_packed), round(peak, 3), flush=True)
    manifest = {'schema': 'liv-interior-time-lightmaps-v1', 'typology': TYPOLOGY,
                'sourceSHA256': measured['sourceSHA256'], 'geometrySHA256': measured['geometrySHA256'],
                'blendSHA256': measured['blendSHA256'], 'targets': measured['targets'],
                'date': keys['date'], 'hours': keys['hours'],
                'width': size, 'height': size, 'samples': measured['samples'], 'encoding': 'linear-rgbm2-u8',
                'compression': 'gzip', 'origin': 'bottom-left', 'range': RANGE,
                'lightMapIntensity': 1 / measured['v1'], 'exposureEV': measured['exposureEV'],
                'note': 'Dia: céu sem disco (direto+rebatido) + rebatido do sol medido; o sol direto é do site. '
                        'Noite: rebatido dos plafons do site. sunIrradianceRGB em W/m² do Blender, antes da exposição.',
                'probes': {**dims, 'encoding': 'rgba-float16', 'faceOrder': spec['faceOrder'], 'rooms': rooms, 'roomMap': room_map(spec)},
                'keys': [e for e in entries if e['kind'] == 'dia'], 'night': next(e for e in entries if e['kind'] == 'noite')}
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print('LIV_LUZ_HORARIO_EMPACOTADA', sum(e['bytes'] + e['probes']['bytes'] for e in entries), flush=True)


if __name__ == '__main__':
    main()
