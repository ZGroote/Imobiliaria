# PA-G0 — Descoberta, Inventário e Contratos do Projetista

**Data:** 16/11/2026  
**Galho:** `viabilidade/projetista-g0`  
**Status:** documento de descoberta (PA-G0). Sem código de produto, sem alteração no `motor/`, painel, Firestore ou produção.  
**Base lida:** `viabilidade/PRD-PROJETISTA-0.1.md`, `viabilidade/PRD-VIABILIDADE-1.0.md`, `viabilidade/PRD-V1-COMERCIAL.md`, `viabilidade/lei/FONTES.md`, `viabilidade/motor/motor.py` e módulos do repositório principal.

---

## 1. Casos de uso concretos

Todos os números abaixo vêm de lotes reais da base `completo` de São Carlos presentes em `viabilidade/motor/exemplos/pilotos/` e `viabilidade/revisao/REVISAO-6.md` (sorteio da viabilidade).

| Caso | Lote e zona | Envelope atual do motor (`estudo.json`) | Pedido do usuário | Resultado esperado no Projetista |
|---|---|---|---|---|
| **1. Cabe com folga (torre alta)** | `SC-completo-q1382-11984-11988`, **1.599,11 m²**, `SC-EIXO` (CA máx. 4,0 → 6.396,43 m² comp.; TO 70% → 1.119,38 m²; perm. 15%) | `caixa_maxima` térrea: **1.263,43 m²** (bbox 54,54 × 43,07 m). Hoje a Opção A gera **84 unid.** em 21 pav. (laje 303,99 m², **4 aptos/andar**). | **"6 aptos de ~60 m² por andar"** (~360 m² priv./andar + ~60–90 m² de circulação/núcleo = laje ~420–450 m²) | **Cabe:** laje cabe na caixa térrea e na TO (1.119,38 m²). Com ~420–450 m²/pav., o CA de 6.396,43 m² permite ~14–15 pav. (~84–90 unid.), sujeito ao recuo `h/8` nos andares altos e ao desenho do corredor central. |
| **2. Cabe em lâmina, disputa com torre** | `SC-completo-37607`, **2.684,94 m²**, `SC-Z4` (CA máx. 1,4 → 3.758,92 m² comp.; TO 70% → 1.879,46 m²; perm. 15%) | `caixa_maxima`: **2.267,21 m²** (33,73 × 86,56 m). Hoje: Opção A (18 pav., 3/andar = 54 unid.), Opção B (2 torres × 9 pav. = 54 unid.), Opção C (2 pav., laje 1.899,46 m², **25 aptos/andar** = 50 unid.). | **"6 aptos de ~60 m² por andar"** em prédio baixo (3–4 pavimentos) | **Cabe:** 6 × 60 = 360 m² priv. + circulação/núcleo (~440 m² de laje) × 4 pav. = ~1.760 m² (< CA 3.758,92 m²). Corrige a distorção da Opção C atual (25 aptos/andar sem modelo de corredor). |
| **3. Não cabe (lote estreito)** | `SC-completo-25297`, **326,68 m²**, `SC-Z1` (CA máx. 3,0 → 980,03 m²; TO 70% → 228,67 m²) | `caixa_maxima`: **146,62 m²** (6,41 × 27,01 m). Hoje só gera Opção C (4 pav., laje 122,47 m², **1 apto/andar** = 4 unid.); A, B e D ausentes (`laje < 80 m²`). | **"6 aptos de ~60 m² por andar"** (~360 m² priv./andar) | **Impossibilidade geométrica sob hipóteses:** a `caixa_maxima` inteira (146,62 m²) é menor que 360 m². O sistema deve classificar como `impossivel` e explicar a diferença (faltam >250 m² de laje por andar). |
| **4. Não cabe (lote pequeno, 0 opções)** | `SC-completo-25212` (**138,95 m²**, `SC-Z2`) e `SC-completo-91923` (**150,48 m²**, `SC-Z3`), do sorteio em `REVISAO-6.md` | Maior laje após recuos: **47,48 m²** (`25212`) e **63,19 m²** (`91923`). Motor retorna **0 opções** (`impossivel`: laje < `laje_minima_m2` de 80 m²). | Apartamento-tipo ou habitação em lote pequeno | **Fora do multifamiliar padrão:** com `laje_minima_m2 = 80` e `area_comum = 40`, nenhum apartamento cabe. Lotes de 88–150 m² exigem outro domínio (casa térrea/sobrado sem área comum condominial — ver seção 7). |

