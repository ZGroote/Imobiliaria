# -*- coding: utf-8 -*-
"""Painel de TV com rack (referencia 7): madeira nature, marmore branco, ripado, prateleira com fita de
LED e TV de 55". Sem catalogo: largura 1,80 (painel e rack alinhados), alturas pela camera
(camera_painel.py) e pelo perfil de luminancia (bordas.py).
    blender -b --factory-startup --python painel-tv/cena.py -- [saida.png]
Parede em y = 0, frente negativa; chao z = 0."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bpy

C = kit.camera("painel-tv")
X0, X1 = -0.90, 0.90
HP = C["medidas"]["hp"]                         # topo do painel (~1,83)

MAD = material("madeira_painel", tex="madeira_nature", rough=0.6, relevo=0.3, spec=0.35, tinta=(1.12, 0.92, 0.72))
MAR = material("marmore", tex="marmore", rough=0.3, relevo=0.2, spec=0.5, tinta=(0.88, 0.84, 0.78))
TELA = material("tela_tv", (52, 50, 47), rough=0.5, spec=0.15)   # tela de produto: cinza fosco, nao espelho
MOLD = material("moldura_tv", (25, 25, 27), rough=0.4)
LED = material("fita_led", (255, 214, 160), emissao=2.0)
INT = material("fundo_nicho", (60, 40, 25), rough=0.8, spec=0.2)


def ripado(nome, z0, z1, y0=-0.04, passo=0.025, larg=0.018):
    caixa(nome + "_fundo", X0, X1, y0 + 0.018, -0.002, z0, z1, MAD, bevel=0)
    n = round((X1 - X0) / passo)
    for i in range(n):
        x = X0 + (i + 0.5) * passo
        # sem chanfro: 144 ripas chanfradas davam ~11 mil tri (a fresta escura ja desenha a ripa)
        caixa("%s_%d" % (nome, i), x - larg / 2, x + larg / 2, y0, y0 + 0.018, z0, z1, MAD, bevel=0, veio="z")


# ------------------------------------------------------------------ painel
ZR = 0.54                                        # tampo do rack
ripado("ripado_baixo", ZR + 0.005, 0.715)
caixa("marmore_painel", X0, X1, -0.05, -0.022, 0.715, 1.66, MAR, bevel=0.002)
caixa("fundo_painel", X0, X1, -0.022, -0.002, 0.715, 1.66, MAD, bevel=0)
caixa("prateleira", X0, X1 + 0.05, -0.24, -0.002, 1.66, 1.69, MAD, bevel=0.003, veio="x")
caixa("led", X0 + 0.05, X1 - 0.05, -0.06, -0.05, 1.655, 1.66, LED, bevel=0)   # junto da parede: so o brilho aparece
ripado("ripado_cima", 1.69, HP)
# TV de 55" (1,26 x 0,73), 3 cm de espessura, afastada 5 mm do marmore
caixa("tv_corpo", -0.60, 0.66, -0.085, -0.055, 0.82, 1.546, MOLD, bevel=0.004)
caixa("tv_tela", -0.592, 0.652, -0.0862, -0.084, 0.828, 1.538, TELA, bevel=0)

# ------------------------------------------------------------------ rack
YR = -0.40
caixa("rack_lado_esq", X0, X0 + 0.018, YR, 0, 0.06, ZR - 0.025, MAD, veio="z")
caixa("rack_lado_dir", X1 - 0.018, X1, YR, 0, 0.06, ZR - 0.025, MAD, veio="z")
caixa("rack_tampo", X0 - 0.01, X1 + 0.05, YR - 0.02, 0, ZR - 0.025, ZR, MAD, bevel=0.003, veio="x")
caixa("rack_rodape", X0 + 0.02, X1 - 0.02, YR + 0.02, -0.02, 0.0, 0.06, MAD, bevel=0.002, veio="x")
caixa("rack_base", X0 + 0.018, X1 - 0.018, YR + 0.018, 0, 0.06, 0.078, MAD, bevel=0)
caixa("rack_miolo", X0 + 0.018, X1 - 0.018, YR + 0.018, -0.01, 0.078, 0.355, INT, bevel=0)
for nome, a, b in (("porta_esq", X0 + 0.003, -0.002), ("porta_dir", 0.002, X1 - 0.003)):
    caixa(nome, a, b, YR - 0.002, YR + 0.016, 0.065, 0.355, MAR, bevel=0.002)
# nicho: prateleira, fundo, bloco central de madeira
caixa("nicho_piso", X0 + 0.018, X1 - 0.018, YR, -0.01, 0.355, 0.373, MAD, veio="x")
caixa("nicho_fundo", X0 + 0.018, X1 - 0.018, -0.03, -0.01, 0.373, ZR - 0.025, INT, bevel=0)
caixa("nicho_bloco", -0.10, 0.24, YR, -0.03, 0.373, ZR - 0.025, MAD, veio="z")

# ------------------------------------------------------------------ sala
PAREDE = material("parede_verde", (150, 138, 112), rough=0.9)
PISO = material("piso_madeira", (190, 140, 95), rough=0.5)
kit.amb(caixa("parede", -4, 4, 0.0, 0.1, 0, 3.0, PAREDE, bevel=0))
kit.amb(caixa("piso", -4, 4, -5, 0.0, -0.01, 0.0, PISO, bevel=0))
luz("janela_dir", "AREA", (2.6, -1.6, 1.5), 90, (1.0, 0.95, 0.88), 2.0, (0.0, -0.2, 1.0), tam_y=2.4)
luz("frente", "AREA", (-2.2, -3.0, 1.6), 75, (1.0, 0.94, 0.86), 3.0, (0.0, -0.2, 1.0))
luz("led_luz", "AREA", (0.0, -0.07, 1.645), 4, (1.0, 0.82, 0.62), 1.6, (0.0, -0.07, 0.0), tam_y=0.02)
kit.mundo((220, 205, 180), 0.08)
kit.render(kit.saida_padrao("painel-tv"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")
