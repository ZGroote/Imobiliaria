# Auditoria 2 do Motor de Viabilidade (`motor.py` v0.5.0)

Esta auditoria reavalia o motor `viabilidade/motor/motor.py` na versão `0.5.0` (788 linhas), confrontando:
1. Os **28 casos originais** de `auditoria/casos/` (gerados na Auditoria 1 sobre a `v0.4.0`);
2. O status de cada um dos **16 defeitos** apontados em `auditoria/AUDITORIA.md` (**resolvido**, **resolvido pela metade** ou **não resolvido**);
3. O teste adversário das **mudanças novas da v0.5.0** (busca pelo maior prédio em `_melhor`, `pavimentos_sem_ca`, encolhimento por permeabilidade, `caixa_recuada` em lotes em L e triângulos, e cálculo de unidades por andar), com **8 novos estudos** (`9` entradas novas + `8` saídas novas) salvos em `auditoria/casos/`.

---

## 1. Reexecução dos 28 casos da Auditoria 1 na `v0.5.0`

Todos os 28 pares `(lote, zona)` da Auditoria 1 foram reexecutados no `motor.py` `v0.5.0` e submetidos ao verificador `test_motor.confere(estudo)`:

| Caso (`auditoria/casos/`) | Resultado na `v0.4.0` | Resultado na `v0.5.0` (`gerar_estudo` + `confere`) |
|---|---|---|
| `saida-zona-sem-ca-maximo.json` | **CRASH** (`TypeError: NoneType * float`) | Gera A (10 pav), B (10 pav), C (4 pav), **D (12 pav — extrapola `pavimentos_sem_ca=10`)** |
| `saida-em-l-permeabilidade.json` | Subsolo vazava `23,77 m²` para fora do lote | **Corrigido:** subsolo contido no lote (`area_permeavel_m2 = 228,15 m²`) |
| `saida-mono-ca-25.json` → `26.json` | Opção D caía de `2.478` para `2.393 m²` | Neste par, D sobe (`2.660,06 → 2.660,06 m²`), mas **quebra em `saida-mono-ca-20-d` → `25-d`** |
| `saida-mono-to-25.json` → `35.json` | Opção B caía em área privativa; D sumia | Área privativa não cai (`B: 4.676,23 → 4.716,23 m²`), **mas B perde 4 apartamentos (`64 → 60 unid`)!** |
| `saida-mono-recuo-2m5` → `2m0` → `1m5` | A, B e D perdiam área privativa ao afrouxar recuo | Neste lote retangular sem garagem computável mantêm área, **mas D some em `saida-sumico-d-2m0 → 1m5` e B/C/D caem com `garagem_computavel=True`** |
| `saida-em-l-frente-recuada.json` | `eixos_da_frente` invertia frente/fundo | Frente/fundo não invertem mais, mas **`cap_style="square"` morde `4,0 m` da parede lateral interna** |
| `saida-triangular-simetrico.json` | `recuo_fundos` ignorado; B com unidades fatiadas | `recuo_fundos` **continua 100% ignorado**; **Opção B (9 andares, `856 m²`) sai com `0 unidades`!** |
| `saida-triangular-escaleno.json` | `caixa_maxima` desconexa (`MultiPolygon`) | **TODAS as 3 opções aprovadas (A, C, D) saem com `unidades_estimadas = 0` e `vagas = 0`!** |
| `saida-permeabilidade-70.json` | `_cabe()` aprovava `29,8% < 70%` | Passa a respeitar `70%`, mas rotula embasamento recuado como `parede_cega: True` na divisa (`0.00/0.00 m`) |
| `saida-permeabilidade-95.json` | `ZeroDivisionError` quando subsolo esvaziava | Sem crash (`opcoes: []`) |
| `saida-frente-repetida.json` | `ZeroDivisionError` dentro de `gerar_estudo` | `gerar_estudo` retorna `opcoes: []`, **mas `test_motor.confere(est)` trava com `ZeroDivisionError`!** |
| `saida-enorme-20000m2.json` | Torres de 98 pav (`295,5 m`) e subsolo de `17.000 m²` | **Piorou:** A sobe para **103 pav (`310,5 m`)**, B para **108 pav (`325,5 m`)** e D para **103 pav (`310,5 m`)** |
| Demais 14 casos (`quadra1560-*`, `degraus-11`, `parede-cega-baixa`, `abaixo-minimo`, etc.) | Degrau final omitido, `parede_cega_ate_m` > caixa, sem alerta de lote mínimo | Passam em `confere()` com degrau final incluído, `parede_cega_ate_m` truncado e alerta de lote/testada mínimos |

