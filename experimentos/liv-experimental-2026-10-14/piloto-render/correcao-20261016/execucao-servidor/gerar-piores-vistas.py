"""Generate worst-view contact sheets on the server; no visual approval is inferred."""
import argparse
import json
import math
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/root/liv-corrigido-20261016'))
    root = parser.parse_args().root
    assert (root / 'denso16-concluido').exists(), 'Dense pipeline is not complete'
    report_path = Path('analise-ambientes/metricas-por-ambiente.json')
    prior = json.loads((root / 'resultado-refino60k' / report_path).read_text(encoding='utf-8'))
    dense = json.loads((root / 'resultado-denso16' / report_path).read_text(encoding='utf-8'))
    old_views = {view['file']: view for view in prior['views']}
    assert len(old_views) == len(prior['views']), 'Duplicate filenames in prior report'
    assert len({view['file'] for view in dense['views']}) == len(dense['views']), 'Duplicate dense filenames'
    rooms = sorted(dense['rooms'])
    assert len(rooms) == 6 and set(rooms) == set(prior['rooms']), 'Expected the same six rooms'
    out = root / 'comparacao-visual-denso16-piores'
    out.mkdir(exist_ok=True)
    generated = []
    slugs = set()
    for room in rooms:
        slug = re.sub('[^a-z0-9]+', '-', unicodedata.normalize('NFKD', room).encode('ascii', 'ignore').decode().lower()).strip('-')
        assert slug and slug not in slugs, f'Invalid or duplicate slug: {room}'
        slugs.add(slug)
        canvas = Image.new('RGB', (1920, 1170), (240, 240, 240))
        draw = ImageDraw.Draw(canvas)
        for row, pitch in enumerate([-60, 0, 60]):
            group = [view for view in dense['views'] if view['comodo'] == room and view['pitch'] == pitch]
            assert group and all(math.isfinite(view['psnr']) for view in group), (room, pitch)
            view = min(group, key=lambda item: (item['psnr'], item['file']))
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
            labels = ['Referencia', '60 mil anterior', f"Denso16 | PSNR {view['psnr']:.2f}"]
            for col, (part, label) in enumerate(zip(parts, labels)):
                draw.text((col * 640 + 8, row * 390 + 7), f"{room} | {pitch} | {view['file']} | {label}", fill=(0, 0, 0))
                canvas.paste(part.resize((640, 360)), (col * 640, row * 390 + 30))
        target = out / (slug + '.jpg')
        partial = out / (slug + '.partial.jpg')
        canvas.save(partial, quality=94)
        partial.replace(target)
        generated.append(str(target.relative_to(root)))
    print(json.dumps({'generated': generated}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
