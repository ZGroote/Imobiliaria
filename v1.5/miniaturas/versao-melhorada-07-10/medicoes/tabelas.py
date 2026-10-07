"""Gera as tabelas do RELATORIO.md a partir dos resultados medidos (medicoes/resultados/*.json).

    python medicoes/tabelas.py  > medicoes/resultados/tabelas.md
"""
from pathlib import Path
import json

R = Path(__file__).resolve().parent / 'resultados'
base = json.loads((R / 'base.json').read_text())
nova = json.loads((R / 'nova.json').read_text())
PERFIS = [('desktop', 'Computador (Wi-Fi 50 Mbps)'), ('celular-4g', 'Celular intermediário (4G 12 Mbps, CPU 4× mais lenta)'),
          ('celular-fraco', 'Celular fraco (4G ruim 1,6 Mbps, CPU 6× mais lenta)')]


def s(ms):
    return '—' if ms is None else f'{ms / 1000:.1f} s'.replace('.', ',')


def mb(b):
    return f'{b / 1e6:.2f} MB'.replace('.', ',')


def x(a, b):
    if not a or not b:
        return ''
    r = a / b
    return f'{r:.1f}×'.replace('.', ',') if r >= 1 else f'−{(1 - r) * 100:.0f}%'


def med(res, p, k):
    return res['perfis'][p]['mediana'].get(k)


