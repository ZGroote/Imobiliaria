# Visual — tarefa 7

- O validador só exige campos presentes no JSON; campos nulos/ausentes são exibidos como “não informado”.
- Relatório e tela explicam quando nenhuma opção coube; ausentes seguem listadas com motivo e detalhe.
- Teste de auditoria: todos os casos com `lote` validados; 2 registros sem `lote` pulados.
- `python -I -X utf8 viabilidade/relatorio/test_relatorio.py`: 7 testes passaram.
- `node --check viabilidade/visual/testar.cjs`: passou.
- Chrome central não foi executado nesta sessão.
