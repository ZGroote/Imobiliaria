"""Constrói manequim (com shape keys) e jaqueta (tamanho fixo) e exporta para o site.

uso: python3 construir.py <pasta_build> <pasta_site_modelos>
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import cena  # noqa: E402
import modelo  # noqa: E402
import texturas  # noqa: E402

build = Path(sys.argv[1] if len(sys.argv) > 1 else "../build").resolve()
site = Path(sys.argv[2] if len(sys.argv) > 2 else "../site/modelos").resolve()
tex = build / "texturas"
tex.mkdir(parents=True, exist_ok=True)
site.mkdir(parents=True, exist_ok=True)
texturas.denim(tex)
texturas.sherpa(tex)


def exportar(ob, caminho, morph):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=str(caminho), use_selection=True, export_format="GLB",
                              export_morph=morph, export_morph_normal=morph, export_apply=False,
                              export_image_format="AUTO", export_yup=True)


# ---------------------------------------------------------------- manequim
cena.limpar()
man = cena.objeto("Manequim", modelo.corpo(dict(modelo.MINIMO)), [cena.material_manequim()])
cena.shape_keys(man, modelo.corpo)
exportar(man, site / "manequim.glb", True)

# ---------------------------------------------------------------- jaqueta
cena.limpar()
jaq = cena.objeto("Jaqueta", cena.jaqueta_malha(), cena.materiais_jaqueta(tex))
exportar(jaq, site / "jaqueta.glb", False)

# ---------------------------------------------------------------- dados de caimento
# Circunferências do corpo nas alturas de prova: ajusta c0 + sum(c_k * medida_k)
rng = np.random.default_rng(1)
X, Y = [], {k: [] for k in modelo.SONDAS}
for _ in range(300):
    p = {k: rng.uniform(*modelo.FAIXAS[k]) for k in modelo.PARAMS}
    X.append([1.0] + [p[k] for k in modelo.PARAMS])
    for k, v in modelo.sondas_corpo(p).items():
        Y[k].append(v)
X = np.array(X)
coef, erro = {}, {}
for k, y in Y.items():
    c, *_ = np.linalg.lstsq(X, np.array(y), rcond=None)
    coef[k] = dict(zip(["const"] + modelo.PARAMS, map(float, c)))
    erro[k] = float(np.abs(X @ c - np.array(y)).max())

pj = modelo.params_peca()
dados = {
    "faixas": modelo.FAIXAS,
    "peca": modelo.PECA,
    "jaqueta_altura_base": pj["altura"],
    "fator_deslocamento": 0.81,
    "jaqueta_interna": modelo.sondas_jaqueta(),
    "corpo_coef": coef,
    "corpo_coef_erro_max_m": erro,
    "manga_alcance_m": 0.348 * pj["altura"] + 0.03,  # da articulação do ombro ao fim do punho
    "corpos_referencia": modelo.TAMANHOS,
}
(site / "provador.json").write_text(json.dumps(dados, indent=1, ensure_ascii=False))
print("ok", {k: round(v * 1000, 2) for k, v in erro.items()}, "mm de erro máx. no ajuste linear")
