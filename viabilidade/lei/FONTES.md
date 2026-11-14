# Lei: fontes do zoneamento de São Carlos-SP

Levantado em 14/11/2026. Todos os textos foram lidos no portal oficial de leis da Prefeitura (`servico.saocarlos.sp.gov.br/consultaleis`).

O portal publica o texto **original, sem as alterações incorporadas**. Por isso cada lei que altera outra foi lida uma a uma. O próprio portal avisa que o texto "não substitui o publicado no Diário Oficial". Não confrontamos com o Diário Oficial.

`zonas.json` é gerado por `gera_zonas.py`: `python -I viabilidade/lei/gera_zonas.py viabilidade/lei/zonas.json`.

## Leis em vigor

| Lei | Data | O que é | Link |
|---|---|---|---|
| 18.053 | 19/12/2016 | **Plano Diretor**: zonas, CA, taxa de ocupação, permeabilidade, lote mínimo, outorga, áreas especiais. **Não existe lei de zoneamento separada.** | [portal](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) |
| 18.410 | 04/12/2017 | Altera o art. 160 (atividades incômodas). Não mexe em número construtivo. | portal |
| 18.927 | 11/12/2018 | Cria a **Zona 6E** (Santa Eudóxia), art. 42-A | [portal](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_754) |
| 19.165 | 06/06/2019 | Desdobro em loteamento registrado antes de 25/11/2005 segue a Lei 6.766 | portal |
| 19.166 | 10/06/2019 | Áreas industriais novas, com os coeficientes da Zona 3 | portal |
| 21.601 / 22.010 | 2023 | Áreas institucionais para habitação social. Sem número construtivo. | portal |
| 23.150 | 27/02/2025 | Reforma administrativa. Revoga só o art. 5º-VI do Plano Diretor. | portal |
| 19.950 | 15/12/2020 | **Código de Obras (COE)**: recuos, área não computável, vagas | [portal](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) |
| 20.072 | 06/04/2021 | COE: recuo de 1,50 m também no 1º pavimento; nova redação do art. 51-VI | [portal](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2987) |
| 22.285 | 08/03/2024 | COE: faixa de rodovia, ferrovia e linha de transmissão | [portal](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_4661) |
| 24.031 | 24/02/2026 | COE: varandas (art. 68), drenagem e piso permeável | [portal](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_7985) |

Não conferidos:
- Lei 13.944/2006 (APREM, mananciais), que rege as Zonas 5, 7 e 8.
- Decretos ligados ao Plano Diretor: 580/2019, 471/2024, 199/2025, 412/2025, 413/2025 e 792/2025. Os links no portal estão quebrados.

**Revisão do Plano Diretor:** começou em setembro de 2025, com audiências até dezembro de 2025. Em 12/11/2026 a Prefeitura disse que quer mandar o projeto à Câmara ainda este ano. **Ainda não há projeto de lei protocolado**, então vale a 18.053. Quando a revisão sair, refazer tudo.

**Armadilha:** no leismunicipais.com.br, quem procura "Plano Diretor São Carlos" encontra a lei de **São Carlos-SC**. Não usar.

## Regras que valem para todas as zonas (COE e Plano Diretor)

**Recuo frontal**
- Nem o Plano Diretor nem o COE definem recuo frontal geral. Vale o que estiver registrado no loteamento (COE art. 74).
- **No `zonas.json` ficou `null`.** Confirmar com a Prefeitura.

**Recuo lateral e de fundos**
- **Janela voltada para a divisa:**
  - térreo e 1º pavimento: 1,50 m;
  - demais pavimentos: **h/8, com mínimo de 2,00 m**, onde h é a altura até o teto do pavimento da janela;
  - o cálculo é feito pavimento a pavimento (art. 67).
- **Parede sem janela:** pode encostar na divisa até 12 m de altura. Acima de 12 m, 2,00 m (art. 70).
- **Varanda:** 1,50 m no 1º pavimento e h/8 (mínimo de 2,00 m) acima dele (art. 68, Lei 24.031/2026).
- **Entre blocos do mesmo lote:** 2,00 m entre janelas (art. 69).
- **Escalonar** o prédio é permitido (art. 71).
- **Altura da edificação:** do piso mais baixo até o forro mais alto, sem contar subsolo, caixa d'água e ático (art. 3º-IV).

