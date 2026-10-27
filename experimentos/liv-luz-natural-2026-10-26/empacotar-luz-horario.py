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
SPECKLE_FROM = 2.2  # m: da altura de porta e janela para cima


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hidden_wall_top(size, below=.04, across=3, down=5):
    """Parede acima do forro: a gravação não tem laje, esse trecho via o céu (100x a luz de dentro) e o OIDN e o
    bilinear desciam o claro e o azul para a junta com o teto. Cada texel da parede acima de pé-direito - below
    recebe a média de uma janela da mesma face logo abaixo do corte (2*across+1 texels de largura, down de altura):
    copiar um texel só repetia o ruído dele na vertical e o OIDN guardava como listra. Depois a borda (margin
    EXTEND do Cycles, que nos cantos da ilha ainda trazia o céu) refaz a cópia do coberto mais próximo, já corrigido.
    4 cm ficam atrás do rodateto (5 cm) nas duas plantas. Devolve (destinos, origens [n, k, 2], pesos [n, k])."""
    web = ROOT.parent / 'liv-experimental-2026-10-14'
    record = json.loads((web / 'interiores/catalogo.json').read_text(encoding='utf8'))['tipologias'][TYPOLOGY]
    source = json.loads((web / f'interiores/{TYPOLOGY}/source.json').read_text(encoding='utf8'))
    compact = json.loads(gzip.decompress((web / record['files']['compact']['path']).read_bytes()))
    top = json.loads((web / f'interiores/{TYPOLOGY}/unidade.json').read_text(encoding='utf8'))['planta']['pe_direito'] - below
    covered = np.zeros((size, size), bool); band = np.zeros((size, size), bool); dsts, origins = [], []
    window = np.array([(a, b) for a in range(-across, across + 1) for b in range(down)], np.float64)
    for rec in compact['objects']:
        so = source['objects'][rec['objectIndex']]; geo = source['geometries'][so['geometry']]
        m = np.asarray(so['matrix'], np.float64).reshape(4, 4).T
        p = np.asarray(geo['position'], np.float64).reshape(-1, 3); p = p @ m[:3, :3].T + m[:3, 3]
        tris = p[np.frombuffer(base64.b64decode(rec['indicesU32']), dtype='<u4').reshape(-1, 3)]
        uvs = np.frombuffer(base64.b64decode(rec['uv1U16']), dtype='<u2').astype(np.float64).reshape(-1, 3, 2) / 65535 * size
        for w, t in zip(tris, uvs):
            x0, y0 = np.floor(t.min(0)).astype(int).clip(0, size - 1); x1, y1 = np.ceil(t.max(0)).astype(int).clip(0, size - 1)
            e = np.array([t[1] - t[0], t[2] - t[0]]).T; det = np.linalg.det(e)
            if abs(det) < 1e-12:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
            b = np.linalg.solve(e, np.stack([gx.ravel() - t[0, 0], gy.ravel() - t[0, 1]]))
            inside = (b[0] >= 0) & (b[1] >= 0) & (b.sum(0) <= 1)
            ix, iy = gx.ravel()[inside].astype(int), gy.ravel()[inside].astype(int); covered[iy, ix] = True
            normal = np.cross(w[1] - w[0], w[2] - w[0]); normal /= np.linalg.norm(normal)
            if w[:, 1].max() <= SPECKLE_FROM or abs(normal[1]) > .5:
                continue  # baixo demais, forro ou topo da parede
            b = b[:, inside]; y = w[0, 1] + b[0] * (w[1, 1] - w[0, 1]) + b[1] * (w[2, 1] - w[0, 1]); high = y > top
            band[iy[~high & (y > SPECKLE_FROM)], ix[~high & (y > SPECKLE_FROM)]] = True
            if not high.any():
                continue
            up = np.array([0, 1, 0]) - normal[1] * normal; up /= np.linalg.norm(up); side = np.cross(up, normal)
            # A mesma face (o mapa afim do triângulo se estende ao quad), em texels por metro.
            j = e @ np.linalg.pinv(np.array([w[1] - w[0], w[2] - w[0]]).T)
            step_up, step_side = j @ up, j @ side
            # Um texel abaixo do corte: o centro do texel de origem não pode cair de novo acima dele.
            drop = max(.015, 1 / np.linalg.norm(step_up))
            base = np.stack([ix[high] + .5, iy[high] + .5], 1) + ((top - drop - y[high]) / up[1])[:, None] * step_up
            unit_up, unit_side = step_up / np.linalg.norm(step_up), step_side / np.linalg.norm(step_side)
            offsets = window[:, :1] * unit_side - window[:, 1:] * unit_up
            dsts.append(np.stack([iy[high], ix[high]], 1))
            origins.append(np.floor(base[:, None] + offsets[None]).astype(int).clip(0, size - 1)[..., ::-1])
    dst = np.concatenate(dsts); origin = np.concatenate(origins)
    hidden = np.zeros((size, size), bool); hidden[dst[:, 0], dst[:, 1]] = True
    # Só vale origem da MESMA ilha do UV1: em cima de porta e janela a face tem 5 texels de largura, e a janela
    # de ±3 caía na ilha vizinha do atlas (às vezes uma face de fora, ao sol) e acendia o canto embaixo do rodateto.
    islands = ndimage.label(covered)[0]
    weight = (covered[origin[..., 0], origin[..., 1]] & ~hidden[origin[..., 0], origin[..., 1]]
              & (islands[origin[..., 0], origin[..., 1]] == islands[dst[:, 0], dst[:, 1]][:, None]))
    weight[:, (across * down)] |= ~weight.any(1)  # sem vizinho válido: fica a origem logo abaixo
    _, near = ndimage.distance_transform_edt(~covered, return_indices=True)
    margin = ~covered & ndimage.binary_dilation(hidden, iterations=4)
    edge = np.argwhere(margin); edge_origin = np.stack([near[0][margin], near[1][margin]], 1)[:, None]
    print('PAREDE_ACIMA_DO_FORRO', TYPOLOGY, 'corte', round(top, 3), 'texels', len(dst), 'borda', len(edge),
          'origens por texel', round(float(weight.sum(1).mean()), 1), flush=True)
    return [(dst, origin, weight), (edge, edge_origin, np.ones(edge_origin.shape[:2], bool))], (band, islands)


