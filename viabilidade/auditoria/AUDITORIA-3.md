# Auditoria 3 do Motor de Viabilidade (`motor.py` v0.6.0)

Esta auditoria avalia o motor `viabilidade/motor/motor.py` na versão `0.6.0` (833 linhas), confrontando:
1. A reexecução de todos os **36 casos** de `auditoria/casos/` (28 da Auditoria 1 + 8 da Auditoria 2);
2. O status de cada defeito da `AUDITORIA-2.md` (**resolvido**, **resolvido pela metade** ou **não resolvido**);
3. O teste adversário das **6 frentes novas da `v0.6.0`**:
   - Critério "mais unidades" (`_chave`);
   - Descarte de opções com `0 unidades`;
   - `pavimentos_max_projeto` (e `pavimentos_sem_ca`);
   - `garagem_computavel = True`;
   - `recuo_fundos` no triângulo (e polígonos irregulares);
   - `@lru_cache` (comparação entre 1ª e 2ª chamada e mutabilidade do retorno).

---

## 1. Reexecução dos 36 casos de `auditoria/casos/` na `v0.6.0`

Dos **36 casos** existentes em `auditoria/casos/`:
- **35 casos** executam até o fim, passam em `test_motor.confere(estudo)` e produzem JSON **idêntico entre a 1ª e a 2ª chamada** (`same12 = True`).
- **1 caso existente (`saida-triangular-escaleno.json`) QUEBRA COM EXCEÇÃO (`AttributeError`) na `v0.6.0`!**

### Regressão crítica na `v0.6.0`: Crash em `saida-triangular-escaleno.json`
- **Entrada:** `lote-triangular-escaleno.json` (`[[205000, 7564000], [205030, 7564000], [205050, 7564040]]`) + `zona-sc-z2`.
- **Erro:**
  ```
  File "viabilidade/motor/motor.py", line 768, in gerar_estudo
    tentativas = [t for t in (tenta_d(False), tenta_d(True) if cega and hb <= cega + 1e-6 else None) if t]
  File "viabilidade/motor/motor.py", line 765, in tenta_d
    return _melhor(fazer_d, min(n_max, pav_cap - nb), ctx)
  File "viabilidade/motor/motor.py", line 737, in fazer_d
    torre = maior_retangulo(regiao_t, 1.0, teto_t)
  File "viabilidade/motor/motor.py", line 203, in maior_retangulo
    ar, sp = _arestas(regiao), math.sqrt(proporcao)
  File "viabilidade/motor/motor.py", line 157, in _arestas
    for anel in [g.exterior, *g.interiors]:
  AttributeError: 'Point' object has no attribute 'exterior'
  ```
- **Causa raiz (`motor.py:153-160, 200-203, 735, 746`):**
  1. Em `fazer_d` (`motor.py:735`), `regiao_t = caixas.local(*r).intersection(cb)` faz a interseção direta **sem** passar por `_maior_parte(...)` (o mesmo ocorre na linha `746`: `regiao_t.intersection(base_livre)`).
  2. Com o novo `Point(p).buffer(rb)` no vértice do triângulo (`motor.py:115`), em `tenta_d(True)` (`base_cega = True`) no andar `n = 27` (`r = (11.0625, 11.0625)`), `caixas.local(*r).intersection(cb)` resulta num **`MultiPoint`** (`is_empty == False`, `area == 0.0`).
  3. `maior_retangulo` (`motor.py:200`) e `dois_quadrados` (`motor.py:267`) testam apenas `if regiao.is_empty:`, sem verificar `if regiao.area <= 0` nem filtrar geometrias não-poligonais. `_arestas(regiao)` itera sobre os `Point` de `MultiPoint.geoms` e tenta acessar `g.exterior`, derrubando o motor.
  4. **Por que o `test_motor.py:225` não pegou:** O `test_motor.py` testou o triângulo escaleno transladado para a origem `[[0, 0], [30, 0], [50, 40]]`, onde o arredondamento de ponto flutuante dá `Polygon EMPTY`, mas nas coordenadas UTM reais `[[205000, 7564000], ...]` de `lote-triangular-escaleno.json` a interseção deixa um `MultiPoint`.

