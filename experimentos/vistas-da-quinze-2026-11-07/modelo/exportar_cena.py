"""Monta a cena do visualizador WebGPU do LIV (schema liv-exterior-proof-v1) a partir do modelo.

Faz em Python o que a página antiga do LIV fazia no navegador (liv-lightmap.js + exportar_cena.py):
grupos com luz gravada viram uma malha por material/torre com UV de luz por instância; vidro, metal e
vegetação ficam como instâncias. Saída em ../assets/: scene.json.gz, irradiance.rgbm.gz, manifest.json.

Rode depois de preparar_luz.py, bake_luz.py e denoise_luz.py (v1.5/miniaturas/liv-ipanema).
python experimentos/vistas-da-quinze-2026-11-07/modelo/exportar_cena.py
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


# Áreas das plantas (interiores/T0N/referencia.json; T03..T06 com o terraço, como os anúncios contam).
AREA = {'t01': 44.79, 't02': 31.53, 't03': 62.29, 't04': 77.65, 't05': 62.43, 't06': 71.1}
NOME = {'t01': '2 dormitórios', 't02': '1 dormitório', 't03': '2 dormitórios com terraço',
        't04': '2 dormitórios + escritório com terraço', 't05': '2 dormitórios com terraço', 't06': '2 dormitórios com terraço frontal'}
ALAS = {'sul': ('ala-sul', 'Ala sul', {'fora': '+z', 'patio': '-z'}),
        'leste': ('ala-leste', 'Ala leste', {'fora': '+x', 'patio': '-x'})}
LADO = {'+z': 'Fachada sul (fundos)', '-z': 'Fachada do pátio (norte)', '+x': 'Fachada leste (fundos)', '-x': 'Fachada do pátio (oeste)'}


def cadastro(md, sha_modelo):
    """258 apartamentos, do 3º ao 20º andar: caixa de clique em coordenadas da web (x, altura, z).

    Cada ala é uma "torre" do seletor do LIV (o clique acha a ala e depois o apartamento). floorIndex é o
    andar de verdade (3..20); os andares 0..2 são o embasamento (garagens), sem apartamento.
    """
    impl = json.loads((AQUI.parent/'implantacao'/'implantacao-m.json').read_text(encoding='utf-8'))
    cx, cz = md['origemM']
    h0, lv, a0, laje = md['baseHeight'], md['floorHeight'], md['firstFloor'], md['laje']
    topo = h0+(md['floors']-a0)*lv
    folga = .12

    def base(andar):
        return h0+(andar-a0)*lv

    torres = []
    for ala in md['alas']:
        tid, nome, _ = ALAS[ala['id']]
        x0, z0, x1, z1 = ala['caixa']
        torres.append({'id': tid, 'nome': nome, 'bounds': {'min': [round(x0-folga, 4), round(h0, 4), round(z0-folga, 4)],
                                                          'max': [round(x1+folga, 4), round(topo, 4), round(z1+folga, 4)]}})
    units = []
    for u in impl['unidades']:
        tid, nome, lados = ALAS[u['ala']]
        tip = u['tipologia'].lower()
        side = lados[u['lado']]
        x0, x1 = u['x'][0]-cx, u['x'][1]-cx
        z0, z1 = u['z'][0]-cz, u['z'][1]-cz
        units.append({
            'id': f'vistas-da-quinze/{tid}/pavimento-{u["andar"]:02d}/final-{u["final"]}', 'tower': tid,
            'towerIndex': next(i for i, t in enumerate(torres) if t['id'] == tid), 'towerName': nome,
            'final': u['final'], 'floorIndex': u['andar'], 'side': f'{tid}:{side}', 'sideLabel': LADO[side],
            'bounds': {'min': [round(x0-folga, 4), round(base(u['andar'])+laje, 4), round(z0-folga, 4)],
                       'max': [round(x1+folga, 4), round(base(u['andar'])+lv, 4), round(z1+folga, 4)]},
            'typology': tip, 'typologyLabel': NOME[tip], 'areaM2': AREA[tip],
            'terrace': u.get('terracoM') is not None,
            'garden': None, 'relation': {'typology': tip, 'orientation': 'original'},
            'positionConfidence': 'inferido', 'commercialNumber': f'{u["andar"]}{u["final"]}', 'availability': 'nao_informada',
            'price': None, 'parking': None})
    return {'schema': 'vistas-da-quinze-units-v1', 'floorIndex': None, 'sourceModelSHA256': sha_modelo,
            'floors': md['floors'], 'towers': torres, 'units': units,
            'source': {'label': 'Plantas, implantação e perspectiva numerada públicas do Grupo Plano', 'pages': []},
            'relationStatus': 'inferido', 'relationSource': {'label': 'perspectiva numerada por cor (anexo c5be99a0)', 'asOf': '2026-11-07'},
            'limitations': ['Posição de cada apartamento pela perspectiva numerada; a planta de cada cor é uma hipótese.',
                            'Número comercial = andar + final, como na perspectiva.',
                            'Áreas medidas nas plantas humanizadas, calibradas pelos 44,79 m² anunciados.']}


TEX = AQUI/'texturas'
# Material do modelo -> (cor, relevo, metros por repetição, extras). A UV das caixas sai em metros (flush do LIV).
TEXTURAS = {
    'site-grama': ('grama-cor.webp', 'grama-normal.webp', 2.0, {}),
    'site-piso': ('concreto-cor.webp', 'concreto-normal.webp', 2.5, {}),
    'madeira-terraco': (AQUI.parents[1]/'moveis-referencia/web/materiais/madeira_nature-cor-512.webp',
                        AQUI.parents[1]/'moveis-referencia/web/materiais/madeira_nature-nor-512.webp', 1.2, {}),
    # Cartões da copa (modelar_containers.arvore): UV 0..1 por cartão, recorte por alphaTest, os dois lados.
    'folhas-cartao': ('folhas.webp', None, 1.0, {'alphaTest': .5, 'side': 2}),
}


def texturizar(materials, modelo):
    """Põe cor e relevo dos materiais de TEXTURAS na cena (o renderer já lê data.textures). A cor do material vira
    (cor calibrada do modelo / média linear da textura): a média da superfície continua no tom de antes."""
    from PIL import Image
    textures, por_arquivo = [], {}

    def tex(caminho, srgb, metros):
        caminho = Path(caminho) if Path(caminho).is_absolute() else TEX/caminho
        k = (caminho.name, metros)
        if k not in por_arquivo:
            nome = 'tex-'+caminho.name
            (SAIDA/nome).write_bytes(caminho.read_bytes())
            por_arquivo[k] = len(textures)
            textures.append({'url': nome, 'colorSpace': 'srgb' if srgb else '', 'premultiplyAlpha': False, 'channel': 0,
                             'wrapS': 1000, 'wrapT': 1000, 'minFilter': 1008, 'magFilter': 1006, 'generateMipmaps': True,
                             'rotation': 0, 'anisotropy': 8, 'repeat': [1/metros, 1/metros], 'offset': [0, 0],
                             'center': [0, 0], 'flipY': False})
        return por_arquivo[k]

    def media(caminho):
        caminho = Path(caminho) if Path(caminho).is_absolute() else TEX/caminho
        px = np.asarray(Image.open(caminho).convert('RGBA'), np.float64).reshape(-1, 4)
        px = px[px[:, 3] > 0, :3]/255
        return np.where(px <= .04045, px/12.92, ((px+.055)/1.055)**2.4).mean(0).tolist()

    SAIDA.mkdir(parents=True, exist_ok=True)
    for spec in materials:
        nome = spec['name'].removeprefix('MAT-')
        if nome not in TEXTURAS:
            continue
        cor, relevo, metros, extras = TEXTURAS[nome]
        if 'alphaTest' in extras:            # folhas: a cor é a da própria textura
            spec['color'] = [.9, .9, .9]
        else:
            alvo, m = modelo['materials']['MAT-'+nome]['color'], media(cor)
            spec['color'] = [round(min(a/b, 4), 4) for a, b in zip(alvo, m)]
        spec['map'] = tex(cor, True, metros)
        if relevo:
            spec['normalMap'] = tex(relevo, False, metros)
            spec['normalScale'] = [1, 1]
        spec.update(extras)
    return textures


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
        meshes.append({'name': f'VISTAS / {nome} / torre {torre}', 'geometry': len(geometries)-1,
                       'material': mat_id(nome, True), 'matrix': list(np.eye(4).flatten()),
                       'castShadow': True, 'receiveShadow': True, 'renderOrder': 0,
                       'userData': {'tower': torre, 'role': itens[0][7], 'livBakedTransport': True,
                                    'livPavimentos': pavimentos if torre >= 0 else [], 'livFloorRanges': ranges},
                       'instances': None})
    # 2) Sem luz gravada (vidro, esquadria, árvore, guarda-corpo metálico): instâncias com luz dinâmica.
    # Grupos de uma instância só (o vidro e a água do spa de cada andar) são juntados por material/ala numa
    # malha só, com a matriz aplicada nos vértices: 36 malhas de vidro viram 2 chamadas de desenho.
    soltos = {}
    for gi, g in enumerate(modelo['groups']):
        if gi in baked or len(g['instances']) != 1:
            continue
        soltos.setdefault((g['material'], g['tower'], g['role']), []).append(g)
    for (nome, torre, role), gs in soltos.items():
        P, Nn, U, I, off = [], [], [], [], 0
        for g in gs:
            geo = modelo['geometries'][g['geometry']]
            M = np.asarray(g['instances'][0]['matrix'], np.float64).reshape(4, 4).T
            Nm = np.linalg.inv(M[:3, :3]).T
            pos = np.asarray(geo['position'], np.float64).reshape(-1, 3)
            nor = np.asarray(geo['normal'], np.float64).reshape(-1, 3) @ Nm.T
            P.append((np.c_[pos, np.ones(len(pos))] @ M.T)[:, :3])
            Nn.append(nor/(np.linalg.norm(nor, axis=1, keepdims=True)+1e-12))
            U.append(np.asarray(geo['uv'], np.float64).reshape(-1, 2))
            I.append(np.asarray(geo['index'], np.int64)+off)
            off += len(pos)
        geometries.append({'attributes': {'position': attr(np.concatenate(P).astype(np.float32), 3),
                                          'normal': attr(np.concatenate(Nn).astype(np.float32), 3),
                                          'uv': attr(np.concatenate(U).astype(np.float32), 2)},
                           'index': {**enc(np.concatenate(I).astype(np.uint32)), 'itemSize': 1, 'normalized': False},
                           'groups': [], 'drawRange': {'start': 0, 'count': None}})
        meshes.append({'name': f'Blender / {nome} / torre {torre} / juntado', 'geometry': len(geometries)-1,
                       'material': mat_id(nome, False), 'matrix': list(np.eye(4).flatten()),
                       'castShadow': True, 'receiveShadow': True, 'renderOrder': 0,
                       'userData': {'tower': torre, 'role': role, 'livPavimentos': pavimentos if torre >= 0 else []},
                       'instances': {'count': 1, 'matrix': attr(np.eye(4, dtype=np.float32).reshape(-1), 16), 'color': None}})
    for gi, g in enumerate(modelo['groups']):
        if gi in baked or len(g['instances']) == 1:
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
    centro[1] = 28.0     # meia altura da torre
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
    # Câmeras do lado do pátio e da esquina (noroeste: -x, -z), como os renders do site. O raio sai da torre e não
    # do terreno (o gramado de 150 m afastava a câmera).
    raio = 52.0
    views = {
        'perspectiva': vista('PerspectiveCamera', centro, -2.65, 1.2, raio*2.1),
        'aerea': vista('PerspectiveCamera', centro, -2.85, .85, raio*2.4),
        'fachada': vista('PerspectiveCamera', [centro[0], 24, centro[2]], -3.05, 1.45, raio*1.9),
        'portaria': vista('PerspectiveCamera', [centro[0]-18, 10, centro[2]-14], -2.5, 1.45, 30, fov=55),
        'implantacao': vista('OrthographicCamera', centro, 0, 0, raio, fov=90, left=-raio*1.6, right=raio*1.6, top=raio, bottom=-raio),
    }
    textures = texturizar(materials, modelo)
    data = {'schema': 'liv-exterior-proof-v1', 'sourceModelSHA256': sha(modelo_bytes), 'originalRuntime': 'vistas-da-quinze-python',
            'geometries': geometries, 'materials': materials, 'textures': textures, 'meshes': meshes, 'lights': lights,
            'visibleBounds': {'min': mins.tolist(), 'max': maxs.tolist()}, 'camera': views['perspectiva'],
            'canvasBounds': {}, 'renderer': {'exposure': 1.02, 'toneMapping': 4, 'pixelRatio': 1},
            'bake': {'ready': True, 'textureHashVerified': True, 'geometryHashVerified': True},
            'orbit': views['perspectiva']['orbit'], 'views': views,
            'rgbm': {**luz, 'textureURL': 'irradiance.rgbm.gz'},
            'empreendimento': {'nome': 'Vistas da Quinze', 'torres': 1, 'pavimentos': md['floors'],
                               'unidades': md['units'], 'ancoraGeo': md['ancoraGeo'], 'origemM': md['origemM'],
                               'rumoCimaGraus': md['rumo_cima_graus']}}
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
                'exportPurpose': 'Vistas da Quinze: cena gerada direto do modelo.json.'}
    (SAIDA/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: manifest[k] for k in ('meshCount', 'bakedMeshes')} |
                     {'sceneMB': round(files['scene.json.gz']['bytes']/2**20, 1),
                      'atlasMB': round(files['irradiance.rgbm.gz']['bytes']/2**20, 1)}))


if __name__ == '__main__':
    main()
