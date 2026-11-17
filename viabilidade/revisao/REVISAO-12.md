# Revisão 12 — resto do galho `viabilidade/duas-zonas`

**Commits revisados (de `bb6bd246` até `HEAD`):**
- `f87a5280` — Terreno T24 (`terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py`, `terreno/ZONA-AUTO.md`)
- `f3bd6404` — Terreno T25 + Motor T30 (`terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py`, `terreno/ZONA-AUTO.md`, `motor/test_estudar.py`)
- `270c096e` — Visual T22 (`visual/varredura.html`)

## Veredicto

**Sem achados** (`ALTA`, `MÉDIA` ou `BAIXA`).

---

## Conferência dos 5 pontos da tarefa

1. **Lote aceito que devia ser recusado — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L210-L213) (linhas 210–213): `zonal |= mancha(classes == c, 3)` para `c in range(1, 9)` (zonas `1..6`, campus `7` e parque `8`), e `outros = ((classes > 8) | (zonal & (classes != codigo))).ravel()`.
   - Branco (`9`) e Represa (`10`) continuam sem filtro 3×3 nessa etapa (Represa mantém apenas o filtro 5×5 de `classificar`).
   - Abertura morfológica 3×3 (`MinFilter(3)` + `MaxFilter(3)`) apaga, por definição, qualquer faixa com menos de 3 px de largura (~4,2 m a ~1,4 m/px), inclusive uma eventual faixa real de 2 px (~2,8 m) se existisse no raster; trata-se da limitação documentada em [`ZONA-AUTO.md`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/ZONA-AUTO.md#L15), e os casos reais de parque/campus (`68495`, `40015`, `68491`) continuam recusados.

2. **Alternativas — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L223-L236) (linhas 223–236): `classes.ravel()[proximos & zonal.ravel()]` aplica o mesmo filtro 3×3 às `alternativas` (como `mancha(M, 3) ⊆ M` e as classes são disjuntas, `zonal & (classes == c)` equivale exatamente a `mancha(classes == c, 3)`). `candidatas = [z for z in info["alternativas"] if z in ZONAS]` e `so_divisa` permanecem coerentes com `alternativas`.

3. **Aceitos que mudam além do combinado — sem achados:**
   - Entre `bb6bd246` e `f3bd6404`, o diff em `sugerir_zona.py` restringe-se ao bloco `if len(zonas) == 1:` no cálculo de `outros` (`distancia_divisa_m`) e `proximos` (`alternativas`/`candidatas`).
   - Conferidos 5 lotes aceitos (`19`, `25297`, `30516`, `37607`, `25298`) via `Cadastro('completo').gerar([i], 'auto')`: `[(19, 'SC-Z3', 99.3, []), (25297, 'SC-Z1', 71.77, []), (30516, 'SC-Z4', None, []), (37607, 'SC-Z4', None, []), (25298, 'SC-Z1', 61.67, [])]` — apenas `distancia_divisa_m` e `alternativas` variam.

4. **`varredura.html` — sem achados:**
   - [`viabilidade/visual/varredura.html`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/visual/varredura.html#L130) (linha 130): um status desconhecido não quebra a página (`ROTULO[v] || v` exibe o valor literal).
   - [Linha 176](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/visual/varredura.html#L176): para os 4 status emitidos por `motor/varrer.py` (`estudo`, `recusa`, `erro`, `divisa`), a soma no `#contagem` bate com `"Mostrando N de N lotes"`.

5. **`conferir.py`:**
   - `python -I viabilidade/conferir.py`: **8/8 aprovados** (`motor` 96.6s, `terreno` 25.7s, `lote-novo` 64.0s, `estudar` 33.0s, `relatorio` 72.6s, `lei` 0.1s, `visual` 42.5s, `nada fora de viabilidade/ desde origin/main`).
