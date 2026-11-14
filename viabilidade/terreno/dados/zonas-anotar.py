"""Serializa a leitura manual documentada em ZONAS.md, sem classificar pixels.

Executar uma vez na geometria inspecionada. Não reutilizar para outros lotes.
"""
import hashlib
import json
from pathlib import Path
from urllib.parse import quote

BASE = Path(__file__).resolve().parent
todos_lotes = json.loads((BASE.parent / "lotes-piloto.json").read_text(encoding="utf-8"))
hashes_inspecionados = {
    "SC-completo-30516": "d8d3c8e088a394c2fee067cf70c48d048834681c14184ad9c670093c36a6a1c2",
    "SC-completo-37607": "18f40c4e0480f75bbaf456ad000d2eb0c24710ce0e2464d8a9f232fd2384d695",
    "SC-completo-22426": "91344c910cb26f038d7a9327ba944af48ccc90e397ea85c5ec161d14f0408164",
    "SC-completo-22421": "0093bfe02944418c2b4be3eccc9a5e13db7efd7e4396eb6381971b960a6099d9",
    "SC-completo-25297": "948e248a952a6099815918b86c0157fe3bd7b2ed048ba4f3a9c0f20048bacee4",
}
lotes = [l for l in todos_lotes if l["id"] in hashes_inspecionados]
for lote in lotes:
    atual = hashlib.sha256(json.dumps(lote["poligono_utm"], separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    if atual != hashes_inspecionados.get(lote["id"]):
        raise ValueError("Geometria não inspecionada: refazer a leitura manual antes de anotar.")
if len(lotes) != 5 or {l["id"] for l in lotes} != set(hashes_inspecionados):
    raise ValueError("Conjunto de lotes diferente do inspecionado.")
pos = json.loads((BASE / "zonas-posicionamento.json").read_text(encoding="utf-8"))
url_base = "https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/"
nomes = {"02": "ANEXO 02 - Zoneamento Urbano.pdf", "05": "ANEXO 05 - AEIs Ambientais.pdf", "06": "ANEXO 06 - AEIs Urbanas.pdf", "07": "ANEXO 07 - AEIs Rurais.pdf"}
fontes = []
for n, nome in nomes.items():
    pdf = BASE.parent.parent / "lei/mapa/lei18053_anexos_2017_pdf" / nome
    fontes.append({"lei": "Lei 18.053/2016", "anexo": n, "pagina": 1, "url": url_base + quote(nome), "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(), "data": "2026-11-14"})
comuns = [
    "Anotação manual para simulação, não certidão municipal. A geometria de ensaio da maquete não comprova lote cadastral, disponibilidade ou aptidão legal.",
    "Mapas raster generalizados: o resíduo dos controles não mede o erro total do mapa ou do lote. Confirmar cadastro, matrícula, loteamento e normas atualizadas antes de projetar.",
    "Ausência de incidência visual não afasta APP, servidão, patrimônio individual, inundação, contaminação ou outras restrições não desenhadas. Consulta específica ao DECEA continua necessária para validar altura.",
]
leituras = {
    "SC-completo-30516": {
        "zona_id": "SC-Z4",
        "evidencia_zoneamento": "Polígono no preenchimento rosa Z4, a oeste da Avenida República do Líbano, próximo ao extremo oeste da Rua Sergipe. Decisão por coordenadas, não por bairro.",
        "areas_especiais": [{"tipo": "interesse_ambiental", "nome": "AIA da bacia do Córrego da Água Quente", "anexo": "05", "artigos": "73 e 74-IV", "observacoes": "Sobreposição visual com a mancha verde AIA, perto de sua borda leste. Área edificável e APP não delimitadas; não tratar o lote integral como livre para construir."}],
        "areas_especiais_verificacao": {"05": "Sobreposição visual AIA; fora da AECRA f a oeste.", "06": "Fora das áreas históricas e Observatório. Muito próximo da AEIS 21, sem interseção nítida.", "07": "Fora da superfície de aproximação/decolagem e áreas rurais desenhadas."},
        "limitacoes": ["AIA indicada no Anexo 05: parâmetros da Z4 sozinhos não demonstram aptidão construtiva.", "Junto ao extremo noroeste da AEIS tipo 1 nº 21 (Jardim Gonzaga/Monte Carlo). Incidência não confirmada no Anexo 06; conferir limite cadastral antes de afastar a restrição."],
    },
    "SC-completo-37607": {
        "zona_id": "SC-Z4",
        "evidencia_zoneamento": "Preenchimento rosa Z4 ao sul da SP-215; referências Rua Doutor José Paulo Spallini e Rua Aldo Gemano Klein.",
        "areas_especiais": [{"tipo": "interesse_industrial_servicos", "nome": "AEI Industrial e de Serviços nº 42 - CEAT / Parque Novo Mundo", "anexo": "06", "artigos": "84 a 86", "observacoes": "Polígono na área laranja nº 42. Aptidão para prédio residencial não comprovada; conferir uso municipal e restrições registradas do CEAT. Não foi inferida proibição absoluta ou altura específica."}],
        "areas_especiais_verificacao": {"05": "A leste da faixa AIA verde, sem interseção visual clara.", "06": "Dentro da área industrial/serviços 42; fora das áreas históricas e Observatório.", "07": "Fora da superfície de aproximação/decolagem e das áreas rurais desenhadas."},
        "limitacoes": ["Área predominantemente industrial e de serviços de grande porte. Não apresentar como lote apto a residencial sem consulta de uso e matrícula.", "Há faixa AIA a oeste no Anexo 05, sem interseção nítida. Confirmar limites ambientais e áreas públicas."],
    },
    "SC-completo-22426": {
        "zona_id": "SC-Z1", "alternativas_zona_id": ["SC-Z1", "SC-EIXO"],
        "evidencia_zoneamento": "Preenchimento ocre Z1 ao sul da Av. Comendador Alfredo Maffei, no trecho da Rua Conde do Pinhal. Nenhuma testada para avenida foi confirmada.",
        "areas_especiais": [],
        "areas_especiais_verificacao": {"05": "Ao sul da AIA linear do Gregório, sem interseção visual.", "06": "A oeste da poligonal histórica e a sul da área do Observatório; fora da subárea histórica de 9 m.", "07": "Dentro da superfície de aproximação/decolagem, em tracejado roxo."},
        "limitacoes": ["A malha indica frente candidata norte. Se for testada para a Av. Comendador Alfredo Maffei no trecho do art. 11-III, a zona aplicável pode ser SC-EIXO. Confirmar cadastro; proximidade não basta.", "Gabarito aeronáutico indicado no Anexo 07, sem altura numérica local calculada.", "Próximo ao Córrego do Gregório e AIA linear: verificar APP, inundação e faixas não edificáveis."],
    },
    "SC-completo-22421": {
        "zona_id": "SC-Z1", "alternativas_zona_id": ["SC-Z1", "SC-Z2"], "zona_ambigua": True,
        "evidencia_zoneamento": "Ajuste final coloca o polígono no lado ocre Z1, imediatamente a leste da divisa amarela Z2, junto à Rua Conde do Pinhal. Classificação ambígua na escala do mapa.",
        "areas_especiais": [],
        "areas_especiais_verificacao": {"05": "Ao sul da AIA linear do Gregório, sem interseção visual.", "06": "Fora da poligonal histórica, subárea de 9 m e Observatório.", "07": "Dentro da superfície de aproximação/decolagem, em tracejado roxo."},
        "limitacoes": ["ZONA AMBÍGUA: SC-Z1 é hipótese operacional; SC-Z2 também é possível. Borda oeste a poucos metros do traço divisório, comparável ao resíduo dos controles. Não certificar viabilidade por zona única.", "O ajuste inicial com três controles concentrados ao sul colocava o lote do outro lado da divisa. Ajuste final usa cinco controles distribuídos; a sensibilidade exige cadastro oficial.", "Gabarito aeronáutico indicado no Anexo 07, sem altura local definida. Próximo ao Gregório: verificar APP, drenagem e inundação."],
    },
    "SC-completo-25297": {
        "zona_id": "SC-Z1",
        "evidencia_zoneamento": "Polígono completo no ocre Z1, a norte da divisa azul Z3, entre Rua Silvério Ignarra Sobrinho e Rua Raimundo Corrêa, próximo à Rua Amadeu Amaral.",
        "areas_especiais": [],
        "areas_especiais_verificacao": {"05": "Sem interseção visual com manchas ambientais.", "06": "Fora da poligonal histórica, subárea de 9 m, Observatório e demais manchas do entorno.", "07": "Ao sul da superfície de aproximação/decolagem; sem incidência das áreas rurais desenhadas."},
        "limitacoes": ["A leitura da zona não confirma testadas cadastrais, esquina ou alinhamento. Lista vazia de áreas especiais significa apenas nenhuma incidência identificada nos anexos inspecionados."],
    },
}
resultado = []
for lote in lotes:
    ident = lote["id"]
    item = leituras[ident]
    if ident in ("SC-completo-22426", "SC-completo-22421"):
        item["areas_especiais"].append({"tipo": "gabarito_aeronautico", "nome": "Superfície de aproximação e decolagem do Aeroporto Mário Pereira Lopes", "anexo": "07", "artigos": "105 a 107", "observacoes": "Lote dentro do tracejado roxo identificado na legenda como restrição de gabarito. O mapa não dá altura numérica local. Consultar DECEA; não equivale ao gabarito histórico de 9 m."})
    for area in item["areas_especiais"]:
        anexo = area.pop("anexo")
        artigos = area.pop("artigos")
        area.update({"conferido": False, "incidencia": "sobreposicao_visual", "fonte": f"Lei 18.053/2016, arts. {artigos}, Anexo {anexo}, p. 1; " + url_base + quote(nomes[anexo]), "evidencia": f"dados/zonas-mapas/{ident}-anexo{anexo}.jpg"})
    item.update({"id": ident, "poligono_sha256": hashlib.sha256(json.dumps(lote["poligono_utm"], separators=(",", ":"), allow_nan=False).encode()).hexdigest(), "zona_origem": "anotada_a_mao", "zona_conferida": False, "conferido": False, "data_anotacao": "2026-11-14", "fontes": fontes, "metodo": "Vértices EPSG:31983 transformados para EPSG:29183; ajuste afim sobre JPEG original usando cinco vértices do perímetro do Anexo 02.A. Leitura manual da legenda e do polígono completo. Sem fx/fy, KML de proposta ou inferência por bairro.", "evidencias": [f"dados/zonas-mapas/{ident}-anexo{n}.jpg" for n in nomes], "controles": "dados/zonas-controles.json", "posicionamento": "dados/zonas-posicionamento.json", "rmse_controles_anexo02_m": round(pos["02"]["rmse_controles_m"], 3), "incerteza_posicional_total_m": None})
    item["limitacoes"] += comuns
    resultado.append(item)
assert len(resultado) == 5 and sum(len(r["areas_especiais"]) for r in resultado) == 4
assert {r["zona_id"] for r in resultado} == {"SC-Z1", "SC-Z4"}
for lote in todos_lotes:
    if lote["id"] in hashes_inspecionados:
        continue
    assert lote["categoria"] in ("eixo", "z2")
    anotacao = json.loads((BASE / f"anotacao-{lote['categoria']}.json").read_text(encoding="utf-8"))
    atual = hashlib.sha256(json.dumps(lote["poligono_utm"], separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    assert anotacao["id"] == lote["id"] and anotacao["poligono_sha256"] == atual
    assert anotacao["zona_origem"] == "anotada_a_mao" and anotacao["zona_conferida"] is False
    resultado.append(anotacao)
assert len(resultado) == len(todos_lotes) and len({r["id"] for r in resultado}) == len(resultado)
(BASE / "anotacoes-zonas.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{len(resultado)} anotações manuais gravadas, com incidências especiais e hashes dos polígonos.")