### Tabela resumida dos demais 35 casos de `auditoria/casos/` na `v0.6.0`

| Caso (`auditoria/casos/`) | Resultado na `v0.5.0` | Resultado na `v0.6.0` (`confere` + 1ª vs 2ª chamada) |
|---|---|---|
| `saida-zona-sem-ca-maximo.json` | D com 12 pav (> `pavimentos_sem_ca=10`) | **OK:** A (9 pav, 36 un), B (9 pav, 72 un), C (4 pav, 56 un), D (9 pav, 28 un) |
| `saida-sumico-d-2m0.json` → `1m5.json` | D sumia em `1,5 m` (`10 un → None`) | **OK:** D mantida nos dois (`16 pav, 14 un, 883,57 → 883,61 m²`) |
| `saida-mono-ca-20-d.json` → `25-d.json` | A (`20→18 un`) e D (`18→16 un`) caíam | **OK neste par:** A (`24→24 un`), B (`24→32 un`), C (`24→28 un`), D (`18→18 un`) |
| `saida-mono-to-25.json` → `35.json` | B caía de `64` para `60 un` | **OK neste par:** B mantém `72 un` (`4.596,23 → 4.636,99 m²`) |
| `saida-garagem-comp-2m5.json` → `2m0.json` | B, C e D perdiam área/unidades | **OK neste par:** A (`54 un`), B (`54 un`), C (`52 un`), D (`48 un`) |
| `saida-triangular-simetrico.json` | B saía com `0 unidades` | **OK:** A (`33 un`), B (`6 pav, 12 un`), C (`16 un`), D (`28 un`) |
| `saida-triangular-simetrico-fundos-10m.json` | `caixa_maxima` a `4,04 m` do vértice de fundo | Vértice a `10,0 m`, mas **laterais traseiras continuam a `1,5 m`** (`A: 51, B: 42, C: 16, D: 44 un`) |
| `saida-em-l-aba-fundos.json` | Degrau interno recebia `10 m` de fundos; B com `0 un` | **OK:** degrau interno recebe `1,5 m`; A (`75 un`), B (`72 un`), C (`36 un`), D (`69 un`) |
| `saida-em-l-frente-recuada.json` | `cap_style="square"` mordia `4 m` da lateral | **OK:** quina côncava corrigida; A (`16 un`), B (`32 un`), C (`28 un`), D (`13 un`) |
| `saida-frente-repetida.json` | `confere()` quebrava com `ZeroDivisionError` | **OK:** frente corrigida gravada em `estudo["lote"]`; passa em `confere()` |
| `saida-enorme-20000m2.json` | Torres de 103 a 108 pavimentos | Limitadas a `30 pav` (`A: 180 un`, `B: 360 un`, `C: 744 un`, `D: 168 un`), subsolo ainda `17.000 m²` |
| Demais 20 casos (`quadra1560-*`, `mono-*`, `permeabilidade-*`, etc.) | Passavam em `confere()` | Passam em `confere()` e `1ª == 2ª chamada` |

---

## 2. Status dos defeitos apontados na `AUDITORIA-2.md`

