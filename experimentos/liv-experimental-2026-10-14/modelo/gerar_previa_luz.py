"""Gera a prévia do atlas de luz da maquete (irradiance-previa.rgbm.gz) e a registra no manifest.json.

O atlas completo tem 4096² e pesa 13 MB: em 20 Mbps ele sozinho segurava a
abertura por ~6 s. A prévia (1/4 por lado, ~1 MB) acende o prédio primeiro e o
renderer troca pelo completo quando ele chega. A média é feita em luz linear
(RGBM decodificado), não nos bytes, e o RGBM é recodificado com o mesmo range.

uso: python -I modelo/gerar_previa_luz.py modelo/entrada/candidato/assets [fator]
"""
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

NAME = 'irradiance-previa.rgbm.gz'


def encode(linear, rng):
    m = np.clip(np.ceil(linear.max(axis=2) / rng * 255), 1, 255)
    rgb = np.clip(np.rint(linear / rng / (m[..., None] / 255) * 255), 0, 255)
    return np.dstack([rgb, m]).astype(np.uint8)


def decode(rgbm, rng):
    a = rgbm.astype(np.float32)
    return a[..., :3] / 255 * (a[..., 3:] / 255) * rng


def main():
    assets = Path(sys.argv[1])
    factor = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    manifest_path = assets / 'manifest.json'
    manifest = json.loads(manifest_path.read_text('utf-8'))
    scene = json.loads(gzip.decompress((assets / 'scene.json.gz').read_bytes()))
    rgbm = scene['rgbm']
    raw = gzip.decompress((assets / rgbm['textureURL']).read_bytes())
    assert hashlib.sha256(raw).hexdigest() == rgbm['textureSHA256'], 'atlas não confere com a cena'
    w, h, rng = rgbm['width'], rgbm['height'], rgbm['range']
    assert w % factor == 0 and h % factor == 0
    full = decode(np.frombuffer(raw, np.uint8).reshape(h, w, 4), rng)
    small = full.reshape(h // factor, factor, w // factor, factor, 3).mean(axis=(1, 3))
    out = encode(small, rng)
    # A recodificação não pode desviar mais que um degrau de 8 bits da média linear.
    err = np.abs(decode(out, rng) - small).max()
    assert err <= rng / 255 + 1e-6, f'erro de recodificação {err}'
    data = gzip.compress(out.tobytes(), compresslevel=9, mtime=0)
    (assets / NAME).write_bytes(data)
    manifest['files'][NAME] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                               'width': w // factor, 'height': h // factor,
                               'decodedSHA256': hashlib.sha256(out.tobytes()).hexdigest(),
                               'previewOf': rgbm['textureURL']}
    manifest_path.write_text(json.dumps(manifest, indent=2), 'utf-8', newline='\r\n')
    print(f'{NAME}: {w // factor}x{h // factor}, {len(data) / 1e6:.2f} MB (completo {(assets / rgbm['textureURL']).stat().st_size / 1e6:.1f} MB), erro máx {err:.4f}')


if __name__ == '__main__':
    main()
