"""Monta a cena do visualizador WebGPU do LIV (schema liv-exterior-proof-v1) a partir do modelo.

Faz em Python o que a página antiga do LIV fazia no navegador (liv-lightmap.js + exportar_cena.py):
grupos com luz gravada viram uma malha por material/torre com UV de luz por instância; vidro, metal e
vegetação ficam como instâncias. Saída em ../assets/: scene.json.gz, irradiance.rgbm.gz, manifest.json.

Rode depois de preparar_luz.py, bake_luz.py e denoise_luz.py (v1.5/miniaturas/liv-ipanema).
python experimentos/laranjeiras-2026-10-30/modelo/exportar_cena.py
"""
import base64
import gzip
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
LUZ = AQUI/'luz'
SAIDA = AQUI.parent/'assets'


def sha(b):
    return hashlib.sha256(b).hexdigest()


def enc(a):
    a = np.ascontiguousarray(a)
    tipo = {np.float32: 'Float32Array', np.uint32: 'Uint32Array', np.uint16: 'Uint16Array'}[a.dtype.type]
    return {'type': tipo, 'base64': base64.b64encode(a.tobytes()).decode('ascii'), 'length': int(a.size)}


def attr(a, item):
    return {**enc(a), 'itemSize': item, 'normalized': False}


def material(nome, m, baked):
    return {'name': 'MAT-'+nome, 'type': 'MeshStandardMaterial', 'baked': baked,
            'color': [float(v) for v in m['color']], 'emissive': [0, 0, 0], 'normalScale': [1, 1],
            'roughness': float(m['roughness']), 'metalness': float(m['metalness']), 'opacity': 1,
            'transparent': False, 'side': 0, 'depthWrite': True, 'depthTest': True, 'alphaTest': 0,
            'vertexColors': False, 'emissiveIntensity': 0, 'envMapIntensity': .8, 'flatShading': False,
            'polygonOffset': False, 'polygonOffsetFactor': 0, 'polygonOffsetUnits': 0, 'blending': 1,
            'visible': True, 'toneMapped': True}


def vista(tipo, alvo, th, ph, r, fov=34, **extra):
    d = (math.sin(th)*math.sin(ph), math.cos(ph), math.cos(th)*math.sin(ph))
    pos = [alvo[i]+d[i]*r for i in range(3)]
    v = {'type': tipo, 'fov': fov, 'near': .5, 'far': 2000, 'zoom': 1, 'left': None, 'right': None, 'top': None,
         'bottom': None, 'aspect': 1.6, 'position': pos, 'target': list(alvo), 'up': [0, 1, 0],
         'quaternion': [0, 0, 0, 1], 'orbit': {'r': r, 'th': th, 'ph': ph}}
    v.update(extra)
    return v


AREA = {('canto', False): 39.12, ('meio', False): 40.79, ('canto', True): 60.11, ('meio', True): 54.17}


