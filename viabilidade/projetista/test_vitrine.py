"""Testes da vitrine (só assert). Rodar: python -I -X utf8 viabilidade/projetista/test_vitrine.py"""
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Point, Polygon

from viabilidade.projetista import vitrine
from viabilidade.projetista.vitrine import gerar, graus_para_utm, para_wgs84, utm_para_graus

_cache = {}


def rodada():
    """Uma geração completa por processo de teste (leva ~1 min); devolve (pasta, índice por id)."""
    if "r" not in _cache:
        pasta = Path(tempfile.mkdtemp(prefix="vitrine-"))
        itens = gerar(pasta)
        _cache["r"] = (pasta, {i["lote_ref"]: i for i in itens}, itens)
    return _cache["r"]


def ler(caminho):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def test_indice_e_pastas():
    pasta, por_lote, itens = rodada()
    indice = ler(pasta / "indice.json")["terrenos"]
    assert [t["id"] for t in indice] == [f"terreno-{i}" for i in range(1, 8)] and len(itens) == 7
    for t in indice:
        assert t["status"] in ("ok", "falhou") and (t["motivo"] is None) == (t["status"] == "ok")
        assert t["nome"] == "Terreno " + t["id"].split("-")[1]  # neutro: só o número
        assert (pasta / t["id"]).is_dir() == (t["status"] == "ok")
    a = por_lote["SC-completo-22421"]
    assert a["status"] == "ok" and a["resumo"] == "terreno-1/resumo.json"
    r = ler(pasta / a["resumo"])
    assert r["numeros"]["unidades"]["valor"] == 16 and r["numeros_terreo"]["unidades"]["valor"] == 12
    for nome in (r["estudo"], r["estudo_terreo"]):  # caminhos relativos ao resumo
        assert (pasta / "terreno-1" / nome).is_file()
    assert a["volumes_wgs84"] and a["volumes_terreo_wgs84"]
    # o terreno 6 (garagem do térreo que se cruzava) sai ok; 2 e 3 não cabem e dizem por quê, em português simples
    s6 = por_lote["SC-completo-q1382-11984-11988"]
    assert s6["status"] == "ok" and s6["volumes_terreo_wgs84"] and s6["id"] == "terreno-6"
    for k in ("SC-completo-22426", "SC-completo-25297"):
        t = por_lote[k]
        assert t["status"] == "falhou" and " m²)" in t["motivo"] and "pavimento" in t["motivo"], t["motivo"]
        assert "geometria." not in t["motivo"] and t["lote_wgs84"] and t["resumo"] is None


def test_conversao_utm_wgs84():
    x, y = 200460.6998, 7562459.741
    # ponto de referência calculado com pyproj 3.7.2 (EPSG:31983 -> 4326), fora do `-I`
    lon, lat = utm_para_graus(x, y)
    assert abs(lon - -47.90137220098153) < 1e-9 and abs(lat - -22.01688105258661) < 1e-9
    # ida e volta com as 7 casas gravadas: erro <= 1 cm
    lon7, lat7 = para_wgs84(x, y)
    bx, by = graus_para_utm(lon7, lat7)
    assert math.hypot(bx - x, by - y) <= 0.01
    assert -22.2 < lat7 < -21.8 and -48.1 < lon7 < -47.7


def test_centro_dentro_e_tudo_em_sao_carlos():
    _, _, itens = rodada()
    for t in itens:
        assert t["centro"] is not None and t["lote_wgs84"] is not None  # até o que falhou tem lote no mapa
        assert Polygon(t["lote_wgs84"]).contains(Point(t["centro"])), t["id"]
        pontos = list(t["lote_wgs84"]) + [t["centro"]]
        for lista in (t["volumes_wgs84"], t["volumes_terreo_wgs84"]):
            for v in lista:
                assert v["uso"] and v["altura_m"] > 0 and v["z0_m"] >= 0
                pontos += v["base"]
        for lon, lat in pontos:
            assert -22.2 < lat < -21.8 and -48.1 < lon < -47.7, t["id"]
            assert lon == round(lon, 7) and lat == round(lat, 7)


def test_resumo_com_unidade_e_igual_a_torre():
    pasta, _, itens = rodada()
    for t in itens:
        if t["status"] != "ok":
            continue
        r = ler(pasta / t["resumo"])
        for chave, arq in (("numeros", r["estudo"]), ("numeros_terreo", r["estudo_terreo"])):
            n = r[chave]
            assert set(n) == {"andares", "unidades", "vagas", "area_privativa", "area_computavel", "area_lote", "limitante"}
            for k, medida in n.items():
                if k == "limitante" or (k == "vagas" and chave == "numeros"):
                    continue  # texto; e vagas sem térreo (null + nota) tem teste próprio
                assert set(medida) == {"valor", "unidade"} and medida["unidade"] and medida["valor"] is not None
            # os mesmos números que a prévia (que vem do metrics_summary.torre) mostra
            m = next(o for o in ler(pasta / t["id"] / arq)["opcoes"] if o["id"] == "projetista")["metricas"]
            assert n["unidades"]["valor"] == m["unidades_estimadas"] and n["andares"]["valor"] == m["pavimentos"]
            assert n["area_privativa"]["valor"] == m["area_privativa_m2"] and n["vagas"]["valor"] == ((m["vagas"] or 0) if chave == "numeros_terreo" else None)
        assert r["numeros"]["area_computavel"]["valor"] > r["numeros"]["area_privativa"]["valor"]
    r = ler(pasta / "terreno-1" / "resumo.json")
    assert r["numeros"]["area_computavel"] == {"valor": 1399.4215, "unidade": "m²"}
    assert r["numeros_terreo"]["area_computavel"] == {"valor": 1118.2742, "unidade": "m²"}


