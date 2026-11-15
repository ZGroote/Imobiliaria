# Leitura independente da lei (passo 1, às cegas)

Feita em 14/11/2026, sem abrir `viabilidade/lei/`. Fonte única: o portal oficial de leis da Prefeitura de São Carlos.

- Plano Diretor, Lei 18.053/2016: https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_2257
- Código de Obras (COE), Lei 19.950/2020: https://cidadao.saocarlos.sp.gov.br/servicos/consultaleis/index.php?acao=14&lei=1_2015
- Alterações abertas pelos links do próprio portal (botão de cada lei na página da lei principal).

**Aviso de honestidade:** antes desta leitura eu li o `viabilidade/README.md` (a tarefa manda ler). A seção "v3" dele já resume parte do trabalho da frente Lei (recuo frontal `null`, h/8 com mínimo 2,0 m, parede cega até 12 m, lista do art. 51). Não abri `zonas.json` nem `FONTES.md`, mas a leitura dos recuos não é 100% cega. Conferi cada um desses pontos de novo no texto da lei.

**Sobre o texto do portal:** a página mostra o texto ORIGINAL de cada lei, não o texto consolidado. As alterações aparecem só como links. Abri cada alteração e apliquei à mão:

| Lei alteradora | O que muda (só o que importa aqui) |
|---|---|
| 18.927/2018 | Cria o art. 42A no Plano Diretor: **Zona 6E** (Santa Eudóxia) |
| 18.410/2017, 19.165/2019, 19.166/2019, 22.010/2023 (revogou a 21.601/2023), 23.150/2025 | Nada de coeficiente, recuo ou altura (usos incômodos, desdobro, áreas industriais, áreas institucionais para HIS, estrutura administrativa) |
| 20.072/2021 | COE: art. 67, I (recuo de abertura vale também no 1º pavimento) e § 5º; art. 51, VI (antecâmara de elevador) |
| 21.147/2022 | COE: arts. 88, 115A, 116, 153A (nada de recuo, área ou vaga) |
| 22.285/2024 | COE: arts. 72, 72-A e 73 (faixas não edificáveis de rodovia, ferrovia e linha de energia) |
| 24.031/2026 | COE: art. 68 (varandas e sacadas) e arts. 78–88 (drenagem) |

Os anexos do Plano Diretor (01 a 12) são mapas e perímetros ("indicados cartograficamente no Anexo 02", "demarcada no Anexo 06"). **Os números por zona estão no corpo da lei**, nos artigos de cada zona (arts. 13, 17, 21, 36, 38, 41, 42A, 45) e repetidos nos arts. 150 a 154. Os decretos listados como "legislação relacionada" têm link quebrado no portal (`lei=1_`) e não foram lidos.

## 1. Tabela por zona

CO = taxa de ocupação; CP = permeabilidade mínima; CCV = cobertura vegetal mínima; CAB/CAM = coeficiente básico/máximo.

| Zona | CA básico | CA máximo | CO | CP | CCV | Fonte |
|---|---|---|---|---|---|---|
| Eixo Estruturante | 2,0 | 4,0 | 70% | 15% | não se aplica | PD art. 13, I–V; arts. 150, I; 152, I; 153, I; 154, I |
| Z1 Ocupação Consolidada | 2,0 | 3,0 (só se ≥ 50% da área computável for habitação multifamiliar) | 70% | 15% | não se aplica | PD art. 17, I–V e p. ú.; art. 152, II |
| Z2 Ocupação Induzida | 2,0 | 3,5 | 70% | 15% | não se aplica | PD art. 21, I–V; arts. 150, III; 152, III; 153, III |
| Z5A Monjolinho-Espraiado | 1,0 (1,4 para HIS) | não tem CAM | 50% no art. 150; **70% a 50% pelo tamanho do lote** no quadro do art. 36 | 20% no art. 153; **15% a 30% pelo lote** no quadro do art. 36 | 20% no art. 154; **10% (20% gleba)** no quadro do art. 36 | PD arts. 36, 150 VI, 152 VI, 153 VI, 154 II |
| Z5B Ribeirão do Feijão | 1,0 (1,4 para HIS) | não tem CAM | igual à Z5A (conflito igual) | igual à Z5A | igual à Z5A | PD arts. 38, 150 VII, 152 VII, 153 VII, 154 III |
| Z6B Média Densidade | 1,0; **2,0 nos eixos viários arteriais tipo 1** | não tem CAM | 50% | **40% no art. 45, 30% no art. 153** | 20% | PD arts. 45, 150 IX, 152 IX, 153 IX, 154 V |
| Z6E Santa Eudóxia | **a lei não define** | **a lei não define** | 70% | 25% | 15% | PD art. 42A (incluído pela Lei 18.927/2018) |

