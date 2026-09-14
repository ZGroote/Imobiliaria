# -*- coding: utf-8 -*-
"""Gerador de moveis. RODA DENTRO DO BLENDER (headless):

    blender -b --factory-startup -P moveis/export_moveis.py

Existe porque o catalogo em `app.js` e caixa chanfrada de 1,5 cm, e caixa chanfrada
tem teto: almofada virava ELIPSOIDE achatado (`E(...)`), cuba virava um bloco EM CIMA
da bancada, e o quarto inteiro lia como enfermaria. O que falta nao e detalhe, e
ARESTA MACIA -- um bevel de 4 cm com 4 segmentos e uma superficie subdividida fazem
o olho ler estofado. Nenhuma das duas coisas cabe numa caixa montada a mao em JS.

Duas convencoes, iguais as do catalogo de `app.js`:
  - METROS, origem no centro do CHAO da peca;
  - a FRENTE do movel e o +Y AQUI (vira +Z no app; ver `export_moveis.py`).

E uma terceira, igual a da biblioteca de arvores: **toda cor e cor de vertice**, sem
material e sem textura, pra que o movel continue custando UMA chamada de desenho
depois de mesclado.

--------------------------------------------------------------------------------
A CAIXA ENVOLVENTE E MEDIDA, NAO DECLARADA -- e isso muda o que se pode desenhar.

`export_moveis.py` calcula `b` da geometria, e `atualizaMovel` no app ESCALA a peca
por `b`. Entao qualquer coisa que ultrapasse a altura util reescala o movel inteiro:
uma torneira de 26 cm acima do tampo faria `b[1]` virar 1,16 e o armario chegar
achatado em 79%. O catalogo antigo escapava disso MENTINDO -- declarava `b:[1.30,
0.92,0.60]` e desenhava torneira ate 1,18. Aqui nao da: o que passar da cota, escala.

Por isso a bancada sai SEM torneira. `ponytail:` torneira quer peca propria no
catalogo (o `mobiliar.py` a posiciona em cima da pia), porque como parte da bancada
ela quebra a altura declarada nos dois pontos de chamada -- cozinha e banheiro usam
o MESMO tipo `pia`.

--------------------------------------------------------------------------------
O ESTILO E MARCENARIA DE PORTA LISA, e nao e gosto: e o que o usuario apontou como
referencia (render de archviz de cozinha). Tres regras que valem pra todas as pecas:

  1. PORTA LISA COM FRESTA. Nada de moldura. O que separa uma porta da outra e uma
     fresta de 4 mm -- e a fresta e o unico detalhe que existe. Porta com quadro
     lido de longe vira armario de escritorio.
  2. PUXADOR EMBUTIDO, nao saliente. Uma canaleta escura na borda da porta (no ALTO
     nos armarios de baixo, EMBAIXO nos aereos, que e onde a mao alcanca). Puxador
     de barra e o detalhe que mais denuncia movel de catalogo antigo.
  3. TAMPO FINO. Pedra de 3-4 cm com 2 cm de beiral. Tampo grosso le como MDF.
"""
import bpy, bmesh
from mathutils import Vector

HERDA = -1   # a peca usa a cor que o usuario escolheu no cadastro

# Cores fixas (detalhe que NAO acompanha a cor do cadastro).
PRETO = 0x1E2126        # canaleta de puxador, fresta, vidro de forno
GRAFITE = 0x2B3038      # rodape recuado, pe
PEDRA = 0x23262A        # tampo de granito
INOX = 0xB9C0C6         # cuba, ferragem
CROMO = 0xDCE3E8        # faixa de luz da coifa
ROUPA = 0xF2EFE8        # colchao, lencol
TRILHO = 0x8A8F96       # trilho de cortina
MADEIRA = 0xA9793F      # perfil de puxador e fundo de nicho


