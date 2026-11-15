# Pacote de Conferência Técnica — Arquitetura e Urbanismo (São Carlos/SP)

**O que é este estudo (e o que NÃO é):** Este estudo é uma **triagem prévia e automática de potencial construtivo** (pré-viabilidade imobiliária) para terrenos em São Carlos/SP, calculando áreas máximas, recuos e pavimentos prováveis a partir da legislação municipal e de bases cartográficas públicas para apoiar decisões comerciais iniciais. **Ele NÃO é um projeto arquitetônico, NÃO substitui o levantamento planialtimétrico e cadastral em matrícula, e NÃO equivale a aprovação, alvará ou certidão oficial da Prefeitura Municipal de São Carlos.**

**Como usar este documento (meta: ~1 hora de reunião):** As perguntas abaixo concentram somente os pontos em que o texto da lei, os mapas disponíveis ou o cadastro dos 7 lotes piloto deixam dúvida técnica. Em cada item, já está registrado o que o sistema assume hoje, a fonte consultada (com links verificados ao vivo em **15/11/2026**) e as respostas possíveis. Ao final há uma seção com **Fontes inacessíveis** e uma **tabela-resposta em branco** para preenchimento na reunião.

---

## (a) Zona de cada lote piloto

> **Nota geral sobre a leitura de zonas nos 7 lotes piloto:** Nenhum dos 7 lotes foi obtido ainda do serviço vetorial da Prefeitura (o WFS do SigaSC está inacessível). Todas as zonas assumidas hoje têm `zona_origem = "anotada_a_mao"` e `zona_conferida = false`, tendo sido lidas por sobreposição visual da quadra/lote sobre o mapa raster do Anexo 02 (lidas em 14/11 com um ajuste de 5 vértices do perímetro que errava 40–100 m na cidade; reconferidas em 15/11 com a afim de 21 cruzamentos de rua, RMSE `2,9 m` e máx. `6,2 m` no Anexo 02, sem mudar nenhuma zona — ver `terreno/RELATORIO-16.md`, `17` e `18`) e conferência textual da lei.

### P01 — Zona cadastral oficial do lote `SC-completo-30516` (Jardim Pacaembu)
- **Identificação e leitura:** Loteamento Jardim Pacaembu, quadra `4263`, planta `000050` (base `planta`), área calculada `1.604,658 m²`, testada frontal inferida `23,50 m` (`5,31 m` do eixo viário), a oeste da Av. República do Líbano e próximo ao extremo oeste da Rua Sergipe. Leitura visual sobre o Anexo 02.
- **Assumido hoje:** `SC-Z4` (CA único `1,4`; TO `70%`; permeabilidade mínima `15%`; lote mínimo `200 m²`; testada mínima `10 m`).
- **Fonte:** Lei Municipal nº 18.053/2016 (Plano Diretor), art. 29 e art. 152-V ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); `viabilidade/terreno/lotes-piloto.json`.
- **Por que há dúvida:** A leitura veio de PDF raster sem divisas de lote (posição pela afim de 21 cruzamentos: RMSE `2,9 m`, máx. `6,2 m`; reconferido em 15/11, segue `Z4`, sem divisa de zona a 250 m) e sem camada vetorial oficial do SigaSC; além disso, o lote sobrepõe área de AIA (ver P21).
- **Respostas possíveis:** Sim, é `SC-Z4` / Não, é outra zona (especificar qual) / Depende de certidão oficial da Prefeitura.

### P02 — Zona cadastral oficial do lote `SC-completo-37607` (C.E.A.T. Dr. Emílio Fehr)
- **Identificação e leitura:** Loteamento C.E.A.T. Dr. Emílio Fehr, quadra `4817`, planta `000189` (base `planta`), área calculada `2.684,942 m²`, testada frontal inferida `29,79 m` (`5,52 m` do eixo viário), ao sul da SP-215 (referências: Rua Dr. José Paulo Spallini e Rua Aldo Gemano Klein). Leitura visual sobre o Anexo 02.
- **Assumido hoje:** `SC-Z4` (CA único `1,4`; TO `70%`; permeabilidade mínima `15%`).
- **Fonte:** Lei Municipal nº 18.053/2016, art. 29, art. 152-V e arts. 84–86 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); [ANEXO 06 - AEIs Urbanas.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2006%20-%20AEIs%20Urbanas.pdf) (testado em 15/11: abre); `viabilidade/terreno/lotes-piloto.json`.
- **Por que há dúvida:** Além da leitura por PDF raster sem vetor cadastral, o terreno incide na AEI Industrial e de Serviços nº 42 (CEAT), o que altera usos admitidos e pode implicar regras próprias do distrito (ver P22).
- **Respostas possíveis:** Sim, a zona-base é `SC-Z4` (com restrições da AEI 42) / Não, segue enquadramento ou parâmetros próprios de AEI/loteamento (especificar) / Depende de diretriz da Prefeitura.

### P03 — Zona (`SC-Z1` vs `SC-EIXO`) e frente oficial do lote `SC-completo-22426` (Jardim São Carlos)
- **Identificação e leitura:** Loteamento Jardim São Carlos, quadra `2757`, planta `000014` (base `planta`), área calculada `601,815 m²`, entre a Av. Comendador Alfredo Maffei e a Rua Conde do Pinhal. A malha detectou 4 arestas candidatas a frente (principal leste `23,46 m`, candidata norte `9,27 m` a `2,63 m` do asfalto, com sobreposição geométrica de `1,779 m²` com o eixo viário).
- **Assumido hoje:** `SC-Z1` (CAB `2,0`; CAM `3,0`; TO `70%`; permeabilidade `15%`), com alternativa `SC-EIXO` (CAB `2,0`; CAM `4,0`) anotada como dúvida.
- **Fonte:** Lei Municipal nº 18.053/2016, art. 11, inciso III (Av. Comendador Alfredo Maffei no trecho citado), art. 13 e art. 17 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); `viabilidade/terreno/dados/anotacao-eixo.json`.
- **Por que há dúvida:** Se o lote tiver testada cadastral/matrícula voltada para a Av. Comendador Alfredo Maffei nesse trecho, o enquadramento passa para **Eixo Estruturante (`SC-EIXO`, CAM `4,0`)** em vez de `SC-Z1` (CAM `3,0`). Também não está claro se o lote faz esquina oficial ou tem apenas uma frente.
- **Respostas possíveis:** Sim, é `SC-Z1` (sem testada na Alfredo Maffei) / Não, tem testada na Alfredo Maffei e é `SC-EIXO` / Outro enquadramento ou condição de testada/esquina (especificar).

