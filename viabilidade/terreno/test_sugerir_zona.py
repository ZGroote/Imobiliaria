"""Regressões da leitura de cores e ensaios reais; integrado a novo_lote.py --testar."""
import json
import time
from PIL import Image

from novo_lote import AQUI, gl
from sugerir_zona import MapaZonas, ZonaIncerta, recuperar_tracos


def testar_tracos():
    # Empates conferidos contra scipy.ndimage.distance_transform_edt (1.18.1): menor coluna, depois menor linha.
    for vizinhos, esperado in ((((2, 0), (2, 4), (0, 2), (4, 2)), 1), (((1, 3), (3, 3), (3, 1), (1, 1)), 4),
                               (((1, 3), (3, 1)), 2), (((2, 5),), 1), (((4, 5),), 0)):
        classes = gl.np.zeros((5, 7), int)
        for c, yx in enumerate(vizinhos, 1):
            classes[yx] = c
        recuperada, leitura = recuperar_tracos(classes)
        assert leitura[2, 2] == esperado and recuperada[2, 2] == (esperado > 0), (vizinhos, leitura[2, 2])
    assert not recuperar_tracos(gl.np.zeros((2, 1), int))[0].any()  # recorte menor que 3 px não dá a volta


def testar_cores(mapa):
    original = mapa.imagem

    class Raster:
        modo = "uniforme"

        def crop(self, caixa):
            x0, y0, x1, y1 = caixa
            rgb = gl.np.empty((y1-y0, x1-x0, 3), dtype="uint8")
            rgb[:] = mapa.paleta[0]
            if self.modo == "divisa":
                rgb[:, max(0, 4500-x0):] = mapa.paleta[1]
            elif self.modo == "desconhecida":
                rgb[:] = (255, 0, 255)
            elif self.modo == "campus":
                rgb[:] = mapa.paleta[6]
            elif self.modo == "eixo":
                rgb[:, 4500-x0:4503-x0] = mapa.cor_eixo
            elif self.modo == "eixo_fino":  # borda/texto de 2 px na cor do Eixo (AUDITORIA-6, idx 100)
                rgb[:, 4500-x0:4502-x0] = mapa.cor_eixo
            elif self.modo == "represa":
                rgb[:] = mapa.paleta[9]
            elif self.modo == "ambigua":  # meio do caminho entre Z3 e Represa
                rgb[:] = (mapa.paleta[2] + mapa.paleta[9]) / 2
            elif self.modo == "divisa_branco":  # T23: cor não zonal do lado não vira candidata
                rgb[:, :max(0, 4500-x0)] = (255, 255, 255)
            elif self.modo == "linha_z5b":  # T23: borda anti-aliased de traço cinza cai no Z5B; fina demais para candidata
                rgb[:, 4500-x0:4502-x0] = mapa.paleta[5]
            elif self.modo == "linha_parque":  # T25: borda da linha de rua sobre Z2 cai na cor do Pq. Ecológico
                rgb[:, 4500-x0:4502-x0] = mapa.paleta[7]
            elif self.modo == "divisa_parque":  # T25: parque de verdade é mancha grande e continua divisa
                rgb[:, :max(0, 4500-x0)] = mapa.paleta[7]
            elif self.modo == "texto_fino":
                rgb[:, 4530-x0:4532-x0] = (0, 0, 0)
            return Image.fromarray(rgb)

    raster = Raster()
    mapa.imagem = raster

    def lote(x0, x1):
        return gl.Polygon(mapa.utm([(x0, 6000), (x1, 6000), (x1, 6030), (x0, 6030)]))

    def recusar(pol, motivo):
        try:
            mapa.sugerir(pol)
        except ZonaIncerta as erro:
            assert motivo in str(erro), str(erro)
            assert "--zona SC-XX" in str(erro)
            return erro.sugestao
        raise AssertionError("Era necessário recusar")

    try:
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z1" and len(s["pontos"]) > 3
        assert s["proporcao_por_zona"] == {"SC-Z1": 1}
        raster.modo = "divisa"
        # O centro está em Z2, mas uma faixa da ponta está em Z1.
        s = recusar(lote(4498, 4530), "mais de uma zona")
        assert {"SC-Z1", "SC-Z2"} <= set(s["alternativas"]) and not s["so_divisa"]
        s = recusar(lote(4506, 4520), "menos de 10 m")
        assert s["distancia_divisa_m"] < 10
        assert s["so_divisa"] and s["candidatas"] == ["SC-Z2", "SC-Z1"], s["candidatas"]  # T23: a do polígono primeiro
        raster.modo = "divisa_branco"  # T23: cor não zonal continua divisa; sobra uma candidata só
        s = recusar(lote(4506, 4520), "menos de 10 m")
        assert not s["so_divisa"] and s["candidatas"] == [], s["candidatas"]
        raster.modo = "linha_z5b"  # T24: borda de 2 px na cor do Z5B colada ao lote não é divisa
        z, s = mapa.sugerir(lote(4503, 4520))
        assert z == "SC-Z1" and s["distancia_divisa_m"] is None, s["distancia_divisa_m"]
        assert s["alternativas"] == [], s["alternativas"]  # T25: pixel solto de Z5B também sai das alternativas
        raster.modo = "linha_parque"  # T25: borda de 2 px na cor do parque colada ao lote não é divisa
        z, s = mapa.sugerir(lote(4503, 4520))
        assert z == "SC-Z1" and s["distancia_divisa_m"] is None, s["distancia_divisa_m"]
        raster.modo = "divisa_parque"
        s = recusar(lote(4506, 4520), "menos de 10 m")
        assert not s["so_divisa"] and s["candidatas"] == [], s["candidatas"]
        raster.modo = "divisa"
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z2" and s["distancia_divisa_m"] >= 10
        for modo in ("desconhecida", "campus"):
            raster.modo = modo
            recusar(lote(4520, 4540), "Cor sem correspondência")
        raster.modo = "eixo"  # AUDITORIA-6 achado 1: Eixo a <=60 m recusa, com fundo + Eixo nas alternativas
        s = recusar(lote(4520, 4540), "Traço de Eixo a até 60 m")
        assert s["alternativas"] == ["SC-Z1", "SC-EIXO"], s["alternativas"]
        _, s = mapa.sugerir(lote(4560, 4580))
        assert "SC-EIXO" not in s["alternativas"]
        raster.modo = "eixo_fino"
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z1" and "SC-EIXO" not in s["alternativas"]
        for modo in ("represa", "ambigua"):  # achados 5/6: Represa não vira Z3; cor ambígua não decide
            raster.modo = modo
            assert not recusar(lote(4520, 4540), "Cor sem correspondência")["so_divisa"]
        raster.modo = "uniforme"
        recusar(gl.Polygon(mapa.utm([(4000, 6000), (4800, 6000), (4800, 6800), (4000, 6800)])), "Lote grande demais")
        raster.modo = "texto_fino"
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z1" and any(p["cor_recuperada"] for p in s["pontos"])
        recusar(lote(100, 120), "Fora do quadro")
        recusar(gl.Polygon(mapa.utm([(500, 10300), (550, 10300), (550, 10350), (500, 10350)])), "Fora do quadro")
    finally:
        mapa.imagem = original
    print("OK: cores desconhecidas/campus, traços, lote multizona, divisa de 10 m e Eixo a 60 m recusa, linha fina de Z5B/parque não é divisa nem alternativa, parque grande e branco recusam, borda fina não é Eixo, Represa e cor ambígua recusam, lote grande demais.", flush=True)


