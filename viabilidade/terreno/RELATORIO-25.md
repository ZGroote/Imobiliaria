# T25: parque e campus só contam em mancha, e alternativas com o mesmo filtro (16/11)

1. **O que mudou:**
   - Na `distancia_divisa_m`, o pixel de **campus** e de **parque** agora só conta como divisa se fizer mancha de 3×3 px ou mais. É a mesma `mancha()` que já filtrava as zonas na T24.
   - **Branco e Represa continuam contando sempre.** A Represa já vem filtrada em 5×5 no `classificar`.
   - As **`alternativas`** usam o mesmo filtro: zona que aparece só em pixel solto não entra mais na lista. A lista de candidatas sai dela, então também fica igual à T24.
   - `DIVISA_M = 10.0` não mudou. Tirei uma linha que tinha ficado sem uso (`perto = ...`). Atualizei o `ZONA-AUTO.md`: a regra e o texto do piloto 75352–75354.
2. **Sorteio de 500 (semente 20261120), mesmo caminho do `novo_lote --zona auto`:**

| motivo | antes (T24) | depois |
|---|---:|---:|
| **aceito** | **238** | **278** |
| sem frente | 118 | 118 |
| zona: só a divisa, 1 candidata | 42 | **2** |
| zona: vários motivos | 24 | **17** |
| zona: cor insegura | 17 | **24** |
| zona: fora do quadro | 22 | 22 |
| buraco | 18 | 18 |
| sobreposição | 12 | 12 |
| zona: só a divisa, 2 candidatas (`so_divisa`) | 6 | 6 |
| zona: mais de uma zona | 2 | 2 |
| invade o asfalto | 1 | 1 |

   - **40 passaram de recusados para aceitos.** Todos vinham de "só a divisa, 1 candidata", são os 40 que a T24 tinha medido.
   - **Os 2 que continuam** (22938, 23353) estão presos no branco, que segue contando sempre.
   - **7 recusados perderam o motivo "divisa"**, mas continuam recusados por cor insegura: 55625, 60197, 57190, 62964, 12545, 21498, 23086. Por isso "vários motivos" caiu 7 e "cor insegura" subiu 7.
   - **Os 40 novos aceitos** (zona, nova distância, distância antes):
     - 69996 Z2 17,95 (8,44)
     - 54511 Z5A 21,97 (9,12)
     - 105815 Z2 23,78 (6,38)
     - 68057 Z5A 25,66 (3,61)
     - 71784 Z2 43,23 (0)
     - 75207 Z2 59,68 (2,67)
     - 65714 Z2 62,77 (1,07)
     - 70852 Z2 73,41 (7,36)
     - 56180 Z2 79,36 (1,11)
     - 62849 Z2 80,85 (5,25)
     - 76121 Z2 88,49 (4,49)
     - 52760 Z2 89,57 (7,38)
     - 54880 Z2 94,59 (4,44)
     - 8514 Z2 102,82 (0,76)
     - 84869 Z2 110,61 (0)
     - 73381 Z2 173,89 (9,55)
     - 86440 Z2 183,30 (2,13)
     - 4512 Z2 186,07 (9,72)
     - 21101 Z5A 214,73 (8,17)
     - 81641 Z2 214,88 (2,75)
     - 52445 Z2 236,97 (0,66)
     - 85738 Z2 245,41 (0)
     - Sem divisa a até 250 m (`null`): 54722 (9,5), 56754 (1,17), 17026 (0), 13158 (5,7), 84153 (3,84), 73195 (0), 16073 (0,86), 82697 (8,89), 58641 (9,79), 73349 (0), 76572 (1,15), 84944 (0), 10492 (6,79), 11119 (2,01), 53064 (8,38), 5153 (1,34), 76568 (1,03), 69784 (4,52).
     - Ficaram **37 em Z2 e 3 em Z5A**. Todos saem com `alternativas` vazia.
3. **Conferência no Anexo 02: abri os 40.**
   - **Nenhum está numa divisa nem colado a parque ou campus de verdade.** Todos estão numa zona só, com linha cinza de rua, texto, rodovia ou hidrografia ao lado.
   - O único com outra zona de verdade por perto é o **69996**: o Z1 ocre fica do outro lado da rua, a 17,95 m (distância conservadora).
   - No **54511**, "PARQUE" é texto do nome do bairro, não um parque.
   - O **105815** fica perto da linha vermelha do Perímetro Urbano e da faixa laranja de Rodovia.
   - No **84869** e no **8514**, a linha azul é hidrografia.
   - Prints em `evidencias/t25/`:
     - `aceitos-40.png`: os 40 na ordem da lista acima, em 4 folhas de 3 por linha (12/12/12/4): 1ª no alto à esquerda, 2ª no alto à direita, 3ª embaixo à esquerda, 4ª embaixo à direita.
     - `campus-68495-e-parque-40015.png`: os casos de mancha grande do item 5.
     - `piloto-75352.png`: o piloto do item 7.
