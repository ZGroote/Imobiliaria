# T24: divisa falsa pela borda da linha de rua (16/11)

1. **O que mudou:** na `distancia_divisa_m`, o pixel de **outra zona** só conta como divisa se fizer mancha de 3×3 px ou mais. É a mesma `mancha()` da candidata da T23: agora as manchas das 6 zonas são calculadas uma vez e usadas nas duas coisas (a lista de candidatas sai igual). **Cor não zonal (branco, campus, parque, Represa) continua contando como antes**, sem filtro. `DIVISA_M = 10.0` não mudou. Coloquei uma linha no `ZONA-AUTO.md`. O texto `metodo` que vai no `lote.json` ficou como estava, para não mudar os lotes aceitos.
2. **Sorteio de 500 (semente 20261120), com o mesmo caminho do `novo_lote --zona auto`:**

| motivo | antes | depois |
|---|---:|---:|
| **aceito** | **214** | **238** |
| sem frente | 118 | 118 |
| zona: só a divisa, 1 candidata | 66 | **42** |
| zona: vários motivos | 24 | 24 |
| zona: fora do quadro | 22 | 22 |
| buraco | 18 | 18 |
| zona: cor insegura | 17 | 17 |
| sobreposição | 12 | 12 |
| zona: só a divisa, 2 candidatas (`so_divisa`) | 6 | 6 |
| zona: mais de uma zona | 2 | 2 |
| invade o asfalto | 1 | 1 |

**24 passaram de recusados para aceitos** (todos vinham de "só a divisa, 1 candidata"). Lista com zona e nova distância (antes): 62747 Z5A 10,16 (0); 75573 Z5A 11,57 (0); 58471 Z5A 11,62 (0); 67157 Z5A 13,10 (0); 80037 Z2 15,05 (5,57); 70807 Z2 15,11 (1,03); 62659 Z5A 17,36 (0,91); 51058 Z2 23,61 (1,72); 6847 Z5A 28,25 (0); 53350 Z2 31,89 (9,63); 4593 Z2 33,10 (0); 68044 Z5A 38,36 (0); 60164 Z2 41,24 (3,73); 58832 Z5A 45,80 (0); 55464 Z5A 51,51 (0); 60688 Z5A 53,98 (0); 65275 Z5A 64,54 (0); 8378 Z5A 65,63 (0); 70659 Z5A 70,70 (0); 67006 Z5A 82,74 (1,85); 58121 Z5A 97,09 (0); 13663 Z5A 176,15 (0); 59422 Z5A 197,48 (4,43); 34124 Z4 sem divisa a até 250 m (6,23). Ficaram 17 em Z5A, 6 em Z2 e 1 em Z4.
3. **Conferência no Anexo 02:** abri os **24** (são menos de 40). Os 24 são de zona única, com linha cinza de rua, texto ou rodovia ao lado (a faixa laranja do 4593 é "Rodovias" na legenda, e a linha vermelha do 55464 é o "Perímetro Urbano"). **Nenhum está numa divisa.** O único com zona de verdade por perto é o **70807**: o Z1 fica na quadra do outro lado do cruzamento, a 15,11 m (distância conservadora), e a quadra do lote é toda Z2. Prints em `evidencias/t24/`: `aceitos-24.png` (os 24, na ordem da lista, 6 por linha), `70807-z1-do-outro-lado.png` (círculo ciano no pixel que dá a distância).
4. **Nos 214 já aceitos:** zona, `alternativas`, frente, geometria e o resto do `lote.json` ficaram iguais. Comparei os lotes inteiros, só sem a lista de `pontos`, que não depende da divisa. Só a `distancia_divisa_m` mudou, e só para cima: **subiu em 57** (de +0,17 m a +142 m, mediana +19 m) e **virou `null` em 28** (nenhum limite reconhecido a até 250 m; antes ficava entre 47 e 243 m). Os outros 129 não mudaram (42 já eram `null`).
5. **Os 6 `so_divisa` da T23 continuam iguais:** 86154, 85446 e 90050 (Z4|Z3), 88768 (Z3|Z4), 10913 e 63335 (Z2|Z3).
6. **Pilotos:** `novo_lote --testar` passa igual. Pela leitura do mapa, mudou só o número da distância: o **25297** (aceito, Z1) foi de 71,38 para 71,77 m; o **22421** foi de 12,93 para 14,44 m; o **22426** foi de 3,74 para 14,05 m e perdeu o motivo "divisa", mas segue recusado pelo Eixo e pela cor insegura. O 75352–75354 continua a 9,23 m, recusado, com uma candidata só.
7. **Por que 24 e não 65 (a conta do RELATORIO-23):** a medida da T23 também filtrava a cor não zonal; esta tarefa manda manter. Os 42 que continuam recusados por divisa estão **todos** presos num pixel "parque". Abri 6 (54722, 56754, 52760, 17026, 22938, 62849): é de novo a borda da linha cinza de rua, agora sobre o amarelo do Z2, caindo na cor do Pq. Ecológico (print `parque-na-borda-da-rua.png`). Medi sem aplicar: se campus e parque também precisassem de mancha de 3×3, **40 dos 42** passariam; os 2 que sobram (22938, 23353) ficam presos no branco. Fica como proposta. Isso é decisão sua, porque mexe na regra "cor não zonal conta sempre".
8. **Ponto para você decidir (não mexi):** as `alternativas` continuam sem filtro, como pede a T23. Por isso, 23 dos 24 novos aceitos saem com a zona falsa da linha nas alternativas (SC-Z5B, ou SC-Z1 no 80037, 4593 e 60164; no 70807 há Z1 de verdade, mas a mais de 10 m). O relatório mostra isso como "Alternativas: SC-Z5B." Se quiser, a mesma mancha resolve isso nas alternativas também.
9. **Teste:** o caso sintético `linha_z5b` (borda de 2 px na cor do Z5B colada ao lote), que antes recusava, agora sai aceito em Z1, com `distancia_divisa_m` nula. A divisa real Z2|Z1 continua recusando, e as candidatas continuam `["SC-Z2","SC-Z1"]`. A vizinha branca continua recusando, com uma candidata só. O 90050 continua `so_divisa` Z4|Z3. **Passaram:** `novo_lote --testar` (que roda o `test_sugerir_zona`), `gerar_lotes --testar`, `test_ponto.py` e `conferir.py` **8/8**. Não toquei em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`, e não commitei.
