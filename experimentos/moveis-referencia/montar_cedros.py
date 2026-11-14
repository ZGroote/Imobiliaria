"""Cedros v7 = Cedros v6 (LEVE enxuta + cama assada) + movel-web.js com as pecas de moveis-referencia.
Nao toca na v6.
    python montar_cedros.py [--pecas geladeira:B,...] [--destino .../cedros-v7/site-leve]"""
import argparse, hashlib, json, shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
PAGINA = 'maquete-monte-dos-cedros-37.html'
V6 = RAIZ / 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v6/site-leve'
sha = lambda b: hashlib.sha256(b).hexdigest()
TAM = 512

ap = argparse.ArgumentParser()
ap.add_argument('--pecas', default='geladeira:B')   # tipo:modo[:pasta em web/[:ajuste caixa|altura|plano|real[:esconde+outro]]]
ap.add_argument('--destino', default=str(RAIZ / 'publicacao/piloto-qualidade-visual-2026-10-04/cedros-v7/site-leve'))
# cama BN (prep_bn.py): troca o pacote da cama e o carregador; teto = nivel (q2 = 384, q3 = 512)
ap.add_argument('--cama-bn', default=None, metavar='TETO')
# a cama vira peca do movel-web (ex.: cama:BN:cama-madeira-solteiro:caixa): tira a cama assada da pagina
ap.add_argument('--sem-cama-assada', action='store_true')
a = ap.parse_args()
dst = Path(a.destino)
if dst.exists() and any(dst.iterdir()):
    raise SystemExit(f'{dst} ocupado; escolha outra pasta.')
html = (V6 / PAGINA).read_text(encoding='utf-8')
if html.count('</body>') != 1:
    raise SystemExit('Template inesperado.')
pecas = [dict(zip(('tipo', 'modo', 'pasta', 'ajuste', 'esconde'), p.split(':'))) for p in a.pecas.split(',')]
for p in pecas:
    p['esconde'] = p['esconde'].split('+') if p.get('esconde') else []
shutil.copytree(V6, dst)
if a.sem_cama_assada:
    import re
    html, n = re.subn(r'<script src="cama-assada\.js"></script><script>CamaAssada\.start\(.*?\);</script>', '', html, flags=re.S)
    if n != 1:
        raise SystemExit('carregador da cama nao encontrado')
    shutil.rmtree(dst / 'cama')
    (dst / 'cama-assada.js').unlink()
if a.cama_bn:
    import re
    CB = RAIZ / 'experimentos/cama-box-referencia'
    shutil.rmtree(dst / 'cama')
    shutil.copytree(CB / 'web-solteiro-bn', dst / 'cama')
    shutil.copy(CB / 'cama-assada.js', dst / 'cama-assada.js')
    tam = json.loads((CB / 'web-solteiro-bn' / 'cama.json').read_text())['tam']
    novo, n = re.subn(r'ate:"q\d",(ganho:\[[^\]]*\],luz:[\d.]+,)tam:\{[^}]*\}',
                      lambda g: 'ate:%s,%stam:%s' % (json.dumps(a.cama_bn), g.group(1), json.dumps(tam)), html)
    if n != 1:
        raise SystemExit('chamada da cama nao encontrada')
    html = novo
M = dst / 'moveis'
texs = set()
for p in pecas:
    p.setdefault('pasta', p['tipo'])
    p.setdefault('ajuste', 'caixa')
    W = AQUI / 'web' / p['pasta']
    (M / p['pasta']).mkdir(parents=True, exist_ok=True)
    J = json.loads((W / 'peca.json').read_text())
    # so o que o navegador le: sem camera/luzes/ambiente/cenario do estudio
    leve = {k: J[k] for k in ('peca', 'grupos', 'materiais', 'tri')}
    (M / p['pasta'] / 'peca.json').write_text(json.dumps(leve, separators=(',', ':')), encoding='utf-8')
    shutil.copy(W / 'geo.bin', M / p['pasta'] / 'geo.bin')
    for f in ('avif', 'webp'):
        shutil.copy(W / f'ao-{TAM}.{f}', M / p['pasta'] / f'ao-{TAM}.{f}')
        if p['modo'] == 'BN':
            shutil.copy(W / f'relevo-{TAM}.{f}', M / p['pasta'] / f'relevo-{TAM}.{f}')
    texs |= {m['tex'] for m in J['materiais'].values() if m['tex']}
(M / 'materiais').mkdir(parents=True, exist_ok=True)
for t in texs:
    for k in ('cor', 'nor'):
        for f in ('avif', 'webp'):
            shutil.copy(AQUI / 'web/materiais' / f'{t}-{k}-{TAM}.{f}', M / 'materiais' / f'{t}-{k}-{TAM}.{f}')
shutil.copy(AQUI / 'movel-web.js', dst / 'movel-web.js')
inj = ('<script src="movel-web.js"></script><script>MovelWeb.start({THREE:THREE,maq:__maq,url:"moveis/",'
       f'tam:{TAM},quando:"visita",pecas:{json.dumps([{k: p[k] for k in ("tipo", "modo", "pasta", "ajuste", "esconde")} for p in pecas])}}});</script>')
(dst / PAGINA).write_text(html.replace('</body>', inj + '</body>'), encoding='utf-8')
files = {p.relative_to(dst).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
         for p in sorted(dst.rglob('*')) if p.is_file() and p.name != 'manifesto.json'}
(dst / 'manifesto.json').write_text(json.dumps({'schema': 1, 'kind': 'cedros-v6-mais-moveis', 'base': {
    'pasta': V6.relative_to(RAIZ).as_posix(), 'sha256_pagina': sha((V6 / PAGINA).read_bytes())}, 'pecas': pecas, 'cama_bn': a.cama_bn, 'sem_cama_assada': a.sem_cama_assada,
    'files': files}, indent=1), encoding='utf-8')
print(json.dumps({'destino': str(dst), 'pecas': pecas, 'moveis_kb': round(sum(v['bytes'] for k, v in files.items()
      if k.startswith('moveis/') and not k.endswith('.webp')) / 1024, 1)}))
