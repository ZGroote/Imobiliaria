# Tarefa 14 — validação e escape do relatório
- Validação na entrada: lote (área, polígono, frente), relevo, zona, premissas, caixa/degraus, volumes (pavimentos inteiro ≥ 0, uso conhecido, cotas, recuos e pares numéricos), métricas e textos/listas consumidos; erros com caminho do campo.
- Revisadas 430 interpolações de f-strings do gerador, incluindo HTML/SVG e texto intermediário; escape reforçado em pavimentos, coordenadas, dimensões e atributo de revisão; fragmentos HTML internos preservados.
- Todas as 6.519 folhas dos 8 estudos foram substituídas individualmente, incluindo números, booleanos e null: 5.029 recusas e 1.490 HTMLs sem tags ativas; sem amostragem.
- Caso fixo xss-pavimentos recusado; SVG testado diretamente para comprovar escape sem depender da validação; tipos inválidos de pavimentos também cobertos.
- Verificações: 9 testes Python passaram em 58,5 s; node --check de testar.cjs passou. Chrome fica com a central; testar.cjs inclui 3 mutações e exige zero dialog.
- Arquivos alterados: viabilidade/relatorio/relatorio.py; viabilidade/relatorio/test_relatorio.py; viabilidade/visual/testar.cjs; viabilidade/visual/RELATORIO-14.md.
- Sem commit. A central removeu as duas pastas temporárias cuja limpeza foi bloqueada; nenhuma limpeza adicional pendente identificada.
