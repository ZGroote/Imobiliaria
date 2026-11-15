# Relatório — Visual tarefa 3

- `index.html`: mantém a interface vinculada à quantidade real de opções e mostra **Relatório para imprimir** quando há HTML pronto para o ID do estudo aberto; o relatório abre em outra aba.
- `testar.cjs`: verifica o link do exemplo e dos sete pilotos, além de um estudo com duas opções.
- Evidências e resumo do navegador: `evidencias/` e `evidencias/teste-browser.json`.
- Teste: `node viabilidade/visual/testar.cjs` — PASS (rodado pela central com servidor local; o sandbox do Codex não abre o Chrome). A central corrigiu o link do relatório do exemplo (o nome do arquivo vem da origem, não do id do lote).
- Escopo: apenas `viabilidade/visual/`; sem commit nem publicação.
- Limites: Chrome headless; sem verificação em aparelho físico.
- Para a central: `maestri ask "Claude Code" "Visual tarefa 3 concluída. Testes ok/falhou."`