**Altura**
- **Não há gabarito por zona.** O limite sai do CA, da taxa de ocupação e do h/8.
- Há duas exceções, as áreas especiais:
  - **Restrição de Gabarito** (dentro da Poligonal Histórica, no centro): 9 m acima do nível da via (PD art. 80; mapa no Anexo 06).
  - **Observatório da USP**: limite pela distância ao observatório (PD art. 82; Anexo 06). Se a cota do terreno for diferente da do observatório, a lei manda considerar a diferença.

    | Distância | Altura máxima | Andares |
    |---|---|---|
    | 50 m | 14,8 m | 5 |
    | 100 m | 23,6 m | 8 |
    | 150 m | 32,5 m | 11 |
    | 200 m | 41,3 m | 14 |
    | 250 m | 50,1 m | 17 |
    | 300 m | 58,9 m | 20 |
    | 500 m | 94,2 m | 31 |

- A área do aeroporto (Anexo 07, art. 107) tem restrições que **não foram conferidas**.
- As áreas especiais **não estão em `zonas.json`**: são camadas sobrepostas à zona (ver a proposta no fim).

**O que não entra na área computável (COE art. 51)**
- Também não conta para a taxa de ocupação nem para o cálculo de vagas.
- A lista:
  - garagem, com circulação e manobra;
  - reservatório, barrilete, casa de máquinas, abrigo de gás e cabine;
  - depósito de lixo;
  - escada e antecâmara de escada;
  - fosso de elevador e shafts (contam só no pavimento mais baixo);
  - antecâmara de elevador de emergência;
  - área técnica de ar-condicionado.
- Beiral e marquise de até 1,20 m não são área construída (art. 3º).
- O térreo comercial de prédio misto não conta no CA no Eixo Estruturante (PD art. 11; COE art. 52) e na fachada ativa (PD art. 141-IV).
- **Varanda não está na lista**, então conta como computável. É leitura nossa: confirmar.

**Vagas (COE art. 100, Tabela 1)**
- **Prédio residencial multifamiliar não tem mínimo de vagas de carro** (a tabela traz "–").
- Se o prédio tiver vagas:
  - 2% delas para pessoa com deficiência, com mínimo de 1;
  - 1 vaga de bicicleta a cada 20 vagas.
- Comércio com 100 m² ou mais de área computável: 1 vaga a cada 100 m².
- Tamanho da vaga de carro: 2,40 × 5,00 m. A faixa de manobra a 90° tem 5,00 m (Tabela 2).
- No `zonas.json`: `vagas_min_por_unidade: null`. Pelo contrato, o motor usa então a premissa `vagas_por_unidade`.

**Outorga onerosa (PD arts. 176 e 177)**
- Só no Eixo Estruturante e nas Zonas 1 e 2, do CA básico até o CA máximo.
- Valor: **5% do valor de mercado da área acima do CA básico**, pela Planta Genérica de Valores (Lei 13.692/2005).
- Habitação social em parceria com a Prefeitura pode ser isenta.

## Zonas: resumo do `zonas.json`

| id | CO | Permeável | CA básico → máximo | Prédio? |
|---|---|---|---|---|
| SC-EIXO (art. 13) | 70% | 15% | 2,0 → 4,0 (outorga) | **sim**, o mais denso |
| SC-Z1 (art. 17) | 70% | 15% | 2,0 → 3,0 (outorga; só com ≥50% residencial) | **sim** |
| SC-Z2 (art. 21) | 70% | 15% | 2,0 → 3,5 (outorga) | **sim** |
| SC-Z3, SC-Z4 (arts. 25, 29) | 70% | 15% | 1,4 único | baixo |
| SC-Z6A (art. 41) | 70% | 20% | 1,4 (2,0 em arterial tipo 1) | baixo |
| SC-Z6B (art. 45) | 50% | 40%* | 1,0 (2,0 em arterial tipo 1) | baixo |
| SC-Z6C, SC-Z6D | 70% | 20% | 1,0 | não |
| SC-Z5A/5B, Z6E, Z7, Z8A/8B | ver o arquivo | | ≤1,0 ou ausente | não |

