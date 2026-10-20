"""Verify source/UV/approval/RGBM bytes and the exported GLB before viewer QA."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import struct
import numpy as np

HERE = Path(__file__).resolve().parent


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    args = parser.parse_args(); directory = args.out.resolve()
    read_json = lambda name: json.loads((directory / name).read_bytes())
    source_raw = (directory / 'source.json').read_bytes(); source = json.loads(source_raw)
    compact_raw = (directory / 'geometry-compact.json').read_bytes(); compact = json.loads(compact_raw)
    approval_raw = (directory / 'approval.json').read_bytes(); approval = json.loads(approval_raw)
    manifest = read_json('manifest.json'); bake = read_json('bake.json'); denoise = read_json('denoise.json')
    source_sha, compact_sha = sha(source_raw), sha(compact_raw)
    require((directory / 'source-scene.json').read_bytes() == source_raw, 'Browser source/snapshot differ')
    require(gzip.decompress((directory / 'geometry-compact.json.gz').read_bytes()) == compact_raw, 'Compact gzip differs')
    for report in (manifest, compact, bake, denoise, approval):
        require(report['sourceSHA256'] == source_sha and report['unitSHA256'] == source['unitSHA256'], 'Scene/unit report mismatch')
    for report in (manifest, bake, denoise):
        require(report['geometrySHA256'] == compact_sha, 'UV report mismatch')
    require(approval.get('approved') and manifest.get('geometryApproved') and manifest['approvalSHA256'] == sha(approval_raw), 'Approval mismatch')
    require(manifest.get('ready') and bake.get('ready'), 'Atlas is not ready')
    require(manifest['passes'] == ['DIRECT', 'INDIRECT'] and not manifest['colorPass'], 'Unexpected bake color pass')
    require(not manifest['premultiplyAlpha'] and manifest['origin'] == 'bottom-left' and manifest['range'] == 16, 'Unexpected RGBM convention')
    raw = gzip.decompress((directory / 'irradiance.rgbm.gz').read_bytes())
    require(len(raw) == manifest['width'] * manifest['height'] * 4, 'RGBM decoded size mismatch')
    require(sha(raw) == manifest['textureSHA256'] == denoise['textureSHA256'] == bake['textureSHA256'], 'RGBM hash mismatch')
    values = np.frombuffer(raw, dtype=np.uint8).reshape(manifest['height'], manifest['width'], 4)
    decoded = values[:, :, :3].astype(np.float32) / 255 * values[:, :, 3:4].astype(np.float32) / 255 * 16
    require(np.isfinite(decoded).all() and decoded.max() > .05, 'Invalid decoded light')
    require(sha((directory / 'irradiance.f32').read_bytes()) == bake['sourceRadianceSHA256'] == denoise['sourceRadianceSHA256'], 'Raw irradiance hash mismatch')
    unit_path = source.get('metadata', {}).get('unitPath')
    if unit_path:
        require(sha(Path(unit_path).read_bytes()) == source['unitSHA256'], 'Actual builder unit changed')
    glb_raw = (directory / 'interior-source.glb').read_bytes()
    magic, version, length = struct.unpack_from('<III', glb_raw, 0)
    require(magic == 0x46546C67 and version == 2 and length == len(glb_raw), 'Invalid GLB container')
    chunk_length, chunk_type = struct.unpack_from('<II', glb_raw, 12)
    require(chunk_type == 0x4E4F534A, 'GLB JSON missing')
    gltf = json.loads(glb_raw[20:20 + chunk_length]); primitives = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
    accessors = gltf['accessors']; total_triangles = sum(accessors[p['indices']]['count'] // 3 for p in primitives)
    normals = sum('NORMAL' in p['attributes'] for p in primitives)
    uv1 = sum('TEXCOORD_1' in p['attributes'] for p in primitives)
    objects = [node for node in gltf['nodes'] if 'mesh' in node]
    require(len(objects) == len(source['objects']), 'GLB source object count mismatch')
    require(normals == len(primitives) and uv1 == len(compact['objects']), 'GLB normals/UV1 missing')
    require(total_triangles == read_json('authoring.json')['totalSceneTriangles'], 'GLB source triangle count mismatch')
    require(all(node.get('extras', {}).get('liv_unit_sha256') == source['unitSHA256'] for node in objects), 'GLB unit extras missing')
    authoring = {'status': 'PASS', 'sourceSHA256': source_sha, 'unitSHA256': source['unitSHA256'], 'glbSHA256': sha(glb_raw),
                 'glbBytes': len(glb_raw), 'meshObjects': len(objects), 'primitives': len(primitives), 'totalTriangles': total_triangles,
                 'primitivesWithNormals': normals, 'primitivesWithUV1': uv1,
                 'primitivesWithColor': sum('COLOR_0' in p['attributes'] for p in primitives),
                 'sourceBlendBytes': (directory / 'interior-source.blend').stat().st_size,
                 'bakedBlendBytes': (directory / 'interior-baked.blend').stat().st_size}
    payload = {'status': 'PASS', 'sourceSHA256': source_sha, 'unitSHA256': source['unitSHA256'], 'geometrySHA256': compact_sha,
               'approvalSHA256': sha(approval_raw), 'textureSHA256': sha(raw), 'objects': len(compact['objects']),
               'decodedBytes': len(raw), 'gzipBytes': (directory / 'irradiance.rgbm.gz').stat().st_size,
               'alphaRange': [int(values[:, :, 3].min()), int(values[:, :, 3].max())], 'decodedRadianceMax': float(decoded.max()),
               'finiteDecodedRadiance': True, 'passesWithoutColor': True, 'premultiplyAlpha': False, 'geometryApproved': True,
               'visualAtlasApproval': 'pending browser captures'}
    (directory / 'audit-authoring.json').write_text(json.dumps(authoring, indent=2), encoding='utf8')
    (directory / 'audit-runtime-payload.json').write_text(json.dumps(payload, indent=2), encoding='utf8')
    print('LIV_INTERIOR_OUTPUT_AUDIT', json.dumps({'authoring': authoring, 'payload': payload}), flush=True)


if __name__ == '__main__':
    main()
