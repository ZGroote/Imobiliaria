# Auditoria 4 do Motor de Viabilidade (`motor.py` v0.7.1 — Rodada Final)

## 1. Execução dos 42 casos de `auditoria/casos/` com `test_motor.confere`

Todos os **42 casos** de `viabilidade/auditoria/casos/` (28 da Auditoria 1 + 8 da Auditoria 2 + 6 da Auditoria 3) foram executados no `motor.py` `v0.7.1`:
- **42 / 42 casos** executam sem exceção, passam em `test_motor.confere(estudo)` e dão saída **100% idêntica entre a 1ª e a 2ª chamada** (`@lru_cache`).
- Os casos que falhavam na `v0.6.0` agora passam:
  - `saida-triangular-escaleno.json`: sem crash (`A: 2 pav, 2 un`, `C: 2 pav, 2 un`).
  - `saida-perm50-recuo-3m0.json` → `1m5.json`: Opção B mantida nos dois (`15 pav, 30 un, 1.849,88 m²`).
  - `saida-trapezio-fundos-10m.json`: `caixa_maxima` a `9,98 m` da divisa de fundos inclinada (respeita os `10,0 m`).
  - `saida-sem-ca-cone-90m.json`: todas as opções respeitam `pavimentos_sem_ca = 10` (`A: 10 pav`, `B: 10 pav`, `C: 4 pav`, `D: 10 pav`).

---

## 2. Status dos defeitos abertos da `AUDITORIA-3.md`

| Item (`AUDITORIA-3.md`) | Assunto | Status na `v0.7.1` | Observação |
|---|---|---|---|
| **Seção 1 / 3.5.1** | Crash `AttributeError` em `saida-triangular-escaleno.json` | **Resolvido** | `maior_retangulo`, `_maior_lamina` e `dois_quadrados` checam `regiao.area <= 0`; `_arestas` ignora não-polígonos (`motor.py:161, 206, 249, 273`). |
| **Defeito 1 / 3.4.1** | `ca_maximo: null` com `altura_max_m` ignorava `pavimentos_sem_ca` | **Resolvido** | Removido o `elif altura_max:`; `pavimentos_sem_ca = 10` e `ctx["pav_cap"]` valem mesmo com gabarito/cone (`motor.py:632-641`). |
| **Defeito 10b / 3.4.2** | Alerta falso `"Parou no teto de projeto"` quando parou por CA/altura | **Resolvido** | `_parou_no_teto` (`motor.py:523-534`) verifica se `n + 1` com `pav_cap = inf` caberia na lei e daria mais unidades/privativa. |
| **Defeito 5 / 3.5.2–3** | `recuo_fundos` em trapézio inclinado, triângulo raso e pentágono | **Resolvido** | `p_fundo` usa a ponta mais funda da aresta e `buffer(rb)` cobre ambas as pontas de arestas de fundos (`motor.py:104-105, 115-116`). |
| **Defeito 7b / 3.6** | `dois_quadrados` retornava `list` mutável no `@lru_cache` | **Resolvido** | Retorna `tuple` (`motor.py:274, 291, 315`) e `maxsize=512`. |
| **Defeito 16** | `utm.para_utm23s` sem validação de fuso e inversão `(lat, lon)` | **Resolvido** | Recusa fora de `lon ∈ [-48, -42]` e `lat ∈ [-80, 0]` (inclusive `NaN`/`inf`) com `ValueError` e avisa quando `(lat, lon)` está invertido (`utm.py:21-23`). |
| **Defeito 4 / 3.1** | Permeabilidade apertada (`_Caixas.fixa_limite`) quebrava monotonia | **Pela metade** | Monotônico para recuo **simétrico** (`rl == rb`), mas **quebra unidades e área** quando o recuo é **assimétrico** (`rl != rb`, ver Seção 3). |
| **Defeito 13** | TO com núcleo não computável (`ocup(k)` / `laje(k)`) | **Pela metade (regressão)** | Soma `k * nucleo` à projeção bruta, mas faz `laje` cair cravada em múltiplos de `20 m²` (`160,0 m²`), onde o arredondamento de `base_utm` quebra `test_motor.confere` (ver Seção 3). |
| **Defeitos 3, 4, 9 / 3.2** | `garagem_computavel = True` (queda de unidades, degrau e `_sub_final`) | **Pela metade** | Documentado em `incertezas` (`motor.py:688-690`), mas mantém queda de unidades ao afrouxar recuo (`44 → 40 un`) e divergência em `_sub_final`. |
| **Defeito 6** | Rótulo `parede_cega: True` (`0.0 m`) quando encolhido por permeabilidade | **Não** | `caixas.mundo(0, 0, livre=True)` (`motor.py:373`) ainda usa `_encolhe` e rotula `0,0 m` mesmo longe da divisa. |
| **Defeito 10a** | Subsolo gigante (`100%` da caixa) quando `garagem_computavel = False` | **Não** | Em `saida-enorme-20000m2.json`, 1 nível de subsolo continua com `17.000 m²` para `180 vagas`. |
| **Defeito 14** | `parede_cega_ate_m = 12` com `altura_m = 0.0` quando `opcoes == []` | **Não** | `min(cega, altura_caixa) if cega and altura_caixa else cega` (`motor.py:845`) devolve `12` quando `altura_caixa == 0.0` (`saida-minusculo-150m2.json`). |

---

## 3. Análise das 4 frentes novas da `v0.7.1`

