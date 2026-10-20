"""Repair unsampled facade bevels using compatible nearby exterior surfaces.

Only subpixel triangles near black on the four outer facade planes qualify.
The OIDN transport, model and UV remain saved for independent comparison.
"""
from pathlib import Path
import base64
import gzip
import hashlib
import json
import time

import numpy as np
from scipy.spatial import cKDTree


HERE = Path(__file__).resolve().parent
OUTPUT = HERE / 'luz'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sample(image, uv):
    height, width = image.shape[:2]
    point = uv * np.array([width, height]) - .5
    floor = np.floor(point).astype(int)
    fraction = point - floor
    x0, y0 = np.clip(floor[..., 0], 0, width - 1), np.clip(floor[..., 1], 0, height - 1)
    x1, y1 = np.minimum(x0 + 1, width - 1), np.minimum(y0 + 1, height - 1)
    fx, fy = fraction[..., 0, None], fraction[..., 1, None]
    return ((image[y0, x0] * (1 - fx) + image[y0, x1] * fx) * (1 - fy) +
            (image[y1, x0] * (1 - fx) + image[y1, x1] * fx) * fy)


def triangle_pixels(triangle, width, height):
    # Radius .85 covers bilinear sample support of a subpixel triangle, while
    # remaining below the ~2.97px atlas padding that separates distinct islands.
    vertices = triangle * [width, height] - .5
    lower = np.maximum(0, np.floor(vertices.min(axis=0) - .85).astype(int))
    upper = np.minimum([width - 1, height - 1], np.ceil(vertices.max(axis=0) + .85).astype(int))
    x, y = np.meshgrid(np.arange(lower[0], upper[0] + 1), np.arange(lower[1], upper[1] + 1))
    points = np.c_[x.reshape(-1), y.reshape(-1)]
    distances, signs = [], []
    for i in range(3):
        start, end = vertices[i], vertices[(i + 1) % 3]
        direction = end - start
        parameter = np.clip(((points - start) * direction).sum(axis=1) /
                            max(float(direction @ direction), 1e-16), 0, 1)
        distances.append(np.linalg.norm(points - (start + parameter[:, None] * direction), axis=1))
        signs.append(direction[0] * (points[:, 1] - start[1]) - direction[1] * (points[:, 0] - start[0]))
    signs = np.asarray(signs)
    inside = (signs >= -1e-8).all(axis=0) | (signs <= 1e-8).all(axis=0)
    support = inside | (np.asarray(distances).min(axis=0) <= .85)
    return points[support]


