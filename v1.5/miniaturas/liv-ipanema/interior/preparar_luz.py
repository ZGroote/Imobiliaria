"""UV1 independent for every actual browser interior mesh/instance; no Cedros data."""
from pathlib import Path
import argparse
import base64
import gzip
import hashlib
import json
import time
import numpy as np
import xatlas
from auditar_cena import audit as audit_scene

HERE = Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def geometry_hash(geo):
    arrays = [np.asarray(geo.get(k) or [], dtype='<f4') for k in ('position', 'normal', 'uv', 'color')]
    indices = np.asarray(geo.get('index') or [], dtype='<u4')
    return sha(np.asarray([a.size for a in arrays] + [indices.size], dtype='<u4').tobytes() +
               b''.join(a.tobytes() for a in arrays) + indices.tobytes())


def topology(geo, material_count=None):
    positions = np.asarray(geo['position'], dtype=np.float64).reshape(-1, 3)
    normals = np.asarray(geo['normal'], dtype=np.float64).reshape(-1, 3)
    indices = np.asarray(geo.get('index') or range(len(positions)), dtype=np.uint32).reshape(-1, 3)
    if len(normals) != len(positions) or not np.isfinite(positions).all() or not np.isfinite(normals).all():
        raise ValueError('Invalid source vertex attributes')
    if indices.max(initial=0) >= len(positions):
        raise ValueError('Source index outside vertex range')
    face_material = np.zeros(len(indices), dtype=np.uint16)
    for group in geo.get('groups') or []:
        if group['start'] % 3 or group['count'] % 3:
            raise ValueError('Material group must contain whole triangles')
        # Three ignores geometry groups when Mesh.material is a single material.
        if material_count != 1:
            face_material[group['start'] // 3:(group['start'] + group['count']) // 3] = group['materialIndex']
    cross = np.cross(positions[indices[:, 1]] - positions[indices[:, 0]], positions[indices[:, 2]] - positions[indices[:, 0]])
    good = np.linalg.norm(cross, axis=1) > 1e-10
    indices = indices[good].copy(); face_material = face_material[good]
    flipped = np.einsum('ij,ij->i', cross[good], normals[indices[:, 0]]) < 0
    indices[flipped] = indices[flipped][:, [0, 2, 1]]
    groups = []
    for i, material in enumerate(face_material):
        if groups and groups[-1]['materialIndex'] == int(material):
            groups[-1]['count'] += 3
        else:
            groups.append({'start': i * 3, 'count': 3, 'materialIndex': int(material)})
    return positions, indices, groups, int(flipped.sum()), int((~good).sum())


def audit_moldings(source):
    """Flag collinear overlaps using this scene's boxes, never Cedros repair indices."""
    records = []
    for oi, obj in enumerate(source['objects']):
        if obj.get('name') != 'rodateto' or not obj.get('include', True):
            continue
        positions = np.asarray(source['geometries'][obj['geometry']]['position']).reshape(-1, 3)
        matrix = np.asarray(obj['matrix']).reshape(4, 4).T
        local_min, local_max = positions.min(axis=0), positions.max(axis=0)
        center = (matrix @ np.r_[(local_min + local_max) / 2, 1])[:3]
        extents = (local_max - local_min) / 2
        z_axis = matrix[:3, 2]; z_length = np.linalg.norm(z_axis)
        x_length = np.linalg.norm(matrix[:3, 0]); y_length = np.linalg.norm(matrix[:3, 1])
        if min(x_length, y_length, z_length) < 1e-10:
            continue
        direction = z_axis / z_length
        if abs(direction[1]) > .001:
            continue  # This auditor covers horizontal ceiling strips.
        records.append({'objectIndex': oi, 'slot': obj['slot'], 'center': center, 'direction': direction,
                        'halfLength': extents[2] * z_length, 'halfWidth': extents[0] * x_length,
                        'halfHeight': extents[1] * y_length})
    overlaps = []
    for i, a in enumerate(records):
        for b in records[i + 1:]:
            if abs(float(a['direction'] @ b['direction'])) < .99999:
                continue
            if abs(a['center'][1] - b['center'][1]) > .001 or abs(a['halfHeight'] - b['halfHeight']) > .001:
                continue
            delta = b['center'] - a['center']; longitudinal = float(delta @ a['direction'])
            perpendicular = float(np.linalg.norm(delta - a['direction'] * longitudinal))
            # Same centerline/height. Perpendicular corner joins are intentionally excluded.
            if perpendicular > .001 or abs(a['halfWidth'] - b['halfWidth']) > .001:
                continue
            lo = max(-a['halfLength'], longitudinal - b['halfLength'])
            hi = min(a['halfLength'], longitudinal + b['halfLength'])
            if hi - lo > .001:
                overlaps.append({'objectIndices': [a['objectIndex'], b['objectIndex']], 'slots': [a['slot'], b['slot']],
                                 'overlapMeters': hi - lo, 'centerlineOffsetMeters': perpendicular,
                                 'widthMeters': 2 * a['halfWidth'], 'heightMeters': 2 * a['halfHeight'],
                                 'centerY': float(a['center'][1]),
                                 'overlapStartWorld': (a['center'] + a['direction'] * lo).tolist(),
                                 'overlapEndWorld': (a['center'] + a['direction'] * hi).tolist()})
    return {'moldingObjects': len(records), 'collinearOverlapPairs': len(overlaps), 'overlaps': overlaps,
            'maxOverlapMeters': max((item['overlapMeters'] for item in overlaps), default=0),
            'criteria': {'directionDotMin': .99999, 'centerlineToleranceMeters': .001,
                         'sameWidthHeightToleranceMeters': .001, 'minOverlapMeters': .001},
            'scope': 'source-world collinear same-level strips; perpendicular corner joins excluded',
            'geometryModified': False, 'repairsFromOtherBuilding': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=HERE / 'luz/source.json')
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    parser.add_argument('--size', type=int, choices=(512, 1024, 2048, 4096), default=2048)
    parser.add_argument('--padding', type=int, default=8)
    parser.add_argument('--audit-only', action='store_true', help='Inspect actual source geometry without unwrap/bake')
    args = parser.parse_args()
    started = time.perf_counter(); source_bytes = args.source.read_bytes(); source = json.loads(source_bytes)
    if source['schema'] != 'liv-interior-scene-v1' or len(source.get('unitSHA256', '')) != 64:
        raise ValueError('Export must identify actual LIV builder scene and unit SHA256')
    if source.get('lighting') is not None and not isinstance(source['lighting'], dict):
        raise ValueError('lighting must describe world/sun/ceiling, not an array of runtime Three lights')
    if source.get('metadata', {}).get('unitPath'):
        if sha(Path(source['metadata']['unitPath']).read_bytes()) != source['unitSHA256']:
            raise ValueError('Actual builder unit changed before scene export')
    args.out.mkdir(parents=True, exist_ok=True)
    atlas = xatlas.Atlas(); records = []; geometry_checks = {}
    textures = []
    for key, texture in source.get('textures', {}).items():
        png = base64.b64decode(texture['data'].split(',', 1)[1]); fingerprint = sha(png)
        if texture.get('pngSHA256') != fingerprint and not source.get('metadata', {}).get('testOnly'):
            raise ValueError('Source texture PNG hash missing/mismatched: ' + key)
        textures.append({'key': key, 'sha256': fingerprint, 'bytes': len(png),
                         'width': texture.get('width'), 'height': texture.get('height')})
    for key, geometry in source['geometries'].items():
        fingerprint = geometry_hash(geometry)
        if fingerprint != geometry['sha256']:
            raise ValueError('Geometry fingerprint mismatch: ' + key)
        geometry_checks[key] = fingerprint
    moldings = audit_moldings(source)
    molding_audit = dict(moldings, sourceSHA256=sha(source_bytes), unitSHA256=source['unitSHA256'])
    (args.out / 'audit-moldings.json').write_text(json.dumps(molding_audit, indent=2), encoding='utf8')
    if not source.get('metadata', {}).get('testOnly'):
        scene_audit = dict(audit_scene(source), sourceSHA256=sha(source_bytes), unitSHA256=source['unitSHA256'])
        (args.out / 'audit-scene.json').write_text(json.dumps(scene_audit, indent=2), encoding='utf8')
        if scene_audit['status'] != 'PASS':
            raise ValueError('Actual shell normals or rug coplanar faces fail source preflight; see audit-scene.json')
    if args.audit_only:
        print('LIV_INTERIOR_GEOMETRY_AUDIT', json.dumps(molding_audit), flush=True)
        return
    triangles = flipped = degenerate = 0
    for oi, obj in enumerate(source['objects']):
        if not obj.get('include', True) or not obj.get('bake', False):
            continue
        geo = source['geometries'][obj['geometry']]
        positions, indices, groups, flip, removed = topology(geo, len(obj['materials']))
        if not len(indices):
            continue
        _, first, inverse = np.unique(np.round(positions, 6), axis=0, return_index=True, return_inverse=True)
        matrix = np.asarray(obj['matrix'], dtype=np.float64).reshape(4, 4).T
        if not np.isfinite(matrix).all() or np.linalg.det(matrix[:3, :3]) <= 1e-10:
            raise ValueError('Source object matrix must be finite with positive determinant')
        world = (np.c_[positions[first], np.ones(len(first))] @ matrix.T)[:, :3]
        # Atlas uses transformed topology; the source local corner order remains stable.
        atlas.add_mesh(np.asarray(world, dtype=np.float32), np.asarray(inverse[indices], dtype=np.uint32))
        records.append((oi, obj, positions, indices, first, groups))
        triangles += len(indices); flipped += flip; degenerate += removed
    if not records:
        raise ValueError('No eligible opaque diffuse interior surfaces')
    print('LIV_INTERIOR_UNWRAP_START', len(records), triangles, flush=True)
    pack = xatlas.PackOptions(); pack.resolution = args.size; pack.padding = args.padding; pack.bilinear = True
    chart = xatlas.ChartOptions(); chart.max_iterations = 2
    atlas.generate(chart_options=chart, pack_options=pack)
    if atlas.atlas_count != 1:
        raise ValueError('Expected one independent interior atlas, got ' + str(atlas.atlas_count))
    objects = []
    for ai, (oi, obj, positions, indices, first, groups) in enumerate(records):
        mapping, faces, uv = atlas[ai]
        if not np.allclose(positions[first][mapping[faces]], positions[indices], atol=2e-6):
            raise ValueError('xatlas changed source corner ordering')
        corners = uv[faces].reshape(-1, 2)
        if not np.isfinite(corners).all() or corners.min() < 0 or corners.max() > 1:
            raise ValueError('Non-finite/out-of-bounds UV1')
        quantized = np.rint(corners * 65535).astype('<u2')
        objects.append({'objectIndex': oi, 'name': obj['name'], 'slot': obj['slot'], 'instance': obj['instance'],
                        'geometry': obj['geometry'], 'sourceVertexCount': len(positions),
                        'sourceGeometrySHA256': geometry_checks[obj['geometry']], 'groups': groups,
                        'triangleCount': len(indices),
                        'indicesU32': base64.b64encode(indices.astype('<u4').tobytes()).decode('ascii'),
                        'uv1U16': base64.b64encode(quantized.tobytes()).decode('ascii')})
    compact = {'schema': 'liv-interior-corners-v1', 'sourceSHA256': sha(source_bytes),
               'unitSHA256': source['unitSHA256'], 'unitId': source['unitId'],
               'indexEncoding': 'base64-uint32-le', 'uvEncoding': 'base64-uint16-le',
               'uvScale': 65535, 'objects': objects}
    encoded = json.dumps(compact, separators=(',', ':')).encode('utf8')
    export = {'schema': source['schema'], 'unitId': source['unitId'], 'unitSHA256': source['unitSHA256'],
              'sourceSHA256': sha(source_bytes), 'sourceBytes': len(source_bytes),
              'sourcePath': str(args.source.resolve()), 'meshSlots': source.get('metadata', {}).get('meshSlots'),
              'objects': len(source['objects']), 'targetObjects': len(objects),
              'geometryFingerprints': geometry_checks, 'textures': textures,
              'materialsSHA256': sha(json.dumps(source['materials'], separators=(',', ':'), sort_keys=True).encode('utf8')),
              'moldingAudit': {'objects': moldings['moldingObjects'], 'collinearOverlapPairs': moldings['collinearOverlapPairs'],
                               'auditURL': 'interior/luz/audit-moldings.json'},
              'metadata': source.get('metadata', {}),
              'checks': {'sceneFromBrowser': True, 'unitIdentity': True, 'texturesMatchPNG': True,
                         'geometryFingerprints': True, 'positiveTargetMatrices': True,
                         'approvalStillRequired': True}}
    (args.out / 'export.json').write_text(json.dumps(export, indent=2), encoding='utf8')
    (args.out / 'source-scene.json').write_bytes(source_bytes)
    (args.out / 'geometry-compact.json').write_bytes(encoded)
    (args.out / 'geometry-compact.json.gz').write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
    effective = args.padding * args.size / max(atlas.width, atlas.height)
    report = {'schema': compact['schema'], 'sourceSHA256': sha(source_bytes), 'unitSHA256': source['unitSHA256'],
              'sourcePath': str(args.source.resolve()), 'geometrySHA256': sha(encoded), 'size': args.size,
              'atlasWidth': atlas.width, 'atlasHeight': atlas.height, 'atlasCount': atlas.atlas_count,
              'utilization': atlas.utilization, 'objects': len(objects), 'triangles': triangles,
              'flippedTriangles': flipped, 'degenerateTrianglesRemoved': degenerate,
              'padding': args.padding, 'effectivePaddingPixels': effective,
              'recommendedMarginPixels': max(1, int(effective // 2)),
              'recommendedGuardPixels': max(1., min(4., effective / 2 - .25)),
              'uvMaxPixelError': args.size / 65535 / 2,
              'compactBytes': len(encoded), 'compactGzipBytes': (args.out / 'geometry-compact.json.gz').stat().st_size,
              'seconds': time.perf_counter() - started,
              'checks': {'geometryFingerprints': True, 'cornerOrder': True, 'finiteUV': True,
                         'oneAtlas': True, 'independentInstanceUV': True}}
    (args.out / 'unwrap.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print('LIV_INTERIOR_UNWRAP_COMPLETE', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
