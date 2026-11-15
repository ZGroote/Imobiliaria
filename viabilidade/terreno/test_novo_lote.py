"""Autoteste chamado por novo_lote.py --testar; só escreve em diretório temporário."""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from novo_lote import AQUI, BASES, Cadastro, gl, relevo, unir

# Campos manuais omitidos; os demais precisam reproduzir os cinco pilotos.
OMITIDOS = {"lid", "categoria", "centroide_lonlat",
            "distancia_centro_referencia_m", "anotacao_zoneamento"}
DIFERENCAS_ESPERADAS = {"zona_origem", "observacoes", "fonte", "qualidade", "areas_especiais"}


def recusa(funcao, trecho):
    try:
        funcao()
    except ValueError as erro:
        assert trecho in str(erro), str(erro)
        return
    raise AssertionError(f"Recusa esperada: {trecho}")


def protegidos():
    arquivos = [AQUI / "lotes-piloto.json", *(gl.ROOT / p for p in BASES.values()),
                gl.ROOT / "sao-carlos/dados/street_tris.json"]
    arquivos += [p for p in (AQUI / "dados").rglob("*") if p.is_file()]
    arquivos += [p for p in AQUI.glob("*.py") if p.name not in ("novo_lote.py", "test_novo_lote.py")]
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in arquivos}


def executar(script, *args):
    return subprocess.run([sys.executable, "-I", "-B", "-X", "utf8", str(script), *map(str, args)],
                          cwd=gl.ROOT, capture_output=True, text=True, encoding="utf-8")


