# -*- coding: utf-8 -*-
"""O poligono que ENGOLE RUA nao e edificacao -- ele e RECORTADO nas massas construidas.

Sintoma que trouxe isto: em Ribeirao, uma laje branca de 446 x 444 m a 7,7 m de altura,
com torres de 80 m saindo por dentro dela. Nao e o telhado do shopping -- e UM poligono
de 107.729 m2 (47x a p99,9 da cidade) que desenha o TERRENO do RibeiraoShopping:
acompanha a divisa, e por dentro dele correm as vias internas e as fileiras de vaga. Nao
ha nenhum `building` do OSM la dentro; esse poligono e tudo que existe no quarteirao.

Cortar por AREA esta errado, e a medicao mostra por que: o Riopreto Shopping tem
44.227 m2 de verdade, o Iguatemi 32.145, o Hospital das Clinicas 31.794. Teto que mate o
de Ribeirao mata shopping e hospital de verdade.

O que separa edificacao de sitio e RUA: predio nao e atravessado por via publica. Medido
nas quatro cidades, contando eixo dirigivel DENTRO do poligono:

    Equus (Ribeirao)              107.729 m2   22 eixos   1.495 m
    Assai Atacadista (Ribeirao)    50.693 m2    3 eixos     620 m
    Terminal Urbano (S.J.R.Preto)  12.234 m2    2 eixos     197 m  <- e via mesmo
    Museu do Futebol (Araraquara)  32.538 m2    1 eixo       67 m
    todo o resto das 4 cidades                  0 eixos       0 m

Achado o sitio, ele NAO e jogado fora -- ele carrega a forma do lugar (o chanfro da
esquina, o recorte da divisa), e apagar deixa buraco onde ha shopping. Ele e RECORTADO:
subtrai-se a circulacao interna com folga de vaga e ficam as massas. A folga de 14 m nao
e chute -- e o que separa a mancha construida do patio. Medido no terreno do
RibeiraoShopping, subtraindo TODO eixo que o toca:

    folga  0 m ->  8 massas, maior 29.373 m2, soma 80.928 (75% do sitio: patio de volta)
    folga  8 m ->  7 massas, maior 22.534 m2, soma 54.512 (51%)  <- adotado
    folga 14 m ->  4 massas, maior 18.326 m2, soma 34.757 (32%)
    folga 24 m ->  4 massas, maior 15.451 m2, soma 27.974 (26%)

REVISADO EM 03/09/2026: era 14 m. A pedido -- "quando eu peco pra remover algo gigante,
remove o EXCESSO", e 14 m tirava 68% da massa do shopping, deixando fitas soltas sobre um
patio vazio. A tabela acima e a medida NOVA (massas que sobrevivem aos dois filtros); a
antiga contava as pecas ANTES deles, por isso dizia 9 e 17.

E dois filtros por peca, porque nem tudo que sobra e predio:
  area >= 2.500 m2         -> resto de calcada e ilha de patio nao viram volume;
  sobrevive a erosao 12 m  -> fita de vaga tem ~16 m de largura por 100 m de
                              comprimento: ela SOME quando erodida, e o bloco do
                              shopping nao. Area sozinha nao separa os dois.

MORA AQUI, E NAO NO build_v7_city, porque agora ha DOIS chamadores: a etapa 7 do
pipeline (que monta a base de producao) e o `pipeline/recorta_sitios.py` (que aplica a
mesma regra a uma base pronta, como a do footprint cru que a variante proxy usa). Duas
implementacoes da mesma regra e a divida que a tabela de vias ja cobrou uma vez neste
projeto -- ver PADRAO.md.
"""
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

SITIO_AREA_MIN  = 12000.0   # m2: abaixo disso nem vale testar
SITIO_VIA_MAX   = 300.0     # m de eixo dirigivel dentro do poligono
SITIO_FOLGA     = 8.0      # m de vaga de cada lado da via interna
MASSA_AREA_MIN  = 2500.0    # m2 por massa que sobra
MASSA_EROSAO    = 12.0      # m: mata fita de estacionamento, poupa bloco

# O shopping e UM predio, e o recorte o entregava em 7 pedacos: cada via interna que
# encosta nele abre um corredor, e o que sobra sai fatiado. A pedido -- "da pra por o teto
# no formato do PREDIO?" -- as pecas passam por um FECHAMENTO (dilata e contrai) que funde
# o que esta a poucos metros de distancia e devolve um contorno unico e recortado.
#
# O tamanho do fecho NAO e gosto: e o maior da escada que ainda cobre ZERO metro de eixo
# dirigivel -- a mesma medida que decide o que e sitio, agora usada como guarda. Medido no
# RibeirãoShopping:
#
#      6 m ->  7 pecas, maior 22.456 m2, 0 m de via coberta
#     10 m ->  2 pecas, maior 60.742 m2, 0 m de via coberta   <- e o que a escada escolhe
#     14 m ->  1 peca,  maior 68.661 m2, 140 m de via COBERTA (reprovado)
#
# Por isso a escada desce em vez de fixar um numero: em outra cidade o mesmo 10 m pode
# fechar por cima de uma via, e ai ele cai sozinho pro degrau seguinte.
FECHO_ESCADA = (10.0, 8.0, 6.0, 4.0, 0.0)