\* Conflito: ver a lista abaixo.

## Ambiguidades

1. **Zona 6B, permeabilidade:** o art. 45 dá 40% e o art. 153-IX dá 30%. Usei 40%, o valor mais restritivo. `conferido: false`.
2. **Zonas 5A/5B:** o quadro dos arts. 36/38 varia com o tamanho do lote. Ele conflita com os arts. 150, 153 e 154 (permeabilidade de 20% e cobertura vegetal de 20%). Usei a coluna de lote maior que 300 m². `conferido: false`.
3. **Zona 6E:** a lei que criou a zona **não deu CA** a ela. `ca_basico` e `ca_maximo` ficaram `null`.
4. **Zona 1:** o CA máximo de 3,0 só vale com pelo menos 50% de área residencial multifamiliar (art. 152-II).
5. **"CA = 2,0 nos eixos viários arteriais tipo 1"** (Zonas 6A e 6B): quais vias são tipo 1 está no Anexo 08 (sistema viário), que **não foi conferido**. Ficou no campo extra `ca_eixo_arterial_tipo1`.
6. **Habitação social:** o lote mínimo é de 150 m² no Eixo e no art. 148, e de 160 m² nas zonas.
7. O texto do portal não foi confrontado com o Diário Oficial nem com o PDF escaneado.

## Mapa de zoneamento: **não existe vetor oficial da lei em vigor**

Não há shapefile, GeoJSON, KML nem WFS oficial do zoneamento de 2016. Procuramos no site da Prefeitura, no SigaSC, na Câmara, em dados abertos, no GitHub e em trabalhos da UFSCar e da USP. Achamos três fontes, cada uma com um problema.

