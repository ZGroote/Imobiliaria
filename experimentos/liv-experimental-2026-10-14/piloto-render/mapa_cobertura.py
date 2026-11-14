"""Desenha o resultado do cobertura_vistas.py, visto de cima: à esquerda, só as superfícies que o Tour
enxerga, pintadas pelo número de vistas de treino do splat com que o Tour as mostra (a pior fica por
cima); à direita, as posições das rotas com a fração "cega" da imagem (pior rumo).

python mapa_cobertura.py <pasta-do-cobertura_vistas>
"""
import json, os, sys
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

pasta = sys.argv[1]
a = np.load(os.path.join(pasta, "amostras.npz")); res = json.load(open(os.path.join(pasta, "cobertura.json"), encoding="utf-8"))
P, zona = a["P"], a["zona"]
n = a["visto"]
dentro = n >= 0
ordem = np.argsort(-n[dentro])                                # menos vistas por cima

fig, ax = plt.subplots(1, 2, figsize=(18, 7.5), gridspec_kw={"width_ratios": [1.15, 1]})
cores = plt.get_cmap("RdYlGn")
sc = ax[0].scatter(P[dentro][ordem, 0], P[dentro][ordem, 1], c=np.clip(n[dentro][ordem], 0, 12), cmap=cores,
                   vmin=0, vmax=12, s=3, linewidths=0)
fig.colorbar(sc, ax=ax[0], label="vistas de treino que enxergam o ponto (12+ = verde)")
ax[0].set_title("O que o Tour enxerga: vistas de treino do splat que desenha cada ponto")

piores = {}
for v in res["vistas"]:
    k = tuple(v["pos"]); piores[k] = max(piores.get(k, 0), v["cego"])
xy = np.array(list(piores)); c = np.array(list(piores.values()))
ax[1].scatter(P[:, 0], P[:, 1], c="#e4e4e4", s=.3, linewidths=0)
sc2 = ax[1].scatter(xy[:, 0], xy[:, 1], c=c * 100, cmap="magma_r", vmin=0, vmax=40, s=60, edgecolors="k")
fig.colorbar(sc2, ax=ax[1], label=f"% da imagem do Tour com < {res['minimo']} vistas (pior rumo)")
ax[1].set_title("Posições do percurso do Tour")
for eixo in ax: eixo.set_aspect("equal"); eixo.set_xlabel("x (m, Blender)"); eixo.set_ylabel("y (m)")
fig.tight_layout(); fig.savefig(os.path.join(pasta, "mapa-cobertura.png"), dpi=110)
print(json.dumps(res["por_splat"], ensure_ascii=False, indent=1))
for v in sorted(res["vistas"], key=lambda v: -v["cego"])[:12]: print(v)
