# Tarefa 15 — origem da zona em lote novo
- Tela e relatório exibem os dois rótulos solicitados; as origens novas permanecem não conferidas mesmo com zona_conferida=true no arquivo.
- A tela coloca o aviso amarelo antes dos dados do lote; alternativas e motivo de dúvida aparecem como texto, também escapados no relatório.
- zona_sugestao opcional: objeto; metodo textual; alternativas lista de textos; motivo_duvida texto/null; proporcao_por_zona objeto de números/null; distancia_divisa_m número/null.
- Fixtures derivadas do piloto 22421 trocando a origem; testes adicionais cobrem sugestão maliciosa, tipos inválidos e flag contraditória. Teste de celular verifica aviso sem rolagem.
- Python: 10 testes passaram (85,6 s), incluindo todas as 6.519 mutações sem amostragem; node --check passou.
- Chrome pendente para a central: primeiro servidor retornou 404; com servidor correto, lançamento bloqueado por spawn EPERM. Servidor temporário encerrado; sem commit.
- Arquivos: viabilidade/relatorio/relatorio.py; viabilidade/relatorio/test_relatorio.py; viabilidade/visual/index.html; viabilidade/visual/testar.cjs; viabilidade/visual/RELATORIO-15.md.
