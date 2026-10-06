"""Cycles (alvo) x three assado: lado a lado, sobreposicao, cor da cama e contraste do tampo.
   python compara_three.py render_p3.png three_t1.png"""
import sys, json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
alvo, teste = sys.argv[1], sys.argv[2]
tag = teste.rsplit('_', 1)[-1].split('.')[0]
A = Image.open(alvo).convert('RGB'); B = Image.open(teste).convert('RGB').resize(A.size, Image.LANCZOS)
w, h = A.size[0] // 2, A.size[1] // 2
a2, b2 = A.resize((w, h), Image.LANCZOS), B.resize((w, h), Image.LANCZOS)
out = Image.new('RGB', (w * 3 + 20, h), 'white')
for i, (im, t) in enumerate(((a2, 'Cycles (render)'), (b2, 'three assado ' + tag), (Image.blend(a2, b2, 0.5), 'sobreposicao 50%'))):
    out.paste(im, (i * (w + 10), 0)); d = ImageDraw.Draw(out)
    d.rectangle((i * (w + 10), 0, i * (w + 10) + 150, 16), fill='black'); d.text((i * (w + 10) + 4, 3), t, fill='white')
out.save('comp3_%s.png' % tag)
R = {k: v for k, v in json.load(open('regioes.json')).items()
     if k in ('base', 'colchao_lado', 'topo', 'trav_esq', 'trav_dir', 'almofada', 'lado_dir', 'piso_dir')}
x, y = np.asarray(a2.resize((605, 595)), float), np.asarray(b2.resize((605, 595)), float)
print('%-13s %-15s %-15s %s' % ('regiao', 'cycles', 'three', 'razao'))
for k, (x0, y0, x1, y1) in R.items():
    ma, mb = np.median(x[y0:y1, x0:x1].reshape(-1, 3), 0), np.median(y[y0:y1, x0:x1].reshape(-1, 3), 0)
    print('%-13s %-15s %-15s %.2f' % (k, list(ma.astype(int)), list(mb.astype(int)), mb.mean() / max(ma.mean(), 1)))
def ctr(im):
    g = im.resize((605, 595), Image.LANCZOS).convert('L').crop((150, 190, 450, 280))
    p, q = np.asarray(g, float), np.asarray(g.filter(ImageFilter.GaussianBlur(6)), float)
    return (p - q).std()
print('contraste do tampo: cycles %.2f  three %.2f  (foto 16,21)' % (ctr(A), ctr(B)))
