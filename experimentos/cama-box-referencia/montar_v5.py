"""Cedros v5 = Cedros v4 (PBR) + cama assada carregando em niveis. Nao toca na v4.

    python montar_v5.py [--teto q3] [--destino .../cedros-v5/site]
"""
import argparse, hashlib, json, shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
V4 = RAIZ / 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v4/site'
PAGINA = 'maquete-monte-dos-cedros-37.html'
V4_SHA = '438fec10b8130a89b7f4306bc604d87d0123936dbdbaf8c5df59736ad717e927'   # manifesto da v4
LEVE = RAIZ / 'v1.5/miniaturas/publicado'                                      # sem acabamento PBR
LEVE_SHA = 'ebd8b117a22b234a2b66ef788775bc6c3b50e2723b9037f35dbd5f906f154a1c'
sha = lambda b: hashlib.sha256(b).hexdigest()
# Calibrado no quarto contra a cor da foto (fotos_cama.py + medir_cor.py, rodada c): tampo a 0,96
# do brilho e com o mesmo calor. A luz do interior e quase toda ceu: sem isto a cama sai azulada.
GANHO, LUZ = [1.5, 1.32, 1.02], 0.32

ap = argparse.ArgumentParser()
ap.add_argument('--teto', default='q3')
ap.add_argument('--base', choices=('v4', 'leve'), default='v4')
ap.add_argument('--destino', default=str(RAIZ / 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v5/site'))
a = ap.parse_args()
dst = Path(a.destino)
if dst.exists() and any(dst.iterdir()):
    raise SystemExit(f'{dst} ocupado; escolha outra pasta.')
BASE, BASE_SHA = (V4, V4_SHA) if a.base == 'v4' else (LEVE, LEVE_SHA)
html = (BASE / PAGINA).read_bytes()
if sha(html) != BASE_SHA:
    raise SystemExit('A base mudou; a comparacao deixaria de valer.')
s = html.decode('utf-8')
if s.count('</body>') != 1:
    raise SystemExit('Template inesperado.')
inj = ('<script src="cama-assada.js"></script><script>CamaAssada.start({THREE:THREE,maq:__maq,'
       f'url:"cama/",ate:{json.dumps(a.teto)},ganho:{json.dumps(GANHO)},luz:{LUZ}}});</script>')
# a cama entra ANTES do visual.js: os pedidos dela saem na frente dos 2,6 MB de parede e piso
ancora = '<script src="visual.js"></script>' if a.base == 'v4' else '</body>'
if s.count(ancora) != 1:
    raise SystemExit('Template inesperado.')
if a.base == 'v4':
    shutil.copytree(V4, dst, dirs_exist_ok=True)
else:
    dst.mkdir(parents=True, exist_ok=True)
(dst / PAGINA).write_text(s.replace(ancora, inj + ancora), encoding='utf-8')
shutil.copy(AQUI / 'cama-assada.js', dst / 'cama-assada.js')
shutil.copytree(AQUI / 'web-solteiro', dst / 'cama', dirs_exist_ok=True)
files = {p.relative_to(dst).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
         for p in sorted(dst.rglob('*')) if p.is_file() and p.name != 'manifesto.json'}
(dst / 'manifesto.json').write_text(json.dumps({'schema': 1, 'kind': 'cedros-cama-assada', 'base': {
    'arquivo': BASE.relative_to(RAIZ).as_posix() + '/' + PAGINA, 'sha256': BASE_SHA}, 'teto': a.teto,
    'files': files}, indent=1), encoding='utf-8')
print(json.dumps({'destino': str(dst), 'arquivos': len(files)}))
