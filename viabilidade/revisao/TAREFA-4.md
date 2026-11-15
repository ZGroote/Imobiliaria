# Tarefa 4 do Revisor — confirmar o conserto da injeção (curta)

HEAD com `relatorio.py` corrigido (tarefa 14 do Visual). Escreva só em `viabilidade/revisao/`. Não commite.

1. Regere **com o código atual** o seu caso `tarefa3/casos/xss-pavimentos.json` (o `tarefa3/browser.cjs` abre o HTML gravado antes do conserto, por isso ainda acusa 2 tags: ajuste o script para gerar na hora). Esperado: o gerador recusa.
2. Tente **um** caminho novo que a validação não cubra: campo opcional ausente da lista, chave inesperada (por exemplo, em `metricas` ou `lote`) com payload, ou payload em **nome de chave**. Prove com parser se gera tag ativa.
3. Leia o teste de mutação do Visual (`relatorio/test_relatorio.py`) e diga se ele de fato troca as folhas numéricas.
4. Uma linha: recomenda fechar o 1B (código)?

`viabilidade/revisao/REVISAO-4.md`, até 15 linhas. Depois: `maestri ask "Claude Code" "Revisor tarefa 4 pronta"`.
