"""python -I -B -X utf8 viabilidade/projetista/test_sondagem.py"""
import copy
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from viabilidade.projetista.esquema import gravar, serializar
from viabilidade.projetista.sondagem import conferir, erros, ler_sondagem, n_spt, perfil, selar_sondagem

EXEMPLO = Path(__file__).with_name("exemplo-sondagem-ficticia.json")
LOTE_22421 = [[200460.699762, 7562459.741016], [200475.964685, 7562458.776279],
              [200477.784673, 7562415.852336], [200462.509148, 7562417.067135]]


def cad():
    return ler_sondagem(EXEMPLO)


def test_exemplo_sela_e_rele():
    c = cad()
    assert c["ficticio"] is True and "FICTÍCIO" in c["aviso"] and len(c["furos"]) == 2
    assert serializar(selar_sondagem(c)) == EXEMPLO.read_bytes()
    with tempfile.TemporaryDirectory() as d:
        copia = Path(d)/"s.json"
        gravar(copia, c, selador=selar_sondagem)
        assert copia.read_bytes() == EXEMPLO.read_bytes() and ler_sondagem(copia) == c
    for f in c["furos"]:
        for s in f["spt"]:
            g = [x["golpes"] for x in s["segmentos"]]
            assert n_spt(s) == (g[1] + g[2] if len(g) == 3 else None)
    p = perfil(c)
    assert p["SP-01"][0]["n_spt"] == 6 and p["SP-02"][-1] == {"profundidade_m": 5.0, "n_spt": None, "penetracao_incompleta": True}
    # Penetração incompleta: guardada crua e marcada, sem erro.
    assert [x["nivel"] for x in conferir(c, LOTE_22421)] == ["aviso"] and not erros(c)
    assert c["furos"][1]["spt"][-1]["segmentos"] == [{"golpes": 30, "penetracao_cm": 15}, {"golpes": 25, "penetracao_cm": 10}]


def _erro(mexer, trecho):
    c = cad()
    mexer(c)
    e = erros(c)
    assert e and any(trecho in x["motivo"] for x in e), (trecho, e)
    try:
        selar_sondagem(c)
    except ValueError:
        return
    raise AssertionError(f"Selou com erro: {trecho}")


def test_erros():
    def camadas(c, *pares):
        c["furos"][0]["camadas"] = [{"topo_m": t, "base_m": b, "descricao": "x", "classificacao": "y"} for t, b in pares]
    _erro(lambda c: camadas(c, (0.0, 3.0), (2.5, 6.0)), "sobreposta")
    _erro(lambda c: camadas(c, (0.0, 2.0), (2.5, 6.0)), "Buraco entre 2.0 e 2.5")
    _erro(lambda c: camadas(c, (0.0, 2.0), (2.0, 5.0)), "Buraco: camadas param em 5.0")
    _erro(lambda c: camadas(c, (0.0, 2.0), (2.0, 7.0)), "passa da profundidade final")
    _erro(lambda c: c["furos"][0]["spt"].__setitem__(0, {"profundidade_m": 1.0, "n_spt": 7}), "N sem segmentos")
    _erro(lambda c: c["furos"][0]["spt"][0].__setitem__("n_spt", 7), "derivado dos segmentos")
    _erro(lambda c: c["profissional"].__setitem__("registro", " "), "sem registro")
    _erro(lambda c: c["profissional"].pop("conselho"), "sem conselho")
    _erro(lambda c: c["furos"][1]["spt"][0]["segmentos"][0].__setitem__("golpes", -1), "negativo")
    _erro(lambda c: c["furos"][1]["spt"][0]["segmentos"][0].__setitem__("penetracao_cm", -15), "negativo")
    _erro(lambda c: c["furos"][1].update(cota_boca_motivo=None), "Cota da boca nula sem motivo")


def test_fora_do_lote_e_aviso():
    c = cad()
    c["furos"][0]["posicao_utm"] = [200440.0, 7562430.0]  # ~21 m a oeste da divisa
    out = conferir(c, LOTE_22421)
    fora = [x for x in out if "fora do lote" in x["motivo"]]
    assert len(fora) == 1 and fora[0]["nivel"] == "aviso" and fora[0]["elemento"] == "SP-01"
    assert not erros(c, LOTE_22421)
    selar_sondagem(c)  # aviso não impede selar
    assert not [x for x in conferir(cad(), LOTE_22421) if "fora do lote" in x["motivo"]]


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram.")


if __name__ == "__main__":
    main()