def _limpa():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def caixa(nome, cen, tam, cor, bevel=0.02, seg=2, subsurf=0, suave=False, rot=None):
    """Caixa com aresta macia. `cen` e o centro, `tam` as tres medidas.

       `suave` nao e escolha de gosto, e de PESO: com sombreamento plano cada canto
       carrega normal propria e a costura por posicao+normal nao dedupa nada -- a
       primeira versao do sofa saiu com 20.288 triangulos e 1,19 MB, contra 644
       triangulos de uma arvore inteira. Com normal por vertice o mesmo sofa cabe."""
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(tam), verts=bm.verts)
    # Rotacao ASSADA na malha (radianos, em torno do centro da caixa), nunca em
    # `ob.rotation_euler`: `export_moveis.py` le `to_mesh()` em espaco LOCAL e nao
    # aplica `matrix_world` -- o objeto giraria e a malha exportada nao, sem erro
    # nenhum. E o mesmo motivo que fez `barra()` existir. Encosto de cadeira e livro
    # tombado na estante dependem disto: o que nao esta a 90 graus le como movel.
    if rot and any(rot):
        import mathutils
        m = (mathutils.Matrix.Rotation(rot[0], 3, "X")
             @ mathutils.Matrix.Rotation(rot[1], 3, "Y")
             @ mathutils.Matrix.Rotation(rot[2], 3, "Z"))
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=m)
    bmesh.ops.translate(bm, vec=Vector(cen), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    if suave:
        for f in me.polygons:
            f.use_smooth = True
    ob = bpy.data.objects.new(nome, me)
    bpy.context.collection.objects.link(ob)
    # O bevel nao e enfeite: e o que separa "bloco" de "objeto". Uma aresta viva da
    # dois tons chapados; um raio de 2-6 cm com 3-4 segmentos da o filete de brilho
    # que o olho usa pra ler o volume. Custa triangulo, que e a moeda barata aqui.
    if bevel > 0:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel; m.segments = seg
        m.limit_method = "ANGLE"; m.angle_limit = 0.52
        m.harden_normals = False
    # Subsurf depois do bevel = estofado. So onde ha estofamento: o bevel sozinho
    # ainda e uma caixa, o subsurf sozinho vira travesseiro sem forma.
    if subsurf > 0:
        s = ob.modifiers.new("subsurf", "SUBSURF")
        s.levels = s.render_levels = subsurf
    ob["cor"] = cor
    return ob


def cilindro(nome, cen, r, h, cor, lados=12, r2=None):
    """`r` e o raio EMBAIXO, `r2` em cima (padrao: cilindro reto).

       Pe conico nao e enfeite: pe reto de bloco le como caixote, pe que afina 30-40%
       ate o chao le como movel -- e e uma linha de diferenca aqui."""
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados,
                          radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=Vector((cen[0], cen[1], cen[2] + h / 2)), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nome, me)
    bpy.context.collection.objects.link(ob)
    ob["cor"] = cor
    return ob


def barra(nome, cen, r, comp, cor, lados=10):
    """Cilindro DEITADO no eixo X (alca de forno, trilho de cortina).

       Existe porque `export_moveis.py` le `to_mesh()` em espaco LOCAL e nunca aplica
       `matrix_world`: por um `ob.rotation_euler` a barra sairia em pe, no lugar
       errado, e SEM ERRO nenhum -- o objeto tem a rotacao, a malha exportada nao. A
       rotacao tem que estar assada na geometria, e e o que a matriz aqui faz."""
    import mathutils
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=lados,
                          radius1=r, radius2=r, depth=comp)
    # o cone nasce no eixo Z; 90 graus em Y deita ele no X
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=mathutils.Matrix.Rotation(1.5707963, 3, "Y"))
    bmesh.ops.translate(bm, vec=Vector(cen), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nome, me)
    bpy.context.collection.objects.link(ob)
    ob["cor"] = cor
    return ob


def pano(nome, cen, tam, cor, ondas=3.5, cols=17, linhas=5):
    """Uma folha ONDULADA. Cortina achatada num plano nao le como tecido: o que faz
       o olho reconhecer pano e a onda vertical pegando luz de raspao, alternando
       claro e escuro na largura. Uma caixa fina, por mais chanfrada que seja, da
       dois tons e para por ai.

       A onda entra na PROFUNDIDADE (y) em funcao da largura (x), e a amplitude cai
       perto do trilho -- cortina franze no varao e abre embaixo."""
    import math
    dx, dy, dz = tam
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    grade = []
    for i in range(cols):
        u = i / (cols - 1.0)
        col = []
        for j in range(linhas):
            v = j / (linhas - 1.0)
            # amplitude 35% no alto (franzido preso) e cheia embaixo
            amp = (dy / 2.0) * (0.35 + 0.65 * (1.0 - v))
            y = math.sin(u * ondas * 2 * math.pi) * amp
            col.append(bm.verts.new((cen[0] + (u - 0.5) * dx,
                                     cen[1] + y,
                                     cen[2] + (v - 0.5) * dz)))
        grade.append(col)
    for i in range(cols - 1):
        for j in range(linhas - 1):
            bm.faces.new((grade[i][j], grade[i + 1][j],
                          grade[i + 1][j + 1], grade[i][j + 1]))
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    for f in me.polygons:
        f.use_smooth = True
    ob = bpy.data.objects.new(nome, me)
    bpy.context.collection.objects.link(ob)
    # Solidify: o pano precisa de duas faces, senao some visto de dentro do comodo
    # (o interior desenha com `side` normal e uma folha de face unica pisca).
    s = ob.modifiers.new("solid", "SOLIDIFY")
    s.thickness = 0.012
    s.offset = 0
    ob["cor"] = cor
    return ob