---

## 2. Inventário do que já existe

### 2.1 Motor de viabilidade (`viabilidade/motor/motor.py`)

| Recurso existente | Onde está (`arquivo:função`) | O que entrega hoje para o Projetista |
|---|---|---|
| Recuo por aresta e quina côncava | `viabilidade/motor/motor.py:caixa_recuada` | Recebe polígono do lote, frente e recuos (`rf`, `rl`, `rb`) e devolve o polígono útil após descontar faixas de recuo (com disco em vértice de fundos inclinado). |
| Referencial local alinhado à frente | `viabilidade/motor/motor.py:eixos_da_frente`, `_para_local`, `_para_mundo` | Define origem na frente do lote, eixo `u` ao longo da testada e `v` para dentro do lote. Permite trabalhar em metros locais e converter de volta para UTM (`EPSG:31983`). |
| Recuo progressivo por altura (`h/8`) | `viabilidade/motor/motor.py:recuo_divisa`, `_recuos_topo`, `_Caixas` | Calcula recuo lateral/fundos por pavimento (`1,50 m` até o 1º pav., `max(base, h/8, 2,00 m)` acima) e gera `caixa_maxima.degraus` no `estudo.json`. |
| Gabarito, CA, TO, permeabilidade e parede cega | `viabilidade/motor/motor.py:_gerar_estudo`, `_cabe`, `_alertas` | Aplica `ca_maximo`, `taxa_ocupacao`, `taxa_permeabilidade`, `altura_max_m` (zona + áreas especiais), `pavimentos_max` e `parede_cega_encosta_ate_m` (12 m). |
| Saída contratual (`estudo.json`) | `viabilidade/motor/motor.py:_gerar_estudo`, `gerar_estudo` | Entrega `lote`, `zona`, `premissas`, `caixa_maxima` (`projecao_utm`, `altura_m`, `degraus`, `projecao_parede_cega_utm`), `opcoes` (A–D com `volumes[]`, `metricas`, `alertas`), `opcoes_ausentes` e `incertezas`. |

**Como o motor chega ao número de unidades hoje:**  
Em `viabilidade/motor/motor.py:_avaliar` (linhas 433–437), o cálculo é puramente aritmético por pavimento, sem geometria de unidades ou corredores:
1. `por_andar = max(0.0, min(laje * pr["eficiencia"], laje - pr["area_comum_por_pavimento_m2"]))` (com padrões `eficiencia = 0.8` e `area_comum_por_pavimento_m2 = 40`).
2. `unid += v["pavimentos"] * math.floor((por_andar + 1e-9) / pr["area_privativa_por_unidade_m2"])` (padrão `60 m²`).

Ou seja: hoje **não existe** planta, corredor, hall, núcleo posicionado nem verificação de fachada/ventilação; apenas divisão inteira da área líquida estimada por `60 m²`.

### 2.2 Peças de planta e 3D no repositório principal

