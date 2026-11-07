"""Gera um pacote isolado de luz com a sombra original das quinas do Laranjeiras."""

import argparse
import gzip
import json
from pathlib import Path
import sys

import numpy as np

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO))
from tools.corrigir_luz_paredes import read, sha  # noqa: E402
from suavizar_paredes import WALL_DENOISE, encode_rgbm2, scene_wall_filters, soften_walls  # noqa: E402

EDGE_GUARD = .10
GUARDED_DENOISE = 'surface-plane-v3-laranjeiras'
FILE_FIELDS = {'bytes', 'sha256', 'decodedBytes', 'decodedSHA256'}


def excluding(record, keys):
    return {key: value for key, value in record.items() if key not in keys}


def room_corner_positions(unit):
    """Quinas da face interna da parede no sistema centrado da cena."""
    rooms = [np.asarray(room['poly'], dtype=float) for room in unit['planta']['comodos']]
    points = np.concatenate(rooms)
    center = (points.min(axis=0) + points.max(axis=0)) / 2
    corners = []
    for ring in rooms:
        before = ring - np.roll(ring, 1, axis=0)
        after = np.roll(ring, -1, axis=0) - ring
        orientation = np.sign(np.sum(ring[:, 0] * np.roll(ring[:, 1], -1)
                                     - ring[:, 1] * np.roll(ring[:, 0], -1)))
        for point, incoming, outgoing in zip(ring, before, after):
            incoming_length = np.linalg.norm(incoming)
            outgoing_length = np.linalg.norm(outgoing)
            if min(incoming_length, outgoing_length) < .05:
                continue
            incoming /= incoming_length
            outgoing /= outgoing_length
            if abs(incoming @ outgoing) > .01:
                continue
            ix, iz = incoming + outgoing
            # A malha do visualizador tem paredes de 13 cm centradas no eixo da planta.
            offset = .065 * orientation * np.array([-iz, ix])
            corners.append(point - center + offset)
    return np.asarray(corners).reshape(-1, 2)


def write_candidate(baseline, current, output):
    catalog = json.loads((baseline / 'interiores/catalogo.json').read_bytes())
    output.mkdir(parents=True, exist_ok=False)
    for typology, record in catalog['tipologias'].items():
        path = Path('interiores') / typology / 'luz-horario' / 'manifest.json'
        original = json.loads((baseline / path).read_bytes())
        manifest = json.loads((current / path).read_bytes())
        metadata = {'keys', 'night', 'wallDenoise'}
        previous_filters = {WALL_DENOISE, 'surface-plane-v2-laranjeiras'}
        if (original.get('wallDenoise') or manifest.get('wallDenoise') not in previous_filters
                or excluding(original, metadata) != excluding(manifest, metadata)
                or manifest['sourceSHA256'] != record['sourceSHA256']
                or manifest['geometrySHA256'] != record['files']['compact']['decodedSHA256']):
            raise ValueError(f'Manifestos de luz não correspondem à mesma cena: {typology}')
        if manifest['encoding'] != 'linear-rgbm2-u8' or manifest['width'] != manifest['height']:
            raise ValueError(f'Formato de atlas não suportado: {typology}')
        entries = [*manifest['keys'], manifest['night']]
        originals = {entry['id']: entry for entry in [*original['keys'], original['night']]}
        if originals.keys() != {entry['id'] for entry in entries}:
            raise ValueError(f'Horários incompatíveis: {typology}')

        source = json.loads(read(baseline, record['files']['source']))
        compact = json.loads(read(baseline, record['files']['compact']))
        unit = json.loads(read(baseline, record['files']['unit']))
        size = manifest['width']
        filters, islands = scene_wall_filters(source, compact, size, corner_points=room_corner_positions(unit))
        if not filters:
            raise ValueError(f'Nenhuma parede encontrada: {typology}')
        value_range = manifest['range']
        destination = output / path
        destination.parent.mkdir(parents=True)
        for entry in entries:
            previous = originals[entry['id']]
            if excluding(previous, FILE_FIELDS) != excluding(entry, FILE_FIELDS):
                raise ValueError(f'Metadados de horário divergentes: {entry["path"]}')
            read(current, entry)
            encoded = np.frombuffer(read(baseline, previous), np.uint8).reshape(size, size, 4).copy()
            normalized = encoded.astype(np.float32) / 255
            light = normalized[..., :3] * normalized[..., 3, None] ** 2 * value_range
            mask = soften_walls(light, filters, islands, edge_guard=EDGE_GUARD)
            encoded[mask] = encode_rgbm2(light[mask], value_range)
            raw = encoded.tobytes()
            packed = gzip.compress(raw, compresslevel=9, mtime=0)
            (output / entry['path']).write_bytes(packed)
            entry.update(bytes=len(packed), sha256=sha(packed), decodedBytes=len(raw), decodedSHA256=sha(raw))
        manifest['wallDenoise'] = GUARDED_DENOISE
        destination.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
        print(f'{typology}: {len(entries)} atlas verificados e reempacotados.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True, help='Pacote completo anterior ao pós-filtro.')
    parser.add_argument('--current', type=Path, required=True, help='Pacote atual de atlas com o pós-filtro.')
    parser.add_argument('--output', type=Path, required=True, help='Diretório novo para os atlas e manifestos.')
    args = parser.parse_args()
    write_candidate(args.baseline.resolve(), args.current.resolve(), args.output.resolve())
