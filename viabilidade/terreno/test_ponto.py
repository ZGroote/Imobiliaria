"""Seleção por coordenada e contatos; integrado a novo_lote.py --testar."""
from contextlib import redirect_stdout
from io import StringIO
import json
import re
import time

from novo_lote import AQUI, Cadastro, gl, ler_ponto


def coordenada(ponto):
    lon, lat = gl.GEO.transform(ponto.x, ponto.y)
    return f"{lat:.12f}, {lon:.12f}"


def testar(cadastro, antigo, pilotos, pasta):
    from test_novo_lote import executar, recusa
    inicio = time.perf_counter()
    for indice in (30516, 37607, 22426, 22421, 25297):
        centro = gl.Polygon(pilotos[f"SC-completo-{indice}"]["poligono_utm"]).centroid
        assert cadastro.localizar(ler_ponto(coordenada(centro))) == indice
    ponto_antigo = coordenada(antigo.geos[542].centroid)
    assert antigo.localizar(ler_ponto(ponto_antigo)) == 542
    print("OK: coordenadas dos cinco centroides completos e do lote antigo/542 localizam os índices certos.", flush=True)

    # Casos geométricos controlados: interiores múltiplos, borda exata, contato e sobreposição.
    sintetico = object.__new__(Cadastro)
    sintetico.base = "completo"
    sintetico.geos = gl.np.array([gl.sh.box(*b) for b in ((0, 0, 10, 10), (10, 0, 20, 10),
                                                       (8, 8, 12, 12), (9, 9, 11, 11), (30, 0, 40, 10))], dtype=object)
    sintetico.tree = gl.sh.STRtree(sintetico.geos)
    assert sintetico.localizar(gl.Point(5, 5)) == 0
    recusa(lambda: sintetico.localizar(gl.Point(9.5, 9.5)), "contêm o ponto no interior: [0, 2, 3]")
    recusa(lambda: sintetico.localizar(gl.Point(0, 5)), "Nenhuma feição contém")
    # AUDITORIA-6 achado 11: a menos de 0,5 m de duas feições, recusa e lista as duas
    for p in (gl.Point(10, 5), gl.Point(9.6, 5), gl.Point(10.4, 5)):
        recusa(lambda: sintetico.localizar(p), "da divisa na base completo: índices [0, 1]")
    assert sintetico.localizar(gl.Point(9.4, 5)) == 0
    recusa(lambda: cadastro.localizar(ler_ponto("-21.963013, -47.886674")), "índices [900, 901]")
    recusa(lambda: cadastro.localizar(ler_ponto("-21.963013022579, -47.886674469625")), "índices [900, 901]")
    # achado 10: anel com miolo cadastrado e buraco vazio dão a mesma explicação no ponto, nos vizinhos e no gerar
    recusa(lambda: cadastro.gerar([14429], "auto"), "--indices 14429 14421")
    recusa(lambda: cadastro.localizar(ler_ponto("-21.99203689, -47.88204138")), "buraco interno da feição [55999]")
    captura = StringIO()
    with redirect_stdout(captura):
        cadastro.listar_vizinhos(14429)
    assert "--indices 14429 14421" in captura.getvalue(), captura.getvalue()
    recusa(lambda: cadastro.gerar([14421, 14429], "SC-Z2"), "sem frente para rua")  # a união fecha o buraco
    captura = StringIO()
    with redirect_stdout(captura):
        sintetico.listar_vizinhos(0)
    assert re.findall(r"índice (\d+); área ([\d.]+) m²", captura.getvalue()) == [("0", "100.000"), ("1", "100.000")]

    for texto, motivo in (("-22,0123, -47,8901", "vírgula decimal"),
                           ("-47.8901, -22.0123", "invertidas"),
                           ("-23.5505, -46.6333", "fora da área de São Carlos"),
                           ("nan, -47.8901", "Ponto inválido"), ("-22.0, inf", "Ponto inválido"),
                           ("-91, -47.89", "latitude entre"), ("-22.01 -47.89", "Ponto inválido")):
        recusa(lambda: ler_ponto(texto), motivo)
    assert ler_ponto(" -22.0123,-47.8901 ").equals(ler_ponto("-22.0123, -47.8901"))

    # Ponto realmente dentro do asfalto, mas fora de todos os lotes do cadastro.
    referencia = cadastro.geos[30516]
    ruas = cadastro.tree_ruas.query(referencia.buffer(100), predicate="intersects")
    rua = next(p for i in sorted(ruas) if not (p := cadastro.malha[i].representative_point()).is_empty
               and not len(cadastro.tree.query(p, predicate="intersects")))
    texto_rua = coordenada(rua)
    ponto = ler_ponto(texto_rua)
    distancias = gl.sh.distance(cadastro.geos, ponto)
    esperados = sorted(range(len(distancias)), key=lambda i: (distancias[i], i))[:3]
    try:
        cadastro.localizar(ponto)
    except ValueError as erro:
        encontrados = re.findall(r"índice (\d+): ([\d.]+) m", str(erro))
        assert [int(i) for i, _ in encontrados] == esperados, str(erro)
        assert all(abs(float(d)-distancias[int(i)]) <= .00051 for i, d in encontrados)
        assert "--indices" in str(erro)
    else:
        raise AssertionError("Rua escolhida automaticamente")

    script = AQUI / "novo_lote.py"
    saida = pasta / "ponto.json"
    texto = coordenada(cadastro.geos[30516].centroid)
    r = executar(script, "--base", "completo", "--ponto", texto, "--zona", "SC-Z4", "--saida", saida)
    assert r.returncode == 0, r.stderr
    assert json.loads(saida.read_text(encoding="utf-8")) == cadastro.gerar([30516], "SC-Z4")
    antes = saida.read_bytes()
    for base, cad, indice, local in (("completo", cadastro, 30516, texto), ("antigo", antigo, 542, ponto_antigo)):
        r = executar(script, "--base", base, "--ponto", local.replace(" ", ""), "--listar-vizinhos")
        assert r.returncode == 0, r.stderr
        vizinhos = [i for i, g in enumerate(cad.geos) if g.touches(cad.geos[indice])]
        linhas = re.findall(r"índice (\d+); área ([\d.]+) m²", r.stdout)
        assert [int(i) for i, _ in linhas] == [indice, *vizinhos], r.stdout
        assert all(abs(float(area)-cad.geos[int(i)].area) <= .00051 for i, area in linhas)
    for local, motivo in ((texto_rua, "As 3 mais próximas"), ("-23.5505, -46.6333", "fora da área de São Carlos"),
                           ("-47.8901,-22.0123", "invertidas"), ("-22,0123,-47,8901", "vírgula decimal")):
        r = executar(script, "--base", "completo", "--ponto", local, "--zona", "SC-Z4", "--saida", saida)
        assert r.returncode == 2 and motivo in r.stderr, r.stderr
        assert saida.read_bytes() == antes, "Recusa alterou o arquivo existente"
    for extras in (("--ponto", texto, "--indices", 30516), ("--indices", 30516, "--listar-vizinhos"),
                   ("--ponto", texto, "--listar-vizinhos", "--saida", saida)):
        r = executar(script, "--base", "completo", *extras)
        assert r.returncode == 2 and saida.read_bytes() == antes, r.stderr
    print(f"OK: rua {texto_rua} recusada, índices próximos {esperados}; distâncias UTM e áreas conferidas.", flush=True)
    print(f"OK: sobreposição/bordas, formato/inversão/fora da cidade, geração equivalente, CLI nas duas bases e recusas sem sobrescrever; {time.perf_counter()-inicio:.3f} s.", flush=True)