def cadastro(md, sha_modelo):
    """312 apartamentos: caixa de clique em coordenadas da web (x, altura, z), por torre/pavimento/final."""
    X0, Y0 = md['envelope_local']
    lv, laje = md['floorHeight'], md['laje']
    folga = .15               # a caixa da torre envolve a face externa da parede

    def mundo(t, lx, ly):     # coordenada da torre -> web (x, z); Torre 02 girada 90° (ver modelar_laranjeiras.py)
        cx, cy = t['centro']
        return (cx+ly, cy-lx) if t['girada'] else (cx+lx, cy+ly)

    def caixa(t, x0, y0, x1, y1, f0, f1):
        a, b = mundo(t, x0, y0), mundo(t, x1, y1)
        return {'min': [round(min(a[0], b[0]), 4), round(f0, 4), round(min(a[1], b[1]), 4)],
                'max': [round(max(a[0], b[0]), 4), round(f1, 4), round(max(a[1], b[1]), 4)]}

    def direcao(t, nx, ny):
        x, z = mundo({**t, 'centro': [0, 0]}, nx, ny)
        return ('+' if x+z > 0 else '-')+('x' if abs(x) > abs(z) else 'z')

    torres, units = [], []
    for ti, t in enumerate(md['torres_arq']):
        torres.append({'id': t['id'], 'nome': t['nome'],
                       'bounds': caixa(t, -X0-folga, -Y0-folga, X0+folga, Y0+folga, 0, md['floors']*lv)})
        for f in range(md['floors']):
            for final, u in sorted(md['unidades_local'].items()):
                x0, y0, x1, y1 = u['ret']
                # Lado da fachada comprida = fileira; a caixa vai até a face externa da torre.
                y0, y1 = (-Y0-folga, y1) if y1 < 0 else (y0, Y0+folga)
                if abs(abs(x0)-X0) < .3: x0 = -X0-folga
                if abs(abs(x1)-X0) < .3: x1 = X0+folga
                dirc = direcao(t, 0, -1 if (y0+y1) < 0 else 1)
                terreo = f == 0
                units.append({
                    'id': f'laranjeiras/{t["id"]}/pavimento-{f:02d}/final-{final}', 'tower': t['id'], 'towerIndex': ti,
                    'towerName': t['nome'], 'final': final, 'floorIndex': f, 'side': f'{t["id"]}:{dirc}',
                    'sideLabel': 'Fachada de cima da implantação (SSE)' if (y0+y1) < 0 else 'Fachada da Rua José Quatrochi (NNO)',
                    'bounds': caixa(t, x0, y0, x1, y1, f*lv+laje, (f+1)*lv),
                    'typology': u['tipologia'], 'areaM2': AREA[(u['tipologia'], terreo)],
                    'garden': {'areaM2': round(AREA[(u['tipologia'], True)]-AREA[(u['tipologia'], False)], 2), 'confidence': 'book'} if terreo else None,
                    'relation': {'typology': u['tipologia'], 'orientation': 'original'},
                    'positionConfidence': 'inferido', 'commercialNumber': None, 'availability': 'nao_informada',
                    'price': None, 'parking': None})
    return {'schema': 'laranjeiras-units-v1', 'floorIndex': None, 'sourceModelSHA256': sha_modelo,
            'floors': md['floors'], 'towers': torres, 'units': units,
            'source': {'label': 'Book digital ADN, Parque das Laranjeiras', 'pages': [9, 12, 14, 16]},
            'relationStatus': 'fornecido', 'relationSource': {'label': 'implantação do book da ADN (p. 12)', 'asOf': '2026-10-05'},
            'limitations': ['Posição de cada final pela implantação do book; numeração comercial não informada.',
                            'Canto = finais 01, 02, 07, 08; meio = 03 a 06 (implantação, p. 12).',
                            'Área do térreo inclui o jardim privativo; o meio do térreo é "de até" 54,17 m².']}