---

## 2. Classificação dos 16 defeitos de `AUDITORIA.md`

### Resumo rápido

| # | Severidade original | Defeito em `AUDITORIA.md` | Status na `v0.5.0` |
|---|---|---|---|
| **1** | ALTA | Crash (`TypeError`) quando `ca_maximo` é `null` (`SC-Z6E`) | **Resolvido pela metade** |
| **2** | ALTA | Subsolo escalado pelo centroide sai da caixa e do lote em L | **Resolvido** |
| **3** | ALTA | Quebra de monotonia na Opção D ao subir CA/TO ou afrouxar recuo | **Resolvido pela metade** |
| **4** | ALTA | Quebra de monotonia nas Opções A e B ao afrouxar recuo ou subir TO | **Resolvido pela metade** |
| **5** | ALTA | `eixos_da_frente` e `caixa_recuada` falham em lotes em L e triângulos | **Resolvido pela metade** |
| **6** | ALTA | Taxa de permeabilidade ignorada em `_cabe()` | **Resolvido** *(com ressalva no rótulo de parede cega)* |
| **7** | MÉDIA | Lentidão severa em `_centros` (busca em grade com ` unary_union` por passo) | **Não resolvido** |
| **8** | MÉDIA | Unidades estimadas somam frações entre andares | **Resolvido pela metade** *(criou bug grave de `0 unidades`)* |
| **9** | MÉDIA | Falta de vagas aprovada + `ZeroDivisionError` em subsolo vazio | **Resolvido pela metade** |
| **10** | MÉDIA | Subsolo ocupa 100% da caixa e gera torres de ~100 andares em lote grande | **Não resolvido** *(piorou para 103–108 andares)* |
| **11** | MÉDIA | Amostragem de `caixa_maxima.degraus` omite o último degrau | **Resolvido** |
| **12** | MÉDIA | Falta de validação para `frente` degenerada e polígono auto-intersectante | **Resolvido pela metade** |
| **13** | MÉDIA | Núcleo não computável fica fora do limite `laje_max` | **Não resolvido** |
| **14** | BAIXA | `parede_cega_ate_m` maior que `caixa_maxima.altura_m` | **Resolvido** |
| **15** | BAIXA | `lote_min_m2` e `testada_min_m` ignorados sem alerta | **Resolvido** |
| **16** | BAIXA | `utm.para_utm23s` aceita `NaN`, `Inf` e coordenadas fora de faixa | **Não resolvido** |

---

### Detalhamento item a item (1 a 16)

#### Defeito 1 — `ca_maximo: null` (`SC-Z6E`) → **Resolvido pela metade**
- **O que melhorou:** `gerar_estudo` não quebra mais com `TypeError` quando `ca_maximo=None` (`saida-zona-sem-ca-maximo.json`).
- **O que ficou quebrado (`motor.py:553-563, 720`):**
  1. **Opção D passa do limite `pavimentos_sem_ca`:** Em `motor.py:559`, quando `ca_maximo is None` e não há limite de gabarito, o motor define `n_max = int(prem["pavimentos_sem_ca"])` (`10`) e registra na incerteza (`motor.py:561`) que *"o motor procurou até 10 pavimentos (premissa pavimentos_sem_ca)"*. Porém, na Opção D (`motor.py:720`), `n_max` é passado como limite apenas da **torre acima do embasamento** (`_melhor(fazer_d, n_max, ctx)`), gerando um edifício de **12 pavimentos** (`2` de embasamento + `10` de torre) em `saida-zona-sem-ca-maximo.json`.
  2. **`altura_max` em `areas_especiais` anula `pavimentos_sem_ca` (`motor.py:557-558`):** Como a cadeia é `if pav_max: ... elif altura_max: n_max = PAV_BUSCA_MAX else: n_max = int(prem["pavimentos_sem_ca"])`, qualquer lote em zona sem CA (`SC-Z6E`) que tenha restrição de cone aeronáutico em `areas_especiais` (ex.: `altura_max_m = 60 m`) cai no `elif altura_max` e ignora `pavimentos_sem_ca`, gerando prédios de 20 andares em zona de expansão urbana sem CA.

