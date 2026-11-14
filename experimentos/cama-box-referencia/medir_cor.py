import sys, numpy as np
from PIL import Image
ALVO = {'tampo': (166, 159, 156), 'lateral': (159, 143, 140)}       # foto de referencia
CX = {'tampo': (650, 360, 800, 400), 'lateral': (600, 440, 780, 480)}
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert('RGB'), float)
    out = []
    for k, (x0, y0, x1, y1) in CX.items():
        m = np.median(a[y0:y1, x0:x1].reshape(-1, 3), 0)
        out.append('%s %s (alvo %s, lum %.2f)' % (k, m.astype(int).tolist(), list(ALVO[k]), m.mean() / np.mean(ALVO[k])))
    print(p.split('/')[-1], ' | '.join(out))