| Defeito na `AUDITORIA-2.md` | Status na `v0.6.0` | Justificativa resumida |
|---|---|---|
| **Defeito 1** (`ca_maximo: null` / `pavimentos_sem_ca`) | **Resolvido pela metade** | A Opção D sem `altura_max` agora respeita `pavimentos_sem_ca = 10` (`embasamento + torre <= 10`). **Porém**, se o lote tiver `areas_especiais` com `altura_max_m` (ex.: cone aeronáutico de `90 m`), o `elif altura_max:` (`motor.py:597`) continua pulando o `else:` e **ignora `pavimentos_sem_ca`**, gerando prédios de 19 pavimentos (`saida-sem-ca-cone-90m.json`). |
| **Defeito 2** (Subsolo fora do lote em L) | **Resolvido** | Mantido resolvido desde a `v0.5.0`. |
| **Defeito 3** (Monotonia na Opção D e sumiço da D) | **Resolvido pela metade** | O sumiço em `22x41` (`sumico-d`) e a queda em `mono-ca-20-d → 25-d` foram corrigidos, **mas** na `v0.6.0` a Opção D ainda perde unidades e área privativa ao afrouxar recuo quando `garagem_computavel = True` e os subsolos enchem (`saida-gc-ca50-recuo-3m0 → 1m5`: D cai de `38` para `36 unidades`). |
| **Defeito 4** (Monotonia nas Opções A, B e C) | **Resolvido pela metade** | `_chave` resolveu o par `mono-to-25 → 35`, **mas** descobrimos novas quebras graves ao afrouxar recuo: (1) sem garagem computável, a **Opção B cai de 30 unidades para `None`** em `saida-perm50-recuo-3m0 → 1m5` e a **Opção C cai de 20 para 16 unidades** em `20x35 perm=0.45`; (2) com `garagem_computavel = True`, **A e B caem de 44 para 40 unidades** em `saida-gc-ca50-recuo-3m0 → 1m5`, e **C perde `-5,27 m²`** em `16x40 CA=3,0`. |
| **Defeito 5** (`caixa_recuada` em L, triângulos e trapézios) | **Resolvido pela metade** | O degrau interno do lote em L (`aba-fundos`) e a quina côncava (`frente-recuada`) foram resolvidos. **Porém**, o `recuo_fundos` via `Point(p).buffer(rb)` falha em lotes trapezoidais com fundo inclinado (`saida-trapezio-fundos-10m.json`, onde a caixa fica a **`1,5 m`** da aresta de fundos em vez de `10 m`), em triângulos rasos (`d = -0,8`) e introduziu o **crash `AttributeError`** em `saida-triangular-escaleno.json`. |
| **Defeito 6** (Permeabilidade e rótulo de parede cega) | **Resolvido pela metade** | A permeabilidade é respeitada, mas `tenta_d(True)` (`motor.py:723, 759`) continua marcando `parede_cega: True` e `recuo_lateral_m: 0.0` mesmo quando `caixas.mundo(0, 0, livre=True)` encolheu o embasamento para longe da divisa. |
| **Defeito 7** (Lentidão) | **Resolvido** | Com `@lru_cache` e teto de pavimentos, o exemplo caiu de `~2,5 s` para `~1,4 s` a frio (`~0,5 s` a quente). *(Ver ressalva sobre mutabilidade em `dois_quadrados` na Seção 3.6).* |
| **Defeito 8** (Opções aprovadas com `0 unidades`) | **Resolvido** *(exceto pelo crash no escaleno)* | `_cabe()` (`motor.py:463`) exige `unidades_estimadas >= 1`. Nenhuma opção sai com `0 unidades` (embora `saida-triangular-escaleno.json` agora trave na Opção D antes de terminar). |
| **Defeito 9** (Falta de vagas aprovada em `_cabe`) | **Resolvido pela metade** | Mantido igual à `v0.5.0`: não divide por zero e gera alerta `"Faltam vagas: ..."`, mas aprova opções abaixo de `vagas_por_unidade` e cria não-monotonia quando `garagem_computavel = True`. |
| **Defeito 10** (Prédios de ~100 andares e subsolo gigante) | **Resolvido pela metade** | `pavimentos_max_projeto = 30` resolveu os prédios de 103–108 andares, **mas** o subsolo em lotes grandes continua ocupando `100%` da caixa por nível (`17.000 m²` para `180` vagas em `saida-enorme-20000m2.json`), e o alerta `"Parou no teto de projeto"` dispara mesmo quando o limite real foi lei (`altura_max_m` ou `CA`). |
| **Defeito 11** (`caixa_maxima.degraus` sem último degrau) | **Resolvido** | Mantido resolvido desde a `v0.5.0`. |
| **Defeito 12** (`frente` repetida e polígono em "8" em `confere`) | **Resolvido** | `gerar_estudo` (`motor.py:550, 560`) atualiza `poligono_utm` e `frente` no `lote` exportado, passando em `test_motor.confere()`. |
| **Defeito 13** (Núcleo não computável fora de `laje_max`) | **Não resolvido** | Reconhecido em `motor/RELATORIO.md` (Seção 4). |
| **Defeito 14** (`parede_cega_ate_m` > `altura_m` da caixa) | **Resolvido pela metade (regressão quando `altura_m == 0`)** | Em `motor.py:805`, o código mudou para `min(cega, altura_caixa) if cega and altura_caixa else cega`. Quando `opcoes == []` (`altura_caixa == 0.0`), `bool(altura_caixa)` é `False` e o motor devolve `parede_cega_ate_m: 12` com `altura_m: 0.0`! |
| **Defeito 15** (Sem alerta de `lote_min_m2` e `testada_min_m`) | **Resolvido** | Mantido resolvido desde a `v0.5.0`. |
| **Defeito 16** (Validação em `utm.para_utm23s`) | **Não resolvido** | Reconhecido em `motor/RELATORIO.md` (Seção 4). |