# ---- pecas de marcenaria, compartilhadas -------------------------------------
def portas(obs, nome, x0, x1, z0, z1, y, cor, n=2, fresta=0.004, esp=0.018):
    """`n` portas LISAS lado a lado, com fresta entre elas e nas bordas. `y` e a face
       externa. Cada porta e um painel proprio -- e a fresta que existe entre eles,
       nao uma linha desenhada, e por isso ela escurece sozinha com a luz de raspao."""
    L = (x1 - x0 - fresta * (n + 1)) / n
    for k in range(n):
        cx = x0 + fresta * (k + 1) + L * (k + 0.5)
        obs.append(caixa("%s_porta%d" % (nome, k), (cx, y - esp / 2, (z0 + z1) / 2),
                         (L, esp, z1 - z0), cor, 0.006, 2))


def canaleta(obs, nome, x0, x1, z, y, alt=0.028, prof=0.030):
    """Puxador de PERFIL -- e nao a canaleta escura que estava aqui antes.

       A canaleta era uma sombra recuada: certa de perto, INVISIVEL a dois metros.
       E a dois metros e que se olha uma cozinha: o pano de marcenaria voltava a ser
       liso. Em toda cozinha planejada das referencias o puxador e uma LINHA CLARA
       continua -- perfil de madeira ou de aluminio -- correndo a largura inteira da
       frente. Aqui ele e uma barra saliente 1 cm, em madeira, com a sombra da propria
       canaleta atras dela; a sombra e o que separa o perfil da porta."""
    obs.append(caixa(nome, ((x0 + x1) / 2, y + 0.003, z),
                     (x1 - x0, 0.014, alt), MADEIRA, 0.003, 2))
    obs.append(caixa(nome + "_s", ((x0 + x1) / 2, y - prof / 2 - 0.008, z),
                     (x1 - x0 - 0.02, prof, alt * 0.8), PRETO, 0.003, 1))


def rodape_recuado(obs, nome, larg, prof, alt=0.10, recuo=0.06):
    """Toe kick. Recuado 6 cm: e a sombra embaixo do armario que faz a marcenaria
       parecer apoiada no chao em vez de desenhada nele."""
    obs.append(caixa(nome, (0, -recuo / 2, alt / 2), (larg - 0.04, prof - recuo, alt),
                     GRAFITE, 0.004, 1))


# ------------------------------------------------------------------ fogao --
def fogao(corpo=HERDA):
    """0,62 x 0,92 x 0,62 -- forno embutido embaixo, cooktop A GAS rente ao tampo.

       Era inducao: quatro discos de 4 mm no vidro. Nenhuma das cozinhas de referencia
       tem inducao, e o que diz "fogao" a tres metros nao e a boca -- e a GRADE. Duas
       grades de ferro, uma por par de bocas, com a moldura e a travessa do meio."""
    obs = []
    LARG, PROF = 0.62, 0.60
    yF = PROF / 2
    FERRO = 0x1A1D21
    rodape_recuado(obs, "rodape", LARG, PROF)
    obs.append(caixa("corpo", (0, 0, (0.10 + 0.86) / 2), (LARG, PROF, 0.76),
                     corpo, 0.006, 2))
    # porta do forno: painel + vidro recuado + puxador de barra (aqui a barra e
    # correta -- forno tem alca, ao contrario da marcenaria)
    obs.append(caixa("forno", (0, yF - 0.009, 0.42), (LARG - 0.03, 0.018, 0.52),
                     corpo, 0.006, 2))
    obs.append(caixa("vidro", (0, yF - 0.020, 0.44), (LARG - 0.12, 0.006, 0.34),
                     PRETO, 0.004, 1))
    obs.append(barra("alca", (0, yF + 0.030, 0.715), 0.014, LARG - 0.10, INOX))
    # cooktop: vidro no plano do tampo, queimador (base + coroa) e grade por cima
    obs.append(caixa("cooktop", (0, 0, 0.8725), (LARG, PROF, 0.025), PRETO, 0.004, 2))
    for sx in (-1, 1):
        for sy in (-1, 1):
            obs.append(cilindro("boca", (sx * 0.145, sy * 0.135, 0.883),
                                0.052, 0.008, 0x2A2E33, 14))
            obs.append(cilindro("coroa", (sx * 0.145, sy * 0.135, 0.890),
                                0.030, 0.012, INOX, 12))
        # grade: moldura de 0,26 x 0,42 e uma travessa no meio, 3 cm acima do vidro
        gx, gy, gz = sx * 0.145, 0.0, 0.905
        for dy in (-0.21, 0.21):
            obs.append(caixa("g_x", (gx, gy + dy, gz), (0.26, 0.014, 0.012), FERRO, 0.003, 1))
        for dx in (-0.125, 0, 0.125):
            obs.append(caixa("g_y", (gx + dx, gy, gz), (0.014, 0.42, 0.012), FERRO, 0.003, 1))
    return obs