1. **TO com núcleo (`ocup(k)` / `laje(k)`, `motor.py:626-631`) — Quebra `test_motor.confere(estudo)` na Opção B:**
   - Com `ocup(2) = to_max * A + 2 * 20`, sempre que `to_max * A` é múltiplo de `40 m²` (ex.: lote `20 × 40 m = 800 m²` com `taxa_ocupacao = 0.35`, onde `to_max * A = 280 m²`), o teto por torre em `fazer_b` vira `laje(2) / 2 = (280 + 40) / 2 = 160,0 m²` exatos (`por_andar = 160 - 40 = 120,0 m²` = limiar exato de **2 apartamentos por andar**).
   - `_avaliar` (`motor.py:413`) calcula `unidades_estimadas` usando `v["_geom"].area = 160,0000 m²` (**antes** de arredondar `base_utm`), contando `2 un/andar` (`9 × 2 × 2 = 36 unidades`).
   - Porém, o lado do quadrado (`sqrt(160) = 12,64911... m`) é arredondado em `base_utm` (`_coords`, 2 casas) para `12,64 × 12,64 m = 159,7696 m²` (`por_andar = 119,77 m² < 120 m²` → `1 un/andar`). Ao rodar `test_motor.confere(estudo)`, o teste falha com **`AssertionError: B: unidades 36 != 18 contadas por andar`**.
2. **Limite de permeabilidade (`_Caixas.fixa_limite`) e recuo assimétrico (`motor.py:349-364`):**
   - No caso simétrico (`rl0 == rb0 <= e`), `caixa(e) = caixa_recuada(lote, frente, rf, e, e)` independe do recuo da lei e resolveu a queda da Opção B em `20 × 35 m`.
   - Porém, com **recuo assimétrico** (`rb0 > e > rl0`), `max(e, rb0) = rb0` trava o fundo e usa a bisseção em `e` para ajustar a largura lateral. Quando `rb0` **afrouxa** (ex.: de `10,0 m` para `3,0 m` com `rl0 = 1,5 m`), a profundidade aumenta e a bisseção **aumenta `e` nas laterais** para manter `area_max`, estreitando a caixa:
     - Em lote `22 × 35 m` (`perm = 0.50`, `CA = 3.5`), afrouxar `recuo_fundos_m` de `10,0 m` para `3,0 m` derruba a **Opção A de 39 para 38 unidades** (`2.363,89 → 2.314,87 m²`).
     - Em lote `24 × 40 m` (`perm = 0.55`, `CA = 3.5`), afrouxar `recuo_fundos_m` de `10,0 m` para `3,0 m` derruba a **Opção A de 48 para 46 unidades** (`2.943,86 → 2.899,83 m²`).
3. **Validação do `utm.py` (`utm.para_utm23s`):**
   - Testado com coordenadas de São Carlos, `(lat, lon)` invertido, longitudes fora do fuso 23 (`-60`, `-41.9`), latitudes no hemisfério norte (`+10`) e `NaN`/`inf`: todos os casos inválidos levantam `ValueError` claro sem silenciosamente retornar UTM errado.

---

## 4. Lista final de defeitos remanescentes (por gravidade)

### Gravidade ALTA
1. **Divergência entre `_geom.area` (sem arredondar) e `base_utm` (arredondado a 2 casas) quebra `test_motor.confere` no limiar de unidades (`motor.py:392, 413, 627`):**
   - Com `ocup(k)` somando `20 m²` de núcleo, `laje` cai exatamente em `160,0 m²` (lote `20 × 40 m`, `TO = 0.35`), gerando `unidades_estimadas = 36` na métrica e `18` na geometria `base_utm` exportada (`AssertionError` em `confere`).

### Gravidade MÉDIA
2. **Quebra de monotonia com recuo assimétrico e permeabilidade apertada (`motor.py:356-363`):**
   - Afrouxar `recuo_fundos_m` (`10,0 → 3,0 m`, mantendo `recuo_lateral_m = 1,5 m`) estreita `self.limite` e reduz apartamentos na Opção A (`39 → 38 un` em `22 × 35 m`, `perm = 0.50`; `48 → 46 un` em `24 × 40 m`, `perm = 0.55`).
3. **`garagem_computavel = True`: não-monotonia quando faltam vagas e geometria de `_sub_final` (`motor.py:428-439, 458, 510-515`):**
   - Embora agora documentado em `incertezas`, afrouxar recuo ainda reduz unidades (`44 → 40 un` em `saida-gc-ca50-recuo-3m0 → 1m5`) e `_sub_final` encolhe os subsolos sem atualizar `niveis` nem `area_permeavel_m2`.
4. **Rótulo de parede cega (`0.0 m`) em embasamento encolhido por permeabilidade (`motor.py:371-373, 763, 800`):**
   - `caixas.mundo(0, 0, livre=True)` usa `_encolhe` (diferente de `self.limite`) e mantém `parede_cega: True` / `recuo_lateral_m: 0.0` mesmo quando o volume não toca a divisa.

### Gravidade BAIXA
5. **`parede_cega_ate_m = 12` quando `altura_m == 0.0` em lote inviável (`motor.py:845`):**
   - Em `saida-minusculo-150m2.json` (`opcoes == []`), `altura_caixa` é `0.0` (`bool(0.0) == False`) e `caixa_maxima.parede_cega_ate_m` sai `12` acima do topo `0.0 m` da caixa.
6. **Subsolo sem encolhimento quando `garagem_computavel = False` (`motor.py:433, 513`):**
   - Em lotes muito grandes (`saida-enorme-20000m2.json`), cada nível de subsolo ocupa `100%` da projeção (`17.000 m²` para `180 vagas`).
