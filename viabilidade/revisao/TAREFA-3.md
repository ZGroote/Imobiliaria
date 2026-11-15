# Tarefa 3 do Revisor — confirmação final do 1B

**Quem:** Revisor (Codex Astra alto). **Galho:** `fix/viabilidade-1b`, HEAD atual (motor 0.8.3 `dc342d0c`, tela/relatório `431a4a83`). Escreva só em `viabilidade/revisao/`. Não commite.

Rodada **curta**: só confirmar que os seus achados foram resolvidos na causa e que nada novo quebrou.

1. **REVISAO-1 (motor 0.8.3):** rode seus 12 pares contra o motor atual (`viabilidade/motor/`, não a referência 0.8.1) e a sua varredura (`revisar.py varredura` e `direcionados`, adaptando para o motor atual). Esperado: 0 perdas de unidades; privativa com tolerância de 0,10 m²; aviso de não monotonia presente nos estudos com garagem computável e vagas > 0.
2. **REVISAO-2 (tela/relatório):** o gerador recusa os 2 casos `xss-numerico-*`; o teste genérico do Visual cobre todos os campos; o CA na tela tem a mesma precisão do relatório; `vendor/LICENSE-three.txt` existe e bate com o SHA do manifesto. (A central já carregou os seus 71 casos na tela atual no Chrome: 0 alertas.)
3. Diga, em uma linha, se **recomenda fechar o portão 1B** (código), com as ressalvas que restarem.

Entrega: `viabilidade/revisao/REVISAO-3.md`, até 30 linhas. Comandos que peçam permissão: deixe o script para a central. Depois: `maestri ask "Claude Code" "Revisor tarefa 3 pronta"`.
