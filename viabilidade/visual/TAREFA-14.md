# Tarefa 14 do Visual — fechar a injeção no relatório de vez (REVISAO-3)

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/relatorio/` e `viabilidade/visual/`. Não commite (só você não commita; a central commita).

O Revisor achou mais um caminho, que a central reproduziu: `opcoes[].volumes[].pavimentos` entra **sem `esc()`** no `<title>` do SVG (`relatorio.py:336`, `{pavs}`). Payload em `viabilidade/revisao/tarefa3/casos/xss-pavimentos.json`, que hoje gera **2 `<img onerror>` ativas**. O teste genérico da tarefa 13 só trocava valores que **já eram texto**, por isso não pegou.

## O que fazer (exaustivo, não pontual)

1. **Validação de tipos na entrada do gerador para o estudo inteiro**, não só a zona e as métricas: `volumes[]` (pavimentos inteiro ≥ 0, altura_m, z0_m, recuos numéricos, `base_utm` lista de pares numéricos, `uso` de uma lista conhecida), `caixa_maxima`, `premissas`, `lote` (área, polígono, frente), `relevo`. Tipo errado = `ValueError` com o caminho do campo.
2. **Escape em toda interpolação** no `relatorio.py`: revise **cada** f-string que monta HTML/SVG/atributo. Nenhum valor vindo do JSON pode entrar cru, nem número (use `esc(str(x))` ou o formatador escapado). Liste no relatório quantas interpolações revisou.
3. **Teste genérico de verdade** em `test_relatorio.py`: para cada um dos 8 estudos, percorra **todas as folhas** do JSON (strings, números, booleanos, `null`) e, para cada uma, troque o valor pelo payload `</title><img src=x onerror=alert(1)><svg>`. Para cada mutação, o gerador **recusa** (ValueError) **ou** gera HTML com **zero** tags ativas (`<img`, `<script`, `on*=` fora de texto). Pode ser lento: amostre se passar de ~2 min, mas cubra todo tipo de campo (todas as chaves distintas). O caso `xss-pavimentos` entra fixo.
4. Mesma ideia na **tela**: o `testar.cjs` carrega 3 mutações representativas (um número de volume, um texto de incerteza, um campo do lote) e exige zero `dialog`.
5. `python -I -X utf8 viabilidade/relatorio/test_relatorio.py`, `node --check`. O Chrome a central roda (e também `viabilidade/revisao/tarefa3/browser.cjs`).

Relatório: `viabilidade/visual/RELATORIO-14.md`, até 8 linhas (campos validados, interpolações revisadas, mutações testadas, arquivos alterados). Depois: `maestri ask "Claude Code" "Visual tarefa 14 pronta"`.