def testar():
    from sugerir_zona import mapa_local
    mapa_local()  # provisiona o insumo ausente antes de fotografar os arquivos protegidos
    antes = protegidos()
    inicio = time.perf_counter()
    cadastro = Cadastro("completo")
    print(f"Carga da base completa + ruas + raster: {time.perf_counter() - inicio:.3f} s", flush=True)
    pilotos = {p["id"]: p for p in gl.ler("viabilidade/terreno/lotes-piloto.json")}
    for indice in (30516, 37607, 22426, 22421, 25297):
        original = pilotos[f"SC-completo-{indice}"]
        novo = cadastro.gerar([indice], original["zona_id"])
        assert set(novo) == set(original) - OMITIDOS
        gl.np.testing.assert_allclose(novo["poligono_utm"], original["poligono_utm"], rtol=0, atol=1e-6)
        assert math.isclose(novo["area_m2"], original["area_m2"], rel_tol=0, abs_tol=1e-6)
        assert novo["frente"] == original["frente"]
        for k, v in original["relevo"].items():
            if isinstance(v, (float, int)):
                assert math.isclose(novo["relevo"][k], v, rel_tol=0, abs_tol=1e-6), (indice, k)
            else:
                assert novo["relevo"][k] == v
        for k in set(novo) - DIFERENCAS_ESPERADAS - {"poligono_utm", "area_m2", "relevo"}:
            assert novo[k] == original[k], (indice, k)
        assert novo["zona_origem"] == "informada_pelo_usuario" and not novo["zona_conferida"]
        assert novo["fonte"]["indices_feicoes_zero_based"] == [indice]
        assert relevo.AVISO in novo["observacoes"]
        assert novo["qualidade"]["frentes"] == original["qualidade"]["frentes"]
        if novo["qualidade"]["esquina_indicada_pela_malha"]:
            assert "Esquina indicada" in novo["observacoes"]
        if len(novo["qualidade"]["frentes"]) > 1:
            assert "mais de uma frente" in novo["observacoes"]
    print("OK: cinco pilotos reproduzidos; diferenças manuais listadas em OMITIDOS/DIFERENCAS_ESPERADAS.", flush=True)
    original = pilotos["SC-completo-q1382-11984-11988"]
    assert original["fonte"]["arquivo"] == BASES["completo"]
    rem = cadastro.gerar(list(range(11988, 11983, -1)), original["zona_id"])
    assert rem["id"] == "SC-completo-11984-11985-11986-11987-11988"
    assert math.isclose(rem["area_m2"], original["area_m2"], rel_tol=0, abs_tol=1e-6)
    print(f"OK: remembramento q1382, área {rem['area_m2']:.3f} m².", flush=True)
    for ids, zona, motivo in (([len(cadastro.geos)], "SC-Z1", "Índice inexistente"),
                              ([-1], "SC-Z1", "Índice inexistente"),
                              ([19], "ZONA-INEXISTENTE", "Zonas válidas:"),
                              ([30516, 37607], "SC-Z1", "não se tocam"),
                              ([19, 19], "SC-Z1", "Índices repetidos"),
                              ([0], "SC-Z1", "sem frente para rua"),
                              ([104], "SC-Z1", "se sobrepõe ao vizinho"),
                              ([295], "SC-Z1", "invade o asfalto")):
        recusa(lambda: cadastro.gerar(ids, zona), motivo)
    caixa = gl.sh.box
    recusa(lambda: unir([caixa(0, 0, 10, 10), caixa(10, 10, 20, 20)]), "um polígono só")
    recusa(lambda: unir([caixa(0, 0, 10, 10), caixa(5, 0, 15, 10)]), "se sobrepõem")
    recusa(lambda: unir([caixa(0, 0, 10, 2), caixa(0, 8, 10, 10), caixa(0, 2, 2, 8), caixa(8, 2, 10, 8)]), "sem buracos")
    recusa(lambda: unir([gl.Polygon([(0, 0), (10, 10), (0, 10), (10, 0)])]), "polígono válido")
    print("OK: recusas reais completo/0 (sem frente), /104 (vizinho), /295 (asfalto), índices/zona e uniões inválidas.", flush=True)
    cadastro_antigo = Cadastro("antigo")
    antigo = cadastro_antigo.gerar([542], "SC-Z1")
    assert antigo["id"] == "SC-antigo-542" and antigo["crs"] == "EPSG:31983" and antigo["relevo"]
    print("OK: base antiga, índice 542.", flush=True)
    with TemporaryDirectory(prefix="novo-lote-teste-") as pasta:
        pasta = Path(pasta)
        script = AQUI / "novo_lote.py"
        for i, (ids, zona, motivo) in enumerate((([len(cadastro.geos)], "SC-Z1", "Índice inexistente"),
                                                ([19], "ZONA-INEXISTENTE", "Zonas válidas:"),
                                                ([30516, 37607], "SC-Z1", "não se tocam"),
                                                ([0], "SC-Z1", "sem frente para rua"))):
            saida = pasta / f"recusado-{i}.json"
            resultado = executar(script, "--base", "completo", "--indices", *ids, "--zona", zona, "--saida", saida)
            assert resultado.returncode == 2 and motivo in resultado.stderr, resultado.stderr
            assert not saida.exists(), "Recusa deixou arquivo parcialmente montado"
        saida = pasta / "lote.json"
        saida.write_text("preservar", encoding="utf-8")
        resultado = executar(script, "--base", "completo", "--indices", 19, "--zona", "invalida", "--saida", saida)
        assert resultado.returncode == 2 and saida.read_text(encoding="utf-8") == "preservar"
        inicio = time.perf_counter()
        resultado = executar(script, "--base", "completo", "--indices", 19, "--zona", "SC-Z1", "--saida", saida)
        segundos = time.perf_counter() - inicio
        assert resultado.returncode == 0, resultado.stderr
        lote = json.loads(saida.read_text(encoding="utf-8"))
        assert lote["id"] not in pilotos and lote == cadastro.gerar([19], "SC-Z1")
        print(f"Tempo CLI de um lote (completo/19, processo novo, sem cache da aplicação): {segundos:.3f} s", flush=True)
        estudo = pasta / "estudo.json"
        resultado = executar(AQUI.parent / "motor/gerar.py", "--lote", saida, "--zona", AQUI.parent / "lei/zonas.json",
                             "--zona-id", "SC-Z1", "--saida", estudo)
        assert resultado.returncode == 0, resultado.stderr
        e = json.loads(estudo.read_text(encoding="utf-8"))
        assert e["opcoes"] or e["opcoes_ausentes"]
        assert all(o["motivo"] not in ("erro", "dados_insuficientes") for o in e["opcoes_ausentes"])
        print(f"OK: CLI do motor para completo/19: {len(e['opcoes'])} opções, {len(e['opcoes_ausentes'])} ausentes.", flush=True)
        from test_sugerir_zona import testar as testar_auto
        testar_auto(cadastro, pilotos, pasta)
        from test_areas_especiais import testar as testar_especiais
        testar_especiais(cadastro, pilotos, pasta)
        from test_ponto import testar as testar_ponto
        testar_ponto(cadastro, cadastro_antigo, pilotos, pasta)
    assert protegidos() == antes, "Fontes, dados, pilotos ou scripts preexistentes foram alterados"
    print("OK: --testar completo; fontes e arquivos protegidos inalterados, saídas temporárias removidas.", flush=True)


if __name__ == "__main__":
    testar()