### P04 — Zona na divisa `SC-Z1` / `SC-Z2` do lote `SC-completo-22421` (Jardim São Carlos)
- **Identificação e leitura:** Loteamento Jardim São Carlos, quadra `2757`, planta `000014` (base `planta`), área calculada `651,571 m²`, testada sul inferida `15,32 m` (`4,61 m` do eixo viário), junto à Rua Conde do Pinhal. Marcado com `zona_ambigua = true`.
- **Assumido hoje:** `SC-Z1` (CAB `2,0`; CAM `3,0`; TO `70%`), com alternativa `SC-Z2` (CAB `2,0`; CAM `3,5`; TO `70%`).
- **Fonte:** Lei Municipal nº 18.053/2016, arts. 17, 21 e 152 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); `viabilidade/terreno/dados/anotacao-z2.json` e `viabilidade/terreno/ZONAS.md`.
- **Por que há dúvida:** Na leitura de 14/11 (ajuste antigo, erro real 40–100 m) a borda oeste ficava a ~1 m do traço divisório entre `Z1` e `Z2`. Reconferido em 15/11 com a afim de 21 cruzamentos (RMSE `2,9 m`, máx. `6,2 m`), o lote fica todo na `Z1`, a ~45 m da mancha `Z2`, e a ~3 m do traço de Eixo da Av. Com. Alfredo Maffei (a frente é para a Rua Conde do Pinhal); a dúvida Z1/Z2 ficou fraca, mas segue sem divisa cadastral. A diferença muda o CAM de `3,0` para `3,5` (e na `Z1` exige ≥50% residencial multifamiliar para passar do CAB `2,0`).
- **Respostas possíveis:** Sim, é `SC-Z1` / Não, é `SC-Z2` / Há trecho em duas zonas (qual critério de prevalência a Prefeitura usa?).

### P05 — Zona e condição de esquina do lote `SC-completo-25297` (Vila Monteiro Gleba I)
- **Identificação e leitura:** Loteamento Vila Monteiro Gleba I, quadra `3377`, planta `000047` (base `planta`), área calculada `326,676 m²`, entre as ruas Silvério Ignarra Sobrinho e Raimundo Corrêa (próximo à Rua Amadeu Amaral). A malha indica esquina com duas frentes candidatas (`29,05 m` e `9,06 m`), a ~1 quadra ao norte da divisa com `Z3` e ~2 quadras ao sul da Poligonal Histórica.
- **Assumido hoje:** `SC-Z1` (CAB `2,0`; CAM `3,0`; TO `70%`; permeabilidade `15%`), com apenas 1 frente considerada pelo motor.
- **Fonte:** Lei Municipal nº 18.053/2016, art. 17 e art. 152-II ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); `viabilidade/terreno/lotes-piloto.json`.
- **Por que há dúvida:** Confirmar que a quadra `3377` é integralmente `SC-Z1` e confirmar se o lote de `326,68 m²` possui oficialmente duas testadas de esquina — o que pode exigir duplo recuo frontal (ver P18) e impacta fortemente a implantação num lote pequeno.
- **Respostas possíveis:** Sim, é `SC-Z1` de esquina (duas testadas) / Sim, é `SC-Z1` de meio de quadra (uma testada) / Outra zona ou condição (especificar).

### P06 — Zona (`SC-EIXO` vs `SC-Z2`) e viabilidade cadastral do remembramento `SC-completo-q1382-11984-11988` (Morada dos Deuses)
- **Identificação e leitura:** Loteamento Morada dos Deuses, quadra `1382`, planta `000141`, formado por remembramento geométrico de 5 parcelas `planta_refeita` (índices `11984` a `11988`), área calculada `1.599,108 m²`, frente norte registrada `16,77 m` (borda fragmentada a `4,40 m` do eixo viário). Fundo do mapa em `Z2`, faixa da Av. Miguel Petroni / Rua Miguel João (entre Av. Bruno Ruggieiro Filho e Av. Francisco Pereira Lopes).
- **Assumido hoje:** `SC-EIXO` (CAB `2,0`; CAM `4,0`; TO `70%`; permeabilidade `15%`).
- **Fonte:** Lei Municipal nº 18.053/2016, art. 11, inciso I e art. 13 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); `viabilidade/terreno/dados/anotacao-eixo.json` e `viabilidade/terreno/LOTES.md`.
- **Por que há dúvida:** Confirmar (1) se a testada cadastral desse bloco dá frente para o trecho oficial do Eixo Estruturante na Miguel Petroni / Miguel João (diferença entre `SC-EIXO` CAM `4,0` e `SC-Z2` CAM `3,5`), e (2) se as 5 parcelas (`planta_refeita`) correspondem a lotes remembráveis em matrícula sem exigência de diretriz prévia e qual a testada frontal real.
- **Respostas possíveis:** Sim, é `SC-EIXO` e remembrável / Não, é `SC-Z2` / Remembramento tem impedimento ou exige diretriz (especificar).

### P07 — Zona (`SC-Z2`), origem sintética e testada de `8,39 m` do remembramento `SC-completo-remembramento-75352-75354` (Quadra 2725)
- **Identificação e leitura:** Quadra `2725` (`loteamento` vazio nas propriedades; entre as ruas Major José Inácio e Conde do Pinhal, a oeste da Rua Dona Maria Izabel de Oliveira Botelho), remembramento geométrico de 3 parcelas de origem `sintetico` (índices `75352`–`75354`, LIDs `61162`–`61164`), área calculada `1.607,776 m²`, frente leste registrada de apenas `8,39 m` (`1,87 m` do asfalto), ~213 m a leste da divisa `Z1`/`Z2`.
- **Assumido hoje:** `SC-Z2` (CAB `2,0`; CAM `3,5`; TO `70%`; permeabilidade `15%`; testada mínima exigida na zona `10 m`).
- **Fonte:** Lei Municipal nº 18.053/2016, art. 21 e art. 152-III ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 02 - Zoneamento Urbano.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf) (testado em 15/11: abre); `viabilidade/terreno/lotes-piloto.json` e `viabilidade/terreno/LOTES.md`.
- **Por que há dúvida:** (1) As 3 parcelas têm origem `sintetico` (fechamento geométrico de maquete, não planta aprovada), sendo necessário confirmar se existem como matrículas unificáveis; (2) a frente lida na malha é `8,39 m`, **abaixo da testada mínima de `10 m` da Z2** — podendo ser recorte incompleto da malha ou restrição real de formato/acesso.
- **Respostas possíveis:** Sim, é `SC-Z2` e a testada real atende `>= 10 m` / É `SC-Z2`, mas tem testada insuficiente ou formato irregular / Parcelas sintéticas não correspondem a lotes unificáveis (especificar).

