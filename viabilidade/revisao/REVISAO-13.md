# Revisão 13 — frente estreita, juntada e avenida (T27)

**Commit revisado no galho `viabilidade/sem-frente`:** `2f3fdb28` (`terreno/gerar_lotes.py`, `terreno/novo_lote.py`, `terreno/test_novo_lote.py`).

## Veredicto

- **0 achados `ALTA`**, **0 achados `MÉDIA`**, **1 achado `BAIXA`** (`lote["frente"]` como reta única pode mascarar `testada_min_m` em frente quebrada).

---

## Achados

### [BAIXA] Frente quebrada: `lote["frente"]` (reta do primeiro ao último pedaço) pode omitir a incerteza de `testada_min_m` no motor
- **Onde:** [`viabilidade/terreno/gerar_lotes.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/gerar_lotes.py#L339-L342) (linhas 339–342), [`viabilidade/terreno/novo_lote.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/novo_lote.py#L300-L301) (linha 301) e [`viabilidade/motor/motor.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/motor/motor.py#L814-L816) (linhas 814–816).
- **Descrição:** Na frente juntada, `f["pontos"]` vai do início do primeiro pedaço ao fim do último (`[gr[0]["pontos"][0], gr[-1]["pontos"][1]]`), incluindo o vão (até `5 m`) e eventuais dentes `< 2 m`. Como `motor.py:814` calcula `testada = LineString(frente).length`, a testada lida pelo motor fica maior que a soma dos pedaços válidos (`f["comprimento_m"]`).
  - No lote `4851` (`SC-Z2`, `testada_min_m = 10`): `comprimento_m = 5.24 m` (`[2.965, 2.275]`), mas `LineString(frente).length = 9.806 m`. Como `9.806 < 10`, o motor ainda emite a incerteza (`"Testada de 9.8 m abaixo do mínimo da zona (10 m)..."`), apenas com o valor inflado.
  - Em um lote onde a soma dos pedaços válidos é `< testada_min_m` (ex.: `3,5 + 3,5 = 7,0 m` com vão de `4,5 m`, totalizando corda de `11,5 m >= 10 m`), o motor deixa de emitir a incerteza de testada abaixo do mínimo da zona.
  - Classificado como **`BAIXA`** porque `testada_min_m` no motor não altera cálculos nem libera/bloqueia opções (apenas acrescenta uma frase em `estudo["incertezas"]`), e `novo_lote.py:279-281` já grava `"AVISO: frente quebrada no cadastro... Conferir a testada na matrícula."` em `lote["observacoes"]`.
- **Como reproduzir:**
  - Lote `4851`: `Cadastro("completo").gerar([4851], "auto")` gera `comprimento_m = 5.24` e `math.dist(*lote["frente"]) = 9.806`; `motor.gerar_estudo(...)` registra `"Testada de 9.8 m abaixo do mínimo da zona (10 m)..."`.
  - Caso em que omite a incerteza: lote com dois pedaços de `3,5 m` separados por recuo de `4,5 m` (com fundo do recuo além de `12 m` do asfalto ou bloqueado por vizinho), em zona com `testada_min_m = 10`: `comprimento_m = 7,0 m`, `LineString(frente).length = 11,5 m` e `motor.py:815` não entra no `if`.

---

## Conferência dos 6 pontos da tarefa

1. **Lote sem frente de verdade aceito — sem achados:**
   - Condomínio, via particular e estacionamento continuam fora porque `frentes_curtas` reutiliza `frentes_ampliadas` e `frentes_osm` (`OSM_FRENTE` exclui `service`, `parking_aisle`, `private`, `driveway`, `track`, `unclassified`, `footway`).
   - Sobre a trava `largura_media(g, pontos)` (`gerar_lotes.py:297-302, 350-352`, `area / profundidade`): em lote bandeira ou em L com corpo largo e raso (ex.: corredor de `5,5 m × 15 m` ligado a corpo de `15 m × 10 m`, área `232,5 m²`, profundidade `25 m` → largura média `9,3 m`, metade `4,65 m <= 5,5 m`), um corredor de `5,5 m` também passaria pela trava se não fosse barrado antes por "encostar em outro lote" no OSM; no sorteio real de 500 lotes (`RELATORIO-27.md`), todos os 29 novos aceitos foram conferidos em imagem de satélite e nenhum era lote de fundo/bandeira, condomínio ou estacionamento.

2. **Juntada (B) — sem achados:**
   - [`gerar_lotes.py:323-327`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/gerar_lotes.py#L323-L327): `("via_osm" in f) == ("via_osm" in h)` impede misturar pedaço de asfalto do cadastro com pedaço de via do OSM.
   - O critério de mesmo nome do OSM (`f["via_osm"]["nome"] == h["via_osm"]["nome"]`) só junta pedaços consecutivos no contorno do **mesmo lote** com distância `<= 5 m` e diferença angular `<= 30°`, então não junta duas ruas distintas homônimas em locais diferentes.
   - Observação de limite já esperado: `junta()` não testa se o segmento do vão (`<= 5 m`) cruza um lote vizinho, mas em recortes de contorno de lote (`<= 5 m`) o impacto é o mesmo descrito no achado `BAIXA` acima.

3. **Testada exagerada — 1 achado `BAIXA` (acima).**

4. **Lotes já aceitos não mudam — sem achados:**
   - [`gerar_lotes.py:372-395`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/gerar_lotes.py#L372-L395): `C` (avenida a `11 m`) roda apenas dentro de `frentes_osm` (Regra 4, quando Regras 1, 2, 3 e `frentes_borda` não acharam frente); `A` e `B` (`frentes_curtas`) rodam apenas quando `not frentes` após todas as regras antigas (inclusive `frentes_osm`).
   - Conferidos 5 lotes já aceitos (`19`, `25297`, `30516`, `37607`, `25298`): todos mantiveram exatamente as mesmas frentes originais (`frente_curta` ausente).

5. **Avenida (C) — sem achados:**
   - [`gerar_lotes.py:255-277`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/gerar_lotes.py#L255-L277): mesmo com `OSM_EIXO_LARGA_M = 11` para `primary` e `secondary`, `frentes_osm` continua exigindo `miolo` livre de vizinhos (`> 0,5 m`) e que `ponte = sh.shortest_line(amostras[1], eixo)` não atravesse o próprio lote nem outro lote (`<= 0,5 m`), impedindo que lote de fundo atrás de outro lote seja aceito.

6. **`conferir.py`:**
   - `python -I viabilidade/conferir.py`: **8/8 aprovados** (`motor` 83.1s, `terreno` 25.6s, `lote-novo` 59.6s, `estudar` 28.0s, `relatorio` 67.8s, `lei` 0.1s, `visual` 45.5s, `nada fora de viabilidade/ desde origin/main`).