def _via_coberta(g, t_dir, dirig):
    cob = 0.0
    for j in t_dir.query(g):
        try: seg = dirig[j][1].intersection(g)
        except Exception: continue
        if not seg.is_empty: cob += seg.length
    return cob


def _funde(massas, t_dir, dirig):
    """Junta as massas do mesmo sitio no maior fecho que nao cobre via."""
    if len(massas) < 2: return massas
    base = unary_union(massas)
    for d in FECHO_ESCADA:
        u = base.buffer(d, join_style=2).buffer(-d, join_style=2) if d else base
        pe = list(u.geoms) if isinstance(u, MultiPolygon) else ([u] if not u.is_empty else [])
        pe = [g for g in pe if g.geom_type == "Polygon" and g.area >= MASSA_AREA_MIN]
        if not pe: continue
        if sum(_via_coberta(g, t_dir, dirig) for g in pe) > 0.5: continue
        return sorted((g.simplify(0.5) for g in pe), key=lambda g: -g.area)
    return massas


def separa(kept, kept_face, eixos, cid, Q, nome_de=None, log=print):
    """`kept` = [(cls, h, anel, oi)] com o anel em DECIMETROS; devolve a mesma lista com
    cada sitio trocado pelas suas massas, na MESMA ordem.

    `eixos` = [(tipo, [(x,z), ...])] em metros (padrao.vias.eixos).
    `nome_de(oi)` so serve pro log; devolva '' quando nao houver nome."""
    todos = [(t, LineString(pts)) for t, pts in eixos]
    larg = [cid.meia_largura(t) for t, _ in todos]
    dirig = [(i, L) for i, (t, L) in enumerate(todos) if t in cid.dirigivel]
    t_dir = STRtree([L for _, L in dirig])
    t_all = STRtree([L for _, L in todos])
    novos = []; novas_faces = []; n_sitio = 0; n_massa = 0
    for k, (cls, h, ring, oi) in enumerate(kept):
        poly = Polygon([(x / Q, z / Q) for x, z in ring])       # decimetro -> metro
        if not poly.is_valid: poly = poly.buffer(0)
        if poly.is_empty or poly.geom_type != 'Polygon' or poly.area < SITIO_AREA_MIN:
            novos.append((cls, h, ring, oi)); novas_faces.append(kept_face[k]); continue
        dentro = 0.0
        for j in t_dir.query(poly):
            try: seg = dirig[j][1].intersection(poly)
            except Exception: continue
            if not seg.is_empty: dentro += seg.length
        if dentro <= SITIO_VIA_MAX:
            novos.append((cls, h, ring, oi)); novas_faces.append(kept_face[k]); continue

        n_sitio += 1
        corte = []
        for j in t_all.query(poly.buffer(40)):
            try: corte.append(todos[j][1].buffer(larg[j] + SITIO_FOLGA,
                                                 cap_style=2, join_style=2))
            except Exception: pass
        resto = poly.difference(unary_union(corte)) if corte else poly
        pecas = (list(resto.geoms) if isinstance(resto, MultiPolygon)
                 else ([resto] if not resto.is_empty else []))
        massas = []
        for g in pecas:
            if g.geom_type != 'Polygon' or g.area < MASSA_AREA_MIN: continue
            try:
                if g.buffer(-MASSA_EROSAO).is_empty: continue   # fita de vaga
            except Exception:
                continue
            g = g.simplify(0.5)
            if g.geom_type == 'Polygon' and not g.is_empty: massas.append(g)
        massas.sort(key=lambda g: -g.area)
        massas = _funde(massas, t_dir, dirig)
        # O nome fica com a MAIOR massa: repetir "RibeiraoShopping" em quatro volumes
        # poria quatro entradas iguais na busca, apontando pra quatro lugares.
        for m, g in enumerate(massas):
            anel = [(int(round(x * Q)), int(round(z * Q)))
                    for x, z in list(g.exterior.coords)[:-1]]
            if len(anel) < 3: continue
            novos.append((cls, h, anel, oi if m == 0 else None))
            novas_faces.append(kept_face[k] if m == 0 else None)
            n_massa += 1
        nome = (nome_de(oi) if (nome_de and oi is not None) else '') or ''
        log('  sitio: %-28s %8.0f m2 com %5.0f m de via dentro -> %d massa(s), %.0f m2'
            % ((nome or 'sem nome')[:28], poly.area, dentro,
               len(massas), sum(g.area for g in massas)))
    return novos, novas_faces, n_sitio, n_massa