| Peça | Onde está (`arquivo:função`) | O que faz e formato de dado | Aproveitamento no Projetista |
|---|---|---|---|
| **Extrator de planta (CV + calibração)** | `pipeline/extrair_planta.py:achar_linhas`, `calibrar` | Detecta linhas de parede em imagem PNG/JPG por morfologia e calibra px/m pelas áreas rotuladas; gera rascunho para `leitura.json`. | **Não serve para o núcleo** (entrada é imagem raster). Útil apenas se no futuro alguém importar planta existente. |
| **Editor/Construtor de planta 2D (painel)** | `painel/src/components/construtor-planta/modelo.ts:iniciar`, `aplicar`, `problemas`, `documento`, `exportar`, `carregar` | Modela cômodos ortogonais em **milímetros inteiros** (`xMm`, `yMm`, `widthMm`, `depthMm`), `mergedGroups`, aberturas (`door`/`window` por `wallId` + `offsetMm`) e móveis. Exporta `leitura` (`schemas/leitura/1.1.0.schema.json`). | **Adaptar (referência de UX e validação):** já tem undo/redo, detecção de sobreposição, cômodo desconectado e aberturas. Precisa de adaptador para o esquema canônico (múltiplas unidades, parede explícita, pavimento). |
| **Gerador de planta de teste** | `tools/gerar_planta_aleatoria.mjs:gerarPlantaAleatoria` | Usa `iniciar`/`aplicar`/`exportar` de `modelo.ts` para montar uma casa fixa de 8 cômodos com portas/janelas e validar via `pipeline.validar_leitura`. | **Reaproveitar como fixture/teste:** bom modelo de teste determinístico para gerar unidades válidas em CI, não é gerador paramétrico de apartamentos. |
| **Planta derivada (centro de parede)** | `schemas/planta-derivada/1.1.0.schema.json` | Contrato em **metros** (`unit: "m"`), com `measurementBasis: "wall-centerlines"` e `construction: "not-applied"`. | **Reaproveitar conceito:** separa leitura em mm de geometria derivada em metros pelo eixo das paredes. |
| **Montagem do interior 3D (mapa 3D)** | `v1.5/renderizador-v16-moveis/interior/floor-plan.js:paredesDaGrade`, `house-mesh.js:geoDaCasa`, `entry.js:enterInterior` | `paredesDaGrade` discretiza polígonos de cômodos em **grade de 5 cm** (`G = 0.05`) para achar paredes e encaixar vãos; `geoDaCasa` extruda paredes (`ESP = 0.13 m`), pisos e forros em Three.js. | **Adaptar para visualização 3D:** `geoDaCasa` pode renderizar interiores rapidamente, mas `paredesDaGrade` (grade de 5 cm) **não serve** como motor de cálculo/área (arredonda medidas). O Projetista deve gerar paredes vetoriais exatas. |
| **Runtime do LIV** | `experimentos/liv-ipanema-webgpu-2026-10-09/interiores/shared/runtime.js:paredesDaGrade` | Cópia evoluída do mesmo pipeline `floor-plan.js` + `house-mesh.js` + móveis para maquete isolada de empreendimento. | **Mesmo parecer do mapa 3D:** útil só como referência de renderização 3D leve; não usar a grade de 5 cm para métricas. |
| **Mobiliar pela planta** | `pipeline/mobiliar.py:paredes`, `painel/src/components/construtor-planta/modelo.ts:exportarMoveis` | Lê polígonos de cômodos, acha normal interna, usa `MEIA_PAREDE = 0.065 m` (`ESP = 0.13 m`) e folgas mínimas (`NBR 15575-1` / `NKBA`) para posicionar móveis em `moveis.auto.json`. | **Adaptar (futuro / pós-MVP):** as regras de folga mínima (`MIN = {"sala": 2.40, "cozinha": 1.50, "banho": 1.10}`) ajudam a validar dimensões mínimas de cômodos, mas mobiliar automático fica fora do PA-G1..G3. |
| **Unidade em lote de lançamento** | `v1.5/renderizador-v16-moveis/listings/identity.js:unidadeDoPredio`, `predioDaUnidade`, `loteDaUnidade`; `world/building-placement.js:urbanSplit` | Liga anúncios/unidades a prédios ou a um lote vazio (`lote.lat/lon`, `lote.predio`, `recsDoLancamento`) no mapa 3D sem quebrar o catálogo existente. | **Reaproveitar padrão de vínculo:** mostra como ligar um empreendimento/torre ao lote sem alterar registros da cidade base. |

---

## 3. Definições operacionais a fechar

