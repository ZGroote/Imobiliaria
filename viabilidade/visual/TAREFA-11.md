# Tarefa 11 do Visual — medir.cjs sem apagar medições anteriores

**Quem:** Codex (Visual). **Galho:** `fix/viabilidade-1b`. Só `viabilidade/visual/`. Não commite (a central commita).

Problema: ao rodar de novo, o `medir.cjs` **sobrescreve** o `MEDICAO.md` e o `medicao/<data>.json`. A central teve de restaurar a linha de base com CDN à mão (commit desta tarefa).

1. `medir.cjs` grava `medicao/<data>-<rotulo>.json`, onde `<rotulo>` vem de `MEDIR_ROTULO` (padrão: `hora-HHMM`). Nunca sobrescreve: se o arquivo existir, falha.
2. Não reescreve o `MEDICAO.md`: imprime a tabela Markdown na saída padrão (a central cola) ou acrescenta uma seção nova no fim, com data, rótulo e o nome do JSON. Não apague seções existentes.
3. Opcional, só se for simples: `MEDIR_COMPRESSAO=1` mede servindo os arquivos com gzip (um servidor Node mínimo dentro do próprio script, só para medir), porque o Hosting comprime e o `http.server` não.
4. `node --check`. A central roda.

Relatório: `viabilidade/visual/RELATORIO-11.md`, até 6 linhas. Depois: `maestri ask "Claude Code" "Visual tarefa 11 pronta"`.
