# Terreno, tarefa 11: achados da AUDITORIA-6

Antes de corrigir, reproduzi cada achado com o script `repro11.py`, que fica no rascunho e não no repositório. Depois rodei o mesmo script de novo. As linhas "antes → depois" abaixo são as saídas dele.

## Tabela

| # | Achado | Confirmado? (comando → saída antes) | Corrigido? (saída depois) |
|---|---|---|---|
| 1 ALTA | Eixo a até 60 m aceito em silêncio | **Sim.** `MapaZonas().sugerir(geos[25369])` → `ACEITA SC-Z3 alt=['SC-EIXO']` | **Sim.** `RECUSA Traço de Eixo a até 60 m: art. 11 vale para lote com testada na via…`, alternativas `['SC-Z3','SC-EIXO']` (zona de fundo + Eixo) |
| 2 ALTA | Histórico do Anexo 06 com transparência | **Sim.** A legenda é `[188,134,246]` e o mapa em (4952,5648) mostra `[180,108,181.5]`. Lote 74451 → só `('06','nao_verificada')` | **Sim.** Cor composta = legenda − (255 − fundo)/2, calculada para cada fundo. Medi sobre a Z1 `[180,108,182]` e sobre a Z3 `[153,107,232]`: as duas ficam a ~1 da previsão. 74451 → `interesse_historico sobreposicao_visual` + `restricao_gabarito_historico` |
| 3 ALTA | Vão dos cones do Anexo 07 | **Sim.** Os pixels (5150,5620), (4800,5600) e (4950,5400) → `[]` | **Sim.** Agora é um casco convexo único sobre os pixels dos dois cones, e os três pontos saem `gabarito_aeronautico possivel_incidencia`. Mais a AEI do Transporte Aéreo (abaixo) em (5150,5620) e (4950,5400) |
| 4 ALTA | Legendas que faltavam | **Sim.** As listas de tipos não tinham chácaras, subárea nem AEI aérea | **Sim**, as três:<br>• **Chácaras de Recreio** entrou na legenda do 05. Ver a nota 1.<br>• **Subárea de Gabarito 9 m (art. 80)** vira `restricao_gabarito_historico`, pelo casco do tracejado magenta.<br>• **AEI do Transporte Aéreo** vira `transporte_aereo`, pelo retângulo que envolve a hachura.<br>As três saem como `possivel_incidencia`. |
| 5 MÉDIA | Represa ↔ Z3 (distância 9,11) | **Sim.** A cor da represa `[192,198,234]` → classe 3 (Z3) | **Sim.** A represa entrou na paleta como classe não zonal, e o lote perto dela é recusado. Ver a nota 2. |
| 6 MÉDIA | Cores próximas, zonas 6A–8B fora da paleta | **Em parte.** As distâncias batem: Parque–Z5B 22,16 e Parque–Z5A 34,07. Mas as 6A–8B já caíam na classe 0, que é recusa, e não eram aceitas em silêncio. | **Sim.** Nova regra: um pixel vira "sem correspondência", que é recusa, se a cor mais próxima estiver a mais de 18, **ou** se a segunda mais próxima estiver a menos de 3 de distância a mais. |
| 7 MÉDIA | Eixo falso por anti-aliasing (idx 100) | **Sim.** idx 100 → `ACEITA SC-Z3 alt=['SC-EIXO']` | **Sim.** A máscara do Eixo passa por uma erosão de 3×3 px e a distância desconta 2 px. O traço real tem ~6 px e sobrevive à erosão; a franja de 1–2 px some. idx 100 → `ACEITA SC-Z3 alt=[]` |
| 8 MÉDIA | Margem de 10 m < resíduo do georreferenciamento | **Sim.** Resíduo máximo: 02 = 5,69 m, 05 = 6,77 m, 06 = 10,46 m, 07 = 11,37 m. Margem `DIVISA_M = 10` | **Sim.** Agora `divisa_m = max(10, ⌈resíduo⌉)` para cada anexo: 05 = 10, 06 = 11, 07 = 12. O Anexo 02 continua com 10. Ver "Fora do escopo" para o resto do achado. |
| 10 MÉDIA | Polígono com buraco: `--listar-vizinhos` × `--zona` | **Sim.** O ponto no anel do 14429 lista o lote, mas o `gerar` falha com "Componente 1: exige polígono … sem buracos". O ponto no buraco vazio do 55999 cai em "Nenhuma feição contém o ponto". Lote grande e fora do quadro saíam com a mesma mensagem. | **Sim.** Ver a nota 3. |
| 11 BAIXA | Ponto na divisa oscila entre 900 e 901 | **Sim.** `-21.963013, -47.886674` → 900 e `-21.963013022579, -47.886674469625` → 901 | **Sim.** Se o ponto estiver a menos de 0,5 m de mais de um lote, recusa: "Ponto a menos de 0.5 m da divisa na base completo: índices [900, 901]". Vale para as duas grafias. |