| Conceito | Fonte encontrada no repositório | Situação atual e o que precisa fechar |
|---|---|---|
| **Área computável** | **Lei de São Carlos:** COE (Lei 19.950/2020, art. 51, com redação da Lei 20.072/2021), documentado em `viabilidade/lei/FONTES.md` e `viabilidade/lei/zonas.json`. Lista isenções (garagem, escada, antecâmara, fosso de elevador/shaft no pav. superior, reservatório, casa de máquinas, lixo, área técnica de AC). | **Parcialmente fechada.** Falta confirmar leitura jurídica sobre **varanda** (não consta da lista de isenções do art. 51 em `FONTES.md`) e térreo comercial em fachada ativa. |
| **Área privativa** | Não há norma técnica (ex.: ABNT NBR 12721) cadastrada em `viabilidade/lei/`. O motor usa apenas a premissa numérica `area_privativa_por_unidade_m2 = 60` (`motor.py:PREMISSAS_PADRAO`). | **A decidir:** adotar definição da NBR 12721 (área da unidade incluindo paredes internas e metade das divisórias entre unidades/áreas comuns, ou definição simplificada no MVP) e registrar se varanda entra separada. |
| **Área útil (de piso)** | Não há definição formal em `viabilidade/lei/`. Em `modelo.ts` e `mobiliar.py`, os cômodos são medidos pelo polígono interno líquido. | **A decidir:** definir se `área útil` no Projetista será a soma exata das áreas internas líquidas dos cômodos (`Room`), descontando todas as paredes. |
| **Cota interna ou externa** | Sem definição legal em `viabilidade/lei/`. No repositório, `schemas/planta-derivada/1.1.0.schema.json` usa `wall-centerlines` (eixo da parede); `modelo.ts` usa retângulos contíguos sem espessura explícita. | **A decidir:** adotar **eixo de parede** como representação geométrica canônica (evita folgas entre cômodos vizinhos) e exibir cota interna líquida (eixo menos `ESP/2` de cada lado) e externa total na UI. |
| **Espessura de parede padrão** | Sem definição em `viabilidade/lei/`. O renderizador e `pipeline/mobiliar.py` usam `ESP = 0,13 m` (`MEIA_PAREDE = 0.065`). | **A decidir:** confirmar `0,15 m` (padrão alvenaria acabada/estrutural usual) ou `0,13 m` (já usado no renderizador 3D) como padrão para parede interna e definir se parede externa/divisa entre unidades usa `0,15 m` ou `0,20 m`. |

---

## 4. Esquema canônico proposto e adaptador para `estudo.json`

### 4.1 Convenções globais do contrato
- **Versão do esquema:** `projetista/0.1.0`.
- **Unidade canônica:** **metros (`m`)** em ponto flutuante (arredondado a `1e-4 m` = 0,1 mm na serialização, compatível com `motor.py:_coords`). O editor 2D pode operar em `mm` inteiros na UI e converter na entrada/saída sem perda.
- **Sistemas de coordenadas:**
  - `Site` guarda o polígono original em **SIRGAS 2000 / UTM 23S (`EPSG:31983`)** + referencial local `(origem_utm, u, v)` herdado de `motor.py:eixos_da_frente`.
  - Toda geometria de `UnitType`, `FloorPlate`, `Tower` e `SiteLayout` trabalha em **metros locais 2D `(x, y)`** (origem local + ângulo), transformada para UTM apenas na implantação/exportação 3D.
- **Tolerâncias explícitas:** fechamento de área (`tol_area_m2 = 0.01`), colinearidade/snap (`tol_geom_m = 0.001`), interseção proibida (`tol_overlap_m2 = 0.0001`).
- **IDs estáveis:** UUIDv4 ou slug determinístico por entidade (`unit_A`, `room_1`, `wall_1`, `floor_1`, `tower_1`) preservados entre revisões para apontar erros diretamente no 2D/3D.

### 4.2 Entidades da seção 6 do PRD