# ------------------------------------------------------------------ coifa --
def coifa(corpo=HERDA):
    """0,60 x 2,70 x 0,50 -- capo INCLINADO e chamine ate o teto.

       O corpo era uma caixa reta e lia como um aereo perdido no meio da parede.
       Coifa de parede tem a frente caida uns 20 graus, e e essa diagonal -- nao o
       filtro, nao a chamine -- que o olho reconhece de longe. A inclinacao vai
       ASSADA na malha (`rot=`), porque `export_moveis.py` ignora `rotation_euler`.

       `b[1]` PRECISA chegar no pe-direito, senao a chamine para no ar e vira uma
       caixa boiando -- defeito que nao aparece na vista de planta, so andando."""
    obs = []
    LARG = 0.60
    Z0, Z1 = 1.46, 1.72
    obs.append(caixa("capo", (0, 0.06, (Z0 + Z1) / 2 + 0.02), (LARG, 0.40, 0.20),
                     corpo, 0.010, 3, rot=(-0.36, 0, 0)))
    # laje inferior: e nela que mora o filtro, e ela que fecha o capo por baixo
    obs.append(caixa("base", (0, 0.05, Z0 + 0.012), (LARG - 0.02, 0.38, 0.024),
                     corpo, 0.006, 2))
    obs.append(caixa("filtro", (0, 0.05, Z0 + 0.002), (LARG - 0.10, 0.30, 0.014),
                     PRETO, 0.004, 1))
    # faixa de luz sob o capo, na frente: o detalhe mais barato que existe aqui
    obs.append(caixa("luz", (0, 0.225, Z0 + 0.004), (LARG - 0.14, 0.020, 0.008),
                     CROMO, 0.002, 1))
    obs.append(caixa("chamine", (0, -0.10, (Z1 + 2.70) / 2), (0.26, 0.22, 2.70 - Z1),
                     corpo, 0.008, 2))
    return obs


# --------------------------------------------------------------- torneira --


# ----------------------------------------------------------------- criado --
def criado(corpo=HERDA):
    """0,45 x 0,55 x 0,40 -- criado-mudo de uma gaveta, com pe palito.

       Pe cilindrico fino e inclinado le como movel; pe de bloco le como caixote. O
       pe aqui e CONICO (raio cai 40% ate o chao), que e o que a linha escandinava
       faz e o olho reconhece na hora."""
    obs = []
    LARG, PROF = 0.45, 0.40
    yF = PROF / 2
    Z0, Z1 = 0.16, 0.51
    obs.append(caixa("corpo", (0, 0, (Z0 + Z1) / 2), (LARG, PROF, Z1 - Z0),
                     corpo, 0.008, 3))
    # Beiral de 1 cm, e nao 3: o tampo e quem define a caixa envolvente, e 3 cm de
    # avanco faziam `b` medir 0,48 x 0,44 contra os 0,45 x 0,40 que o `mobiliar.py`
    # manda -- 9% de esmagamento em profundidade, de graca.
    obs.append(caixa("tampo", (0, 0, 0.53), (LARG + 0.01, PROF + 0.01, 0.04),
                     corpo, 0.008, 3))
    # gaveta lisa + canaleta no alto
    obs.append(caixa("gaveta", (0, yF - 0.009, 0.30), (LARG - 0.03, 0.018, 0.22),
                     corpo, 0.006, 2))
    canaleta(obs, "puxador", -LARG / 2 + 0.06, LARG / 2 - 0.06, 0.425, yF, 0.022, 0.024)
    for sx in (-1, 1):
        for sy in (-1, 1):
            obs.append(cilindro("pe", (sx * (LARG / 2 - 0.05),
                                       sy * (PROF / 2 - 0.05), 0.0),
                                0.014, Z0, GRAFITE, 8, r2=0.023))
    return obs


