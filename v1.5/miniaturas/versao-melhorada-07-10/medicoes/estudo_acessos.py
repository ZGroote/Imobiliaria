"""Monta o ESTUDO-ACESSOS.md (acessos repetidos) a partir do que acessos.mjs mediu.

    node medicoes/acessos.mjs            # mede (resultados/acessos.json)
    python medicoes/estudo_acessos.py [--acessos 1000] [--interior 0.4] [--dolar 5.40]

Preço do Firebase Hosting: 360 MB/dia sem custo (franquia do PROJETO, dividida com o mapa e
o painel), depois US$ 0,15/GB. A conta usa os bytes que o navegador recebeu (corpo comprimido
mais cabeçalhos), que é o que sai do Hosting.
"""
from pathlib import Path
import argparse, json

AQUI = Path(__file__).resolve().parent
R = AQUI / 'resultados'
ap = argparse.ArgumentParser()
ap.add_argument('--acessos', type=int, default=1000)
ap.add_argument('--interior', type=float, default=0.4)
ap.add_argument('--dolar', type=float, default=5.40)
A = ap.parse_args()
FRANQUIA_DIA, USD_GB = 360e6, 0.15
MISTURA = {'desktop': 0.30, 'celular-4g': 0.50, 'celular-fraco': 0.20}
d = json.loads((R / 'acessos.json').read_text())
V = d['versoes']


# Defeito da v4 achado neste estudo: no celular, quando a capa sai, o <img> é tirado de dentro
# do <picture> e o navegador baixa a capa LARGA (o `src`), que nunca aparece. Esse pedido sai
# atrasado (às vezes já no trecho seguinte da sessão); aqui ele volta para o acesso em que a
# capa foi mostrada (o primeiro da maquete A, ou o da B), para a conta por acesso ficar certa.
CAPA_LARGA = __import__('re').compile(r'/assets/([^/]+)/capa-[0-9a-f]{12}\.webp$')
DONO = {'monte-dos-cedros-37': 'primeiroAcesso', 'imovel-b': 'outraMaquete'}
CAPA_EXTRA = {}


def _ajustados(v, p):
    runs = []
    for r in V[v]['perfis'][p]['execucoes']:
        b = {c: r[c]['bytesNavegador'] for c in r if isinstance(r[c], dict) and 'bytesNavegador' in r[c]}
        for c in list(b):
            for x in r[c]['recursos']:
                m = CAPA_LARGA.search(x['recurso'])
                if m and x['origem'] == 'rede' and V[v]['perfis'][p]['perfil']['mobile']:
                    b[c] -= x['bytesNavegador']; b[DONO[m.group(1)]] += x['bytesNavegador']
                    CAPA_EXTRA[(v, p)] = x['bytesNavegador']
        runs.append(b)
    return runs


