"""Independent audit of the exported HTML and decompressed geographical tiles."""
import argparse
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import time
import zlib

from shapely.geometry import Point, Polygon
from shapely.prepared import prep


HERE = Path(__file__).resolve().parent


def blocks(path):
    result = {}
    for match in re.finditer(r'<script([^>]*)>(.*?)</script>', path.read_text('utf8'), re.S):
        ident = re.search(r'id="([^"]+)"', match[1])
        if ident and 'json' in match[1]:
            body = match[2]
            if 'data-zip=' in match[1]:
                body = zlib.decompress(base64.b64decode(body.strip()), -15).decode('utf8')
            result[ident[1]] = json.loads(body)
    return result


def int_buffer(value, kind='i'):
    raw = base64.b64decode(value, validate=True)
    width = struct.calcsize('<' + kind)
    if len(raw) % width:
        raise ValueError('misaligned encoded integer buffer')
    return struct.unpack('<' + kind * (len(raw) // width), raw)


def decode(values, start, count, q):
    x = z = 0
    result = []
    for i in range(start, start + count * 2, 2):
        x += values[i]
        z += values[i + 1]
        result.append((x / q, z / q))
    return result


def rings(values, header, q):
    i = 0
    while i < len(values):
        n = values[i + header - 1]
        yield decode(values, i + header, n, q)
        i += header + n * 2
    if i != len(values):
        raise ValueError('invalid variable-length geometry')


def audit(folder, output):
    started = time.monotonic()
    html = next(folder.glob('*.html'))
    data = blocks(html)
    elevation = data['__elevdata']
    center = (elevation['center_m']['x'], elevation['center_m']['z'])
    radius = elevation['radius_m']
    counts, maximum, violations, notes = {}, {}, {}, []

    def bad(layer, value):
        entry = violations.setdefault(layer, {'count': 0, 'examples': []})
        entry['count'] += 1
        if len(entry['examples']) < 4:
            entry['examples'].append(value)

    def points(layer, vertices):
        total = counts.get(layer + '_vertices', 0)
        distance = maximum.get(layer, 0)
        for x, z in vertices:
            total += 1
            r = math.hypot(x - center[0], z - center[1])
            if not math.isfinite(r) or r > radius + 1e-6:
                bad(layer, {'x': x, 'z': z, 'radius': r})
            distance = max(distance, r)
        counts[layer + '_vertices'] = total
        maximum[layer] = distance

    city = data['__citydata']
    q = city['q']
    buildings = list(rings(city['b'], 3, q))
    counts['buildings'] = len(buildings)
    for name, values, header in [('buildings', city['b'], 3), ('roads', city['r'], 3),
                                  ('ground_polygons', city.get('g') or [], 1)]:
        for ring in rings(values, header, q):
            points(name, ring)
    for key in ('__grounddata', '__streetdata'):
        values = data[key]
        if len(values) % 6:
            bad(key, 'incomplete triangle')
        counts[key + '_triangles'] = len(values) // 6
        points(key, zip(values[::2], values[1::2]))
    for key, stride in [('__murosdata', 4), ('__portoes', 5)]:
        values, x, z = data[key], 0, 0
        counts[key] = len(values) // stride
        for i in range(0, len(values), stride):
            x += values[i]
            z += values[i + 1]
            if stride == 4:
                vertices = [(x / 10, z / 10), ((x + values[i + 2]) / 10, (z + values[i + 3]) / 10)]
            else:
                theta, half_width = values[i + 2] / 255 * 2 * math.pi, values[i + 3] / 20
                dx, dz = math.cos(theta) * half_width, -math.sin(theta) * half_width
                vertices = [(x / 10 - dx, z / 10 - dz), (x / 10 + dx, z / 10 + dz)]
            points(key, vertices)

    # Ground is intentionally continuous throughout the regional circle.
    # Check surfaces against the same inscribed boundary, independently of
    # the generator; the vertex pass above also checks the true radius.
    mask = Point(*center).buffer(radius, quad_segs=180).buffer(.002, quad_segs=4)
    allowed = prep(mask)

    def ground(layer, vertices):
        triangle = Polygon(vertices)
        if triangle.area > 1e-10 and not allowed.covers(triangle):
            diff = triangle.difference(mask)
            if diff.area > 1e-8:
                bad(layer, {'area_outside_circle_m2': diff.area,
                            'representative': list(diff.representative_point().coords[0])})

    for ring in rings(city.get('g') or [], 1, q):
        polygon = Polygon(ring)
        if not allowed.covers(polygon):
            diff = polygon.difference(mask)
            if diff.area > 1e-8:
                bad('ground_polygon_density', {'area_outside_circle_m2': diff.area})
    values = data['__grounddata']
    for i in range(0, len(values), 6):
        ground('ground_triangle_density', list(zip(values[i:i + 6:2], values[i + 1:i + 6:2])))

    for key, kind in [('__vegetacao', 'ndvi'), ('__elevdata', 'elevation')]:
        raster = data[key]
        if raster.get('format') != 'regional-raster-sparse-v2':
            bad(key, 'raster is not sparse v2')
        indices, n, half = raster['indices'], raster['source_grid']['n'], raster['source_grid']['half_m']
        values = base64.b64decode(raster['ndvi_b64'], validate=True) if kind == 'ndvi' else raster['values']
        if indices != sorted(set(indices)) or len(values) != len(indices):
            bad(key, 'invalid sparse index/value alignment')
        if any(not isinstance(i, int) or not 0 <= i < n * n for i in indices):
            bad(key, 'invalid original-grid index')
        points(key, [(-half + (i % n) * 2 * half / (n - 1),
                      -half + (i // n) * 2 * half / (n - 1)) for i in indices])
        counts[kind + '_samples'] = len(indices)

    origin = data['__cidade']['centro']
    mlon = 111319.49 * math.cos(math.radians(origin['lat']))
    def geo(lon, lat):
        return ((lon - origin['lon']) * mlon, -(lat - origin['lat']) * 111132.92)
    for key in ('__poidata', '__imoveis'):
        entries = data.get(key) or []
        counts[key + '_entries'] = len(entries)
        for entry in entries:
            if entry.get('lat') is None or entry.get('lon') is None:
                bad(key, 'geographical record without coordinates')
            else:
                points(key, [geo(entry['lon'], entry['lat'])])
    for entry in data.get('__unidades') or []:
        lot = entry.get('lote') or {}
        if lot.get('lat') is not None and lot.get('lon') is not None:
            points('__unidades', [geo(lot['lon'], lot['lat'])])

    asset_cache = {}
    def envelope(asset, x, z, theta, sx, sz, quant):
        key = (asset['p'], quant)
        if key not in asset_cache:
            values = int_buffer(asset['p'], 'h')
            xs, zs = values[::3], values[2::3]
            asset_cache[key] = (min(xs) / quant, min(zs) / quant, max(xs) / quant, max(zs) / quant)
        x0, z0, x1, z1 = asset_cache[key]
        co, si = math.cos(theta), math.sin(theta)
        return [(x + co * u * sx + si * v * sz, z - si * u * sx + co * v * sz)
                for u, v in ((x0, z0), (x0, z1), (x1, z1), (x1, z0))]

    urban = data['__urbanModels']['assets']
    for index, slot in (city.get('urbanLots') or {}).items():
        ai, x, z, theta = slot
        if not 0 <= int(index) < len(buildings) or not 0 <= ai < len(urban):
            bad('urban_binding', slot)
            continue
        points('urban_envelope', envelope(urban[ai], x, z, theta, 1, 1, 100))
    counts['urban_placements'] = len(city.get('urbanLots') or {})
    exterior = data['__exteriorModels']
    assets = exterior['assets'] + exterior.get('props', [])
    quant = exterior['quantization']
    for slot in exterior.get('placements') or []:
        ai, x, z, theta = slot[:4]
        points('exterior_envelope', envelope(assets[ai], x, z, theta, 1, 1, quant))
    counts['exterior_placements'] = len(exterior.get('placements') or [])
    info = exterior['parcelTiles']
    expected_files = {folder / info['prefix'] / (key + '.bin') for key in info['keys']}
    actual_files = set(folder.rglob('*.bin'))
    if expected_files != actual_files:
        bad('tile_catalog', {'missing': [str(p) for p in expected_files - actual_files],
                             'extra': [str(p) for p in actual_files - expected_files]})
    counts['tiles'] = len(actual_files)
    counts['tile_parcels'] = counts['tile_triangles'] = counts['tile_props'] = 0
    mismatched_keys = 0
    for file in sorted(actual_files):
        parcels = json.loads(gzip.decompress(file.read_bytes()))
        for parcel in parcels:
            counts['tile_parcels'] += 1
            points('tile_anchors', [(parcel['x'], parcel['z'])])
            anchor_key = '%d_%d' % (math.floor(parcel['x'] / info['size']), math.floor(parcel['z'] / info['size']))
            if file.stem != anchor_key:
                mismatched_keys += 1
            gp, pp = int_buffer(parcel['gp']), int_buffer(parcel['pp'])
            gc = base64.b64decode(parcel['gc'], validate=True)
            if len(gp) % 6 or len(pp) % 6 or len(gc) != len(gp) // 6:
                bad('tile_buffers', str(file))
            if any(color >= len(exterior['palette']) for color in gc):
                bad('tile_palette', str(file))
            vertices = [(parcel['x'] + gp[i] / 1000, parcel['z'] + gp[i + 1] / 1000)
                        for i in range(0, len(gp), 2)]
            points('tile_ground', vertices)
            counts['tile_triangles'] += len(gp) // 6
            for i in range(0, len(vertices), 3):
                ground('tile_ground_density', vertices[i:i + 3])
            for i in range(0, len(pp), 6):
                ai, xi, zi, angle, sx, sz = pp[i:i + 6]
                if not 65 <= ai < len(assets):
                    bad('tile_prop_binding', ai)
                    continue
                x, z, theta, sx, sz = xi / 1000, zi / 1000, angle / 1e6, sx / 1e6, sz / 1e6
                points('tile_prop_envelope', envelope(assets[ai], x, z, theta, sx, sz, quant))
                shared = assets[ai].get('shared', ai)
                if shared != ai:
                    points('tile_shared_envelope', envelope(assets[shared], x, z, theta, sx, sz, quant))
                span = exterior['aerial']['spans'][ai - 65]
                co, si = math.cos(theta), math.sin(theta)
                points('tile_sprite_envelope', [(x + co * u + si * v, z - si * u + co * v)
                    for u, v in ((-span*sx/2, -span*sz/2), (-span*sx/2, span*sz/2),
                                 (span*sx/2, span*sz/2), (span*sx/2, -span*sz/2))])
                counts['tile_props'] += 1
    if mismatched_keys:
        notes.append({'tile_anchor_key_mismatches': mismatched_keys,
                      'impact': 'reanchored parcel remains in original tile; check streaming reach'})

    # Confirm whether the reporting bbox is the legacy +/-50m placement estimate.
    if exterior.get('placements'):
        slot = max(exterior['placements'], key=lambda p: p[1])
        notes.append({'largest_exterior_x_placement': slot,
                      'legacy_estimated_xmax': slot[1] + 50,
                      'actual_envelope_xmax': max(p[0] for p in envelope(assets[slot[0]], *slot[1:4], 1, 1, quant))})
    result = {'ok': not violations, 'html': str(html.resolve()),
              'html_sha256': hashlib.sha256(html.read_bytes()).hexdigest(), 'center_m': center,
              'radius_m': radius, 'counts': counts, 'max_radius_m': maximum,
              'violations': violations, 'notes': notes, 'ground_policy': 'full-circle',
              'seconds': round(time.monotonic() - started, 3)}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False), 'utf8')
    print(json.dumps(result, ensure_ascii=False))
    return result['ok']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--folder', type=Path, default=HERE / 'mapas-v3')
    parser.add_argument('--output', type=Path, default=HERE / 'qa-dados-v3' / 'auditoria.json')
    args = parser.parse_args()
    raise SystemExit(0 if audit(args.folder, args.output) else 1)
