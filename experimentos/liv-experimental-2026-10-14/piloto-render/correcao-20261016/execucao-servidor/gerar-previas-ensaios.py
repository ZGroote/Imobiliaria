"""Generate small room-trial previews on the server; visual approval remains pending."""
import argparse
import hashlib
import json
import math
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def write_json(path, value):
    partial = path.with_suffix('.partial.json')
    partial.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    partial.replace(path)


def floor_candidates(root, out, slug, room, views, source_hashes):
    target = out / f'ensaio-{slug}-candidatas-piso.jpg'
    sidecar = target.with_suffix('.json')
    if target.exists() and sidecar.exists():
        cached = json.loads(sidecar.read_text(encoding='utf-8'))
        if cached.get('bytes') == target.stat().st_size and cached.get('sha256') == digest(target):
            assert cached.get('sources') == source_hashes, f'Validated JPEG belongs to different reports: {target}'
            assert cached.get('file') == str(target.relative_to(root)) and cached.get('room') == room
            return cached
    candidates = sorted((view for view in views if view['pitch'] == -60), key=lambda view: view['file'])
    assert candidates and all(math.isfinite(view['psnr']) for view in candidates), room
    canvas = Image.new('RGB', (1920, math.ceil(len(candidates) / 4) * 310), (240, 240, 240))
    draw = ImageDraw.Draw(canvas)
    rows = []
    for index, view in enumerate(candidates):
        with Image.open(root / view['eval_file']) as image:
            image = image.convert('RGB')
        assert image.width % 2 == 0, view['file']
        gt = image.crop((0, 0, image.width // 2, image.height))
        x, y = index % 4 * 480, index // 4 * 310
        draw.text((x + 8, y + 3), f'{room} | GT | pitch -60', fill=(0, 0, 0))
        draw.text((x + 8, y + 19), f"{view['file']} | PSNR isolado {view['psnr']:.2f}", fill=(0, 0, 0))
        canvas.paste(gt.resize((480, 270)), (x, y + 40))
        rows.append({'file': view['file'], 'pitch': -60, 'psnr_isolated': view['psnr']})
    partial = target.with_suffix('.partial.jpg')
    canvas.save(partial, quality=94)
    partial.replace(target)
    metadata = {'file': str(target.relative_to(root)), 'room': room, 'bytes': target.stat().st_size,
                'sha256': digest(target), 'sources': source_hashes, 'rows': rows, 'visual_review': 'pending'}
    write_json(sidecar, metadata)
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/root/liv-corrigido-20261016'))
    root = parser.parse_args().root
    report_suffix = Path('resultado/analise-ambientes/metricas-por-ambiente.json')
    old_path = root / 'resultado-refino60k/analise-ambientes/metricas-por-ambiente.json'
    prior = json.loads(old_path.read_text(encoding='utf-8'))
    old_views = {view['file']: view for view in prior['views']}
    assert len(old_views) == len(prior['views']), 'Duplicate prior filenames'
    items = json.loads((root / 'ensaios-comodos/manifesto.json').read_text(encoding='utf-8'))
    wanted = {'Banho', 'Banho suíte', 'Varanda / serviço'}
    items = [item for item in items if item['room'] in wanted]
    assert {item['room'] for item in items} == wanted and len(items) == 3, 'Expected three room trials'
    out = root / 'comparacao-visual-ensaios'
    out.mkdir(exist_ok=True)
    ready, skipped, slugs = [], [], set()
    for item in items:
        room = item['room']
        report_path = root / Path(item['directory']) / report_suffix
        if not report_path.exists():
            skipped.append({'room': room, 'reason': 'trial report not ready'})
            continue
        raw_slug = item.get('slug') or Path(item['directory']).name
        slug = re.sub('[^a-z0-9]+', '-', unicodedata.normalize('NFKD', raw_slug).encode('ascii', 'ignore').decode().lower()).strip('-')
        assert slug and slug not in slugs, f'Invalid or duplicate slug: {room}'
        slugs.add(slug)
        target = out / f'ensaio-{slug}-conferencia.jpg'
        sidecar = target.with_suffix('.json')
        source_hashes = {'prior_report': digest(old_path), 'trial_report': digest(report_path)}
        report = json.loads(report_path.read_text(encoding='utf-8'))
        views = [view for view in report['views'] if view['comodo'] == room]
        assert len({view['file'] for view in views}) == len(views), 'Duplicate trial filenames'
        ready.append(floor_candidates(root, out, slug, room, views, source_hashes))
        if target.exists() and sidecar.exists():
            cached = json.loads(sidecar.read_text(encoding='utf-8'))
            if cached.get('bytes') == target.stat().st_size and cached.get('sha256') == digest(target):
                assert cached.get('sources') == source_hashes, f'Validated JPEG belongs to different reports: {target}'
                assert cached.get('file') == str(target.relative_to(root)) and cached.get('room') == room
                ready.append(cached)
                continue
        canvas = Image.new('RGB', (1920, 2400), (240, 240, 240))
        draw = ImageDraw.Draw(canvas)
        rows = []
        for pitch in (-60, 0, 60):
            group = [view for view in views if view['pitch'] == pitch]
            assert group and all(math.isfinite(view['psnr']) for view in group), (room, pitch)
            group.sort(key=lambda view: (view['psnr'], view['file']))
            for rank, view in [('pior PSNR', group[0]), ('mediana', group[len(group) // 2])]:
                old = old_views[view['file']]
                assert old['comodo'] == room and old['pitch'] == pitch, view['file']
                with Image.open(root / old['eval_file']) as image:
                    previous = image.convert('RGB')
                with Image.open(root / view['eval_file']) as image:
                    current = image.convert('RGB')
                assert previous.size == current.size and current.width % 2 == 0, view['file']
                width, height = current.size
                half = width // 2
                gt_old = previous.crop((0, 0, half, height))
                gt_new = current.crop((0, 0, half, height))
                error = max(high for low, high in ImageChops.difference(gt_old, gt_new).getextrema())
                assert error <= 1, f"GT differs for {view['file']}: max error {error}"
                parts = [gt_new, previous.crop((half, 0, width, height)), current.crop((half, 0, width, height))]
                labels = ['GT', f"60 mil | PSNR {old['psnr']:.2f}", f"Isolado | PSNR {view['psnr']:.2f}"]
                y = len(rows) * 400
                for col, (part, label) in enumerate(zip(parts, labels)):
                    draw.text((col * 640 + 8, y + 3), f'{room} | {pitch:+d} | {rank} | {label}', fill=(0, 0, 0))
                    draw.text((col * 640 + 8, y + 19), view['file'], fill=(0, 0, 0))
                    canvas.paste(part.resize((640, 360)), (col * 640, y + 40))
                rows.append({'pitch': pitch, 'rank': rank, 'file': view['file'], 'gt_max_error': error})
        assert len(rows) == 6
        partial = target.with_suffix('.partial.jpg')
        canvas.save(partial, quality=94)
        partial.replace(target)
        metadata = {'file': str(target.relative_to(root)), 'room': room, 'bytes': target.stat().st_size,
                    'sha256': digest(target), 'sources': source_hashes, 'rows': rows, 'visual_review': 'pending'}
        write_json(sidecar, metadata)
        ready.append(metadata)
    manifest = {'files': ready, 'skipped': skipped, 'visual_review': 'pending'}
    manifest_path = out / 'manifesto.json'
    write_json(manifest_path, manifest)
    print(json.dumps({'manifest': str(manifest_path.relative_to(root)), **manifest}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
