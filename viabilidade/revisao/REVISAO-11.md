# Revisão 11 — galho `viabilidade/duas-zonas`

**Commits revisados contra `origin/viabilidade/pos-124`:**
- `bdc5e3e4` — Terreno T23 (`terreno/sugerir_zona.py`, `terreno/novo_lote.py`, `terreno/test_sugerir_zona.py`, `terreno/LOTES.md`)
- `d667bd9b` — Visual T21 (`relatorio/relatorio.py`)
- `bb6bd246` — Motor T29 (`motor/estudar.py`, `motor/motor.py`, `motor/varrer.py`, `motor/test_estudar.py`, `motor/test_varrer.py`)

*(Nota: a worktree atual contém trabalho não commitado da T24 em `terreno/sugerir_zona.py`; a análise abaixo refere-se aos commits listados acima.)*

## Veredicto

- **0 achados `ALTA`**, **0 achados `MÉDIA`**, **1 achado `BAIXA`** (em `visual/varredura.html` com `status = "divisa"`).

---

## Achados

### [BAIXA] `visual/varredura.html`: consumidor do `varredura.csv` omite lotes `divisa` da contagem e do filtro de status
- **Onde:** [`viabilidade/visual/varredura.html`](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/visual/varredura.html#L45) (linha 45), [linha 61](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/visual/varredura.html#L61) e [linhas 167-168](file:///C:/Users/respawn/Desktop/imobiliaria-viabilidade/viabilidade/visual/varredura.html#L167-L168).
- **Descrição:** O `varredura.html` não quebra nem gera erro ao carregar linhas com `status = "divisa"` produzidas por `motor/varrer.py`, e o link de maquete (`lote.status === 'estudo'`, linha 135) é corretamente omitido. Porém:
  1. A contagem no topo (`#contagem`, linhas 167-168) soma apenas `estudo`, `recusa` e `erro`, deixando lotes `divisa` de fora (a soma no topo fica menor que o total mostrado em `#mostrando`).
  2. O `<select id="filtro-status">` (linha 45) não possui `<option value="divisa">`, impedindo filtrar lotes na divisa, e `ROTULO` (linha 61) não mapeia `divisa` (exibe `"divisa"` sem capitalização).
- **Como reproduzir:** Gerar uma varredura incluindo o lote `90050` (como em `motor/test_varrer.py`, raio de `15 m` em volta do centroide do `90050`) e abrir a pasta em `visual/varredura.html?pasta=...`.

---

## Conferência dos 6 pontos da tarefa

1. **Estudo que finge certeza — sem achados:**
   - `terreno/sugerir_zona.py` (`bdc5e3e4`): `so_divisa` só fica `True` quando `len(motivos) == 1 and motivos[0].startswith("Divisa/") and len(candidatas) > 1`. Qualquer outro motivo (mais de uma zona no polígono, Eixo, cor insegura) ou divisa com `<= 1` candidata mantém `so_divisa = False` e `candidatas = []`, levantando `ZonaIncerta`.
   - `terreno/novo_lote.py`: `Cadastro.gerar` com `auto:SC-Zx` exige que `sugerir(pol)` levante `ZonaIncerta` (lote sem dúvida recusa com `"O mapa não tem dúvida de zona neste lote: use --zona auto"`) e exige `zona[5:] in s["candidatas"]`. Mantém `zona_conferida: False`, `zona_origem: "candidata_na_divisa"` e `"confirmar a zona na Prefeitura."` em `observacoes`.
   - `motor/motor.py` e `motor/estudar.py`: `candidata_na_divisa` injeta `alerta_divisa` em todas as opções (`"Lote na divisa entre zonas (...): confirmar a zona na Prefeitura."`) e registra `NÃO conferido` em `incertezas`. Mesmo se apenas uma candidata gerar estudo em `_estudar_divisa`, ela preserva `candidata_na_divisa`, `zona_conferida: False`, o alerta por opção e o `resumo.txt` comparativo com o aviso da Prefeitura.

2. **Candidata falsa ou perdida — sem achados:**
   - `terreno/sugerir_zona.py` (`bdc5e3e4`): o filtro `mancha(classes == ZONAS.index(z) + 1, 3)` aplica abertura morfológica 3×3 (`MinFilter(3)` + `MaxFilter(3)`), removendo bordas anti-aliased de 1–2 px (traços/textos) e preservando faixas reais de 3 px ou mais (~4,2 m, como nos casos `90050` e `85446`).
   - Cor não zonal nunca vira candidata: `ZONAS` contém apenas `SC-Z1`..`SC-Z5B` (classes `1..6`), `info["alternativas"]` só adiciona `1 <= c <= 6` (ou `"SC-EIXO"`, que impede `so_divisa`), e `candidatas` exige `z in ZONAS`.

3. **Gravação — sem achados:**
   - `motor/estudar.py`: `_conferir_pasta(pasta)` continua recusando pasta existente não vazia antes de calcular. `_estudar_divisa` calcula todas as candidatas e o `resumo.txt` em memória antes de chamar `_gravar(pasta, arquivos)`. Em qualquer `BaseException`, `_gravar` remove os arquivos criados e executa `rmdir()` nas subpastas e em `pasta` (quando criada por ele).

4. **Relatório — sem achados:**
   - `relatorio/relatorio.py` (`d667bd9b`, linhas 991-1000): `comuns` exige `len(opcoes) > 1` e `all(a in (op.get("alertas") or []) for op in opcoes)`, nunca escondendo alerta parcial. Cada célula mantém os alertas não comuns, a caixa acima da tabela exibe `comuns`, e cada folha individual (`_gerar_pagina_opcao`, linha 1326) mantém a lista completa. `_li_alerta` preserva `esc(texto)` intacto.

5. **`varrer` — 1 achado `BAIXA` (acima):**
   - `motor/varrer.py` gera uma linha com `status = "divisa"`, `zona = "divisa: ..."`, `estudo_json = "lotes/<i>/resumo.txt"`, agrupada em `## Recusados e erros` no `RESUMO.md`. O consumidor `visual/varredura.html` não quebra, mas omite `divisa` de `#contagem` e `#filtro-status`.

6. **Lote aceito, zona informada, pilotos e `conferir.py`:**
   - `python -I -X utf8 viabilidade/motor/test_motor.py` -> `ok` (inclui pilotos e `test_8b`).
   - `python -I -X utf8 viabilidade/motor/test_varrer.py` -> `ok`.
   - `python -I -X utf8 viabilidade/relatorio/test_relatorio.py` -> `Ran 10 tests ... OK`.
   - `python -I -X utf8 viabilidade/motor/test_estudar.py` -> `ok` (antes da alteração solta da T24 atingir o disco).
   - `python -I viabilidade/conferir.py` (executado com a worktree atual contendo T24 não commitada em `terreno/sugerir_zona.py`): `executados 8 | aprovados 6 | reprovados 2` (`motor`, `terreno`, `relatorio`, `lei`, `visual` e `nada fora de viabilidade/` aprovados; `lote-novo` reprovado com `StopIteration` e `estudar` reprovado com `AssertionError: divisa com uma candidata só devia recusar`, ambos causados pelo trabalho solto da T24 que alterou a classificação de `75352-75354`, fora dos commits revisados).