# ------------------------------------------------------------------- cama --
def cama(corpo=HERDA):
    """1,45 x 0,95 x 2,05 -- box, colchao, edredom com DOBRA, travesseiros e uma
       cabeceira alta.

       Tres coisas vieram das referencias de quarto: a cabeceira e ALTA (sobe 1,0 m
       do chao, nao 0,7) e e ela que enquadra a cama; o edredom tem uma DOBRA na
       cabeceira, que e o que quebra o bloco de pano; e os travesseiros sao DOIS
       empilhados por lado, nao um deitado."""
    obs = []
    LARG, COMP = 1.45, 2.05
    yCab = -COMP / 2                       # a cabeceira (a frente do movel e o pe)
    obs.append(caixa("box", (0, 0.02, 0.15), (LARG - 0.04, COMP - 0.10, 0.30),
                     corpo, 0.010, 2))
    obs.append(caixa("colchao", (0, 0.03, 0.42), (LARG - 0.07, COMP - 0.16, 0.24),
                     ROUPA, 0.045, 3, subsurf=1, suave=True))
    obs.append(caixa("edredom", (0, 0.30, 0.545), (LARG - 0.02, COMP - 0.78, 0.09),
                     corpo, 0.05, 3, subsurf=1, suave=True))
    # a dobra: um rolo do mesmo pano na borda de cima do edredom
    obs.append(caixa("dobra", (0, 0.30 - (COMP - 0.78) / 2, 0.575),
                     (LARG - 0.02, 0.14, 0.10), ROUPA, 0.045, 3, subsurf=1, suave=True))
    for sx in (-1, 1):
        obs.append(caixa("travesseiro", (sx * 0.33, yCab + 0.34, 0.575),
                         (0.60, 0.30, 0.12), ROUPA, 0.050, 3, subsurf=1, suave=True))
        obs.append(caixa("travesseiro2", (sx * 0.33, yCab + 0.30, 0.655),
                         (0.58, 0.26, 0.11), ROUPA, 0.048, 3, subsurf=1, suave=True,
                         rot=(0.18, 0, 0)))
    # A cabeceira sobe ate 1,05 -- e o `mobiliar.py` manda a cama com essa altura, nao
    # com 0,95. Quem mede a caixa envolvente e a geometria: uma cabeceira mais alta que
    # a altura declarada faria `atualizaMovel` ACHATAR a cama inteira em 89%, e o
    # travesseiro junto. Cabeceira alta e o que enquadra a cama em toda foto de quarto.
    obs.append(caixa("cabeceira", (0, yCab + 0.045, 0.625), (LARG, 0.09, 0.85),
                     corpo, 0.030, 3, subsurf=1, suave=True))
    for sx in (-1, 1):
        for sy in (-1, 1):
            obs.append(cilindro("pe", (sx * (LARG / 2 - 0.10),
                                       sy * (COMP / 2 - 0.14), 0.0),
                                0.022, 0.10, GRAFITE, 8))
    return obs


# ---------------------------------------------------------------- cortina --
def cortina(tecido=HERDA):
    """1,90 x 2,40 x 0,12 -- DOIS paineis abertos, ondulados, e o trilho.

       Abertos, nao fechados: fechada a cortina tapa a janela, que e a coisa que mais
       ilumina e a unica vista que o apartamento tem. Aberta ela da escala e tecido a
       uma parede que so tinha vidro."""
    obs = []
    for sx in (-1, 1):
        obs.append(pano("painel", (sx * 0.68, 0, 1.18), (0.46, 0.11, 2.24),
                        tecido, ondas=2.5))
    obs.append(barra("trilho", (0, 0, 2.36), 0.014, 1.90, TRILHO))
    return obs


# ---------------------------------------------------------------- sofa --
"""O sofa nao sai inteiro: sai em MODULO.

   Ele saia -- e o usuario mandou a foto de um de 3,20 m com DOIS assentos de 1,40,
   braco de 31 cm e pe virado tronco. Quem estica e `atualizaMovel`, que escala a
   malha pela medida pedida; contra malha inteira nao ha conserto possivel, porque
   o numero de lugares esta assado na geometria.

   Entao o que se modela aqui e UM LUGAR e UM BRACO. Quem conta quantos lugares
   cabem e `sofaParam` no `app.js`, e a folga sobra so na largura do assento -- o
   braco e o pe nunca escalam em X."""
MOD_W = 0.785   # um lugar. 1,95 de sofa = 2 lugares + 2 bracos de 0,19


def sofa_mod(estofado=HERDA):
    """UM lugar: base, encosto, assento e almofada SOLTA.

       A almofada de encosto estava encostada no encosto e lia como parte dele. Nas
       referencias ela e um volume proprio, inclinado pra tras, com folga em volta --
       e e a folga que faz o sofa parecer estofado em vez de moldado."""
    obs = []
    obs.append(caixa("base", (0, 0, 0.24), (MOD_W, 0.92, 0.16), estofado, 0.03, 2))
    obs.append(caixa("encosto", (0, -0.36, 0.48), (MOD_W, 0.20, 0.64), estofado, 0.03, 2))
    # almofada e caixa MUITO arredondada, nao elipsoide: `E(...)` achatado pegava o
    # brilho do teto inteiro e lia como poca de leite dentro de um caixote.
    obs.append(caixa("assento", (0, 0.05, 0.40), (MOD_W - 0.04, 0.78, 0.16),
                     estofado, 0.05, 2, subsurf=1, suave=True))
    obs.append(caixa("almofada", (0, -0.235, 0.60), (MOD_W - 0.08, 0.15, 0.36),
                     estofado, 0.05, 2, subsurf=1, suave=True, rot=(0.20, 0, 0)))
    return obs


def sofa_braco(estofado=HERDA, pe=GRAFITE):
    """O braco com os DOIS pes dele. Junto porque assim `sofaParam` tem duas pecas
       pra posicionar em vez de quatro, e porque pe de sofa mora embaixo do braco.

       O pe e INCLINADO pra fora, como em toda foto de sofa de sala: pe reto embaixo
       de um volume de 2 m le como estrado, pe aberto le como movel."""
    obs = []
    obs.append(caixa("braco", (0, 0, 0.42), (0.19, 0.92, 0.52), estofado, 0.05, 3))
    for sy in (-1, 1):
        obs.append(caixa("pe", (-0.03, sy * 0.33, 0.075), (0.030, 0.030, 0.17),
                         pe, 0.006, 2, rot=(sy * 0.22, 0, 0.0)))
    return obs


