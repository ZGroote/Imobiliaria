"""Referencia x render: lado a lado + sobreposicao 50% + cor por regiao (peca/regioes.json).
   python compara.py peca render.png tag   ->  peca/comp_<tag>.png + tabela"""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
peca, src, tag = sys.argv[1:4]
ref = Image.open(next(f"{peca}/referencia.{e}" for e in ("png", "webp") if os.path.exists(f"{peca}/referencia.{e}"))).convert('RGB')
ren = Image.open(src)
if ren.mode == 'RGBA':                          # fundo transparente: a foto e recortada no branco
    fundo = Image.new('RGBA', ren.size, (255, 255, 255, 255)); fundo.alpha_composite(ren); ren = fundo
ren = ren.convert('RGB').resize(ref.size, Image.LANCZOS)
w, h = ref.size
lado = Image.new('RGB', (w * 3 + 20, h), 'white')
lado.paste(ref, (0, 0)); lado.paste(ren, (w + 10, 0)); lado.paste(Image.blend(ref, ren, 0.5), (2 * w + 20, 0))
d = ImageDraw.Draw(lado)
for i, t in enumerate(('referencia', 'render ' + tag, 'sobreposicao 50%')):
    d.rectangle((i * (w + 10), 0, i * (w + 10) + 130, 14), fill='black'); d.text((i * (w + 10) + 4, 2), t, fill='white')
lado.save(f'{peca}/comp_{tag}.png')
a, b = np.asarray(ref, float), np.asarray(ren, float)
print('%-14s %-15s %-15s %s' % ('regiao', 'ref rgb', 'render rgb', 'razao lum'))
erros = []
for k, (x0, y0, x1, y1) in json.load(open(f'{peca}/regioes.json')).items():
    ma, mb = np.median(a[y0:y1, x0:x1].reshape(-1, 3), 0), np.median(b[y0:y1, x0:x1].reshape(-1, 3), 0)
    r = mb.mean() / max(ma.mean(), 1)
    erros.append(abs(mb.mean() - ma.mean()) / max(ma.mean(), 30))    # regiao quase preta: diferenca, nao razao
    print('%-14s %-15s %-15s %.2f' % (k, ma.astype(int).tolist(), mb.astype(int).tolist(), r))
print('erro medio de luminancia %.1f%% (|dif| / max(ref, 30))' % (100 * np.mean(erros)))
