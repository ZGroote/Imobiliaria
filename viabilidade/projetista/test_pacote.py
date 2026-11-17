"""python -I -B -X utf8 viabilidade/projetista/test_pacote.py"""
import contextlib
import copy
import functools
import io
import json
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from viabilidade.projetista.cargas import AVISO as AVISO_CARGAS, cargas_validas, estimar, selar_cargas
from viabilidade.projetista.editor import mover_divisa
from viabilidade.projetista.esquema import gravar, serializar
from viabilidade.projetista.pacote import main as cli, montar, pacote_valido, resumo, selar_pacote
from viabilidade.projetista.sintese import avaliacao_valida, avaliar, selar_avaliacao
from viabilidade.projetista.sondagem import ler_sondagem, selar_sondagem
from viabilidade.projetista.test_cargas import gerada

SONDAGEM = Path(__file__).with_name("exemplo-sondagem-ficticia.json")
PROIBIDAS = ("viável", "viavel", "aprovado", "capacidade", "fundação", "fundacao")


@functools.cache
def _pecas():
    rev = gerada()
    return rev, avaliar(rev), ler_sondagem(SONDAGEM), estimar(rev)


def pecas():
    return copy.deepcopy(_pecas())


def estados(p):
    return {k: v["estado"] for k, v in p["pecas"].items()}


def test_22421_quatro_validas():
    rev, av, s, c = pecas()
    p = montar(rev, av, s, c)
    assert estados(p) == dict.fromkeys(("revisao", "avaliacao", "sondagem", "cargas"), "valida"), p["pecas"]
    assert pacote_valido(p, rev, av, s, c) == (True, [])
    assert p["pecas"]["revisao"] == {"id": rev["revision_id"], "sha256": rev["content_sha256"], "estado": "valida", "motivo": ""}
    assert p["pecas"]["sondagem"]["id"] == s["investigation_id"]
    # Só referência: nada das peças dentro do pacote.
    assert len(serializar(p)) < 2000 and "floor_plates" not in json.dumps(p) and "sintese" not in json.dumps(p)
    assert serializar(montar(*pecas())) == serializar(p)
    r = resumo(p, rev, av, s, c)
    assert r["avaliacao"]["sintese"] == av["sintese"]["sintese"] and r["avaliacao"]["aviso"] == av["sintese"]["aviso"]
    assert r["cargas"]["aviso"] == AVISO_CARGAS and r["cargas"]["total_torre"] == c["total_torre"]
    assert r["sondagem"]["furos"] == 2 and r["sondagem"]["profundidade_max"] == {"valor": 6, "unidade": "m"}
    assert r["sondagem"]["nivel_agua"][1]["leituras"][0]["profundidade"] == "4,20 m"


def test_mover_divisa_invalida_avaliacao_e_cargas():
    rev, av, s, c = pecas()
    filha, _ = mover_divisa(rev, "apto_03", "apto_04", 0.5)
    p = montar(filha, av, s, c)
    assert estados(p) == {"revisao": "valida", "avaliacao": "invalida", "sondagem": "valida", "cargas": "invalida"}
    assert p["pecas"]["avaliacao"]["motivo"] == avaliacao_valida(av, filha)[1] == "outra revisão"
    assert p["pecas"]["cargas"]["motivo"] == cargas_validas(c, filha)[1]
    assert "geometria mudou" in p["pecas"]["cargas"]["motivo"]
    r = resumo(p, filha, av, s, c)
    assert r["avaliacao"] == "avaliação inválida: outra revisão" and "sintese" not in json.dumps(r["avaliacao"])
    assert r["cargas"].startswith("cargas inválida: geometria mudou")
    # Com as peças da filha, tudo volta a valer.
    assert set(estados(montar(filha, avaliar(filha), s, estimar(filha))).values()) == {"valida"}


