"""Evidência independente da revisão 1; escreve somente nesta pasta.

python -I -B -X utf8 viabilidade/revisao/revisar.py varredura
python -I -B -X utf8 viabilidade/revisao/revisar.py caso <id>
python -I -B -X utf8 viabilidade/revisao/revisar.py auditoria
python -I -B -X utf8 viabilidade/revisao/revisar.py suite
"""
import copy
import hashlib
import importlib.util
import json
import re
import site
import subprocess
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.append(site.getusersitepackages())
AQUI = Path(__file__).resolve().parent
VIAB = AQUI.parent
REFERENCIA = AQUI / "referencias/0.8.1"
sys.path.insert(0, str(REFERENCIA))
import motor
import test_motor
from shapely.geometry import Polygon
from shapely.ops import unary_union


def ler(p):
    return json.loads(p.read_text(encoding="utf-8"))


# O motor pode evoluir durante a revisão. Código e exemplos ficam presos em 947e2ec8;
# auditoria, lei e terreno continuam sendo as entradas compartilhadas, somente lidas.
test_motor.AQUI = str(VIAB / "motor")
test_motor._carrega = lambda nome: ler(REFERENCIA / "exemplos" / nome)


def gravar(p, valor):
    assert p.resolve().is_relative_to(AQUI)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(valor, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def metricas(e):
    return {o["id"]: {k: o["metricas"][k] for k in
            ("unidades_estimadas", "area_privativa_m2", "area_computavel_m2", "vagas", "pavimentos")}
            for o in e["opcoes"]}


def perdas(a, b):
    falhas = []
    for op, x in a.items():
        y = b.get(op, {"unidades_estimadas": 0, "area_privativa_m2": 0})
        if y["unidades_estimadas"] < x["unidades_estimadas"]:
            falhas.append({"opcao": op, "tipo": "unidades", "antes": x, "depois": y})
        elif y["unidades_estimadas"] == x["unidades_estimadas"] and y["area_privativa_m2"] < x["area_privativa_m2"] - 0.1:
            falhas.append({"opcao": op, "tipo": "privativa", "antes": x, "depois": y})
    return falhas


def invariantes(e):
    problemas = []
    try:
        test_motor.confere(e)
    except AssertionError as exc:
        problemas.append(str(exc))
    for o in e["opcoes"]:
        m, pr = o["metricas"], e["premissas"]
        sub = sum(Polygon(v["base_utm"]).area * v["pavimentos"] for v in o["volumes"] if v["uso"] == "garagem")
        ocupado = unary_union([Polygon(v["base_utm"]) for v in o["volumes"]]).area
        if abs(sub - m["area_garagem_m2"]) > 0.011:
            problemas.append(f"{o['id']}: garagem métrica != geometria")
        if m["area_garagem_m2"] < m["vagas"] * pr["area_por_vaga_m2"] - 0.011:
            problemas.append(f"{o['id']}: vagas declaradas não cabem, mesmo com alerta")
        if abs(Polygon(e["lote"]["poligono_utm"]).area - ocupado - m["area_permeavel_m2"]) > 0.011:
            problemas.append(f"{o['id']}: permeabilidade métrica != geometria")
    for o in e["opcoes_ausentes"]:
        if o["motivo"] in ("erro", "dados_insuficientes"):
            problemas.append(str(o))
    return problemas


def pares():
    formas = {
        "retangulo": [(0, 0), (23, 0), (23, 37), (0, 37)],
        "estreito": [(0, 0), (13.5, 0), (13.5, 44), (0, 44)],
        "L": [(0, 0), (34, 0), (34, 18), (19, 18), (19, 43), (0, 43)],
        "trapezio": [(0, 0), (31, 0), (25, 42), (4, 42)],
        "triangulo": [(0, 0), (38, 0), (17, 47)],
    }
    mudancas = {
        "simetrico": ({"recuo_lateral_m": 3, "recuo_fundos_m": 3}, {"recuo_lateral_m": 1.5, "recuo_fundos_m": 1.5}),
        "fundos": ({"recuo_fundos_m": 8}, {"recuo_fundos_m": 2}),
        "frontal": ({"recuo_frontal_m": 7}, {"recuo_frontal_m": 3}),
        "CA": ({"ca_maximo": 2.7}, {"ca_maximo": 4.3}),
        "TO": ({"taxa_ocupacao": 0.24}, {"taxa_ocupacao": 0.62}),
        "altura": ({"altura_max_m": 22.5}, {"altura_max_m": 43.5}),
        "permeabilidade": ({"taxa_permeabilidade": 0.58}, {"taxa_permeabilidade": 0.22}),
    }
    out = []
    for forma, pts in formas.items():
        coords = [[205000 + x, 7564000 + y] for x, y in pts]
        l = {"id": "rev1-" + forma, "poligono_utm": coords, "frente": coords[:2],
             "area_m2": Polygon(coords).area, "zona_id": "REV1", "zona_origem": "teste", "zona_conferida": False}
        for gc in (False, True):
            z = {"id": "REV1", "nome": "Sintética de revisão", "conferido": False, "fontes": [], "parametros": {
                "ca_basico": 1, "ca_maximo": 4.3, "taxa_ocupacao": 0.62, "taxa_permeabilidade": 0.25,
                "recuo_frontal_m": 4, "recuo_lateral_m": 1.5, "recuo_fundos_m": 2,
                "altura_max_m": 43.5, "pavimentos_max": None, "garagem_computavel": gc}}
            for nome, (a, b) in mudancas.items():
                za, zb = copy.deepcopy(z), copy.deepcopy(z)
                za["parametros"].update(a)
                zb["parametros"].update(b)
                out.append({"id": f"{forma}-gc{int(gc)}-{nome}", "lote": l, "antes": za, "depois": zb, "premissas": {}})
    assert len(out) == 70 and len({p["id"] for p in out}) == 70
    return out


def executar_par(p, salvar=False):
    ts = time.perf_counter()
    es = [motor.gerar_estudo(p["lote"], p[k], p["premissas"]) for k in ("antes", "depois")]
    a, b = map(metricas, es)
    resultado = {"id": p["id"], "antes": a, "depois": b, "perdas": perdas(a, b),
                 "invariantes": [invariantes(e) for e in es], "segundos": round(time.perf_counter() - ts, 3)}
    testemunha = copy.deepcopy(es[0])
    testemunha["zona"] = p["depois"]
    testemunha["caixa_maxima"] = es[1]["caixa_maxima"]
    resultado["solucao_anterior_sob_regra_nova"] = invariantes(testemunha)
    if salvar and (resultado["perdas"] or any(resultado["invariantes"])):
        gravar(AQUI / "casos" / (p["id"] + ".json"), p)
        for k, e in zip(("antes", "depois"), es):
            gravar(AQUI / "casos" / (p["id"] + "-" + k + "-saida.json"), e)
    return resultado


def direcionados():
    base = pares()
    out = []
    for p in base:
        if p["id"].endswith("gc0-CA"):
            for perm in (0.45, 0.65):
                q = copy.deepcopy(p)
                q["id"] = p["id"] + f"-perm{perm}-CAalto"
                q["antes"]["parametros"].update(ca_maximo=2.8, taxa_permeabilidade=perm)
                q["depois"]["parametros"].update(ca_maximo=12, taxa_permeabilidade=perm)
                out.append(q)
    modelo = next(p for p in base if p["id"] == "L-gc1-frontal")
    for ca in (2.8, 3, 3.4, 3.8, 4, 4.2, 4.4, 4.8, 5.2, 6):
        q = copy.deepcopy(modelo)
        q["id"] += f"-ca{ca}"
        for k in ("antes", "depois"):
            q[k]["parametros"]["ca_maximo"] = ca
        out.append(q)
    for w, d in ((13, 23), (15, 22)):
        for gc in (False, True):
            q = copy.deepcopy(modelo)
            q["id"] = f"degrau-{w}x{d}-gc{int(gc)}"
            q["lote"]["poligono_utm"] = [[205000+x, 7564000+y] for x, y in ((0, 0), (w, 0), (w, d), (0, d))]
            q["lote"]["frente"] = q["lote"]["poligono_utm"][:2]
            q["lote"]["area_m2"] = w * d
            for k, r in (("antes", 4), ("depois", 1.5)):
                q[k]["parametros"].update(recuo_frontal_m=4, recuo_lateral_m=0, recuo_fundos_m=0,
                    garagem_computavel=gc, parede_cega_encosta_ate_m=12,
                    recuo_lateral_por_altura={"ate_pavimento": 2, "recuo_m": r, "acima": {"minimo_m": 1.5, "fracao_h": 0}})
            out.append(q)
    assert len(out) == 24
    return out


def auditoria():
    # Executa literalmente todos os comandos Python da tabela; alguns leem saídas antigas.
    md = (VIAB / "auditoria/AUDITORIA-5.md").read_text(encoding="utf-8")
    comandos = re.findall(r'`python -I -X utf8 -c "(.*?)"`', md)
    assert len(comandos) == 8, len(comandos)
    logs = []
    for i, codigo in enumerate(comandos, 1):
        fixar = f"import sys; sys.path.insert(0, {str(REFERENCIA)!r}); import motor; "
        run = subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", "-c", fixar + codigo], capture_output=True, text=True, encoding="utf-8")
        logs.append({"numero": i, "codigo": codigo, "exit_code": run.returncode, "stdout": run.stdout, "stderr": run.stderr})
        print(f"Comando literal {i}: exit {run.returncode}", flush=True)
    gravar(AQUI / "evidencias/auditoria-comandos.json", logs)
    atuais = {}
    for p in sorted((VIAB / "auditoria/casos").glob("audit5-saida-*.json")):
        e = test_motor._regera_caso(p.name)
        test_motor._impossivel_com_prova(e)
        atuais[p.name] = {"metricas": metricas(e), "invariantes": invariantes(e), "ausentes": e["opcoes_ausentes"]}
        gravar(AQUI / "evidencias/auditoria-atual" / p.name, e)
        print(f"Regenerado {p.name}: {atuais[p.name]['invariantes']}", flush=True)
    for a, b in (("perm55", "perm25"), ("trap-rb10", "trap-rb02"), ("trap-to20", "trap-to50"), ("trap-perm55", "trap-perm15"), ("gc-r3m0", "gc-r1m5")):
        print(a, b, perdas(atuais[f"audit5-saida-{a}.json"]["metricas"], atuais[f"audit5-saida-{b}.json"]["metricas"]), flush=True)
    gravar(AQUI / "evidencias/auditoria-atual.json", atuais)


def regressao():
    spec = importlib.util.spec_from_file_location("motor080", AQUI / "referencias/0.8.0/motor.py")
    antigo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(antigo)
    atuais = ler(AQUI / "evidencias/regressao-auditoria.json")
    rs = {}
    for nome, atual in atuais.items():
        fonte = ler(VIAB / "auditoria/casos" / nome)
        if fonte.get("erro"):
            ln, zn = {"saida-frente-repetida.json": ("lote-frente-repetida.json", "zona-base.json"),
                      "saida-zona-sem-ca-maximo.json": ("lote-base.json", "zona-sem-ca-maximo.json")}[nome]
            lote, zona, pr = ler(VIAB / "auditoria/casos" / ln), ler(VIAB / "auditoria/casos" / zn), {}
        else:
            lote, zona = fonte["lote"], fonte["zona"]
            pr = {k: v for k, v in fonte["premissas"].items() if k != "padrao" and k not in fonte["premissas"]["padrao"]}
        e = antigo.gerar_estudo(lote, zona, pr)
        rs[nome] = {"0.8.0": metricas(e), "0.8.1": atual["depois"], "perdas": perdas(metricas(e), atual["depois"])}
        if rs[nome]["perdas"]:
            rs[nome]["invariantes_080_sob_criterios_081"] = invariantes(e)
            gravar(AQUI / "evidencias/regressao-080" / nome, e)
        gravar(AQUI / "evidencias/regressao-080-081.json", rs)
        print(nome, rs[nome]["perdas"], flush=True)


def main():
    esperado = subprocess.check_output(["git", "show", "947e2ec8:viabilidade/motor/motor.py"])
    assert hashlib.sha256(Path(motor.__file__).read_bytes()).digest() == hashlib.sha256(esperado).digest(), "snapshot do motor divergente"
    assert perdas({"A": {"unidades_estimadas": 2, "area_privativa_m2": 120}}, {"A": {"unidades_estimadas": 1, "area_privativa_m2": 150}})
    assert not perdas({"A": {"unidades_estimadas": 1, "area_privativa_m2": 200}}, {"A": {"unidades_estimadas": 2, "area_privativa_m2": 150}})
    modo = sys.argv[1]
    if modo in ("varredura", "direcionados"):
        ps = pares() if modo == "varredura" else direcionados()
        gravar(AQUI / "evidencias" / (modo + "-pares.json"), ps)
        rs = []
        for i, p in enumerate(ps, 1):
            r = executar_par(p, salvar=True)
            rs.append(r)
            print(f"{i}/{len(ps)} {r['id']}: perdas={r['perdas']}, invariantes={r['invariantes']}", flush=True)
            gravar(AQUI / "evidencias" / (modo + ".json"), rs)
    elif modo == "caso":
        nome = sys.argv[2]
        p = next((p for p in pares() + direcionados() if p["id"] == nome), None)
        if p is None:
            p = ler(AQUI / "casos" / (nome + ".json"))
        print(json.dumps(executar_par(p), ensure_ascii=False, indent=2))
    elif modo == "auditoria":
        auditoria()
    elif modo == "regressao":
        regressao()
    elif modo == "suite":
        t = time.perf_counter()
        original = test_motor._regera_caso
        comparacoes = {}
        def registrar(nome):
            e = original(nome)
            antigo = ler(VIAB / "auditoria/casos" / nome)
            comparacoes[nome] = {"antes": metricas(antigo) if "opcoes" in antigo else None,
                                 "depois": metricas(e), "invariantes": invariantes(e)}
            if "opcoes" in antigo:
                comparacoes[nome]["perdas"] = perdas(metricas(antigo), metricas(e))
            gravar(AQUI / "evidencias/regressao-auditoria.json", comparacoes)
            return e
        test_motor._regera_caso = registrar
        test_motor.main()
        print(f"Suíte passou em {time.perf_counter() - t:.2f} s", flush=True)
    else:
        raise ValueError(modo)


if __name__ == "__main__":
    main()
