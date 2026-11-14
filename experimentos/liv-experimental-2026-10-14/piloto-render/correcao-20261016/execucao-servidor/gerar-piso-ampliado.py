"""Compare selected floor views on the server without changing camera coordinates."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/root/liv-corrigido-20261016'))
    root = parser.parse_args().root
    old_path = root / 'resultado-refino60k/analise-ambientes/metricas-por-ambiente.json'
    prior = json.loads(old_path.read_text(encoding='utf-8'))
    old_views = {view['file']: view for view in prior['views']}
    assert len(old_views) == len(prior['views']), 'Duplicate prior filenames'
    items = json.loads((root / 'ensaios-comodos/manifesto.json').read_text(encoding='utf-8'))
    selected = {
        'Banho': ('banho', ['f0589.png', 'f2112.png']),
        'Banho suíte': ('banho-suite', ['f2156.png', 'f2178.png']),
    }
    out = root / 'comparacao-visual-ensaios'
    out.mkdir(exist_ok=True)
    generated = []
    for room, (slug, filenames) in selected.items():
        matches = [item for item in items if item['room'] == room]
        assert len(matches) == 1, f'Expected one trial for {room}'
        report_path = root / Path(matches[0]['directory']) / 'resultado/analise-ambientes/metricas-por-ambiente.json'
        report = json.loads(report_path.read_text(encoding='utf-8'))
        sources = {'prior_report': digest(old_path), 'trial_report': digest(report_path)}
        target = out / f'ensaio-{slug}-piso-ampliado.jpg'
        sidecar = target.with_suffix('.json')
        if target.exists() and sidecar.exists():
            cached = json.loads(sidecar.read_text(encoding='utf-8'))
            if cached.get('bytes') == target.stat().st_size and cached.get('sha256') == digest(target):
                assert cached.get('sources') == sources and cached.get('selected_ids') == filenames
                assert cached.get('file') == str(target.relative_to(root)) and cached.get('room') == room
                generated.append(cached)
                continue
        canvas = Image.new('RGB', (1920, 800), (240, 240, 240))
        draw = ImageDraw.Draw(canvas)
        rows = []
        for row, filename in enumerate(filenames):
            matches = [view for view in report['views'] if view['comodo'] == room and Path(view['file']).name == filename]
            assert len(matches) == 1, (room, filename, 'missing or ambiguous view')
            view = matches[0]
            old = old_views[view['file']]
            assert view['pitch'] == old['pitch'] == -60 and old['comodo'] == room, filename
            with Image.open(root / old['eval_file']) as image:
                previous = image.convert('RGB')
            with Image.open(root / view['eval_file']) as image:
                current = image.convert('RGB')
            assert previous.size == current.size and current.width % 2 == 0, filename
            width, height = current.size
            half = width // 2
            gt_old = previous.crop((0, 0, half, height))
            gt_new = current.crop((0, 0, half, height))
            error = max(high for low, high in ImageChops.difference(gt_old, gt_new).getextrema())
            assert error <= 1, f'GT differs for {filename}: max error {error}'
            parts = [gt_new, previous.crop((half, 0, width, height)), current.crop((half, 0, width, height))]
            labels = ['GT', f"60 mil | PSNR {old['psnr']:.2f}", f"Isolado | PSNR {view['psnr']:.2f}"]
            for col, (part, label) in enumerate(zip(parts, labels)):
                x, y = col * 640, row * 400
                draw.text((x + 8, y + 3), f'{room} | {filename} | {label}', fill=(0, 0, 0))
                draw.text((x + 8, y + 19), f"{view['file']} | pitch -60 | camera original", fill=(0, 0, 0))
                canvas.paste(part.resize((640, 360)), (x, y + 40))
            rows.append({'file': view['file'], 'pitch': -60, 'gt_max_error': error})
        partial = target.with_suffix('.partial.jpg')
        canvas.save(partial, quality=94)
        partial.replace(target)
        metadata = {'file': str(target.relative_to(root)), 'room': room, 'bytes': target.stat().st_size,
                    'sha256': digest(target), 'sources': sources, 'selected_ids': filenames, 'rows': rows,
                    'coordinates': 'original; only preview resizing', 'visual_review': 'pending'}
        partial_meta = sidecar.with_suffix('.partial.json')
        partial_meta.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
        partial_meta.replace(sidecar)
        generated.append(metadata)
    print(json.dumps({'files': generated, 'visual_review': 'pending'}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
