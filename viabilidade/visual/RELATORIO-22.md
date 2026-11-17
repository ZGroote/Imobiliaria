# Tarefa 22 — Maquete e resumo

- `?estilo=maquete` liga a visualização em papel claro, com lajes, janelas nas faces externas das unidades, hall envidraçado, garagem aberta, lote claro, sombra e envelope tracejado com botão. Sem o parâmetro, o visualizador mantém o estilo anterior.
- `?resumo=...` carrega e valida os números no próprio arquivo, sem cálculos no navegador. Usei o resumo real `../projetista/vitrine/terreno-1/resumo.json` e seus estudos relativos com e sem térreo; o botão troca a maquete e os valores juntos.
- A lista “Fora do escopo” da avaliação agora mostra domínio e motivo em texto.
- `node viabilidade/visual/testar.cjs`: passou em desktop e celular, sem erros de console. Inclui testes do estilo, resumo inválido, alternância do térreo, envelope e vista superior.
- Medição do canvas Motor sem `estilo=maquete` contra o HTML commitado: `pixelDifference < 0,001` (limite de 0,1%).
- Prints: `evidencias/tarefa22-22421-maquete.png`, `evidencias/tarefa22-22421-terreo.png`, `evidencias/tarefa22-22421-cima.png` e `evidencias/tarefa22-estudo-motor.png`.

Sem commit. Nenhum arquivo em `viabilidade/projetista/` foi alterado.