#### Defeito 2 — Subsolo escalado pelo centroide sai do lote em L → **Resolvido**
- `_encolhe` (`motor.py:104-114`) foi reescrita com `poly.buffer(-hi, join_style="mitre")` por bisseção. Em `saida-em-l-permeabilidade.json`, o subsolo respeita a caixa e a área permeável mínima (`228,15 m² >= 228,15 m²`) e passa em `test_motor.confere()`.

#### Defeito 3 — Quebra de monotonia na Opção D → **Resolvido pela metade**
- **O que melhorou:** `_melhor` (`motor.py:456-468`) e a escolha entre `base_m` e `base_g` (`motor.py:706-718`) resolveram os 3 pares específicos da Auditoria 1 (`saida-mono-ca-25/26`, `saida-mono-to-25/35`, `saida-mono-recuo-2m0/1m5`).
- **O que continua quebrado (3 falhas novas reproduzidas em `auditoria/casos/`):**
  1. **Sumiço completo da Opção D ao afrouxar o recuo lateral de `2,0 m` para `1,5 m`** (`lote-22x41-sumico-d.json` + `zona-sumico-d-2m0.json` → `zona-sumico-d-1m5.json`, saídas `saida-sumico-d-2m0.json` e `saida-sumico-d-1m5.json`):
     - Com recuo `2,0 m`, a Opção D existe e entrega **12 pavimentos, `903,07 m²` privativos e 10 apartamentos**.
     - Ao afrouxar o recuo para `1,5 m` (mantendo o mesmo lote e `CA = 1,5`), a Opção D **desaparece (`None`)**!
     - **Causa raiz (`motor.py:117-126, 685, 706-711`):** Com `rl = 1,5 m`, a largura útil (`19 m`) permite que o quadrado da torre (`_quadrado`) atinja exatamente o teto `teto_torre = laje_base * 0.9 = 324,72 m²` (`n=1, 2, 3`). Em seguida, `base_m = _cresce(torre, laje_base, mundo_b)` limita o alvo a `min(laje_base, mundo_b.area) = 360,80 m²`. Como a bisseção em `_cresce` retorna `poly.buffer(lo)` (limite inferior da bisseção), `base_m.area` fica ligeiramente **abaixo** de `360,80 m²` (`360,7999 m²`), de modo que `torre.area / base_m.area >= 0.9`! A linha `711` (`if torre.area >= base_l.area * 0.9: continue`) descarta `base_m` e `base_g`, matando a Opção D!
  2. **Queda no número de apartamentos (`unidades_estimadas`) da Opção D e da Opção A ao subir o CA de `2,0` para `2,5`** (`lote-22x41-sumico-d.json` + `zona-mono-ca-20-d.json` → `zona-mono-ca-25-d.json`, saídas `saida-mono-ca-20-d.json` e `saida-mono-ca-25-d.json`):
     - Na **Opção D**, subir o CA de `2,0` para `2,5` aumenta `area_privativa_m2` em `+23,78 m²` (`1.251,02 → 1.274,80 m²`), mas **reduz as unidades de 18 para 16 apartamentos** (cai de 9 andares de torre × 2 unid/andar para 8 andares de torre × 2 unid/andar).
     - Na **Opção A** do mesmo par, subir o CA de `2,0` para `2,5` aumenta `area_privativa_m2` em `+0,49 m²` (`1.593,50 → 1.593,99 m²`), mas **reduz as unidades de 20 para 18 apartamentos** (cai de 10 para 9 andares).
  3. **Queda de `area_privativa_m2` na Opção D (e em B e C) ao afrouxar o recuo quando `garagem_computavel = True`** (`lote-quadra1560-base.json` + `zona-garagem-comp-2m5.json` → `zona-garagem-comp-2m0.json`, saídas `saida-garagem-comp-2m5.json` e `saida-garagem-comp-2m0.json`):
     - Ao afrouxar o recuo de `2,5 m` para `2,0 m`, a Opção D cai de **`3.235,46 m²` para `3.228,32 m²`** (e cai para `3.201,27 m²` com recuo de `1,5 m`).

