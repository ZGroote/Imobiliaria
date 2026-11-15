# Tarefa 18 — VGV pelo preço digitado na tela
- Campo "Preço por m² privativo (R$)" logo abaixo do resumo, vazio por padrão. Ao digitar, cada opção ganha a linha "VGV estimado (preço digitado na tela)" = área privativa × preço, formatada com `Intl` pt-BR; o texto de ajuda repete o preço aceito ("Simulando R$ 8.500,00/m² digitado na tela. O estudo não é alterado.").
- O JSON e a revisão não mudam: o preço fica só numa variável da tela, e a troca de opção/lado a lado/estudo novo reaproveita o preço digitado sem refazer a maquete (só atualiza o texto).
- Estudo com preço: a linha dele passa a se chamar "VGV estimado (preço do estudo)" e a simulação aparece embaixo, as duas visíveis. Sem preço continua "Informe o preço".
- Aceita 8500, 8.500, 8500,50, 8.500,50 e "R$ …" (ponto = milhar, vírgula = decimal). Recusa negativo/zero ("O preço precisa ser maior que zero."), texto e "8.5" ("Digite só números…") e acima de R$ 200.000/m²; com erro a linha simulada some e o campo fica `aria-invalid`.
- `testar.cjs` (`checkPriceSimulation`, desktop): 4 formatos aceitos com VGV = área × preço (±R$ 1), lado a lado com as 4 opções, 5 recusas com mensagem, revisão igual, e estudo com preço mostrando os dois rótulos. Ordem de Tab inclui o campo novo.
- `node --check` passou; teste completo no Chrome (8787): PASS nos dois perfis, sem erro de console. Print conferido no celular e no PC; evidências regravadas restauradas.
- Arquivos: `visual/index.html`, `visual/testar.cjs`, este relatório. Sem commit.