# -------------------------------------------------------------- geladeira --
def geladeira(corpo=HERDA):
    """0,68 x 1,78 x 0,68 -- duas portas SALIENTES, canaleta no lugar da barra.

       A caixa antiga era um bloco cinza com duas barras cromadas boiando na frente e
       um risco no meio. O que faz o olho ler geladeira nao e a barra: e a porta ser
       um VOLUME a frente do corpo (6 cm), com fresta escura entre as duas e o corpo
       recuado sumindo na sombra. Barra saliente, alem de nao ajudar, quebraria a
       caixa envolvente -- ela conta a profundidade toda."""
    obs = []
    LARG, PROF, H = 0.68, 0.68, 1.78
    yC = PROF / 2 - 0.06                   # face do corpo; a porta ocupa os 6 cm
    obs.append(caixa("rodape", (0, -0.05, 0.035), (LARG - 0.08, PROF - 0.16, 0.07),
                     GRAFITE, 0.004, 1))
    obs.append(caixa("corpo", (0, -0.03, (0.06 + H) / 2), (LARG, PROF - 0.06, H - 0.06),
                     corpo, 0.010, 3))
    ZM = 0.735                             # divisa freezer/geladeira
    # A porta e MAIS ESTREITA que o corpo do lado direito: os 3,5 cm que sobram sao
    # a cava do puxador. Primeira versao poe a canaleta DENTRO da porta (mesmo y) e
    # ela ficou invisivel -- groove enterrado nao existe. Canaleta so aparece se
    # houver VAO: e por isso que a da `pia` mora entre a porta e o tampo, nao no meio
    # do painel.
    CAVA = 0.035
    x0, x1 = -LARG / 2 + 0.006, LARG / 2 - CAVA
    for nome, z0, z1 in (("freezer", 0.10, ZM - 0.008), ("porta", ZM + 0.008, H - 0.005)):
        obs.append(caixa(nome, ((x0 + x1) / 2, yC + 0.03, (z0 + z1) / 2),
                         (x1 - x0, 0.06, z1 - z0), corpo, 0.010, 3))
        obs.append(caixa(nome + "_pux", (LARG / 2 - CAVA / 2 - 0.004, yC + 0.012,
                                         (z0 + z1) / 2),
                         (CAVA - 0.008, 0.030, (z1 - z0) - 0.10), PRETO, 0.004, 1))
    # Fresta: sem a tira escura o vao entre as portas mostra o corpo, que e da MESMA
    # cor, e a geladeira volta a ler como bloco unico.
    obs.append(caixa("fresta", (0, yC + 0.01, ZM), (LARG - 0.012, 0.02, 0.016), PRETO, 0, 0))
    return obs


# ------------------------------------------------------------------- mesa --
def mesa(corpo=HERDA):
    """1,40 x 0,76 x 0,85 -- tampo fino, saia e quatro pes CONICOS.

       Pe de bloco de 7 cm (o que a caixa fazia) le como banco de praca. Pe torneado
       que afina 40% ate o chao le como mesa de sala -- e custa 10 lados de cilindro."""
    obs = []
    LARG, PROF = 1.40, 0.85
    obs.append(caixa("tampo", (0, 0, 0.7375), (LARG, PROF, 0.035), corpo, 0.010, 3))
    # Saia: a sombra sob o tampo. Sem ela o tampo flutua sobre quatro palitos.
    obs.append(caixa("saia", (0, 0, 0.695), (LARG - 0.10, PROF - 0.10, 0.050),
                     corpo, 0.006, 2))
    for sx in (-1, 1):
        for sy in (-1, 1):
            obs.append(cilindro("pe", (sx * (LARG / 2 - 0.09), sy * (PROF / 2 - 0.09), 0.0),
                                0.019, 0.695, corpo, 10, r2=0.032))
    return obs


