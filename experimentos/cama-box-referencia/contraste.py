"""Contraste local do tampo: desvio da luminancia depois de tirar o borrado (passa-alta).
   E o numero que diz se o tufo 'le' -- a media de cor nao enxerga relevo."""
import sys, numpy as np
from PIL import Image, ImageFilter
def mede(im, box=(150, 190, 450, 280)):
    g = im.convert('L').crop(box)
    a, b = np.asarray(g, float), np.asarray(g.filter(ImageFilter.GaussianBlur(6)), float)
    return (a - b).std()
ref = Image.open('referencia.webp')
print('referencia  %.2f' % mede(ref))
for p in sys.argv[1:]:
    print('%-11s %.2f' % (p.split('_')[-1].split('.')[0], mede(Image.open(p).resize(ref.size, Image.LANCZOS))))