# números da tarefa 15 (17/11): (andares, unidades) sem térreo | (andares, unidades, vagas) com térreo. Antes: ver RELATORIO-15.md
HOJE = {"terreno-1": ((4, 16), (4, 12, 11)), "terreno-4": ((4, 24), (5, 24, 17)), "terreno-5": ((7, 42), (8, 42, 15)),
        "terreno-6": ((9, 72), (10, 72, 22)), "terreno-7": ((11, 66), (11, 60, 15))}


def test_limitante_vagas_e_numeros_de_hoje():
    pasta, _, itens = rodada()
    for t in itens:
        if t["status"] != "ok":
            continue
        r = ler(pasta / t["resumo"])
        for chave in ("numeros", "numeros_terreo"):
            lim = r[chave]["limitante"]
            assert set(lim) == {"andares", "unidades"}
            assert all(isinstance(x, str) and x.strip() for x in lim.values()), (t["id"], chave)
        assert r["numeros"]["vagas"] == {"valor": None, "unidade": "vagas", "nota": "estudo sem térreo: sem garagem"}
        assert set(r["numeros_terreo"]["vagas"]) == {"valor", "unidade"}  # com térreo: como antes
        (a, u), (at, ut, v) = HOJE[t["id"]]
        n, nt = r["numeros"], r["numeros_terreo"]
        assert (n["andares"]["valor"], n["unidades"]["valor"]) == (a, u), t["id"]
        assert (nt["andares"]["valor"], nt["unidades"]["valor"], nt["vagas"]["valor"]) == (at, ut, v), t["id"]
    assert set(HOJE) == {t["id"] for t in itens if t["status"] == "ok"}
    # o motivo vem do que a torre e o validador já sabiam
    assert "altura máxima" in ler(pasta / "terreno-1" / "resumo.json")["numeros"]["limitante"]["andares"]
    assert "até 8 unidades" in ler(pasta / "terreno-6" / "resumo.json")["numeros"]["limitante"]["unidades"]


def test_terreno_5_usa_o_lote_e_ninguem_passa_do_ca_maximo():
    """A laje deixou de ficar no canto (terreno 5: 2 andares antes) e a torre para no `ca_maximo`, dizendo isso."""
    pasta, por_lote, itens = rodada()
    assert ler(pasta / "terreno-5" / "resumo.json")["numeros"]["andares"]["valor"] > 2
    for t in itens:
        if t["status"] != "ok":
            continue
        motor = vitrine.estudo_para_site(vitrine.PILOTOS / f"{t['lote_ref']}.json")[2]["params"]["motor"]
        r = ler(pasta / t["resumo"])
        for chave in ("numeros", "numeros_terreo"):
            n = r[chave]
            ca = n["area_computavel"]["valor"] / n["area_lote"]["valor"]
            assert ca <= motor["ca_maximo"] + 1e-6, (t["id"], chave, ca, motor["ca_maximo"])
            texto = n["limitante"]["andares"]
            if ca > motor["ca_basico"] + 1e-6:  # entre o básico e o máximo: o validador chama de outorga onerosa; a tela também
                assert "outorga onerosa" in texto, (t["id"], chave)
        # onde o CA máximo foi o que parou o prédio, o limitante diz "CA máximo"
        assert ("CA máximo" in r["numeros"]["limitante"]["andares"]) == (t["id"] in ("terreno-4", "terreno-5", "terreno-6", "terreno-7"))


def test_piloto_quebrado_nao_derruba_os_outros():
    tmp = Path(tempfile.mkdtemp(prefix="vitrine-pilotos-"))
    boa = vitrine.PILOTOS / "SC-completo-22421.json"
    shutil.copy(boa, tmp / "SC-completo-22421.json")
    (tmp / "quebrado.json").write_text('{"lote": {"id": "x"}}', encoding="utf-8")
    (tmp / "zz-lixo.json").write_text("isto nem é JSON", encoding="utf-8")
    saida = tmp / "saida"
    itens = {i["lote_ref"]: i for i in gerar(saida, tmp)}
    assert itens["SC-completo-22421"]["status"] == "ok"
    for k in ("quebrado", "zz-lixo"):
        assert itens[k]["status"] == "falhou" and itens[k]["motivo"] and itens[k]["resumo"] is None
        assert itens[k]["volumes_wgs84"] == [] and not (saida / itens[k]["id"]).exists()
    assert (saida / "indice.json").is_file()


def test_mesmos_bytes_em_duas_rodadas():
    pasta, _, _ = rodada()
    outra = Path(tempfile.mkdtemp(prefix="vitrine-2-"))
    gerar(outra)
    a = sorted(p.relative_to(pasta) for p in pasta.rglob("*") if p.is_file())
    assert a == sorted(p.relative_to(outra) for p in outra.rglob("*") if p.is_file())
    for rel in a:
        assert (pasta / rel).read_bytes() == (outra / rel).read_bytes(), rel
    assert not list(pasta.rglob(".vitrine-*"))  # nenhum temporário esquecido


def test_suites_anteriores():
    for t in ("test_projetista.py", "test_gerador.py", "test_editor.py", "test_torre.py", "test_para_vista.py"):
        r = subprocess.run([sys.executable, "-I", "-X", "utf8", str(Path(__file__).with_name(t))],
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 0, t + "\n" + r.stdout[-800:] + r.stderr[-800:]


def main():
    for nome, f in sorted(globals().items()):
        if nome.startswith("test_") and callable(f):
            f()
            print("ok", nome)
    print("todos os testes da vitrine passaram")


if __name__ == "__main__":
    main()
