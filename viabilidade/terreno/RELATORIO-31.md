# T31: divisa escondida debaixo do texto (16/11)

Mexi em `terreno/sugerir_zona.py`, `terreno/test_sugerir_zona.py` e `terreno/ZONA-AUTO.md`. Não toquei em `motor/`, `relatorio/`, tela nem `lotes-piloto.json`, e não commitei. As provas estão em `terreno/evidencias/t31/`: `folha-31.jpg` e `p1-31.json`.

1. **Caso adversário (item 1): a T30 aceitava, sim.**
   - Montei um mapa com Z2 de um lado e Z1 do outro. O limite fica todo debaixo de uma faixa preta de 12, 14 ou 16 px.
   - Varri 361 posições e larguras de lote, em três versões do código: antes da T30, T30 e T31.
   - **Lote no meio da faixa:** recusa nas três versões, porque a zona cobre menos da metade.
   - **Lote que entra 3 a 4 px (até ~6 m) além do limite escondido:** a T30 aceitava como Z2, com divisa de 10,6 a 14,9 m. Antes da T30 ele recusava. Eram 4 posições.
   - **Com a T31,** o conjunto de aceitos ficou igual ao de antes da T30 (114 de 361).
   - **Resto antigo (não é da P1):**
     - O lote que entra só 1 a 2 px na faixa passa nas três versões.
     - Esses pixels "herdam" a cor do vizinho (recuperação de até 3 px, ~4 m), que existe desde antes.
     - O erro é menor que o do próprio ajuste do mapa (RMSE 2,9 m, até 6,2 m). Não mexi.
2. **A mudança (item 3), porque o caso 1 aceitava:**
   - A divisa de 10 m agora também mede a partir da mancha ignorada.
   - Essa mancha começa nos pixels do lote que só passam pela P1: sem cor depois da recuperação, ou parque solto.
   - Ela cresce por até 16 px (`TEXTO_PX`, a altura de um nome de rua), só por pixels sem cor ou de parque solto.
   - A distância da mancha entra no `distancia_divisa_m`, sai em `divisa_mancha_ignorada_m`, e a outra zona vira candidata.
   - **Lote sem pixel da P1 não muda nada.**
3. **Medição nos lotes que só passam pela P1 (item 2).** Foi só a zona, nas três versões, nos dois sorteios. O cadastro inteiro não cabia em 30 min: o de 3.000 levou 38.
   - Sorteio de 500 (semente 20261120): 16 lotes da P1. Um fica a menos de 10 m, o 68151.
   - Sorteio de 3.000 (semente 20261121): 90 lotes da P1, dos 2.136 aceitos pela T30. Sete ficam a menos de 10 m.
   - **Total: 105 lotes da P1, 8 a menos de 10 m.**
   - O próximo depois dos 8 já fica a 19,6 m. A lista inteira está em `p1-31.json`.
4. **Os 8 no Anexo 02 (`folha-31.jpg`):** a mancha ignorada aparece em ciano e o lote em magenta. Cada um tem um recorte de ~110 m e outro de ~420 m.
   - **2 estão de fato numa divisa:**
     - 2153 (Z2): colado à linha do perímetro e à rodovia;
     - 69973 (Z2): último lote da quadra, com o Z1 começando ~13 m adiante, do outro lado da rua.
   - **6 são recusas a mais, por cautela:**
     - 68151 (Z1): a mancha desce pelas letras de "JOÃO ALFREDO", entra na linha cinza da rua (que também não tem cor) e encosta no Z2 do outro lado. A divisa real fica a ~20 m.
     - 6793, 51631, 53253, 51538, 16267: estão debaixo de nomes grandes de bairro em itálico (Residencial Astolpho, Moradas, Terra Nova, Eldorado, Parque Sisi). Conferi pixel a pixel: a "outra zona" é a sombra ou o brilho das letras, que cai na cor do Z1, do Z2 ou do Z5B em mancha de 3×3. É a mesma armadilha das T23/T24.
   - Os 8 caem em "só divisa", com as duas zonas como candidatas. Quem roda escolhe com `--zona auto:SC-XX`.
5. **Sorteio de 500 pelo caminho completo (`gerar`):**
   - **319 → 318.** Só caiu o 68151, que é dos falsos.
   - Os outros 318 aceitos saíram com o `lote.json` igual campo a campo.
   - Nenhuma recusa trocou de motivo.
   - No sorteio de 3.000 (só zona), nenhum aceito sem P1 mudou de zona nem de distância. Caíram 7 (2.136 → 2.129): 2 de verdade e 5 falsos.
6. **Se quiserem tirar os 6 falsos** (não fiz, porque a tarefa não pediu e cada opção tem um custo):
   - deixar a mancha crescer só por pixel escuro de letra, e não pela linha cinza de rua, o que resolve o 68151;
   - não contar sombra ou brilho de letra como outra zona quando está colado à mancha ignorada, o que resolve os 5.
   - Nas duas, o cuidado é não abrir de novo o caso 1.
7. **Testes:**
   - O caso adversário entrou no `test_sugerir_zona.py`, no modo `divisa_texto`. O lote no meio do texto recusa. Os lotes que entram 3 e 4 px além do limite recusam pela divisa, com `divisa_mancha_ignorada_m` < 10 e o Z1 entre as candidatas. Os mesmos dois lotes passavam com o código da T30.
   - `novo_lote --testar`: OK, pilotos, remembramento e zona auto byte a byte iguais.
   - `gerar_lotes --testar`: OK.
   - `test_ponto.py`: OK.
   - `conferir.py`: 8/8.