Em todas as zonas acima, CA = 1,4 vale só para residência unifamiliar (Eixo, Z1, Z2). Na Z6B o art. 150/152/153/154 diz que os índices valem "nos parcelamentos do solo para fins urbanos" e "antes dos parcelamentos ... não se aplica".

### Trechos literais

- Eixo, PD art. 13: "I – CO = 70% / II – CP = 15% / III – CA = 1,4 para uso residencial unifamiliar; / IV – CAB = 2,0 / V – CAM = 4,0".
- Z1, PD art. 17: "IV - CAB = 2,0 / V - CAM = 3,0". Parágrafo único: "Para os imóveis cujas edificações comportarem usos comerciais ou de serviços em mais de 50% (...) será válido apenas o CAB". Art. 152, II, b: "CAM: até 3,0 para empreendimentos que comportarem uso habitacional multifamiliar em ao menos 50% (cinquenta por cento) da área construída computável".
- Z2, PD art. 21: "IV – CAB = 2,0 / V – CAM = 3,5".
- Z5A, PD art. 36 (quadro da Lei 13.944, APREM), por área do lote 125 / 125,01–300 / >300 / gleba 500: "CO-Valores Máximos 70% / 70% a 50% / 50% / 50%", "CP-Valores Mínimos 15% / 15% a 30% / 30% / 30%", "CCV 10% / 10% / 10% / 20%", "CA 1/1,4 HIS* / 1,0/1,4 HIS* / 1,0/1,4 HIS* / 1,0". Art. 150, VI: "máximo de 50%". Art. 153, VI: "mínimo de 20% (vinte por cento)". Art. 154, II: "mínimo de 20% (vinte por cento)". Art. 152, VI: "até 1,0".
- Z5B, PD art. 38: mesmo quadro da Z5A. Arts. 150 VII, 152 VII, 153 VII, 154 III: mesmos números da Z5A.
- Z6B, PD art. 45: "I – CO = 50% / II – CP = 40% / III - CCV = 20% / IV – CA = 1,0 e CA = 2,0 nos eixos viários arteriais tipo 1". Art. 153, IX, a: "nos parcelamentos do solo para fins urbanos, mínimo de 30% (trinta por cento)".
- Z6E, PD art. 42A (Lei 18.927/2018, art. 1º): "I - CO = 70% / II - CP = 25% / III - CCV = 15% / IV - Lote Mínimo = 200m² e 160m² para HIS / V - Testada mínima = 10m e 8m para HIS". Não há linha de CA. O título do artigo diz "Zona 6E - Regulação e Ocupação Controlada de **Maior Densidade**" (mesmo nome da Z6A, cujo art. 41 dá "CA = 1,4 e CA = 2,0 nos eixos viários arteriais tipo 1"). A Z6E não aparece nos arts. 150 a 154.

## 2. Altura máxima

**Nenhuma das 7 zonas tem altura máxima ou número máximo de pavimentos na lei.** A altura sai do CA, do CO e dos recuos. Limites de altura existem só por área especial, por cima da zona:

- Subárea Especial de Restrição de Gabarito (dentro da Poligonal de Interesse Histórico), PD art. 80: "limitação do gabarito a 9m (nove metros) acima do nível da via pública nas novas construções ou ampliações".
- Área Especial de Influência no Observatório da USP (mapa no Anexo 06), PD art. 82: altura pela distância ao Observatório, "considerando-se as diferenças de cota de nível": 50 m → 14,8 m (5 andares); 100 → 23,6 (8); 150 → 32,5 (11); 200 → 41,3 (14); 250 → 50,1 (17); 300 → 58,9 (20); 500 → 94,2 (31). Parágrafo único: cota do Observatório = 850 m.
- Como a altura é medida, COE art. 3º, IV: "distância medida do piso do pavimento mais baixo até o forro do pavimento mais alto, descontando-se os subsolos, caixas d'água e áticos (sem permanência humana)".

