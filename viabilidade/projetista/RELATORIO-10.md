# Relatório da tarefa 10 do Projetista: a torre dentro da revisão (PA-G3)

Data: 17/11. Nada foi commitado. Não toquei em `cargas.py`, `test_cargas.py`, `sintese.py`, `esquema.py`, `validador.py` nem em `gerador.py`. Mexi em: `para_vista.py`, `test_para_vista.py` (uma linha de import) e `editor.py` (uma palavra na lista de operações). Criei `torre.py` e `test_torre.py`.

## O que foi feito

- `torre.compor(revisao, terreo=False, pavimentos=None, premissas_terreo=None)`: recebe a revisão de um pavimento e devolve uma **filha** com todos os pavimentos em `floor_plates`. A entrada não muda.
- O id da filha vem do `editor._id_revisao` (reaproveitado, não copiado), e `parent_revision_id` é o pai. A operação gravada é `compor_torre`, que entrou em `editor.OPERACOES`; por isso `editor.cadeia([pai, torre])` vale.
- Pavimentos: `terreo` (se pedido), `andar_01`, `andar_02`... Cada um tem `id`, `z0_m` e `height_m` próprios. Os elementos levam o sufixo do andar (`apto_01_andar_02`), porque o esquema exige id único na revisão inteira.
- A lógica do térreo (`PADROES_TERREO`, núcleo, hall, garagem, corte de anel) **saiu** do `para_vista.py` e mora só no `torre.py`. O `para_vista.py` importa de lá.
- `pavimentos=N` conta só os andares tipo (igual à tarefa 8). Pedir mais do que cabe dá erro claro.

## Escalonamento: a regra e por que

Em cada andar vale a faixa do `envelope_by_height` daquela altura.

- **Núcleo (escada, elevador, shaft): tudo ou nada.** Se uma peça sai da faixa, a torre acaba ali. Sem núcleo não há como subir.
- **Corredor e hall:** saem do andar se não cabem.
- **Unidade:** sai se a face dela não cabe **ou** se ficou sem contato com algum corredor/hall que sobrou (a mesma largura de porta que o validador exige).
- Andar sem nenhuma unidade: a torre para. Os andares de cima também perdem o que o de baixo perdeu.
- O andar que perdeu algo vira **outro pavimento**: outro id, laje encolhida até o que sobrou, outro resíduo. Não é cópia marcada.

Por que tudo-ou-nada no núcleo: o texto da tarefa fala só em retirar a unidade, mas isso contradiz os números das tarefas 6 e 8. No 22421, o 3º andar (z 6 a 9 m) sai da faixa em 15,55 m²; se só a unidade saísse, o corredor e o núcleo seguiriam e daria para empilhar mais um andar, ou seja, números diferentes de 2 andares/12 unidades. Com a regra acima os números continuam os mesmos.

## Números no 22421 (os mesmos das tarefas 6 e 8)

| | pavimentos | andares tipo | unidades | vagas |
|---|---|---|---|---|
| sem térreo | 2 | 2 | 12 | sem |
| com térreo | 2 (térreo + 1) | 1 | 6 | 12 |

Caso sintético (faixa que encolhe aos 6 m, teto em 9 m): andar 3 perde 2 unidades (6, 6, 4 = 16 unidades) e o 4º some.

## `metrics_summary.torre` (cada medida com unidade)

`altura_total` (m), `pavimentos`, `andares_tipo`, `unidades`, `privativa_total` (m²), `computavel_total` (m²), `vagas`, `area_garagem` (m²), `unidades_por_andar`, `parou` (motivo de a torre parar), `premissas_terreo`.

- **Área computável total: dá para calcular.** É a soma do `areas.computavel` que o próprio validador mede por pavimento (inclui resíduo). No 22421 sem térreo: 772,29 m². Cuidado: o hall do térreo está marcado como computável (premissa minha, a lei não foi conferida); garagem não é computável (COE art. 51).
- **Vagas:** continuam sendo área bruta da garagem ÷ 25 m² (premissa, não desenho de vaga). Sem térreo é `null`.

## O validador na torre inteira

Ele já percorre todos os `floor_plates`, e **não quebrou** com vários pavimentos (rodei em 22421 com térreo e no caso sintético: nenhuma violação). Não mudei `validador.py` nem `esquema.py`.

