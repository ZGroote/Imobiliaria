"""Diferença entre as capturas `<vista>-base.png` e `<vista>-nova.png` de compara.mjs.

    python medicoes/psnr.py [medicoes/comparacao]

PSNR (acima de ~40 dB a diferença não se percebe) e a fração de pixels que mudou mais de 8
níveis (de 255). Grava `<vista>-dif.png` com a diferença ampliada 6 vezes.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

pasta = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / 'comparacao')
out = {}
for b in sorted(pasta.glob('*-base.png')):
    v = b.name[:-len('-base.png')]
    n = pasta / f'{v}-nova.png'
    if not n.exists():
        continue
    A = np.asarray(Image.open(b).convert('RGB'), dtype=np.float64)
    B = np.asarray(Image.open(n).convert('RGB'), dtype=np.float64)
    d = np.abs(A - B)
    mse = float((d ** 2).mean())
    psnr = 99.0 if mse == 0 else 10 * np.log10(255 ** 2 / mse)
    out[v] = {'psnr': round(psnr, 2), 'pctAcima8': round(float((d.max(axis=2) > 8).mean() * 100), 2)}
    Image.fromarray(np.clip(d * 6, 0, 255).astype(np.uint8)).save(pasta / f'{v}-dif.png')
(pasta / 'psnr.json').write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