#### Defeito 4 — Quebra de monotonia nas Opções A e B → **Resolvido pela metade**
- **O que melhorou:** Nos pares antigos sem garagem computável, `area_privativa_m2` de A e B não cai mais.
- **O que continua quebrado:**
  1. **No próprio par antigo `saida-mono-to-25.json` → `saida-mono-to-35.json`**, ao subir a TO de `25%` para `35%`, a **Opção B perde 4 apartamentos**, caindo de **64 unidades (16 pavimentos)** para **60 unidades (15 pavimentos)** (`area_privativa_m2` vai de `4.676,23` para `4.716,23 m²`).
  2. **Com `garagem_computavel = True`** (`saida-garagem-comp-2m5.json` → `saida-garagem-comp-2m0.json`), afrouxar o recuo lateral/fundos de `2,5 m` para `2,0 m` faz `ctx["subsolo"]` crescer de `1.031,56 m²` para `1.078,44 m²` por nível, roubando CA dos pavimentos residenciais e derrubando:
     - **Opção B:** `area_privativa_m2` cai de **`3.644,67 m²` para `3.597,80 m²`**;
     - **Opção C:** `area_privativa_m2` cai de **`2.666,49 m²` (44 unidades)** para **`2.591,48 m²` (40 unidades)**.

#### Defeito 5 — `eixos_da_frente` e `caixa_recuada` em lotes em L e triângulos → **Resolvido pela metade**
- **O que melhorou:** `eixos_da_frente` (`motor.py:70-74`) agora dá o passo de `0,01 m` a partir do meio do segmento `frente`, evitando cair fora do lote quando a frente é só parte da testada.
- **O que NÃO foi resolvido (e o que quebrou na `v0.5.0` em `motor.py:85-100`):**
  1. **Triângulo isósceles (`saida-triangular-simetrico-fundos-10m.json`):** A verificação pedida em `TAREFA-2.md` confirma que **`recuo_fundos` continua 100% ignorado**. No lote `lote-triangular-simetrico.json` (`40 × 50 m`), as duas arestas convergem no fundo `(205020, 7564050)` com produto escalar `d = -0,3714 >= -0,7`. Ambas recebem `rl = 1,5 m` e nenhuma recebe `rb = 10,0 m`. A `caixa_maxima` com `recuo_fundos_m = 10,0 m` tem exatamente os mesmos `704,29 m²` de quando `recuo_fundos_m = 1,5 m`, chegando a `4,04 m` do vértice de fundo (violando em `5,96 m` o recuo de fundos da zona).
  2. **Lote em L com aba interna virada para o fundo (`saida-em-l-aba-fundos.json`):** Na linha `98` (`recuo = rf if d > 0.7 and abs(p) <= tol else rb if d < -0.7 else rl`), o motor verifica a profundidade (`abs(p) <= tol`) para `rf`, mas **não verifica a profundidade para `rb` (`d < -0.7`)**! Em `lote-em-l-aba-fundos.json` (lote de `60 m` de profundidade que estreita de `40 m` para `20 m` na profundidade `y = 15 m`), a parede interna `(205040, 7564015) -> (205020, 7564015)` tem `d = -1,0 < -0,7` e recebe **`recuo_fundos_m = 10,0 m`** em vez de `recuo_lateral_m = 1,5 m`. Isso amputa uma faixa de `10 m × 20 m` no meio do lote (de `y = 5` a `y = 15`), reduzindo a `caixa_maxima` de `803 m²` para `632 m²` e deixando uma tira de `1 m` (`y = 4..5`) quase estrangulada.
  3. **`cap_style="square"` morde paredes laterais em quinas côncavas (`motor.py:100`):** Ao trocar o buffer da aresta para `cap_style="square"`, cada aresta é estendida em `recuo` metros para além dos seus dois vértices. Em `lote-em-l-frente-recuada.json`, o segmento `frente` (`(0,20) -> (35,20)`, com `rf = 4,0 m`) projeta uma ponta quadrada de `4,0 m` para a direita do canto interno `(35,20)`, comendo `4,0 m` de largura da perna direita em `y = 16..24` (onde o recuo lateral deveria ser apenas `1,5 m`). Além disso, `tol = 0.15 * prof` (`motor.py:86`) continua aplicando `rf` a qualquer degrau frontal situado até 15% da profundidade do lote.

