"""Audit the actual LIV source before baking: shell normals and rug overlaps.

HouseMesh's wall/rodape mesh has outward winding, unlike Openings.pecaOr,
whose DoubleSide boxes have outward normals and inward winding. The shell
check is deliberately restricted to the explicit wall slot supplied here;
it does not negate normals or reinterpret all architecture meshes.
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np

HERE = Path(__file__).resolve().parent


def area(poly):
    if len(poly) < 3:
        return 0.
    p = np.asarray(poly)
    return abs(float(np.sum(p[:, 0] * np.roll(p[:, 1], -1) - p[:, 1] * np.roll(p[:, 0], -1)))) / 2


def intersection_area(a, b):
    """Convex triangle clipping in the XZ plane, with touching edges excluded."""
    def ccw(p):
        signed = np.sum(p[:, 0] * np.roll(p[:, 1], -1) - p[:, 1] * np.roll(p[:, 0], -1))
        return p if signed >= 0 else p[::-1]
    polygon = list(ccw(a)); clip = ccw(b)
    for i in range(3):
        if not polygon:
            return 0.
        edge_a, edge_b = clip[i], clip[(i + 1) % 3]
        edge = edge_b - edge_a
        def side(p):
            delta = p - edge_a
            return edge[0] * delta[1] - edge[1] * delta[0]
        new = []; previous = polygon[-1]; previous_side = side(previous)
        for current in polygon:
            current_side = side(current)
            if (current_side >= -1e-12) != (previous_side >= -1e-12):
                denominator = previous_side - current_side
                if abs(denominator) > 1e-20:
                    new.append(previous + (current - previous) * previous_side / denominator)
            if current_side >= -1e-12:
                new.append(current)
            previous, previous_side = current, current_side
        polygon = new
    return area(polygon)


def audit(source, wall_slot=0):
    walls = []; rugs = []
    for oi, obj in enumerate(source['objects']):
        if not obj.get('include', True):
            continue
        geometry = source['geometries'][obj['geometry']]
        positions = np.asarray(geometry['position'], dtype=np.float64).reshape(-1, 3)
        normals = np.asarray(geometry['normal'], dtype=np.float64).reshape(-1, 3)
        indices = np.asarray(geometry.get('index') or range(len(positions)), dtype=np.int64).reshape(-1, 3)
        triangles = positions[indices]
        cross = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        magnitude = np.linalg.norm(cross, axis=1)
        good = magnitude > 1e-10
        unit_cross = cross / np.maximum(magnitude[:, None], 1e-30)
        average_normal = normals[indices].mean(axis=1)
        dot = np.einsum('ij,ij->i', unit_cross, average_normal)
        if obj['slot'] == wall_slot and obj.get('kind') == 'architecture':
            vertical = good & (abs(unit_cross[:, 1]) < 1e-4) & (abs(average_normal[:, 1]) < 1e-4)
            bad = vertical & (dot < -.1)
            walls.append({'objectIndex': oi, 'slot': obj['slot'], 'name': obj['name'],
                          'verticalTriangles': int(vertical.sum()), 'opposedVerticalNormals': int(bad.sum()),
                          'affectedTrianglesFirst20': np.flatnonzero(bad)[:20].tolist(),
                          'geometrySHA256': geometry['sha256']})
        material_names = [source['materials'][key]['name'] for key in obj['materials']]
        if not any('tapete' in name.lower() for name in material_names):
            continue
        matrix = np.asarray(obj['matrix'], dtype=np.float64).reshape(4, 4).T
        world = (np.c_[positions, np.ones(len(positions))] @ matrix.T)[:, :3]
        wt = world[indices]
        world_normals = average_normal @ np.linalg.inv(matrix[:3, :3])
        world_normals /= np.maximum(np.linalg.norm(world_normals, axis=1)[:, None], 1e-30)
        horizontal = good & (np.ptp(wt[:, :, 1], axis=1) < 1e-5) & (world_normals[:, 1] > .99)
        selected = np.flatnonzero(horizontal); overlaps = []; planes = {}
        for ti in selected:
            y = float(wt[ti, :, 1].mean()); key = f'{y:.5f}'
            planes.setdefault(key, {'y': y, 'triangleAreaSum': 0., 'triangles': 0})
            planes[key]['triangleAreaSum'] += area(wt[ti][:, [0, 2]])
            planes[key]['triangles'] += 1
        for ai, ti in enumerate(selected):
            a = wt[ti][:, [0, 2]]
            for tj in selected[ai + 1:]:
                if abs(float(wt[ti, :, 1].mean() - wt[tj, :, 1].mean())) > 1e-5:
                    continue
                b = wt[tj][:, [0, 2]]
                if np.any(np.minimum(a.max(0), b.max(0)) - np.maximum(a.min(0), b.min(0)) <= 1e-9):
                    continue
                overlap = intersection_area(a, b)
                if overlap > 1e-7:
                    overlaps.append({'triangles': [int(ti), int(tj)], 'areaSquareMeters': overlap,
                                     'worldY': float(wt[ti, :, 1].mean())})
        rugs.append({'objectIndex': oi, 'slot': obj['slot'], 'name': obj['name'], 'materialNames': material_names,
                     'geometrySHA256': geometry['sha256'], 'worldBounds': [world.min(0).tolist(), world.max(0).tolist()],
                     'horizontalTopTriangles': len(selected), 'topPlanes': list(planes.values()),
                     'coplanarOverlapPairs': len(overlaps), 'coplanarPairAreaSumSquareMeters': sum(x['areaSquareMeters'] for x in overlaps),
                     'overlaps': overlaps})
    bad_normals = sum(item['opposedVerticalNormals'] for item in walls)
    rug_overlap = sum(item['coplanarOverlapPairs'] for item in rugs)
    return {'status': 'PASS' if walls and rugs and bad_normals == 0 and rug_overlap == 0 else 'FAIL',
            'shell': walls, 'rugs': rugs, 'opposedShellVerticalNormals': bad_normals,
            'rugCoplanarOverlapPairs': rug_overlap,
            'criteria': {'shellSlot': wall_slot, 'verticalNormalYMax': 1e-4, 'opposedDotMax': -.1,
                         'rugHorizontalToleranceMeters': 1e-5, 'rugNormalYMin': .99,
                         'coplanarOverlapAreaMinSquareMeters': 1e-7},
            'scope': 'Wall mesh outward winding only; Openings inward winding/outward normals are intentionally excluded',
            'geometryModified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=HERE / 'luz/source.json')
    parser.add_argument('--out', type=Path, default=HERE / 'luz/audit-scene.json')
    parser.add_argument('--wall-slot', type=int, default=0)
    args = parser.parse_args(); raw = args.source.read_bytes(); source = json.loads(raw)
    result = dict(audit(source, args.wall_slot), sourceSHA256=hashlib.sha256(raw).hexdigest(), unitSHA256=source['unitSHA256'])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2), encoding='utf8')
    print('LIV_INTERIOR_SCENE_AUDIT', json.dumps({key: value for key, value in result.items() if key not in ('shell', 'rugs')}))


if __name__ == '__main__':
    main()
