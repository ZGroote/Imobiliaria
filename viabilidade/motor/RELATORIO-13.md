# Motor, tarefa 13 (15/11): um comando do lote ao relatório

`motor/estudar.py --base completo --indices 30516 --zona SC-Z4 --pasta DESTINO [--premissas p.json]` grava `lote.json`, `estudo.json`, `relatorio.html` e `resumo.txt` (lote, área, zona "informada, não conferida", domínio, opções, ausentes com motivo, revisão = 12 primeiros do sha256 do `estudo.json`).
Encadeia por **import**, no mesmo processo: `novo_lote.Cadastro.gerar` → `motor.gerar_estudo` → `relatorio.gerar_html`. Sem subprocesso. O `-I` não põe as pastas no path, então o script as adiciona; `motor.py`, `gerar.py`, terreno, relatório, tela e `conferir.py` não foram tocados.
Tudo é calculado antes de gravar. Pasta inexistente ou vazia: ok; pasta com arquivos: erro `já existe e não está vazia`. Qualquer falha (a mensagem da etapa sai inteira, ex. "sem frente", "Zona inexistente") ou erro de gravação apaga o que a execução criou, inclusive a pasta nova.
Revisão: `estudo.json` sai no mesmo formato do `gerar.py` e o hash é o dos bytes gravados; o `<meta name="estudo-sha256">` e o "rev …" do relatório batem (testado).
`test_estudar.py` passa: (a) 30516/SC-Z4 = piloto (opções, ausentes, domínio, caixa, premissas, zona); (b) 8697/SC-Z4, fora dos pilotos, 3 opções + 1 ausente, 4 arquivos; (c) índice inexistente, zona inexistente, lote sem frente, pasta com arquivos e falha no meio da gravação não deixam pasta nem alteram a existente; (d) revisão. `test_motor.py` passa ("ok").
Diferença conhecida do piloto: o alerta "ÁREA ESPECIAL" do 30516 vem do enriquecimento manual (`areas_especiais`) que o lote do cadastro não traz, então o estudo novo não o tem. O teste ignora só esse alerta. Áreas especiais continuam "não verificadas" nas observações do lote.
Tempo ponta a ponta (processo novo, máquina com outros trabalhos rodando): 10,5 s (8697) e 17,8 s (30516); a leitura de base/ruas/raster é o grosso (~6 s no medido do Terreno).
Sem commit. Novos: `estudar.py`, `test_estudar.py`, este relatório.
