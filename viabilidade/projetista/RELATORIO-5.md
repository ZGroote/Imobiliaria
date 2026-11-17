# Tarefa 5: síntese ligada à revisão + campos de grandeza (17/11)

Mexi em `sintese.py`, `test_sintese.py`, `gerador.py` (só no `main`), `test_gerador.py` e numa linha de `esquema.py` (explicado abaixo). Não toquei em `para_vista.py`, `test_para_vista.py`, `validador.py` nem fora desta pasta. Não commitei.

## 1. Avaliação selada e ligada à revisão

- **`avaliar(revisao, escopo, evidencias)`** roda `validar` + `sintetizar` e devolve um arquivo à parte, que não entra na DesignRevision. Ele guarda:
  - `revision_id` e `revision_sha256` (o `content_sha256` da revisão);
  - `escopo` (normalizado), `evidencias`, `method_version` e `engine_version`;
  - a `sintese` inteira;
  - `avaliacao_sha256`, o selo sobre todo o resto. Usa o mesmo JSON canônico do esquema.
- **`avaliacao_valida(avaliacao, revisao)`** devolve `(True, "")` ou `(False, motivo)`. Confere nesta ordem:
  1. **"selo"**: a avaliação foi mexida depois de selada.
  2. **"versão do método mudou"**: `method_version` ou `engine_version` diferente do código atual.
  3. **"revisão malformada"**: a revisão não passa no `selar`.
  4. **"outra revisão"**: o `revision_id` é diferente.
  5. **"geometria mudou"** (decisão 4): o `content_sha256` da revisão não bate.
     - O hash é **recalculado pelo conteúdo**, não lido do campo.
     - Por isso, uma revisão mexida sem selar de novo também cai aqui.
- **Mudança em `esquema.py`, que foi indispensável:**
  - O `gravar` sela como revisão: ele chama `conferir_estrutura`, e isso recusa qualquer avaliação.
  - A tarefa pede para gravar com o `gravar`, que é atômico. Ganhou um parâmetro opcional: `gravar(caminho, dado, selador=selar)`.
  - Sem o parâmetro, ele se comporta exatamente como antes. Os 18 testes do projetista e os da prévia do Motor passam.

## 2. Campos novos em cada achado classificado

| Campo | De onde vem | Quando é `null` |
|---|---|---|
| `quantity_kind` | Da unidade: m² → `area`, m → `comprimento`, pavimento → `contagem`, % → `razao` | Unidade vazia, como em `geometria.poligono`, que não é grandeza |
| `assumptions` | `[reference]` quando a fonte é `kind: premissa`; senão, `[]` | Nunca é `null`: lista vazia quer dizer sem premissa |
| `source_version` | `source.version`, se existir. Geometria: `projetista/0.1.0`. Outras: `rules_version <hash das regras>` | Quando não há fonte e não há `rules_version` |
| `confidence` | `premissa` se `kind` = premissa. `fonte_conferida` só com `verified: true` e referência. Senão, `sem_fonte` | Nunca é `null` |
| `engine_version` | `projetista/0.1.0+sintese/0.1.0` | Nunca é `null` |

- Todo `null` leva o motivo em `null_reasons[campo]`. Uso esse campo à parte porque `reason` já é o motivo do achado.
- `scope`, `reason` e `required_actions` continuam. Não há `calculated_at` nem relógio.
- **Interpretação minha:** uma fonte com referência mas `verified: false` sai como `sem_fonte`. A tarefa só tem três valores, e "fonte não conferida" não é "conferida".
- **Interpretação minha:** a `source_version` das regras é o `rules_version`, o hash da origem das regras que o adaptador já calcula. As fontes do motor não trazem versão própria.
  - `classificar` e `sintetizar` ganharam o parâmetro opcional `versao_regras`.
  - O `avaliar` passa esse valor sozinho. Chamadas antigas continuam valendo.

## 3. Linha de comando do gerador

- Ao lado de cada `revisao-NN.json` sai um `avaliacao-NN.json`, gravado pelo `gravar` (atômico).
- O escopo padrão é `geometrico,urbanistico,arquitetonico`, com evidências vazias.
- `--escopo` aceita uma lista separada por vírgula. Escopo inválido sai com erro do argparse (código 2) antes de gerar qualquer coisa.
- O resumo ganhou uma linha. No piloto 22421 ela sai assim:
  `síntese da melhor (geometrico, urbanistico, arquitetonico; sem evidências): HIPOTESE_PRELIMINAR, regra 2 da precedência`
  - É regra 2 porque o domínio urbanístico não tem nenhum achado `conforme`: `norma.envelope` e `areas.computavel` estão sem fonte conferida.

## 4. Testes (só assert)

- **`test_sintese.py`: 11 passam (7 antigos + 4 novos).**
  - A revisão gerada do 22421 dá uma avaliação válida.
  - Um vértice de unidade mexido, selado de novo ou não, dá "geometria mudou".
  - Um `revision_id` trocado dá "outra revisão".
  - Uma `sintese` adulterada dá "selo".
  - Uma versão de método velha, mesmo com selo refeito, dá "versão do método mudou".
  - Os 5 campos estão em todos os achados, e todo `null` tem motivo.
  - Nenhuma fonte com `verified: false` sai como `fonte_conferida`.
  - A mesma revisão dá os mesmos bytes.
- **`test_gerador.py`: 8 passam (7 antigos + `test_cli_avaliacao`).**
  - Duas rodadas da linha de comando no 22421 dão os 6 arquivos com bytes iguais.
  - As 3 avaliações são válidas contra a revisão lida do disco.
  - `--escopo` funciona e recusa um domínio inventado.
- **Continuam passando:**
  - `test_projetista`: 18;
  - `test_para_vista` do Motor: só rodei, não mexi.

## Limites

- A avaliação do 22421 pesa ~100 KB, dez vezes a revisão. A causa é a síntese guardar cada achado com a fonte inteira, incluindo a lista de leis. Se o peso pesar, dá para guardar a fonte uma vez e citar por `rule_id`.
- `avaliacao_valida` não relê a revisão do disco: ela recebe o dict. Quem chamar deve usar `esquema.ler`, que já recusa arquivo adulterado.
