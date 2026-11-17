# Tarefa 21 — Visualizador

- Cores discretas para unidade, circulação, núcleo e hall; garagem/subsolo, embasamento e parede cega mantêm suas cores. A legenda mostra somente os usos presentes no estudo.
- O parâmetro `avaliacao` agora carrega e valida a síntese no mesmo endereço, apresentando estado literal, regra de precedência, domínios, pendências, ações, travas, fora de escopo e aviso. O selo não é conferido no navegador. Sem o parâmetro, o painel permanece oculto.
- Teste: `node viabilidade/visual/testar.cjs` passou em desktop e celular, sem erros de console. Cobriu avaliação válida, rejeição de URL externa e os fluxos existentes.
- Comparação do canvas Motor atual com o HTML anterior: diferença abaixo de 0,1% (limite de antialiasing); os usos do estudo antigo mantêm suas cores. A asserção está no teste visual.
- Evidências: `evidencias/tarefa21-22421-sem-avaliacao.png`, `evidencias/tarefa21-22421-com-avaliacao.png` e `evidencias/tarefa21-estudo-motor.png`.

Sem commit, conforme instrução. Os arquivos pendentes em `viabilidade/projetista/` foram preservados.