4. **Nos 238 já aceitos:** zona, frente, geometria e o resto do `lote.json` ficaram iguais. Mudaram só a distância e as alternativas:
   - A `distancia_divisa_m` **subiu em 79** (de +0,06 m a +211 m, mediana +61 m) e **virou `null` em 24**. Os outros 135 não mudaram (71 já eram `null`).
   - **23 perderam alternativa:** 20 perderam SC-Z5B e 4 perderam SC-Z1 (60164, 80037, 4593 e 70807; o 70807 perdeu os dois). São os 23 da T24 que tinham a zona falsa da linha nas alternativas (RELATORIO-24, item 8). Nenhum lote perdeu zona de verdade.
5. **Parque e campus grandes continuam divisa** (lotes reais, conferidos no recorte):
   - **68495** (Z1) colado ao campus.
   - **40015** (Z3) colado a um parque.
   - Os dois recusam com distância 0, e a única alternativa é a zona do próprio lote.
   - Como o 68495 é recusado antes pela frente, no `gerar(..., "auto:SC-Z1")` o teste usa o vizinho **68491**, que tem frente e recusa por "fora das candidatas na divisa".
6. **Os 6 `so_divisa` continuam iguais:** 86154, 85446 e 90050 (Z4|Z3), 88768 (Z3|Z4), 10913 e 63335 (Z2|Z3).
7. **Pilotos: um muda de resultado, um muda só a lista.** Não mexi em `lotes-piloto.json` nem na linha de base do motor.
   - **75352–75354: era recusado e agora é aceito em Z2**, igual à zona manual. Antes recusava pela divisa a 9,23 m, com alternativas `[SC-Z2]`. Agora a distância é `null` (nenhum limite reconhecido a até 250 m).
     - Os 9,23 m vinham de um pixel solto de "parque" na borda da linha cinza da Av. Carlos Botelho. Na imagem, o lote está todo no amarelo do Z2 (`piloto-75352.png`).
     - Agora `Cadastro.gerar(ids, "auto")` também aceita Z2, e o vizinho 75351 continua consertado com make_valid. O extra 75355, do mesmo quarteirão, também ficou `null`.
   - **22426:** a distância continua 14,05 m, mas as alternativas perderam o SC-Z5B falso: `[Z1, EIXO, Z5B]` virou `[Z1, EIXO]`. Continua recusado pelo Eixo e pela cor insegura.
   - **30516, 37607, 22421, 25297 e q1382: iguais.**
8. **Para passar ao Motor: o portão `estudar` do `conferir.py` reprova por causa do item 7.**
   - O `motor/test_estudar.py` (linhas 327–334) usa o 75352–75354 como exemplo de "divisa com uma candidata só, recusa sem pasta". Agora esse lote estuda em Z2, então o teste quebra com `AssertionError: divisa com uma candidata só devia recusar`.
   - Não toquei em `motor/`. Proposta: trocar o lote por **68491**, que tem frente e é Z1 colado ao campus.
   - Já conferi fora do teste: `estudar.estudar("completo", [68491], "auto", ...)` recusa com "Zona automática recusada" e "Rode de novo com --zona SC-XX, uma destas: SC-Z1.", e não cria pasta.
9. **Testes novos ou ajustados (`test_sugerir_zona.py`):**
   - Uma borda de 2 px de parque colada ao lote agora é aceita em Z1, com distância `null`.
   - Um parque grande colado ao lote continua recusando, sem `so_divisa` e sem candidatas.
   - O branco colado ao lote continua recusando.
   - O pixel solto de Z5B saiu das `alternativas` (`[]`).
   - O 68495 (campus) e o 40015 (parque) reais recusam com d=0.
   - O 90050 continua `so_divisa` Z4|Z3.
   - O piloto 75352–75354 passou para a lista dos que concordam (Z2). `gerar(..., "auto:SC-Z2")` dele agora diz "não tem dúvida de zona". O 75355 aceita distância `null`.
10. **Resultado dos testes:**
    - **Passaram:** `novo_lote --testar`, que roda o `test_sugerir_zona`, `gerar_lotes --testar` e `test_ponto.py`.
    - O `test_ponto.py` só roda sem o `-I`, porque com `-I` não acha o `novo_lote`. Isso já era assim antes desta tarefa.
    - **`conferir.py`: 7/8.** Reprovou só o `estudar`, pelo item 8.
    - Não toquei em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`, e não commitei.
