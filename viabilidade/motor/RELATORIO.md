# Relatório do Motor, tarefa 2 (14/11)

Testes: `python -I viabilidade/motor/test_motor.py` passa ("ok", ~80 s). Varrimento extra de 5 lotes × 7 casos (recuo, TO, CA, altura, pavimentos, frente): 0 piora real; 1 diferença de 0,05 m² em 640 (C do 30516, ruído da busca binária, 0,008%).

## 1. Por que a D piorou (3 causas, todas corrigidas)

1. **Geometria.** Base e torre eram retângulos centrados no centroide, com proporção tirada do bbox. Afrouxar o recuo mudava o bbox, a proporção e a posição: a torre saía num formato pior. Agora o retângulo é o maior que cabe na região (erosão exata por retângulo, qualquer posição); `maior_retangulo`, `_maior_lamina`, `dois_quadrados`.
2. **Andar é inteiro.** Laje maior estoura o CA no último andar e o prédio escolhido cai um andar. Agora `_ajusta_ao_ca` encolhe a laje até bater no teto do CA, e `_melhor` escolhe o prédio de **maior área privativa** (não mais "o mais baixo que chega a 95%", que não é monotônico). Vale para A, B, C e D.
3. **Só na D.** O embasamento não rende área privativa mas gasta CA. Deixá-lo crescer com a TO ou o recuo tirava andar da torre. Agora ele ocupa uma fração fixa do lote (premissa `embasamento_ocupacao`, padrão 0,4).

## 2. O que mudou

- `motor.py` (versão 0.4.0): itens acima; área especial sem altura numérica vira alerta em cada opção ("ÁREA ESPECIAL sem altura numérica, NÃO aplicada: ..."), sem número inventado.
- `test_motor.py`: teste de monotonia (recuo −30%, TO +0,1, CA +25%, altura 45→63 m, recuo dos 2 primeiros pavimentos 2,00→1,50) em 3 lotes: exemplo, remembramento 75352-75354 (Z2) e 22426 (Z1). No teste "TO alta" a premissa sobe para 0,9 (base de 90% só cabe encostando na divisa).
- `gerar_pilotos.py` (novo): refaz os 7 estudos em `exemplos/pilotos/<id>.json` e imprime a tabela. `python -I viabilidade/motor/gerar_pilotos.py` (~1 min).
- `exemplos/estudo-exemplo.json` regenerado: **a Visual usa esse arquivo e ele mudou.** Exemplo SC-Z2 agora: A 47 un., B 78, C 56, D 42 (a D era 38).

## 3. Custo de tempo (é "melhor de várias tentativas")

Por andar o motor refaz a laje (até 7 vezes, no que estoura o CA) e testa até 15 proporções de lâmina; depois escolhe o máximo, sem parar cedo. Por estudo: exemplo ~2,3 s (antes ~0,9 s), remembramento ~3 s, 22426 ~4 s, 30516 ~20 s, q1382 ~40 s. Os lotes grandes com CA alto (muitos andares possíveis) pesam mais.

## 4. Os 7 lotes-piloto (zona anotada à mão, premissas padrão)

| Lote | Zona | Melhor opção | Unidades | CA usado | Alertas |
|---|---|---|---|---|---|
| SC-completo-30516 | SC-Z4 | B Duas torres | 30 | 1,40 | 3: área especial (interesse ambiental, sem altura, não aplicada); no limite do CA |
| SC-completo-37607 | SC-Z4 | B Duas torres | 54 | 1,40 | 3: área especial (interesse industrial/serviços, sem altura); no limite do CA |
| SC-completo-22426 | SC-Z1 | C Lâmina baixa | 12 | 1,38 | 2: gabarito aeronáutico sem altura, não aplicado |
| SC-completo-22421 | SC-Z1 | C Lâmina baixa | 13 | 1,38 | 2: gabarito aeronáutico sem altura, não aplicado |
| SC-completo-25297 | SC-Z1 | C Lâmina baixa | 5 | 1,18 | 1: só o recuo (sem área especial) |
| SC-completo-q1382-11984-11988 | SC-EIXO | B Duas torres | 94 | 4,00 | 5: gabarito aeronáutico não aplicado; faltam vagas (precisa 94, 2 subsolos comportam 90); CA no limite; 3.198 m² de outorga onerosa |
| SC-completo-remembramento-75352-75354 | SC-Z2 | B Duas torres | 82 | 3,50 | 3: CA no limite; 2.411 m² de outorga onerosa |

"Melhor" = maior área privativa (empate: menos pavimentos). Em lote com área especial sem altura o resultado **pode passar do que o terreno permite**: conferir o gabarito antes de usar.

## 5. Riscos e proposta de contrato (README não foi mexido)

- Opções ficaram mais altas que antes (ex.: B do exemplo foi de 9 para 15 pavimentos): o núcleo não conta no CA, então com o CA no teto mais andar rende um pouco mais de privativa. Sem corte de altura se a zona não limita; o alerta de gabarito cobre isso.
- Premissa nova `embasamento_ocupacao` (fração do lote, padrão 0,4, é escolha de projeto, não lei): entra em `premissas` e em `premissas.padrao`. A Visual não precisa mudar nada, só ler o campo se quiser mostrar.
- O 95% antigo ficou fora; o ganho é monotonia garantida, a perda é opção mais alta onde a lei não limita.

## Sem commit

`motor.py`, `test_motor.py`, `gerar_pilotos.py`, `exemplos/estudo-exemplo.json`, `exemplos/pilotos/` (7 arquivos), `RELATORIO.md`. Também solto, mas não é meu: `viabilidade/auditoria/` (AUDITORIA.md e casos/).
