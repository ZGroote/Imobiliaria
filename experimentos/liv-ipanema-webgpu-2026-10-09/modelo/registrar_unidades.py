"""Recorta as zonas ilustrativas do piloto pelo contorno da própria edição.

Conserva ordem/IDs da prancha, sem atribuir áreas, tipologias ou números comerciais.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from contorno import Outline

OWN = Path(__file__).resolve().parent
EXP = OWN.parent
ROOT = OWN.parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ring(poly):
    assert poly.geom_type == 'Polygon' and poly.is_valid and not poly.interiors
    return [[round(x, 5), round(z, 5)] for x, z in orient(poly, sign=1).exterior.coords[:-1]]


def build(edition='contorno'):
    if edition not in ['contorno','entrada']:
        raise ValueError('Edição de registro inválida.')
    original = EXP / 'unidades.json'
    model_path = OWN / ('entrada/candidato/modelo.json' if edition=='entrada' else 'variante/modelo.json')
    outline = Outline(OWN / 'contorno-torre.json', ROOT)
    model = json.loads(model_path.read_text('utf-8'))
    data = json.loads(original.read_text('utf-8'))
    assert data['sourceModelSHA256'] == '89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919'
    assert digest(EXP / data['source']['imagePath']) == data['source']['imageSHA256']
    assert model['metadata']['outlineSHA256'] == digest(outline.path)
    # Independently read the authored slab's top triangles, rather than trusting
    # a reassigned edition hash on the old rectangular selection boxes.
    groups = [g for g in model['groups'] if g['tower'] == 0 and g['role'] == 'lajes']
    assert len(groups) == 1
    group = groups[0]
    assert sorted(i['floor'] for i in group['instances']) == list(range(18))
    geo = model['geometries'][group['geometry']]
    pos = np.array(geo['position']).reshape(-1, 3)
    triangles = pos[np.array(geo['index']).reshape(-1, 3)]
    top = triangles[np.all(np.isclose(triangles[:, :, 1], .17, atol=1e-5), axis=1)]
    slab = unary_union([Polygon(tri[:, [0, 2]]) for tri in top])
    assert slab.is_valid and slab.geom_type == 'Polygon'
    footprint = Polygon([[round(x, 5), round(z, 5)] for x, z in outline.points])
    assert slab.symmetric_difference(footprint).area < 1e-6
    data['schema'] = 'liv-pilot-units-v2'
    data['sourceModelSHA256'] = digest(model_path)
    data['selectionEnvelope'] = {'footprint': ring(footprint), 'minY': 0, 'maxY': 48.45}
    registration = data['registration']
    registration['method'] += ' Zonas recortadas pelo contorno da laje desta edição.'
    registration['depthRule'] = 'Ímpares z negativo, pares z positivo; faixa central de 0,32 m e núcleo excluídos; recorte pelo contorno da laje.'
    registration['limitations'][1] = 'Zonas seguem o contorno reconstruído, sem comprovar divisórias; continuidade vertical dos recuos é uma hipótese.'
    registration['sources'] = {p.relative_to(ROOT).as_posix(): digest(p) for p in
                               [original, model_path, outline.path, OWN / 'contorno.py', Path(__file__)]}
    polygons = []
    for unit in data['units']:
        a, b = unit['bounds']['min'], unit['bounds']['max']
        zone = footprint.intersection(box(a[0], a[2], b[0], b[2]))
        if zone.geom_type == 'GeometryCollection':
            # At the excluded core, clipping can also return a zero-area line.
            # It is not part of an apartment interaction volume.
            parts = [part for part in zone.geoms if part.geom_type == 'Polygon']
            assert len(parts) == 1 and all(part.area == 0 for part in zone.geoms if part.geom_type != 'Polygon')
            zone = parts[0]
        assert zone.area > 0 and zone.geom_type == 'Polygon'
        unit['footprint'] = ring(zone)
        zone = Polygon(unit['footprint'])
        x0, z0, x1, z1 = zone.bounds
        unit['bounds'] = {'min': [x0, a[1], z0], 'max': [x1, b[1], z1]}
        x = (x0 + x1) / 2
        sign = 1 if unit['side'] == 'lazer' else -1
        unit['pickPoint'] = [round(x, 5), 4.35, round(outline.face(x, sign), 5)]
        polygons.append(zone)
    assert all(a.intersection(b).area == 0 for i, a in enumerate(polygons) for b in polygons[i+1:])
    return data


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--edicao',choices=['contorno','entrada'],default='contorno')
    args=parser.parse_args()
    output = OWN / ('entrada/unidades-entrada.json' if args.edicao=='entrada' else 'unidades-contorno.json')
    output.write_text(json.dumps(build(args.edicao), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(output), 'sha256': digest(output), 'units': 10}))
