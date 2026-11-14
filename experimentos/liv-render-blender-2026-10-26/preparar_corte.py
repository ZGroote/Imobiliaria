"""Gera somente as paredes da vista em corte usando a planta e aberturas originais."""
import json
from pathlib import Path
import shutil

from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent
UNIT = ROOT.parent / 'liv-sketchup-2026-10-26/fontes/unidade.json'
plan = json.loads(UNIT.read_text(encoding='utf-8'))['planta']
edges = []
for room in plan['comodos']:
    poly = room['poly']
    for a, b in zip(poly, poly[1:] + poly[:1]):
        edges.append(LineString([a, b]))
walls = unary_union([edge.buffer(.08, cap_style='square', join_style='mitre') for edge in edges])
openings = plan['portas'] + plan['janelas']
levels = sorted({0, 1.15} | {o['y0'] for o in openings if 0 < o['y0'] < 1.15})
slabs = []
for low, high in zip(levels, levels[1:]):
    current = walls
    for opening in openings:
        if not opening['y0'] <= (low + high) / 2 <= opening['y1']:
            continue
        x, y = opening['p']
        half = opening['largura'] / 2
        wall = opening['wallId'].rsplit('-', 1)[-1]
        gap = box(x - .11, y - half, x + .11, y + half) if wall in ('east', 'west') else box(x - half, y - .11, x + half, y + .11)
        current = current.difference(gap)
    slabs.append((low, high, current))

vertices, faces = [], []


def point(x, y, z):
    return [x - 4.25, 3.125 - y, z]


def cap(shape, z, reverse=False):
    if shape.is_empty:
        return
    for tri in constrained_delaunay_triangles(shape).geoms:
        coords = list(tri.exterior.coords)[:3]
        start = len(vertices)
        vertices.extend(point(x, y, z) for x, y in coords)
        faces.append([start, start + 2, start + 1] if reverse else [start, start + 1, start + 2])


for index, (low, high, shape) in enumerate(slabs):
    polys = [shape] if shape.geom_type == 'Polygon' else list(shape.geoms)
    for poly in polys:
        for ring in [poly.exterior, *poly.interiors]:
            coords = list(ring.coords)
            for a, b in zip(coords, coords[1:]):
                start = len(vertices)
                vertices.extend([point(*a, low), point(*b, low), point(*b, high), point(*a, high)])
                faces.append([start, start + 1, start + 2, start + 3])
    below = slabs[index - 1][2] if index else None
    above = slabs[index + 1][2] if index + 1 < len(slabs) else None
    cap(shape if below is None else shape.difference(below), low, reverse=True)
    cap(shape if above is None else shape.difference(above), high)

assert vertices and faces
out = ROOT / 'fontes/parede-corte.json'
out.write_text(json.dumps({'vertices': vertices, 'faces': faces, 'height': 1.15,
                           'wall_thickness': .16, 'rooms': len(plan['comodos']),
                           'source': str(UNIT)}, separators=(',', ':')), encoding='utf-8')
backup = ROOT / 'previas/v01'
backup.mkdir(exist_ok=True)
for path in (ROOT / 'previas').glob('LIV_*.png'):
    shutil.copy2(path, backup / path.name)
blend = ROOT / 'entrega/LIV_Ipanema_Render.blend'
if blend.exists() and not (backup / 'LIV_previa_v01.blend').exists():
    shutil.copy2(blend, backup / 'LIV_previa_v01.blend')
print('CORTE_LIMPO', len(vertices), 'vertices', len(faces), 'faces')
