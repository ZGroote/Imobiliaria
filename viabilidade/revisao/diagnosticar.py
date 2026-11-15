"""Reproduz os caminhos responsáveis pelos dois achados sem editar o motor."""
import copy
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import revisar as r
from shapely.geometry import Polygon


def main():
    nome = sys.argv[1]
    p = r.ler(r.AQUI / "casos" / (nome + ".json"))
    resultados = []
    original = r.motor._melhor
    antigo = r.motor.gerar_estudo(p["lote"], p["antes"], p["premissas"])
    alvo = "B" if "CAalto" in nome else "A"
    o = next(o for o in antigo["opcoes"] if o["id"] == alvo)
    testemunha = [dict(v, _geom=Polygon(v["base_utm"]), _pav_abaixo=0)
                  for v in o["volumes"] if v["uso"] == "residencial"]

    def observar(fazer, n_max, ctx, base=0, falhou=None):
        achado = original(fazer, n_max, ctx, base, falhou)
        if fazer.__name__ != "fazer_" + alvo.lower():
            return achado
        n = o["metricas"]["pavimentos"]
        vols = fazer(n, 1.0)
        if vols is None:
            return achado
        m = r.motor._avaliar(vols, ctx)[0]
        item = {"subsolo_disponivel": ctx["subsolo"].area, "cap": ctx["cap"], "perm_min": ctx["perm_min"],
                "n": n, "natural": m, "natural_cabe": r.motor._cabe(m, vols, ctx),
                "ajuste_chamado": m["area_computavel_m2"] > ctx["cap"] + 0.01,
                "retorno_busca": achado[1] if achado else None, "amostras_viaveis": []}
        if "CAalto" in nome:
            for i in range(1, 20):
                f = i / 20
                vs = fazer(n, f)
                if vs:
                    ms = r.motor._avaliar(vs, ctx)[0]
                    if r.motor._cabe(ms, vs, ctx):
                        item["amostras_viaveis"].append({"f": f, "metricas": ms})
            if not item["natural_cabe"] and not item["ajuste_chamado"] and item["amostras_viaveis"]:
                assert item["retorno_busca"] is None
        else:
            ms, sub, avisos = r.motor._avaliar(copy.deepcopy(testemunha), ctx)
            item["mesmo_predio_anterior_reavaliado"] = {"metricas": ms, "avisos": avisos,
                "cabe": r.motor._cabe(ms, testemunha, ctx), "garagens": sub}
        resultados.append(item)
        return achado

    r.motor._melhor = observar
    try:
        for lado in ("antes", "depois"):
            inicio = len(resultados)
            r.motor.gerar_estudo(p["lote"], p[lado], p["premissas"])
            for v in resultados[inicio:]:
                v["regra"] = lado
    finally:
        r.motor._melhor = original
    r.gravar(r.AQUI / "evidencias" / ("diagnostico-" + nome + ".json"), resultados)
    for x in resultados:
        print(x["regra"], "cap", x["cap"], "subsolo", round(x["subsolo_disponivel"], 3),
              "natural", {k: x["natural"][k] for k in ("area_computavel_m2", "area_permeavel_m2", "unidades_estimadas")},
              "cabe", x["natural_cabe"], "ajuste", x["ajuste_chamado"],
              "viaveis", [(v["f"], v["metricas"]["unidades_estimadas"]) for v in x["amostras_viaveis"]],
              "mesmo_predio", x.get("mesmo_predio_anterior_reavaliado", {}).get("metricas"))
    assert resultados


if __name__ == "__main__":
    main()
