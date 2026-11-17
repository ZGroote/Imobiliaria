# Limites do prédio no validador, PA-G3 (tarefa 13, 17/11)

**Arquivos:**
- mexi em `validador.py` e `sintese.py`;
- no `test_sintese.py`, troquei só o texto da versão;
- criei `test_limites.py`.

Não toquei em `torre.py`, `vitrine.py`, nos testes deles nem em `vitrine/`. Nada de rede. Não commitei.

## ⚠ Uma pendência antes de levar para o `projetista-g0`

O ouro `SHA_TAREFA_6` do `test_para_vista.py` (linha 30) **deixa de bater**. Por isso `test_para_vista`, `test_editor` e `test_torre` saem com código 1: os dois últimos chamam o `test_para_vista` no fim. Os testes próprios de cada um passam.

**Por que não dá para evitar:**
- a tarefa manda que a revisão de um pavimento só ganhe as 5 regras `torre.*` como `nao_verificado` ("pilha de pavimentos ausente");
- o gerador conta essas pendências em `metrics_summary`, e isso muda os bytes e o sha da revisão;
- a vista mostra a lista dessas regras num alerta.

**O que muda na prévia de hoje do 22421** (o resto é idêntico):

| Campo | Antes | Agora |
|---|---|---|
| alerta "Regras com fonte não verificada na revisão" | `…, dimensao, norma.envelope.` | `…, dimensao, norma.envelope, torre.altura, torre.ca, torre.continuidade, torre.permeabilidade, torre.to.` |
| `fonte.content_sha256` | `79d041d9…` | `fdccaf79…` |

- Unidades e pavimentos **não mudam**.
- Hash novo: `a7911ddd52e965a171249ddc42fa6c336b6483fc7256a5423c08faa185cbba9f`.
- **Não troquei o ouro.** Ele está fora do que a tarefa libera, e a regra é mostrar antes de mexer em número. Se a central aceitar, a troca é essa linha.
- A prévia da vitrine (`vitrine/terreno-*/estudo-previa*.json`, do Motor) também vai sair com esse alerta maior na próxima rodada.

## CA e TO do 22421

O lote tem 651,5714 m² (`site.area_m2`).

| Torre | Computável total | CA | Projeção | TO | Altura |
|---|---|---|---|---|---|
| sem térreo (2 andares tipo) | 772,2862 m² | **1,1853** | 403,1 m² | **0,6187** | 6 m |
| com térreo (térreo + 1 andar) | 461,2260 m² | **0,7079** | 403,1 m² | **0,6187** | 6 m |

- **Situação:** todas as regras ficam `nao_verificado`, porque a fonte da zona tem `verified: false` e o enquadramento do lote não foi conferido (`lot_zone_verified: false`).
- **Medidas:** o CA fica abaixo do básico (2) e a TO fica abaixo de 0,7.
- **Com térreo:** a TO sai igual porque o andar de cima cobre a laje inteira. Assim, tirar a garagem do térreo (`garagem_conta_na_taxa_ocupacao: false`) não muda a projeção.
- **Conta à mão:** soma do computável de cada peça mais o resíduo, dividida pela área. Bate com o validador até 1e-6 e com `metrics_summary.torre.computavel_total ÷ área`.
- **Recusas:** nenhuma torre que passava foi recusada. Não há `violacao` no 22421.

## O que entrou no `validador.py`

Os limites vêm de `rules_ref.params.motor`. Limite nulo ou ausente dá `nao_verificado` com "limite não informado", nunca `conforme`.

| Regra | Medida | Limite |
|---|---|---|
| `torre.altura` | do piso do pavimento mais baixo ao topo do mais alto | `altura_max_m` (nulo no 22421) |
| `torre.ca` | computável de todos os pavimentos (a mesma conta do `areas.computavel`) ÷ área do lote | `ca_basico` e `ca_maximo` |
| `torre.to` | projeção das lajes ÷ área do lote; tira a garagem quando `garagem_conta_na_taxa_ocupacao` é `false` | `taxa_ocupacao` |
| `torre.permeabilidade` | nenhuma: sempre `nao_verificado`, "a revisão não modela área permeável" | `taxa_permeabilidade` |
| `torre.continuidade` | cada `z0_m` encosta no topo do pavimento de baixo, e cada núcleo (escada, elevador, shaft) tem a mesma projeção do primeiro pavimento | tolerância `tol_geom_m` da revisão |

**`torre.ca`:**
- acima do máximo: `violacao`;
- até o básico: `conforme` (se a fonte estiver conferida);
- **entre o básico e o máximo:** o validador não tem o estado "condicionado". Usei o mais próximo, `nao_verificado`, com o texto "condicionado: acima do CA básico (X) e até o máximo (Y), depende de outorga onerosa".

