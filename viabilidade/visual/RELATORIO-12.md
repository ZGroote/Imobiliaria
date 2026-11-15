# Tarefa 12 — domínio de validade
A tela mostra selo discreto `dentro`, alerta com motivos `fora`/`dados_insuficientes` e oculta o campo em estudos antigos.
O relatório põe o selo na capa e repete o aviso `fora` nos rodapés de todas as páginas.
Fixtures cobrem os quatro casos; o teste visual verifica o alerta `fora` sem rolagem nos dois perfis.
`python -I -X utf8 viabilidade/relatorio/test_relatorio.py` passou (8 testes); `node --check viabilidade/visual/testar.cjs` passou.
Arquivos: `visual/index.html`, `visual/testar.cjs`, `relatorio/relatorio.py`, `relatorio/test_relatorio.py` e este relatório; Chrome fica para a central. Sem commit nem mudanças no Motor.
