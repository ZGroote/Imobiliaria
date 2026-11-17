# Pacote físico preliminar (17/11)

Criei `pacote.py` e `test_pacote.py`. Não mexi em `sintese.py`, `sondagem.py` nem `cargas.py`: as funções que já existiam bastaram.
Não toquei em `torre.py`, `para_vista.py`, `gerador.py`, `editor.py` nem nos testes deles, nem fora desta pasta. Nada de rede. Não commitei.

## O que faz

- **`montar(revisao, avaliacao, sondagem=None, cargas=None)`** devolve um pacote selado (`pacote_sha256`, versão `pacote/0.1.0`).
  - Guarda só a referência de cada peça: `id`, `sha256`, `estado` e `motivo`. O pacote do 22421 tem menos de 2 KB.
  - O `id` é:
    - da revisão: o `revision_id`;
    - da sondagem: o `investigation_id`;
    - da avaliação e das cargas: o `revision_id` a que elas dizem pertencer, porque elas não têm id próprio.
  - O `sha256` é o selo que a peça carrega: `content_sha256`, `avaliacao_sha256`, `investigation_sha256` ou `cargas_sha256`.
  - O estado é `valida`, `invalida` ou `ausente`, e o motivo vem da função de cada peça:
    - **revisão:** selo recalculado (`selo` / `revisão malformada`);
    - **avaliação:** `avaliacao_valida`;
    - **cargas:** `cargas_validas`;
    - **sondagem:** `sondagem.motivo_trava` (selo e cadastro sem erro), e depois o vínculo com a revisão:
      - o lote tem que bater com o `study_ref.lote_id` da revisão;
      - o estudo só é conferido quando a sondagem declara um. O exemplo fictício tem `study_id: null`, porque a sondagem é do lote.
- **`pacote_valido(pacote, revisao, avaliacao, sondagem, cargas)`** devolve `(bool, motivos)`. Ele confere:
  - o selo do pacote e a versão;
  - por peça, se ela é a mesma (`id` e `sha`) e se está no mesmo estado.
  - Os motivos dizem qual peça mudou:
    - `"cargas mudou: era valida, agora invalida (selo)"`;
    - `"avaliacao mudou: não é a mesma peça do pacote"`.
  - Um pacote que registrou uma peça inválida continua "válido" como registro, se nada mudou desde então. O estado da peça está no próprio pacote e no resumo.
- **`resumo(pacote, revisao, avaliacao, sondagem, cargas)`** monta o dicionário para a tela. Ele lê das peças na hora e só copia das que estão válidas:
  - **avaliação:** `sintese`, `regra_da_precedencia`, `motivos_trava` e `aviso`. Se estiver inválida, mostra só `"avaliação inválida: <motivo>"`;
  - **cargas:** `total` e `total_por_m2` de cada pavimento, `total_torre`, o aviso fixo e os avisos;
  - **sondagem:** número de furos, profundidade final máxima (em m) e o nível d'água como veio, em texto. Não classifica o solo e não mostra outro número;
  - **peça ausente:** a frase "<peça> ausente";
  - também traz o estado de cada peça e o resultado do `pacote_valido`.
- **Linha de comando:** `python viabilidade/projetista/pacote.py <pasta> [--sondagem arq]`.
  - Pega o `revisao-NN.json` de número mais alto e usa o **mesmo NN** para `avaliacao-NN.json` e `cargas-NN.json`. Os dois são opcionais: o que faltar entra como `ausente`.
  - Grava `pacote-NN.json` com o `gravar` atômico.
  - Sem relógio.
  - Pasta sem revisão dá erro de uso: "nenhuma revisao-NN.json em <pasta>".
  - Sondagem indicada e inexistente também dá erro.

## Exemplo: resumo do 22421

Revisão gerada, `avaliar(rev)`, `estimar(rev)` e a sondagem fictícia. Os números estão arredondados aqui para leitura.

