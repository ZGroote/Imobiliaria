# gera viabilidade/lei/zonas.json a partir da tabela conferida no texto oficial
import json, sys
PD = "https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257"
COE = "https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015"
L6E = "Lei nº 18.927/2018 (cria art. 42-A na Lei 18.053/2016)"
RECUO_REGRA = ("Código de Obras (Lei 19.950/2020): janela ou abertura voltada para a divisa (lateral ou fundos) = 1,50 m no térreo e no 1º pavimento; "
               "h/8 com mínimo de 2,00 m nos demais pavimentos, onde h = altura até o teto do pavimento da janela (art. 67, calculado pavimento a pavimento). "
               "Varanda aberta para a divisa: 1,50 m no 1º pavimento e h/8 (mín. 2,00 m) acima (art. 68). Janela perpendicular à divisa: 0,75 m. "
               "Parede sem abertura pode encostar na divisa até 12 m de altura; acima de 12 m, 2,00 m (art. 70). Pode escalonar (art. 71). "
               "Entre janelas de unidades diferentes ou entre blocos do mesmo lote: 2,00 m (art. 69). Valem também os recuos registrados do loteamento (art. 74).")
FONTE_COE = [
  {"lei": "Lei nº 19.950/2020 (Código de Obras)", "artigo": "arts. 67, 68, 69, 70, 71, 74", "url": COE, "data": "2020-12-15"},
  {"lei": "Lei nº 20.072/2021", "artigo": "art. 10 (nova redação do art. 67-I do COE) e art. 11 (§5º)", "url": "https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2987", "data": "2021-04-06"},
  {"lei": "Lei nº 24.031/2026", "artigo": "art. 2º (nova redação do art. 68 do COE)", "url": "https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_7985", "data": "2026-02-24"},
]
# COE art. 67 (redação da Lei 20.072/2021): abertura recuada "da divisa" (vale para lateral e fundos;
# a frente é "alinhamento", não divisa). Art. 70: parede sem abertura, 2,00 m a partir de 12 m de altura.
RECUO_POR_ALTURA = {"ate_pavimento": 1, "recuo_m": 1.5, "acima": {"fracao_h": 0.125, "minimo_m": 2.0}}
COMUM = {
  "recuo_lateral_por_altura": RECUO_POR_ALTURA,
  "recuo_fundos_por_altura": RECUO_POR_ALTURA,
  "parede_cega_encosta_ate_m": 12,
  "garagem_computavel": False,
  "garagem_conta_na_taxa_ocupacao": False,
  "nao_computavel": [
    "garagem/estacionamento com circulação e manobra (COE art. 51-I)",
    "reservatório, barrilete, casa de máquinas, abrigo de gás, cabine primária (art. 51-II)",
    "depósito de lixo/recicláveis (art. 51-III)",
    "escada e antecâmara de escada (art. 51-IV)",
    "fosso de elevador, dutos, shafts (art. 51-V; contam só no pavimento mais baixo, §1º)",
    "antecâmara de elevador de emergência (art. 51-VI, Lei 20.072/2021)",
    "área técnica de ar-condicionado e ventilação (art. 51-VIII)",
    "beiral/marquise até 1,20 m não é área construída (art. 3º-IX e XV)",
    "térreo comercial de prédio misto no Eixo Estruturante (PD art. 11 par. único; COE art. 52) e na fachada ativa (PD art. 141-IV)"
  ],
  "vagas_min_por_unidade": None,
  "vagas_regra": ("COE Tabela 1 (art. 100): residencial multifamiliar vertical NÃO tem mínimo de vagas de carro ('-' na tabela). "
                  "Se houver vagas: 2% para pessoa com deficiência (mín. 1), 1 bicicleta a cada 20 vagas. Comércio com 100 m² ou mais de área computável: 1 vaga a cada 100 m². "
                  "Garagem não conta no CA, no CAB/CAM nem na taxa de ocupação (art. 51, caput). Varanda NÃO está na lista do art. 51, então conta como computável (leitura nossa, confirmar)."),
  "vaga_largura_m": 2.4, "vaga_comprimento_m": 5.0, "faixa_manobra_90graus_m": 5.0,
}
FONTE_VAGAS = {"lei": "Lei nº 19.950/2020 (Código de Obras)", "artigo": "arts. 3º-IX/XV, 51, 52, 100; Tabelas 1 e 2 anexas", "url": COE, "data": "2020-12-15"}
OBS_COMUM = ("Recuo frontal: nem o Plano Diretor nem o Código de Obras definem um recuo frontal geral; vale o que estiver registrado no loteamento (COE art. 74). "
             "Altura: o Plano Diretor não limita altura por zona; só há limite na Subárea de Restrição de Gabarito (9 m, art. 80) e na área do Observatório da USP (art. 82), ver FONTES.md. "
             "recuo_lateral_m/recuo_fundos_m = 1,50 é o mínimo com janela no térreo e no 1º pavimento; acima disso vale a regra h/8.")