| Entidade | Campos principais | Papel e vínculo |
|---|---|---|
| `StudyReference` | `study_id`, `study_sha256`, `motor_version`, `lote_id`, `created_at` | Vincula o projeto à revisão imutável do `estudo.json` de origem (`PA-001`). |
| `Site` | `lote_id`, `crs` (`EPSG:31983`), `polygon_utm`, `front_utm`, `local_frame` (`origem`, `u`, `v`), `area_m2`, `envelope_by_height[]` | Terreno + envelope geométrico (recuos/degraus) extraído do estudo. |
| `RuleSetReference` | `zone_id`, `zone_verified`, `lot_zone_verified`, `rules_version`, `params` (`ca_max`, `to_max`, `perm_min`, `recuos`, `nao_computavel`, `areas_especiais`) | Origem normativa e status de conferência de cada parâmetro (`PA-006`). |
| `UnitType` | `id`, `name`, `version`, `outline_m` (polígono externo/eixo), `rooms[]`, `walls[]`, `openings[]`, `metrics` (`privativa_m2`, `util_m2`, `computavel_m2`) | Definição reutilizável de apartamento (ex.: Tipo A 60 m²). Separada das instâncias. |
| `Room` | `id`, `unit_type_id`, `name`, `category` (`sala`/`quarto`/`banho`/`cozinha`/`varanda`/`circ`), `polygon_m`, `area_util_m2` | Polígono ortogonal interno do ambiente. |
| `Wall` | `id`, `a_m`, `b_m`, `thickness_m`, `kind` (`interna`/`externa`/`divisa`/`cega`), `has_window_rule` | Segmento estrutural/divisório pelo eixo, com espessura explícita. |
| `Opening` | `id`, `wall_id`, `kind` (`door`/`window`), `offset_m`, `width_m`, `height_m`, `sill_m` | Abertura ancorada a uma `Wall` por ID estável. |
| `FloorPlate` | `id`, `name`, `outline_m`, `unit_placements[]` (`{id, unit_type_id, x, y, rot_deg, mirror}`), `shared_spaces[]`, `cores[]`, `residuals_m2` | Composição geométrica de um pavimento-tipo, fechando balanço `laje = unidades + áreas comuns + núcleos + resíduo`. |
| `SharedSpace` | `id`, `kind` (`corredor`/`hall`/`lazer`/`garagem`), `polygon_m`, `computable` | Espaço comum explícito no pavimento (sem dupla contagem). |
| `Core` | `id`, `kind` (`escada`/`elevador`/`shaft`), `polygon_m`, `computable` (`false` no COE art. 51) | Núcleo vertical esquemático; marca explicitamente o que não tem verificação de incêndio/acessibilidade. |
| `FloorInstance` | `id`, `tower_id`, `level_index`, `z0_m`, `height_m`, `floor_plate_id`, `kind` (`terreo`/`tipo`/`embasamento`/`subsolo`) | Instância empilhada; permite pavimentos excepcionais. |
| `Tower` | `id`, `name`, `transform_local` (`x`, `y`, `rot_deg`), `floors[]` (`FloorInstance`) | Torre posicionada no terreno com suas instâncias de pavimento. |
| `SiteLayout` | `id`, `towers[]`, `parking_levels[]`, `permeable_area_m2` | Implantação completa no lote. |
| `DesignRevision` | `schema_version`, `revision_id`, `parent_revision_id`, `content_sha256`, `study_ref`, `rules_ref`, `status` (`RASCUNHO`/`REQUER_REVALIDACAO`), `metrics_summary` | Snapshot imutável para salvar, comparar e exportar (`PA-010`). |
| `ValidationFinding` | `rule_id`, `status` (`conforme`/`violacao`/`nao_verificado`/`erro_tecnico`), `severity`, `measured`, `limit`, `unit`, `diff`, `element_ids[]`, `source`, `suggestion` | Diagnóstico explicativo ligado aos IDs estáveis (`PA-006`). |
| `GenerationRun` | `run_id`, `mode` (`manual`/`auto`), `objective`, `seed`, `budget_ms`, `elapsed_ms`, `outcome` (`sucesso`/`impossivel`/`busca_inconclusiva`/`dados_insuficientes`/`erro`), `locked_ids[]` | Registro auditável do gerador (`PA-007`, `PA-008`). |

### 4.3 Ligação ao `estudo.json` atual (adaptador sem quebrar contrato)
Um adaptador puro `estudo_para_contexto_projetista(estudo_json)` lê o `estudo.json` **sem alterar** `motor.py`:
- Extrai `StudyReference` (`versao_motor`, hash do `estudo.json`, `lote.id`).
- Constrói `Site` a partir de `lote.poligono_utm`, `lote.frente` e `caixa_maxima` (`projecao_utm`, `degraus`, `projecao_parede_cega_utm`, `altura_m`).
- Constrói `RuleSetReference` a partir de `zona` e `lote.areas_especiais`, preservando `zona_conferida` e `zona.conferido` para que qualquer regra sem confirmação gere `ValidationFinding` com `nao_verificado`.
- Opcionalmente importa um `opcoes[i].volumes` como massa inicial editável no `SiteLayout`, mantendo `estudo.json` intacto.

---

## 5. Onde guardar os projetos (sem tocar no Firestore de produção)

| Opção | Como funciona | Prós | Contras / Riscos |
|---|---|---|---|
| **1. Arquivos JSON locais por projeto (recomendada para PA-G1..G4)** | Pasta local fora do banco produtivo (ex.: `viabilidade/projetos/<study_id>/<revision_id>.json` ou diretório de dados fora do bundle público), com `DesignRevision` + `content_sha256`. | Zero risco ao Firestore de produção; versionável/testável em CI; funciona offline com Python/JS; fácil migrar depois. | Sem colaboração multiusuário em nuvem até haver API própria. |
| **2. Emulador local do Firestore (Firebase Emulator)** | Rodar coleção `projetista_revisions` apenas no emulador local durante desenvolvimento. | Testa regras de segurança e serialização Firestore desde cedo. | Exige Java/emulador rodando para abrir projetos; acopla cedo demais ao banco antes do esquema estabilizar. |
| **3. Projeto Firebase isolado (staging)** | Banco separado só para piloto interno. | Permite acesso web de operadores no piloto (PA-G5). | Custo de infra e risco de confusão de `.env` se usado antes do PA-G5. |

