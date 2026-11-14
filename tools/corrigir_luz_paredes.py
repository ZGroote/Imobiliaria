"""Reempacota só os texels afetados pela correção das paredes altas, sem alterar o restante do atlas.

python tools/corrigir_luz_paredes.py --site experimentos/liv-experimental-2026-10-14
python tools/corrigir_luz_paredes.py --site experimentos/laranjeiras-2026-10-30/site
Os mapas já corrigidos são ignorados. O empacotador de novos bakes aplica o mesmo filtro.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile

import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'v1.5/miniaturas/liv-ipanema/interior'))
from suavizar_paredes import scene_wall_filters, soften_walls, encode_rgbm2, WALL_DENOISE  # noqa: E402


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(site, entry):
    path = (site / entry['path']).resolve()
    if not path.is_relative_to(site):
        raise ValueError('Recurso fora do site')
    data = path.read_bytes()
    if len(data) != entry['bytes'] or sha(data) != entry['sha256']:
        raise ValueError(f'Recurso diferente do catálogo: {path}')
    if entry.get('compression') == 'gzip':
        data = gzip.decompress(data)
        if len(data) != entry['decodedBytes'] or sha(data) != entry['decodedSHA256']:
            raise ValueError(f'Conteúdo descomprimido diferente do catálogo: {path}')
    return data


def correct(site):
    catalog = json.loads((site / 'interiores/catalogo.json').read_text(encoding='utf8'))
    for typology, record in catalog['tipologias'].items():
        manifest_path = site / f'interiores/{typology}/luz-horario/manifest.json'
        manifest = json.loads(manifest_path.read_text(encoding='utf8'))
        if manifest.get('wallDenoise') == WALL_DENOISE:
            print(typology, 'já corrigida', flush=True)
            continue
        if manifest['encoding'] != 'linear-rgbm2-u8' or manifest['width'] != manifest['height']:
            raise ValueError('Formato de atlas não suportado')
        source = json.loads(read(site, record['files']['source']))
        compact = json.loads(read(site, record['files']['compact']))
        if manifest['sourceSHA256'] != record['sourceSHA256'] or manifest['geometrySHA256'] != record['files']['compact']['decodedSHA256']:
            raise ValueError('Luz de outra revisão da geometria')
        filters, islands = scene_wall_filters(source, compact, manifest['width'])
        if not filters:
            raise ValueError('Nenhuma parede encontrada')
        entries = [*manifest['keys'], manifest['night']]
        changed = 0
        with tempfile.TemporaryDirectory(prefix='.parede-', dir=manifest_path.parent) as temp:
            staged = []
            for index, entry in enumerate(entries):
                encoded = np.frombuffer(read(site, entry), np.uint8).reshape(manifest['height'], manifest['width'], 4).copy()
                normalized = encoded.astype(np.float32) / 255
                light = normalized[..., :3] * normalized[..., 3, None] ** 2 * manifest['range']
                affected = soften_walls(light, filters, islands)
                encoded[affected] = encode_rgbm2(light[affected], manifest['range'])
                data = encoded.tobytes()
                packed = gzip.compress(data, compresslevel=9, mtime=0)
                candidate = Path(temp) / str(index)
                candidate.write_bytes(packed)
                destination = (site / entry['path']).resolve()
                staged.append((candidate, destination))
                entry.update(bytes=len(packed), sha256=sha(packed), decodedBytes=len(data), decodedSHA256=sha(data))
                changed += int(affected.sum())
            manifest['wallDenoise'] = WALL_DENOISE
            candidate = Path(temp) / 'manifest.json'
            candidate.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf8', newline='\n')
            for source_path, destination in staged:
                source_path.replace(destination)
            candidate.replace(manifest_path)
        print(typology, len(entries), 'mapas corrigidos;', changed, 'texels tratados', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, required=True)
    correct(parser.parse_args().site.resolve())
