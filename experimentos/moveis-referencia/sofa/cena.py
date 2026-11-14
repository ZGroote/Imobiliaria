# -*- coding: utf-8 -*-
"""Sofa 3 lugares estilo nuvem (linho greige, braco em rolo, encosto solto, 2 almofadas).
Sem catalogo: largura 2,50 na frente; camera e alturas pelas linhas da foto (sofa/camera.json).
Tudo que e estofado sai de kit.estofado (caixa de pano inflada por pressao).
    blender -b --factory-startup --python sofa/cena.py -- [saida.png]
Frente do assento em y=0, fundo em +y, chao em z=0 (m)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import kit
from kit import caixa, material, luz, estofado, poe, rolo

C = kit.camera("sofa")
TEC = material("linho_greige", (186, 168, 157), rough=0.9, tex="linho", relevo=0.3, sheen=0.4, spec=0.3,
               tinta=kit.lin((190, 171, 159))[:3])
ALM = material("linho_almofada", (196, 182, 173), rough=0.9, tex="linho", relevo=0.3, sheen=0.4, spec=0.3,
               tinta=kit.lin((192, 178, 168))[:3])
PE = material("pe_sofa", (60, 50, 42), rough=0.6)

# assentos (bloco unico assento+base, firme)
for nome, x in (("assento_esq", -0.565), ("assento_dir", 0.570)):
    poe(estofado(nome, 1.12, 0.92, 0.38, TEC, pressao=0.08, passo=0.03), (x, 0.46, 0.215))
# bracos: corpo + rolo por cima, estufado pra fora
for lado in (-1, 1):
    n = "esq" if lado < 0 else "dir"
    b = estofado("braco_%s" % n, 0.16, 0.98, 0.50, TEC, pressao=0.12, passo=0.025)
    # voluta: o lado de FORA abre subindo (embaixo 0,13 m de frente, em cima emenda no rolo)
    for v in b.data.vertices:
        if v.co.x * lado > 0:
            v.co.x += lado * 0.10 * (v.co.z + 0.25) / 0.50
    poe(b, (lado * 1.195, 0.50, 0.25))
    # rolo gordo, pendendo pra fora do corpo (na foto ele vai de u 23 a ~60: 0,27 m)
    poe(rolo("rolo_%s" % n, 0.13, 1.02, TEC, achata=0.95), (lado * 1.235, 0.52, 0.515))
# estrutura do encosto (atras das almofadas)
poe(estofado("encosto_base", 2.24, 0.20, 0.66, TEC, pressao=0.08, passo=0.04), (0.0, 0.95, 0.35))
# almofadas do encosto: deitadas pra tras 12 graus, a frente de baixo no fundo do assento
for nome, x in (("encosto_esq", -0.555), ("encosto_dir", 0.560)):
    poe(estofado(nome, 1.08, 0.16, 0.40, TEC, pressao=0.8, passo=0.025), (x, 0.76, 0.63), (-12, 0, 0))
# almofadas soltas, inclinadas
poe(estofado("almofada_esq", 0.60, 0.10, 0.60, ALM, pressao=1.3, passo=0.02), (-0.97, 0.55, 0.60), (-55, 35, 0), "YXZ")
poe(estofado("almofada_dir", 0.60, 0.10, 0.60, ALM, pressao=1.3, passo=0.02), (0.96, 0.55, 0.58), (-55, -32, 0), "YXZ")

# meta de triangulos no navegador (exporta.py decima; o relevo assado devolve a ruga)
import bpy
for nome, n in {"assento_esq": 1500, "assento_dir": 1500, "encosto_esq": 1200, "encosto_dir": 1200,
                "braco_esq": 700, "braco_dir": 700, "rolo_esq": 600, "rolo_dir": 600, "encosto_base": 500,
                "almofada_esq": 900, "almofada_dir": 900}.items():
    bpy.data.objects[nome]["tri_alvo"] = n

# ------------------------------------------------------------------ sala
PAREDE = material("parede", (238, 236, 232), rough=0.9)
TAPETE = material("tapete", (188, 184, 174), rough=1.0, sheen=0.5)
PISO = material("piso_madeira", (170, 125, 85), rough=0.5)
kit.amb(caixa("parede", -5, 5, 1.30, 1.40, 0, 3, PAREDE, bevel=0))
kit.amb(caixa("piso", -5, 5, -6, 1.30, -0.02, 0.0, PISO, bevel=0))
kit.amb(caixa("tapete", -1.9, 1.9, -2.5, 1.2, 0.0, 0.01, TAPETE, bevel=0.003))

luz("ceu", "AREA", (0.0, -0.6, 2.8), 125, (1.0, 0.98, 0.96), 3.5, (0.0, 0.3, 0.0), tam_y=3.0)
luz("frente", "AREA", (0.3, -4.2, 1.5), 8, (1.0, 0.97, 0.93), 3.0, (0.0, 0.3, 0.5))
luz("janela", "AREA", (-3.0, -0.5, 1.4), 35, (1.0, 0.99, 0.97), 2.0, (0.0, 0.4, 0.6))
kit.mundo((235, 233, 230), 0.07)
kit.render(kit.saida_padrao("sofa"), (C["res"][0] * 2, C["res"][1] * 2), vista="Standard")