---

## 3. Análise adversária das 6 novidades da `v0.6.0`

### 3.1. Critério "mais unidades" (`_chave`) — Quebra de monotonia e sumiço da Opção B
O `RELATORIO.md` afirma que, com `_chave = (unidades_estimadas, area_privativa_m2)`, *"afrouxar uma regra mantém o candidato antigo disponível, então unidades nunca caem por construção"*. Isso **não é verdade** em dois cenários geométricos onde o candidato antigo deixa de existir quando o recuo diminui:

1. **Encolhimento por permeabilidade (`_Caixas.fixa_limite`, `motor.py:343-347`) muda a proporção da caixa quando o recuo diminui:**
   - **Caso de prova em `auditoria/casos/`:** `lote-20x35-perm-b.json` (`20 × 35 m`, `700 m²`) + `zona-perm50-recuo-3m0.json` (`saida-perm50-recuo-3m0.json`) vs `zona-perm50-recuo-1m5.json` (`saida-perm50-recuo-1m5.json`), com `garagem_computavel = False` e `taxa_permeabilidade = 0.50` (`area_max = 350 m²`):
     - Com recuo lateral/fundos de **`3,0 m`**, a caixa legal tem `14 × 28 m = 392 m²`. `_encolhe(caixa, 350)` recua `0,51 m` por lado, gerando `limite` de **`12,98 × 26,98 m`**. Na profundidade de `26,98 m`, cabem duas torres quadradas de `80 m²` (`8,94 + 6,00 + 8,94 = 23,89 m`), e a **Opção B entrega 30 pavimentos e 30 apartamentos (`1.849,87 m²`)**.
     - Ao **afrouxar** o recuo lateral/fundos para **`1,5 m`**, a caixa legal alarga para `17 × 29,5 m = 501,5 m²`. Para voltar aos `350 m²`, `_encolhe(caixa, 350)` recua **`1,77 m` de cada lado**, encurtando a profundidade útil de `26,98 m` para **`25,96 m`**! Combinado com o recuo em altura (`caixas.mundo(r, r)` faz interseção com `self.limite`), **a Opção B cai de 30 apartamentos para `None` (desaparece!)**.
     - Pelo mesmo mecanismo (sem garagem computável), em `22 × 40 m` (`perm = 0,45`), afrouxar o recuo de `3,0 m` para `1,5 m` derruba a **Opção B de 40 para 38 unidades**, e em `20 × 35 m` (`perm = 0,45`) derruba a **Opção C de 20 para 16 unidades**.

### 3.2. `garagem_computavel = True` — Queda de unidades, degrau na secante e inconsistência no subsolo
Encontramos **3 problemas** na nova implementação de `garagem_computavel = True`:

