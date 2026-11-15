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
        assert {"SC-Z1", "SC-Z2"} <= set(s["alternativas"])
        s = recusar(lote(4506, 4520), "menos de 10 m")
        assert s["distancia_divisa_m"] < 10
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z2" and s["distancia_divisa_m"] >= 10
        for modo in ("desconhecida", "campus"):
            raster.modo = modo
            recusar(lote(4520, 4540), "Cor sem correspondência")
        raster.modo = "eixo"
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z1" and s["alternativas"] == ["SC-EIXO"] and "testada" in s["motivo_duvida"]
        _, s = mapa.sugerir(lote(4560, 4580))
        assert "SC-EIXO" not in s["alternativas"]
        raster.modo = "texto_fino"
        z, s = mapa.sugerir(lote(4520, 4540))
        assert z == "SC-Z1" and any(p["cor_recuperada"] for p in s["pontos"])
        recusar(lote(100, 120), "Fora do quadro")
        recusar(gl.Polygon(mapa.utm([(500, 10300), (550, 10300), (550, 10350), (500, 10350)])), "Fora do quadro")
    finally:
        mapa.imagem = original
    print("OK: cores desconhecidas/campus, traços, lote multizona, divisa de 10 m e alternativa Eixo de 60 m.", flush=True)


def testar(cadastro, pilotos, pasta):
    from test_novo_lote import executar
    inicio = time.perf_counter()
    testar_tracos()
    cadastro.mapa_zonas = MapaZonas()
    testar_cores(cadastro.mapa_zonas)
    esperadas = {"30516": "SC-Z4", "37607": "SC-Z4", "25297": "SC-Z1", "75352-75354": "SC-Z2"}
    for original in pilotos.values():
        fonte = original["fonte"]
        ids = fonte.get("indices_feicoes_zero_based", [fonte.get("indice_feicao_zero_based")])
        try:
            zona, s = cadastro.mapa_zonas.sugerir(gl.Polygon(original["poligono_utm"]))
            if ids == [75352, 75353, 75354]:
                from test_novo_lote import recusa
                recusa(lambda: cadastro.gerar(ids, "auto"), "vizinhos com geometria inválida [75351]")
            else:
                lote = cadastro.gerar(ids, "auto")
                assert lote["zona_id"] == zona
                assert lote["zona_origem"] == "sugerida_pelo_mapa" and not lote["zona_conferida"]
            assert zona == next(z for fim, z in esperadas.items() if original["id"].endswith(fim))
            assert s["pontos"] and abs(sum(s["proporcao_por_zona"].values())-1) < 1e-10
            comparacao = "concorda" if zona == original["zona_id"] else "sugere outra"
            resultado = f"{comparacao}: {zona}"
            if ids == [75352, 75353, 75354]:
                resultado += " (leitura do piloto; montagem recusada: vizinho inválido 75351)"
        except ZonaIncerta as erro:
            assert any(original["id"].endswith(fim) for fim in ("22426", "22421", "11984-11988")), str(erro)
            s = erro.sugestao
            assert "SC-EIXO" in s["alternativas"]
            if original["id"].endswith("22421"):
                assert "SC-Z2" in s["alternativas"] and s["distancia_divisa_m"] < 10
            from test_novo_lote import recusa
            recusa(lambda: cadastro.gerar(ids, "auto"), "Zona automática recusada")
            resultado = f"recusa por dúvida: {s['motivo_duvida']}; alternativas={s['alternativas']}"
        print(f"AUTO {original['id']}: manual={original['zona_id']}; {resultado}", flush=True)
    for i, zona in ((19, "SC-Z3"), (25298, "SC-Z1"), (75355, "SC-Z2")):
        lote = cadastro.gerar([i], "auto")
        assert lote["zona_id"] == zona and lote["id"] not in pilotos
        assert lote["zona_sugestao"]["distancia_divisa_m"] >= 10
        assert all(gl.Polygon(lote["poligono_utm"]).buffer(.001).covers(gl.Point(p["utm"])) for p in lote["zona_sugestao"]["pontos"])
        print(f"AUTO extra completo/{i}: {zona}; conferência visual em dados/zona-auto/completo-{i}.png", flush=True)
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
