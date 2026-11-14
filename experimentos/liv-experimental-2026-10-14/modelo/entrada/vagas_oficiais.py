"""As 175 vagas numeradas como na implantação oficial do book.

Centros medidos em `v1.5/miniaturas/liv-ipanema/referencias/implantacao.jpg`, o mesmo
quadro (u, v) em pixels de `modelar_implantacao.py`. Os números seguem a planta
`relatorios/liv-referencias-publicas-2026-10-09/implantacao-finais-e-vagas.png`.
Sem bpy aqui: `construir` recebe o módulo da implantação e reaproveita as primitivas dele.
"""
import json

SCALE = .145
PASSO = 15.3        # px entre vagas vizinhas (2,22 m)
FUNDO = 34          # px de profundidade da faixa de vagas
ACESSIVEIS = {12, 13, 30, 31, 32, 33, 34, 35, 36}


def _faixa(numeros, centros):
    a, b = centros
    n = len(numeros)
    return [(k, a+(b-a)*i/(n-1) if n > 1 else a) for i, k in enumerate(numeros)]


def _seq(a, b):
    return list(range(a, b+1)) if a <= b else list(range(a, b-1, -1))


# Fileiras perpendiculares à pista: (u do eixo, trechos contínuos de vagas).
# Cada trecho é (primeiro número, último número, centro v do primeiro, centro v do último)
# ou uma lista solta [(número, v), ...] onde o espaçamento não é regular.
FILEIRAS = [
    # Na foto a 175 fica em v=679; 676 mantém a vaga dentro do muro do lote (v=684).
    (63, [(138, 175, 113, 676)]),
    (132, [(137, 122, 198, 427.7), (121, 109, 451, 635)]),
    (169, [(83, 95, 244, 427.7), (96, 108, 451, 635)]),
    (237, [(82, 70, 244, 427.7), (69, 59, 451, 604)]),
    (390, [(26, 29, 239, 285),
           [(30, 301), (31, 324), (32, 340), (33, 364), (34, 380), (35, 403), (36, 425), (37, 441), (38, 457.7)],
           (39, 47, 481, 603.3)]),
    (460, [(25, 14, 251.7, 419.3), [(13, 436), (12, 459.3)], (11, 1, 481.7, 634.3)]),
]
# Fileira atravessada no fim da pista do meio: vagas no sentido de v, centro v=631.
TRANSVERSAL = (631, [(58, 50, 232.3, 354.3), [(49, 377.7), (48, 392.7)]])


def _trechos(trechos):
    for t in trechos:
        yield _faixa(_seq(t[0], t[1]), (t[2], t[3])) if isinstance(t, tuple) else list(t)


def vagas():
    """Lista de (número, u, v, sentido, trecho) com sentido 'u' (fileira) ou 'v' (atravessada)."""
    out = []
    for u, trechos in FILEIRAS:
        for j, trecho in enumerate(_trechos(trechos)):
            out += [(k, u, v, 'u', (u, j)) for k, v in trecho]
    v, trechos = TRANSVERSAL
    for j, trecho in enumerate(_trechos(trechos)):
        out += [(k, u, v, 'v', (v, j)) for k, u in trecho]
    return out


def para_cena(u, v):
    """Quadro da cena exportada (three.js): x=(432-v)*S, z=(u-315)*S."""
    return round((432-v)*SCALE, 3), round((u-315)*SCALE, 3)


def construir(site, rng):
    """Substitui `site._parking`, mantendo o consumo do gerador aleatório do original."""
    w = PASSO*SCALE
    grupos = {}
    for k, u, v, sentido, trecho in vagas():
        grupos.setdefault(trecho, []).append((k, u, v, sentido))
    for itens in grupos.values():
        k0, u, v, sentido = itens[0]
        especial = any(k in ACESSIVEIS or k in (37, 38) for k, *_ in itens)
        mat = 'site-piso' if especial else 'site-permeavel'
        if sentido == 'u':
            lo, hi = min(i[2] for i in itens)-PASSO/2, max(i[2] for i in itens)+PASSO/2
            site.pxbox(mat, u, (lo+hi)/2, FUNDO, hi-lo, .04, .08)
        else:
            for _, uu, vv, _ in itens:
                site.pxbox(mat, uu, vv, PASSO-.7, FUNDO, .035, .1)
    fileira = []
    for k, u, v, sentido, _ in vagas():
        x, y = site.xy(u, v)
        if sentido == 'u':
            site.box('site-piso', x, .108, y, w*.72, .036, 4.1)
            for edge in (-.5, .5):
                site.box('site-marcacao', x+edge*w, .14, y, .052, .025, 4.85)
            site.box('site-marcacao', x, .14, y+2.45, w, .025, .052)
            if k not in ACESSIVEIS:
                fileira.append((u, v))
        else:
            site.box('site-piso', x, .125, y, 4.2, .035, w*.72)
            for edge in (-.5, .5):
                site.box('site-marcacao', x, .155, y+edge*w, 4.95, .02, .052)
        if k in ACESSIVEIS:
            site.box('site-acessivel', x, .145, y, w*.67, .023, 3.8)
            site.rod('site-marcacao', (x, y, .164), (x, y, .176), .46, sides=12)
            site.rod('site-acessivel', (x, y, .177), (x, y, .182), .29, sides=12)
            site.box('site-marcacao', x-.22, .185, y-.44, .10, .024, .68)
    # O original sorteava 36 de 167 vagas; sortear o mesmo tamanho deixa árvores e palmeiras onde estavam.
    cores = ['site-car-branco', 'site-car-prata', 'site-car-chumbo', 'site-car-vermelho', 'site-car-azul']
    usados = set()
    for i, idx in enumerate(rng.sample(range(167), 36)):
        j = idx % len(fileira)
        while j in usados:
            j = (j+1) % len(fileira)
        usados.add(j)
        u, v = fileira[j]
        site.car(u, v, cores[i % 5], u in (63, 169, 390), rng.uniform(.87, .98))
    return len(vagas()), 36


def gravar_json(caminho, fonte):
    itens = []
    for k, u, v, sentido, _ in sorted(vagas()):
        x, z = para_cena(u, v)
        itens.append({'numero': k, 'x': x, 'z': z, 'sentido': 'z' if sentido == 'u' else 'x',
                      'largura': round(PASSO*SCALE, 3), 'comprimento': 4.85, 'acessivel': k in ACESSIVEIS})
    dados = {'schema': 'liv-parking-v1', 'fonte': fonte, 'total': len(itens),
             'nota': 'Centros medidos na implantação oficial; dimensões de cada vaga são inferidas.', 'vagas': itens}
    with open(caminho, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    todas = vagas()
    numeros = sorted(k for k, *_ in todas)
    assert numeros == list(range(1, 176)), 'faltam ou sobram números'
    # Vizinhas no mesmo trecho não se sobrepõem.
    for k, u, v, s, t in todas:
        for k2, u2, v2, s2, t2 in todas:
            if t == t2 and k != k2:
                assert abs((v-v2) if s == 'u' else (u-u2)) >= PASSO-1, (k, k2)
    print('ok', len(todas), 'vagas')