def despeckle(image, speckle, radius=3, factor=2.5):
    """Pico isolado no alto da parede vira a mediana da vizinhança da mesma ilha. Em cima de porta e janela a cena de
    gravação tem fresta na junta com o forro (o site tapa com o reparo do topo e o rodateto, que ela não tem) e o céu
    acendia texels a 200x os vizinhos; céu e rebatido variam devagar na parede, pico assim é a fresta."""
    band, islands = speckle; ys, xs = np.nonzero(band); size = band.shape[0]
    lum = image[:, :, :3] @ np.array([.2126, .7152, .0722], np.float32)
    span = np.arange(-radius, radius + 1); dy, dx = [a.ravel() for a in np.meshgrid(span, span)]
    ny = np.clip(ys[:, None] + dy, 0, size - 1); nx = np.clip(xs[:, None] + dx, 0, size - 1)
    near = np.where((islands[ny, nx] == islands[ys, xs][:, None]) & (image[ny, nx, 3] > 0) & (lum[ny, nx] > 1e-6), lum[ny, nx], np.nan)
    median = np.nanmedian(near, axis=1); own = lum[ys, xs]
    hot = own > factor * median + 1e-3
    image[ys[hot], xs[hot], :3] *= (median[hot] / own[hot])[:, None]
    return int(hot.sum())


def fill(image, hidden):
    """Parede escondida = média ponderada das origens; borda = o coberto mais próximo (já preenchido)."""
    for dst, origin, weight in hidden:
        values = image[origin[..., 0], origin[..., 1], :3] * weight[..., None]
        image[dst[:, 0], dst[:, 1], :3] = values.sum(1) / weight.sum(1)[:, None]


def fill_holes(rgba, islands):
    """Texel dentro da ilha que o Cycles não gravou ou gravou preto (face estreita em cima de porta) copia o
    gravado mais próximo da mesma ilha. Antes ele saía preto no site e escurecia a mediana dos vizinhos."""
    # Preto exato também é buraco: a face entra em outra peça na cena de gravação (junta de porta e parede).
    baked = (rgba[:, :, 3] > 0) & (rgba[:, :, :3].max(axis=2) > 1e-6); holes = (islands > 0) & ~baked
    _, near = ndimage.distance_transform_edt(~baked, return_indices=True)
    ys, xs = np.nonzero(holes); sy, sx = near[0][ys, xs], near[1][ys, xs]
    same = islands[sy, sx] == islands[ys, xs]
    rgba[ys[same], xs[same], :3] = rgba[sy[same], sx[same], :3]; rgba[ys[same], xs[same], 3] = 1
    return int(same.sum())


def encode(rgba, guard, hidden, speckle):
    holes = fill_holes(rgba, speckle[1]); fill(rgba, hidden); spikes = despeckle(rgba, speckle)
    mask = rgba[:, :, 3] > 0
    distance, nearest = ndimage.distance_transform_edt(~mask, return_indices=True)
    border = (~mask) & (distance <= guard)
    rgb = np.ascontiguousarray(rgba[:, :, :3]); rgb[border] = rgba[nearest[0][border], nearest[1][border], :3]
    denoised = oidn_filter(rgb, OIDN); denoised[~mask] = 0
    fill(denoised, hidden)
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
    return encoded.tobytes(), float(denoised.max()), (holes, spikes)


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
    hidden, speckle = hidden_wall_top(size)
    entries = []
    for key in [*keys['keys'], {'id': 'noite'}]:
        info = measured['keys'].get(key['id'])
        if not info:
            raise RuntimeError(f'Chave {key["id"]} ainda não foi gravada no Blender')
        raw = (RAW / f'{key["id"]}.f32').read_bytes()
        if sha(raw) != info['rawSHA256']:
            raise RuntimeError(f'{key["id"]}: bruto diferente do registrado')
        texture, peak, spikes = encode(np.frombuffer(raw, dtype=np.float32).reshape(size, size, 4).copy(), guard, hidden, speckle)
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
        print(key['id'], len(packed), len(probe_packed), round(peak, 3), 'buracos/picos', spikes, flush=True)
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
