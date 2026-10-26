"""Extrai OCIO/AgX por Image.save_render em CPU; nunca renderiza ou salva a fonte."""
import hashlib
import json
from pathlib import Path
import struct
import zlib

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'entrega/LIV_Luz_Natural.blend'
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
LOCAL = ROOT / 'fontes/materiais-web/look-agx-medio-baixo'
EXPECTED_SHA = '517be435ec7072839a9088f2675c264e7fd297ff7c0f98c2bb2534035017db88'
EDGE, MIN_EV, MAX_EV = 64, -16.0, 8.0
NAME = 'look-agx-medio-baixo'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_png16_raw(path):
    """Decodifica os inteiros PNG sem ICC, gAMA, sRGB ou conversão automática."""
    blob = path.read_bytes()
    assert blob[:8] == b'\x89PNG\r\n\x1a\n'
    at, compressed, metadata = 8, bytearray(), []
    while at < len(blob):
        size = struct.unpack_from('>I', blob, at)[0]
        kind, payload = blob[at + 4:at + 8], blob[at + 8:at + 8 + size]
        if kind == b'IHDR':
            width, height, bits, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
        elif kind == b'IDAT':
            compressed.extend(payload)
        elif kind not in (b'IEND',):
            metadata.append(kind.decode('ascii'))
        at += size + 12
    assert bits == 16 and color in (2, 6) and (compression, filtering, interlace) == (0, 0, 0)
    channels = 3 if color == 2 else 4
    bpp, stride = channels * 2, width * channels * 2
    packed, decoded, previous = zlib.decompress(compressed), bytearray(), bytearray(stride)
    at = 0
    for _ in range(height):
        mode = packed[at]
        row = bytearray(packed[at + 1:at + 1 + stride])
        at += stride + 1
        assert mode <= 4
        if mode:
            for i in range(stride):
                left = row[i - bpp] if i >= bpp else 0
                up = previous[i]
                upper_left = previous[i - bpp] if i >= bpp else 0
                if mode == 1:
                    predictor = left
                elif mode == 2:
                    predictor = up
                elif mode == 3:
                    predictor = (left + up) // 2
                else:
                    p = left + up - upper_left
                    a, b, c = abs(p - left), abs(p - up), abs(p - upper_left)
                    predictor = left if a <= b and a <= c else up if b <= c else upper_left
                row[i] = (row[i] + predictor) & 255
        decoded.extend(row)
        previous = row
    assert at == len(packed)
    # Blender image.pixels começa pela linha inferior; o PNG começa pela superior.
    samples = np.frombuffer(decoded, dtype='>u2').reshape(height, width, channels)[::-1].copy()
    return samples.astype(np.float64) / 65535.0, metadata


def to_linear(display):
    return np.where(display <= .04045, display / 12.92, ((display + .055) / 1.055) ** 2.4)


def to_srgb(linear):
    return np.where(linear <= .0031308, linear * 12.92, 1.055 * np.maximum(linear, 0) ** (1 / 2.4) - .055)


def save_samples(rgb, scene, label, width=None):
    flat = np.asarray(rgb, dtype=np.float32).reshape(-1, 3)
    width = width or len(flat)
    assert len(flat) % width == 0
    height = len(flat) // width
    rgba = np.ones((len(flat), 4), dtype=np.float32)
    rgba[:, :3] = flat
    image = bpy.data.images.new('OCIO CPU | ' + label, width=width, height=height, alpha=True, float_buffer=True)
    assert image.colorspace_settings.name == 'Linear Rec.709'
    image.alpha_mode = 'STRAIGHT'
    image.pixels.foreach_set(rgba.ravel())
    image.update()
    path = LOCAL / (label + '.png')
    image.save_render(str(path), scene=scene)
    output, chunks = read_png16_raw(path)
    bpy.data.images.remove(image)
    return output.reshape(-1, output.shape[-1])[:, :3], chunks


