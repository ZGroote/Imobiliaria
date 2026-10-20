"""OIDN RTLightmap on LIV interior irradiance only; encode RGBM16 with island guards."""
from pathlib import Path
import argparse
import ctypes as c
import gzip
import hashlib
import json
import os
import time
import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def oidn_filter(rgb, directory):
    handles = [os.add_dll_directory(str(directory)), os.add_dll_directory(str(directory.parent))]
    plugin = c.CDLL(str(directory / 'OpenImageDenoise_device_cpu.dll'))
    lib = c.CDLL(str(directory / 'OpenImageDenoise.dll'))
    def api(name, args, result=None):
        function = getattr(lib, name); function.argtypes = args; function.restype = result; return function
    new_device = api('oidnNewDevice', [c.c_int], c.c_void_p); commit_device = api('oidnCommitDevice', [c.c_void_p])
    new_filter = api('oidnNewFilter', [c.c_void_p, c.c_char_p], c.c_void_p)
    set_image = api('oidnSetSharedFilterImage', [c.c_void_p, c.c_char_p, c.c_void_p, c.c_int,
                    c.c_size_t, c.c_size_t, c.c_size_t, c.c_size_t, c.c_size_t])
    commit_filter = api('oidnCommitFilter', [c.c_void_p]); execute = api('oidnExecuteFilter', [c.c_void_p])
    get_error = api('oidnGetDeviceError', [c.c_void_p, c.POINTER(c.c_char_p)], c.c_int)
    release_filter = api('oidnReleaseFilter', [c.c_void_p]); release_device = api('oidnReleaseDevice', [c.c_void_p])
    output = np.empty_like(rgb); height, width = rgb.shape[:2]; device = new_device(1); filter_handle = None
    try:
        commit_device(device); filter_handle = new_filter(device, b'RTLightmap')
        for name, array in ((b'color', rgb), (b'output', output)):
            set_image(filter_handle, name, array.ctypes.data, 3, width, height, 0, 12, width * 12)
        # No albedo, normal or other auxiliary image is supplied.
        commit_filter(filter_handle); execute(filter_handle)
        message = c.c_char_p(); error = get_error(device, c.byref(message))
        if error:
            raise RuntimeError(f'OIDN error {error}: {message.value}')
    finally:
        if filter_handle:
            release_filter(filter_handle)
        release_device(device)
        for handle in handles:
            handle.close()
    if not np.isfinite(output).all():
        raise RuntimeError('Non-finite OIDN irradiance')
    return np.maximum(output, 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    parser.add_argument('--oidn', type=Path, default=Path(os.environ['LOCALAPPDATA']) / 'CodexBlenderStudy/oidn-2.3.3.x64.windows/bin')
    parser.add_argument('--guard', type=float, default=None)
    args = parser.parse_args(); started = time.perf_counter(); directory = args.out.resolve()
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf8'))
    source_path = directory / 'source-scene.json'; source_bytes = source_path.read_bytes(); source = json.loads(source_bytes)
    unwrap = json.loads((directory / 'unwrap.json').read_text(encoding='utf8'))
    compact_bytes = (directory / 'geometry-compact.json').read_bytes()
    if sha(source_bytes) != manifest['sourceSHA256'] or sha(compact_bytes) != manifest['geometrySHA256']:
        raise RuntimeError('Scene or UV changed after bake')
    if sha(Path(unwrap['sourcePath']).read_bytes()) != manifest['sourceSHA256']:
        raise RuntimeError('Current browser export changed after bake')
    unit_path = source.get('metadata', {}).get('unitPath')
    if unit_path and sha(Path(unit_path).read_bytes()) != manifest['unitSHA256']:
        raise RuntimeError('Builder unit changed after bake')
    width, height = manifest['width'], manifest['height']; path = directory / 'irradiance.f32'
    bake = json.loads((directory / 'bake.json').read_text(encoding='utf8'))
    if sha(path.read_bytes()) != bake['sourceRadianceSHA256']:
        raise RuntimeError('Raw irradiance changed after verified bake')
    if sha((directory / 'approval.json').read_bytes()) != manifest['approvalSHA256']:
        raise RuntimeError('Visual geometry approval changed after bake')
    rgba = np.fromfile(path, dtype=np.float32).reshape(height, width, 4); mask = rgba[:, :, 3] > 0
    if not mask.any() or not np.isfinite(rgba).all():
        raise RuntimeError('No covered finite raw irradiance')
    guard = args.guard if args.guard is not None else manifest['recommendedGuardPixels']
    if guard < 0 or guard > manifest['effectivePaddingPixels'] / 2:
        raise RuntimeError('Guard would exceed half prepared island padding')
    distance, nearest = ndimage.distance_transform_edt(~mask, return_indices=True)
    border = (~mask) & (distance <= guard)
    rgb = np.ascontiguousarray(rgba[:, :, :3]); rgb[border] = rgba[nearest[0][border], nearest[1][border], :3]
    print('LIV_INTERIOR_DENOISE_START', width, height, guard, flush=True)
    denoised = oidn_filter(rgb, args.oidn); denoised[~mask] = 0
    denoised[border] = denoised[nearest[0][border], nearest[1][border]]
    value_range = manifest['range']
    clipped = int((denoised.max(axis=2) > value_range).sum())
    if clipped:
        raise RuntimeError(f'RGBM range {value_range} would clip {clipped} pixels; preserve raw bake and increase range')
    denoised.tofile(directory / 'irradiance-denoised.f32')
    multiplier = np.maximum(1 / 255, np.ceil(denoised.max(axis=2) / value_range * 255) / 255)
    encoded = np.empty((height, width, 4), dtype=np.uint8)
    encoded[:, :, :3] = np.rint(np.clip(denoised / (multiplier[:, :, None] * value_range), 0, 1) * 255).astype(np.uint8)
    encoded[:, :, 3] = np.rint(multiplier * 255).astype(np.uint8)
    raw = encoded.tobytes(); compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    (directory / 'irradiance.rgbm.gz').write_bytes(compressed)
    decoded = encoded[:, :, :3].astype(np.float32) / 255 * encoded[:, :, 3:4].astype(np.float32) / 255 * value_range
    error = np.abs(decoded - denoised); delta = np.abs(denoised[mask] - rgba[:, :, :3][mask])
    report = {'sourceSHA256': manifest['sourceSHA256'], 'unitSHA256': manifest['unitSHA256'],
              'geometrySHA256': manifest['geometrySHA256'], 'sourceRadianceSHA256': sha(path.read_bytes()),
              'textureSHA256': sha(raw), 'filter': 'OIDN RTLightmap', 'version': '2.3.3', 'device': 'CPU',
              'auxiliaryImages': [], 'rawIrradiancePreserved': True, 'guardPixels': guard,
              'coveredPixels': int(mask.sum()), 'borderPixels': int(border.sum()),
              'width': width, 'height': height, 'seconds': time.perf_counter() - started,
              'radianceMax': float(denoised.max()), 'rangeClippedPixels': clipped,
              'meanAbsoluteDenoiseChange': float(delta.mean()), 'rgbmMeanError': float(error.mean()), 'rgbmMaxError': float(error.max()),
              'textureBytes': len(raw), 'textureGzipBytes': len(compressed),
              'checks': {'sceneHash': True, 'unitHash': True, 'UVHash': True, 'finiteRadiance': True,
                         'nearestIslandGuard': True, 'farBackgroundZero': bool(np.all(denoised[(~mask) & ~border] == 0)),
                         'rangeNoClipping': True, 'colorPassDisabled': not manifest['colorPass'], 'noAuxiliaryAlbedo': True,
                         'RGBMNoPremultiply': True}}
    manifest.update(textureSHA256=report['textureSHA256'], ready=True,
                    denoise={'filter': report['filter'], 'guardPixels': guard, 'auxiliaryImages': []})
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    bake.update(textureSHA256=report['textureSHA256'], denoise=report, ready=True)
    (directory / 'bake.json').write_text(json.dumps(bake, indent=2), encoding='utf8')
    (directory / 'denoise.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    (directory / 'audit-transport.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print('LIV_INTERIOR_DENOISE_COMPLETE', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