1. **Queda de unidades nas Opções A, B e D ao afrouxar recuo no regime "faltam vagas" (`motor.py:411-419`):**
   - **Caso de prova em `auditoria/casos/`:** `lote-20x40-gc-vagas.json` (`20 × 40 m`, `800 m²`) + `zona-gc-ca50-recuo-3m0.json` (`saida-gc-ca50-recuo-3m0.json`) vs `zona-gc-ca50-recuo-1m5.json` (`saida-gc-ca50-recuo-1m5.json`), com `taxa_permeabilidade = 0.15` (padrão da `SC-Z2`) e `CA = 5,0`:
     - Com recuo de **`3,0 m`**, os 2 subsolos comportam `34 vagas` (`918 m²` de garagem computável), sobrando `3.082 m²` de CA para os andares residenciais: **Opção A = 44 unidades (`2.641,80 m²`)**, **Opção B = 44 unidades (`2.641,80 m²`)**, **Opção D = 38 unidades (`2.374,79 m²`)**.
     - Ao **afrouxar** o recuo para **`1,5 m`**, o subsolo (`ctx["subsolo"]`) cresce e passa a comportar `40 vagas` (`1.080 m²` de garagem computável), roubando `162 m²` de CA dos apartamentos: **Opção A cai de 44 para 40 unidades (`2.519,80 m²`)**, **Opção B cai de 44 para 40 unidades (`2.519,80 m²`)** e **Opção D cai de 38 para 36 unidades (`2.330,79 m²`)**!
2. **Descontinuidade em degrau (`n * 27 m²`) engana a secante em `_ajusta_ao_ca` mesmo sem faltar vagas (`motor.py:418-419, 466-490`):**
   - Como `garagem = vagas * 27` depende de `unid` (que é truncado por `int(por_andar // 60)`), toda vez que a laje cruza um múltiplo de `60 m²` privativos no andar, `area_computavel_m2` dá um salto descontínuo de `pavimentos × 27 m²` (`+108 m²` na Opção C de 4 andares).
   - Num lote `16 × 40 m` com `CA = 3,0`, `perm = 0,25` e `garagem_computavel = True` (sem faltar vagas!), afrouxar o recuo de `2,5 m` para `1,5 m` faz a Opção C cair de **`1.173,19 m²` para `1.167,92 m²` (`-5,27 m²`)**, porque em `r = 1,5 m` a laje cheia (`422,5 m²`, 24 unidades) estoura o CA e a secante em `_ajusta_ao_ca` trava abaixo do degrau em `364,97 m²` (menor que os `366,62 m²` de `r = 2,5 m`).
3. **Geometria do subsolo encolhido em `_sub_final` diverge de `_avaliar` (`motor.py:408, 430, 493-498`):**
   - `_avaliar` calcula `niveis` (`motor.py:408`) e `ocupado` (`motor.py:430`) usando `ctx["subsolo"]` inteiro, mas `_sub_final` (`motor.py:497`) exporta `base_utm` encolhido para `alvo = garagem / niveis`. Se `niveis == 2` e as vagas pedem `1,1` subsolo, o motor desenha **dois subsolos encolhidos a `55%` da caixa cada** (em vez de 1 subsolo menor ou 1 cheio + 1 parcial), e calcula `area_permeavel_m2` como se o subsolo não tivesse encolhido.

### 3.3. Opção descartada por `0 unidades` (`motor.py:463, 735`)
- O filtro `m["unidades_estimadas"] >= 1` em `_cabe()` (`motor.py:463`) impediu que opções com `0 unidades` saíssem no JSON final.
- **Porém**, no `saida-triangular-escaleno.json` (justamente o caso da Auditoria 2 onde todas as opções tinham `0 unidades`), o motor agora **trava com `AttributeError`** dentro de `tenta_d(True)` antes de concluir o estudo (ver Seção 1).

### 3.4. `pavimentos_max_projeto` e `pavimentos_sem_ca` (`motor.py:586, 597-603, 669-670`)
1. **`pavimentos_sem_ca` continua ignorado quando há `altura_max_m` (`motor.py:597-601`):**
   - **Caso de prova em `auditoria/casos/`:** `lote-cone-90m.json` + `zona-sem-ca-maximo.json` → `saida-sem-ca-cone-90m.json`.
   - Quando a zona tem `ca_maximo: null` e o lote tem um `cone_aeronautico` de `90 m`, o `elif altura_max:` pula o `else: n_max = pr["pavimentos_sem_ca"]`. O estudo gera **Opção B com 19 pavimentos (114 unidades)** e **Opção D com 16 pavimentos (56 unidades)**, ignorando o limite `pavimentos_sem_ca = 10` e omitindo a incerteza sobre `pavimentos_sem_ca`.