# Tarefa 17: 8 cruzamentos de rua fora do ajuste (UTM 31983 do cadastro/malha; pixel = centro do cruzamento
# no anexo, conferido em recorte). Com a afim antiga (5 vértices, SAD69 "ballpark") erravam 45-101 m.
VERIFICACAO = [
    ("Rua Ricardo de Assis Pereira x Rua Sylvio Bento Piovesa", (197676.56, 7565617.48),
     {"02": (2217.69, 3161.55), "05": (2775.9, 5537.85), "06": (2184.72, 3294.84), "07": (4760.67, 7905.46)}),
    ("Via de Acesso 2 x Via de Acesso D", (200865.86, 7567604.12),
     {"02": (4496.27, 1791.94), "05": (3811.71, 4915.26), "06": (4462.41, 1925.78), "07": (5330.39, 7562.99)}),
    ("Rua El Salvador x Rua Paraguai", (203188.47, 7564467.34),
     {"02": (6096.77, 4053.88), "05": (4539.3, 5943.39), "06": (6062.39, 4186.93), "07": (5730.53, 8128.7)}),
    ("Avenida Luciano E. Félix x Rua Doutor Paulo Botassi", (205795.54, 7562438.53),
     {"02": (7915.73, 5531.14), "05": (5366.06, 6615.18), "06": (7881.06, 5664.13), "07": (6185.16, 8497.73)}),
    ("Rua Jerônimo da Costa Terra x Rua Joaquim Gonçalves Ledo", (199463.39, 7560226.91),
     {"02": (3408.05, 7018.48), "05": (3317.09, 7291.12), "06": (3374.56, 7150.68), "07": (5058.32, 8869.8)}),
    ("Rua Nuncio Cardinalli x Rua Santa Isabel", (202481.01, 7560344.87),
     {"02": (5542.54, 6976.26), "05": (4287.32, 7271.89), "06": (5508.11, 7108.32), "07": (5591.98, 8859.27)}),
    ("Rua João Paulo x Rua Orestes Mastro Francisco", (200940.77, 7557639.14),
     {"02": (4420.06, 8878.82), "05": (3777.16, 8136.83), "06": (4386.33, 9010.32), "07": (5311.18, 9334.87)}),
    ("Rua Totó Leite x Rua Treze de Maio", (202682.21, 7562313.12),
     {"02": (5712.63, 5578.51), "05": (4364.59, 6636.46), "06": (5678.5, 5711.16), "07": (5634.47, 8509.92)}),
]


