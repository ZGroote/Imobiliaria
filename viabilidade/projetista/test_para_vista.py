"""Testes da prévia 3D (só assert). Rodar: python -I -X utf8 viabilidade/projetista/test_para_vista.py"""
import copy
import hashlib
import math
import re
import subprocess
import sys
import tempfile
from itertools import combinations
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.esquema import carregar_json
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.para_vista import PADROES_TERREO, revisao_para_estudo, serializar
from viabilidade.projetista.torre import _terreo
from viabilidade.projetista.validador import _posicionar

PILOTOS = RAIZ / "viabilidade" / "motor" / "exemplos" / "pilotos"
P22421, P22426 = PILOTOS / "SC-completo-22421.json", PILOTOS / "SC-completo-22426.json"
INDEX = RAIZ / "viabilidade" / "visual" / "index.html"
# sha256 da saída da tarefa 6 (22421, sem térreo, revisão rev_gerada_01 fdccaf794c32), com o piloto COMMITADO
# (sha abaixo). Piloto ou revisão mudou? Rode a para_vista.py do commit 91fa3ad6 na mesma entrada e regrave.
PILOTO_22421_SHA = "0589d1266844c33175ff77f0dec78d2c93435c0780fdbc51cd25bfeb5a30bee0"  # com fim de linha LF (o git no Windows pode entregar CRLF)
SHA_TAREFA_6 = "f90003d179b6448bc3f90de1261b56cbb7f155f4b3123c64102ce8839847a589"
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


def _validar_no_node(estudo, esperado_volumes):
    html = INDEX.read_text(encoding="utf-8")
    ini, fim = html.index("    const finito"), html.index("    async function carregar")
    js = html[ini:fim] + (
        "\nconst d = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));\n"
        "validar(d);\nconsole.log('validar ok', d.opcoes.length, d.opcoes[0].volumes.length);\n")
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        (t / "validar.cjs").write_text(js, encoding="utf-8")
        (t / "estudo.json").write_bytes(serializar(estudo))
        # prova de que o teste enxerga defeito: um volume sem altura finita tem de ser recusado pelo mesmo validar
        ruim = copy.deepcopy(estudo)
        ruim["opcoes"][0]["volumes"][0]["altura_m"] = None
        (t / "ruim.json").write_bytes(serializar(ruim))
        ok = subprocess.run(["node", str(t / "validar.cjs"), str(t / "estudo.json")], capture_output=True, text=True)
        assert ok.returncode == 0 and f"validar ok 1 {esperado_volumes}" in ok.stdout, ok.stdout + ok.stderr
        nok = subprocess.run(["node", str(t / "validar.cjs"), str(t / "ruim.json")], capture_output=True, text=True)
        assert nok.returncode != 0 and "altura inválida" in nok.stderr, nok.stderr


def test_passa_no_validar_do_index_html():
    est = revisao_para_estudo(revisao(), P22421)
    _validar_no_node(est, len(est["opcoes"][0]["volumes"]))


# ---- térreo e vagas (tarefa 8) ----

def _local(rev):
    fr = rev["site"]["local_frame"]
    (x0, y0), (ux, uy), (vx, vy) = fr["origem"], fr["u"], fr["v"]
    return lambda v: Polygon([((x - x0) * ux + (y - y0) * uy, (x - x0) * vx + (y - y0) * vy) for x, y in v["base_utm"]])


def test_terreo_cobre_a_laje():
    rev = revisao()
    placa = rev["floor_plates"][0]
    laje = Polygon(placa["outline_m"])
    # geometria exata (local, antes de arredondar): partição da laje, 1 mm² de tolerância
    nuc, hall, gar = _terreo(placa, [(e["id"], Polygon(e["polygon_m"])) for e in placa["cores"]], PADROES_TERREO)
    pecas = nuc + hall + gar
    assert nuc and hall and gar and all(not g.interiors for g in pecas)
    assert abs(sum(g.area for g in pecas) - laje.area) < 1e-6
    assert max(a.intersection(b).area for a, b in combinations(pecas, 2)) < 1e-6
    assert unary_union(pecas).symmetric_difference(laje).area < 1e-6
    # saída: núcleo do térreo na mesma projeção do núcleo dos andares; sem sobrepor; cobre a laje até o arredondamento (4 casas)
    o = revisao_para_estudo(rev, P22421, terreo=True)["opcoes"][0]
    loc = _local(rev)
    t = [(v["uso"], loc(v)) for v in o["volumes"] if v["z0_m"] == 0]
    assert {u for u, _ in t} == {"nucleo", "hall", "garagem"}
    assert all(v["altura_m"] == PADROES_TERREO["pe_direito_m"] for v in o["volumes"] if v["z0_m"] == 0)
    assert max(a.intersection(b).area for (_, a), (_, b) in combinations(t, 2)) < 1e-6
    assert unary_union([g for _, g in t]).symmetric_difference(laje).area < 0.01
    t_nuc = unary_union([g for u, g in t if u == "nucleo"])
    cima = [loc(v) for v in o["volumes"] if v["uso"] == "nucleo" and v["z0_m"] > 0]
    assert cima and all(t_nuc.buffer(0.001).covers(g) for g in cima)  # mesma projeção
    assert t_nuc.area - sum(g.area for g in cima) < 0.01  # só o vão de décimos de mm fechado
    # andares tipo em cima do térreo e dentro do lote
    z_tipo = sorted({v["z0_m"] for v in o["volumes"] if v["uso"] == "unidade"})
    assert z_tipo[0] == PADROES_TERREO["pe_direito_m"]
    lote = Polygon(carregar_json(P22421.read_bytes())["lote"]["poligono_utm"]).buffer(0.001)
    assert all(lote.covers(Polygon(v["base_utm"])) for v in o["volumes"])


