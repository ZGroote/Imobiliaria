"""Teste da varredura (tarefa 20): piloto no raio igual ao estudar.py, limite de 500 lotes, erro simulado num lote."""
import csv
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import estudar  # noqa: E402
import novo_lote  # noqa: E402
import varrer  # noqa: E402


def le(pasta):
    with open(pasta / "varredura.csv", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main():
    cad = novo_lote.Cadastro("completo")
    g = cad.geos[30516].centroid
    lon, lat = novo_lote.gl.GEO.transform(g.x, g.y)
    ponto = f"{lat:.6f}, {lon:.6f}"
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        # (a) raio pequeno em torno do piloto: ele aparece, e o estudo é byte a byte o do estudar.py
        linhas = varrer.varrer("completo", ponto, 40, t / "a", cadastro=cad)
        assert 1 < len(linhas) < 40, len(linhas)
        l = next(x for x in linhas if x["indice"] == 30516)
        assert l["status"] == "estudo" and int(l["n_opcoes"]) > 0, l
        estudar.estudar("completo", [30516], "auto", t / "solo", cadastro=cad)
        for nome in ("estudo.json", "lote.json"):
            assert (t / "a/lotes/30516" / nome).read_bytes() == (t / "solo" / nome).read_bytes(), nome
        assert l["revisao"] and l["zona"].startswith("SC-") and l["estudo_json"] == "lotes/30516/estudo.json", l
        csv_ = le(t / "a")
        assert [x["indice"] for x in csv_] == [str(x["indice"]) for x in linhas] and len(csv_) == len(linhas)
        # ordem: estudos pela maior área computável (decrescente), recusas e erros no fim
        est = [x for x in linhas if x["status"] == "estudo"]
        assert linhas[:len(est)] == est and [x["maior_area_computavel_m2"] for x in est] == sorted((x["maior_area_computavel_m2"] for x in est), reverse=True)
        resumo = (t / "a" / "RESUMO.md").read_text(encoding="utf-8")
        assert varrer.AVISO in resumo and "## Os 10 melhores" in resumo and f"lotes/{est[0]['indice']}/estudo.json" in resumo
        # --min-m2 filtra pela área do cadastro
        grandes = varrer.lotes_do_raio(cad, novo_lote.ler_ponto(ponto), 40, 400)
        assert grandes and all(cad.geos[i].area >= 400 for i in grandes) and len(grandes) < len(linhas)
        # pasta cheia é recusada
        try:
            varrer.varrer("completo", ponto, 40, t / "a", cadastro=cad)
        except ValueError as e:
            assert "não está vazia" in str(e)
        else:
            raise AssertionError("pasta cheia devia recusar")

        # (b) raio com mais de 500 lotes: erro claro, nada gravado
        try:
            varrer.varrer("completo", "-22.01725, -47.8908", 1000, t / "b", cadastro=cad)
        except ValueError as e:
            assert "limite é 500" in str(e) and not (t / "b").exists(), e
        else:
            raise AssertionError("mais de 500 lotes devia dar erro")

        # (c) um lote que lança exceção: a varredura termina e registra; os outros seguem
        def quebra(base, indices, *a, **k):
            if indices == [30516]:
                raise RuntimeError("falha simulada")
            return estudar.estudar(base, indices, *a, **k)
        linhas = varrer.varrer("completo", ponto, 40, t / "c", cadastro=cad, estudar_fn=quebra)
        l = next(x for x in linhas if x["indice"] == 30516)
        assert l["status"] == "erro" and "RuntimeError: falha simulada" in l["motivo"], l
        assert any(x["status"] == "estudo" for x in linhas) and linhas[-1]["status"] != "estudo"  # o resto estudou; erro/recusa no fim
        assert next(x for x in le(t / "c") if x["indice"] == "30516")["status"] == "erro"
        assert "1 × erro" in (t / "c" / "RESUMO.md").read_text(encoding="utf-8")

        # (d) T29: lote na divisa (90050) vira uma linha "divisa", sem quebrar a varredura
        g = cad.geos[90050].centroid
        lon, lat = novo_lote.gl.GEO.transform(g.x, g.y)
        linhas = varrer.varrer("completo", f"{lat:.6f}, {lon:.6f}", 15, t / "d", cadastro=cad)
        l = next(x for x in linhas if x["indice"] == 90050)
        assert l["status"] == "divisa" and l["zona"] == "divisa: SC-Z4 | SC-Z3" and l["estudo_json"] == "lotes/90050/resumo.txt", l
        assert (t / "d" / l["estudo_json"]).exists() and "2 × divisa" in (t / "d" / "RESUMO.md").read_text(encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