def exe(res, p, k1, k2):
    vals = sorted(e[k1][k2] for e in res['perfis'][p]['execucoes'])
    return vals[len(vals) // 2]


out = []
out.append('### Abertura e transferência (mediana de 3 execuções por perfil)\n')
out.append('| Perfil | | Versão atual | v4 | Ganho |')
out.append('|---|---|---:|---:|---:|')
for p, nome in PERFIS:
    b_img = med(base, p, 'primeiroDesenhoMs')
    n_img = med(nova, p, 'primeiraImagemMs')
    linhas = [
        ('Primeira imagem da maquete', s(b_img), s(n_img), x(b_img, n_img)),
        ('Maquete com a luz calculada', s(med(base, p, 'luzExteriorMs')), s(med(nova, p, 'luzExteriorMs')),
         x(med(base, p, 'luzExteriorMs'), med(nova, p, 'luzExteriorMs'))),
        ('Bytes para abrir', mb(med(base, p, 'bytesAbrir')), mb(med(nova, p, 'bytesAbrir')),
         x(med(base, p, 'bytesAbrir'), med(nova, p, 'bytesAbrir'))),
        ('Entrar na Planta 3D (clique → luz interna)', s(med(base, p, 'planta3dMs')), s(med(nova, p, 'planta3dMs')),
         x(med(base, p, 'planta3dMs'), med(nova, p, 'planta3dMs'))),
        ('Bytes a mais na Planta 3D', mb(med(base, p, 'bytesPlanta3d')), mb(med(nova, p, 'bytesPlanta3d')),
         x(med(base, p, 'bytesPlanta3d'), med(nova, p, 'bytesPlanta3d'))),
        ('Revisita (cache): luz pronta', s(med(base, p, 'revisitaLuzMs')), s(med(nova, p, 'revisitaLuzMs')),
         x(med(base, p, 'revisitaLuzMs'), med(nova, p, 'revisitaLuzMs'))),
    ]
    for i, (k, a, b, g) in enumerate(linhas):
        out.append(f'| {nome if i == 0 else ""} | {k} | {a} | {b} | {g} |')
out.append('')
out.append('### Memória e trabalho parado (execução mediana)\n')
out.append('| Perfil | | Versão atual | v4 |')
out.append('|---|---|---:|---:|')
for p, nome in PERFIS:
    rows = [
        ('GPU com a maquete aberta', f"{exe(base, p, 'memoriaMaquete', 'gpuMiB'):.0f} MiB", f"{exe(nova, p, 'memoriaMaquete', 'gpuMiB'):.0f} MiB"),
        ('GPU depois de abrir todos os modos', f"{exe(base, p, 'memoriaTudo', 'gpuMiB'):.0f} MiB", f"{exe(nova, p, 'memoriaTudo', 'gpuMiB'):.0f} MiB"),
        ('…dos quais texturas', f"{exe(base, p, 'memoriaTudo', 'texturasMiB'):.0f} MiB", f"{exe(nova, p, 'memoriaTudo', 'texturasMiB'):.0f} MiB"),
        ('Memória JavaScript ao abrir', f"{exe(base, p, 'memoriaMaquete', 'heapJsMiB'):.0f} MiB", f"{exe(nova, p, 'memoriaMaquete', 'heapJsMiB'):.0f} MiB"),
        ('Planta 3D parada: desenhos/s', f"{exe(base, p, 'planta3dParada', 'desenhosPorSeg')}", f"{exe(nova, p, 'planta3dParada', 'desenhosPorSeg')}"),
        ('Visita parada: desenhos/s', f"{exe(base, p, 'visitaParada', 'desenhosPorSeg')}", f"{exe(nova, p, 'visitaParada', 'desenhosPorSeg')}"),
        ('Planta 2D parada: CPU', f"{exe(base, p, 'planta2dParada', 'cpuPrincipalPct'):.0f}%", f"{exe(nova, p, 'planta2dParada', 'cpuPrincipalPct'):.0f}%"),
    ]
    for i, (k, a, b) in enumerate(rows):
        out.append(f'| {nome.split(" (")[0] if i == 0 else ""} | {k} | {a} | {b} |')
out.append('')
out.append('### Qualidade visual: v4 contra a versão atual, mesmas poses de câmera\n')
out.append('PSNR (quanto maior, mais parecido; acima de ~40 dB a diferença não se percebe) e a fração de '
           'pixels que mudou mais de 8 níveis (de 255).\n')
COLS = [('alto', 'comparacao-alto.json', 'Alto × atual no computador'),
        ('medio-cel', 'comparacao-medio-celular.json', 'Médio × atual no celular'),
        ('metade', 'comparacao-medio-celular-luzmetade.json', 'Médio com luz em meia resolução × atual no celular'),
        ('baixo', 'comparacao-baixo.json', 'Baixo × atual no computador (sem MSAA, luz em meia resolução)')]
dados = {k: json.loads((R / f).read_text())['poses'] for k, f, _ in COLS if (R / f).exists()}
if dados:
    usados = [c for c in COLS if c[0] in dados]
    out.append('| Pose | ' + ' | '.join(c[2] for c in usados) + ' |')
    out.append('|---|' + '---:|' * len(usados))
    for pose in dados[usados[0][0]]:
        out.append(f'| {pose} | ' + ' | '.join(
            f"{dados[k][pose]['psnr']:.1f} dB · {dados[k][pose]['pctAcima8']:.1f}%".replace('.', ',') for k, _, _ in usados) + ' |')
custos = R / 'custos.json'
if custos.exists():
    c = json.loads(custos.read_text())
    out.append('')
    out.append('### Firebase Hosting: ' + f"{c['premissas']['acessosDia']:,}".replace(',', '.') + ' acessos por dia\n')
    out.append('| Cenário | | MB por acesso | GB/dia | GB/mês | Custo/mês (franquia gratuita aplicada) | Sem franquia |')
    out.append('|---|---|---:|---:|---:|---:|---:|')
    nomes = {'so-predio': 'Só o prédio', 'padrao': f"{int(c['premissas']['interior'] * 100)}% abrem a planta/visita",
             'todos-no-interior': 'Todos abrem a planta/visita'}
    for k, v in c['cenarios'].items():
        for i, ver in enumerate(['base', 'nova']):
            d = v[ver]
            out.append(f"| {nomes[k] if i == 0 else ''} | {'atual' if ver == 'base' else 'v4'} | {d['mbPorAcesso']:.2f} | {d['gbDia']:.2f} | {d['gbMes']:.1f} | "
                       f"US$ {d['usdMes']:.2f} (R$ {d['brlMes']:.2f}) | US$ {d['usdMesSemFranquia']:.2f} |".replace('.', ','))
    out.append('')
    out.append('| Acessos/dia | Versão atual | v4 |')
    out.append('|---:|---:|---:|')
    for e in c['escala']:
        out.append(f"| {e['acessosDia']:,} | US$ {e['baseUsdMes']:,.2f}/mês | US$ {e['novaUsdMes']:,.2f}/mês |".replace(',', 'X').replace('.', ',').replace('X', '.'))
    out.append('')
    out.append(f"A franquia gratuita (360 MB/dia) acaba em **{c['limiteFranquia']['base']} acessos/dia** na versão atual e "
               f"em **{c['limiteFranquia']['nova']} acessos/dia** na v4 (cenário padrão).")
print('\n'.join(out))
