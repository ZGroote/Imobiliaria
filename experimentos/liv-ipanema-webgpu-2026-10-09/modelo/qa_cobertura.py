"""Mede os vãos da cobertura a partir das seções da malha exportada."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize, unary_union

from contorno import Outline

OWN = Path(__file__).resolve().parent
ROOT = OWN.parents[2]


def section(model, height):
    segments = []
    for group in model['groups']:
        if not group['geometry'].startswith('cobertura-'):
            continue
        g = model['geometries'][group['geometry']]
        p = np.array(g['position']).reshape(-1, 3)
        for tri in p[np.array(g['index']).reshape(-1, 3)]:
            hits = []
            for a, b in zip(tri, np.roll(tri, -1, axis=0)):
                if (a[1] < height < b[1]) or (b[1] < height < a[1]):
                    q = a + (b-a)*(height-a[1])/(b[1]-a[1])
                    hits.append(tuple(np.round(q[[0, 2]], 6)))
            if len(hits) == 2 and hits[0] != hits[1]:
                segments.append(hits)
    lines = unary_union([LineString(s) for s in segments])

    def inside(point):
        x, z = point.x, point.y
        crossings = 0
        for (ax, az), (bx, bz) in segments:
            if (az <= z < bz) or (bz <= z < az):
                crossings += ax + (z-az)*(bx-ax)/(bz-az) > x
        return crossings % 2 == 1

    return unary_union([p for p in polygonize(lines) if inside(p.representative_point())])


def measure(model, outline):
    # Cotas deliberadamente no interior das faixas, longe de planos coplanares.
    base = 17*2.85
    boundary = Polygon(outline.points)
    parapet = boundary.difference(boundary.buffer(-.25, join_style='mitre'))
    cap = boundary.buffer(.035, join_style='mitre').difference(boundary.buffer(-.285, join_style='mitre'))
    checks = []
    for label, height, expected in [('apoio', base+.25, parapet), ('faixa', base+.84, cap)]:
        actual = section(model, height)
        missing = expected.buffer(-2e-5).difference(actual.buffer(2e-5))
        checks.append({'name': label, 'height': height, 'missingAreaMeters2': missing.area,
                       'actualSectionAreaMeters2': actual.area, 'expectedPerimeterAreaMeters2': expected.area})
    return checks


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--saida', type=Path, default=OWN.parent/'evidencias/cobertura-geometria')
    args = ap.parse_args()
    paths = [OWN/'variante/luz/antes-cobertura/modelo.json', OWN/'variante/modelo.json']
    outline = Outline(OWN/'contorno-torre.json', ROOT)
    before, after = [measure(json.loads(p.read_bytes()), outline) for p in paths]
    assert all(c['missingAreaMeters2'] > .001 for c in before), before
    assert all(c['missingAreaMeters2'] < 1e-6 for c in after), after
    report = {'schema': 'liv-roof-sections-qa-v1', 'status': 'PASS',
              'atUtc': datetime.now(timezone.utc).isoformat(), 'before': before, 'after': after,
              'toleranceMeters': 2e-5, 'scope': 'All perimeter edges and convex/concave joins; taller core volumes may cover the ring',
              'sources': {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in [Path(__file__), OWN/'modelar_exterior.py', OWN/'contorno.py', outline.path, *paths]}}
    args.saida.mkdir(parents=True, exist_ok=True)
    (args.saida/'cobertura.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({'status': report['status'], 'before': before, 'after': after}))


if __name__ == '__main__':
    main()
