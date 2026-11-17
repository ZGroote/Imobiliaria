# Revisão 14 — texto e córrego não recusam (T30)

**Commit revisado no galho `viabilidade/cor-quadro`:** `753feaaa` (`terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py`, `terreno/ZONA-AUTO.md`).

## Veredicto

**Sem achados** (`ALTA`, `MÉDIA` ou `BAIXA`).

---

## Conferência dos 5 pontos da tarefa

1. **Zona errada aceita — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L216-L237) (linhas 216–237): ignorar pixel sem cor (`amostras == 0`) e parque solto dentro do lote continua exigindo que `>= 50%` dos pixels do interior pertençam à zona (`gl.np.mean((amostras >= 1) & (amostras <= 6)) < .5` recusa), que `len(zonas) == 1` (mistura de zonas recusa) e que não haja traço de Eixo a até `60 m` (`eixo`, linhas 196–202).
   - A divisa de `10 m` (linhas 221–237) continua verificando todas as manchas 3×3 px de outras zonas, campus e parque, além de branco e Represa sem filtro 3×3, num raio de `250 m` (`d < 10 m` recusa), pegando faixas de outra zona ao redor/fora do texto.
   - Áreas especiais (ZEIS, APP etc.) são lidas por `areas_especiais.py` nos anexos dedicados, não no Anexo 02, portanto não são afetadas pelo filtro de texto/córrego em `sugerir_zona.py`.

2. **Branco, campus e Represa — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L206-L218) (linhas 206–218): `crua = classes.ravel()[interior]` lê a classe antes de `recuperar_tracos`.
   - `branco` (`mancha(classes == 9, 3)`) e `campus` (`mancha(classes == 7, 3)`) geram motivos próprios de recusa; qualquer pixel cru isolado de branco ou campus (`solto = ((crua == 9).any() and not branco) or ((crua == 7).any() and not campus)`) também recusa com o motivo genérico; e `(crua == 10).any()` (Represa, filtrada 5×5 em `classificar`) também recusa sempre (seja pelo motivo genérico quando `not (branco or campus)`, seja já recusado por `branco`/`campus`). Nenhum caminho deixa de recusar.

3. **Mensagens — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py:169-174`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L169-L174): `x1 < 250` usa o limite direito (`x1`) do `pixel_pol.bounds`, garantindo que o aviso de Ibaté só apareça quando o lote está **inteiramente** a oeste da borda (`x = 250`).
   - [`viabilidade/terreno/sugerir_zona.py:209-215`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L209-L215): as mensagens `"Fora do perímetro urbano do Anexo 02"` e `"Campus universitário: não é zona do art. 25"` só saem com mancha de 3×3 px no interior do lote; 1–2 pixels soltos recusam com a mensagem genérica sem afirmar campus/fora do perímetro.

4. **Aceitos antigos não mudam — sem achados:**
   - Conferidos 5 lotes aceitos (`19`, `25297`, `30516`, `37607`, `25298`) via `Cadastro("completo").gerar([i], "auto")`: `[(19, 'SC-Z3', 99.3, []), (25297, 'SC-Z1', 71.77, []), (30516, 'SC-Z4', None, []), (37607, 'SC-Z4', None, []), (25298, 'SC-Z1', 61.67, [])]`, idênticos ao comportamento anterior.

5. **`conferir.py`:**
   - `python -I viabilidade/conferir.py`: **8/8 aprovados** (`motor` 84.2s, `terreno` 24.2s, `lote-novo` 65.4s, `estudar` 31.8s, `relatorio` 67.3s, `lei` 0.1s, `visual` 41.0s, `nada fora de viabilidade/ desde origin/main`).