2. **Alerta falso `"Parou no teto de projeto..."` (`motor.py:669-670`):**
   - A condição `if m["pavimentos"] >= pr["pavimentos_max_projeto"] and not (zp.get("pavimentos_max") and zp["pavimentos_max"] <= pr["pavimentos_max_projeto"]):` dispara mesmo quando o prédio atingiu `pavimentos_max_projeto` porque **o CA acabou exatamente naquele pavimento** ou porque **`altura_max_m` (gabarito/cone aeronáutico da lei)** travou a altura naquele pavimento. O alerta afirma ao usuário que *"Parou no teto de projeto ... (escolha de projeto, não é lei)"* quando na verdade um andar a mais seria ilegal pelo CA ou pelo gabarito.

### 3.5. `recuo_fundos` no triângulo e em lotes irregulares (`motor.py:103-116`)
1. **Crash `AttributeError` no triângulo escaleno (`saida-triangular-escaleno.json`):** ver Seção 1.
2. **Lote trapezoidal com fundo inclinado ignora `recuo_fundos_m` (`motor.py:104, 114-115`):**
   - **Caso de prova em `auditoria/casos/`:** `lote-trapezio-fundo-inclinado.json` (`[(205000,7564000), (205040,7564000), (205040,7564050), (205000,7564030)]`) + `zona-fundos-10m.json` → `saida-trapezio-fundos-10m.json`.
   - A aresta de fundos `(205040,7564050) -> (205000,7564030)` tem normal voltada para o fundo (`d = -0,894 < -0,7`), mas seu ponto médio está na profundidade `p = 40 m < pmax - tol = 42,5 m`.
   - A linha `104` (`d < -0.7 and p >= pmax - tol`) classifica a aresta de fundos como **lateral (`1,5 m`)**, e a linha `115` aplica o raio de `10 m` **apenas no vértice `(205040, 7564050)`**. Com isso, a `caixa_maxima` fica a apenas **`1,50 m` da divisa de fundos** (violando os `10,0 m` da zona em `8,50 m`)!
3. **Triângulo raso (`40 × 15 m`) e pentágono assimétrico:**
   - Num triângulo `[(0,0), (40,0), (20,15)]`, as duas arestas traseiras têm `d = -0,8 < -0,7`, mas `p = 7,5 < 12,75`, recebendo `1,5 m` em vez de `rb`.
   - Num lote pentagonal `[(0,0), (40,0), (40,45), (20,50), (0,30)]`, o trecho traseiro direito `(40,45)->(20,50)` tem `fundos = True` (`p = 47,5 >= 42,5`), o que desativa o fallback `not any(f for *_, f in arestas)` da linha `114`, enquanto o trecho traseiro esquerdo `(20,50)->(0,30)` (`d = -0,707`, `p = 40 < 42,5`) recebe `fundos = False` e fica a **`1,5 m`** da divisa de fundos.

### 3.6. `@lru_cache` (`motor.py:194, 238, 262`) — 1ª vs 2ª chamada e mutabilidade
- **1ª vs 2ª chamada de `gerar_estudo`:** Nos 35 casos de `auditoria/casos/` que não quebram, o resultado da 1ª e da 2ª chamada de `gerar_estudo(lote, zona)` é **100% idêntico** (geometrias do Shapely 2 são imutáveis e comparam igualdade exata de coordenadas no hash).
- **Defeito de contrato em `dois_quadrados` (`motor.py:262, 309`):** `dois_quadrados` é decorada com `@lru_cache(maxsize=4096)` mas retorna uma **`list` mutável** (`return quadrados` / `return []`) em vez de `tuple`. Se qualquer chamador externo (ou código futuro no motor) modificar a lista retornada (ex.: `res.clear()`, `res.pop()`, `res.append(...)`), a lista guardada dentro do `lru_cache` é corrompida e **a 2ª chamada com os mesmos argumentos devolve o valor adulterado** (confirmado em teste: 1ª chamada retorna `len == 2`; após `res.clear()`, a 2ª chamada retorna `len == 0`).