### Notas sobre as correções

**Nota 1, Chácaras de Recreio.** O cinza `[170,170,170]` delas é igual ao da malha de ruas desenhada no mapa. Por isso só conta como chácara uma **mancha** que sobrevive a uma abertura de 5×5 px. Na área urbana nenhuma sobrevive (0 pixels). Perto do rótulo "7" sobrevivem 41.910 pixels.

**Nota 2, represa no mapa de zonas.** O ruído do JPEG espalha pixels soltos com cor de represa dentro da Z3. Por isso a água só conta em mancha de 5×5 px ou mais; o pixel solto vira "sem correspondência". Sem esse filtro, o extra 19 (Z3) passou a ser recusado; com ele, voltou a concordar.

**Nota 3, polígono com buraco.** Mudou o seguinte:
- o ponto no buraco interno agora recusa e diz qual feição tem o buraco e quais lotes estão dentro dele;
- quando é o caso, sugere `--indices 14429 14421` (o anel mais o miolo);
- `--listar-vizinhos` mostra o mesmo aviso;
- a união de anel + miolo passa pelo `unir`, e o lote é recusado só pela frente;
- o anel sozinho é recusado com "Polígono com buraco: …";
- lote grande demais e lote fora do quadro agora têm mensagens próprias.

## Fora do escopo (não mexi)

- **Achado 8, o resto:** a lista nominal dos trechos do art. 11 e os "eixos viários arteriais tipo 1" das zonas 6A/6B. Isso é regra da Lei, não leitura do mapa, e a tarefa só pedia a margem por anexo.
- **Achado 9:** excesso de `nao_verificada` e o `gabarito_aeronautico` sempre como possível incidência. Não está na TAREFA-11. As correções aqui **aumentam** os `nao_verificada`, o que segue a regra "na dúvida, marcar".

## Atalhos com teto conhecido

Só deixam o resultado mais conservador.

- **Subárea de Gabarito:** casco convexo do magenta dentro da caixa de pixels (4250,5100)–(5200,6250). Fora dela, as manchas magenta do mapa são AEIS e não contam.
- **AEI do Transporte Aéreo:** retângulo de pixels (4940,4940)–(5560,6260). A hachura não tem cor própria.
- **Cones:** o casco único dobra a área coberta, de 2,46 para 4,97 milhões de px². Um casco só para a "ponte" sobre a pista cobriria (5150,5620), mas deixaria (4800,5600) e (4950,5400) de fora. Por isso ficou o casco único, sempre como "possível incidência, consultar DECEA".

## Prova

### Testes (todos passam)

- `novo_lote.py --testar`: exit 0. Há um caso por achado:
  - 1: Eixo recusa com `['SC-Z1','SC-EIXO']`;
  - 7: traço fino de 2 px não vira Eixo;
  - 5: represa recusa;
  - 6: cor ambígua recusa;
  - 2: cor composta do Histórico;
  - 4: Chácaras, Subárea e AEI (e traço cinza não é Chácaras);
  - 8: margem 10/11/12 por anexo;
  - 3: os 3 pontos do vão;
  - 10: ponto no buraco, sugestão anel + miolo, anel sozinho recusado, mensagem de lote grande;
  - 11: os pontos 9,6 e 10,4 recusam; o ponto 9,4 não recusa; 900/901 nas duas grafias.