#### Defeito 6 — Taxa de permeabilidade ignorada em `_cabe()` → **Resolvido (com ressalva)**
- `_cabe()` (`motor.py:431`) agora reprova opções com `area_permeavel_m2 + 0.5 < lote.area * tp`, e `mundo()` (`motor.py:570-571`) encolhe os polígonos do térreo quando não há subsolo.
- **Ressalva (`motor.py:334-336, 713-715`):** Quando `garagem != "subsolo"` e `taxa_permeabilidade` obriga `mundo(0, 0, livre=True)` a encolher o embasamento da Opção D (como em `saida-permeabilidade-70.json`), o embasamento fica **afastado da divisa**, mas o volume continua com `recuo_lateral_m: 0.0`, `recuo_fundos_m: 0.0`, `parede_cega: True` e alerta `"embasamento 0.00/0.00 m (parede cega na divisa)"`.

#### Defeito 7 — Lentidão severa em `_centros` → **Não resolvido**
- Reconhecido em `motor/RELATORIO.md` ("Ficou pra depois: Velocidade"). O estudo de exemplo leva ~2,5 s (acima da meta `< 1 s` de `test_motor.py:165`), e `lote-enorme-20000m2.json` leva dezenas de segundos.

#### Defeito 8 — Unidades fatiadas entre andares → **Resolvido pela metade (introduziu bug de 0 unidades)**
- **O que mudou (`motor.py:380`):** `unid = int(por_andar // a_unid) * pav_res` parou de somar frações entre andares.
- **Bug novo introduzido (`motor.py:380` vs `laje_minima_m2`):** Com as premissas padrão (`laje_minima_m2 = 80 m²`, `area_comum_por_pavimento_m2 = 40 m²`, `eficiencia = 0.8`, `area_privativa_por_unidade_m2 = 60 m²`), qualquer torre ou lâmina com laje entre **`80 m²` e `99,99 m²`** tem `por_andar` entre `40 m²` e `59,99 m²`, resultando em `int(por_andar // 60) == 0`! O motor aprova o prédio em `_cabe()`, mas devolve **`unidades_estimadas: 0` e `vagas: 0`**:
  - Em `saida-triangular-escaleno.json`, **100% das opções geradas (A com 5 pav, C com 4 pav e D com 6 pav) têm `unidades_estimadas: 0` e `vagas: 0`**!
  - Em `saida-triangular-simetrico.json`, a **Opção B (Duas torres de 9 pavimentos, `856,32 m²` privativos)** tem **`unidades_estimadas: 0` e `vagas: 0`**!
  - Em `saida-em-l-aba-fundos.json`, a **Opção B (Duas torres de 38 pavimentos, `115,5 m` de altura e `3.729,73 m²` privativos)** tem **`unidades_estimadas: 0` e `vagas: 0`**!

#### Defeito 9 — Falta de vagas aprovada e divisão por zero → **Resolvido pela metade**
- `motor.py:388` evita a divisão por zero quando `vagas_por_sub == 0` (`saida-permeabilidade-95.json`), e `test_motor.py:118` confere o alerta `"Faltam vagas: ..."`. Porém, `_cabe()` continua aprovando opções que não atingem `vagas_por_unidade` (ex.: em `saida-em-l-aba-fundos.json`, as Opções A e D precisam de 58 e 54 vagas, mas só entregam 46).

#### Defeito 10 — Subsolo 100% da caixa e prédios de ~100 andares → **Não resolvido (piorou na `v0.5.0`)**
- Reconhecido em `motor/RELATORIO.md`. Na `v0.5.0`, como `_melhor` varre até `n_max = 200` maximizando `area_privativa_m2` e cada pavimento extra ganha `20 m²` de núcleo não computável isento de CA, em `saida-enorme-20000m2.json` os prédios ficaram ainda mais altos que na `v0.4.0`:
  - **Opção A:** subiu de 98 para **103 pavimentos (`310,5 m`)**;
  - **Opção B:** subiu de 69 para **108 pavimentos (`325,5 m`)**;
  - **Opção D:** subiu de 82 para **103 pavimentos (`310,5 m`)**;
  - O subsolo continua ocupando **`17.000 m²` por nível** (`629` vagas para `309` unidades na Opção A).

#### Defeito 11 — `caixa_maxima.degraus` omitia o último degrau → **Resolvido**
- `motor.py:749` passou a usar `[degraus[round(i * (len(degraus) - 1) / 11)] for i in range(12)]`, incluindo sempre o último degrau (`saida-quadra1560-degraus-11.json`).

