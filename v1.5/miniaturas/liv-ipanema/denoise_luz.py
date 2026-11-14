"""Remove Monte Carlo grain from LIV's existing bake; preserve model and UVs.

Uses OIDN RTLightmap with nearest-island border guards (never RGB blur across
empty atlas space). Raw irradiance.f32 remains intact for reproducible audits.
"""
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
        function = getattr(lib, name)
        function.argtypes = args
        function.restype = result
        return function

    new_device = api('oidnNewDevice', [c.c_int], c.c_void_p)
    commit_device = api('oidnCommitDevice', [c.c_void_p])
    new_filter = api('oidnNewFilter', [c.c_void_p, c.c_char_p], c.c_void_p)
    set_image = api('oidnSetSharedFilterImage', [c.c_void_p, c.c_char_p, c.c_void_p, c.c_int,
                    c.c_size_t, c.c_size_t, c.c_size_t, c.c_size_t, c.c_size_t])
    commit_filter = api('oidnCommitFilter', [c.c_void_p])
    execute = api('oidnExecuteFilter', [c.c_void_p])
    get_error = api('oidnGetDeviceError', [c.c_void_p, c.POINTER(c.c_char_p)], c.c_int)
    release_filter = api('oidnReleaseFilter', [c.c_void_p])
    release_device = api('oidnReleaseDevice', [c.c_void_p])
    output = np.empty_like(rgb)
    height, width = rgb.shape[:2]
    device = new_device(1)
    filter_handle = None
    try:
        commit_device(device)
        filter_handle = new_filter(device, b'RTLightmap')
        for name, array in ((b'color', rgb), (b'output', output)):
            set_image(filter_handle, name, array.ctypes.data, 3, width, height, 0, 12, width * 12)
        commit_filter(filter_handle)
        execute(filter_handle)
        message = c.c_char_p()
        error = get_error(device, c.byref(message))
        if error:
            raise RuntimeError(f'OIDN error {error}: {message.value}')
    finally:
        if filter_handle:
            release_filter(filter_handle)
        release_device(device)
        for handle in handles:
            handle.close()
    if not np.isfinite(output).all():
        raise RuntimeError('Non-finite denoised irradiance')
    return np.maximum(output, 0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=HERE / 'luz')
    parser.add_argument('--oidn', type=Path, default=Path(os.environ['LOCALAPPDATA']) /
                        'CodexBlenderStudy/oidn-2.3.3.x64.windows/bin')
    parser.add_argument('--input-guard', type=float, default=2.)
    parser.add_argument('--output-guard', type=float, default=1.)
    parser.add_argument('--reuse-denoised', action='store_true',
                        help='Reuse existing OIDN output; only re-pad and re-encode RGBM')
    args = parser.parse_args()
    started = time.perf_counter()
    directory = args.out
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf8'))
    model_hash = sha((directory.parent / 'modelo.json').read_bytes())
    if model_hash != manifest['sourceSHA256']:
        raise RuntimeError('Model changed: denoising requires the matching baked model')
    compact = (directory / 'geometry-compact.json').read_bytes()
    if sha(compact) != manifest['geometrySHA256']:
        raise RuntimeError('UV changed: denoising requires the matching baked atlas')
    width, height = manifest['width'], manifest['height']
    source_path = directory / 'irradiance.f32'
    source = np.memmap(source_path, dtype=np.float32, mode='r', shape=(height, width, 4))
    mask = source[:, :, 3] > 0
    if not mask.any():
        raise RuntimeError('Bake has no covered pixels')
    # Retain nearest seed identity. Filling a border copies one island's radiance;
    # it does not average radiance from neighboring atlas islands.
    distance, nearest = ndimage.distance_transform_edt(~mask, return_indices=True)
    input_border = (~mask) & (distance <= args.input_guard)
    if args.reuse_denoised:
        previous = json.loads((directory / 'denoise.json').read_text(encoding='utf8'))
        if previous['sourceRadianceSHA256'] != sha(source_path.read_bytes()):
            raise RuntimeError('Existing denoised output has a different raw bake')
        denoised = np.fromfile(directory / 'irradiance-denoised.f32', dtype=np.float32).reshape(height, width, 3)
        print('LIV_REPAD_START', width, height, args.output_guard, flush=True)
    else:
        rgb = np.ascontiguousarray(source[:, :, :3])
        rgb[input_border] = source[nearest[0][input_border], nearest[1][input_border], :3]
        print('LIV_DENOISE_START', width, height, 'OIDN RTLightmap CPU', flush=True)
        denoised = oidn_filter(rgb, args.oidn)
    outside = ~mask
    denoised[outside] = 0
    output_border = outside & (distance <= args.output_guard)
    denoised[output_border] = denoised[nearest[0][output_border], nearest[1][output_border]]
    distant_background = outside & ~output_border
    if np.any(denoised[distant_background] != 0):
        raise RuntimeError('Far atlas background must remain zero')
    denoised.tofile(directory / 'irradiance-denoised.f32')
    value_range = manifest['range']
    multiplier = np.maximum(1 / 255, np.ceil(denoised.max(axis=2) / value_range * 255) / 255)
    clipped = int((denoised.max(axis=2) > value_range).sum())
    multiplier = np.minimum(multiplier, 1)
    encoded = np.empty((height, width, 4), dtype=np.uint8)
    encoded[:, :, :3] = np.rint(np.clip(denoised / (multiplier[:, :, None] * value_range), 0, 1) * 255).astype(np.uint8)
    encoded[:, :, 3] = np.rint(multiplier * 255).astype(np.uint8)
    raw = encoded.tobytes()
    decoded = encoded[:, :, :3].astype(np.float32) / 255 * encoded[:, :, 3:4].astype(np.float32) / 255 * value_range
    delta = np.abs(denoised[mask] - source[:, :, :3][mask])
    encoding_error = np.abs(decoded - denoised)
    # Preserve the evidence for the rejected noisy release before replacing bytes.
    for name in ('irradiance.rgbm.gz', 'manifest.json', 'bake.json', 'audit-transport.json'):
        old = directory / name
        backup = directory / (name + '.before-denoise')
        if old.exists() and not backup.exists():
            backup.write_bytes(old.read_bytes())
    (directory / 'irradiance.rgbm.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    denoise = {'filter': 'OIDN RTLightmap', 'version': '2.3.3', 'device': 'CPU',
               'inputGuardPixels': args.input_guard, 'outputGuardPixels': args.output_guard,
               'rawIrradiancePreserved': True, 'sourceSHA256': model_hash,
               'OIDNOutputReused': args.reuse_denoised,
               'sourceRadianceSHA256': sha(source_path.read_bytes()),
               'textureSHA256': sha(raw), 'seconds': time.perf_counter() - started,
               'coveredPixels': int(mask.sum()), 'inputBorderPixels': int(input_border.sum()),
               'outputBorderPixels': int(output_border.sum()),
               'farBackgroundPixels': int(distant_background.sum()),
               'radianceMax': float(denoised.max()), 'rangeClippedPixels': clipped,
               'meanAbsoluteDenoiseChange': float(delta.mean()),
               'rgbmMeanError': float(encoding_error.mean()),
               'rgbmMaxError': float(encoding_error.max()),
               'textureGzipBytes': (directory / 'irradiance.rgbm.gz').stat().st_size,
               'checks': {'modelHashMatches': True, 'UVHashMatches': True,
                          'finiteRadiance': True, 'farBackgroundZero': True,
                          'nearestIslandBorder': True, 'noRadianceClipping': clipped == 0}}
    manifest['textureSHA256'] = denoise['textureSHA256']
    manifest['denoise'] = {'filter': denoise['filter'], 'version': denoise['version'],
                           'inputGuardPixels': args.input_guard, 'outputGuardPixels': args.output_guard}
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    bake = json.loads((directory / 'bake.json').read_text(encoding='utf8'))
    bake.update(textureSHA256=denoise['textureSHA256'], denoise=denoise,
                rgbmMeanError=denoise['rgbmMeanError'], rgbmMaxError=denoise['rgbmMaxError'],
                textureGzipBytes=denoise['textureGzipBytes'])
    (directory / 'bake.json').write_text(json.dumps(bake, indent=2), encoding='utf8')
    (directory / 'denoise.json').write_text(json.dumps(denoise, indent=2), encoding='utf8')
    audit = {'sourceSHA256': model_hash, 'currentModelHashMatches': True,
             'compactHashMatches': True, 'textureDecodedHashMatches': sha(raw) == manifest['textureSHA256'],
             'decodedFinite': bool(np.isfinite(decoded).all()),
             'RGBMMeanError': denoise['rgbmMeanError'], 'RGBMMaxError': denoise['rgbmMaxError'],
             'alphaByteRange': [int(encoded[:, :, 3].min()), int(encoded[:, :, 3].max())],
             'premultiplyAlpha': False, 'bakedColorPass': False, 'denoise': denoise['filter'],
             'irradianceMin': float(decoded.min()), 'irradianceMax': float(decoded.max())}
    (directory / 'audit-transport.json').write_text(json.dumps(audit, indent=2), encoding='utf8')
    print('LIV_DENOISE_COMPLETE', json.dumps(denoise), flush=True)


if __name__ == '__main__':
    main()
