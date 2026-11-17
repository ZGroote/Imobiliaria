"""Testes da prévia 3D (só assert). Rodar: python -I -X utf8 viabilidade/projetista/test_para_vista.py"""
import copy
import re
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Point, Polygon

from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.esquema import carregar_json
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.para_vista import revisao_para_estudo, serializar
from viabilidade.projetista.validador import _posicionar

PILOTOS = RAIZ / "viabilidade" / "motor" / "exemplos" / "pilotos"
P22421, P22426 = PILOTOS / "SC-completo-22421.json", PILOTOS / "SC-completo-22426.json"
INDEX = RAIZ / "viabilidade" / "visual" / "index.html"
_cache = {}


def revisao(piloto=P22421):
    if piloto not in _cache:
        e, site, regras = estudo_para_site(piloto)
        r = gerar_pavimento(site, regras, {"unidades": 6}, None, e)
        assert r["outcome"] == "gerado", r["outcome"]
        _cache[piloto] = r["revisoes"][0]
    return copy.deepcopy(_cache[piloto])


def test_volumes_e_lote():
    rev, est = revisao(), carregar_json(P22421.read_bytes())
    out = revisao_para_estudo(rev, P22421)
    assert len(out["opcoes"]) == 1 and out["opcoes"][0]["id"] == "projetista"
    assert out["lote"] == est["lote"] and out["zona"] == est["zona"] and out["caixa_maxima"] == est["caixa_maxima"]
    o, p = out["opcoes"][0], rev["floor_plates"][0]
    n = o["metricas"]["pavimentos"]
    por_andar = len(p["unit_placements"]) + len(p["shared_spaces"]) + len(p["cores"])
    assert n >= 1 and len(o["volumes"]) == por_andar * n
    assert len(p["unit_placements"]) == 6 and {v["uso"] for v in o["volumes"]} == {"unidade", "circulacao", "nucleo"}
    lote = Polygon(est["lote"]["poligono_utm"]).buffer(0.001)
    assert all(lote.covers(Polygon(v["base_utm"])) for v in o["volumes"])
    assert sorted({v["z0_m"] for v in o["volumes"]}) == [k * p["height_m"] for k in range(n)]
    m = o["metricas"]
    assert type(m["pavimentos"]) is int and type(m["unidades_estimadas"]) is int and m["unidades_estimadas"] == 6 * n
    assert abs(m["area_privativa_m2"] - rev["metrics_summary"]["privativa_total_m2"] * n) < 1e-3
    assert any("Prévia esquemática" in a and "preliminar" in a for a in o["alertas"])
    assert any("não conferida" in a for a in o["alertas"])  # 22421: lote.zona_conferida = false


def test_volta_de_coordenada():
    rev = revisao()
    o = revisao_para_estudo(rev, P22421, pavimentos=1)["opcoes"][0]
    fr = rev["site"]["local_frame"]
    (x0, y0), (ux, uy), (vx, vy) = fr["origem"], fr["u"], fr["v"]
    p = rev["floor_plates"][0]
    tipos = {t["id"]: t for t in rev["unit_types"]}
    esperado = [_posicionar(Polygon(tipos[q["unit_type_id"]]["outline_m"]), q) for q in p["unit_placements"]]
    esperado += [Polygon(e["polygon_m"]) for e in p["shared_spaces"] + p["cores"]]
    assert len(o["volumes"]) == len(esperado)
    for v, g in zip(o["volumes"], esperado):
        local = [((x - x0) * ux + (y - y0) * uy, (x - x0) * vx + (y - y0) * vy) for x, y in v["base_utm"]]
        ref = list(g.exterior.coords)[:-1]
        assert len(local) == len(ref) and max(Point(a).distance(Point(b)) for a, b in zip(local, ref)) < 0.001


def test_pavimentos_acima_do_envelope():
    rev = revisao()
    n = revisao_para_estudo(rev, P22421)["opcoes"][0]["metricas"]["pavimentos"]
    assert revisao_para_estudo(rev, P22421, pavimentos=n)["opcoes"][0]["metricas"]["pavimentos"] == n
    try:
        revisao_para_estudo(rev, P22421, pavimentos=n + 1)
    except ValueError as e:
        assert f"andar {n + 1}" in str(e) and ("envelope" in str(e) or "altura máxima" in str(e)), str(e)
    else:
        raise AssertionError("pavimentos acima do envelope devia dar erro")
    for ruim in (0, -1, 1.5):
        try:
            revisao_para_estudo(rev, P22421, pavimentos=ruim)
        except ValueError:
            continue
        raise AssertionError(f"pavimentos={ruim!r} devia dar erro")
    try:  # revisão de outro estudo
        revisao_para_estudo(rev, P22426)
    except ValueError as e:
        assert "outro estudo" in str(e)
    else:
        raise AssertionError("estudo trocado devia dar erro")


def test_passa_de_200_junta_por_andar():
    rev = revisao()
    rev["site"]["envelope_by_height"] = [{"z0_m": 0, "z1_m": 300, "polygon_m": [[-500, -500], [500, -500], [500, 500], [-500, 500]]}]
    o = revisao_para_estudo(rev, P22421, pavimentos=25)["opcoes"][0]
    assert len(o["volumes"]) <= 200 and any("juntos por andar" in a for a in o["alertas"])
    try:
        revisao_para_estudo(rev, P22421, pavimentos=40)  # 6 unidades × 40 já passa de 200
    except ValueError as e:
        assert "limite de 200" in str(e)
    else:
        raise AssertionError("mais de 200 volumes devia dar erro")


def test_original_intacto_e_deterministico():
    antes = P22421.read_bytes()
    d = carregar_json(antes)
    copia = copy.deepcopy(d)
    rev = revisao()
    a, b = serializar(revisao_para_estudo(rev, P22421)), serializar(revisao_para_estudo(rev, d))
    assert a == b == serializar(revisao_para_estudo(revisao(), P22421))
    assert P22421.read_bytes() == antes and d == copia


def test_passa_no_validar_do_index_html():
    html = INDEX.read_text(encoding="utf-8")
    ini, fim = html.index("    const finito"), html.index("    async function carregar")
    js = html[ini:fim] + "\nconst d = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));\nvalidar(d);\nconsole.log('validar ok', d.opcoes.length, d.opcoes[0].volumes.length);\n"
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        (t / "validar.cjs").write_text(js, encoding="utf-8")
        (t / "estudo.json").write_bytes(serializar(revisao_para_estudo(revisao(), P22421)))
        # prova de que o teste enxerga defeito: um volume sem altura finita tem de ser recusado pelo mesmo validar
        ruim = revisao_para_estudo(revisao(), P22421)
        ruim["opcoes"][0]["volumes"][0]["altura_m"] = None
        (t / "ruim.json").write_bytes(serializar(ruim))
        ok = subprocess.run(["node", str(t / "validar.cjs"), str(t / "estudo.json")], capture_output=True, text=True)
        assert ok.returncode == 0 and "validar ok 1" in ok.stdout, ok.stdout + ok.stderr
        nok = subprocess.run(["node", str(t / "validar.cjs"), str(t / "ruim.json")], capture_output=True, text=True)
        assert nok.returncode != 0 and "altura inválida" in nok.stderr, nok.stderr


def main():
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_") and callable(f):
            f()
            print("ok", nome)
    print("todos os testes da prévia passaram")


if __name__ == "__main__":
    main()