# ---------------------------------------------------------------- cadeira --
def cadeira(corpo=HERDA):
    """0,46 x 0,92 x 0,48 -- encosto INCLINADO 9 graus.

       A inclinacao e o unico detalhe que importa: seis caixas a 90 graus leem como
       banqueta de laboratorio, nao importa quantas sejam. Como `export_moveis.py`
       ignora `rotation_euler`, a inclinacao vai ASSADA na malha (`rot=` da caixa)."""
    obs = []
    LARG, PROF = 0.46, 0.46
    obs.append(caixa("assento", (0, 0.01, 0.4425), (LARG, PROF, 0.045), corpo, 0.018, 3))
    obs.append(caixa("encosto", (0, -0.19, 0.700), (LARG - 0.04, 0.035, 0.40),
                     corpo, 0.014, 3, rot=(0.16, 0, 0)))
    # Montantes que ligam o encosto ao assento: sem eles o encosto fica boiando.
    for sx in (-1, 1):
        obs.append(caixa("montante", (sx * (LARG / 2 - 0.035), -0.175, 0.520),
                         (0.030, 0.035, 0.14), corpo, 0.008, 2, rot=(0.16, 0, 0)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            obs.append(cilindro("pe", (sx * (LARG / 2 - 0.05), sy * (PROF / 2 - 0.05), 0.0),
                                0.014, 0.42, corpo, 8, r2=0.021))
    for sy in (-1, 1):
        obs.append(barra("travessa", (0, sy * (PROF / 2 - 0.05), 0.17), 0.011,
                         LARG - 0.10, corpo))
    return obs


# ---------------------------------------------------------------- estante --
LIVROS = (0x7A3B34, 0x2E4A5B, 0xB08A4A, 0x3E5F4A, 0x8A4B62, 0x2B3038, 0xA9A093)


def estante(corpo=HERDA):
    """0,95 x 1,85 x 0,34 -- cinco prateleiras COM LIVRO.

       Estante vazia nao existe em casa nenhuma, e sem os livros as prateleiras leem
       como grelha. Os livros sao o unico lugar do catalogo onde entra cor que nao e
       do movel -- e e de proposito: e a variacao deles que da vida a peca. Um deles
       vai TOMBADO, porque fileira perfeita le como desenho tecnico."""
    import math
    obs = []
    LARG, PROF, ALT = 0.95, 0.34, 1.85
    obs.append(caixa("fundo", (0, -PROF / 2 + 0.010, ALT / 2), (LARG - 0.06, 0.018, ALT),
                     corpo, 0.004, 1))
    for sx in (-1, 1):
        obs.append(caixa("lateral", (sx * (LARG / 2 - 0.016), 0, ALT / 2),
                         (0.032, PROF, ALT), corpo, 0.006, 2))
    ZS = (0.030, 0.420, 0.810, 1.200, 1.590, 1.835)
    for z in ZS:
        obs.append(caixa("prat", (0, 0.005, z), (LARG - 0.06, PROF - 0.02, 0.030),
                         corpo, 0.006, 2))
    LARGS = (0.032, 0.045, 0.026, 0.038, 0.030, 0.050, 0.034)
    k = 0
    for pi, z0 in enumerate((ZS[1], ZS[2], ZS[3])):
        x = -LARG / 2 + 0.055
        base = z0 + 0.015
        n = 0
        while x < LARG / 2 - 0.16 and n < 9:
            w = LARGS[k % len(LARGS)]
            h = 0.19 + 0.055 * ((k * 7) % 3)
            tomba = (n == 4 and pi == 1)
            ang = 0.20 if tomba else 0.0
            obs.append(caixa("livro", (x + w / 2 + (0.05 if tomba else 0),
                                       0.02, base + h / 2 * math.cos(ang)),
                             (w, PROF - 0.11, h), LIVROS[k % len(LIVROS)],
                             0.003, 1, rot=(0, ang, 0)))
            x += w + 0.004 + (0.09 if tomba else 0)
            k += 1
            n += 1
    return obs


# ------------------------------------------------------------------- vaso --
def vaso(louca=HERDA):
    """0,40 x 0,80 x 0,66 -- caixa acoplada, bacia OVAL e assento.

       As tres caixas antigas liam como um degrau com uma mochila. Bacia e uma forma
       curva: sai de caixa com bevel de 8,5 cm e uma subdivisao, que e a mesma receita
       da almofada do sofa -- superficie continua e o que separa louca de bloco."""
    obs = []
    obs.append(caixa("caixa", (0, -0.185, 0.560), (0.38, 0.19, 0.44), louca, 0.020, 3))
    obs.append(caixa("tampa_cx", (0, -0.185, 0.790), (0.39, 0.20, 0.020), louca, 0.008, 2))
    obs.append(cilindro("acionador", (0, -0.185, 0.796), 0.030, 0.008, INOX, 16))
    # pedestal: afunila do chao ate a bacia
    obs.append(caixa("pe", (0, -0.02, 0.180), (0.19, 0.34, 0.36), louca, 0.060, 3,
                     subsurf=1, suave=True))
    # A bacia avanca ate y=+0,36: a caixa envolvente medida e 0,66 de PROFUNDIDADE
    # (o que o `mobiliar.py` manda), e uma bacia curta faria `atualizaMovel` esticar
    # a louca inteira 16% pra frente.
    obs.append(caixa("bacia", (0, 0.09, 0.330), (0.35, 0.54, 0.20), louca, 0.085, 3,
                     subsurf=1, suave=True))
    obs.append(caixa("assento", (0, 0.09, 0.4275), (0.36, 0.53, 0.025), ROUPA, 0.010, 3))
    obs.append(caixa("tampo", (0, 0.08, 0.4475), (0.35, 0.52, 0.020), ROUPA, 0.008, 3))
    return obs


# ----------------------------------------------------------------- tapete --
def tapete(tecido=HERDA):
    """2,20 x 0,02 x 1,60 -- campo, listras e franja.

       Retangulo dentro de retangulo (o que a caixa fazia) le como piso pintado. Sem
       textura -- movel aqui e cor por vertice -- o que resta e GEOMETRIA: listras em
       relevo de 3 mm pegam luz de raspao e a franja quebra a borda reta, que e o que
       denuncia o adesivo."""
    obs = []
    LARG, COMP = 2.20, 1.60
    obs.append(caixa("base", (0, 0, 0.006), (LARG, COMP, 0.012), tecido, 0.004, 1))
    obs.append(caixa("campo", (0, 0, 0.0125), (LARG - 0.34, COMP - 0.34, 0.005),
                     0x8A7684, 0.002, 1))
    for sy in (-1, 0, 1):
        obs.append(caixa("listra", (0, sy * 0.35, 0.0145), (LARG - 0.34, 0.07, 0.005),
                         0x6B5A63, 0.002, 1))
    for sx in (-1, 1):
        obs.append(caixa("franja", (sx * (LARG / 2 - 0.045), 0, 0.0105),
                         (0.05, COMP - 0.06, 0.005), 0xCFC6B8, 0.002, 1))
    return obs


def torneira(metal=INOX):
    """Gooseneck, com a origem na COTA DO TAMPO (z = 0) -- e peca de INSTANCIA:
       `piaParam` no `app.js` a posiciona em cima da cuba, e por isso ela nao mora
       no catalogo nem e escalada por ninguem.

       Existe como peca separada porque como parte da `pia` ela empurrava a caixa
       envolvente medida pra 1,16 e `atualizaMovel` chegava a esmagar a bancada
       inteira em 79% (ver o cabecalho deste arquivo)."""
    import math
    obs = []
    R = 0.062
    obs.append(cilindro("base", (0, 0, 0.0), 0.030, 0.016, metal, 14))
    obs.append(cilindro("coluna", (0, 0, 0.012), 0.017, 0.19, metal, 12))
    # o arco: 8 segmentos curtos, cada um girado pela tangente. Meia volta em YZ,
    # do topo da coluna ate a bica, que aponta pra frente e pra baixo.
    for k in range(9):
        t = math.pi * (1.0 - k / 8.0)
        obs.append(caixa("arco", (0, R + R * math.cos(t), 0.20 + R * math.sin(t)),
                         (0.022, 0.022, 0.040), metal, 0.008, 2, rot=(t, 0, 0)))
    obs.append(cilindro("bica", (0, 2 * R, 0.16), 0.011, 0.045, metal, 10))
    return obs


# ------------------------------------------------------------------- cuba --

def cuba(metal=INOX):
    """Cuba de EMBUTIR, origem no plano do tampo (z = 0), descendo. Cinco chapas
       finas em volta do vao -- cuba de verdade e um FURO, e a versao antiga era um
       bloco claro EM CIMA do tampo."""
    obs = []
    VX, VY, H = 0.44, 0.38, 0.17
    obs.append(caixa("fundo", (0, 0, -H + 0.006), (VX - 0.02, VY - 0.02, 0.012),
                     metal, 0.004, 1))
    for sx, sy in ((-1, 0), (1, 0), (0, 1), (0, -1)):
        obs.append(caixa("parede", (sx * (VX - 0.012) / 2, sy * (VY - 0.012) / 2, -H / 2),
                         (0.012 if sx else VX, 0.012 if sy else VY, H), metal, 0.004, 1))
    return obs

def cuba_apoio(louca=0xF4F2EE):
    """Cuba de APOIO, origem no plano do tampo (z = 0), subindo. E a do banheiro das
       referencias: um volume branco EM CIMA da bancada, nao um furo nela."""
    obs = []
    VX, VY, H = 0.40, 0.34, 0.13
    obs.append(caixa("corpo", (0, 0, H / 2), (VX, VY, H), louca, 0.022, 3))
    obs.append(caixa("bacia", (0, 0, H - 0.045), (VX - 0.06, VY - 0.06, 0.08),
                     0xD8D5D0, 0.018, 3))
    return obs

# `armario` e `guardaroupa` sairam daqui: viraram caixa parametrica no `app.js`
# (marcenaria retilinea nao precisa do Blender, e assim ganham COLUNA em vez de
# porta esticada). O `sofa` inteiro saiu pelo mesmo motivo, mas ao contrario --
# estofado precisa do Blender, entao o que se modela e o MODULO.
CATALOGO = {"sofa_mod": sofa_mod, "sofa_braco": sofa_braco,
            "torneira": torneira, "cuba": cuba, "cuba_apoio": cuba_apoio,
            "fogao": fogao,
            "coifa": coifa, "criado": criado, "cama": cama, "cortina": cortina,
            "geladeira": geladeira, "mesa": mesa, "cadeira": cadeira,
            "estante": estante,
            "vaso": vaso, "tapete": tapete}
