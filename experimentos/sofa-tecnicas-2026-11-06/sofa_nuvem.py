# -*- coding: utf-8 -*-
"""O sofa "nuvem" da referencia (moveis-referencia/sofa) refeito com as tecnicas novas.
Mesma camera casada com a foto (sofa/camera.json) e as mesmas medidas do r7; muda:
  - assento e encosto: almofada COSTURADA pelo molde (tampo + faixa), assento cai com gravidade;
  - tecido: linho escaneado com slub e sheen alto (chenille), variacao por peca;
  - almofadas soltas: envelope costurado (travesseiro), nao caixa inflada.
blender -b --python sofa_nuvem.py -- <saida.png>   (ESCALA=4 -> 4x a foto)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tecnicas import *
from mathutils import Matrix

C = kit.camera("sofa")
TEC = tecido("chenille_greige", tuple(int(v) for v in os.environ.get("COR", "168,139,132").split(",")),
             escala=0.30, sheen=0.35, sheen_rough=0.6, relevo=1.1, rough=(0.85, 1.0), slub=0.015,
             mescla=0.16, mescla_escala=110.0)
# sheen 0,8 refletia o ceu da janela: topo do assento azulado (final2). Mescla de ~3 mm sumia no
# denoise; ~9 mm (escala 110) aparece como o granulado do chenille da foto.
ALM = tecido("chenille_almofada", (178, 152, 144), escala=0.30, sheen=0.35, sheen_rough=0.6, relevo=1.1,
             rough=(0.85, 1.0), slub=0.015, mescla=0.16, mescla_escala=110.0)
PE = liso("pe_sofa", (60, 50, 42), 0.6)

# chao de colisao (o assento da foto vai ate o chao: pe escondido)
chao = caixa("chao_colisao", -5, 5, -6, 1.3, -0.02, 0.0, PE, 0)
chao.hide_render = True
colide(chao)

# bracos: UMA peca costurada pelo PERFIL (como na oficina): painel da frente + painel de tras com o
# desenho do braco (estreito embaixo, abrindo pra fora ate o rolo) e a faixa que da a volta. O r7 era
# caixa cisalhada + tubo, e a emenda dos dois virava calombo embaixo.
def perfil_braco(passo=0.02):
    """(s, z): s = pra FORA a partir da face de dentro (m), z = altura. Medidas do r7/foto: topo
    0,645, rolo de raio ~0,125 centrado 0,12 pra fora, base 0,17 de largura abrindo ate 0,25."""
    pts = [(0.0, 0.02), (0.0, 0.50)]
    cx, cz, r = 0.12, 0.52, 0.125
    for k in range(1, 24):
        a = math.radians(180 - 200 * k / 24)                # de dentro, por cima, ate -20 graus
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    pts += [(0.235, 0.40), (0.20, 0.20), (0.17, 0.02)]
    return pts


for lado in (-1, 1):
    n = "esq" if lado < 0 else "dir"
    cont = [(lado * s, z) for s, z in perfil_braco()]      # lado -1: fora = -x
    if lado < 0:
        cont.reverse()        # espelhar inverte o sentido do molde; desfaz pra normal sair pra fora
    o, aneis, _ = almofada_costurada("braco_" + n, 0, 0, 0.94, TEC, passo=0.022, contorno=cont)
    simula(o, pressao=0.12, gravidade=0.0, quadros=40, tensao=80, dobra=0.5)
    poe(o, (lado * 1.115, 0.50, 0.0), rot=(90, 0, 0))     # z local (profundidade) -> -y: frente na foto
    bpy.context.view_layer.update()
    for j, an in enumerate(aneis):
        vivo("braco_%s_costura_%d" % (n, j), o, an, TEC, r=0.0035)
    colide(o)
# estrutura do encosto: bloco FIXO (sem pano inflado), logo atras das almofadas do encosto. Inflado,
# ele crescia de 0,20 pra 0,41 m e invadia o assento (teste 12); recuado, abria um vao no meio (t13).
eb = caixa("encosto_base", -1.10, 1.10, 0.86, 1.06, 0.0, 0.66, TEC, bevel=0.03)
eb.modifiers["bevel"].segments = 4
colide(eb)

# assentos: bloco costurado (tampo de canto bem arredondado + faixa), cai e assenta no chao.
# Molde menor que a medida final (a pressao estufa): alvo 1,12 x 0,92 x 0,38.
ASSENTOS = (("assento_esq", -0.555), ("assento_dir", 0.555))      # simetrico: a da dir. encostava no braco
# as duas espumas ANTES das capas e as capas sem colidir uma com a outra: senao a segunda nasce num
# mundo diferente da primeira (encosta nela) e as duas saem diferentes (teste 12)
for nome, x in ASSENTOS:
    esp = caixa(nome + "_espuma", x - 0.525, x + 0.525, 0.02, 0.84, 0.005, 0.375, PE, bevel=0.06)
    esp.modifiers["bevel"].segments = 6
    esp.hide_render = True
    colide(esp)
for nome, x in ASSENTOS:
    # folga de ~2 cm pro braco (ele infla ~1,6 cm pra dentro): sem ela a da esquerda amassou (teste 6)
    # ESPUMA + CAPA, como na oficina. So pressao: com 0,18 a base abria em balao (final2); com 0,08 o
    # bloco alto virou saco e tombou (teste 9). A espuma (bloco de canto arredondado, escondido) segura
    # a forma; a capa costurada, 1 cm maior, assenta nela com gravidade e pressao leve -- dai o topo
    # levemente estufado e a dobra miuda na faixa.
    # capa JUSTA (5 mm de folga): com 1 cm o tampo sobrava e enrugava na diagonal (teste 10).
    # SEM gravidade: com ela a capa escorregava pra frente e o vinco mudava a cada rodada (t11 x final3);
    # a pressao so encosta a capa na espuma, por igual -- o resultado se repete.
    o, aneis, _ = almofada_costurada(nome, 1.06, 0.83, 0.375, TEC, raio=0.08, passo=0.025)
    poe(o, (x, 0.43, 0.19))
    simula(o, pressao=0.10, gravidade=0.0, colisao=True, quadros=40, tensao=150, dobra=0.8)
    vivo(nome + "_costura", o, aneis[0], TEC, r=0.0035)
# TRAVA: pecas que deviam ser iguais tem que sair iguais (o teste 12 saiu com 3 cm de diferenca)
_med = [np.ptp(np.array([v.co[:] for v in bpy.data.objects[n].data.vertices]), 0) for n, _ in ASSENTOS]
if np.abs(_med[0] - _med[1]).max() > 0.015:          # 1 cm de estufado no tampo e ruido; 3 cm nao
    raise RuntimeError("assentos diferentes: %s x %s" % (_med[0].round(3), _med[1].round(3)))

# encosto: almofada costurada em pe, deitada 12 graus pra tras (mesmo lugar do r7)
for nome, x in (("encosto_esq", -0.555), ("encosto_dir", 0.560)):
    o, aneis, _ = almofada_costurada(nome, 1.05, 0.40, 0.13, TEC, raio=0.08, passo=0.022)
    simula(o, pressao=0.8, gravidade=0.0, quadros=40, tensao=60, dobra=0.3)
    # apoiada NO assento (na foto nao ha vao escuro entre os dois): mais pra frente e mais baixa
    poe(o, (x, 0.68, 0.59), rot=(90 - 10, 0, 0))
    bpy.context.view_layer.update()
    for j, an in enumerate(aneis):
        vivo("%s_costura_%d" % (nome, j), o, an, TEC, r=0.0035)
    colide(o)
for nome, _ in ASSENTOS:
    colide(bpy.data.objects[nome])

# almofadas soltas: costuradas e JOGADAS no canto com gravidade -- param no braco, no assento e no
# encosto. Postas na mao (posicoes do r7, outra geometria) elas atravessavam o braco e o encosto.
SOLTAS = []
for nome, x, giro in (("almofada_esq", -0.80, 25), ("almofada_dir", 0.80, -25)):
    # FORMA: caixa inflada do kit (a do n5, a mais bonita: canto em ponta, face lisa). Faixa de 5 cm
    # virou bloco (t14); envelope de 8 mm virou bola ou face amassada (t15). DEPOIS ela e JOGADA:
    # mesmo pano, ja cheio, cai com gravidade e se ajeita no braco/encosto (dobra alta = nao murcha).
    o = solto(kit.estofado, nome, 0.58, 0.10, 0.58, ALM, pressao=1.3, passo=0.02)
    for mo in list(o.modifiers):
        o.modifiers.remove(mo)                               # tira o subsurf: o pano simula a malha real
    o.data.transform(Matrix.Rotation(math.radians(-90), 4, "X"))   # fina em Z, deitada como o molde
    o.rotation_mode = "ZXY"                                  # levanta (X) e vira pro meio (Z)
    o.location = (x, 0.40, 0.74)
    o.rotation_euler = (math.radians(70), 0, math.radians(giro))
    bpy.context.view_layer.update()
    # pressao so pra nao murchar: com 0,15 ela inflou de 0,56 pra 0,70 m (t16)
    simula(o, pressao=0.04, gravidade=1.0, quadros=70, tensao=100, dobra=3.0, massa=0.002, ar=0.5,
           checa_topo=False)
    ss = o.modifiers.new("sub", "SUBSURF")
    ss.levels = ss.render_levels = 1
    SOLTAS.append(o)

# TRAVA: nada atravessando nada (almofada dentro do braco/encosto foi o que o usuario viu).
from mathutils.bvhtree import BVHTree
dg = bpy.context.evaluated_depsgraph_get()
def _bvh(o):
    """Malha avaliada em coordenadas do MUNDO (FromObject fica no espaco local de cada peca e
    comparar duas pecas assim da falso alarme)."""
    me = o.evaluated_get(dg).to_mesh()
    mw = o.matrix_world
    vs = [mw @ v.co for v in me.vertices]
    ps = [tuple(p.vertices) for p in me.polygons]
    t = BVHTree.FromPolygons(vs, ps)
    o.evaluated_get(dg).to_mesh_clear()
    return t
for a in SOLTAS:
    for nb in ("braco_esq", "braco_dir", "encosto_esq", "encosto_dir", "encosto_base", "assento_esq", "assento_dir"):
        n_cruz = len(_bvh(a).overlap(_bvh(bpy.data.objects[nb])))
        log("cruzamento %s x %s: %d triangulos" % (a.name, nb, n_cruz))
        if n_cruz > 40:
            raise RuntimeError("%s atravessa %s (%d pares de triangulos)" % (a.name, nb, n_cruz))

# ------------------------------------------------------------------ sala (como a foto)
PAREDE = tinta_parede("parede", (238, 236, 232))
TAPETE = tecido("tapete", (196, 188, 174), escala=0.10, sheen=0.3, relevo=1.6, rough=(0.9, 1.0), slub=0.06)
PISO = madeira("piso_madeira", (0.85, 0.72, 0.58), rough=0.45, escala=1.6)
MESA = madeira("mesa_centro", (0.95, 0.70, 0.48), rough=0.35)
XL, XR, YF, YB, PD = -3.2, 3.2, -5.5, 1.30, 2.70
JY0, JY1, JZ0, JZ1 = -3.0, 0.4, 0.0, 2.40               # janela de piso a teto na esquerda, fora do quadro
kit.amb(caixa("parede", XL, XR, YB, YB + 0.1, 0, PD, PAREDE, 0))
kit.amb(caixa("parede_dir", XR, XR + 0.1, YF, YB, 0, PD, PAREDE, 0))
kit.amb(caixa("parede_frente", XL, XR, YF - 0.1, YF, 0, PD, PAREDE, 0))
kit.amb(caixa("teto", XL - 0.1, XR + 0.1, YF - 0.1, YB + 0.1, PD, PD + 0.1, tinta_parede("teto", (242, 240, 236)), 0))
for nm_, a in (("a", (YF, JY0, 0, PD)), ("b", (JY1, YB, 0, PD)), ("c", (JY0, JY1, JZ1, PD))):
    kit.amb(caixa("parede_esq_" + nm_, XL - 0.1, XL, a[0], a[1], a[2], a[3], PAREDE, 0))
kit.amb(caixa("piso", XL, XR, YF, YB, -0.02, 0.0, PISO, 0))
kit.amb(caixa("rodape", XL, XR, YB - 0.012, YB, 0, 0.07, liso("rodape", (236, 233, 226), 0.55), 0.001))
kit.amb(caixa("tapete", -1.9, 1.9, -2.5, 1.2, 0.0, 0.01, TAPETE, 0.003))
# o que a foto tem em volta: prateleira com luminaria (esq.), quadro redondo, quadro listrado (dir.)
CARV = madeira("carvalho_claro", (0.95, 0.80, 0.62), rough=0.4)
LINHO_CUP = tecido("cupula", (226, 214, 196), escala=0.25, sheen=0.2, relevo=0.6, slub=0.03)
caixa("prateleira", -2.40, -1.42, 1.02, 1.30, 0.70, 0.74, CARV)
cilindro("abajur_base", 0.05, 0.07, 0.26, liso("ceramica_abajur", (222, 206, 182), 0.45), seg=48,
         loc=(-1.80, 1.16, 0.74), sub=1)
cilindro("abajur_cupula", 0.17, 0.11, 0.19, LINHO_CUP, seg=64, loc=(-1.80, 1.16, 0.99))
caixa("quadro1_moldura", -1.02, -0.52, YB - 0.03, YB - 0.002, 1.42, 1.98, CARV)
caixa("quadro1_fundo", -0.99, -0.55, YB - 0.033, YB - 0.02, 1.45, 1.95, liso("papel1", (236, 232, 224), 0.85), 0.0005)
c1 = cilindro("quadro1_circulo", 0.15, 0.15, 0.002, liso("ocre", (214, 196, 166), 0.85), seg=64, loc=(-0.77, YB - 0.034, 1.70))
c1.rotation_euler = (math.radians(90), 0, 0)
caixa("quadro2_moldura", 1.62, 2.08, YB - 0.03, YB - 0.002, 0.95, 1.95, liso("preto_fosco", (40, 38, 36), 0.6))
for k in range(9):                                       # listras pretas e brancas, como na foto
    caixa("listra_%d" % k, 1.65, 2.05, YB - 0.033, YB - 0.02, 0.98 + k * 0.106, 0.98 + k * 0.106 + 0.05,
          liso("listra", (232, 230, 226) if k % 2 else (38, 36, 34), 0.8), 0)
cilindro("mesa_tampo", 0.29, 0.29, 0.04, MESA, seg=96, loc=(0.30, -1.80, 0.24))
cilindro("mesa_base", 0.24, 0.24, 0.24, MESA, seg=96, loc=(0.30, -1.80, 0.0))
cilindro("tigela", 0.045, 0.08, 0.055, liso("ceramica", (225, 220, 212), 0.5), seg=48, loc=(0.40, -1.76, 0.28), sub=1)
caixa("livros", 0.08, 0.28, -1.88, -1.74, 0.28, 0.30, liso("capa", (215, 210, 200), 0.7))

# ------------------------------------------------------------------ luz (archviz-realista)
# A foto e luz de dia difusa vinda da esquerda (sombra mole a direita das almofadas): ceu fisico entrando
# pela janela grande + sol fraco e alto (so pra ter direcao), nenhuma luminaria acesa.
ELEV, AZ = 38.0, float(os.environ.get("AZ_SOL", "30"))
S.world = bpy.data.worlds.new("ceu")
try:
    S.world.use_nodes = True
except Exception:
    pass
wn = S.world.node_tree
sky = wn.nodes.new("ShaderNodeTexSky")
tipos = [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items]
sky.sky_type = next((t for t in ("NISHITA", "MULTIPLE_SCATTERING", "SINGLE_SCATTERING") if t in tipos), tipos[0])
for at, val in (("sun_disc", False), ("sun_elevation", math.radians(ELEV)), ("altitude", 300.0)):
    try:
        setattr(sky, at, val)
    except Exception:
        pass
bg = next(n for n in wn.nodes if n.type == "BACKGROUND")
bg.inputs["Strength"].default_value = float(os.environ.get("CEU", "1.0"))
wn.links.new(sky.outputs["Color"], bg.inputs["Color"])
sd_ = bpy.data.lights.new("sol", "SUN")
sd_.energy, sd_.angle = float(os.environ.get("SOL", "1.2")), math.radians(4.0)    # sol largo = sombra mole
sd_.use_temperature, sd_.temperature = True, 5200
sol = bpy.data.objects.new("sol", sd_)
S.collection.objects.link(sol)
d = Vector((math.cos(math.radians(ELEV)) * math.cos(math.radians(AZ)),
            math.cos(math.radians(ELEV)) * math.sin(math.radians(AZ)), -math.sin(math.radians(ELEV))))
sol.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
pl = bpy.data.lights.new("portal", "AREA")
pl.shape, pl.size, pl.size_y = "RECTANGLE", JY1 - JY0, JZ1 - JZ0
for alvo in (pl, getattr(pl, "cycles", None)):
    try:
        alvo.is_portal = True
        break
    except Exception:
        pass
po = bpy.data.objects.new("portal", pl)
S.collection.objects.link(po)
po.location = (XL - 0.05, (JY0 + JY1) / 2, (JZ0 + JZ1) / 2)
po.rotation_euler = Vector((1, 0, 0)).to_track_quat("-Z", "Y").to_euler()

S.view_settings.exposure = float(os.environ.get("EXPO", "1.1"))
S.view_settings.use_white_balance = True
S.view_settings.white_balance_temperature = float(os.environ.get("WB", "10000"))
S.cycles.sample_clamp_indirect = 10.0
ESC = int(os.environ.get("ESCALA", "4"))
kit.render(SAIDA, (C["res"][0] * ESC, C["res"][1] * ESC), amostras=48 if TESTE else 256,
           look=os.environ.get("LOOK", "AgX - High Contrast"), vista=os.environ.get("VISTA", "AgX"))