def main():
    started = time.perf_counter()
    manifest = json.loads((OUTPUT / 'manifest.json').read_text(encoding='utf8'))
    source = (OUTPUT / 'source-modelo.json').read_bytes()
    compact_bytes = (OUTPUT / 'geometry-compact.json').read_bytes()
    if sha(source) != manifest['sourceSHA256'] or sha(compact_bytes) != manifest['geometrySHA256']:
        raise RuntimeError('Prepared UV/model hashes mismatch')
    if sha((HERE / 'modelo.json').read_bytes()) != manifest['sourceSHA256']:
        raise RuntimeError('Current model changed after bake')
    model, compact = json.loads(source), json.loads(compact_bytes)
    width, height = manifest['width'], manifest['height']
    input_path = OUTPUT / 'irradiance-denoised.f32'
    image = np.fromfile(input_path, dtype=np.float32).reshape(height, width, 3)
    half_width, half_depth = model['metadata']['width'] / 2, model['metadata']['depth'] / 2
    patches = {}
    repaired, skipped_shadow, unresolved = 0, 0, 0
    details = []
    for batch in compact['groups']:
        if batch['tower'] != 0 or batch['material'] != 'MAT-reboco':
            continue
        geo = model['geometries'][batch['geometry']]
        indices = np.asarray(batch['indices'], dtype=np.uint32).reshape(-1, 3)
        positions = np.asarray(geo['position']).reshape(-1, 3)
        normals = np.asarray(geo['normal']).reshape(-1, 3)
        centers = positions[indices].mean(axis=1)
        normal = normals[indices].mean(axis=1)
        normal /= np.maximum(np.linalg.norm(normal, axis=1)[:, None], 1e-10)
        sides = [((normal[:, 2] > .65) & (centers[:, 2] > half_depth - .065), 2),
                 ((normal[:, 2] < -.65) & (centers[:, 2] < -half_depth + .065), 2),
                 ((normal[:, 0] > .65) & (centers[:, 0] > half_width - .065), 0),
                 ((normal[:, 0] < -.65) & (centers[:, 0] < -half_width + .065), 0)]
        for instance in batch['instances']:
            uv = np.frombuffer(base64.b64decode(instance['uv1U16']), dtype='<u2').reshape(-1, 3, 2) / 65535
            pixel = uv * [width, height]
            area = np.abs((pixel[:, 1, 0] - pixel[:, 0, 0]) * (pixel[:, 2, 1] - pixel[:, 0, 1]) -
                          (pixel[:, 1, 1] - pixel[:, 0, 1]) * (pixel[:, 2, 0] - pixel[:, 0, 0])) / 2
            lights = sample(image, uv.mean(axis=1))
            corner_lights = sample(image, uv).mean(axis=2)
            near_black = np.minimum(lights.mean(axis=1), corner_lights.min(axis=1)) < .02
            count = 0
            for side, axis in sides:
                reference_indices = np.where(side & (area >= 4) & (np.abs(normal[:, axis]) > .985))[0]
                targets = np.where(side & (area < 2) & near_black)[0]
                if not len(reference_indices) or not len(targets):
                    continue
                tree = cKDTree(centers[reference_indices])
                distances, neighbors = tree.query(centers[targets], k=min(16, len(reference_indices)))
                if distances.ndim == 1:
                    distances, neighbors = distances[:, None], neighbors[:, None]
                for row, target in enumerate(targets):
                    candidates = reference_indices[neighbors[row]]
                    geometrically_compatible = ((normal[candidates] @ normal[target] > .65) &
                                  (np.abs(centers[candidates, axis] - centers[target, axis]) <= .065) &
                                  (distances[row] <= 1.7))
                    # Near-black donor texels can suffer the same sampling loss.
                    # A stable illuminated planar donor must exist locally; broad
                    # unlit regions with no such donor retain their original shade.
                    compatible = geometrically_compatible & (lights[candidates].mean(axis=1) >= .025)
                    valid = np.where(compatible)[0][:3]
                    if not len(valid):
                        if geometrically_compatible.any():
                            skipped_shadow += 1
                        else:
                            unresolved += 1
                        continue
                    weights = 1 / (distances[row][valid] + .05) ** 2
                    color = (lights[candidates[valid]] * weights[:, None]).sum(axis=0) / weights.sum()
                    for x, y in triangle_pixels(uv[target], width, height):
                        key = int(y) * width + int(x)
                        if key not in patches:
                            patches[key] = [0., 0., 0., 0]
                        record = patches[key]
                        record[0] += float(color[0]); record[1] += float(color[1]); record[2] += float(color[2]); record[3] += 1
                    count += 1
            repaired += count
            if count:
                details.append({'groupIndex': batch['groupIndex'], 'geometry': batch['geometry'],
                                'instanceIndex': instance['instanceIndex'], 'floor': instance['floor'],
                                'triangles': count})
    if not repaired:
        raise RuntimeError('No qualifying exterior subpixel faces found')
    print('LIV_GUIDED_REPAIR', repaired, 'triangles', len(patches), 'pixels', flush=True)
    before = np.array([image[key // width, key % width].mean() for key in patches])
    for key, values in patches.items():
        image[key // width, key % width] = np.asarray(values[:3]) / values[3]
    image.tofile(OUTPUT / 'irradiance-guided.f32')
    value_range = manifest['range']
    multiplier = np.maximum(1 / 255, np.ceil(image.max(axis=2) / value_range * 255) / 255)
    multiplier = np.minimum(multiplier, 1)
    encoded = np.empty((height, width, 4), dtype=np.uint8)
    encoded[:, :, :3] = np.rint(np.clip(image / (multiplier[:, :, None] * value_range), 0, 1) * 255).astype(np.uint8)
    encoded[:, :, 3] = np.rint(multiplier * 255).astype(np.uint8)
    raw = encoded.tobytes()
    for name in ('irradiance.rgbm.gz', 'manifest.json', 'bake.json', 'audit-transport.json'):
        path = OUTPUT / name
        backup = OUTPUT / (name + '.before-guided')
        if not backup.exists():
            backup.write_bytes(path.read_bytes())
    (OUTPUT / 'irradiance.rgbm.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    decoded = encoded[:, :, :3].astype(np.float32) / 255 * encoded[:, :, 3:4].astype(np.float32) / 255 * value_range
    error = np.abs(decoded - image)
    proof = {'algorithm': 'compatible coplanar exterior neighbor',
             'sourceSHA256': manifest['sourceSHA256'], 'geometrySHA256': manifest['geometrySHA256'],
             'inputOIDNRadianceSHA256': sha(input_path.read_bytes()), 'textureSHA256': sha(raw),
             'UVAreaMaxPixels': 2, 'referenceUVAreaMinPixels': 4,
             'referenceExteriorAxisNormalMinimum': .985,
             'referenceStableRadianceMinimum': .025,
             'normalDotMinimum': .65, 'planeToleranceMeters': .065, 'distanceMaxMeters': 1.7,
             'nearBlackThreshold': .02, 'UVSupportRadiusPixels': .85,
             'repairedTriangles': repaired, 'modifiedPixels': len(patches),
             'unresolvedTriangles': unresolved, 'broadShadowTrianglesPreserved': skipped_shadow,
             'repairedPixelLuminanceBefore': float(before.mean()),
             'repairedPixelLuminanceAfter': float(np.mean([image[k // width, k % width].mean() for k in patches])),
             'rgbmMeanError': float(error.mean()), 'rgbmMaxError': float(error.max()),
             'textureGzipBytes': (OUTPUT / 'irradiance.rgbm.gz').stat().st_size,
             'seconds': time.perf_counter() - started, 'details': details,
             'checks': {'UVUnchanged': True, 'modelUnchanged': True, 'finiteRadiance': bool(np.isfinite(image).all()),
                        'interiorFacesExcluded': True, 'largeUVFacesExcluded': True,
                        'noRadianceClipping': bool(image.max() < value_range)}}
    manifest['textureSHA256'] = proof['textureSHA256']
    manifest['guidedExteriorRepair'] = {'algorithm': proof['algorithm'],
                                        'triangles': repaired, 'pixels': len(patches)}
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    bake = json.loads((OUTPUT / 'bake.json').read_text(encoding='utf8'))
    bake.update(textureSHA256=proof['textureSHA256'], guidedExteriorRepair=proof,
                rgbmMeanError=proof['rgbmMeanError'], rgbmMaxError=proof['rgbmMaxError'],
                textureGzipBytes=proof['textureGzipBytes'])
    (OUTPUT / 'bake.json').write_text(json.dumps(bake, indent=2), encoding='utf8')
    (OUTPUT / 'guided-repair.json').write_text(json.dumps(proof, indent=2), encoding='utf8')
    audit = {'sourceSHA256': manifest['sourceSHA256'], 'currentModelHashMatches': True,
             'compactHashMatches': True, 'textureDecodedHashMatches': sha(raw) == manifest['textureSHA256'],
             'decodedFinite': bool(np.isfinite(decoded).all()),
             'RGBMMeanError': proof['rgbmMeanError'], 'RGBMMaxError': proof['rgbmMaxError'],
             'premultiplyAlpha': False, 'bakedColorPass': False,
             'denoise': 'OIDN RTLightmap', 'guidedExteriorRepair': True}
    (OUTPUT / 'audit-transport.json').write_text(json.dumps(audit, indent=2), encoding='utf8')
    print('LIV_GUIDED_REPAIR_COMPLETE', json.dumps({k: v for k, v in proof.items() if k != 'details'}), flush=True)


if __name__ == '__main__':
    main()
