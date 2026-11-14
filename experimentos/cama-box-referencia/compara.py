"""Referencia x render: lado a lado, sobreposicao 50% e cor por regiao.
   python compara.py render_rN.png  ->  comp_rN.png + numeros no terminal"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
ref = Image.open('referencia.webp').convert('RGB')
src = sys.argv[1]
ren = Image.open(src).convert('RGB').resize(ref.size, Image.LANCZOS)
tag = src.split('_')[-1].split('.')[0]
w, h = ref.size
lado = Image.new('RGB', (w * 3 + 20, h), 'white')
lado.paste(ref, (0, 0)); lado.paste(ren, (w + 10, 0))
lado.paste(Image.blend(ref, ren, 0.5), (2 * w + 20, 0))
d = ImageDraw.Draw(lado)
for i, t in enumerate(('referencia', 'render ' + tag, 'sobreposicao 50%')):
    d.rectangle((i * (w + 10), 0, i * (w + 10) + 130, 16), fill='black'); d.text((i * (w + 10) + 4, 3), t, fill='white')
lado.save('comp_%s.png' % tag)
R = json.load(open('regioes.json'))
a, b = np.asarray(ref, float), np.asarray(ren, float)
print('%-16s %-15s %-15s %s' % ('regiao', 'ref rgb', 'render rgb', 'razao lum'))
for k, (x0, y0, x1, y1) in R.items():
    ma, mb = np.median(a[y0:y1, x0:x1].reshape(-1, 3), 0), np.median(b[y0:y1, x0:x1].reshape(-1, 3), 0)
    print('%-16s %-15s %-15s %.2f' % (k, list(ma.astype(int)), list(mb.astype(int)), mb.mean() / max(ma.mean(), 1)))