## 3. Recuos (COE, vale para todas as zonas)

**Recuo frontal: nem o Plano Diretor nem o COE dão um número.** O COE só diz, art. 74: "Ficam resguardados os recuos obrigatórios dispostos nos contratos de loteamento e condomínios registrados no Cartório de Registro de Imóveis". Ou seja, o recuo frontal vem da restrição do loteamento de cada lote.

**Lateral e fundos.** O COE fala de "divisa" (art. 3º, XXV: "linha divisória que define os limites do lote com os lotes e/ou áreas públicas adjacentes"), então vale para laterais e fundos. A regra depende de a parede ter ou não janela:

| Caso | Recuo da divisa | Fonte e trecho |
|---|---|---|
| Parede **com abertura** (janela, porta, elemento vazado), paralela à divisa, no térreo e no 1º pavimento | 1,50 m | COE art. 67, I, redação da Lei 20.072/2021: "um metro e cinquenta centímetros no térreo e no primeiro pavimento quando paralelas ou ângulo menor que noventa graus" |
| Parede com abertura, demais pavimentos | h/8, mínimo 2,00 m | COE art. 67, II: "h/8, com mínimo de 2,00m (dois metros) nos demais pavimentos, incluindo mezaninos" |
| O que é h | altura até o teto do pavimento onde está a abertura | COE art. 67, § 2º: "Os recuos serão calculados separadamente por pavimento, adotando-se a altura até o teto onde se encontra a abertura" |
| Abertura perpendicular à divisa | 0,75 m | COE art. 67, III |
| Mezanino logo acima do térreo | conta como 1º pavimento | COE art. 67, § 5º (Lei 20.072/2021) |
| Varanda/sacada com face aberta para a divisa | 1,50 m no 1º pavimento; h/8 (mín. 2,00 m) acima; 0,75 m perpendicular | COE art. 68, redação da Lei 24.031/2026: "I – 1,50m (...) no primeiro pavimento (...); II – h/8, com mínimo de 2,00m (dois metros) nos demais pavimentos acima do primeiro" |
| Parede **sem abertura** (parede cega) | encosta na divisa até 12 m; **2,00 m fixo** acima de 12 m | COE art. 70: "Os recuos das edificações no trecho que não possuir abertura deverão prever distância mínima até a divisa de 2,00m (dois metros) a partir de 12,00m (doze metros) de altura" |
| Escalonar o prédio | permitido, pavimento a pavimento | COE art. 71: "Fica permitido o escalonamento da edificação de forma a atender o recuo mínimo para cada pavimento" |
| Entre janelas de unidades diferentes (e entre blocos no mesmo lote) | 2,00 m paralelas; 0,75 m perpendiculares | COE art. 69, I–II e § 2º |
| Escada e terraço descobertos junto à divisa | permitidos com parede cega de 2,00 m de altura | COE art. 76 |

Ponto que pesa no motor: **acima de 12 m, parede cega pede só 2,00 m; h/8 vale só para parede com janela.** Um prédio de 40 m com janelas na lateral precisa de 5,00 m no topo (40/8); com a lateral cega, 2,00 m.

**Faixas não edificáveis (por cima do lote):**
- Rodovia: 15 m da faixa de domínio, 21 m onde o Anexo 8 do PD prevê marginal (COE art. 72, Lei 22.285/2024).
- Ferrovia: a faixa da Lei federal 6.766/79, art. 4º, III-A (COE art. 72-A, Lei 22.285/2024).
- Linha de transmissão: lote a 35 m ou menos do eixo segue a faixa da concessionária (COE art. 73, Lei 22.285/2024).

## 4. O que não é computável