#### Defeito 12 — `frente` degenerada e polígono em "8" → **Resolvido pela metade**
- **O que melhorou:** `gerar_estudo` (`motor.py:512-522`) faz `poly = poly.buffer(0)` localmente e retorna `_estudo_vazio` se `frente` tiver comprimento `< 1e-6`.
- **O que ficou quebrado:**
  1. `_estudo_vazio` (`motor.py:753`) devolve `lote` com o `frente` degenerado intacto, e `eixos_da_frente` (`motor.py:67`) continua dividindo por `math.hypot(fx, fy)` sem guarda. Ao chamar `test_motor.confere(estudo)` sobre `saida-frente-repetida.json`, **`confere()` quebra com `ZeroDivisionError: division by zero`** (em `test_motor.py:42 → caixa_recuada → eixos_da_frente`)!
  2. Em `gerar_estudo` (`motor.py:514`), `poly = poly.buffer(0)` corrige apenas a variável local `poly`, mas **não atualiza `lote["poligono_utm"]` no estudo retornado** nem protege `caixa_recuada` (`motor.py:85`). Quando um polígono auto-intersectante em "8" (`laco` de `test_motor.py:195`) é passado para `gerar_estudo(laco, zonas["SC-Z1"])`, `gerar_estudo` retorna opções, mas **`test_motor.confere(estudo)` quebra com `shapely.errors.GEOSException: TopologyException: side location conflict`** ao chamar `caixa_recuada(poly, ...)`!

#### Defeito 13 — Núcleo não computável fora de `laje_max` → **Não resolvido**
- Reconhecido em `motor/RELATORIO.md`.

#### Defeito 14 — `parede_cega_ate_m` acima da altura da caixa → **Resolvido**
- `motor.py:760` limita `min( float(zona_p["parede_cega_encosta_ate_m"]), round(altura_caixa, 2))` (`saida-parede-cega-baixa.json`).

#### Defeito 15 — Sem alerta para `lote_min_m2` e `testada_min_m` → **Resolvido**
- `motor.py:577-581` adiciona incertezas explícitas quando a área do lote é menor que `lote_min_m2` ou a frente é menor que `testada_min_m` (`saida-abaixo-minimo.json`).

#### Defeito 16 — `utm.para_utm23s` sem validação de `NaN`/`Inf`/faixa → **Não resolvido**
- Reconhecido em `motor/RELATORIO.md`.

---

## 3. Quebras nas funcionalidades NOVAS da `v0.5.0` (e casos adicionados em `auditoria/casos/`)

Abaixo estão os defeitos encontrados especificamente no código novo introduzido na `v0.5.0`, acompanhados dos novos arquivos de teste em `auditoria/casos/`:

### 3.1. `_melhor` maximiza `area_privativa_m2` contínua, mas `unidades_estimadas` usa truncamento inteiro por andar (`motor.py:380, 456-468`)
- **Onde está no código:** `_melhor` (`motor.py:464`) escolhe o número de pavimentos `n` pela chave `(op["metricas"]["area_privativa_m2"], -n)`. Já `unidades_estimadas` (`motor.py:380`) é `int(por_andar // a_unid) * pav_res`.
- **Como quebra:** Ao subir `CA` ou `TO`, o motor encontra um `n` com alguns centímetros quadrados a mais de `area_privativa_m2` total, mas cuja laje por andar cai logo abaixo de um múltiplo de `a_unid` (ou tem menos andares com o mesmo número inteiro de apartamentos por andar). Resultado: **terrenos com mais potencial construtivo geram menos apartamentos**:
  - `lote-22x41-sumico-d.json` + `zona-mono-ca-20-d.json` (`saida-mono-ca-20-d.json`) vs `zona-mono-ca-25-d.json` (`saida-mono-ca-25-d.json`): subir o CA de `2,0` para `2,5` reduz a **Opção A de 20 para 18 unidades** e a **Opção D de 18 para 16 unidades**.
  - `saida-mono-to-25.json` vs `saida-mono-to-35.json`: subir a TO de `25%` para `35%` reduz a **Opção B de 64 para 60 unidades**.