**`torre.to`:** usei a **união** das projeções das lajes, e não só a maior laje.
- Numa pilha alinhada as duas dão o mesmo número.
- Num prédio com andares deslocados, a união é a projeção real.

**`torre.continuidade`:**
- Funciona em revisão feita à mão. Lê a geometria, não o resumo do `torre.py`. Por isso uma pilha de 2 andares sem `metrics_summary.torre` também é conferida.
- A fonte é a da geometria (`projetista/0.1.0 / PA-G0 4.1`), como as outras regras geométricas.

**Vagas: no 22421 não criei a regra.**
- `vagas_min_por_unidade` é nulo, e o `vagas_regra` diz que residencial multifamiliar não tem mínimo.
- O código só cria `torre.vagas` quando a zona informa um mínimo. Nesse caso, compara as vagas declaradas da torre com mínimo × unidades. Testei com um lote sintético.

**Sem pilha:** uma revisão com um pavimento só e sem `metrics_summary.torre` dá todas as regras `torre.*` como `nao_verificado`, com "pilha de pavimentos ausente". Não quebra e não vira `conforme`.

**Fontes:** o `rules_ref.sources` do 22421 não tem nenhuma fonte `torre.*`.
- Se tiver um dia, é ela que vale.
- Sem ela, a regra usa a fonte da zona (`norma.envelope`, de onde vêm os `params.motor`): mesmo `verified` e mesmos documentos. A referência diz a chave, por exemplo: "rules_ref.params.motor.ca_maximo (zona SC-Z1)".
- Nenhum valor nem lei foi inventado.
- Também valem as mesmas travas do envelope: `zone_verified`, `lot_zone_verified` e `zone_matches_lot`.

## Por que mexi no `sintese.py` (indispensável)

**O problema:** a síntese não tinha domínio para `torre.*`. Toda regra nova virava `erro_tecnico` ("Regra sem domínio"), e a avaliação de qualquer torre quebrava.

**O conserto mínimo:**
- duas linhas no `PREFIXOS`:
  - `torre.continuidade` → `geometrico`;
  - o resto de `torre.` → `urbanistico`;
- `METHOD_VERSION` de `sintese/0.3.0` para `sintese/0.4.0`;
- o texto da versão no `test_sintese.py`.

**Avaliações gravadas:** as de `exemplo-22421/avaliacao-0*.json` já estavam em `sintese/0.1.0`, ou seja, já saíam "versão do método mudou" antes. A `vitrine/` não guarda avaliação.

## Contagem de pendências (`achados_nao_verificado`)

| Revisão | Antes | Agora | Unidades |
|---|---|---|---|
| pavimento do 22421 | 28 | 33 (+5 "pilha ausente") | 6 → 6 |
| torre sem térreo | 56 | 60 (+4) | 12 → 12 |
| torre com térreo | 32 | 36 (+4) | 6 → 6 |

Na torre são +4 e não +5 porque `torre.continuidade` sai `conforme`.

## Testes (`test_limites.py`, só assert)

1. **22421, sem e com térreo:**
   - CA e TO iguais à conta à mão;
   - altura `nao_verificado` com "limite não informado";
   - permeabilidade não modelada;
   - continuidade `conforme`;
   - sem regra de vagas.
2. **Lote sintético** (fontes conferidas e limites trocados):
   - CA máximo baixo dá `violacao`;
   - CA entre básico e máximo dá `nao_verificado` "condicionado… outorga onerosa";
   - CA folgado dá `conforme`;
   - limites nulos dão "limite não informado";
   - garagem contando na TO não diminui a TO;
   - mínimo de 3 vagas por unidade dá `violacao` (12 < 18).
3. **Revisão à mão:**
   - andar flutuando 0,5 m dá `violacao`;
   - elevador deslocado 0,3 m dá `violacao`;
   - sem o resumo da torre, a pilha continua conferida.
4. **Pavimento único:** as 5 regras ficam `nao_verificado`, com "pilha de pavimentos ausente".
5. **Fonte:** toda regra nova tem fonte com o `verified` igual ao de origem. O domínio na síntese é `urbanistico`, ou `geometrico` na continuidade.
6. **Mesmos bytes** em duas rodadas.
7. **Suítes anteriores:**
   - passam `test_projetista` (18), `test_gerador` (8), `test_sintese` (13), `test_pacote` (6), `test_fluxo` (5) e `test_cargas` (6);
   - **falham só no ouro `SHA_TAREFA_6`:** `test_para_vista`, e por tabela `test_editor` e `test_torre` (passam os 9 testes próprios do editor e os 7 da torre; só o teste que roda as suítes anteriores fica vermelho).

**Resultado:** 6 de 7 passam. O 7º fica vermelho até a central decidir o ouro.
