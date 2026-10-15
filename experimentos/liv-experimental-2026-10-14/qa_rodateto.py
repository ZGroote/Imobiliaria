"""Confere todas as junções da moldura e preservação do restante dos interiores."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
sys.path.insert(0, str(EXP/'modelo'))
from qa_cobertura import section
from qa_paredes import surfaces, overlaps, closed


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    original = ROOT/'v1.5/miniaturas/liv-ipanema/interior/luz/source.json'
    repaired = EXP/'interiores/canto/source.json'
    before, after = [json.loads(p.read_bytes()) for p in [original, repaired]]
    assert before['unitSHA256'] == after['unitSHA256']
    assert all(before[k] == after[k] for k in ['height', 'rooms', 'lighting', 'materials', 'textures'])
    assert len(before['objects']) == len(after['objects'])
    shapes = []
    unchanged = 0
    for a, b in zip(before['objects'], after['objects']):
        if a['name'] != 'rodateto':
            assert a == b and before['geometries'][a['geometry']] == after['geometries'][b['geometry']]
            unchanged += 1
            continue
        p = np.array(before['geometries'][a['geometry']]['position']).reshape(-1, 3)
        m = np.array(a['matrix']).reshape(4, 4).T
        w = (np.c_[p, np.ones(len(p))]@m.T)[:, :3]
        shapes.append((Polygon(w[:, [0, 2]]).convex_hull, w[:, 1].min(), w[:, 1].max()))
    active = [o for o in after['objects'] if o['name'] == 'rodateto' and o['include']]
    assert len(active) == 1 and active[0]['matrix'] == [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    geo = after['geometries'][active[0]['geometry']]
    indices = geo.get('index') or list(range(len(geo['position'])//3))
    mesh = {'groups': [{'geometry': 'cobertura-rodateto'}],
            'geometries': {'cobertura-rodateto': dict(geo, index=indices)}}
    topology = closed(mesh, 'cobertura-')
    assert topology['nonManifoldEdges'] == topology['degenerateTriangles'] == 0, topology
    duplicate = overlaps(surfaces(mesh, 'cobertura-'))
    assert duplicate['overlappingTrianglePairs'] == 0, duplicate
    intersections = [a[0].intersection(b[0]).area for i,a in enumerate(shapes) for b in shapes[i+1:]
                     if min(a[2],b[2])-max(a[1],b[1]) > .01 and a[0].intersection(b[0]).area > 1e-7]
    assert len(intersections) == 40
    sections = []
    for height in [2.6175, 2.6449, 2.6451, 2.6725]:
        expected = unary_union([p for p,lo,hi in shapes if lo < height < hi])
        actual = section(mesh, height)
        delta = expected.symmetric_difference(actual).area
        assert delta < 2e-5, (height, delta)
        sections.append({'height':height, 'symmetricDifferenceMeters2':delta, 'areaMeters2':actual.area,
                         'components':len(actual.geoms) if hasattr(actual,'geoms') else 1})
    p = np.array(geo['position']).reshape(-1, 3)[np.array(indices).reshape(-1, 3)]
    volume = np.einsum('ij,ij->i', p[:,0], np.cross(p[:,1],p[:,2])).sum()/6
    expected_volume = .055*sum(unary_union([p for p,lo,hi in shapes if lo < height < hi]).area for height in [2.6175,2.6725])
    assert abs(volume-expected_volume) < 2e-6 and volume > 0, (volume, expected_volume)
    meio = EXP/'interiores/meio/source.json'
    middle = json.loads(meio.read_bytes())
    assert digest(meio) == '677d11f09f5b86b81f1599ef15d64cbf109e51ca1abd40dbb991b844065bf188'
    assert not any(o['name']=='rodateto' and o['include'] for o in middle['objects'])
    assert sum(o['name']=='forro-original' for o in middle['objects']) == 1
    paths = [Path(__file__), EXP/'corrigir_rodateto.py', EXP/'modelo/unir_paredes.py',
             EXP/'modelo/qa_cobertura.py', EXP/'modelo/qa_paredes.py', original, repaired, meio]
    report = {'schema':'liv-ceiling-molding-qa-v1', 'status':'PASS', 'atUtc':datetime.now(timezone.utc).isoformat(),
              'beforeOverlappingVolumePairs':len(intersections), 'afterCoplanarOverlaps':duplicate,
              'topology':topology, 'volumeMeters3':float(volume), 'sections':sections,
              'canto':{'rawUnitPreserved':True, 'nonMoldingObjectsUnchanged':unchanged, 'originalStrips':30, 'activeMoldingMeshes':1},
              'meio':{'sourceUnchanged':True, 'moldingMeshes':0, 'ceilingMeshes':1},
              'sources':{p.relative_to(ROOT).as_posix():digest(p) for p in paths}}
    out = EXP/'evidencias/rodateto-geometria'; out.mkdir(parents=True,exist_ok=True)
    (out/'geometria.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps({k:report[k] for k in ['status','beforeOverlappingVolumePairs','topology','canto','meio']}))


if __name__ == '__main__':
    main()