def interpolate(lut, rgb):
    rgb = np.asarray(rgb, dtype=np.float64).reshape(-1, 3)
    coordinate = np.clip((np.log2(np.maximum(rgb, 2 ** MIN_EV)) - MIN_EV) / (MAX_EV - MIN_EV), 0, 1) * (EDGE - 1)
    lower = np.floor(coordinate).astype(int)
    upper = np.minimum(lower + 1, EDGE - 1)
    weight = coordinate - lower
    output = np.zeros_like(rgb)
    for r in (0, 1):
        for g in (0, 1):
            for b in (0, 1):
                ix = np.where(r, upper[:, 0], lower[:, 0])
                iy = np.where(g, upper[:, 1], lower[:, 1])
                iz = np.where(b, upper[:, 2], lower[:, 2])
                w = (weight[:, 0] if r else 1 - weight[:, 0]) * (weight[:, 1] if g else 1 - weight[:, 1]) * (weight[:, 2] if b else 1 - weight[:, 2])
                output += lut[iz, iy, ix, :3] * w[:, None]
    return output


def main():
    before = sha(SOURCE)
    assert before == EXPECTED_SHA
    LOCAL.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    original = bpy.data.scenes['03 | Sala e jantar']
    source_view, source_look = original.view_settings.view_transform, original.view_settings.look
    source_exposure = original.view_settings.exposure
    assert source_view == 'AgX' and source_look == 'AgX - Medium Low Contrast'
    assert original.display_settings.display_device == 'sRGB'
    assert not original.view_settings.use_curve_mapping
    scene = original.copy()
    scene.name = 'OCIO CPU ONLY | source look lookup EV0'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.dither_intensity = 0
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '16'
    scene.render.image_settings.color_management = 'FOLLOW_SCENE'

    # Garante que save_render está de fato aplicando o view transform e o look.
    sentinels = np.array([[.18, .18, .18], [1, 1, 1], [16, 16, 16], [4, .05, .001]], dtype=np.float32)
    agx, _ = save_samples(sentinels, scene, 'sentinelas-agx')
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    standard, _ = save_samples(sentinels, scene, 'sentinelas-standard')
    scene.view_settings.view_transform = source_view
    scene.view_settings.look = source_look
    ocio_delta = float(np.max(np.abs(agx - standard)))
    assert ocio_delta > .05 and agx[1, 0] < .98, ('save_render não aplicou OCIO', agx.tolist(), standard.tolist())

    stops = np.linspace(MIN_EV, MAX_EV, EDGE)
    values = np.exp2(stops)
    blue, green, red = np.meshgrid(values, values, values, indexing='ij')
    grid = np.stack((red, green, blue), axis=-1)
    display, chunks = save_samples(grid, scene, 'grade-agx64-png16', width=EDGE * EDGE)
    lut = np.ones((EDGE, EDGE, EDGE, 4), dtype='<f4')
    lut[:, :, :, :3] = to_linear(display).reshape(EDGE, EDGE, EDGE, 3)

    rng = np.random.default_rng(20261026)
    indices = rng.integers(0, EDGE, size=(48, 3))
    grid_probes = values[indices]
    gray_values = np.array([0, 2 ** MIN_EV, .0001, .001, .01, .018, .18, .5, 1, 2, 4, 16, 64, 200])
    gray = np.repeat(gray_values[:, None], 3, axis=1)
    colors = np.array([[.61, .049, .007], [6, .6, .02], [.1, 4.2, .8], [35, 23, 4.9],
                       [14, .1, 2], [.013, .22, 1.7], [.04, .7, 8.3], [.8, .3, .18], [70, .04, .001]])
    random = np.exp2(rng.uniform(-12, 7, size=(256, 3)))
    groups = [('gridSentinels', grid_probes), ('grayOffGrid', gray), ('colorsOffGrid', colors), ('randomOffGrid', random)]
    validation = {}
    for label, inputs in groups:
        reference, _ = save_samples(inputs, scene, 'teste-' + label)
        actual = to_srgb(interpolate(lut, inputs))
        difference = np.abs(actual - reference)
        validation[label] = {'count': len(inputs), 'meanAbsoluteDisplayError': float(difference.mean()),
                             'maxAbsoluteDisplayError': float(difference.max()),
                             'p99AbsoluteDisplayError': float(np.percentile(difference, 99))}
        if label != 'randomOffGrid':
            validation[label]['samples'] = [{'inputLinearRGB': rgb.tolist(), 'referenceDisplaySRGB': ref.tolist(),
                                            'lutDisplaySRGB': found.tolist()} for rgb, ref, found in zip(inputs, reference, actual)]
    assert validation['gridSentinels']['maxAbsoluteDisplayError'] < 3e-5
    assert all(row['meanAbsoluteDisplayError'] < .01 for row in validation.values()), validation
    assert original.view_settings.view_transform == source_view and original.view_settings.look == source_look
    assert original.view_settings.exposure == source_exposure and sha(SOURCE) == before

    binary = DEST / (NAME + '.bin')
    payload = lut.tobytes(order='C')
    assert len(payload) == EDGE ** 3 * 4 * 4
    binary.write_bytes(payload)
    metadata = {
        'schema': 'liv-color-look-log3d-v1', 'path': binary.name, 'bytes': len(payload), 'sha256': sha(binary),
        'edge': EDGE, 'domainMinEV': MIN_EV, 'domainMaxEV': MAX_EV,
        'mapping': 'uvw = clamp((log2(max(inputLinearRGB, 2^domainMinEV)) - domainMinEV) / (domainMaxEV - domainMinEV), 0, 1)',
        'texelCoordinates': 'uvw * (edge - 1); hardware 3D texture normalized coordinate = (uvw * (edge - 1) + 0.5) / edge',
        'axisOrder': 'X=red, Y=green, Z=blue; red fastest, then green, then blue',
        'encoding': 'little-endian float32 RGBA; RGB is linear-sRGB display light after inverse sRGB transfer; A=1',
        'input': 'linear-sRGB scene radiance after external exposure gain; negatives clamp to domain minimum',
        'output': 'linear-sRGB for one later renderer sRGB output conversion; do not sRGB-decode the LUT again',
        'sourceLook': source_look, 'sourceViewTransform': source_view, 'sourceDisplayDevice': 'sRGB',
        'sourceExposureEV': source_exposure, 'lookupExposureEV': 0, 'lookupGamma': 1, 'lookupDither': 0,
        'sourceBlendSHA256': before, 'sourceBlendSHA256After': sha(SOURCE), 'blenderVersion': bpy.app.version_string,
        'exporterSHA256': sha(Path(__file__)),
        'method': 'CPU Image.save_render of Linear Rec.709 float RGB grid to PNG16; raw PNG integers decoded without color conversion; inverse sRGB transfer before binary storage. No scene render.',
        'ocioAppliedProof': {'maxAgXVsStandardDisplayDifference': ocio_delta, 'sentinelInput': sentinels.tolist(),
                             'agxDisplay': agx.tolist(), 'standardDisplay': standard.tolist()},
        'pngAncillaryChunksIgnoredDuringRawRead': chunks,
        'validation': validation, 'validationPassed': True,
    }
    target = DEST / (NAME + '.json')
    target.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding='utf-8')
    (LOCAL / 'validacao-look-resumo.json').write_text(json.dumps({
        'passed': True, 'sourceBlendSHA256': before, 'binarySHA256': metadata['sha256'],
        'ocioAppliedDifference': ocio_delta,
        'validation': {label: {k: v for k, v in row.items() if k != 'samples'} for label, row in validation.items()},
    }, indent=2, ensure_ascii=False), encoding='utf-8')
    print('LOOK_CPU_COMPLETE', str(target), len(payload), metadata['sha256'], json.dumps({k: {x: y for x, y in v.items() if x != 'samples'} for k, v in validation.items()}), flush=True)


if __name__ == '__main__':
    main()
