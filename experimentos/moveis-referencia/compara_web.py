"""Cycles x navegador (e a foto): tres paineis + cor por regiao.
   python compara_web.py peca render_cycles.png three.png tag"""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
peca, cy, th, tag = sys.argv[1:5]
ref = Image.open(next(f"{peca}/referencia.{e}" for e in ("png", "webp") if os.path.exists(f"{peca}/referencia.{e}"))).convert('RGB')
a = Image.open(cy).convert('RGB').resize(ref.size, Image.LANCZOS)
b = Image.open(th).convert('RGB').resize(ref.size, Image.LANCZOS)
if a.getpixel((2, 2)) == (0, 0, 0) and Image.open(cy).mode == 'RGBA':
    f = Image.new('RGBA', Image.open(cy).size, (255, 255, 255, 255)); f.alpha_composite(Image.open(cy)); a = f.convert('RGB').resize(ref.size, Image.LANCZOS)
w, h = ref.size
lado = Image.new('RGB', (w * 3 + 20, h), 'white')
for i, (im, t) in enumerate(((ref, 'referencia'), (a, 'cycles'), (b, 'navegador ' + tag))):
    lado.paste(im, (i * (w + 10), 0))
    d = ImageDraw.Draw(lado); d.rectangle((i * (w + 10), 0, i * (w + 10) + 150, 14), fill='black'); d.text((i * (w + 10) + 4, 2), t, fill='white')
lado.save(f'web/{peca}/cmp_{tag}.png')
A, B, R = (np.asarray(x, float) for x in (a, b, ref))
print('%-14s %-15s %-15s %-15s %s' % ('regiao', 'foto', 'cycles', 'navegador', 'nav/cycles'))
e = []
for k, (x0, y0, x1, y1) in json.load(open(f'{peca}/regioes.json')).items():
    m = [np.median(X[y0:y1, x0:x1].reshape(-1, 3), 0) for X in (R, A, B)]
    r = m[2].mean() / max(m[1].mean(), 1); e.append(abs(m[2].mean() - m[1].mean()) / max(m[1].mean(), 30))
    print('%-14s %-15s %-15s %-15s %.2f' % (k, *[x.astype(int).tolist() for x in m], r))
print('erro medio navegador x cycles %.1f%% (|dif| / max(cycles, 30))' % (100 * np.mean(e)))