---

## (b) Parâmetros duvidosos por zona

### P08 — Parâmetros de `SC-Z5A` e `SC-Z5B` (conflito interno do PD e Lei APREM)
- **Assumido hoje:** `SC-Z5A` e `SC-Z5B` estão com `conferido: false` em `viabilidade/lei/zonas.json`. Usando a coluna de lotes `> 300 m²` e o **valor mais restritivo** de cada conflito, o sistema assume hoje: `CA = 1,0` (`1,4` para HIS), `TO = 50%`, `CP = 30%`, `CCV = 20%`, testada mínima sem exigência (`null`).
- **Fonte:** Lei nº 18.053/2016, arts. 36 e 38 (quadro) vs arts. 150, 153 e 154 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); `viabilidade/lei/FONTES.md` (que registra a **Lei nº 13.944/2006 — APREM** como não conferida, sem link direto); `viabilidade/lei/zonas.json`.
- **Por que há dúvida:** O quadro dos arts. 36/38 (variação por faixa de área `<=125 m²`, `125–300 m²` e `>300 m²`, com `CP 30%` e `CCV 10%`) conflita com os arts. 153 (`CP 20%`) e 154 (`CCV 20%`), e remete à Lei APREM (`13.944/2006`).
- **Respostas possíveis:** Vale o quadro dos arts. 36 e 38 do PD 18.053/2016 / Prevalecem os arts. 150, 153 e 154 ou a Lei 13.944/2006 (APREM) (informar qual tabela está vigente por porte de lote/gleba) / Manter provisoriamente a combinação mais restritiva.

### P09 — Permeabilidade da `SC-Z6B`, regra de pré-parcelamento e vias "arterial tipo 1" (`Z6A` e `Z6B`)
- **Assumido hoje:** `SC-Z6B` está com `conferido: false` em `viabilidade/lei/zonas.json`, assumindo o valor mais restritivo no conflito de permeabilidade: `CA = 1,0` (`2,0` em eixo arterial tipo 1), `TO = 50%`, `CP = 40%` (entre `40%` do art. 45 e `30%` do art. 153-IX), `CCV = 20%`, lote mínimo `250 m²`, testada `10 m` (e em `SC-Z6A`, art. 41: `CA = 1,4` / `2,0` em arterial tipo 1, `TO = 70%`, `CP = 20%`, `CCV = 10%`, `conferido: true`).
- **Fonte:** Lei nº 18.053/2016, arts. 41, 45, 150, 152, 153-IX e 154 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); `viabilidade/lei/FONTES.md` (nota sobre Anexo 08 — sistema viário, não conferido) e `viabilidade/conferencia/CONFERENCIA.md`.
- **Por que há dúvida:** (1) Na `Z6B`, o art. 45 exige `CP 40%` enquanto o art. 153-IX dá `CP 30%` — qual prevalece? (2) Como zonas de expansão (`Z6A`/`Z6B`), os índices só valem após parcelamento urbano (arts. 150, 152, 153-IX, 154): prédio em lote já aprovado ou gleba exige diretriz prévia? (3) Tanto `Z6A` quanto `Z6B` elevam o CA para `2,0` nos **"eixos viários arteriais tipo 1"**, lista que depende do **Anexo 08 (sistema viário)** ainda não conferido.
- **Respostas possíveis:** Em `Z6B` vale `CP 40%` (ou `30%`) / Esclarecer exigência de diretriz prévia em `Z6B` para lote já parcelado vs gleba / Informar onde obter a lista oficial das vias "arterial tipo 1" (Anexo 08).

### P10 — Coeficiente de aproveitamento e regras da `SC-Z6E` (`Lei 18.927/2018`)
- **Assumido hoje:** `SC-Z6E` está com `conferido: false` em `viabilidade/lei/zonas.json`, com `TO = 70%`, `CP = 25%`, `CCV = 15%`, lote mínimo `200 m²`, testada `10 m` e **`ca_basico = null` / `ca_maximo = null`**.
- **Fonte:** Lei Municipal nº 18.927/2018, art. 1º (cria art. 42-A na Lei 18.053/2016) ([portal `consultaleis` (`1_754`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_754) — testado em 15/11: abre); Lei nº 18.053/2016 ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); `viabilidade/lei/FONTES.md` e `viabilidade/lei/zonas.json`.
- **Por que há dúvida:** A Lei nº 18.927/2018 (Santa Eudóxia) fixa `TO 70%`, `CP 25%` e `CCV 15%`, mas **não define CA** para a `Z6E` e não a incluiu nos arts. 150–154 do Plano Diretor (além de o portal trazer data `11/11/2018` e o texto trazer `11/12/2018`).
- **Respostas possíveis:** A Prefeitura aplica por analogia o CA de `Z6C`/`Z6D` (`1,0`) ou `Z6A` (`1,4`) (informar qual) / Há tabela publicada em Diário Oficial ou decreto definindo o CA da `Z6E` / Sem prédio vertical nessa zona.