- COE art. 51 (não conta no CA, CAB, CAM, **CO** e no cálculo de vagas): "I - garagens e/ou estacionamento de veículos e suas respectivas faixas de circulação e manobra; II - reservatórios, barriletes, casas de máquinas, abrigos de gás e cabine primária; III - locais para acondicionamento de resíduos (...); IV - escada e sua antecâmara; V - fosso de elevador, dutos, 'shafts' e similares; VI - antecâmara de elevador de emergência prevista na NBR 9050 e IT nº 11 do Corpo de Bombeiros [redação da Lei 20.072/2021]; VII - locais sem ocupação humana a serem definidos pelo Poder Executivo Municipal; VIII - áreas técnicas para instalação de equipamentos de ar condicionado e ventilação". IX e X vetados.
- COE art. 51, § 1º: shaft coberto conta como área construída só no pavimento mais baixo.
- COE art. 52 + PD art. 11, parágrafo único (**só no Eixo Estruturante**): "os empreendimentos de uso misto de habitação com comércio ou serviços no térreo, terão estas áreas térreas consideradas não computáveis para o Coeficiente de Aproveitamento".
- PD art. 141, IV ("Fachadas Ativas" em condomínio): "a área construída como comércio/serviço será considerada não computável para o Coeficiente de Aproveitamento".
- **Varanda:** não está na lista. Pelo COE art. 3º, IX, "área construída" é "toda área coberta (...) com exceção do beiral e/ou marquise". Então varanda coberta conta.
- Beiral/marquise até 1,20 m não é área construída (COE art. 3º, XV).
- Atenção: o COE define CO como "projeção da área construída computável" (art. 3º, XXIII), então garagem e escada também saem da taxa de ocupação. O PD (art. 150) fala só em "área de projeção da edificação". Os dois juntos dão a leitura de que garagem não ocupa TO.

## 5. Vagas mínimas

COE art. 100: "A quantidade de vagas de veículos deverá obedecer aos mínimos estabelecidos na Tabela 1". Tabela 1:

| Tipologia | Automóveis | PNE | Bicicletas |
|---|---|---|---|
| Residencial unifamiliar | – | – | – |
| Residencial multifamiliar vertical | **– (sem mínimo)** | "2% do total de vagas projetadas, com mínimo de 1 vaga (quando existir vagas)" | "1 a cada 20 vagas de veículos projetadas" |
| Comércio/indústria ≥ 100 m² computáveis | "1 vaga a cada 100m², ou fração, de área computável" | 2%, mín. 1 | 1 a cada 20 |
| Polo Gerador de Tráfego | "A ser definido em Diretrizes ou pelo órgão competente" | 2%, mín. 1 | – |

O Plano Diretor (art. 210, V, empreendimentos de impacto) exige Estudo de Impacto de Vizinhança para "empreendimentos com guarda de veículos que comporte mais de 100 (cem) vagas". Não é mínimo de vaga, mas muda o processo.

## 6. Pontos que a lei deixa confusos

1. **Z5A e Z5B, CO/CP/CCV:** o artigo da zona (36/38) traz um quadro por tamanho de lote; os arts. 150, 153 e 154 dão um número só (CO 50%, CP 20%, CCV 20%). Para lote acima de 300 m² os dois dão CO 50%, mas CP 30% × 20%. Para lote menor, CO até 70% × 50%.
2. **Z6B, CP:** art. 45 diz 40%, art. 153 diz 30%.
3. **Z6E, CA:** a lei não traz CA nenhum. Não dá para dizer se vale o da Z6A (nome igual, "Maior Densidade") ou outro.
4. **Z6B e Z6E:** os índices dos arts. 150–154 valem "nos parcelamentos do solo para fins urbanos"; antes do parcelamento "não se aplica".
5. **"Eixo viário arterial tipo 1"** (Z6B: CA 2,0) não é definido nos artigos que li; depende do mapa do Anexo 8.
6. **Recuo frontal:** a lei municipal não fixa; vale o contrato do loteamento.
7. **Varanda no térreo:** a redação nova do art. 68 (Lei 24.031/2026) tirou "acima do térreo" e começa no "primeiro pavimento"; o térreo ficou sem regra própria de varanda.