def zona(id, nome, art, data, co, cp, cab, cam, extra, conferido=True, obs="", lei="Lei nº 18.053/2016 (Plano Diretor)", url=PD):
    p = {"ca_basico": cab, "ca_maximo": cam, "taxa_ocupacao": co, "taxa_permeabilidade": cp,
         "recuo_frontal_m": None, "recuo_lateral_m": 1.5, "recuo_fundos_m": 1.5,
         "recuo_lateral_regra": RECUO_REGRA, "altura_max_m": None, "pavimentos_max": None}
    p.update(COMUM)
    p.update(extra)
    return {"id": id, "nome": nome, "parametros": p,
            "fontes": [{"lei": lei, "artigo": art, "url": url, "data": data}, *FONTE_COE, FONTE_VAGAS],
            "conferido": conferido, "observacoes": (obs + " " + OBS_COMUM).strip()}

D = "2016-12-19"
z = [
 zona("SC-EIXO", "Eixo Estruturante (lotes com frente para as avenidas do art. 11)", "art. 13; art. 152-I; art. 176 (outorga)", D,
      0.70, 0.15, 2.0, 4.0, {"ca_unifamiliar": 1.4, "lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": True},
      obs="Do CAB 2,0 ao CAM 4,0 paga outorga onerosa: 5% do valor de mercado da área acima do CAB (art. 177 §1º). Térreo comercial de prédio misto não conta no CA (art. 11, parágrafo único). HIS: lote 150 m², testada 7,5 m. Não é mancha de mapa: são os lotes com frente para as vias listadas no art. 11."),
 zona("SC-Z1", "Zona 1 – Ocupação Consolidada", "art. 17; art. 152-II; art. 176", D,
      0.70, 0.15, 2.0, 3.0, {"ca_unifamiliar": 1.4, "lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": True},
      obs="CAM 3,0 só para empreendimento com pelo menos 50% da área computável residencial multifamiliar (art. 152-II-b); se mais de 50% for comércio/serviço, vale só o CAB 2,0 (art. 17, parágrafo único). Acima do CAB paga outorga (art. 177 §1º, 5%). HIS: lote 160 m², testada 8 m."),
 zona("SC-Z2", "Zona 2 – Ocupação Induzida", "art. 21; art. 152-III; art. 176", D,
      0.70, 0.15, 2.0, 3.5, {"ca_unifamiliar": 1.4, "lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": True},
      obs="Acima do CAB 2,0 paga outorga onerosa (art. 177 §1º, 5% do valor de mercado da área excedente). HIS: lote 160 m², testada 8 m."),
 zona("SC-Z3", "Zona 3 – Ocupação Condicionada", "art. 25; art. 152-IV", D,
      0.70, 0.15, 1.4, 1.4, {"lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": False},
      obs="A lei dá um CA único de 1,4 (sem básico/máximo e sem outorga): repetido em ca_basico e ca_maximo. HIS: lote 160 m², testada 8 m. As áreas industriais da Lei 19.166/2019 usam os coeficientes desta zona."),
 zona("SC-Z4", "Zona 4 – Qualificação e Ocupação Controlada", "art. 29; art. 152-V", D,
      0.70, 0.15, 1.4, 1.4, {"lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": False},
      obs="CA único 1,4, repetido em ca_basico e ca_maximo. HIS: lote 160 m², testada 8 m."),
 zona("SC-Z5A", "Zona 5A – Proteção e Ocupação Controlada SUC Monjolinho-Espraiado (manancial)", "art. 36 (quadro) e arts. 150, 153, 154", D,
      0.50, 0.30, 1.0, 1.0, {"taxa_cobertura_vegetal": 0.10, "testada_min_m": None, "outorga_onerosa": False}, conferido=False,
      obs="Valores para lote maior que 300 m² (coluna 'Regulares Exist. 3' do quadro do art. 36). O quadro varia com o lote: até 125 m² CO 70% e CP 15%; de 125 a 300 m² CO 70%→50% e CP 15%→30%; CA 1,4 para HIS. CONFLITO: o art. 153 dá CP mínimo de 20% e o art. 154 dá CCV de 20%, contra 30% e 10% do quadro. O quadro remete à Lei 13.944/2006 (APREM), que não foi conferida. Testada mínima: 'não há'."),
 zona("SC-Z5B", "Zona 5B – Proteção e Ocupação Controlada SUC Ribeirão do Feijão (manancial)", "art. 38 (quadro) e arts. 150, 153, 154", D,
      0.50, 0.30, 1.0, 1.0, {"taxa_cobertura_vegetal": 0.10, "testada_min_m": None, "outorga_onerosa": False}, conferido=False,
      obs="Mesmo quadro e mesmos conflitos da Zona 5A (art. 153 dá CP 20%, art. 154 dá CCV 20%). Valores para lote maior que 300 m². Lei 13.944/2006 (APREM) não conferida."),
 zona("SC-Z6A", "Zona 6A – Regulação e Ocupação Controlada de Maior Densidade", "art. 41", D,
      0.70, 0.20, 1.4, 1.4, {"taxa_cobertura_vegetal": 0.10, "ca_eixo_arterial_tipo1": 2.0, "lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": False},
      obs="CA 1,4; sobe para 2,0 em lote nos eixos viários arteriais tipo 1 (campo ca_eixo_arterial_tipo1; quais vias são tipo 1 está no anexo do sistema viário, não conferido). Zona de expansão: o CP de 20% vale depois do loteamento (art. 153-VIII). HIS: lote 160 m², testada 8 m."),
 zona("SC-Z6B", "Zona 6B – Regulação e Ocupação Controlada de Média Densidade", "art. 45; art. 153-IX", D,
      0.50, 0.40, 1.0, 1.0, {"taxa_cobertura_vegetal": 0.20, "ca_eixo_arterial_tipo1": 2.0, "lote_min_m2": 250, "testada_min_m": 10, "outorga_onerosa": False}, conferido=False,
      obs="CONFLITO: o art. 45 dá CP 40% e o art. 153-IX dá CP mínimo de 30%; usei 40% (o mais restritivo). CA 1,0; 2,0 nos eixos viários arteriais tipo 1. HIS: lote 160 m², testada 8 m."),
 zona("SC-Z6C", "Zona 6C – Regulação e Ocupação Controlada de Menor Densidade", "art. 49; art. 153-X", D,
      0.70, 0.20, 1.0, 1.0, {"taxa_cobertura_vegetal": 0.15, "ca_his": 1.4, "lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": False},
      obs="CA 1,0 (1,4 para HIS). Em loteamento de chácara de recreio: CO 25%, CP 50%, CA 0,25 (arts. 150, 152, 153-X-a). HIS: lote 160 m², testada 8 m."),
 zona("SC-Z6D", "Zona 6D – Regulação e Ocupação Controlada de Indústrias e Serviços", "art. 53", D,
      0.70, 0.20, 1.0, 1.0, {"taxa_cobertura_vegetal": 0.10, "lote_min_m2": 600, "testada_min_m": 20, "outorga_onerosa": False},
      obs="Zona industrial/serviços, não é para prédio residencial. Em loteamento misto com residencial de apoio: lote 200 m² e testada 10 m, mesmos CO/CP/CA (art. 53, parágrafo único)."),
 zona("SC-Z6E", "Zona 6E – Santa Eudóxia (expansão do distrito)", "art. 1º (cria o art. 42-A da Lei 18.053/2016)", "2018-12-11",
      0.70, 0.25, None, None, {"taxa_cobertura_vegetal": 0.15, "lote_min_m2": 200, "testada_min_m": 10, "outorga_onerosa": False}, conferido=False,
      lei=L6E, url="https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_754",
      obs="A Lei 18.927/2018 NÃO define coeficiente de aproveitamento para a 6E e não a incluiu nos arts. 150–154: CA = null. Perguntar à Prefeitura. O portal lista a data como 11/11/2018; o texto da lei diz 11/12/2018."),
 zona("SC-Z7", "Zona 7 – Proteção, Regulação e Ocupação Específica", "art. 57", D,
      0.25, 0.50, 0.25, 0.25, {"taxa_cobertura_vegetal": 0.50, "lote_min_m2": 1500, "testada_min_m": 20, "outorga_onerosa": False},
      obs="Zona de baixíssima densidade (manancial/ambiental). Não serve para prédio."),
 zona("SC-Z8A", "Zona 8A – Proteção e Ocupação Restrita do Monjolinho-Espraiado", "art. 61", D,
      0.25, 0.50, 0.25, 0.25, {"taxa_cobertura_vegetal": 0.50, "lote_min_m2": 1500, "testada_min_m": 20, "outorga_onerosa": False},
      obs="Fora do perímetro urbano; segue também a Lei 13.944/2006 (APREM, não conferida). Não serve para prédio."),
 zona("SC-Z8B", "Zona 8B – Proteção do Manancial do Ribeirão Feijão", "art. 65", D,
      0.25, 0.50, 0.25, 0.25, {"taxa_cobertura_vegetal": 0.50, "lote_min_m2": 3000, "testada_min_m": 20, "outorga_onerosa": False},
      obs="Fora do perímetro urbano. Não serve para prédio."),
]
with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as f:
    json.dump(z, f, ensure_ascii=False, indent=2)
    f.write("\n")
# conferência mínima do contrato
for r in json.load(open(sys.argv[1], encoding="utf-8")):
    p = r["parametros"]
    for k in ["ca_basico", "ca_maximo", "taxa_ocupacao", "taxa_permeabilidade", "recuo_frontal_m", "recuo_lateral_m",
              "recuo_fundos_m", "recuo_lateral_regra", "altura_max_m", "pavimentos_max"]:
        assert k in p, (r["id"], k)
    assert p["ca_basico"] is None or p["ca_basico"] <= p["ca_maximo"], r["id"]
    assert r["fontes"] and all(f["url"].startswith("https://") for f in r["fontes"])
print(len(z), "zonas ok")
