"""python -I -B -X utf8 viabilidade/projetista/test_fluxo.py

Testa forma e ligações (ids, shas, estados), não o rótulo da síntese: as regras do validador ainda mudam.
"""
import contextlib
import copy
import io
import json
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Polygon
from shapely.ops import unary_union

from viabilidade.projetista import fluxo
from viabilidade.projetista.cargas import LAJE, PILHA_AUSENTE, PREMISSAS_PADRAO, estimar
from viabilidade.projetista.esquema import ler
from viabilidade.projetista.pacote import montar, pacote_valido
from viabilidade.projetista.sintese import avaliar
from viabilidade.projetista.sondagem import ler_sondagem, referencia, selar_sondagem
from viabilidade.projetista.torre import compor
from viabilidade.projetista.test_cargas import gerada

P22421 = RAIZ/"viabilidade/motor/exemplos/pilotos/SC-completo-22421.json"
SONDAGEM = Path(__file__).with_name("exemplo-sondagem-ficticia.json")
ARQUIVOS = ["avaliacao-02.json", "cargas-02.json", "pacote-02.json", "revisao-01.json", "revisao-02.json"]
G_LAJE = next(p["valor"] for p in PREMISSAS_PADRAO if p["id"] == LAJE)


def rodar(pasta, *extra):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = fluxo.main([str(P22421), str(pasta), "--sondagem", str(SONDAGEM), *extra])
    return code, out.getvalue() + err.getvalue()


def ler_json(p):
    return json.loads(p.read_bytes())


def test_fluxo_22421_com_e_sem_terreo():
    with tempfile.TemporaryDirectory() as d:
        for extra in ([], ["--terreo"]):
            pastas = [Path(d)/f"{'t' if extra else 's'}{i}" for i in (1, 2)]
            for pasta in pastas:
                code, texto = rodar(pasta, *extra)
                assert code == 0, texto
                assert sorted(x.name for x in pasta.iterdir()) == ARQUIVOS
            a, b = pastas
            assert all((a/n).read_bytes() == (b/n).read_bytes() for n in ARQUIVOS)
            pav, torre = ler(a/"revisao-01.json"), ler(a/"revisao-02.json")
            av, c, p = (ler_json(a/n) for n in ("avaliacao-02.json", "cargas-02.json", "pacote-02.json"))
            assert torre["parent_revision_id"] == pav["revision_id"] and len(torre["floor_plates"]) >= 2
            assert ("terreo" in [f["id"] for f in torre["floor_plates"]]) == bool(extra)
            assert av["revision_id"] == c["revision_id"] == p["revision_id"] == torre["revision_id"]
            assert av["revision_sha256"] == c["revision_sha256"] == torre["content_sha256"]
            assert {k: v["estado"] for k, v in p["pecas"].items()} == dict.fromkeys(p["pecas"], "valida")
            assert p["pecas"]["sondagem"]["id"] == av["evidencias"]["sondagem"]["investigation_id"]
            assert pacote_valido(p, torre, av, ler_sondagem(SONDAGEM), c) == (True, [])
            assert "pacote da torre: revisao valida" in texto


def test_cargas_da_torre():
    for terreo in (False, True):
        c = estimar(compor(gerada(), terreo=terreo))
        pavs = c["pavimentos"]
        assert len(pavs) >= 2 and PILHA_AUSENTE not in c["avisos"] and not c["avisos"]
        assert [p["z0"]["valor"] for p in pavs] == sorted((p["z0"]["valor"] for p in pavs), reverse=True)
        for k in ("min", "central", "max"):
            acc = [p["acumulado_do_topo"][k] for p in pavs]
            assert all(x < y for x, y in zip(acc, acc[1:])), acc
            assert abs(c["total_torre"][k] - sum(p["total"][k] for p in pavs)) <= 0.01 and abs(acc[-1] - c["total_torre"][k]) <= 0.01
        if terreo:  # o térreo usa garagem e hall
            base = pavs[-1]
            assert base["id"] == "terreo" and {"q.garagem", "q.hall"} <= {x["premissa"] for x in base["parcelas"]}