**Recomendação:** usar **Opção 1 (arquivos JSON locais com esquema versionado e SHA-256)** do PA-G1 ao PA-G4, e só introduzir persistência em nuvem isolada (coleção/projeto separado, nunca o Firestore de produção atual) no **PA-G5 (piloto isolado)**.

---

## 6. Ordem dos portões: PRD vs. proposta da central

O `PRD-PROJETISTA-0.1.md` coloca o **editor manual de uma planta (PA-G1)** antes do **compositor de pavimento (PA-G2)** e do **gerador (PA-G4)**. A central sugeriu inverter para fazer antes um **gerador esquemático de pavimento** em cima do envelope do motor (PA-G2 + começo do PA-G4).

| Critério | Ordem A (PRD: PA-G1 Editor → PA-G2 → PA-G3 → PA-G4) | Ordem B (Central: Gerador esquemático de pavimento primeiro → Editor depois) |
|---|---|---|
| **O que entrega primeiro** | Editor 2D/3D de apartamento isolado (não altera a contagem de unidades da viabilidade). | Pavimentos esquemáticos com unidades + corredor + núcleo dentro da `caixa_maxima` do motor, **melhorando logo a contagem de unidades da viabilidade**. |
| **Custo inicial** | Alto em UI (canvas 2D, snap, undo/redo, sync 3D, aberturas) antes de provar o modelo de pavimento/área. | Menor no início (núcleo geométrico em Python/Shapely + visualização simples no Three.js que já existe). |
| **Risco principal** | Demorar para entregar valor ao estudo de viabilidade e descobrir tarde que o modelo de `UnitType` não encaixa bem em corredores/núcleos reais. | Gerar retângulos bonitos sem editor para corrigir exceções; risco de o usuário achar que o esquema já é planta aprovada se não houver rótulo claro. |
| **Integração com o existente** | Reaproveita ideias do `construtor-planta`, mas exige UI nova para múltiplas unidades. | Conecta direto no `estudo.json` e no visualizador `viabilidade/visual/` já existentes. |

**Recomendação:** **adotar uma Ordem B enxuta e controlada (Núcleo Canônico + Gerador Esquemático de Pavimento primeiro)**, com uma trava obrigatória:
1. Fechar o **núcleo geométrico canônico + validador** (contrato da seção 4) como base única.
2. Entregar **PA-G2 + início do PA-G4 em modo esquemático** (posicionar unidades retangulares + corredor + núcleo dentro do envelope do `estudo.json`, substituindo a divisão cega `por_andar // 60` por encaixe geométrico real).
3. Em seguida construir **PA-G1 (editor manual)** já em cima do mesmo modelo canônico validado, evitando retrabalho de UI sobre um contrato imaturo.

---

## 7. Domínio do primeiro portão

### O que ENTRA no primeiro portão
- **Município/regras:** São Carlos-SP, com o mesmo conjunto de parâmetros já estruturado em `viabilidade/lei/zonas.json` e `viabilidade/motor/motor.py` (sinalizando `nao_verificado` onde `conferido == false`).
- **Lotes:** lotes urbanos simples (polígono válido, frente única identificada, sem dependência de topografia 3D complexa — terreno tratado como plano `z = 0`).
- **Edificações:** edifícios residenciais multifamiliares com **pavimento-tipo repetido**, planta poligonal ortogonal, unidades de 1 nível, circulação horizontal esquemática (corredor duplo ou simples) e 1 núcleo vertical esquemático (escada + elevador + shaft).

