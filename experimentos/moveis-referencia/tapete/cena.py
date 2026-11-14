# -*- coding: utf-8 -*-
"""Tapete de la grossa artesanal (referencia 8), creme, debrum cinza em dois lados, sobre porcelanato
cinza. O tapete e uma caixa baixa: o relevo da la e textura (la_cor/la_nor) -- igual no navegador.
Camera a mao (os cantos do tapete ficam fora do quadro na foto).
    blender -b --factory-startup --python tapete/cena.py -- [saida.png]"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz
import bpy

C = kit.camera("tapete")
A, B, GIRO = C["medidas"]["A"], C["medidas"]["B"], C["medidas"]["giro"]
LA = material("la", tex="la_fios", rough=0.95, relevo=0.8, sheen=0.6, spec=0.2, tinta=(1.18, 1.16, 1.10), escala=1.0)   # fios (fios.py)
DEBRUM = material("debrum", (150, 150, 152), rough=0.8, sheen=0.3)
partes = [caixa("tapete", -A / 2, A / 2, -B / 2, B / 2, 0.0, 0.025, LA, bevel=0.008, seg=3, veio="y"),   # fileiras atravessam
          caixa("debrum_esq", -A / 2 - 0.006, -A / 2 + 0.012, -B / 2, B / 2, 0.0, 0.022, DEBRUM, bevel=0.006, seg=3, veio="y"),
          caixa("debrum_frente", -A / 2, A / 2, -B / 2 - 0.006, -B / 2 + 0.012, 0.0, 0.022, DEBRUM, bevel=0.006, seg=3, veio="x")]
for o in partes:                                  # gira o conjunto: o canto aponta pra camera
    o.rotation_euler = (0, 0, math.radians(GIRO))
    o.location = (0.25, 1.80, 0.0)               # canto da frente logo abaixo do quadro (como na foto)

PISO = material("porcelanato", (165, 168, 174), rough=0.3)
REJ = material("rejunte", (95, 95, 97), rough=0.8)
kit.amb(caixa("piso", -5, 5, -5, 6, -0.01, 0.0, PISO, bevel=0))
for k in range(-6, 7):                             # porcelanato 60 x 120: rejunte
    kit.amb(caixa("rej_x%d" % k, k * 0.6 - 0.001, k * 0.6 + 0.001, -5, 6, 0.0, 0.0004, REJ, bevel=0))
for k in range(-4, 6):
    kit.amb(caixa("rej_y%d" % k, -5, 5, k * 1.2 - 0.001, k * 1.2 + 0.001, 0.0, 0.0004, REJ, bevel=0))
luz("sol_janela", "AREA", (3.0, 3.5, 2.6), 300, (1.0, 0.98, 0.95), 3.0, (0.0, 0.5, 0.0), tam_y=2.5)
luz("ceu", "AREA", (0.0, -1.0, 3.0), 80, (0.95, 0.97, 1.0), 4.0, (0.0, 0.5, 0.0))
kit.mundo((210, 212, 216), 0.15)
kit.render(kit.saida_padrao("tapete"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")