- O mesmo `--testar` com o scipy bloqueado (`sys.modules['scipy']=None`): exit 0.
- `gerar_lotes.py --testar` e `testar_pilotos.py`: exit 0.

### Os 7 pilotos

Nenhum mudou de "concorda" para "recusa".
- 30516, 37607, 25297 e 75352–54 concordam, como antes.
- 22426, 22421 e q1382 **já eram recusa** na tarefa 10 (`depois10b.json`). Mudou só a ordem dos motivos: o Eixo agora vem primeiro.
- As áreas especiais dos 7 continuam iguais às manuais.
- Dos extras, o 19 ganhou `07 gabarito_aeronautico` + `07 nao_verificada`: ele fica dentro do casco único dos cones. O 25298 e o 75355 não mudaram.

### Amostra da REVISAO-6 (semente 20261115)

Com zona informada (SC-Z1), continuam passando os mesmos **9 de 20**: 100434, 79299, 91923, 25212, 94130, 21164, 23249, 59281, 82415.

Mudaram 3 dos 20:

| Lote | Antes | Depois |
|---|---|---|
| 91923 | `auto` aceitava SC-Z3 | recusa por traço de Eixo a até 60 m |
| 79299 | — | ganhou `interesse_historico` + `restricao_gabarito_historico` (está no Centro) |
| 92058 | — | ganhou `06 nao_verificada` (cor ambígua a até 11 m) |

Em 108586 e 97132 mudou só o texto ("Fora do quadro … do Anexo 02").

Com `--zona auto`, passavam 8 dos 20 e agora passam **7**: saiu o 91923. O 23249 já era recusa.

### Varredura de 570 lotes

São os pilotos, a amostra, os casos da auditoria e um lote a cada 200 da base completa.

- **Zona:** 6 mudaram, todos de aceita para recusa pelo Eixo: 25369, 91923, 12800, 16200, 19400 e 71600. Nenhuma recusa virou aceite.
- **Áreas especiais:** 78 mudaram.
  - Ganharam:
    - 36 × `gabarito_aeronautico` (casco único dos cones);
    - 21 × `interesse_historico`;
    - 7 × `restricao_gabarito_historico`;
    - 22 × `nao_verificada` no 06 ou no 07 (cor ambígua e margem maior);
    - 1 × `interesse_social`.
  - Perderam:
    - 17 × "nada encontrado nos 05/06/07", porque agora acham alguma coisa;
    - 9 × `06 nao_verificada`, que viraram Histórico reconhecido.

## Acréscimo do CI: floats com tolerância

As comparações exatas entre um JSON gravado no Windows e um gerado no Linux passaram a usar `comparar_json` do `testar_pilotos.py`. Ele compara floats com tolerância de 1e-6 e strings e inteiros de forma exata. Mudaram 3 comparações, todas no `test_novo_lote.py`:

| Linha | Antes | Depois |
|---|---|---|
| 58 | `novo["frente"] == original["frente"]` | `comparar_json(…, "frente")` |
| 65 | `novo[k] == original[k]`, para as outras chaves do piloto | `comparar_json(…, k)` |
| 69 | `novo["qualidade"]["frentes"] == original["qualidade"]["frentes"]` | `comparar_json(…, "qualidade.frentes")` |

Essas três eram as que falhavam no CI Linux.

As outras comparações de float no `--testar` já tinham tolerância de 1e-6: `assert_allclose`/`isclose` de polígono, área e relevo.

Ficaram exatas, de propósito, as comparações em que os dois lados saem da **mesma máquina** na mesma execução. É o caso da CLI × `cadastro.gerar` em `test_novo_lote.py:127`, `test_ponto.py:86` e `test_sugerir_zona.py:150`, e do "com e sem cache" byte a byte no `test_cache.py`. Nelas, a diferença de plataforma não existe.

Não houve commit.
