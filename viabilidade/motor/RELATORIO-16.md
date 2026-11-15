# Relatório do Motor, tarefa 16: por que lote pequeno dá poucas opções?
**É a lei e a geometria, não a busca.** 40 lotes de 250–800 m², base `completo`, semente 20261115 (24 zona automática, 16 zona sugerida); nenhum tem as 4 opções. Das 125 ausências, a busca fina não achou nenhuma que o motor tivesse perdido.

| Opção | ausente | busca | lei: laje < 80 m² | laje 80–100 m² (não dá 1 apto de 60 m²) |
|---|---|---|---|---|
| A / B | 39 / 40 | 0 / 0 | 25 / 34 | 14 / 6 |
| C / D | 6 / 40 | 0 / 0 | 2 / 39 | 4 / 1 |

**Prova** (`busca_fina.py`, fora do motor, mesmas funções de conferência do motor; passos de 0,1 m na laje e 0,5 m na posição): nas 35 opções que o motor gerou, ela achou as 35; nas 125 ausentes, 0. Não houve "caso busca" para mostrar.
**75902:** frente de 12,2 m, sobram 9,2 m de largura (8,2 m do 3º pavimento em diante). Maior quadrado: 84,9 m², só 44,9 m² privativos, menos que os 60 m² de um apartamento (premissa de projeto, não lei: 60 m² por apto, 40 m² de circulação); precisa de laje ≥ 100 m². Só a lâmina C cabe. O CA (1.554 m²) nunca é o limite; o limite é a largura depois dos recuos.
**Mudou:** nada no `motor.py` nem no `test_motor.py`. Novos: `busca_fina.py` e `amostra_lotes_pequenos.py` (refaz o sorteio). Sem commit.
**Texto do motivo (proposta, não aplicada, mexeria nos pilotos):** "Depois dos recuos de 1,50 m sobra uma faixa de 9,2 m; a maior torre quadrada tem 84,9 m², 44,9 m² privativos por andar, menos que os 60 m² de um apartamento (precisa de laje de 100 m²)". Para laje < 80: "a laje que sobra depois dos recuos tem X m², abaixo da mínima de 80 m²".
