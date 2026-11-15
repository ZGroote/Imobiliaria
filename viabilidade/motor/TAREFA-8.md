# Tarefa 8 do Motor — Portão 1B (correções do motor)

**Quem:** Codex (Astra, esforço alto). **Galho:** `fix/viabilidade-1b` (já está nele). **Autorizado pelo usuário em 15/11.**
Mexa só em `viabilidade/motor/` (motor.py, test_motor.py, gerar_pilotos.py, exemplos/) e na seção de contrato do `viabilidade/README.md`. Não commite: a central commita.
**Em paralelo**, o Visual mexe em `viabilidade/visual/` e `viabilidade/relatorio/`: não toque nessas pastas.

Leia antes: `viabilidade/PRD-VIABILIDADE-1.0.md` (§5 VF-007, §5.1, §5.2, Gate 1B), `viabilidade/VERIFICACAO-1A.md` e `viabilidade/auditoria/AUDITORIA-4.md` §3–4.
Regra do PRD: **correções pequenas, um teste por defeito, sem refatoração geral.** O HEAD vale mais que relatório antigo: reproduza cada defeito antes de corrigir (alguns podem já estar resolvidos; diga quais).
Já corrigido na v0.7.1, **não refaça**: ALTA 1 da AUDITORIA-4 (área arredondada; teste em `test_motor.py:362`).

## Defeitos

| # | Defeito (AUDITORIA-4) | O que se espera |
|---|---|---|
| D1 | **MÉDIA 2:** monotonia quebra com recuo assimétrico + permeabilidade apertada (`_Caixas.fixa_limite`). Casos: lote 22×35, perm 0,50, CA 3,5, `recuo_fundos` 10→3 com lateral 1,5 → A cai 39→38 un; lote 24×40, perm 0,55 → 48→46 | Causa raiz em 2–3 linhas; correção que não deixe afrouxar o recuo piorar nenhuma opção; os 2 casos viram teste de regressão + entram no teste de monotonia |
| D2 | **MÉDIA 3:** `garagem_computavel=True`: afrouxar recuo reduz unidades (44→40, caso `saida-gc-ca50-recuo-3m0 → 1m5` em `auditoria/casos/`) e `_sub_final` encolhe o subsolo sem atualizar `niveis` nem `area_permeavel_m2` | Corrigir a inconsistência do `_sub_final` (métricas = geometria final). Para a monotonia: corrigir se couber numa mudança pequena; se não, manter o aviso em `incertezas` **e** dizer no relatório o custo da correção completa |
| D3 | **MÉDIA 4:** parede cega com rótulo `recuo_lateral_m: 0.0` / `parede_cega: True` quando o embasamento encolhido pela permeabilidade não toca a divisa | Rótulo bate com a geometria final |
| D4 | **BAIXA 5:** `caixa_maxima.parede_cega_ate_m = 12` com `altura_m == 0.0` (lote inviável, `saida-minusculo-150m2`) | Sem campo incoerente quando não há caixa |
| D5 | **BAIXA 6:** subsolo com 100% da projeção em lote enorme com `garagem_computavel=False` (`saida-enorme-20000m2`) | Conferir se a v0.7.1 já dimensiona pelas vagas; se não, corrigir |
| D6 | **PRD §5.1:** opção ausente com motivo genérico (C diz sempre "sem área") | **Contrato novo** abaixo, com motivo classificado e detalhe específico vindo do gerador de cada opção |
| D7 | **PRD §5.2:** critério de escolha só no código (`_chave`) | Expor no JSON (abaixo) |
| D8 | **VF-007:** se D1 ou D2 não ficar 100% monotônico, a limitação tem que aparecer em `incertezas` do estudo afetado (não só no relatório) | Aviso automático, só quando o caso se aplica |

## Contrato v5 (aditivo; arquivos v4 continuam válidos)

No JSON do estudo, **novos campos opcionais** (o Visual já vai ler):

```json
"opcoes_ausentes": [
  {"id": "C", "nome": "Lâmina baixa",
   "motivo": "impossivel" | "busca_inconclusiva" | "dados_insuficientes" | "erro",
   "detalhe": "texto curto e específico, ex.: caixa após recuos com 74 m², abaixo da laje mínima de 80 m²"}
],
"criterio_escolha": {"ordem": ["unidades_estimadas desc", "area_privativa_m2 desc", "pavimentos asc"], "texto": "frase curta em pt-BR"}
```

- `impossivel` = geometricamente impossível sob as hipóteses (prove com número); `busca_inconclusiva` = a heurística não achou, mas não está provado que não existe; `dados_insuficientes` = faltou parâmetro; `erro` = exceção capturada.
- Mantenha também a frase em `incertezas` (leitores v4).
- `criterio_escolha.ordem` tem que refletir exatamente o `_chave` atual.
- Atualize a seção de contrato do `viabilidade/README.md` (v5, campos opcionais) e `versao_motor` para **0.8.0**.

## Testes e saída

- Um teste por defeito em `test_motor.py` (nomes claros), mais o teste de monotonia ampliado com D1.
- Os 42 casos da auditoria continuam passando no `confere`.
- Regenere os pilotos e o exemplo pelo `gerar_pilotos.py` (motor 0.8.0).
- Rode: `python -I -X utf8 viabilidade/motor/test_motor.py`. O `conferir.py` completo a central roda (o visual precisa de Chrome).

## Relatório

`viabilidade/motor/RELATORIO-8.md`, até 25 linhas: tabela D1–D8 (reproduzido? causa, correção, teste), o que ficou como limitação declarada e por quê, tempo do teste do motor antes/depois. Depois: `maestri ask "Claude Code" "Motor tarefa 8 pronta"`.
