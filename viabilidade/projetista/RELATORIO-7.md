# Tarefa 7: fonte uma vez só (17/11)

Mexi só em `sintese.py` e `test_sintese.py`. Não precisei tocar no `gerador.py`. Não toquei em `para_vista.py`, `test_para_vista.py` nem fora desta pasta. Não commitei.

## O que mudou

- **Tabela de fontes:** a avaliação ganhou `fontes: {chave: fonte}`, no nível de cima, ao lado de `sintese`.
  - A chave são os 16 primeiros caracteres do SHA-256 do JSON canônico da fonte.
  - Não usei o `rule_id`, porque as 7 regras de geometria têm a mesma fonte e a chave por hash junta as 7.
  - No 22421 ficaram **8 fontes para 154 achados**.
  - Cada achado guarda só `source_ref`, sem `source`.
- **Os campos de grandeza não mudaram:** `confidence`, `source_version` e `assumptions` são calculados no `sintetizar`, antes de a fonte virar citação, e saem iguais.
- **`method_version` passou a `sintese/0.2.0`.** Uma avaliação da tarefa 5 agora cai em "versão do método mudou", e o teste confere isso.
- **As chaves do painel do Visual ficaram iguais:** `sintese.sintese`, `regra_da_precedencia`, `dominios`, `motivos_trava`, `fora_do_escopo` e `aviso`. O teste confere byte a byte.
- O `sintetizar` sozinho continua devolvendo a fonte inteira em cada achado. Só o `avaliar`, que é o arquivo gravado, usa a tabela.

## Tamanho no 22421 (`avaliacao-01.json`)

| | bytes |
|---|---|
| Antes (0.1.0) | 101.105 |
| **Depois (0.2.0)** | **92.575** (−8%) |
| Depois, comprimido (gzip -9) | 4.166 |
| A revisão, para comparar | 9.918 |

**A meta de 30 KB não foi atingida, porque a premissa estava errada.** A fonte com a lista de leis só aparece no `norma.envelope`, que é um achado só, e as 8 fontes juntas dão 2,2 KB.

O peso está na quantidade de achados: 154 achados, ~570 bytes cada, num total de 87,6 KB.
- 126 deles são `conforme`. Só `geometria.sobreposicao` dá 66, um por par de elementos.
- Os campos mais pesados, somados nos 154 achados:
  - `source_version`: 8,2 KB. É o hash das regras, com 64 caracteres, repetido.
  - `engine_version`: 7,9 KB.
  - `required_actions`: 5,9 KB.
  - `suggestion`: 5,3 KB.
  - `method_version`: 5,2 KB.
  - `element_ids`: 5,2 KB.

Medi quanto cada corte economizaria. Estimei sem aplicar nenhum:

| Corte (acumulado) | bytes | O que quebra |
|---|---|---|
| Tirar `method_version` e `engine_version` de cada achado e deixar uma vez no topo | 79.793 | O teste 3 da tarefa 5, que exige os 5 campos em cada achado |
| Mais: passar `source_version`, `confidence`, `assumptions` e `null_reasons` para a entrada da tabela de fontes, já que derivam dela | 60.016 | O item 2 desta tarefa: os campos saem do achado |
| Mais: achado `conforme` vira só contagem, que já existe em `dominios[*].contagem` | **19.183** | "Nada é descartado", da PVF-G1: some o `element_ids` de cada conforme |

Só o terceiro corte fica abaixo de 30 KB, e ele joga fora informação. Não fiz nenhum dos três, porque cada um muda um contrato já combinado. A escolha é da central.

Se o problema for o peso na rede, o arquivo comprimido tem 4 KB, e o Hosting já serve comprimido.

## Testes (só assert)

- **`test_sintese.py`: 12 passam.** O novo é `test_fontes_uma_vez_so`, que confere três coisas:
  - todo `source_ref` existe em `fontes`, nenhuma fonte fica órfã, e nenhum achado guarda `source`;
  - recolocando a fonte pela citação, os achados ficam byte a byte iguais aos do `sintetizar`, que é o formato 0.1.0, e as chaves do painel ficam iguais;
  - a avaliação 0.2.0 é menor que a 0.1.0.
- **Os da tarefa 5 continuam passando:** selo, geometria mudou, outra revisão, versão velha (agora com `sintese/0.1.0`) e mesmos bytes.
- **Também passam:**
  - `test_projetista`: 18;
  - `test_gerador`: 8, incluindo a linha de comando, que grava a avaliação 0.2.0;
  - `test_para_vista`: só rodei.
