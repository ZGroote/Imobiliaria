"""Regressões da tarefa 6, executadas por novo_lote.py --testar."""
import json
import time
from unittest.mock import patch

from PIL import Image
from novo_lote import AQUI, gl
from areas_especiais import FUNDOS, AreasEspeciais


def testar_leitura(leitor):
    for anexo, mapa in leitor.mapas.items():
        assert not isinstance(mapa, str), (anexo, mapa)
        original = mapa.imagem
        pol = gl.Polygon(mapa.utm([(6000, 9000), (6020, 9000), (6020, 9020), (6000, 9020)]))

        branco = (255, 255, 255)

        class Raster:
            cor = branco
            faixa = False
            linha = None

            def crop(self, caixa):
                x0, y0, x1, y1 = caixa
                rgb = gl.np.empty((y1-y0, x1-x0, 3), dtype="uint8")
                rgb[:] = self.cor
                if self.faixa:
                    xx = gl.np.arange(x0, x1) + .5
                    rgb[:, xx >= 6020 + 7*mapa.escala_min] = mapa.paleta[0]
                if self.linha is not None:  # traço de 2 px atravessando o lote
                    rgb[:, 6010-x0:6012-x0] = self.linha
                return Image.fromarray(rgb)

        raster = Raster()
        mapa.imagem = raster
        try:
            assert mapa.ler(pol) == [], anexo
            for i, (_, _, tipo, nome) in enumerate(mapa.legenda):
                raster.cor = mapa.paleta[i]
                areas = mapa.ler(pol)
                assert any(a["tipo"] == tipo and a["nome"] == nome and a["incidencia"] == "sobreposicao_visual" for a in areas)
            # AUDITORIA-6 achado 2: cor composta (legenda translúcida sobre cada fundo) conta como a legenda
            for k in range(len(mapa.legenda) + len(FUNDOS[anexo]) + 1, len(mapa.paleta)):
                raster.cor = mapa.paleta[k]
                tipo = mapa.legenda[mapa.codigo[k + 1] - 1][2]
                assert any(a["tipo"] == tipo and a["incidencia"] == "sobreposicao_visual" for a in mapa.ler(pol)), (anexo, k)
            # achado 4: o cinza das Chácaras em traço de 2 px (ruas do Anexo 05) não é Chácaras
            raster.cor, raster.linha = branco, mapa.paleta[0]
            if mapa.legenda[0][2] == "chacaras_recreio":
                assert not any(a["tipo"] == "chacaras_recreio" for a in mapa.ler(pol))
            raster.linha = None
            # achado 8: margem >= maior resíduo do anexo
            assert mapa.divisa_m == {"05": 10, "06": 11, "07": 12}[anexo], (anexo, mapa.divisa_m)
            raster.faixa = True
            areas = mapa.ler(pol)
            assert any(a["incidencia"] == "possivel_incidencia" and a["distancia_conservadora_m"] <= mapa.divisa_m for a in areas)
            raster.faixa = False
            raster.cor = (0, 0, 0)
            assert any(a["incidencia"] == "nao_verificada" for a in mapa.ler(pol))
            fora = gl.Polygon(mapa.utm([(50, 50), (70, 50), (70, 70), (50, 70)]))
            assert mapa.ler(fora)[0]["incidencia"] == "nao_verificada"
            if anexo == "07":
                for cone in gl.sh.get_parts(mapa.cones):
                    miolo = cone.representative_point().buffer(10)
                    assert any(a["tipo"] == "gabarito_aeronautico" for a in mapa.ler(miolo))
                # O cone deve continuar reconhecido mesmo sem traço colorido no recorte do lote.
                raster.cor = branco
                assert any(a["tipo"] == "gabarito_aeronautico" for a in mapa.ler(miolo))
        finally:
            mapa.imagem = original
        if anexo == "06":  # achado 4: Subárea de Restrição de Gabarito (art. 80) no Centro
            miolo = mapa.subarea.representative_point().buffer(10)
            assert any(a["tipo"] == "restricao_gabarito_historico" for a in mapa.ler(miolo))
        if anexo == "07":  # achado 3: vão entre os cones (pista) e AEI do Transporte Aéreo, pontos da auditoria
            for x, y, aei in ((5150, 5620, True), (4800, 5600, False), (4950, 5400, True)):
                tipos = {a["tipo"] for a in mapa.ler(gl.Point(*mapa.utm([(x, y)])[0]).buffer(10))}
                assert "gabarito_aeronautico" in tipos and ("transporte_aereo" in tipos) == aei, (x, y, tipos)
    with patch("areas_especiais.MapaEspecial", side_effect=ValueError("Mapa ausente ou SHA256 divergente")):
        faltantes = AreasEspeciais().ler(pol)
    assert {a["anexo"] for a in faltantes} == {"05", "06", "07"}
    assert all(a["incidencia"] == "nao_verificada" for a in faltantes)
    print("OK: legendas, mancha a 7 m, cor encoberta, fora do quadro, fonte ausente/divergente e interiores dos dois cones; cor composta do Histórico, traço cinza não é Chácaras, margem por anexo, Subárea do art. 80, vão dos cones e AEI do Transporte Aéreo.", flush=True)


def testar(cadastro, pilotos, pasta):
    from test_novo_lote import executar
    inicio = time.perf_counter()
    leitor = cadastro.areas_especiais
    testar_leitura(leitor)
    for piloto in pilotos.values():
        automaticas = leitor.ler(gl.Polygon(piloto["poligono_utm"]))
        manuais = {a["tipo"] for a in piloto["areas_especiais"]}
        tipos = {a["tipo"] for a in automaticas if a["incidencia"] != "nao_verificada"}
        assert manuais <= tipos, (piloto["id"], manuais, tipos)
        assert all(a["fonte"] and a["observacoes"] and a["conferido"] is False and not a.get("altura_max_m") for a in automaticas)
        pendentes = [a["anexo"] for a in automaticas if a["incidencia"] == "nao_verificada"]
        print(f"ESPECIAIS {piloto['id']}: manual={sorted(manuais)}; auto={sorted(tipos)}; não verificada={pendentes}", flush=True)
    destino = pasta / "estudo-cone"
    cli_inicio = time.perf_counter()
    r = executar(AQUI.parent / "motor/estudar.py", "--base", "completo", "--indices", 22420,
                 "--zona", "SC-Z1", "--pasta", destino)
    assert r.returncode == 0, r.stderr
    lote = json.loads((destino / "lote.json").read_text(encoding="utf-8"))
    assert lote["id"] not in pilotos
    assert any(a["tipo"] == "gabarito_aeronautico" for a in lote["areas_especiais"])
    estudo = json.loads((destino / "estudo.json").read_text(encoding="utf-8"))
    assert estudo["opcoes"], estudo["opcoes_ausentes"]
    assert "ÁREA ESPECIAL" in json.dumps(estudo, ensure_ascii=False)
    assert any("ÁREA ESPECIAL" in alerta and "gabarito_aeronautico" in alerta
               for opcao in estudo["opcoes"] for alerta in opcao["alertas"])
    assert "gabarito_aeronautico" in (destino / "relatorio.html").read_text(encoding="utf-8")
    print(f"OK: estudar.py completo/22420: alerta ÁREA ESPECIAL/gabarito_aeronautico no estudo e relatório; CLI {time.perf_counter()-cli_inicio:.3f} s.", flush=True)
    print(f"Tempo dos ensaios de áreas especiais: {time.perf_counter()-inicio:.3f} s.", flush=True)
