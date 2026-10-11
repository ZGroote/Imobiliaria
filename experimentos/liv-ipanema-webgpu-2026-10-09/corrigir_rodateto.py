"""Une exclusivamente os 30 volumes de rodateto do snapshot original de canto.

Blender -b --factory-startup --python corrigir_rodateto.py
Não modifica o cadastro, paredes, mobiliário nem as fontes canônicas.
"""
from pathlib import Path
import hashlib
import json
import sys

import bpy
import numpy as np
from mathutils import Vector

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
sys.path.insert(0, str(EXP/'modelo'))
from unir_paredes import unite


def digest(data):
    return hashlib.sha256(data).hexdigest()


def geometry_hash(geo):
    arrays = [np.asarray(geo.get(k) or [], dtype='<f4') for k in ('position', 'normal', 'uv', 'color')]
    indices = np.asarray(geo.get('index') or [], dtype='<u4')
    return digest(np.asarray([a.size for a in arrays]+[indices.size], dtype='<u4').tobytes()+
                  b''.join(a.tobytes() for a in arrays)+indices.tobytes())


def main():
    original = ROOT/'v1.5/miniaturas/liv-ipanema/interior/luz/source.json'
    original_bytes = original.read_bytes()
    assert digest(original_bytes) == '270d61e914f9f3dfdb7a79327b694409b32ccb475c3187c92cf42490e8ae3fb6'
    source = json.loads(original_bytes)
    strips = [o for o in source['objects'] if o['name'] == 'rodateto' and o['include']]
    assert len(strips) == 30 and all(o['materials'] == ['m6'] for o in strips)
    assert not source['materials']['m6'].get('map') and not source['materials']['m6'].get('vertexColors')
    vertices, faces = [], []
    for o in strips:
        geo = source['geometries'][o['geometry']]
        p = np.array(geo['position']).reshape(-1, 3)
        m = np.array(o['matrix']).reshape(4, 4).T
        world = (np.c_[p, np.ones(len(p))]@m.T)[:, :3]
        ids = np.array(geo.get('index') or list(range(len(p)))).reshape(-1, 3)
        offset = len(vertices)
        vertices.extend(map(tuple, world))
        faces.extend(tuple(offset+int(i) for i in face) for face in ids)
    buckets = {'gesso': (vertices, faces)}
    report = unite(buckets, {'gesso': bpy.data.materials.new('gesso')}, 'rodateto-canto')
    vertices, faces = buckets['gesso']
    position, normal = [], []
    for ids in faces:
        a, b, c = [Vector(vertices[i]) for i in ids]
        n = (b-a).cross(c-a).normalized()
        for p in (a, b, c):
            position.extend(p)
            normal.extend(n)
    geometry = {'position': position, 'normal': normal, 'uv': [0.]*(len(position)//3*2),
                'color': None, 'index': None, 'groups': []}
    geometry['sha256'] = geometry_hash(geometry)
    source['geometries']['rodateto-unido'] = geometry
    strips[0].update(geometry='rodateto-unido', matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
    for o in strips[1:]:
        o.update(include=False, bake=False, visible=False)
    source['metadata']['moldingRepair'] = {
        'parentSourceSHA256': digest(original_bytes), 'originalSlots': [o['slot'] for o in strips],
        'activeSlot': strips[0]['slot'], 'union': report, 'rawUnitPreserved': True,
        'scope': 'Exact union of original perpendicular/collinear joins and touching stepped layers',
        'sources': {p.relative_to(ROOT).as_posix(): digest(p.read_bytes())
                    for p in [Path(__file__), EXP/'modelo/unir_paredes.py']}}
    out = EXP/'interiores/canto/source.json'
    out.write_bytes((json.dumps(source, ensure_ascii=False, separators=(',', ':'))+'\n').encode())
    print('LIV_MOLDINGS_UNION', json.dumps(dict(report, sourceSHA256=digest(out.read_bytes()))), flush=True)


if __name__ == '__main__':
    main()
