# -*- coding: utf-8 -*-
"""A tabela das 20 especies -- DADO PURO, sem `bpy`.

Vive fora do `arvores.py` por um motivo pratico: o gerador so roda dentro do Blender,
e ferramenta que precisa saber a cor de uma especie (o `recolorir.py`, por exemplo)
nao pode depender de ter o Blender aberto. Enquanto a tabela morava dentro do gerador,
a unica forma de mexer em cor era com o Blender de pe.

Campos de cor, todos em sRGB:
  leaf       a folhagem.
  flower     a floracao REAL da especie. Fica registrada mesmo quando nao e usada:
             e informacao botanica, nao decisao de render.
  flor_verde o verde que ENTRA no lugar da flor quando `FLORACAO` e 0. Nao e igual ao
             `leaf` de proposito -- a copa de duas cores e o que da volume a arvore
             vista de cima, e achatar tudo numa cor so deixa a arvore chapada.
"""

# Fracao da floracao que entra no render, 0..1. Multiplica o `flower_ratio` de cada
# especie. Em 0 a cidade fica so em tons de verde (e o que esta em uso); em 1 os ipes,
# a quaresmeira, o flamboyant e o jacaranda saem floridos.
FLORACAO = 0.0

SPECIES = [
    dict(nome="mangueira", style="dome", h=9.5, cr=5.4, leaf="#3E7A34", bark="#4A3A2C",
         tr=0.42, fork=0.30, branches=5, flat=0.92, br=0.62, fill=5, cz=0.66),
    dict(nome="oiti", style="dome", h=7.0, cr=3.6, leaf="#3C7440",
         fork=0.45, branches=4, flat=0.95, br=0.66, fill=4),
    dict(nome="sibipiruna", style="layered", h=11.0, cr=5.0, leaf="#82B045",
         fork=0.50, branches=5, flat=0.55, br=0.54, fill=3, cz=0.78),
    dict(nome="ipe_amarelo", style="umbrella", h=9.0, cr=4.3, leaf="#8CA344",
         flower="#F2CE22", flor_verde="#A9C05C", flower_ratio=0.85,
         fork=0.52, branches=5, flat=0.42, br=0.60, fill=4, cz=0.80),
    dict(nome="ipe_roxo", style="umbrella", h=9.0, cr=4.0, leaf="#7E9C42",
         flower="#B47FD6", flor_verde="#5F8C3C", flower_ratio=0.85,
         fork=0.52, branches=5, flat=0.42, br=0.58, fill=4, cz=0.80),
    dict(nome="quaresmeira", style="dome", h=6.0, cr=3.0, leaf="#5E8544",
         flower="#8F5CBA", flor_verde="#7CA556", flower_ratio=0.70,
         fork=0.40, branches=4, flat=0.85, br=0.64, fill=4),
    dict(nome="flamboyant", style="umbrella", h=8.5, cr=6.8, leaf="#4E8A3B",
         flower="#DB4F31", flor_verde="#6FA84B", flower_ratio=0.55,
         fork=0.34, branches=6, flat=0.30, br=0.50, fill=6, cz=0.82, spread=1.15),
    dict(nome="figueira", style="irregular", h=12.0, cr=7.6, leaf="#457C3A", bark="#5A4C3E",
         tr=0.72, fork=0.26, branches=6, flat=0.80, br=0.56, fill=7, cz=0.66),
    dict(nome="jacaranda_mimoso", style="layered", h=10.0, cr=4.6, leaf="#6F8F4A",
         flower="#9F97DA", flor_verde="#8CA95E", flower_ratio=0.75,
         fork=0.48, branches=5, flat=0.50, br=0.52, fill=3, cz=0.78),
    dict(nome="palmeira_imperial", style="palm", h=16.0, cr=0, leaf="#4C7E36", bark="#B0A99B",
         shaft="#4F7A34", tr=0.36, fronds=13, flen=6.0, fw=0.95, droop=0.75,
         pitch=(-0.30, 0.95), belly=True, fsegs=6),
    dict(nome="coqueiro", style="palm", h=11.0, cr=0, leaf="#5C9040", bark="#9B8A6E",
         tr=0.26, lean=0.16, fronds=11, flen=4.6, fw=0.72, droop=0.85,
         pitch=(-0.25, 0.70), fsegs=6),
    dict(nome="palmeira_areca", style="clump_palm", h=6.5, cr=0, leaf="#5E9540", bark="#7A8A4E",
         tr=0.13, stems=5, lean=0.12, fronds=11, flen=3.2, fw=0.58, droop=0.55,
         pitch=(0.05, 1.05), fsegs=5),
    dict(nome="eucalipto", style="columnar", h=18.0, cr=4.2, leaf="#8AA077", bark="#CFC9BC",
         tr=0.34, fork=0.70, branches=4, anchor=0.28, blobs=14, cz=0.86),
    dict(nome="araucaria", style="candelabra", h=16.0, cr=4.4, leaf="#2E5A34",
         bark="#4A3B2E", arms=8),
    dict(nome="casuarina", style="cone", h=13.0, cr=1.7, leaf="#4A7150", bark="#5A4A3A", tiers=5),
    dict(nome="chapeu_de_sol", style="tiered", h=8.0, cr=5.0, leaf="#5E8F3C",
         fork=0.30, branches=4, tiers=4),
    dict(nome="ficus_topiaria", style="topiary", h=3.6, cr=1.8, leaf="#437C3A"),
    dict(nome="cinamomo", style="dome", h=8.0, cr=4.0, leaf="#6B9846",
         fork=0.44, branches=4, flat=0.80, br=0.62, fill=4),
    dict(nome="aroeira_salsa", style="weeping", h=7.0, cr=3.6, leaf="#74A052",
         fork=0.38, branches=5, flat=0.72, br=0.58, fill=3),
    dict(nome="arbusto", style="shrub", h=1.7, cr=1.2, leaf="#548C42"),
]


def cor_da_flor(s):
    """A cor que a copa florida usa HOJE: a flor de verdade se FLORACAO > 0, o verde
    substituto se nao. Uma funcao so pra que gerador e recolorizador nao facam a
    mesma conta em dois lugares."""
    if FLORACAO > 0:
        return s.get("flower")
    return s.get("flor_verde")
