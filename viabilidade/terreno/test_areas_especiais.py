"""Regressões da tarefa 6, executadas por novo_lote.py --testar."""
import json
import sys
import time
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))  # roda sozinho com -I, que não põe a pasta do script no path
from novo_lote import AQUI, gl  # antes do PIL: ele acerta o path das bibliotecas
from PIL import Image
from areas_especiais import FUNDOS, AreasEspeciais, leis_posteriores


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
    assert {a["anexo"] for a in faltantes} == {"05", "06", "07", "06/09-A"}  # os três anexos ausentes + o registro das leis posteriores
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


PONTO_AUDITOR = (-21.985132, -47.885094)  # AUDITORIA-6b: perto da SP-318 km 236; o 07 acusa o cone e o 06 volta vazio
NOMES_NOVOS = ("Leitura automática do Anexo ", "Leis posteriores aos mapas")


def quadrado(lat, lon, lado=20):
    x, y = gl.UTM.transform(lon, lat)
    return gl.Polygon([(x - lado/2, y - lado/2), (x + lado/2, y - lado/2), (x + lado/2, y + lado/2), (x - lado/2, y + lado/2)])


def testar_ressalvas(leitor):
    """Tarefa 13: ressalva por anexo e registro das leis posteriores aos mapas."""
    pol = quadrado(*PONTO_AUDITOR)
    areas = leitor.ler(pol)
    assert any(a["tipo"] == "gabarito_aeronautico" for a in areas), [a["tipo"] for a in areas]  # o alerta do 07 continua
    seis = [a for a in areas if a["anexo"] == "06"]
    assert seis and seis[0]["tipo"] == "nao_verificada" and "nenhuma área especial encontrada — não conferida" in seis[0]["nome"], seis  # e a ressalva do 06
    for anexo, mapa in leitor.mapas.items():  # cada anexo vazio tem a sua; anexo que achou algo não ganha a ressalva
        vazio = not mapa.ler(pol)
        assert any(a["anexo"] == anexo and a["nome"].startswith("Leitura automática do Anexo ") for a in areas) == vazio, anexo
    # um lote qualquer (um quadrado no centro da cidade, sem cone) traz o registro das leis posteriores, e só uma vez
    for lote in (pol, quadrado(-22.0175, -47.8908)):
        leis = [a for a in leitor.ler(lote) if a["nome"].startswith("Leis posteriores")]
        assert len(leis) == 1, leis
    l = leis[0]
    assert l["tipo"] == l["incidencia"] == "nao_verificada" and l["conferido"] is False and not l.get("altura_max_m"), l
    for trecho in ("dez/2016", "19.166/2019", "AEI", "44 e 45", "N e O", "ZUPI-II", "SP-318 km 236", "só em texto", "sem coordenadas",
                   "18.927/2018", "Zona 6E", "9-A", "não é lido por nenhum módulo", "não verificado"):
        assert trecho in l["nome"] + l["observacoes"], trecho
    for link in ("acao=14&lei=1_339", "acao=14&lei=1_754", "lei18927-digital.pdf"):
        assert link in l["fonte"], link
    assert not {"poligono", "poligono_utm", "raio", "raio_m", "geometria"} & set(l)  # nada de polígono nem raio inventado
    # o registro é novo a cada leitura: quem mexer num lote não muda o dos outros
    assert leis_posteriores() is not leis_posteriores()
    print("OK: ponto do Auditor sai com o gabarito do 07 e a ressalva do 06; registro das leis posteriores em todo lote, sem polígono nem raio.", flush=True)


def testar_pilotos_inalterados(leitor, pilotos):
    """Os pilotos seguem como antes, fora dos registros novos: ressalva de cada anexo vazio e leis posteriores."""
    for piloto in pilotos:
        pol = gl.Polygon(piloto["poligono_utm"])
        bruto = [r for m in leitor.mapas.values() for r in m.ler(pol)]  # o que cada anexo achava sozinho: o comportamento antigo
        novas = [a for a in leitor.ler(pol) if a["nome"].startswith(NOMES_NOVOS)]
        assert [a for a in leitor.ler(pol) if a not in novas] == bruto, piloto["id"]
        vazios = sum(not m.ler(pol) for m in leitor.mapas.values())
        assert len(novas) == vazios + 1, (piloto["id"], len(novas), vazios)
        print(f"  piloto {piloto['id']}: registros antigos iguais ({len(bruto)}); novos: {len(novas)} ({vazios} anexo(s) vazio(s) + leis posteriores)", flush=True)
    print("OK: nos pilotos só mudam os registros novos (um por anexo vazio e o das leis posteriores).", flush=True)


def main():
    leitor = AreasEspeciais()
    testar_ressalvas(leitor)
    testar_pilotos_inalterados(leitor, gl.ler("viabilidade/terreno/lotes-piloto.json"))
    print("ok")


if __name__ == "__main__":
    main()