def test_desconto_do_vao():
    torre = compor(gerada())
    sem_vao = copy.deepcopy(torre)  # mesma torre sem elevador e shaft: o g volta a cobrir o contorno inteiro
    for f in sem_vao["floor_plates"]:
        f["cores"] = [e for e in f["cores"] if e["kind"] not in ("elevador", "shaft")]
    c, c0 = estimar(torre), estimar(sem_vao)
    for f, pav, pav0 in zip(sorted(torre["floor_plates"], key=lambda f: -f["z0_m"]), c["pavimentos"], c0["pavimentos"]):
        laje = Polygon(f["outline_m"])
        vao = unary_union([Polygon(e["polygon_m"]) for e in f["cores"] if e["kind"] in ("elevador", "shaft")]).intersection(laje).area
        assert vao > 0 and pav["id"] == pav0["id"] == f["id"]
        for k in ("min", "central", "max"):
            assert abs((pav0["g"][k] - pav["g"][k]) - vao * G_LAJE[k]) <= 0.01, (k, pav0["g"][k], pav["g"][k])
            cheio = sum(p["valor"][k] for p in PREMISSAS_PADRAO if p["tipo"] == "g") * laje.area
            assert abs(pav0["g"][k] - cheio) <= 0.01
        assert pav["q"] == pav0["q"]  # o vão não tinha q: o q não muda
        lp = next(p for p in pav["parcelas"] if p["premissa"] == LAJE)
        assert lp["vao_descontado"]["element_ids"] and abs(lp["vao_descontado"]["valor"] - vao) <= 1e-4
        print(f"   {f['id']}: vão {vao:.2f} m², g central {pav0['g']['central']:.1f} → {pav['g']['central']:.1f} kN")


def test_avaliacao_cita_outra_sondagem():
    torre = compor(gerada())
    s = ler_sondagem(SONDAGEM)
    outra = copy.deepcopy(s)
    outra["empresa"] = "Outra Sondagens (fictícia)"
    outra = selar_sondagem(outra)
    c = estimar(torre)
    av = avaliar(torre, evidencias={"sondagem": referencia(outra)}, sondagem=outra)
    p = montar(torre, av, s, c)
    assert p["pecas"]["avaliacao"]["estado"] == "invalida" and p["pecas"]["sondagem"]["estado"] == "valida"
    assert p["pecas"]["avaliacao"]["motivo"].startswith("avaliação cita outra sondagem: sond_ficticia_01"), p["pecas"]["avaliacao"]
    m = montar(torre, av, None, c)["pecas"]["avaliacao"]
    assert m["estado"] == "invalida" and "ausente no pacote" in m["motivo"]
    certa = avaliar(torre, evidencias={"sondagem": referencia(s)}, sondagem=s)
    assert montar(torre, certa, s, c)["pecas"]["avaliacao"]["estado"] == "valida"
    assert montar(torre, avaliar(torre), s, c)["pecas"]["avaliacao"]["estado"] == "valida"  # não cita: nada a conferir


def test_etapa_que_falha_nao_deixa_arquivo():
    original = fluxo.estimar
    with tempfile.TemporaryDirectory() as d:
        try:
            fluxo.estimar = lambda r: (_ for _ in ()).throw(ValueError("teste"))
            code, texto = rodar(Path(d)/"a")
        finally:
            fluxo.estimar = original
        assert code == 1 and "falhou na etapa cargas: teste" in texto and not (Path(d)/"a").exists()
        code, texto = rodar(Path(d)/"b", "--sondagem", str(Path(d)/"nao-existe.json"))
        assert code == 1 and "etapa sondagem" in texto and not (Path(d)/"b").exists()
        # Conflito no último arquivo: nada novo fica na pasta.
        c = Path(d)/"c"
        c.mkdir()
        (c/"pacote-02.json").write_bytes(b"{}")
        code, texto = rodar(c)
        assert code == 1 and "etapa gravação" in texto and [x.name for x in c.iterdir()] == ["pacote-02.json"]
        # Falha no meio da gravação: o que esta rodada gravou é apagado.
        original_gravar = fluxo.gravar
        chamadas = []
        def gravar_falha(caminho, dado, selador):
            chamadas.append(caminho.name)
            if len(chamadas) == 3:
                raise OSError("disco cheio (teste)")
            return original_gravar(caminho, dado, selador=selador)
        try:
            fluxo.gravar = gravar_falha
            code, texto = rodar(Path(d)/"e")
        finally:
            fluxo.gravar = original_gravar
        assert code == 1 and "disco cheio" in texto and not list((Path(d)/"e").iterdir())


def main():
    testes = [(nome, fn) for nome, fn in globals().items() if nome.startswith("test_") and callable(fn)]
    for nome, fn in testes:
        fn()
        print("OK", nome)
    print(f"{len(testes)} testes passaram.")


if __name__ == "__main__":
    main()
