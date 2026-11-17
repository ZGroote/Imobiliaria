# Revisão do `PA-G0.md` do Projetista (16/11/2026)

Revisão estática feita na worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade` sobre `viabilidade/projetista-copia/PA-G0.md`, confrontando com o código-fonte do repositório, `MATRIZ-REUSO.md`, `TAREFA-1.md`, `TAREFA-1-ADENDO.md` e `DECISOES-PA-G0.md`.

---

## 1. Referências inventadas ou imprecisas

### Achados

| Gravidade | Onde (`PA-G0.md`) | O que está escrito | O que o código mostra |
|---|---|---|---|
| **ALTA** | Seção 2.2, linha 52 | `as regras de folga mínima (MIN = {"sala": 2.40, "cozinha": 1.50, "banho": 1.10}) ajudam a validar dimensões mínimas de cômodos` | Em `pipeline/mobiliar.py:90`, o dicionário `{"sala": 2.40, "cozinha": 1.50, "banho": 1.10}` chama-se **`MIN_LARG`** (largura mínima do ambiente). Já **`MIN`** (`pipeline/mobiliar.py:70-78`) é o dicionário de folgas de circulação (`"parede": 0.50`, `"camas": 0.60`, `"cozinha": 0.85`, `"assento": 0.50`, `"mesa": 0.75`, `"louca": 0.40`, `"tanque": 0.50`). |
| **ALTA** | Seção 2.2, linha 53 | Coloca `world/building-placement.js:urbanSplit` sob **Unidade em lote de lançamento** ("Liga anúncios/unidades a prédios ou a um lote vazio (`lote.lat/lon`, `lote.predio`, `recsDoLancamento`) no mapa 3D"). | `v1.5/renderizador-v16-moveis/world/building-placement.js:14` (`urbanSplit`) trata **modelos urbanos genéricos de contexto** (`casas`, `sobrados`, `predios` via `urban.select`) e inclusive `explicitBuilding` (linha 8) pula lançamentos (`b.lancamento`). Quem posiciona lançamentos e define `recsDoLancamento` é `v1.5/renderizador-v16-moveis/app.js` (consumido por `listings/identity.js`). |
| **BAIXA** | Seção 2.1, linha 36 | `Em viabilidade/motor/motor.py:_avaliar (linhas 433–437)` | A função `_avaliar` começa na linha 424 e o trecho citado (`laje`, `por_andar`, `priv`, `unid`) está nas **linhas 434–438** (deslocamento de 1 linha). |
| **BAIXA** | Seção 2.2, linha 47 | `Exporta leitura (schemas/leitura/1.1.0.schema.json)` em `modelo.ts:documento` | Em `painel/src/components/construtor-planta/modelo.ts:679`, `documento()` exporta `schemaVersion: '1.1.0'` apenas quando há cômodos mesclados (`hasMerged`), e `'1.0.0'` quando não há. |
| **BAIXA** | Seção 2.2, linha 50 | `geoDaCasa extruda paredes (ESP = 0.13 m)` | `geoDaCasa` (`v1.5/renderizador-v16-moveis/interior/house-mesh.js:8`) recebe `ESP` por injeção de dependência; a constante `const ESP = 0.13;` está definida em `v1.5/renderizador-v16-moveis/app.js:2208`. |

### Tabela completa de conferência

| Referência no `PA-G0.md` | Existe? | Onde / Observação no código |
|---|---|---|
| `painel/src/components/construtor-planta/modelo.ts` (`iniciar`, `aplicar`, `problemas`, `documento`, `exportar`, `carregar`, `exportarMoveis`) | **Sim** | `iniciar` (245, 751), `aplicar` (248), `problemas` (633), `documento` (673), `exportar` (687), `exportarMoveis` (688), `carregar` (711). |
| `v1.5/renderizador-v16-moveis/listings/identity.js` (`unidadeDoPredio`, `predioDaUnidade`, `loteDaUnidade`) | **Sim** | `unidadeDoPredio` (24), `loteDaUnidade` (83), `predioDaUnidade` (86). |
| `v1.5/renderizador-v16-moveis/world/building-placement.js:urbanSplit` | **Existe, mas faz outra coisa** | Linha 14; trata modelos de contexto urbano, não unidades em lote de lançamento (`app.js` / `listings/identity.js`). |
| `experimentos/liv-ipanema-webgpu-2026-10-09/interiores/shared/runtime.js:paredesDaGrade` | **Sim** | Linha 13 (com `G = 0.05` na linha 14). |
| `schemas/leitura/1.1.0.schema.json` | **Sim** | Existe na raiz `schemas/leitura/1.1.0.schema.json`. |
| `schemas/planta-derivada/1.1.0.schema.json` (`unit: "m"`, `measurementBasis: "wall-centerlines"`, `construction: "not-applied"`) | **Sim** | Linhas 27–35 de `schemas/planta-derivada/1.1.0.schema.json`. |
| `viabilidade/motor/motor.py:PREMISSAS_PADRAO` (`eficiencia=0.8`, `area_comum_por_pavimento_m2=40`, `area_privativa_por_unidade_m2=60`, `laje_minima_m2=80`) | **Sim** | `viabilidade/motor/motor.py:21-44`. |
| `viabilidade/motor/motor.py:_avaliar` (linhas 433–437) | **Sim (linhas 434–438)** | Função na linha 424; cálculo aritmético nas linhas 434–438. |
| `viabilidade/motor/motor.py` (`caixa_recuada`, `eixos_da_frente`, `_para_local`, `_para_mundo`, `recuo_divisa`, `_recuos_topo`, `_Caixas`, `_gerar_estudo`, `_cabe`, `_alertas`, `gerar_estudo`, `_coords`) | **Sim** | Todos presentes em `viabilidade/motor/motor.py` (linhas 84, 67, 164, 169, 337, 419, 350, 675, 529, 917, 657, 55). |
| `pipeline/mobiliar.py:MIN` (`{"sala": 2.40, "cozinha": 1.50, "banho": 1.10}`) | **Existe com outro nome** | Chama-se **`MIN_LARG`** (`pipeline/mobiliar.py:90`). `MIN` (`pipeline/mobiliar.py:70-78`) são as folgas mínimas de mobiliário. `MEIA_PAREDE = 0.065` (linha 50) e `ESP = 0,13` (comentário linha 45) conferem. |
| `pipeline/extrair_planta.py:achar_linhas`, `calibrar` | **Sim** | `achar_linhas` (34), `calibrar` (82). |
| `tools/gerar_planta_aleatoria.mjs:gerarPlantaAleatoria` | **Sim** | Linha 21. |
| `v1.5/renderizador-v16-moveis/interior/floor-plan.js:paredesDaGrade` (`G = 0.05`) | **Sim** | `paredesDaGrade` (13), `const G = 0.05;` (14). |
| `v1.5/renderizador-v16-moveis/interior/house-mesh.js:geoDaCasa` (`ESP = 0.13`) | **Sim (constante em `app.js`)** | `geoDaCasa` (8); `const ESP = 0.13;` está em `v1.5/renderizador-v16-moveis/app.js:2208`. |
| `v1.5/renderizador-v16-moveis/interior/entry.js:enterInterior` | **Sim** | Linha 24. |
| Números dos lotes da Seção 1 (`SC-completo-q1382-11984-11988`, `SC-completo-37607`, `SC-completo-25297`, `SC-completo-25212`, `SC-completo-91923`) | **Sim** | Todos conferem com `viabilidade/motor/exemplos/pilotos/*.json` e `viabilidade/revisao/REVISAO-6.md`. |
| `viabilidade/lei/FONTES.md`, `viabilidade/lei/zonas.json`, `PRD-VIABILIDADE-1.0.md`, `PRD-V1-COMERCIAL.md` | **Sim** | Todos existem; referências ao COE art. 51 (Leis 19.950/2020 e 20.072/2021) e omissão de varanda conferem com `FONTES.md`. |

---

## 2. Conflitos com a `MATRIZ-REUSO.md`

| Gravidade | Tema | Onde (`PA-G0.md`) | O que está escrito no `PA-G0.md` | O que diz a `MATRIZ-REUSO.md` e o que o código mostra |
|---|---|---|---|---|
| **MÉDIA** | Reuso de `gerar_planta_aleatoria.mjs` | Seção 2.2, linha 48 | Classifica como **"Reaproveitar como fixture/teste"** ("bom modelo de teste determinístico para gerar unidades válidas em CI"). | `MATRIZ-REUSO.md:65` classifica como **"não serve"**: sem ID explícito o script usa `Math.random()`, tem medidas e móveis fixos, e `validarNormativo` roda apenas validação geométrica. Pelo código, só serve como fixture se receber ID fixo, nunca como gerador determinístico geral. |
| **MÉDIA** | Reuso de `urbanSplit` para lançamentos | Seção 2.2, linha 53 | Lista `world/building-placement.js:urbanSplit` em "Unidade em lote de lançamento" como **"Reaproveitar padrão de vínculo"**. | `MATRIZ-REUSO.md:91` aponta que o seletor de modelos urbanos (`urban-models.js:select`) **"não serve"** porque exclui lançamentos. Pelo código (`building-placement.js:8,14`), `urbanSplit` pula `b.lancamento`; o vínculo real está em `app.js` + `listings/identity.js`. |
| **MÉDIA** | Escolha e limites do adaptador 3D | Seção 2.2 (linha 50) e Seção 6 (linha 131) | Propõe adaptar `house-mesh.js:geoDaCasa` para interiores e cita genericamente "visualizador `viabilidade/visual/` já existentes", sem registrar limites ou contrato. | `MATRIZ-REUSO.md` (Seção 6.1–6.3) define explicitamente `viabilidade/visual/index.html:criarVista` como **primeiro adaptador de volumes** (com limites reais no código: até 12 opções, 200 volumes/opção, 10.000 vértices, sem buracos em `base_utm`, e erro quando `caixa_maxima.altura_m == null`) e mostra que `plantaDaUnidade` centraliza a planta no prédio e exige adaptação para 6 unidades no mesmo pavimento. |
| **MÉDIA** | Tamanho do que falta | Seção 2.2 / Seção 6 | Não apresenta estimativa relativa (`P`/`M`/`G`) do que falta construir. | `MATRIZ-REUSO.md` (Seção 5) detalha `P`/`M`/`G` por etapa do fluxo (ex.: `G` para geração de distribuições e organização de torres; `P/M` para prévia 3D esquemática). |

*(Observação sobre Ordem dos portões: a `MATRIZ-REUSO.md` não escolhe ordem — apenas constata na linha 105 que reusar o editor reduz o começo do PA-G1, mas não elimina PA-G2/G3/G4 — enquanto o `PA-G0.md` recomenda a Ordem B.)*

---

## 3. Cumprimento do `TAREFA-1-ADENDO.md`

| Gravidade | Exigência do Adendo | Onde (`PA-G0.md`) | Achado |
|---|---|---|---|
| **MÉDIA** | **Inventário curto citando `MATRIZ-REUSO.md`** ("mantenha o inventário curto e diga 'detalhe na MATRIZ-REUSO.md'") | Seção 2.2 (linhas 42–54) | O `PA-G0.md` **não cita `MATRIZ-REUSO.md` nenhuma vez** e repete um inventário longo na Seção 2.2 (onde inclusive ocorrem os erros em `mobiliar.py MIN` e `urbanSplit`). |
| **MÉDIA** | **Gerador sem IA generativa e reproduzível** (`GenerationRun.seed`) | Seção 4.2 (linha 99) e Seção 6 | O `PA-G0.md` **não declara explicitamente que o gerador é sem IA generativa**. Sobre `GenerationRun.seed`: ter `seed` é compatível com reprodutibilidade *apenas se* a semente for fixa/opcional para desempates determinísticos (ou nula em busca puramente determinística), mas o documento não especifica a regra de determinismo (ordenação, tolerâncias e desempates fixos, proibição de `Math.random()`). |
| **MÉDIA** | **Fluxo-alvo completo** (`selecionar terreno → calcular viabilidade → pedir 6 aptos → gerar distribuições → organizar torres → ver em 3D → modificar`) | Seções 1 e 6 | Os casos de uso focam em "6 aptos de ~60 m² por andar", mas o fluxo completo de 7 passos (especialmente **organizar torres**, **ver o empreendimento inteiro em 3D** e **modificar o projeto**) não é explicitado como jornada principal nem usado integralmente na comparação das ordens. |
| **BAIXA** | **Não duplicar o motor 3D** | Seção 2.2 (linha 50), Seção 6 (linha 131) | A intenção aparece ("adaptar `geoDaCasa`", conectar no `viabilidade/visual/`), mas sem explicitar a restrição arquitetônica de não duplicar o motor 3D e sem referenciar o contrato mínimo da `MATRIZ-REUSO.md`. |
| **BAIXA** | **Geometria separada de legislação no esquema canônico** | Seção 4.2 (linhas 86, 97–98) | `ValidationFinding` e `RuleSetReference` trazem os 3 estados (`conforme`/`violacao`/`nao_verificado`), mas `DesignRevision.status` (`RASCUNHO`/`REQUER_REVALIDACAO`) não distingue explicitamente um status próprio para **geometria válida** separado de **proposta legalmente conforme**. |

---

## 4. Conflitos com as `DECISOES-PA-G0.md`

O `PA-G0.md` foi redigido antes das respostas do usuário e mantém como **"a decidir"** / **"em aberto"** itens que já foram decididos em `DECISOES-PA-G0.md`, além de divergir em pontos trazidos pelos reforços (`➕`):

| Gravidade | Onde (`PA-G0.md`) | O que está escrito hoje | O que precisa ser corrigido conforme `DECISOES-PA-G0.md` |
|---|---|---|---|
| **ALTA** | Seção 3 (linha 65) e Seção 8.2 (linha 170) | Espessura de parede está **"A decidir: confirmar 0,15 m ou 0,13 m..."** e divisa **"0,15 m ou 0,20 m"**. | Fechar decisão: modelo no **eixo da parede**, espessura **0,15 m interna** e **0,20 m entre unidades e com área comum**; faces reais derivadas do eixo + espessura (atenção a parede compartilhada e cantos). Remover `0,13 m` como opção candidata para o modelo canônico. |
| **ALTA** | Seção 3 (linhas 62–63) e Seção 8.2 (linha 169) | Área privativa pela **NBR 12721** está **"A decidir"**; área útil também em aberto. | Fechar decisão: **área privativa pela NBR 12721**; registrar explicitamente que **privativa, útil e computável são três métricas separadas**, nunca derivadas uma da outra sem regra explícita. |
| **ALTA** | Seção 4.2 (linha 99) | `GenerationRun.outcome` lista `sucesso`/`impossivel`/`busca_inconclusiva`/`dados_insuficientes`/`erro`. | Alinhar aos estados definidos em `DECISOES-PA-G0.md`: **`gerado`** (geometria válida; arquitetura ainda não verificada), **`inviavel`** (restrição conhecida impede) e **`nao_encontrado`** (busca não achou, sem provar impossibilidade), mantendo equivalência documentada com o motor (`impossivel` × `busca_inconclusiva`). |
| **ALTA** | Seção 6 (linhas 133–136) e Seção 8.2 (linha 171) | Ordem B está como recomendação/pergunta, colocando `núcleo canônico + validador` juntos com o gerador esquemático, sem detalhar restrições funcionais da unidade. | Fechar **Ordem B** e explicitar que o **validador independente vem antes do gerador** (e atenderá também o editor futuro), e que apartamento funcional exige **acesso ao corredor, trecho mínimo de fachada e dimensões mínimas** (não só retângulos encaixados). |
| **ALTA** | Seção 3 (linha 61) e Seção 8.2 (linha 172) | Varanda computável está como pergunta em aberto. | Fechar decisão: **varanda computável por padrão** até confirmação jurídica, com estado **`nao_verificado`** (nunca `conforme`). |
| **ALTA** | Seção 8.2 (linha 173) | Casa térrea e sobrado fora da 1ª etapa está como pergunta em aberto (embora a Seção 7, linha 149, já recomende deixar fora). | Fechar decisão: **casa térrea e sobrado fora** da 1ª etapa (domínio separado depois). |
| **ALTA** | Seção 5 (linhas 114, 118) e Seção 8.2 (linha 174) | JSON local versionado está como recomendação/pergunta e não menciona gravação atômica. | Fechar decisão: **JSON local versionado** com `schema_version`, IDs estáveis, SHA-256 e **gravação atômica** até o PA-G5, sem Firestore. |
| **BAIXA** | Seção 8.3 (linhas 176–180) | Critério de saída aguarda resposta às 6 perguntas da seção 8.2. | Atualizar Seção 8.2/8.3 incorporando as decisões registradas em `DECISOES-PA-G0.md`. |

---

## 5. Nome de cliente ou preço no documento

Sem achados.
