# Revisão 15 — divisa escondida debaixo do texto (T31)

**Commit revisado no galho `viabilidade/cor-quadro`:** `c563af8e` (`terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py`, `terreno/ZONA-AUTO.md`).

## Veredicto

**Sem achados** (`ALTA`, `MÉDIA` ou `BAIXA`).

---

## Conferência dos 5 pontos da tarefa

1. **O furo fechou? — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L244-L259) (linhas 244–259): quando há pixel ignorado pela P1 (`semente = interior.reshape(classes.shape) & ((leitura == 0) | solto)`), `borrao` cresce até `TEXTO_PX = 16` passos dentro de `ignorado` e mede `dm` até `outros` dentro de `DIVISA_M + 4/escala_min`, atualizando `d = min(d, float(dm.min()))`.
   - Testadas 4 variações adversárias sintéticas além do teste unitário (`4496..4520 × 6000..6030`):
     - `diag_texto` (faixa preta inclinada a 45° escondendo a divisa): `RECUSADO` (`Cores de mais de uma zona no polígono amostrado`);
     - `diag_limite` (limite Z1|Z2 em diagonal debaixo de faixa preta de 16 px): `RECUSADO` (`Cores de mais de uma zona no polígono amostrado`);
     - `corrego` (faixa azul sem cor da legenda de 13 px escondendo o limite): `RECUSADO` (`Divisa/cor não zonal a menos de 10 m`, `divisa_mancha_ignorada_m = 0.0`, `candidatas = ['SC-Z2', 'SC-Z1']`);
     - `ponta` (lote cruzando a ponta da faixa preta): `RECUSADO` (`Cores de mais de uma zona no polígono amostrado`).

2. **Lote sem pixel da P1 não muda — sem achados:**
   - Se `not semente.any()`, o bloco da T31 não executa e `d` e `alternativas` permanecem inalterados.
   - Conferidos 5 lotes aceitos (`19`, `25297`, `30516`, `37607`, `25298`) via `Cadastro("completo").gerar([i], "auto")`: `[(19, 'SC-Z3', 99.3, []), (25297, 'SC-Z1', 71.77, []), (30516, 'SC-Z4', None, []), (37607, 'SC-Z4', None, []), (25298, 'SC-Z1', 61.67, [])]`, idênticos ao commit anterior.

3. **A mancha cresce só por pixel sem cor ou parque solto? — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py:247-249`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L247-L249): `ignorado = (classes == 0) | solto` e `borrao = dilatar(borrao, 3) & ignorado | semente`. A máscara `borrao` só pode avançar por pixels sem cor (`classes == 0`) ou de parque solto (`solto`), nunca atravessando branco (`9`), campus (`7`), Represa (`10`) ou qualquer outra zona (`1..6` / parque 3×3).

4. **Candidatas — sem achados:**
   - [`viabilidade/terreno/sugerir_zona.py:257-259, 272`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/terreno/sugerir_zona.py#L257-L259): `for c in gl.np.unique(classes.ravel()[perto][(dm <= DIVISA_M) & zonal.ravel()[perto]]): if 1 <= c <= 6 ...` restringe a inclusão em `alternativas` às classes zonais `1..6` em mancha 3×3 (`zonal`), e `candidatas = [z for z in info["alternativas"] if z in ZONAS]`. Branco, campus, parque e Represa nunca entram como candidata.

5. **`conferir.py`:**
   - `python -I viabilidade/conferir.py`: **8/8 aprovados** (`motor` 70.8s, `terreno` 21.2s, `lote-novo` 58.8s, `estudar` 25.8s, `relatorio` 55.2s, `lei` 0.1s, `visual` 36.5s, `nada fora de viabilidade/ desde origin/main`).