### 3.2. Filtro `torre.area >= base_l.area * 0.9` + bisseção por baixo em `_cresce` faz a Opção D sumir ao diminuir recuo (`motor.py:117-126, 685, 706-711`)
- **Onde está no código:** Na Opção D (`motor.py:685`), `teto_torre = min(laje_max, laje_base * 0.9)`. Quando o recuo diminui e a torre consegue atingir exatamente `laje_base * 0.9`, `_cresce(torre, laje_base, mundo_b)` (`motor.py:117-126, 706`) faz 32 passos de bisseção e retorna `poly.buffer(lo)`, cuja área fica `~1e-5 m²` **abaixo** de `laje_base`. Em seguida, `if torre.area >= base_l.area * 0.9: continue` (`motor.py:711`) rejeita `base_m` (e `base_g` quando `laje_base >= laje_max_b`), eliminando a Opção D!
- **Caso de prova em `auditoria/casos/`:**
  - `lote-22x41-sumico-d.json` + `zona-sumico-d-2m0.json` → `saida-sumico-d-2m0.json` (Opção D tem 12 pavimentos, `903,07 m²` privativos, 10 unidades).
  - `lote-22x41-sumico-d.json` + `zona-sumico-d-1m5.json` → `saida-sumico-d-1m5.json` (com recuo menor, de `1,5 m`, a Opção D **some**).

### 3.3. Com `garagem_computavel = True`, afrouxar recuos reduz `area_privativa_m2` nas Opções B, C e D (`motor.py:362-363, 567`)
- **Onde está no código:** `ctx["subsolo"]` é sempre igual a `caixa` inteira (ou `_encolhe(caixa, area_sub_max)`). Quando o recuo lateral/fundos diminui, `caixa` fica maior, e cada subsolo passa a consumir mais área computável (`area_gar = n_sub * sub_poly.area`) mesmo sem precisar de mais vagas! Isso rouba área computável dos pavimentos residenciais.
- **Caso de prova em `auditoria/casos/`:**
  - `lote-quadra1560-base.json` + `zona-garagem-comp-2m5.json` → `saida-garagem-comp-2m5.json` (`B: 3.644,67 m²`, `C: 2.666,49 m² / 44 unid`, `D: 3.235,46 m²`).
  - `lote-quadra1560-base.json` + `zona-garagem-comp-2m0.json` → `saida-garagem-comp-2m0.json` (`B: 3.597,80 m²`, `C: 2.591,48 m² / 40 unid`, `D: 3.228,32 m²`).

### 3.4. `caixa_recuada`: `recuo_fundos` ignorado no triângulo isósceles e aplicado por engano a degrau interno de lote em L (`motor.py:85-100`)
- **Onde está no código:** `recuo = rf if d > 0.7 and abs(p) <= tol else rb if d < -0.7 else rl` (`motor.py:98`).
  1. Em lotes triangulares simétricos cujas divisas de fundo formam ângulo fechado (`|d| <= 0.7`), nenhuma aresta satisfaz `d < -0.7` e `rb` nunca é aplicado.
  2. Em lotes em L com degrau interno voltado para o fundo (`d = -1.0 < -0.7`), como não há teste de profundidade para `rb` (ao contrário de `rf`, que testa `abs(p) <= tol`), o motor aplica `recuo_fundos_m` no meio do lote!
- **Casos de prova em `auditoria/casos/`:**
  - `lote-triangular-simetrico.json` + `zona-fundos-10m.json` → `saida-triangular-simetrico-fundos-10m.json` (`caixa_maxima` fica a `4,04 m` do vértice de fundo quando a zona exige `10,0 m`).
  - `lote-em-l-aba-fundos.json` + `zona-fundos-10m.json` → `saida-em-l-aba-fundos.json` (`caixa_maxima` sofre um corte interno de `10,0 m` na metade da profundidade do lote, estrangulando o terreno e gerando na Opção B duas torres de 38 andares com `0 unidades`).

### 3.5. Prédios aprovados com `0 unidades` e `0 vagas` (`motor.py:380, 427-436`)
- **Onde está no código:** `_cabe()` (`motor.py:427-436`) não exige `metricas["unidades_estimadas"] >= 1`, e `laje_minima_m2` (`80 m²`) é menor que a laje necessária para gerar 1 unidade de `60 m²` com `40 m²` de área comum e eficiência `0,8` (`40 + 60 / 0,8 = 115 m²`, ou `40 + 60 = 100 m²` na fórmula atual `por_andar = min((laje - 40), laje * 0.8)`). Qualquer opção com laje entre `80` e `99,99 m²` é aprovada com **`0 unidades`**.
- **Casos de prova em `auditoria/casos/`:**
  - `saida-triangular-escaleno.json` (Opções A, C e D com `0 unidades`);
  - `saida-triangular-simetrico.json` (Opção B com `0 unidades`);
  - `saida-em-l-aba-fundos.json` (Opção B de 38 pavimentos com `0 unidades`).