def testar_verificacao(mapas):
    pior = {}
    for anexo, mapa in mapas.items():
        escala = gl.np.sqrt(abs(gl.np.linalg.det(mapa.coef[:2])))
        for nome, utm, pixels in VERIFICACAO:
            erro = float(gl.np.linalg.norm(mapa.pixel(gl.np.array([utm]))[0] - pixels[anexo]) / escala)
            assert erro <= 10, (anexo, nome, round(erro, 1))
            pior[anexo] = max(pior.get(anexo, 0), erro)
    print("OK: 8 cruzamentos de verificação a até 10 m em cada anexo (pior: "
          + ", ".join(f"{a} {e:.1f} m" for a, e in pior.items()) + ").", flush=True)


def testar_candidatas(cadastro):
    """T23: só a divisa em dúvida vira candidatas; gerar(..., "auto:SC-XX") aceita só uma delas."""
    from test_novo_lote import recusa
    # 90050 (sorteio da T21): Z4, com o Z3 do outro lado da Rua Irineu Rios, a 1,38 m (distância conservadora)
    try:
        cadastro.mapa_zonas.sugerir(cadastro.geos[90050])
        raise AssertionError("90050 deveria ficar na divisa")
    except ZonaIncerta as erro:
        s = erro.sugestao
        assert s["so_divisa"] and s["candidatas"] == ["SC-Z4", "SC-Z3"] and s["distancia_divisa_m"] < 10, s["candidatas"]
        assert "auto:SC-Z3" in str(erro)
    lote = cadastro.gerar([90050], "auto:SC-Z3")
    assert lote["zona_id"] == "SC-Z3" and lote["zona_origem"] == "candidata_na_divisa" and not lote["zona_conferida"]
    assert lote["zona_sugestao"]["candidatas"] == ["SC-Z4", "SC-Z3"] and lote["zona_sugestao"]["distancia_divisa_m"] < 10
    assert "confirmar a zona na Prefeitura" in lote["observacoes"] and "informada pelo usuário" not in lote["observacoes"]
    recusa(lambda: cadastro.gerar([90050], "auto:SC-Z1"), "Zona SC-Z1 fora das candidatas na divisa (SC-Z4, SC-Z3)")
    recusa(lambda: cadastro.gerar([90050], "auto:SC-Z9"), "Zona inexistente: 'SC-Z9'")
    # T25: 75352-75354 era "só a divisa" por pixel solto de parque na borda da rua; agora o mapa aceita Z2.
    recusa(lambda: cadastro.gerar([75352, 75353, 75354], "auto:SC-Z2"), "não tem dúvida de zona")
    # Só a divisa, mas o outro lado é campus (68491, vizinho do 68495), não zona: uma candidata só, continua recusa
    recusa(lambda: cadastro.gerar([68491], "auto:SC-Z1"), "fora das candidatas na divisa (nenhuma:")  # 68495 não tem frente
    recusa(lambda: cadastro.gerar([19], "auto:SC-Z3"), "não tem dúvida de zona")  # aceito pelo mapa
    # T25: parque/campus de verdade é mancha grande e continua divisa. 68495: Z1 colado ao campus;
    # 40015: Z3 colado a um parque (Anexo 02, conferidos no recorte).
    for i, zona in ((68495, "SC-Z1"), (40015, "SC-Z3")):
        try:
            cadastro.mapa_zonas.sugerir(cadastro.geos[i])
            raise AssertionError(f"{i} deveria recusar pela divisa")
        except ZonaIncerta as erro:
            s = erro.sugestao
            assert s["motivo_duvida"].startswith("Divisa/") and s["distancia_divisa_m"] == 0, s["motivo_duvida"]
            assert s["alternativas"] == [zona] and not s["so_divisa"], (i, s["alternativas"])
    from novo_lote import validar_zona
    recusa(lambda: validar_zona("auto:SC-Z2"), "Zona inexistente")  # sem permitir_auto, como antes
    print("OK: candidatas na divisa (90050 Z4/Z3), auto:SC-XX grava candidata_na_divisa, fora da lista dá erro; parque (40015) e campus (68495) grandes continuam divisa.", flush=True)