def _mediana(xs):
    xs = sorted(x for x in xs if isinstance(x, (int, float)))
    return xs[len(xs) // 2] if xs else None


AJ = {(v, p): _ajustados(v, p) for v in V for p in V[v]['perfis']}


def med(v, p, c, k='bytesNavegador'):
    if k == 'bytesNavegador':
        return _mediana([r[c] for r in AJ[(v, p)]])
    return V[v]['perfis'][p]['mediana'][c][k]


def mb(b):
    if b < 1e4:
        return f'{b / 1e3:.1f} KB'.replace('.', ',')
    if b < 1e6:
        return f'{b / 1e3:.0f} KB'
    return f'{b / 1e6:.2f} MB'.replace('.', ',')


def seg(ms):
    return '—' if ms is None else f'{ms / 1000:.1f} s'.replace('.', ',')


def usd(x):
    return f'US$ {x:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


def brl(x):
    return f'R$ {x * A.dolar:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


CEN = [('primeiroAcesso', 'Primeiro acesso (nada guardado no aparelho)'),
       ('voltaMesmaMaquete', 'Volta à mesma maquete (outro dia)'),
       ('recarregar', 'Recarrega a página (F5 / puxar para atualizar)'),
       ('planta3dPrimeiraVez', '…e entra no apartamento pela 1ª vez'),
       ('voltaComPlanta3d', 'Volta outra vez à mesma maquete'),
       ('planta3dJaVista', '…e entra no apartamento de novo'),
       ('outraMaquete', 'Abre **outra** maquete do mesmo site'),
       ('outraMaquetePlanta3d', '…e entra no apartamento dela'),
       ('depoisDePublicar', 'Volta depois de uma publicação nova (correção no código)')]

out = {}
# ---- tabela principal: bytes ------------------------------------------------------------
t = ['| Situação | Versão atual | v4 — computador e celular médio | v4 — celular fraco |', '|---|---:|---:|---:|']
for c, nome in CEN:
    t.append(f"| {nome} | {mb(med('base', 'celular-4g', c))} | **{mb(med('nova', 'celular-4g', c))}** | **{mb(med('nova', 'celular-fraco', c))}** |")
out['BYTES'] = '\n'.join(t)

# ---- custo de 1.000 acessos de cada tipo ----------------------------------------------------
t = ['| Situação | Versão atual | v4 (mistura de aparelhos) |', '|---|---:|---:|']
def mistura(v, c):
    return sum(peso * med(v, p, c) for p, peso in MISTURA.items())
for c, nome in CEN:
    b, n = mistura('base', c) * 1000 / 1e9 * USD_GB, mistura('nova', c) * 1000 / 1e9 * USD_GB
    t.append(f'| {nome} | {usd(b)} ({brl(b)}) | **{usd(n)} ({brl(n)})** |')
out['MIL'] = '\n'.join(t)

# ---- tempo até a luz calculada, por aparelho ------------------------------------------------
PERF = [('desktop', 'Computador'), ('celular-4g', 'Celular médio (4G)'), ('celular-fraco', 'Celular fraco')]
t = ['| Situação | Aparelho | Versão atual | v4 |', '|---|---|---:|---:|']
for c, nome in [('primeiroAcesso', 'Primeiro acesso'), ('voltaMesmaMaquete', 'Volta à mesma maquete'),
                ('outraMaquete', 'Outra maquete do site'), ('depoisDePublicar', 'Depois de uma publicação nova')]:
    for i, (p, pn) in enumerate(PERF):
        t.append(f"| {nome if i == 0 else ''} | {pn} | {seg(med('base', p, c, 'luzMs'))} | **{seg(med('nova', p, c, 'luzMs'))}** |")
out['TEMPO'] = '\n'.join(t)
t = ['| Situação | Aparelho | Versão atual | v4 |', '|---|---|---:|---:|']
for c, nome in [('planta3dPrimeiraVez', 'Apartamento pela 1ª vez (já tinha visto a maquete)'), ('planta3dJaVista', 'Apartamento de novo'),
                ('outraMaquetePlanta3d', 'Apartamento de outra maquete')]:
    for i, (p, pn) in enumerate(PERF):
        t.append(f"| {nome if i == 0 else ''} | {pn} | {seg(med('base', p, c, 'ms'))} | **{seg(med('nova', p, c, 'ms'))}** |")
out['TEMPO3D'] = '\n'.join(t)

# ---- o que é baixado ao abrir outra maquete ---------------------------------------------------
def recursos(v, p, c):
    rs = V[v]['perfis'][p]['execucoes'][0][c]['recursos']
    return [(r['recurso'], r['origem'], r['bytesNavegador']) for r in rs]
t = ['| Arquivo | Para quê | Versão atual | v4 |', '|---|---|---:|---:|']
PARA = {'three': 'motor 3D (three.js)', 'basis_transcoder': 'decodificador das texturas', 'miniatura-': 'código da maquete',
        'KTX2Loader': 'carregador das texturas', 'maquete-': 'página (HTML)', 'predio': 'geometria do prédio',
        'exterior-uv': 'coordenadas da luz do prédio', 'exterior-luz': 'luz calculada do prédio', 'capa': 'imagem de capa'}
def para(u):
    return next((v for k, v in PARA.items() if k in u.split('/')[-1]), u.split('/')[-1])
def linha_origem(o, b):
    return 'do aparelho (0)' if o == 'cache' else ('confere, 304' if o == '304' else mb(b))
for v in ('nova',):
    for u, o, b in recursos(v, 'celular-4g', 'outraMaquete'):
        t.append(f"| `{u.split('/')[-1]}` | {para(u)} | | {linha_origem(o, b)} |")
base_rs = recursos('base', 'celular-4g', 'outraMaquete')
t.append('| *versão atual:* ' + ', '.join(f"`{u.split('/')[-1]}`" for u, _, _ in base_rs) +
         ' | página com o motor 3D e o código embutidos, mais os dados do imóvel | ' +
         mb(sum(b for _, _, b in base_rs)) + ' | |')
out['OUTRA'] = '\n'.join(t)

# ---- mês: 1.000 acessos por dia em três situações --------------------------------------------
I = A.interior
def por_acesso(v, mix):
    """mix: fração de primeiros acessos, voltas à mesma maquete e aberturas de outra maquete."""
    tot = 0.0
    for p, peso in MISTURA.items():
        m = lambda c: med(v, p, c)
        primeiro = m('primeiroAcesso') + I * m('planta3dPrimeiraVez')
        # quem volta entra no apartamento com a mesma chance; só baixa se não tinha entrado antes
        volta = m('voltaMesmaMaquete') + I * (1 - I) * m('planta3dPrimeiraVez')
        outra = m('outraMaquete') + I * m('outraMaquetePlanta3d')
        tot += peso * (mix[0] * primeiro + mix[1] * volta + mix[2] * outra)
    return tot
MIXES = [('Ninguém volta (pior caso: todo acesso com o aparelho vazio)', (1, 0, 0)),
         ('Padrão: 60% primeiro acesso, 25% voltas, 15% outra maquete', (0.60, 0.25, 0.15)),
         ('Catálogo: cada pessoa vê 3 maquetes (1 primeiro acesso + 2 outras)', (1 / 3, 0, 2 / 3))]
t = ['| Situação | | MB por acesso | GB/mês | Custo/mês com a franquia | Sem a franquia |', '|---|---|---:|---:|---:|---:|']
for nome, mix in MIXES:
    for i, v in enumerate(('base', 'nova')):
        pa = por_acesso(v, mix)
        dia = pa * A.acessos
        custo = max(0, dia - FRANQUIA_DIA) * 30 / 1e9 * USD_GB
        num = lambda x, casas: f'{x:.{casas}f}'.replace('.', ',')
        t.append(f"| {nome if i == 0 else ''} | {'atual' if v == 'base' else '**v4**'} | {num(pa / 1e6, 2)} | "
                 f"{num(dia * 30 / 1e9, 1)} | {usd(custo)} ({brl(custo)}) | {usd(dia * 30 / 1e9 * USD_GB)} |")
out['MES'] = '\n'.join(t)
out['PREMISSAS'] = (f"{A.acessos:,} acessos por dia".replace(',', '.') + f"; {int(I * 100)}% entram no apartamento; aparelhos "
                    "30% computador, 50% celular médio, 20% celular fraco; dólar a " + f"R$ {A.dolar:.2f}".replace('.', ','))

# ---- números soltos usados no texto --------------------------------------------------------------
def kb(v, p, c):
    return mb(med(v, p, c))
out['VOLTA_V4'] = kb('nova', 'celular-4g', 'voltaMesmaMaquete')
out['VOLTA_BASE'] = kb('base', 'celular-4g', 'voltaMesmaMaquete')
out['OUTRA_V4'] = kb('nova', 'celular-4g', 'outraMaquete')
out['OUTRA_V4_FRACO'] = kb('nova', 'celular-fraco', 'outraMaquete')
out['OUTRA_BASE'] = kb('base', 'celular-4g', 'outraMaquete')
out['PRIMEIRO_V4'] = kb('nova', 'celular-4g', 'primeiroAcesso')
out['PRIMEIRO_BASE'] = kb('base', 'celular-4g', 'primeiroAcesso')
out['PUB_V4'] = kb('nova', 'celular-4g', 'depoisDePublicar')
out['PUB_BASE'] = kb('base', 'celular-4g', 'depoisDePublicar')
out['QUANDO'] = d['quando'][:10]
out['CONFERE'] = max(abs(m[c]['bytesNavegador'] - m[c]['bytesServidor']) for v in V for p in V[v]['perfis']
                     for m in [V[v]['perfis'][p]['mediana']] for c, _ in CEN)
out['CAPA_EXTRA'] = mb(max(CAPA_EXTRA.values())) if CAPA_EXTRA else '0 KB'

modelo = (AQUI / 'estudo-acessos-modelo.md').read_text(encoding='utf8')
for k, v in out.items():
    modelo = modelo.replace(f'@@{k}@@', str(v))
assert '@@' not in modelo, [l for l in modelo.splitlines() if '@@' in l]
(AQUI.parent / 'ESTUDO-ACESSOS.md').write_text(modelo, encoding='utf8')
print('ESTUDO-ACESSOS.md:', len(modelo), 'caracteres')