```json
{
 "revision_id": "rev_gerada_01",
 "pacote_sha256": "266c9f3d…",
 "pacote": {"valido": true, "motivos": []},
 "pecas": {"revisao": {"estado": "valida", "motivo": ""}, "avaliacao": {"estado": "valida", "motivo": ""},
           "sondagem": {"estado": "valida", "motivo": ""}, "cargas": {"estado": "valida", "motivo": ""}},
 "avaliacao": {"sintese": "HIPOTESE_PRELIMINAR", "regra_da_precedencia": 2, "motivos_trava": [],
               "aviso": "Resultado preliminar e automático, limitado ao escopo declarado. Não é aprovação legal, nem projeto executivo, nem certificação de segurança estrutural ou geotécnica."},
 "cargas": {"pavimentos": [{"id": "andar_tipo",
                            "total": {"min": 2840.9, "central": 3876.3, "max": 5208.0, "unidade": "kN"},
                            "total_por_m2": {"min": 7.0, "central": 9.6, "max": 12.9, "unidade": "kN/m²"}}],
            "total_torre": {"min": 2840.9, "central": 3876.3, "max": 5208.0, "unidade": "kN"},
            "aviso": "Estimativa preliminar em faixa, … O total da torre não é carga na fundação: …",
            "avisos": ["pilha de pavimentos ausente: a estimativa cobre só o pavimento que está na revisão"]},
 "sondagem": {"furos": 2, "profundidade_max": {"valor": 6, "unidade": "m"},
              "nivel_agua": [{"furo": "SP-01", "leituras": [{"leitura": "inicial, ao fim da perfuração", "profundidade": "não encontrado"},
                                                            {"leitura": "após 24 horas", "profundidade": "não encontrado"}]},
                             {"furo": "SP-02", "leituras": [{"leitura": "inicial", "profundidade": "4,20 m"},
                                                            {"leitura": "após 24 horas", "profundidade": "4,05 m"}]}]}
}
```

## Testes (só assert)

- **`test_pacote.py`: 6 passam.**
  1. **22421:**
     - as quatro peças ficam `valida` e o `pacote_valido` dá `(True, [])`;
     - o pacote não carrega `floor_plates` nem a síntese;
     - os bytes são os mesmos em duas rodadas;
     - o resumo copia a síntese, o aviso, as cargas e a sondagem.
  2. **Depois de `mover_divisa`:**
     - a avaliação do pai fica `invalida` com "outra revisão";
     - as cargas do pai ficam `invalida` com "geometria mudou: a revisão foi editada depois da estimativa";
     - o resumo mostra "avaliação inválida: outra revisão", sem a síntese;
     - com as peças da filha, tudo volta a `valida`.
  3. **Sondagem:**
     - de outro lote é `invalida`, com "sondagem de outro lote: SC-completo-99999 ≠ SC-completo-22421";
     - de outro estudo também é `invalida`;
     - ausente fica `ausente`, e o resumo diz "sondagem ausente".
  4. **Adulterar uma peça depois de montar dá `False` e diz qual peça foi:**
     - cargas mexidas sem selar;
     - avaliação mexida e selada de novo;
     - sondagem mexida e selada de novo;
     - sondagem retirada;
     - pacote mexido: dá "selo do pacote".
  5. **O resumo não contém** "viável", "aprovado", "capacidade" nem "fundação" (nem as formas sem acento) fora do aviso fixo das cargas. Testei em 4 casos: completo, sem sondagem e sem cargas, filha com peças do pai, só a revisão.
  6. **Linha de comando:**
     - pasta vazia dá erro 2 com a mensagem;
     - com `revisao-01` (filha) e `revisao-02`, lê a 02;
     - `pacote-02.json` sai igual ao `montar` nas duas rodadas.
- **Continuam passando:**
  - `test_cargas`: 6;
  - `test_sintese`: 13;
  - `test_sondagem`: 3;
  - `test_projetista`: 18;
  - `test_gerador`: 8.
- **`test_editor`: 9 de 10 passam.** O 10º (`test_suites_anteriores`) roda as outras suítes e cai no `test_para_vista`:
  - a falha é `ImportError: cannot import name '_terreo' from para_vista`;
  - o `para_vista.py` é o arquivo que o Motor está mexendo agora, e eu não toquei nele;
  - deve voltar quando o Motor terminar.

## Limites

- O pacote não confere se a sondagem referenciada **dentro** da avaliação (`evidencias.sondagem`) é a mesma que está no pacote. Cada peça é conferida contra a revisão, não uma contra a outra.
- Os arquivos `avaliacao-NN.json` antigos de `exemplo-22421/` são da `sintese/0.2.0`. Num pacote, eles saem `invalida` com "versão do método mudou", e esse é o comportamento certo.