### O que FICA FORA no primeiro portão
- Subsolo detalhado com vagas desenhadas (mantém-se a estimativa de área/níveis do motor atual), embasamento comercial complexo, apartamentos duplex/triplex, fachadas não ortogonais, cálculo de iluminação/ventilação natural, acessibilidade NBR 9050 detalhada, rota de fuga/incêndio e projeto executivo.
- **Casa térrea ou sobrado em lote pequeno (88 a 110 m²): FICA FORA do primeiro portão.**
  - *Motivo:* hoje esses lotes dão **0 opções** no motor porque `motor.py` exige `laje_minima_m2 = 80` e desconta `area_comum_por_pavimento_m2 = 40` (`motor.py:PREMISSAS_PADRAO`). Casa unifamiliar não tem hall/elevador condominial nem apartamento-tipo repetido; incluí-la agora exigiria outro modelo de programa (quintal, garagem térrea, edícula/recuo de 1 pavimento) e desviaria o foco do primeiro portão. Deve entrar como **domínio separado** em etapa posterior.

---

## 8. Riscos, perguntas em aberto e critério de saída do PA-G0

### 8.1 Riscos (PRD + novos identificados no código)

| # | Risco | Origem | Mitigação |
|---|---|---|---|
| 1 | Inventar planta irreal por divisão simples de área | PRD | Exigir polígonos sem sobreposição para unidades, corredor e núcleo, fechando balanço geométrico. |
| 2 | Conformidade falsa (usuário achar que o esquema é aprovável) | PRD | Três estados explícitos (`conforme`, `violacao`, `nao_verificado`) e marca d'água/aviso permanente de estudo preliminar. |
| 3 | Divergência entre geometria 2D, 3D e quadro de áreas | PRD | Cálculo único no núcleo canônico (`m`); nunca usar a grade de 5 cm de `floor-plan.js:paredesDaGrade` para medir área. |
| 4 | **Novo:** Confusão entre eixo de parede, face interna (útil) e face externa (privativa/computável) | Código (`modelo.ts` vs `planta-derivada` vs `mobiliar.py`) | Fechar definição operacional antes do PA-G1 e guardar paredes explícitas com espessura no esquema canônico. |
| 5 | **Novo:** Higiene do `estudo.json` herdada (`zona_origem` e `areas_especiais` vazias sem alerta, achados de `REVISAO-6.md`) | Código (`motor.py` / `REVISAO-6.md`) | O adaptador do Projetista deve tratar ausência de confirmação na origem como `nao_verificado`, nunca como liberado. |
| 6 | **Novo:** Escalonamento por `h/8` e parede cega até 12 m mudarem a geometria do pavimento entre andares | Código (`motor.py:recuo_divisa`) | `Site` guarda `envelope_by_height[]` por faixa de pavimento (`degraus`); cada `FloorInstance` valida contra o envelope da sua cota. |

### 8.2 Perguntas em aberto para o usuário (máximo 6)

1. **Definição de área:** Para `area_privativa_m2` das unidades, devemos seguir o critério da **NBR 12721** (inclui paredes internas + 50% das divisórias comuns) ou usar **área interna líquida (útil) + espessura fixa** nesta fase preliminar?
2. **Espessura de parede padrão e cotas:** Podemos adotar **eixo de parede** no modelo canônico com espessura padrão de **0,15 m** (ou **0,13 m**, já usada no renderizador 3D) e exibir cotas internas líquidas na tela?
3. **Ordem dos portões:** Você autoriza seguir a **Ordem B** (fazer primeiro o núcleo canônico + gerador esquemático de pavimento sobre o envelope do `motor.py`, para melhorar logo a contagem de unidades da viabilidade) antes de construir a UI do editor manual (PA-G1)?
4. **Varanda na área computável:** Em `FONTES.md`, o COE art. 51 de São Carlos não isenta varanda expressamente. No Projetista, devemos tratá-la como **computável por padrão** (conservador) até confirmação jurídica?
5. **Lotes pequenos (88–150 m²):** Confirma deixar **casa térrea e sobrado** fora do primeiro portão (foco em edifícios multifamiliares com pavimento-tipo)?
6. **Persistência nos primeiros portões:** Confirma salvar projetos como **arquivos JSON locais versionados** até o PA-G5, sem tocar no Firestore?

### 8.3 Critério de saída do PA-G0
O PA-G0 é considerado concluído quando:
1. Este documento (`viabilidade/projetista/PA-G0.md`) for revisado pelo usuário;
2. As 6 perguntas da seção 8.2 tiverem resposta registrada;
3. Ficar formalmente aprovada a ordem dos portões (Ordem A ou Ordem B) antes de abrir qualquer tarefa de implementação.