def main():
    modelo_bytes = (AQUI/'modelo.json').read_bytes()
    modelo = json.loads(modelo_bytes)
    luz = json.loads((LUZ/'manifest.json').read_text(encoding='utf-8'))
    compact = json.loads((LUZ/'geometry-compact.json').read_bytes())
    if luz['sourceSHA256'] != sha(modelo_bytes) or compact['sourceSHA256'] != sha(modelo_bytes):
        raise SystemExit('A luz gravada é de outra versão do modelo.json: refazer preparar_luz/bake.')
    atlas_gz = (LUZ/Path(luz['textureURL']).name).read_bytes()
    if sha(gzip.decompress(atlas_gz)) != luz['textureSHA256']:
        raise SystemExit('Atlas RGBM corrompido.')

    geometries, materials, meshes = [], [], []
    mat_ids = {}

    def mat_id(nome, baked):
        k = (nome, baked)
        if k not in mat_ids:
            mat_ids[k] = len(materials)
            materials.append(material(nome.removeprefix('MAT-'), modelo['materials'][nome], baked))
        return mat_ids[k]

    pavimentos = sorted({i['floor'] for g in modelo['groups'] for i in g['instances'] if i['floor'] >= 0})
    baked = {b['groupIndex']: b for b in compact['groups']}
    # 1) Luz gravada: expande as instâncias (posição de mundo + UV de luz próprio) e junta por material/torre.
    baldes = {}
    for gi, b in baked.items():
        g = modelo['groups'][gi]
        geo = modelo['geometries'][g['geometry']]
        pos = np.asarray(geo['position'], np.float64).reshape(-1, 3)
        nor = np.asarray(geo['normal'], np.float64).reshape(-1, 3)
        uv = np.asarray(geo['uv'], np.float64).reshape(-1, 2)
        idx = np.asarray(b['indices'], np.int64)
        for inst in b['instances']:
            src = g['instances'][inst['instanceIndex']]
            M = np.asarray(src['matrix'], np.float64).reshape(4, 4).T
            N = np.linalg.inv(M[:3, :3]).T
            p = (np.c_[pos[idx], np.ones(len(idx))] @ M.T)[:, :3]
            n = nor[idx] @ N.T
            n /= np.linalg.norm(n, axis=1, keepdims=True)+1e-12
            u1 = np.frombuffer(base64.b64decode(inst['uv1U16']), '<u2').reshape(-1, 2)/compact['uvScale']
            k = (g['material'], g['tower'])
            baldes.setdefault(k, []).append((p, n, uv[idx], u1, src['floor'], gi, inst['instanceIndex'], g['role']))
    for (nome, torre), itens in baldes.items():
        P = np.concatenate([i[0] for i in itens]).astype(np.float32)
        Nn = np.concatenate([i[1] for i in itens]).astype(np.float32)
        U = np.concatenate([i[2] for i in itens]).astype(np.float32)
        U1 = np.concatenate([i[3] for i in itens]).astype(np.float32)
        F = np.concatenate([np.full(len(i[0]), i[4], np.float32) for i in itens])
        ranges, off = [], 0
        for p, _, _, _, floor, gi, ii, _ in itens:
            ranges.append({'floor': floor, 'start': off, 'count': len(p), 'instanceIndex': ii, 'groupIndex': gi})
            off += len(p)
        geometries.append({'attributes': {'position': attr(P, 3), 'normal': attr(Nn, 3), 'uv': attr(U, 2),
                                          'uv1': attr(U1, 2), 'livFloorIndex': attr(F, 1)},
                           'index': None, 'groups': [], 'drawRange': {'start': 0, 'count': None}})
        meshes.append({'name': f'LARANJEIRAS / {nome} / torre {torre}', 'geometry': len(geometries)-1,
                       'material': mat_id(nome, True), 'matrix': list(np.eye(4).flatten()),
                       'castShadow': True, 'receiveShadow': True, 'renderOrder': 0,
                       'userData': {'tower': torre, 'role': itens[0][7], 'livBakedTransport': True,
                                    'livPavimentos': pavimentos if torre >= 0 else [], 'livFloorRanges': ranges},
                       'instances': None})
    # 2) Sem luz gravada (vidro, esquadria, árvore, guarda-corpo metálico): instâncias com luz dinâmica.
    for gi, g in enumerate(modelo['groups']):
        if gi in baked:
            continue
        geo = modelo['geometries'][g['geometry']]
        geometries.append({'attributes': {'position': attr(np.asarray(geo['position'], np.float32), 3),
                                          'normal': attr(np.asarray(geo['normal'], np.float32), 3),
                                          'uv': attr(np.asarray(geo['uv'], np.float32), 2)},
                           'index': {**enc(np.asarray(geo['index'], np.uint32)), 'itemSize': 1, 'normalized': False},
                           'groups': [], 'drawRange': {'start': 0, 'count': None}})
        mats = np.asarray([i['matrix'] for i in g['instances']], np.float32).reshape(-1)
        meshes.append({'name': f'Blender / {g["geometry"]} / torre {g["tower"]}', 'geometry': len(geometries)-1,
                       'material': mat_id(g['material'], False), 'matrix': list(np.eye(4).flatten()),
                       'castShadow': True, 'receiveShadow': True, 'renderOrder': 0,
                       'userData': {'tower': g['tower'], 'role': g['role'],
                                    'livPavimentos': pavimentos if g['tower'] >= 0 else []},
                       'instances': {'count': len(g['instances']), 'matrix': attr(mats, 16), 'color': None}})

    mins, maxs = np.full(3, np.inf), np.full(3, -np.inf)
    for g in modelo['groups']:
        p = np.asarray(modelo['geometries'][g['geometry']]['position'], np.float64).reshape(-1, 3)
        for inst in g['instances']:
            M = np.asarray(inst['matrix'], np.float64).reshape(4, 4).T
            w = (np.c_[p, np.ones(len(p))] @ M.T)[:, :3]
            mins, maxs = np.minimum(mins, w.min(0)), np.maximum(maxs, w.max(0))
    centro = ((mins+maxs)/2).tolist()
    centro[1] = 14.0
    raio = float(np.linalg.norm(maxs-mins))/2
    md = modelo['metadata']
    # Sol na mesma direção do bake (bake_luz.py grava com o sol do LIV em (-18, 110, 55)).
    lights = [
        {'type': 'DirectionalLight', 'color': [1, .888, .723], 'groundColor': None, 'intensity': luz.get('sunIntensity', 2.4),
         'position': luz.get('sunWebPosition', [-18, 110, 55]), 'target': luz.get('sunWebTarget', [0, 22, 0]), 'castShadow': True,
         'shadow': {'bias': -.0004, 'normalBias': .02, 'mapSize': [2048, 2048],
                    'camera': {'left': -raio, 'right': raio, 'top': raio, 'bottom': -raio, 'near': 1, 'far': 400}}},
        {'type': 'DirectionalLight', 'color': [.429, .578, .823], 'groundColor': None, 'intensity': .75,
         'position': [-30, 21, -26], 'target': [0, 0, 0], 'castShadow': False, 'shadow': None},
        {'type': 'HemisphereLight', 'color': [.823, .871, .939], 'groundColor': [.0086, .0091, .0072], 'intensity': .55,
         'position': [0, 1, 0], 'target': None, 'castShadow': False, 'shadow': None},
    ]
    views = {
        'perspectiva': vista('PerspectiveCamera', centro, .58, 1.18, raio*2.2),
        'aerea': vista('PerspectiveCamera', centro, 1.05, .9, raio*2.4),
        'fachada': vista('PerspectiveCamera', [centro[0], 18, centro[2]], 0, 1.62, raio*2.0),
        'portaria': vista('PerspectiveCamera', [centro[0]-40, 12, maxs[2]-8], -.13, 1.62, 70, fov=60),
        'implantacao': vista('OrthographicCamera', centro, 0, 0, raio, fov=90, left=-raio*1.6, right=raio*1.6, top=raio, bottom=-raio),
    }
    data = {'schema': 'liv-exterior-proof-v1', 'sourceModelSHA256': sha(modelo_bytes), 'originalRuntime': 'laranjeiras-python',
            'geometries': geometries, 'materials': materials, 'textures': [], 'meshes': meshes, 'lights': lights,
            'visibleBounds': {'min': mins.tolist(), 'max': maxs.tolist()}, 'camera': views['perspectiva'],
            'canvasBounds': {}, 'renderer': {'exposure': 1.02, 'toneMapping': 4, 'pixelRatio': 1},
            'bake': {'ready': True, 'textureHashVerified': True, 'geometryHashVerified': True},
            'orbit': views['perspectiva']['orbit'], 'views': views,
            'rgbm': {**luz, 'textureURL': 'irradiance.rgbm.gz'},
            'empreendimento': {'nome': 'Parque das Laranjeiras', 'torres': md['towers'], 'pavimentos': md['floors'],
                               'unidades': md['units'], 'finais': md['finais'], 'loteGeo': md['lote_geo'],
                               'rumoCimaGraus': md['rumo_cima_graus'], 'loteCentroM': md['lote_centro_m']}}
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA/'irradiance.rgbm.gz').write_bytes(atlas_gz)
    cat = cadastro(md, data['sourceModelSHA256'])
    (SAIDA/'unidades.json').write_text(json.dumps(cat, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    encoded = json.dumps(data, ensure_ascii=True, separators=(',', ':')).encode()
    (SAIDA/'scene.json.gz').write_bytes(gzip.compress(encoded, compresslevel=6, mtime=0))
    files = {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
             for p in SAIDA.iterdir() if p.is_file() and p.name != 'manifest.json'}
    manifest = {'schema': 'liv-proof-manifest-v1', 'exportedAtUtc': datetime.now(timezone.utc).isoformat(),
                'sourceModelSHA256': data['sourceModelSHA256'], 'sceneJSONSHA256': sha(encoded), 'files': files,
                'meshCount': len(meshes), 'bakedMeshes': sum(m['instances'] is None for m in meshes),
                'exportPurpose': 'Parque das Laranjeiras: cena gerada direto do modelo.json, sem a página antiga.'}
    (SAIDA/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: manifest[k] for k in ('meshCount', 'bakedMeshes')} |
                     {'sceneMB': round(files['scene.json.gz']['bytes']/2**20, 1),
                      'atlasMB': round(files['irradiance.rgbm.gz']['bytes']/2**20, 1)}))


if __name__ == '__main__':
    main()