| Pasta / fonte | O que é | Formato | Coordenadas | Problema |
|---|---|---|---|---|
| `mapa/lei18053_anexos_2017_pdf/` | Anexos 01 a 07 da Lei 18.053 (o Anexo 02 é o zoneamento urbano). Fonte: [página do Plano Diretor](https://www.saocarlos.sp.gov.br/index.php/habitacao-morar/166049-plano-diretor-estrategico.html) | PDF com uma imagem JPEG grande (8858×12746 px), escala 1:15.000 | SAD69 UTM 23S (EPSG:29183, impresso no mapa) | **É a lei em vigor**, mas é imagem. Precisa georreferenciar e vetorizar. |
| `mapa/lei18053_anexos_2017_pdf/ANEXO 02ABC` | Coordenadas UTM SAD69 de cada vértice do perímetro urbano, em texto | PDF de texto | SAD69 UTM 23S | Dá o perímetro exato e serve de pontos de controle para georreferenciar o Anexo 02 |
| `mapa/proposta_revisao_kml/` | KMLs de **proposta** da revisão de 2014/15 | KML vetorial | WGS84 | **Não é a lei.** Os nomes de zona são outros (ZC, ZOI, ZCO…). A zona fica no nome da pasta do KML, não há tabela de atributos. **Não usar para decidir zona.** |
| SigaSC, camada `zonas` (`saocarlos_mapa_legislacao.map`) | Zoneamento do **plano antigo** (Lei 13.691/2005) | PNG ou SVG pelo MapServer | SAD69 UTM 23S | **Desatualizada.** Vem só como desenho, não como dado. |

Como chegar a um vetor do zoneamento em vigor (não feito; GDAL não está instalado nesta máquina):

1. Tirar o JPEG do Anexo 02 (fluxo DCTDecode do PDF).
2. Georreferenciar com `gdal_translate -gcp ...`, usando os vértices do Anexo 02ABC em EPSG:29183. Depois rodar `gdalwarp -t_srs EPSG:31983`.
3. Vetorizar as cores das zonas com uma máscara por cor e `gdal_polygonize.py`. A legenda está no PDF.
4. **Para o piloto, o mais barato:** olhar no Anexo 02 em que zona caem os poucos lotes piloto e anotar `zona_id` à mão, com a página e o trecho como fonte. **Eixo Estruturante não precisa de mapa:** é o lote com frente para uma das vias do art. 11.

Para os KMLs, se alguém quiser só comparar: `ogrmerge.py -single -f GeoJSON -o saida.geojson 105_zoneamento_urbano_proposto.kml -src_layer_field_name zona -t_srs EPSG:31983 -nlt PROMOTE_TO_MULTI`, e depois descartar as linhas.

**Os PDFs ficam fora do git** (decisão de 14/11/2026; a pasta `lei/mapa/` inteira está no `viabilidade/.gitignore`). Para baixar de novo, salve cada um em `mapa/lei18053_anexos_2017_pdf/`. Todos os links responderam 200 em 14/11/2026. O sha256 abaixo traz só os 16 primeiros dígitos, para conferir se é o mesmo arquivo.

| Arquivo | sha256 (início) | Link oficial |
|---|---|---|
| ANEXO 01 - Macrozoneamento.pdf | 7ecf688bf4c978c9 | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2001%20-%20Macrozoneamento.pdf |
| ANEXO 02 - Zoneamento Urbano.pdf | f2dbbf98a0698092 | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf |
| ANEXO 02ABC - Descrições Perímetros.pdf | ed21eba28b9aa8f4 | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002ABC%20-%20Descri%C3%A7%C3%B5es%20Per%C3%ADmetros.pdf |
| ANEXO 03 - Zoneamento da macrozona urbana e das zonas passiveis de expansão.pdf | a77c5a64ce414335 | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2003%20-%20Zoneamento%20da%20macrozona%20urbana%20e%20das%20zonas%20passiveis%20de%20expans%C3%A3o.pdf |
| ANEXO 04 - Zoneamento rural.pdf | c7bd5c8361f6697d | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2004%20-%20Zoneamento%20rural.pdf |
| ANEXO 05 - AEIs Ambientais.pdf | af2d54f9694ea905 | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2005%20-%20AEIs%20Ambientais.pdf |
| ANEXO 06 - AEIs Urbanas.pdf | 3bfc5f7b8b79c501 | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2006%20-%20AEIs%20Urbanas.pdf |
| ANEXO 07 - AEIs Rurais.pdf | 3c290bd44a8e6b5a | https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2007%20-%20AEIs%20Rurais.pdf |

Os KMLs da proposta (cerca de 15 MB) também não foram commitados. Baixar de: `https://www.saocarlos.sp.gov.br/images/stories/plano_diretor/{101,103,104,105,106,31}.kml`.

## Proposta de mudança no contrato (não mexi no README)

1. **Áreas especiais sobrepostas à zona:** uma lista à parte, por exemplo `lei/areas_especiais.json`, com `id`, regra e mapa. O Lote ganharia `areas_especiais: [...]`. Hoje o gabarito de 9 m (centro histórico) e o limite do Observatório não cabem em "Zona".
2. **Campos extras em `parametros`** (o motor pode ignorar):
   - `ca_unifamiliar`
   - `ca_eixo_arterial_tipo1`
   - `ca_his`
   - `taxa_cobertura_vegetal`
   - `lote_min_m2`, `testada_min_m`
   - `outorga_onerosa`
   - `garagem_computavel`, `garagem_conta_na_taxa_ocupacao`, `nao_computavel`
   - `vagas_min_por_unidade`, `vagas_regra`
   - `vaga_largura_m`, `vaga_comprimento_m`, `faixa_manobra_90graus_m`
3. **Recuo por pavimento:** `recuo_lateral_m` fixo não descreve a regra h/8. Sugestão para o motor:

   ```
   recuo(h) = 1,5 se pavimento ≤ 1
            = max(2,0; h/8) acima disso
   recuo de parede cega = 0 até 12 m, depois 2,0
   ```
