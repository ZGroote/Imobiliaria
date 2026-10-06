"""Cedros v6 = LEVE enxuta (enxuga.py) + cama assada otimizada (web-solteiro-v2). Nao toca na v5.
    python montar_v6.py [--destino ...]  e depois  python montar_v6.py --confere"""
import argparse, hashlib, json, shutil, sys
from pathlib import Path
import enxuga

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
PAGINA = 'maquete-monte-dos-cedros-37.html'
LEVE = RAIZ / 'v1.5/miniaturas/publicado' / PAGINA
LEVE_SHA = 'ebd8b117a22b234a2b66ef788775bc6c3b50e2723b9037f35dbd5f906f154a1c'
DST = RAIZ / 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v6/site-leve'
GANHO, LUZ = [1.5, 1.32, 1.02], 0.32           # calibrado na v5 (fotos_cama.py + medir_cor.py)
sha = lambda b: hashlib.sha256(b).hexdigest()

ap = argparse.ArgumentParser()
ap.add_argument('--teto', default='q3')
ap.add_argument('--confere', action='store_true')
a = ap.parse_args()

if a.confere:
    # o mesmo movel, o mesmo numero de triangulos, nas duas paginas (cama assada desligada)
    rel = lambda p: p.relative_to(RAIZ).as_posix()
    orig = enxuga.percorre(rel(LEVE))
    novo = enxuga.percorre(rel(DST / PAGINA), q='?cama=q0')
    dif = {k: (orig['tri'].get(k), novo['tri'].get(k)) for k in set(orig['tri']) | set(novo['tri'])
           if orig['tri'].get(k) != novo['tri'].get(k)}
    print(json.dumps({'moveis': len(orig['tri']), 'diferentes': dif, 'erros': novo['erros']}, indent=1))
    sys.exit(1 if dif or novo['erros'] else 0)

if DST.exists() and any(DST.iterdir()):
    raise SystemExit(f'{DST} ocupado; escolha outra pasta.')
html = LEVE.read_bytes()
if sha(html) != LEVE_SHA:
    raise SystemExit('A LEVE mudou; a comparacao deixaria de valer.')
ped = json.loads((AQUI / 'pecas-usadas.json').read_text(encoding='utf-8'))['pedidas']
usadas = sorted(k for k, n in ped.items() if n > 2)      # 2 leituras = so o laco de init
s, three = enxuga.deriva(html.decode('utf-8'), usadas)
W = AQUI / 'web-solteiro-v2'
tam = json.loads((W / 'cama.json').read_text())['tam']
inj = ('<script src="cama-assada.js"></script><script>CamaAssada.start({THREE:THREE,maq:__maq,url:"cama/",'
       f'ate:{json.dumps(a.teto)},ganho:{json.dumps(GANHO)},luz:{LUZ},tam:{json.dumps(tam)},quando:"visita"}});</script>')
if s.count('</body>') != 1:
    raise SystemExit('Template inesperado.')
DST.mkdir(parents=True, exist_ok=True)
(DST / PAGINA).write_text(s.replace('</body>', inj + '</body>'), encoding='utf-8')
(DST / 'three.min.js').write_text(three, encoding='utf-8')
shutil.copy(AQUI / 'cama-assada.js', DST / 'cama-assada.js')
shutil.copytree(W, DST / 'cama', dirs_exist_ok=True)
files = {p.relative_to(DST).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
         for p in sorted(DST.rglob('*')) if p.is_file() and p.name != 'manifesto.json'}
(DST / 'manifesto.json').write_text(json.dumps({'schema': 1, 'kind': 'cedros-leve-enxuta-cama', 'base': {
    'arquivo': LEVE.relative_to(RAIZ).as_posix(), 'sha256': LEVE_SHA}, 'pecas_mantidas': usadas,
    'teto': a.teto, 'files': files}, indent=1), encoding='utf-8')
print(json.dumps({'pecas_mantidas': usadas, 'html_kb': files[PAGINA]['bytes'] // 1024,
                  'three_kb': files['three.min.js']['bytes'] // 1024}))