**Já valem em cada pavimento:** `geometria.envelope` (usa `z0_m` e `height_m` do próprio andar e as faixas que tocam essa altura), `geometria.laje`, `geometria.sobreposicao`, `geometria.poligono`, acesso, fachada e dimensão por unidade, `areas.privativa/util/computavel` (por unidade e por pavimento), balanço e resíduo.

**Não existe regra para (e eu não inventei):**
- altura total / gabarito da torre;
- CA, taxa de ocupação, permeabilidade (os valores estão em `rules_ref.params.motor`, mas nenhuma regra os lê);
- vagas;
- continuidade vertical: nada confere que o `z0_m` de um andar é o topo do de baixo, nem que o núcleo se alinha de um andar para o outro (a `compor` garante por construção, o validador não confere em revisão feita à mão);
- `norma.envelope` segue "não verificado" (zona do terreno não conferida).

## Prévia

- Revisão **com** torre (`metrics_summary.torre`): `para_vista.py` desenha o que está em `floor_plates`, sem recalcular. Pedir `terreo` ou `pavimentos` nela é erro (valem na `compor`).
- Revisão **sem** torre: igual a hoje. Conferi contra as saídas antigas guardadas: **sem térreo e com `--terreo` idênticas em bytes**; o dourado da tarefa 6 (`SHA_TAREFA_6`) não mudou, **não houve atualização de dourado** nem commit separado. A ordem dos volumes não mudou.
- Prévia desenhada da torre × prévia de hoje no 22421: mesmos volumes, mesma ordem, mesmas alturas e métricas. A geometria difere até **0,1 mm**, porque a torre grava em 4 casas decimais (o selo arredonda) e a prévia antiga desenhava a geometria exata. O teste usa tolerância de 1 mm. Também difere o `fonte` (aponta para a torre) e o texto do alerta com o id da revisão, de propósito.

Print: `previa-22421-torre.png` (garagem lilás embaixo, andar tipo em cima, dentro do lote e da caixa).

## Detalhes que mudam o resultado

- Contorno do andar que perdeu peças: fica ~0,2 mm **para fora** das peças (como o gerador faz). Colado, ele só toca em pontos e o validador não aplica a tolerância de 0,3 mm, e a fachada media 0 m. Foi o único erro real que apareceu no caso sintético.
- O contorno do andar encolhido tem que ser um polígono inteiro, sem buraco: se sobrarem peças soltas, a `compor` recusa com mensagem.
- `compor` recusa (`EdicaoRecusada`) se o validador achar violação em qualquer pavimento, e recusa compor sobre uma revisão que já é torre.

## Testes (`test_torre.py`: 7 funções, só assert; todas passam)

1. 22421: sem térreo 2 andares/12 unidades; com térreo térreo + 1 tipo, 6 unidades, 12 vagas; `pavimentos` demais dá erro.
2. Envelope sintético (6 m cheio, 6–9 m estreito, teto 9 m): o 3º andar fica com 4 unidades (outro id, laje menor) e o 4º some.
3. A torre é filha da revisão de um pavimento; `cadeia([pai, torre])` vale (e `cadeia([pai, editada, torre])`); compor sobre torre é recusado.
4. `mover_divisa` no pai e compor de novo dá outra torre; a avaliação da torre antiga não vale para a nova.
5. Mesmos bytes em duas rodadas (com e sem térreo).
6. Prévia pela torre = prévia de hoje no 22421, sem e com térreo.
7. Rodam de novo: `test_projetista`, `test_gerador`, `test_para_vista`, `test_editor`, `test_sintese`. Todos passam.

## Como rodar

```
python -I -X utf8 viabilidade/projetista/test_torre.py
python -I -X utf8 viabilidade/projetista/para_vista.py <revisao.json> <estudo.json> --terreo --saida <arquivo>
```

## Sobra no git

`viabilidade/projetista/` aparece inteira como não rastreada neste galho. Novos desta tarefa: `torre.py`, `test_torre.py`, `RELATORIO-10.md`, `previa-22421-torre.png` (não commitar o PNG). Alterados: `para_vista.py`, `test_para_vista.py` (1 linha de import), `editor.py` (`compor_torre` em `OPERACOES`). Nada commitado. Os ` M` em `motor/exemplos/pilotos` e `visual/evidencias` e os arquivos do Terreno (`cargas.py` etc.) não são meus.
