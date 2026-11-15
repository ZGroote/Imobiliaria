# Tarefa 11 — preservar medições
JSON agora usa `medicao/<data>-<rotulo>.json`; `MEDIR_ROTULO` define o rótulo, com padrão `hora-HHMM`.
Colisões falham antes de abrir o Chrome e a gravação usa modo exclusivo, sem sobrescrever JSON existente.
`medir.cjs` imprime a tabela Markdown no terminal e não altera `MEDICAO.md`.
`node --check viabilidade/visual/medir.cjs` passou; Chrome/medição ficam para a central.
Arquivos alterados: `medir.cjs` e este relatório. A compressão opcional foi omitida.