### P11 — Regra de "≥ 50% de área residencial multifamiliar" para atingir CAM `3,0` na `SC-Z1`
- **Assumido hoje:** O sistema aplica `CAB = 2,0` e `CAM = 3,0` em `SC-Z1`, registrando nas observações de `zonas.json` que o CAM `3,0` vale apenas com pelo menos `50%` da área computável residencial multifamiliar (art. 152-II-b) e que, se mais de `50%` for comércio/serviço, vale apenas o CAB `2,0` (art. 17, parágrafo único). O motor hoje assume CAM `3,0` sem conferir a proporção em edifícios mistos.
- **Fonte:** Lei nº 18.053/2016, art. 17, parágrafo único e art. 152-II-b ([portal `consultaleis` (`1_2257`)](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); `viabilidade/lei/zonas.json` e `viabilidade/conferencia/CONFERENCIA.md`.
- **Por que há dúvida:** Na prática de aprovação de prédios mistos (lojas no térreo + torre residencial acima), os `50%` são medidos estritamente sobre a área computável de projeto? Em `Z1`, térreo comercial sem fachada ativa conta normalmente no cálculo desse percentual?
- **Respostas possíveis:** Mede-se sobre a área computável total (>= 50% residencial libera CAM 3,0; senão fica no CAB 2,0) / Outro critério usado pela Prefeitura na conferência.

### P12 — Vigência atual do Plano Diretor (18.053/2016) e das demais zonas marcadas como conferidas
- **Assumido hoje:** 11 zonas (`SC-EIXO`, `SC-Z1`, `SC-Z2`, `SC-Z3`, `SC-Z4`, `SC-Z6A`, `SC-Z6C`, `SC-Z6D`, `SC-Z7`, `SC-Z8A`, `SC-Z8B`) estão com `conferido: true` em `viabilidade/lei/zonas.json`, mantendo os valores da Lei nº 18.053/2016 (visto que a revisão do PD iniciada em 2025 ainda não tinha projeto protocolado até 12/11/2026, segundo `FONTES.md`).
- **Fonte:** Lei nº 18.053/2016 ([`1_2257`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); Lei nº 18.927/2018 ([`1_754`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_754) — testado em 15/11: abre); [página oficial do Plano Diretor](https://www.saocarlos.sp.gov.br/index.php/habitacao-morar/166049-plano-diretor-estrategico.html) (testado em 15/11: abre); `viabilidade/lei/FONTES.md`.
- **Por que há dúvida:** O portal `consultaleis` publica o texto **original sem consolidação** e avisa que não substitui o Diário Oficial. É preciso confirmar se alguma outra lei ou norma municipal alterou os índices de `EIXO`, `Z1`, `Z2`, `Z3`, `Z4` ou `Z6–Z8` desde 2016 além das listadas em `FONTES.md`.
- **Respostas possíveis:** Sim, os índices atuais da `18.053/2016` seguem vigentes nessas zonas / Não, houve lei específica alterando índices (informar número e mudança).

---

## (c) Regras de recuo (`h/8`), pavimentos, áreas computáveis, permeabilidade e COE

### P13 — Contagem de pavimentos (`ate_pavimento: 2`), cálculo de `h/8`, escalonamento e mezanino (`COE art. 67`)
- **Assumido hoje:** `zonas.json` e `motor/motor.py` (v0.8.0) já estão alinhados com `ate_pavimento = 2` (térreo = pavimento 1 e 1º pavimento = pavimento 2 com recuo `1,50 m`, corrigindo divergência anterior anotada na conferência) e `max(2,00 m; h/8)` a partir do pavimento seguinte, aplicado de forma uniforme em toda a torre no cálculo do motor (com pé-direito assumido de `3,00 m`), embora o texto legal (art. 71) permita escalonamento pavimento a pavimento e o art. 3º-IV defina altura até o forro mais alto (sem contar subsolo, caixa d'água e ático).
- **Fonte:** Lei nº 19.950/2020 (COE), arts. 3º-IV, 67 e 71 ([`1_2015`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) — testado em 15/11: abre); Lei nº 20.072/2021, arts. 10 e 11 ([`1_2987`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2987) — testado em 15/11: abre); Lei nº 22.285/2024 ([`1_4661`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_4661) — testado em 15/11: abre); `viabilidade/lei/FONTES.md` e `viabilidade/motor/motor.py`.
- **Por que há dúvida:** Confirmar na prática da aprovação: (1) a altura `h` é medida do piso do térreo até o teto/forro do último pavimento habitável (sem contar caixa d'água/ático/barrilete) exatamente como diz o art. 3º-IV? (2) é comum aprovar prédio escalonando o recuo por andar (`1,50 m` nos 2 primeiros e `h/8` subindo acima), ou o mercado usa recuo uniforme? (3) um mezanino (§ 5º) conta como o "1º pavimento" para o recuo de `1,50 m`? (4) há alguma regra transitória de vigência para a `Lei 22.285/2024`?
- **Respostas possíveis:** Sim, leitura atual (`térreo + 1º pav = 1,50 m`; acima `max(2,00; h/8)` até o forro do último pavimento útil) está correta / Há diferença na medição de `h`, uso de mezanino ou escalonamento (detalhar).

### P14 — Áreas não computáveis no CA e na TO: garagem e varanda (`COE art. 51`)
- **Assumido hoje:** `zonas.json` marca `garagem_computavel = False` e `garagem_conta_na_taxa_ocupacao = False` (com base no art. 51, caput e inciso I, que inclui circulação e manobra); o motor (`motor/motor.py`) não computa subsolo no CA (limitado a `(1 - permeabilidade) × área do lote`), mas não modela garagem no térreo/embasamento. Já **varanda não consta na lista do art. 51**, então `FONTES.md` interpreta provisoriamente que **varanda conta no CA** (e o motor trata 100% do pavimento tipo como computável).
- **Fonte:** Lei nº 19.950/2020 (COE), arts. 51 e 52 ([`1_2015`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) — testado em 15/11: abre); Lei nº 18.053/2016 ([`1_2257`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); `viabilidade/lei/FONTES.md` e `viabilidade/motor/motor.py`.
- **Por que há dúvida:** Na aprovação real na Prefeitura: (1) garagem coberta **fora do subsolo** (no térreo ou em pavimentos de embasamento) também é 100% isenta do CA e da TO sem limite de área? (2) **varandas/sacadas** são sempre 100% computáveis no CA e na TO, ou há tolerância/isenção prática?
- **Respostas possíveis:** Sim: toda garagem (subsolo ou embasamento) é não computável no CA e na TO, e varanda é 100% computável / Apenas subsolo (ou até certo limite) é isento da TO ou do CA / Varandas têm isenção parcial (informar artigo e percentual).

### P15 — Recuo de varanda no térreo na redação atual (`COE art. 68`, `Lei 24.031/2026`)
- **Assumido hoje:** O sistema registra `1,50 m` no 1º pavimento e `h/8` (mín. `2,00 m`) acima para varanda (art. 68 na `Lei 24.031/2026`), e o motor não modela varandas separadas do corpo da torre.
- **Fonte:** Lei nº 24.031/2026, art. 2º/art. 10 ([`1_7985`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_7985) — testado em 15/11: abre); Lei nº 19.950/2020, art. 68 ([`1_2015`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) — testado em 15/11: abre); `viabilidade/conferencia/CONFERENCIA.md`.
- **Por que há dúvida:** A redação dada pela `Lei 24.031/2026` (vigente desde `24/02/2026`) especifica recuo de varanda a partir do **1º pavimento**, omitindo regra expressa para varanda no **pavimento térreo** (que existia na redação anterior). Como a Prefeitura analisa varandas ou terraços térreos junto às divisas hoje?
- **Respostas possíveis:** Varanda térrea aberta segue recuo geral de `1,50 m` / Pode encostar se for descoberta ou com muro/parede cega sem abertura para o vizinho / Outro critério (especificar).

### P16 — Permeabilidade mínima, piso permeável e reservatório de drenagem (`Lei 24.031/2026`)
- **Assumido hoje:** O motor aplica apenas o percentual bruto de permeabilidade da zona (`15%` em `Z1/Z2/Z4/EIXO`, até `50%` em `Z7/Z8`), restringindo subsolo e térreo a `(1 - permeabilidade) × área do lote`, **sem distinguir solo natural de piso drenante** e **sem reservar área/volume para reservatório de drenagem**.
- **Fonte:** Lei nº 24.031/2026 — altera arts. 78, 80, 84, 85, 86 e 88 do COE ([`1_7985`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_7985) — testado em 15/11: abre); `viabilidade/conferencia/leitura-independente.md` e `viabilidade/motor/motor.py`.
- **Por que há dúvida:** Pela `Lei 24.031/2026`, piso permeável exige conformidade com ABNT NBR 16.416/2015 e especificação/laudo técnico (piso de concreto comum conta apenas `10%`), e passou a ser exigido reservatório de drenagem (salvo lotes `<= 500 m²` com taxa de impermeabilização `< 50%` fora dos casos do art. 88). Na prática, isso costuma exigir mais solo livre ou reduzir o aproveitamento de subsolo na triagem?
- **Respostas possíveis:** Para triagem inicial basta manter o `CP` bruto da zona / Convém reservar margem extra de solo livre ou espaço para reservatório de drenagem (informar ordem de grandeza, inclusive para lote pequeno como o `25297` de `326,68 m²`).

### P17 — Parede cega na divisa / encosta (`COE art. 70`)
- **Assumido hoje:** `zonas.json` registra que parede sem abertura pode encostar na divisa até `12 m` de altura e recua `2,00 m` acima de `12 m` (art. 70). O motor hoje permite encostar pavimento nas laterais/fundos até `12 m` apenas na opção D (embasamento comercial/garagem), sem limitar extensão na divisa.
- **Fonte:** Lei nº 19.950/2020 (COE), art. 70 ([`1_2015`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) — testado em 15/11: abre); `viabilidade/lei/zonas.json` e `viabilidade/motor/motor.py`.
- **Por que há dúvida:** Confirmar se a regra do art. 70 ("encosta até `12 m`, depois `2,00 m`") se aplica **igualmente a edifícios residenciais multifamiliares** (inclusive em lotes pequenos como o `25297`) ou se sofre restrição de extensão máxima na divisa / uso apenas comercial e garagem.
- **Respostas possíveis:** Sim, pode encostar parede cega nas divisas até `12 m` em residencial multifamiliar e comercial / Só vale para garagem, comércio ou com limite de extensão na divisa (especificar regra do art. 70).

### P18 — Recuo frontal (`COE art. 74`), lotes de esquina e faixas não edificáveis (`COE arts. 72, 72-A e 73`)
- **Assumido hoje:** `zonas.json` traz `recuo_frontal_m = null` (porque o COE art. 74 remete ao registro de cada loteamento); provisoriamente o motor aplica `4,0 m` fixo em **uma única frente**, ignora segunda frente de esquina (`25297` e eventual `22426`) e não subtrai faixas não edificáveis.
- **Fonte:** Lei nº 19.950/2020 (COE), art. 74 ([`1_2015`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) — testado em 15/11: abre); Lei nº 22.285/2024, arts. 1º a 3º — nova redação dos arts. 72, 72-A e 73 ([`1_4661`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_4661) — testado em 15/11: abre); `viabilidade/lei/FONTES.md` e `viabilidade/motor/motor.py`.
- **Por que há dúvida:** (1) Na falta de consulta lote a lote em cartório, usar `4,0 m` de recuo frontal padrão é razoável para São Carlos ou qual é o padrão mais comum nos bairros dos pilotos? (2) Em lote de esquina (`25297` e eventual `22426`), aplica-se o mesmo recuo nas duas frentes ou reduzido na secundária? (3) No lote `37607` (próximo à SP-215), incide a faixa de rodovia do art. 72 (`15 m` ou `21 m` com marginal), e em `22426`/`22421`/`30516` há faixas de galerias/córregos além das listadas nos arts. 72–73?
- **Respostas possíveis:** Confirmar premissa de recuo frontal (`4,0 m` ou outro valor típico) e regra de esquina / Informar incidência prática das faixas dos arts. 72, 72-A e 73 nos lotes piloto.

### P19 — Ambientes "sem ocupação humana" (`COE art. 51, inciso VII`) — decreto não localizado
- **Assumido hoje:** `zonas.json` registra que o art. 51-VII depende de decreto regulamentador do Poder Executivo (ainda não localizado) e o motor não modela compartimentos internos.
- **Fonte:** Lei nº 19.950/2020, art. 51, inciso VII ([`1_2015`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015) — testado em 15/11: abre); Lei nº 22.285/2024 ([`1_4661`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_4661) — testado em 15/11: abre); `viabilidade/lei/zonas.json` e `viabilidade/conferencia/CONFERENCIA.md`.
- **Por que há dúvida:** A lei remete a lista de "locais sem ocupação humana" a decreto municipal que não foi localizado na pesquisa do projeto. Quais compartimentos técnicos a Prefeitura aceita como não computáveis sob esse inciso hoje?
- **Respostas possíveis:** Existe decreto municipal vigente definindo esse rol (informar número) / Não há decreto publicado e a Prefeitura adota lista técnica padrão (especificar) / Irrelevante para esta etapa de triagem volumétrica.

---

## (d) Áreas especiais e restrições específicas dos lotes piloto

### P20 — Gabarito aeronáutico / DECEA (`Anexo 07`) nos lotes `22426`, `22421`, `q1382`, `25297` e `75352-75354`
- **Assumido hoje:** O motor **não impõe teto numérico de altura aeronáutica** (`areas_especiais` textuais não limitam pavimentos no cálculo).
- **Fonte:** Lei nº 18.053/2016, arts. 105–107 ([`1_2257`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 07 - AEIs Rurais.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2007%20-%20AEIs%20Rurais.pdf) (testado em 15/11: abre — contém o tracejado roxo da superfície de aproximação e decolagem do Aeroporto Mário Pereira Lopes); `viabilidade/terreno/lotes-piloto.json` e `viabilidade/terreno/RELEVO.md`.
- **Por que há dúvida:** Os lotes `22426` e `22421` (Jardim São Carlos) caem dentro do tracejado roxo no Anexo 07; `q1382-11984-11988` (Morada dos Deuses) também cruza essa área; e `25297` / `75352-75354` ficam próximos à borda. Como o Anexo 07 é PDF raster sem cota numérica local (e o relevo atual do estudo tem resolução ~30 m), não sabemos quantos metros/pavimentos o COMAER/DECEA permite de fato em cada setor.
- **Respostas possíveis:** O teto aeronáutico típico desses bairros comporta torres altas sem travar o CA / Há limite baixo conhecido em algum setor (qual faixa de gabarito?) / Exige consulta prévia obrigatória ao DECEA caso a caso antes de ofertar viabilidade.

### P21 — AIA (`Córrego da Água Quente` e `Córrego do Gregório`), APP/inundação e proximidade da `AEIS 21`
- **Assumido hoje:** O motor calcula TO e CA sobre `100%` da área do lote, sem descontar APP, AIA, faixa de inundação ou AEIS.
- **Fonte:** Lei nº 18.053/2016, arts. 73 e 74-IV ([`1_2257`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 05 - AEIs Ambientais.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2005%20-%20AEIs%20Ambientais.pdf) (testado em 15/11: abre); [ANEXO 06 - AEIs Urbanas.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2006%20-%20AEIs%20Urbanas.pdf) (testado em 15/11: abre); `viabilidade/terreno/lotes-piloto.json`.
- **Por que há dúvida:** Nos anexos visuais: (1) `30516` (Pacaembu) sobrepõe a mancha de AIA da bacia do Córrego da Água Quente no Anexo 05 e fica junto ao extremo noroeste da **AEIS tipo 1 nº 21** (Jardim Gonzaga/Monte Carlo) no Anexo 06; (2) `37607` (CEAT) tem faixa de AIA a oeste no Anexo 05; (3) `22426` e `22421` ficam próximos ao Córrego do Gregório e à AIA linear (risco de APP, drenagem e inundação). Que restrições práticas de área edificável, permeabilidade extra ou uso decorrem disso em cada lote?
- **Respostas possíveis:** Incide APP / faixa de inundação / restrição de AIA que reduz área edificável ou veda subsolo (detalhar por lote) / Nos lotes já parcelados não há redução além dos recuos e drenagem / Confirmar em `30516` se incide ou não a AEIS 21.

### P22 — AEI Industrial nº 42 (`CEAT`), restrições de loteamento e Poligonal Histórica / Observatório
- **Assumido hoje:** O motor admite uso residencial multifamiliar em todos os 7 lotes e não aplica restrições contratuais de loteamento; nos anexos visuais, nenhum dos 7 lotes cai na Subárea de Restrição de Gabarito (`9 m`, Poligonal Histórica, PD art. 80) nem na área do Observatório USP (PD art. 82), embora `25297` fique a ~2 quadras ao sul da Poligonal Histórica.
- **Fonte:** Lei nº 18.053/2016, arts. 80, 82 e 84–86 ([`1_2257`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); [ANEXO 06 - AEIs Urbanas.pdf](https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2006%20-%20AEIs%20Urbanas.pdf) (testado em 15/11: abre); `viabilidade/terreno/ZONAS.md` e `viabilidade/terreno/lotes-piloto.json`.
- **Por que há dúvida:** (1) O lote `37607` está na **AEI Industrial e de Serviços nº 42 (CEAT / Parque Novo Mundo)**, onde edifício residencial multifamiliar provavelmente é vedado ou incompatível com as normas do distrito industrial; (2) nos outros 6 lotes (`22426`, `22421`, `25297`, `q1382`, `30516`, `75352-75354`), existem restrições registradas de loteamento ou interferência não visível de patrimônio/Observatório que impeçam multifamiliar?
- **Respostas possíveis:** Em `37607` (AEI 42 CEAT), confirmar se residencial é vedado e quais usos/parâmetros valem / Confirmar se algum dos outros 6 lotes sofre restrição registrada de loteamento ou de vizinhança histórica/Observatório.

---

## (e) Decretos com link quebrado (`BLOQUEIOS.md`) e fontes inacessíveis

### P23 — Decretos vinculados ao Plano Diretor (`580/2019`, `471/2024`, `199/2025`, `412/2025`, `413/2025`, `792/2025`)
> **Respondida em 15/11 por fonte oficial** (`viabilidade/lei/DECRETOS-P23.md`): os 6 decretos tratam só das comissões e do processo de revisão do Plano Diretor e não mudam índice, recuo, gabarito ou zona. Os textos foram lidos no portal de leis, e os links e os números foram conferidos pela central. **Não precisa ser discutida na reunião.** Isso não dispensa conferir outras normas aplicáveis nem a versão vigente dos parâmetros (P12).

- **Assumido hoje:** Os parâmetros do sistema ignoram esses 6 decretos listados na ficha da Lei nº 18.053/2016, porque seus links publicados pelo portal apontam para código vazio (`lei=1_`).
- **Fonte:** Ficha da Lei nº 18.053/2016 ([`1_2257`](https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257) — testado em 15/11: abre); links quebrados (`lei=1_`) documentados em `viabilidade/BLOQUEIOS.md`; `viabilidade/lei/FONTES.md`.
- **Por que há dúvida:** Os 6 decretos aparecem vinculados à Lei do Plano Diretor sem que o link direto abra o texto da norma. Sem lê-los em fonte oficial consolidada, não dá para descartar com 100% de certeza se algum deles regulamenta ou suspende índice construtivo (ou se tratam apenas das comissões da revisão do PD citada em `FONTES.md`).
- **Respostas possíveis:** Esses 6 decretos tratam só da revisão do Plano Diretor e nenhum decreto vigente muda os índices construtivos da `18.053/2016` / Há algum decreto vigente que altera aprovação/parâmetros (informar número e objeto).

### P24 — Fluxo oficial para destravar cadastro, zoneamento e altimetria dos 7 lotes piloto
- **Assumido hoje:** O sistema está limitado a leitura visual de PDFs raster (Anexos 02, 05, 06 e 07), parcelas `planta_refeita` / `sintetico` na base cartográfica e relevo de triagem; o serviço vetorial do SigaSC e seu manual técnico continuam inacessíveis automaticamente.
- **Fonte:** `viabilidade/BLOQUEIOS.md` (WFS SigaSC e `manual_siga.pdf` inacessíveis — ver seção abaixo); `viabilidade/terreno/ZONAS.md`, `viabilidade/terreno/LOTES.md` e `viabilidade/terreno/RELEVO.md`.
- **Por que há dúvida:** Mesmo respondidas as regras gerais da lei, os 7 lotes têm pendências cadastrais (parcelas sintéticas em `75352-75354`, 5 lotes em `q1382`, testada/esquina em `22426` e `25297`, divisa Z1/Z2 em `22421`). Qual documento ou consulta o arquiteto recomenda como etapa mínima obrigatória antes de usar comercialmente um estudo destes?
- **Respostas possíveis:** Emitir Certidão de Uso e Ocupação do Solo (ou Diretrizes) na Prefeitura + matrícula atualizada no CRI / Conferência interativa no SigaSC já basta para pré-estudo antes da matrícula / Outro fluxo prático em São Carlos (descrever).

---

## Fontes inacessíveis (e status de verificação dos links)

### 1. Bloqueios e fontes inacessíveis

- **Endereço:** Servidor de mapas do SigaSC (WFS, Prefeitura de São Carlos — listado em `viabilidade/BLOQUEIOS.md` sem URL pública funcional)
  - **Tipo de bloqueio:** Servidor recusa consulta de camada pela URL; sem vetor oficial disponível para consulta automatizada.
  - **Informação pendente:** Polígono oficial georreferenciado de zoneamento e áreas especiais sobreposto ao cadastro exato dos 7 lotes piloto.
  - **Encaminhamento:** Confirmar a zona oficial de cada lote piloto nesta reunião (P01–P07) e/ou consultar o SigaSC em navegador interativo / emitir Certidão de Uso e Ocupação do Solo na Prefeitura.

- **Endereço:** `https://geo.saocarlos.sp.gov.br/data/manual_siga.pdf`
  - **Tipo de bloqueio:** Erro de handshake TLS (**testado em 15/11 com `curl -L`**: código `35` / HTTP `000`, `0` bytes).
  - **Informação pendente:** Download das curvas municipais, equidistância, época, precisão, licença e dicionário das camadas cadastrais do SigaSC (`origem = planta`, `planta_refeita`, `sintetico`).
  - **Encaminhamento:** Validar o significado prático e a confiabilidade cadastral de `planta_refeita` (`q1382`) e `sintetico` (`75352-75354`) com o profissional e via matrícula no CRI (P06, P07, P24).

- **Endereço:** Bloco "Legislação relacionada" na ficha da Lei nº 18.053/2016 (`https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257` — Decretos `580/2019`, `471/2024`, `199/2025`, `412/2025`, `413/2025` e `792/2025`)
  - **Tipo de bloqueio:** Link quebrado no formulário do portal municipal (envia o código vazio `lei=1_` sem abrir o texto do decreto; a ficha principal `1_2257` abre em HTTP `200`).
  - **Informação pendente:** Confirmação formal do conteúdo dos 6 decretos ligados ao Plano Diretor.
  - **Encaminhamento:** Confirmar com o profissional (P23) se algum desses decretos afeta parâmetros construtivos ou se todos tratam apenas da revisão periódica do PD.

- **Endereço:** Lei Municipal nº 13.944/2006 (APREM — mananciais, citada em `viabilidade/lei/FONTES.md` sem link direto) e Anexo 08 (sistema viário / eixos "arterial tipo 1", citado em `viabilidade/lei/FONTES.md` sem link direto)
  - **Tipo de bloqueio:** Fontes ainda não levantadas/conferidas com URL verificada em `viabilidade/lei/FONTES.md` (conforme apontado na lista de "Não conferidos" e "Ambiguidades" de `FONTES.md`).
  - **Informação pendente:** Regras vigentes da APREM para `SC-Z5A`, `SC-Z5B`, `SC-Z7` e `SC-Z8`, e relação oficial das vias classificadas como "arterial tipo 1" para `SC-Z6A` e `SC-Z6B`.
  - **Encaminhamento:** Validar com o profissional em P08 e P09.

- **Endereço:** Decreto regulamentador do art. 51, inciso VII do COE ("locais sem ocupação humana", citado na Lei nº 22.285/2024) — sem URL conhecida em `FONTES.md`
  - **Tipo de bloqueio:** Norma referenciada no COE sem endereço localizado nos levantamentos do projeto (`zonas.json`).
  - **Informação pendente:** Lista oficial dos compartimentos considerados "sem ocupação humana".
  - **Encaminhamento:** Confirmar com o profissional em P19.

- **Endereço:** PDFs raster dos mapas do PD (`ANEXO 02`, `ANEXO 05`, `ANEXO 06`, `ANEXO 07` — URLs oficiais abaixo abrem normalmente em HTTP 200, mas têm limitação técnica de formato)
  - **Tipo de bloqueio:** Arquivos PDF compostos por imagens raster sem vetores nem divisas cadastrais de lote (posição pela afim de 21 cruzamentos de rua: RMSE/máx. `2,9`/`6,2 m` no Anexo 02, `2,9`/`6,1 m` no 05, `2,9`/`6,1 m` no 06 e `3,2`/`6,2 m` no 07, e até `6,8 m` nos 8 cruzamentos de verificação; o ajuste antigo de 5 vértices errava 40–100 m) e sem cotas altimétricas numéricas para o aeroporto (Anexo 07).
  - **Informação pendente:** Divisas exatas entre zonas/áreas especiais no nível de lote e teto aeronáutico numérico (DECEA).
  - **Encaminhamento:** Validar nesta reunião (P01–P07, P20–P22) e confirmar via Certidão de Uso e Ocupação do Solo / DECEA.

### 2. Status de verificação dos links de `FONTES.md` e anexos (testados em 15/11/2026 com `curl -L`, limite 60 s)

| Fonte | Endereço exato | Resultado em 15/11/2026 | Observação |
| :--- | :--- | :--- | :--- |
| Plano Diretor — Lei nº 18.053/2016 | `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257` | **testado em 15/11: abre** (HTTP 200, 483.533 B) | Texto original sem consolidação; não substitui o Diário Oficial. |
| Lei nº 18.927/2018 (Zona 6E) | `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_754` | **testado em 15/11: abre** (HTTP 200, 12.960 B) | Cria art. 42-A sem definir CA. |
| COE — Lei nº 19.950/2020 | `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2015` | **testado em 15/11: abre** (HTTP 200, 277.555 B) | Ler junto com as leis alteradoras abaixo. |
| Lei nº 20.072/2021 (altera COE) | `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2987` | **testado em 15/11: abre** (HTTP 200, 22.290 B) | Art. 67-I e art. 51-VI. |
| Lei nº 22.285/2024 (altera COE) | `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_4661` | **testado em 15/11: abre** (HTTP 200, 11.992 B) | Arts. 72, 72-A, 73 e art. 51-VII. |
| Lei nº 24.031/2026 (altera COE) | `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_7985` | **testado em 15/11: abre** (HTTP 200, 23.415 B) | Varandas (art. 68), drenagem e piso permeável. |
| Página do Plano Diretor | `https://www.saocarlos.sp.gov.br/index.php/habitacao-morar/166049-plano-diretor-estrategico.html` | **testado em 15/11: abre** (HTTP 200, 121.526 B) | Página oficial que hospeda os anexos de 2017. |
| Anexo 01 — Macrozoneamento | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2001%20-%20Macrozoneamento.pdf` | **testado em 15/11: abre** (HTTP 200, 8.016.603 B, PDF) | — |
| Anexo 02 — Zoneamento Urbano | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002%20-%20Zoneamento%20Urbano.pdf` | **testado em 15/11: abre** (HTTP 200, 15.013.109 B, PDF) | Mapa raster usado na leitura manual dos lotes. |
| Anexo 02ABC — Perímetros | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2002ABC%20-%20Descri%C3%A7%C3%B5es%20Per%C3%ADmetros.pdf` | **testado em 15/11: abre** (HTTP 200, 109.906 B, PDF) | Pontos de controle SAD69 usados no ajuste. |
| Anexo 03 — Expansão Urbana | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2003%20-%20Zoneamento%20da%20macrozona%20urbana%20e%20das%20zonas%20passiveis%20de%20expans%C3%A3o.pdf` | **testado em 15/11: abre** (HTTP 200, 11.467.051 B, PDF) | — |
| Anexo 04 — Zoneamento Rural | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2004%20-%20Zoneamento%20rural.pdf` | **testado em 15/11: abre** (HTTP 200, 8.435.738 B, PDF) | — |
| Anexo 05 — AEIs Ambientais | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2005%20-%20AEIs%20Ambientais.pdf` | **testado em 15/11: abre** (HTTP 200, 13.099.152 B, PDF) | Mapa raster de AIA/ambientais. |
| Anexo 06 — AEIs Urbanas | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2006%20-%20AEIs%20Urbanas.pdf` | **testado em 15/11: abre** (HTTP 200, 14.678.499 B, PDF) | AEIs, AEIS, Poligonal Histórica e Observatório. |
| Anexo 07 — AEIs Rurais | `https://www.saocarlos.sp.gov.br/images/stories/pdf/2017/pde/ANEXO%2007%20-%20AEIs%20Rurais.pdf` | **testado em 15/11: abre** (HTTP 200, 12.720.850 B, PDF) | Inclui tracejado roxo da superfície do aeroporto. |
| Links quebrados de decretos na ficha da 18.053/2016 (`lei=1_`) | Via `https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257` | **Inacessível** (formulário envia `lei=1_` vazio; ficha 1_2257 abre) | Listado em "Fontes inacessíveis". |
| SigaSC WFS e `manual_siga.pdf` | WFS SigaSC (sem URL pública em `BLOQUEIOS.md`) e `https://geo.saocarlos.sp.gov.br/data/manual_siga.pdf` | **Inacessível** (`manual_siga.pdf`: erro TLS `curl` 35 / HTTP 000 em 15/11) | Listados em "Fontes inacessíveis". |

---

## Tabela-resposta (para preenchimento na reunião)

| Pergunta | Resposta | Fonte que o profissional usou | Assinatura / Data |
| :--- | :--- | :--- | :--- |
| P01 — Zona do lote `SC-completo-30516` (Jardim Pacaembu) | | | |
| P02 — Zona do lote `SC-completo-37607` (C.E.A.T.) | | | |
| P03 — Zona (`Z1` vs `EIXO`) e frente do lote `SC-completo-22426` | | | |
| P04 — Zona (`Z1` vs `Z2`) do lote `SC-completo-22421` | | | |
| P05 — Zona e esquina do lote `SC-completo-25297` | | | |
| P06 — Zona (`EIXO` vs `Z2`) e remembramento `q1382-11984-11988` | | | |
| P07 — Zona (`Z2`), origem sintética e testada de `75352-75354` | | | |
| P08 — Parâmetros vigentes de `SC-Z5A` e `SC-Z5B` | | | |
| P09 — Permeabilidade `SC-Z6B`, pré-parcelamento e "arterial tipo 1" (`Z6A`/`Z6B`) | | | |
| P10 — Coeficiente de aproveitamento e regras da `SC-Z6E` (`Lei 18.927/2018`) | | | |
| P11 — Regra de ≥ 50% multifamiliar na `SC-Z1` (`CAM 3,0` vs `CAB 2,0`) | | | |
| P12 — Vigência das demais zonas conferidas (`18.053/2016`) | | | |
| P13 — Contagem de pavimentos, `h/8`, escalonamento e mezanino (`art. 67`) | | | |
| P14 — Garagem e varanda computáveis no CA / TO (`art. 51`) | | | |
| P15 — Varanda no térreo na redação atual (`COE art. 68`) | | | |
| P16 — Permeabilidade, piso permeável e drenagem (`Lei 24.031/2026`) | | | |
| P17 — Parede cega na divisa / encosta (`COE art. 70`) | | | |
| P18 — Recuo frontal (`art. 74`), esquinas e faixas não edificáveis (`arts. 72/73`) | | | |
| P19 — "Locais sem ocupação humana" (`COE art. 51-VII`) | | | |
| P20 — Gabarito aeronáutico / DECEA (`Anexo 07`) | | | |
| P21 — AIA, APP/inundação e `AEIS 21` (`30516`, `37607`, `22426`, `22421`) | | | |
| P22 — AEI nº 42 (`37607`), loteamentos e Poligonal Histórica / Observatório | | | |
| P23 — Decretos do PD com links quebrados (`580/2019` a `792/2025`) | | | |
| P24 — Fluxo oficial para validar cadastro e certidões dos 7 lotes | | | |