def test_vagas():
    rev = revisao()
    o = revisao_para_estudo(rev, P22421, terreo=True)["opcoes"][0]
    m = o["metricas"]
    loc = _local(rev)
    a = sum(loc(v).area for v in o["volumes"] if v["uso"] == "garagem")
    assert type(m["vagas"]) is int and m["vagas"] == math.floor(m["area_garagem_m2"] / 25.0)
    assert abs(a - m["area_garagem_m2"]) < 0.01 and m["vagas"] == math.floor(a / 25.0)
    assert any("vagas por área bruta (premissa de 25 m² por vaga com circulação), não desenhadas nem conferidas pela lei" in x.lower() for x in o["alertas"])
    o2 = revisao_para_estudo(rev, P22421, terreo=True, premissas_terreo={"m2_por_vaga": 50.0})["opcoes"][0]
    assert o2["metricas"]["vagas"] == math.floor(m["area_garagem_m2"] / 50.0) and any("50 m²" in x for x in o2["alertas"])
    assert revisao_para_estudo(rev, P22421)["opcoes"][0]["metricas"]["vagas"] is None  # sem térreo, continua sem vagas


def test_sem_terreo_igual_a_tarefa_6():
    # o ouro foi gravado com o piloto em CRLF (como o git entrega no Windows); o disco pode estar em LF, então usa-se uma cópia CRLF
    lf = P22421.read_bytes().replace(b"\r\n", b"\n")
    assert hashlib.sha256(lf).hexdigest() == PILOTO_22421_SHA, "piloto 22421 diferente do commitado (cópia mexida?): SHA_TAREFA_6 não vale para ele"
    with tempfile.TemporaryDirectory() as d:
        piloto = Path(d) / P22421.name
        piloto.write_bytes(lf.replace(b"\n", b"\r\n"))
        e, site, regras = estudo_para_site(piloto)
        rev = gerar_pavimento(site, regras, {"unidades": 6}, None, e)["revisoes"][0]
        base = serializar(revisao_para_estudo(rev, piloto))
        assert base == serializar(revisao_para_estudo(rev, piloto, terreo=False))
    assert hashlib.sha256(base).hexdigest() == SHA_TAREFA_6


def test_terreo_envelope_e_contagem():
    rev = revisao()
    sem = revisao_para_estudo(rev, P22421)["opcoes"][0]["metricas"]["pavimentos"]
    com = revisao_para_estudo(rev, P22421, terreo=True)["opcoes"][0]["metricas"]["pavimentos"] - 1  # tira o térreo
    assert (sem, com) == (2, 1), (sem, com)  # 22421: o térreo ocupa a faixa de 0 a 3 m e leva um andar tipo
    assert revisao_para_estudo(rev, P22421, pavimentos=1, terreo=True)["opcoes"][0]["metricas"]["unidades_estimadas"] == 6
    try:
        revisao_para_estudo(rev, P22421, pavimentos=2, terreo=True)
    except ValueError as e:
        assert "andar 2" in str(e) and "envelope" in str(e), str(e)
    else:
        raise AssertionError("2 andares tipo + térreo passam do envelope e deviam dar erro")
    try:  # térreo mais alto que a caixa
        revisao_para_estudo(rev, P22421, terreo=True, premissas_terreo={"pe_direito_m": 20.0})
    except ValueError as e:
        assert "térreo não cabe" in str(e), str(e)
    else:
        raise AssertionError("térreo fora da caixa devia dar erro")
    a, b = (serializar(revisao_para_estudo(rev, P22421, terreo=True)) for _ in range(2))
    assert a == b


def test_passa_no_validar_com_terreo():
    est = revisao_para_estudo(revisao(), P22421, terreo=True)
    _validar_no_node(est, len(est["opcoes"][0]["volumes"]))


def main():
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_") and callable(f):
            f()
            print("ok", nome)
    print("todos os testes da prévia passaram")


if __name__ == "__main__":
    main()
