# PVF-G2: estimativa preliminar de cargas por pavimento (17/11)

Criei `cargas.py` e `test_cargas.py`. Não mexi em `sintese.py`.
Não toquei em `torre.py`, `para_vista.py`, `gerador.py`, `editor.py` nem nos testes deles, nem fora desta pasta. Nada de rede. Não commitei.

## O que faz

`estimar(revisao, premissas=PREMISSAS_PADRAO)` devolve uma estimativa selada, por pavimento e por elemento.

- **Formato:** toda grandeza é uma faixa `{min, central, max, unidade}`. As áreas e a cota saem como `{valor, unidade}`.
- **Carga permanente (g):** 5 parcelas por m² de laje, multiplicadas pela área do contorno do pavimento. O `element_ids` de cada uma é o id do pavimento.
  - laje maciça: 25 kN/m³ × 10–14 cm, dá 2,5 / 3,0 / 3,5;
  - vigas: 0,8 / 1,2 / 1,8;
  - pilares espalhados: 0,4 / 0,7 / 1,0;
  - paredes: 1,0 / 2,0 / 3,0;
  - contrapiso e piso: 0,8 / 1,0 / 1,5.
  - O contrapiso não é peso próprio. Entrou porque, sem ele, o g sai baixo demais.
- **Carga variável (q):** uma parcela por elemento, com a área desse elemento e o `element_ids` dele. Faixas em kN/m²:

  | Ambiente | Faixa | Observação |
  |---|---|---|
  | unidade | 1,5 / 1,5 / 2,0 | 2,0 é a área de serviço |
  | circulação (corredor e escada) | 2,0 / 3,0 / 3,0 | |
  | hall | 2,0 / 3,0 / 3,0 | |
  | lazer | 3,0 / 3,0 / 5,0 | |
  | garagem | 3,0 / 3,0 / 3,0 | |

  - Elevador e shaft são vão: ficam em `sem_sobrecarga`, com motivo. Assim nenhum elemento some.
- **Totais por pavimento:**
  - `g`, `q` e `total` em kN;
  - `total_por_m2` em kN/m²;
  - `acumulado_do_topo`: os pavimentos vão do topo para a base.
- **Total da torre:** `total_torre`, em kN.
- **Premissas:** cada uma tem valor, unidade dentro do valor, referência, `verified: false` e `revisado_por: null`.
  - Nas de q, a referência diz "escrito a partir da NBR 6120:2019 como premissa; não conferido com o texto da norma".
  - Os números saíram do que eu sei. Não baixei a norma.
- **Premissa com erro:** `verified: true` sem `revisado_por` completo (nome, conselho e registro) é erro, e o `estimar` recusa. Faixa fora de ordem e unidade errada também são erro.
- **Vínculo:** guarda `revision_id`, `revision_sha256` e os `element_ids`. O selo é `cargas_sha256` e a gravação usa `gravar(..., selador=selar_cargas)`.
- **`cargas_validas(resultado, revisao)`** devolve `(False, motivo)` para:
  - selo;
  - versão do método;
  - premissas inválidas;
  - revisão malformada;
  - outra revisão;
  - "geometria mudou", inclusive "geometria mudou: a revisão foi editada depois da estimativa" quando a revisão é filha da estimada pelo editor.
- **Avisos:**
  - fixo: "O total da torre não é carga na fundação…", e diz que não há carga por apoio, combinação de ações, dimensionamento, capacidade de fundação nem comparação com sondagem;
  - quando só há 1 pavimento: "pilha de pavimentos ausente".
- **Síntese:** não mexi. A estimativa não gera achado nem toca na trava, então o estrutural continua `nao_verificado`.

## Número do 22421 (1 pavimento, 6 unidades)

| | Mínimo | Central | Máximo |
|---|---|---|---|
| Por m² | 7,05 kN/m² | 9,62 kN/m² | 12,92 kN/m² |
| Pavimento | 2.841 kN | 3.876 kN | 5.208 kN |

É preliminar e não é carga na fundação.

## Testes (só assert)

- **`test_cargas.py`: 6 passam.**
  1. No 22421, todo número tem unidade, mínimo ≤ central ≤ máximo, g e q são positivos, e todo elemento aparece numa parcela ou em `sem_sobrecarga`.
  2. Numa revisão sintética de 3 pavimentos:
     - o acumulado cresce do topo para a base;
     - o total é a soma dos pavimentos, até 0,01 kN;
     - o topo, sem corredor, pesa menos.
  3. Na estimativa antiga:
     - `editor.mover_divisa` deixa ela inválida, com "geometria mudou";
     - um vértice mexido também, selado de novo ou não;
     - um número adulterado dá "selo".
  4. `verified: true` sem revisor dá erro, e com registro em branco também. Com o registro completo, passa.
  5. O resultado tem o aviso, e nenhuma chave contém palavra proibida: pilar, fundação, capacidade, sapata, estaca, tensão, combinação, dimension, sondagem e admissível.
     - "pilares" aparece só como **valor**, no id da premissa `g.pilares`, que é o peso próprio pedido. Por isso as premissas são uma lista com `id`, e não um dict.
  6. Mesmos bytes em duas rodadas, e o `gravar` regrava igual.
- **Continuam passando:**
  - `test_sintese`: 13;
  - `test_sondagem`: 3;
  - `test_projetista`: 18;
  - `test_gerador`: 8;
  - `test_editor`: 10.

## Limites

- A área entre os elementos (paredes, folgas) não leva q. Ela já entra no g pelas paredes. O contorno do pavimento leva o g inteiro, sem descontar o vão do elevador, o que puxa para cima.
- A cota dos pavimentos vem de `z0_m`. Ainda não usei `height_m`, porque o g de pilar e parede já está espalhado por pavimento.
