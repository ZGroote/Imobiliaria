"""Autoteste chamado por novo_lote.py --testar; só escreve em diretório temporário."""
import gzip
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
from novo_lote import AQUI, BASES, Cadastro, desnivel_lote_rua, gl, relevo, unir
from testar_pilotos import comparar_json  # float com tolerância 1e-6: a última casa muda entre Windows e Linux

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
        comparar_json(original["frente"], novo["frente"], f"piloto {indice}", "frente")
        for k, v in original["relevo"].items():
            if isinstance(v, (float, int)):
                assert math.isclose(novo["relevo"][k], v, rel_tol=0, abs_tol=1e-6), (indice, k)
            else:
                assert novo["relevo"][k] == v
        for k in set(novo) - DIFERENCAS_ESPERADAS - {"poligono_utm", "area_m2", "relevo"}:
            comparar_json(original[k], novo[k], f"piloto {indice}", k)
        assert novo["zona_origem"] == "informada_pelo_usuario" and not novo["zona_conferida"]
        assert novo["fonte"]["indices_feicoes_zero_based"] == [indice]
        assert relevo.AVISO in novo["observacoes"]
        comparar_json(original["qualidade"]["frentes"], novo["qualidade"]["frentes"], f"piloto {indice}", "qualidade.frentes")
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
    # lado da rua picotado: as duas primeiras arestas (desvio ~2°) viram um lado só; a quina de 90° separa
    assert [ks for ks, _ in gl.cadeias([(0, 0), (5, 0), (10, 0.2), (10, 10), (0, 10), (0, 0)])] == [[0, 1], [2], [3], [4]]
    for i, regra in ((94130, "arestas_colineares"), (23249, "tolerancia_asfalto_12m")):  # REVISAO-6
        lote = cadastro.gerar([i], "SC-Z1")
        assert lote["qualidade"]["frentes"][0]["regra"] == regra, (i, lote["qualidade"]["frentes"][0])
        assert ("AVISO: frente presumida" in lote["observacoes"]) == (regra != "arestas_colineares")
    print("OK: frente ampliada: 94130 junta arestas colineares; 23249 aceita asfalto a 10 m com aviso.", flush=True)

    def fileiras(vao, ampliar=True, laco=False):  # regra 3 sintética: 2 fileiras de lotes 12x30 com `vao` m entre elas; asfalto só na ponta
        geos = gl.np.array([caixa(12 * k, y, 12 * k + 12, y + 30) for y in (0, 30 + vao) for k in range(10)])
        if laco:  # o lote em frente vira anel que cruza a si mesmo (como o 77317 do cadastro, vizinho do 77356)
            y = 30 + vao
            geos[14] = gl.Polygon([(48, y), (60, y), (60, y + 30), (48, y + 30), (48, y + 15), (62, y + 17), (62, y + 15), (48, y + 17)])
        malha = gl.np.array([gl.Polygon([(125, 30), (135, 30), (130, 30 + max(vao, 5))])])
        return gl.avaliar(geos[4], 4, geos, gl.sh.STRtree(geos), malha, gl.sh.STRtree(malha), ampliar=ampliar)
    q = fileiras(15)
    assert [(f["regra"], f["pontos"], f["largura_vao_m"]) for f in q["frentes"]] == [("borda_de_quadra", [[60.0, 30.0], [48.0, 30.0]], 15.0)], q
    assert fileiras(15, ampliar=False) is None  # pilotos: sem ampliar a regra 3 não roda
    assert fileiras(15, laco=True)["frentes"] == q["frentes"]  # vizinho inválido: era TopologyException (AUDITORIA-7)
    assert fileiras(5) is None and fileiras(0) is None  # viela de 5 m; fundo com fundo (e nada atrás da fileira)
    # 10 lotes do raio de 300 m do centro e da amostra REVISAO-6, conferidos no desenho: a borda dá para a rua
    for i, arestas in {92058: [0], 46087: [0, 1], 62350: [1, 2], 91412: [2, 3], 102159: [0], 104833: [4, 5],
                       77017: [5, 0], 75926: [0], 73863: [0], 77039: [5, 6]}.items():
        lote = cadastro.gerar([i], "SC-Z1")
        assert [(f["regra"], f["arestas"]) for f in lote["qualidade"]["frentes"]] == [("borda_de_quadra", arestas)], (i, lote["qualidade"])
        assert "frente presumida pela borda da quadra (sem asfalto no mapa)" in lote["observacoes"]
    lote = cadastro.gerar([77033], "SC-Z1")  # esquina: as duas ruas sem asfalto no meio da quadra
    assert [f["arestas"] for f in lote["qualidade"]["frentes"]] == [[3], [1, 2]] and lote["qualidade"]["esquina_indicada_pela_malha"]
    assert "Esquina indicada" in lote["observacoes"]
    # em L (AUDITORIA-7): o lado comprido dá para o miolo da quadra; a principal é a sul, que encosta no asfalto do cruzamento
    assert [f["arestas"] for f in cadastro.gerar([75931], "SC-Z1")["qualidade"]["frentes"]] == [[9, 0], [3, 4]]
    assert [f["arestas"] for f in cadastro.gerar([77356], "SC-Z1")["qualidade"]["frentes"]] == [[1, 2]]  # vizinho 77317 inválido
    recusa(lambda: cadastro.gerar([76495], "SC-Z1"), "nem pela borda da quadra")  # lote solto no miolo vazio da quadra
    recusa(lambda: cadastro.gerar([76495], "SC-Z1"), "somando 8 m); o asfalto mais próximo da malha está a 26.6 m")

    def com_osm(geos, alvo, vias, fim):  # vias = [(id, nome, classe, [pontos UTM])]; o asfalto fica só em `fim`, longe do lote
        malha = gl.np.array([gl.Polygon([(fim[0] - 5, fim[1]), (fim[0] + 5, fim[1]), (fim[0], fim[1] - 10)])])
        with TemporaryDirectory() as pasta:
            arq = Path(pasta) / "osm.json.gz"
            arq.write_bytes(gzip.compress(json.dumps({"data_osm": "2026-08-28T20:20:46Z", "vias": [
                {"id": k, "nome": nome, "highway": classe, "coords": [gl.GEO.transform(*p) for p in pts]} for k, nome, classe, pts in vias]}).encode()))
            osm = gl.vias_osm(arq, gl.sh.STRtree(malha))
        return gl.avaliar(geos[alvo], alvo, geos, gl.sh.STRtree(geos), malha, gl.sh.STRtree(malha), ampliar=True, osm=osm)
    x0, y0 = 202000, 7564000  # São Carlos, para a ida e volta lon/lat do arquivo

    def rua_osm(classe="residential", giro=0, solta=False, dist=5, largura=12):  # regra 4 sintética: 1 fileira largura x 30, via a `dist` m da frente
        geos = gl.np.array([caixa(x0 + largura * k, y0, x0 + largura * k + largura, y0 + 30) for k in range(10)])
        def eixo(x):  # reta pelo meio da frente do lote 4, girada `giro` graus
            return (x0 + x, y0 - dist + (x - 4.5 * largura) * math.tan(math.radians(giro)))
        return com_osm(geos, 4, [(7, "Rua Teste", classe, [eixo(-10), eixo(110 if solta else 140)])], eixo(140))
    f = rua_osm()["frentes"]
    assert [(x["regra"], x["pontos"], x["via_osm"]["id"], x["via_osm"]["classe"]) for x in f] == [
        ("rua_osm", [[202048.0, 7564000.0], [202060.0, 7564000.0]], 7, "residential")], f  # o lado sul, voltado para a via
    assert abs(f[0]["distancia_eixo_osm_m"] - 5) < 0.01 and f[0]["angulo_via_graus"] < 0.1 and f[0]["distancia_max_asfalto_m"] > 60, f
    assert rua_osm(giro=15)["frentes"][0]["regra"] == "rua_osm"
    assert rua_osm("service") is None and rua_osm("track") is None and rua_osm("unclassified") is None
    assert rua_osm(giro=30) is None  # perto e torta: não é a rua do lado
    assert rua_osm(solta=True) is None  # trecho que não chega à malha nem a outra via aceita
    print("OK: regra 4 (rua do OSM): via residencial a 5 m aceita; service/track/unclassified, 30° e trecho solto recusados.", flush=True)
    # T27 (C): avenida (primary/secondary) aceita o eixo a até 11 m; rua local continua em 8 m
    assert rua_osm("primary", dist=10.5)["frentes"][0]["regra"] == "rua_osm" and rua_osm("secondary", dist=10.5)
    assert rua_osm(dist=10.5) is None and rua_osm("primary", dist=11.5) is None
    # T27 (A): lote estreito de 5,5 m com rua do OSM na frente passa; largura média 5,5 (área / profundidade)
    f = rua_osm(largura=5.5)["frentes"][0]
    assert (f["frente_curta"], f["comprimento_m"], f["largura_media_m"]) == ("estreita", 5.5, 5.5), f
    assert rua_osm(largura=4.5) is None  # abaixo dos 5 m da Lei 6.766
    def bandeira(c):  # lote de fundo: corpo 20x20 atrás, corredor de `c` m até a rua, vizinho na frente e dos dois lados
        lote = gl.Polygon([(x0, y0), (x0 + c, y0), (x0 + c, y0 + 20), (x0 + 20, y0 + 20), (x0 + 20, y0 + 40), (x0, y0 + 40)])
        vizinhos = [caixa(x0 + c, y0, x0 + 20, y0 + 20), caixa(x0 - 12, y0, x0, y0 + 40), caixa(x0 + 20, y0, x0 + 32, y0 + 40)]
        via = [(7, "Rua Teste", "residential", [(x0 - 60, y0 - 5), (x0 + 140, y0 - 5)])]
        q = com_osm(gl.np.array([lote] + vizinhos), 0, via, (x0 + 140, y0 - 5))
        return q and q["frentes"][0]["comprimento_m"]
    # largura média = área / profundidade na perpendicular à frente: 6 m dá 520/40 = 13, metade 6,5 > 6; 5 m dá 12,5, metade 6,25
    assert bandeira(5) is None and bandeira(6) is None  # limite da trava: corredor de 7 m (metade de 13,5 = 6,75) já passaria
    gl.LARGURA_FRACAO = 0  # sem a trava o corredor de 6 m passaria: é ela que recusa. O de 5 m continua fora pelo "encostar"
    try:                   # (a margem de 10% do lado dá 0,5 m e o vizinho da quina fica a 0,5 m)
        assert bandeira(6) == 6 and bandeira(5) is None
    finally:
        gl.LARGURA_FRACAO = 0.5
    # T27 (B): esquina 5,5x5,5 com uma rua em cada lado: cada lado vale 5,5 m sozinho, os dois não somam 11
    esquina = [caixa(x0, y0, x0 + 5.5, y0 + 5.5), caixa(x0 + 5.5, y0, x0 + 17, y0 + 30), caixa(x0, y0 + 5.5, x0 + 5.5, y0 + 30)]
    vias = [(7, "Rua A", "residential", [(x0 - 5, y0 - 5), (x0 + 140, y0 - 5)]),
            (8, "Rua B", "residential", [(x0 - 5, y0 - 5), (x0 - 5, y0 + 140)])]
    f = com_osm(gl.np.array(esquina), 0, vias, (x0 + 140, y0 - 5))["frentes"]
    assert [(x["comprimento_m"], x["frente_curta"], x["pedacos_m"]) for x in f] == [(5.5, "estreita", [5.5])] * 2, f
    # T28: 3,5 + 3,5 m com recorte de 4,5 m no meio (fundo do recorte a 9 m do eixo, fora da regra): a reta daria 11,5 m
    # de testada para 7 m de lado na rua. Não junta, e cada pedaço sozinho fica abaixo dos 5 m
    recorte = gl.Polygon([(x0, y0), (x0 + 3.5, y0), (x0 + 3.5, y0 + 4), (x0 + 8, y0 + 4), (x0 + 8, y0), (x0 + 11.5, y0),
                          (x0 + 11.5, y0 + 30), (x0, y0 + 30)])
    via = [(7, "Rua Teste", "residential", [(x0 - 60, y0 - 5), (x0 + 140, y0 - 5)])]
    assert com_osm(gl.np.array([recorte]), 0, via, (x0 + 140, y0 - 5)) is None
    gl.JUNTAR_FOLGA_M = 99  # sem a trava da T28 juntaria numa estreita de 7 m com reta de 11,5 m: é ela que recusa
    try:
        f = com_osm(gl.np.array([recorte]), 0, via, (x0 + 140, y0 - 5))["frentes"][0]
        assert (f["frente_curta"], f["pedacos_m"], math.dist(*f["pontos"])) == ("estreita", [3.5, 3.5], 11.5), f
    finally:
        gl.JUNTAR_FOLGA_M = 1
    # reais (T26): 2986 junta 2,97 + 6,81 na mesma frente; 22356 passante fica com 7,5 m por rua, sem somar as duas
    f = cadastro.gerar([2986], "SC-Z2")["qualidade"]["frentes"][0]
    assert f["frente_curta"] == "juntada" and len(f["pedacos_m"]) == 2 and f["comprimento_m"] >= 8, f
    lote = cadastro.gerar([22356], "SC-Z2")
    assert [(x["frente_curta"], round(x["comprimento_m"], 1)) for x in lote["qualidade"]["frentes"]] == [("estreita", 7.5)] * 2
    assert "AVISO: frente estreita de 7.504 m" in lote["observacoes"]
    print("OK: T27: avenida a 10,5 m aceita e rua local recusada; lote de 5,5 m aceito e de 4,5 recusado; bandeiras de 5 e 6 m "
          "recusadas (a de 6 m pela trava); esquina 5,5+5,5 não soma; T28: 3,5+3,5 com vão de 4,5 não junta; 2986 juntado; 22356 7,5 m por rua.", flush=True)
    # desnível lote - rua (T22): raster sintético = plano subindo 0,1 m por metro para o norte, rua 2 a 10 m ao sul da frente
    x0, y0, topo = 202000, 7564000, 7564300
    plano = gl.np.array([[500 + 0.1 * (topo - 30 * (j + 0.5) - y0)] * 20 for j in range(20)])
    def altura(x, y):
        return relevo.bilinear(plano, (x - (x0 - 300)) / 30 - 0.5, (topo - y) / 30 - 0.5)
    lote, frente = caixa(x0, y0, x0 + 12, y0 + 30), [(x0, y0), (x0 + 12, y0)]
    rua = gl.np.array([caixa(x0 - 40, y0 - 10, x0 + 52, y0 - 2)])
    d = desnivel_lote_rua(lote, frente, altura, rua, gl.sh.STRtree(rua))
    assert d == 2.1, d  # centroide em y0+15, mediana da rua em y0-6: 21 m x 0,1
    assert desnivel_lote_rua(lote, frente, lambda x, y: 700 - altura(x, y), rua, gl.sh.STRtree(rua)) == -2.1
    longe = gl.np.array([caixa(x0 - 40, y0 - 60, x0 + 52, y0 - 50)])  # asfalto além dos 25 m: não grava
    assert desnivel_lote_rua(lote, frente, altura, longe, gl.sh.STRtree(longe)) is None
    plano[9:11, 9:11] = -9999  # pixel sem dado sob o lote: não grava
    assert desnivel_lote_rua(lote, frente, altura, rua, gl.sh.STRtree(rua)) is None
    l = cadastro.gerar([77022], "SC-Z2")["relevo"]
    assert l["desnivel_lote_rua_m"] == 5.2 and "DSM" in l["metodo_desnivel"], l  # T26: +5,2 m no DSM
    print("OK: desnível lote-rua: raster sintético +2,1/-2,1, asfalto longe e pixel sem dado sem campo, 77022 +5,2.", flush=True)
    print("OK: regra 3 (borda da quadra): corredor aceito, viela e fundo recusados, 10 lotes reais, esquina 77033, miolo 76495, em L 75931, vizinho inválido.", flush=True)
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
        from test_cache import testar as testar_cache
        testar_cache(cadastro, pilotos, pasta)
    assert protegidos() == antes, "Fontes, dados, pilotos ou scripts preexistentes foram alterados"
    print("OK: --testar completo; fontes e arquivos protegidos inalterados, saídas temporárias removidas.", flush=True)


if __name__ == "__main__":
    testar()
