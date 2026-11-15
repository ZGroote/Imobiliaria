"""Reproduz o remembramento inspecionado; não escolhe zona automaticamente.

python -I viabilidade/terreno/dados/eixo-reproduzir.py
Só escreve os novos artefatos eixo/novo-eixo/anotacao-eixo.
"""
import hashlib
import json
from pathlib import Path
import site
import sys

sys.path.append(site.getusersitepackages())
BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE.parent))
import gerar_lotes as base
import numpy as np
import shapely as sh
from shapely.geometry import LineString, Polygon, shape
from PIL import Image, ImageDraw
from pyproj import Transformer

IDS = [11984, 11985, 11986, 11987, 11988]
IDENT = "SC-completo-q1382-11984-11988"
ARQUIVO = "sao-carlos/dados/lotes_saocarlos_completo.geojson"
LEI = "https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257"


def gravar(nome, dado):
    base.gravar(BASE / nome, dado)


def main():
    features = base.ler(ARQUIVO)["features"]
    geos = sh.transform(np.array([shape(f["geometry"]) for f in features]), base.UTM.transform, interleaved=False)
    parcelas = geos[IDS]
    assert {features[i]["properties"]["quadra"] for i in IDS} == {1382}
    assert all(g.is_valid and not g.interiors for g in parcelas)
    uniao = sh.union_all(parcelas)
    assert uniao.geom_type == "Polygon" and uniao.is_valid and not uniao.interiors
    assert 1200 <= uniao.area <= 3000
    assert abs(sum(g.area for g in parcelas) - uniao.area) < 0.0001
    contatos = []
    for a, i in enumerate(IDS):
        for b, j in enumerate(IDS[a + 1:], a + 1):
            contato = parcelas[a].boundary.intersection(parcelas[b].boundary).length
            if contato > 0.01:
                contatos.append({"indices": [i, j], "borda_comum_m": round(contato, 6)})
    conectados = {IDS[0]}
    while True:
        antes = len(conectados)
        for c in contatos:
            if conectados.intersection(c["indices"]):
                conectados.update(c["indices"])
        if len(conectados) == antes:
            break
    assert conectados == set(IDS)
    tree = sh.STRtree(np.where(sh.is_valid(geos), geos, None))
    vizinhos = [int(i) for i in tree.query(uniao, predicate="intersects") if i not in IDS]
    sobreposicao = max((uniao.intersection(geos[i]).area for i in vizinhos), default=0)
    assert sobreposicao <= 0.1
    pilotos = base.ler("viabilidade/terreno/lotes-piloto.json")
    assert all(uniao.intersection(Polygon(l["poligono_utm"])).area < 0.1 for l in pilotos if l["id"] != IDENT)
    coords = [[round(x, 6), round(y, 6)] for x, y in uniao.exterior.coords]
    lote_geo = Polygon(coords)
    assert lote_geo.symmetric_difference(uniao).area < 0.001
    malha, _ = base.ruas()
    tree_ruas = sh.STRtree(malha)
    rua = sh.union_all(malha[tree_ruas.query(uniao.buffer(12), predicate="intersects")])
    assert uniao.intersection(rua).area < 0.02 * uniao.area
    frentes = []
    for k, (a, b) in enumerate(zip(coords, coords[1:])):
        lado = LineString([a, b])
        dist = [lado.interpolate(t, normalized=True).distance(rua) for t in (0.15, 0.5, 0.85)]
        if lado.length >= 8 and max(dist) <= 6:
            frentes.append({"aresta": k, "pontos": [a, b], "comprimento_m": round(lado.length, 3), "distancia_max_asfalto_m": round(max(dist), 3)})
    frentes.sort(key=lambda f: -f["comprimento_m"])
    assert frentes and frentes[0]["aresta"] == 11
    frente = frentes[0]["pontos"]
    assert LineString(frente).difference(lote_geo.boundary).length < 0.001
    # Mostra a borda escolhida e os componentes sem inferir rua a partir de fx/fy.
    desenho = Image.new("RGB", (1100, 800), "white")
    lapis = ImageDraw.Draw(desenho)
    cx, cy = uniao.centroid.coords[0]
    def tela(p):
        return (550 + (p[0] - cx) * 5, 400 - (p[1] - cy) * 5)
    for tri in malha[tree_ruas.query(uniao.buffer(60), predicate="intersects")]:
        lapis.polygon([tela(p) for p in tri.exterior.coords], fill="#b5b5b5")
    for i, g in zip(IDS, parcelas):
        lapis.polygon([tela(p) for p in g.exterior.coords], fill="#fff1b8", outline="#6d5a15", width=2)
        lapis.text(tela(g.representative_point().coords[0]), str(i), fill="black")
    lapis.line([tela(p) for p in coords], fill="magenta", width=3)
    lapis.line([tela(p) for p in frente], fill="#00a4c8", width=6)
    lapis.text((25, 25), "EIXO - geometria da base completa / EPSG:31983 - norte para cima", fill="black")
    lapis.text((25, 50), "Cinza: malha de asfalto. Amarelo: parcelas. Magenta: uniao exata. Azul: frente usada.", fill="black")
    lapis.text((25, 75), "Nome da via e trecho: leitura manual Anexo 02 + art. 11-I; sem certificacao cadastral.", fill="black")
    lapis.line([(25, 750), (125, 750)], fill="black", width=3)
    lapis.text((25, 760), "20 m", fill="black")
    desenho.save(BASE / "eixo-testada.jpg", quality=90)
    pos = base.ler("viabilidade/terreno/dados/zonas-posicionamento.json")
    t = Transformer.from_crs(31983, 29183, always_xy=True)
    xy = np.array([t.transform(*p) for p in coords])
    posicionamento = {}
    for n, p in pos.items():
        coef = np.array(p["afim_utm_menos_origem_para_pixel"])
        pixels = np.column_stack([xy - p["origem_utm"], np.ones(len(xy))]) @ coef
        fp = np.array([pixels[11], pixels[12]])
        posicionamento[n] = {"afim_utm_menos_origem_para_pixel": coef.tolist(), "origem_utm": p["origem_utm"], "rmse_controles_m": p["rmse_controles_m"], "poligono_pixels": pixels.tolist(), "frente_pixels": fp.tolist()}
        im = Image.open(BASE / f"zonas-mapas/anexo{n}.jpg")
        assert im.size == (8858, 12746)
        d = ImageDraw.Draw(im)
        d.line([tuple(v) for v in pixels], fill="magenta", width=4)
        d.line([tuple(v) for v in fp], fill="cyan", width=5)
        x, y = pixels[:-1].mean(axis=0)
        d.ellipse((x-35, y-35, x+35, y+35), outline="magenta", width=3)
        im.crop((int(x)-600, int(y)-500, int(x)+600, int(y)+500)).save(BASE / f"eixo-anexo{n}.jpg", quality=90)
        if n == "02":
            # Inclui os dois extremos oficiais do trecho, não só o entorno imediato.
            contexto = im.crop((2920,3660,4440,4660))
            contexto.save(BASE / "eixo-trecho-art11.jpg", quality=90)
    gravar("eixo-posicionamento.json", posicionamento)
    fontes = base.ler("viabilidade/terreno/dados/anotacoes-zonas.json")[0]["fontes"]
    fontes = fontes + [{"lei": "Lei 18.053/2016", "artigo": "11-I", "url": LEI, "data": "2026-11-14", "observacoes": "Texto oficial acessível consultado: o Eixo inclui testadas para Miguel Petroni/Miguel João no trecho Francisco Pereira Lopes–rotatória Bruno Ruggieiro Filho."}]
    areas = [{"tipo": "gabarito_aeronautico", "nome": "Superfície de aproximação e decolagem do Aeroporto Mário Pereira Lopes", "conferido": False, "incidencia": "sobreposicao_visual", "fonte": "Lei 18.053/2016, arts. 105 a 107, Anexo 07, p. 1; " + next(f["url"] for f in fontes if f.get("anexo") == "07"), "evidencia": "dados/eixo-anexo07.jpg", "observacoes": "Polígono dentro do perímetro tracejado roxo de restrição aeronáutica. Sem altura local numérica; consultar DECEA."}]
    limites = [
        "Remembramento geométrico de cinco parcelas planta_refeita da maquete, não cadastro ou matrícula. A origem representa reconstrução de planta com lotes padronizados; divisas e disponibilidade exigem conferência.",
        "A classificação Eixo é hipótese manual apoiada no nome e trecho do Anexo 02, art. 11-I e testada próxima ao asfalto. Confirmar endereço, alinhamento e testadas cadastrais. Não foi usado apenas o bairro ou a proximidade do centro.",
        "A frente representa o maior segmento reto elegível da borda norte; não soma toda a testada fragmentada. O Motor usa esta única frente.",
        "Sem sobreposição visual com AIA ou área industrial nos Anexos 05/06. Lista não certifica ausência de APP, patrimônio individual, servidão, inundação ou contaminação.",
        "Incidência aeronáutica visual no Anexo 07; altura depende de consulta DECEA. Resíduo do ajuste não mede erro posicional total; conferir divisas em cadastro oficial.",
    ]
    evidencia = "Polígono na faixa entre as vias do eixo Miguel Petroni/Miguel João, a leste da rotatória da Av. Bruno Ruggieiro Filho e a oeste da Av. Francisco Pereira Lopes. Borda norte com segmento de 16,773 m a até 4,403 m da malha de asfalto; o Anexo 02 nomeia expressamente o trecho como Eixo. Fundo de mapa Z2, mas classificação operacional SC-EIXO pela testada (art. 11-I)."
    anotacao = {"id": IDENT, "poligono_sha256": hashlib.sha256(json.dumps(coords, separators=(",", ":"), allow_nan=False).encode()).hexdigest(), "zona_id": "SC-EIXO", "zona_origem": "anotada_a_mao", "zona_conferida": False, "conferido": False, "data_anotacao": "2026-11-14", "fontes": fontes, "evidencia_zoneamento": evidencia, "areas_especiais": areas, "areas_especiais_verificacao": {"05": "Fora das manchas verdes AIA/áreas ambientais na leitura visual; manchas próximas a leste e norte não interceptam o polígono.", "06": "Fora das áreas industriais, históricas, subárea de 9 m, Observatório e AEIS representadas neste entorno.", "07": "Dentro do perímetro tracejado roxo de restrição aeronáutica; fora das áreas rurais coloridas."}, "metodo": "União exata das geometrias completas lonlat projetadas EPSG:31983; transformação EPSG:29183 e ajuste afim existente com cinco controles por anexo. Leitura manual dos quatro anexos e nome de via/trecho; testada corroborada pela malha de asfalto. Sem fx/fy, buffer de fechamento ou classificação por cor.", "evidencias": [f"dados/eixo-anexo{n}.jpg" for n in pos] + ["dados/eixo-trecho-art11.jpg", "dados/eixo-contiguidade.json"], "controles": "dados/zonas-controles.json", "posicionamento": "dados/eixo-posicionamento.json", "rmse_controles_anexo02_m": round(pos["02"]["rmse_controles_m"], 3), "incerteza_posicional_total_m": None, "limitacoes": limites}
    lote = {"id": IDENT, "lid": None, "poligono_utm": coords, "frente": frente, "area_m2": round(lote_geo.area, 3), "zona_id": "SC-EIXO", "zona_origem": "anotada_a_mao", "zona_conferida": False, "relevo": None, "areas_especiais": areas, "crs": "EPSG:31983", "categoria": "eixo", "centroide_lonlat": [round(v, 8) for v in base.GEO.transform(uniao.centroid.x, uniao.centroid.y)], "distancia_centro_referencia_m": round(uniao.centroid.distance(base.CENTRO), 1), "fonte": {"arquivo": ARQUIVO, "sha256": hashlib.sha256((base.ROOT / ARQUIVO).read_bytes()).hexdigest(), "indices_feicoes_zero_based": IDS, "quadra": 1382, "operacao": "uniao_exata_sem_buffer_sem_fechamento_de_lacunas", "propriedades_componentes": [features[i]["properties"] for i in IDS]}, "qualidade": {"frentes": frentes, "esquina_indicada_pela_malha": False, "maior_sobreposicao_vizinho_m2": round(sobreposicao, 6), "sobreposicao_asfalto_m2": round(uniao.intersection(rua).area, 6), "ocupacao_retangulo_minimo": round(uniao.area / uniao.minimum_rotated_rectangle.area, 5)}, "conferido": False, "observacoes": " ".join(limites)}
    gravar("eixo-contiguidade.json", {"indices": IDS, "quadra": 1382, "contatos": contatos, "area_componentes_m2": [g.area for g in parcelas], "area_uniao_m2": uniao.area, "area_adicionada_por_fechamento_m2": 0, "operacao": "shapely.union_all das parcelas projetadas; sem buffer/snap/simplify", "maior_sobreposicao_vizinho_valido_m2": sobreposicao, "testada": frentes[0], "arestas_e_parcelas": [{"indice": i, "poligono_utm": [list(v) for v in geos[i].exterior.coords]} for i in IDS]})
    gravar("novo-eixo.json", lote)
    gravar("anotacao-eixo.json", anotacao)
    print(json.dumps({"id": IDENT, "area_m2": lote["area_m2"], "distancia_centro_m": lote["distancia_centro_referencia_m"], "frente": frentes[0], "contatos": contatos}, ensure_ascii=False))


if __name__ == "__main__":
    main()