def test_sondagem_de_outro_lote_e_ausente():
    rev, av, s, c = pecas()
    s["referencia"]["lote_id"] = "SC-completo-99999"
    p = montar(rev, av, selar_sondagem(s), c)
    assert p["pecas"]["sondagem"]["estado"] == "invalida"
    assert p["pecas"]["sondagem"]["motivo"] == "sondagem de outro lote: SC-completo-99999 ≠ SC-completo-22421"
    s["referencia"].update(lote_id="SC-completo-22421", study_id="outro-estudo")
    assert "outro estudo" in montar(rev, av, selar_sondagem(s), c)["pecas"]["sondagem"]["motivo"]
    rev, av, _, c = pecas()
    p = montar(rev, av, None, c)
    assert p["pecas"]["sondagem"] == {"id": None, "sha256": None, "estado": "ausente", "motivo": ""}
    assert pacote_valido(p, rev, av, None, c) == (True, [])
    assert resumo(p, rev, av, None, c)["sondagem"] == "sondagem ausente"


def test_adulterar_peca_depois_de_montar():
    rev, av, s, c = pecas()
    p = montar(rev, av, s, c)
    c2 = copy.deepcopy(c)
    c2["total_torre"]["max"] = 1.0  # sem selar de novo
    ok, m = pacote_valido(p, rev, av, s, c2)
    assert not ok and m == ["cargas mudou: era valida, agora invalida (selo)"], m
    av2 = copy.deepcopy(av)
    av2["sintese"]["sintese"] = "VERIFICADO_NO_ESCOPO_DECLARADO"
    ok, m = pacote_valido(p, rev, selar_avaliacao(av2), s, c)  # selada de novo: outra peça
    assert not ok and m == ["avaliacao mudou: não é a mesma peça do pacote"], m
    s2 = copy.deepcopy(s)
    s2["empresa"] = "Outra"
    ok, m = pacote_valido(p, rev, av, selar_sondagem(s2), c)
    assert not ok and m == ["sondagem mudou: não é a mesma peça do pacote"], m
    ok, m = pacote_valido(p, rev, av, None, c)
    assert not ok and m == ["sondagem mudou: não é a mesma peça do pacote"], m
    p2 = copy.deepcopy(p)
    p2["pecas"]["cargas"]["estado"] = "ausente"
    assert pacote_valido(p2, rev, av, s, c) == (False, ["selo do pacote"])
    assert not resumo(p, rev, av, s, c2)["pacote"]["valido"]


def test_resumo_sem_palavra_proibida():
    rev, av, s, c = pecas()
    filha, _ = mover_divisa(rev, "apto_03", "apto_04", 0.5)
    casos = [(rev, av, s, c), (rev, av, None, None), (filha, av, s, c), (rev, None, None, None)]
    for rv, a, so, ca in casos:
        texto = json.dumps(resumo(montar(rv, a, so, ca), rv, a, so, ca), ensure_ascii=False)
        texto = texto.replace(json.dumps(AVISO_CARGAS, ensure_ascii=False), "").lower()
        assert not [w for w in PROIBIDAS if w in texto], texto


def test_linha_de_comando():
    rev, av, s, c = pecas()
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        erro = io.StringIO()
        with contextlib.redirect_stderr(erro):
            try:
                cli([str(d)])
            except SystemExit as e:
                assert e.code == 2 and "nenhuma revisao-NN.json" in erro.getvalue()
            else:
                raise AssertionError("pasta vazia passou")
        filha, _ = mover_divisa(rev, "apto_03", "apto_04", 0.5)
        gravar(d/"revisao-01.json", filha)  # número menor: não é lido
        gravar(d/"revisao-02.json", rev)
        gravar(d/"avaliacao-02.json", av, selador=selar_avaliacao)
        gravar(d/"cargas-02.json", c, selador=selar_cargas)
        saidas = []
        for _ in range(2):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                assert cli([str(d), "--sondagem", str(SONDAGEM)]) == 0
            saidas.append((d/"pacote-02.json").read_bytes())
        assert saidas[0] == saidas[1] == serializar(selar_pacote(montar(rev, av, s, c)))
        assert "cargas valida" in out.getvalue() and not (d/"pacote-01.json").exists()


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram.")


if __name__ == "__main__":
    main()