def testar(cadastro, pilotos, pasta):
    from test_novo_lote import executar
    inicio = time.perf_counter()
    testar_tracos()
    cadastro.mapa_zonas = MapaZonas()
    testar_cores(cadastro.mapa_zonas)
    # T25: 75352-75354 recusava por pixel solto de parque na borda da Av. Carlos Botelho (9,23 m); agora concorda com Z2.
    esperadas = {"30516": "SC-Z4", "37607": "SC-Z4", "25297": "SC-Z1", "75352-75354": "SC-Z2"}
    from test_novo_lote import recusa
    for original in pilotos.values():
        fonte = original["fonte"]
        ids = fonte.get("indices_feicoes_zero_based", [fonte.get("indice_feicao_zero_based")])
        try:
            zona, s = cadastro.mapa_zonas.sugerir(gl.Polygon(original["poligono_utm"]))
            lote = cadastro.gerar(ids, "auto")
            assert lote["zona_id"] == zona
            assert lote["zona_origem"] == "sugerida_pelo_mapa" and not lote["zona_conferida"]
            assert zona == next(z for fim, z in esperadas.items() if original["id"].endswith(fim))
            assert s["pontos"] and abs(sum(s["proporcao_por_zona"].values())-1) < 1e-10
            comparacao = "concorda" if zona == original["zona_id"] else "sugere outra"
            resultado = f"{comparacao}: {zona}"
            if ids == [75352, 75353, 75354]:  # T21: o vizinho inválido 75351 é consertado com make_valid (área igual)
                assert [v["indice"] for v in lote["qualidade"]["vizinhos_consertados"]] == [75351], lote["qualidade"]
                resultado += " (vizinho inválido 75351 consertado na conferência)"
        except ZonaIncerta as erro:
            s = erro.sugestao
            resultado = f"recusa por dúvida: {s['motivo_duvida']}; alternativas={s['alternativas']}"
            assert any(original["id"].endswith(fim) for fim in ("22426", "22421", "11984-11988")), str(erro)
            assert "SC-EIXO" in s["alternativas"]
            if original["id"].endswith("22421"):  # tarefa 17: o lote fica na quadra, a ~13 m da divisa; Z2 era a posição antiga
                assert s["alternativas"] == ["SC-Z1", "SC-EIXO"] and s["distancia_divisa_m"] >= 10, s
            recusa(lambda: cadastro.gerar(ids, "auto"), "Zona automática recusada")
        print(f"AUTO {original['id']}: manual={original['zona_id']}; {resultado}", flush=True)
    for i, zona in ((19, "SC-Z3"), (25298, "SC-Z1"), (75355, "SC-Z2")):
        lote = cadastro.gerar([i], "auto")
        assert lote["zona_id"] == zona and lote["id"] not in pilotos
        d = lote["zona_sugestao"]["distancia_divisa_m"]
        assert d is None or d >= 10, d  # T25: 75355 ficou sem limite reconhecido a 250 m (null), como o 75352-75354
        assert all(gl.Polygon(lote["poligono_utm"]).buffer(.001).covers(gl.Point(p["utm"])) for p in lote["zona_sugestao"]["pontos"])
        print(f"AUTO extra completo/{i}: {zona}; conferência visual em dados/zona-auto/completo-{i}.png", flush=True)
    testar_candidatas(cadastro)
    testar_verificacao({"02": cadastro.mapa_zonas, **cadastro.areas_especiais.mapas})
    print(f"Tempo dos ensaios auto (mapa, sintéticos, sete pilotos e três extras): {time.perf_counter()-inicio:.3f} s", flush=True)
    saida = pasta / "auto.json"
    inicio = time.perf_counter()
    r = executar(AQUI / "novo_lote.py", "--base", "completo", "--indices", 19, "--zona", "auto", "--saida", saida)
    segundos = time.perf_counter()-inicio
    assert r.returncode == 0, r.stderr
    assert json.loads(saida.read_text(encoding="utf-8")) == cadastro.gerar([19], "auto")
    print(f"Tempo CLI auto completo/19, processo novo: {segundos:.3f} s", flush=True)
    for indice, preservar in ((22421, True), (22426, False)):
        if not preservar:
            saida.unlink()
        antes = saida.read_bytes() if preservar else None
        r = executar(AQUI / "novo_lote.py", "--base", "completo", "--indices", indice, "--zona", "auto", "--saida", saida)
        assert r.returncode == 2 and "--zona SC-XX" in r.stderr, r.stderr
        assert saida.read_bytes() == antes if preservar else not saida.exists()
    print("OK: CLI auto grava sugestão; recusa preserva destino existente e não cria saída parcial.", flush=True)
