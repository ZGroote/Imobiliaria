# Scripts avulsos — inventário e classificação (27/09/2026)

**Histórico deste documento:**

- **#40:** inventário e classificação, sem remover nada.
- **#41:** saíram os 5 `_*.py` e os dois JSON de variante de Ribeirão que eles geraram (seção seguinte).
- **#42:** o `testa_recorte` virou gate do build por imóvel; a verificação mora no `pipeline/recorte.py`.
- **#43:** saiu o `testa_pe_de_parede.py`, que era histórico (seção abaixo).

Os renderizadores (v15, v16, v17, v18) ficam para a frente seguinte.

**Base medida:** `main` `4dae983`.

**Escopo:** os 5 `_*.py` da raiz e os `pipeline/testa_*.py`. São **12** `testa_*`, e não 7: 7 deles são os portões de comportamento, e os outros 5 são ferramentas manuais ou histórico. Os 12 estão aqui.

## Método

Para cada script, levantei:

| Item | Como foi medido |
|---|---|
| **Código** | `git grep -w` do nome em `.py`, `.mjs`, `.js`, `.ts`, `.json` e `.yml`, fora o próprio arquivo e o `tasks/modularizacao/inventario.json`, que é um inventário congelado. Nos `_*.py` usei `:(exclude)`, porque `:!_…` o git lê como outra coisa |
| **CI / npm** | `.github/workflows/*` e `package.json` |
| **Docs** | `git grep` do nome nos `.md` |
| **Operação manual** | a linha de uso que o próprio script documenta |
| **Se ainda roda** | `py_compile` no Python 3.14 (os 17 compilam) e se cada import do projeto (`pipeline.*`, `padrao.*`) ainda existe (todos existem) |

**Nada foi executado.** Os portões precisam de Chrome e da página montada, e os `_*.py` leem dados de Ribeirão Preto que não estão no git.

## Classes

| Classe | O que é |
|---|---|
| **gate vivo** | faz parte de um aceite que o projeto roda: portão de QA, teste de CI ou etapa do pipeline |
| **ferramenta operacional** | ninguém chama, mas mede algo que existe hoje em São Carlos e no v16-moveis, e roda à mão quando aquela parte muda |
| **experimento descartável** | serviu a um experimento encerrado ou fora do escopo, não tem chamador vivo, e o registro dele já está no git e nos documentos |
| **histórico** | media algo real, mas só roda num cenário que saiu do escopo. Vale como registro, não como ferramenta |

## Os 5 `_*.py` da raiz: experimento descartável

Os cinco entraram no git com o baseline de 14/09 (`cbf9722`) e não mudaram depois. São do experimento **proxy/union de Ribeirão Preto**: trocar a casa gerada pelo footprint do Overture e, depois, dissolver os footprints vizinhos. O experimento foi refutado (a união colou casas geminadas) e está fora do escopo, que hoje é só São Carlos.

| Script | Linhas | O que faz | Quem chama (código) | CI | Docs | Classe |
|---|---:|---|---|---|---|---|
| `_diagnostico_quadra.py` | 180 | diagnóstico por quarteirão da base UNION de Ribeirão | ninguém | não | só o levantamento | **experimento descartável** |
| `_mede_proxy.py` | 204 | sonda de raycast da variante proxy | ninguém | não | só o levantamento | **experimento descartável** |
| `_union_proxy.py` | 302 | dissolve os footprints da variante proxy | ninguém vivo; só os outros `_*.py` e dois registros (abaixo) | não | só o levantamento | **experimento descartável** |
| `_variante_proxy.py` | 94 | escreve `padrao/cidades/ribeirao-preto-proxy.json` | ninguém vivo; só o `_variante_union.py` | não | só o levantamento | **experimento descartável** |
| `_variante_union.py` | 75 | escreve `padrao/cidades/ribeirao-preto-proxy-union.json` | ninguém | não | só o levantamento | **experimento descartável** |

**Os dois registros que citam `_union_proxy`:** um é `padrao/cidades/ribeirao-preto-proxy-union.json`, que se declara "VARIANTE DE EXPERIMENTO, não é cidade de produção". O outro é `tasks/modularizacao/baseline/manifest.json`, o registro do baseline da modularização. Nenhum dos dois executa nada, e os dois são registros congelados.

**O que eles leem:** `ribeirao-preto-v4-recortado.city.json` e as saídas de Ribeirão. Nada disso está no git, então nenhum dos cinco roda num checkout.

### Retirados em 27/09/2026 (#41)

Saíram do `HEAD` os 5 `_*.py` e os dois JSON de variante que eles geraram, 7 arquivos no total:

| Arquivo | Blob | Bytes |
|---|---|---:|
| `_diagnostico_quadra.py` | `f9acbf61762d` | 8.089 |
| `_mede_proxy.py` | `f3594b6e797d` | 8.827 |
| `_union_proxy.py` | `085fb9a1cc92` | 12.019 |
| `_variante_proxy.py` | `d845fb6a2f4b` | 4.247 |
| `_variante_union.py` | `a01e37e05353` | 3.223 |
| `padrao/cidades/ribeirao-preto-proxy.json` | `378b0d30bc23` | 13.237 |
| `padrao/cidades/ribeirao-preto-proxy-union.json` | `b69aa9863aef` | 12.965 |

**Por que os dois JSON saíram, e não foram movidos para uma pasta histórica:**

- Eles estavam no namespace operacional `padrao/cidades/`, e o `cidade.lista()` enumera qualquer `.json` dali.
- Mantidos, o `rodar_qa.py --todas` e as sondas que rodam "todas as cidades" continuariam tratando um experimento morto como cidade.
- O histórico fica no git (os blobs acima) e neste documento.

Depois da retirada, o `cidade.lista()` devolve 6 cidades: `araraquara`, `ribeirao-preto`, `ribeirao-preto-oficial`, `sao-carlos`, `sao-jose-do-rio-preto` e `sorocaba`.

**O que ficou, e é registro:**

- o `tasks/modularizacao/baseline/manifest.json` e o `tasks/modularizacao/inventario.json` ainda citam as variantes. São registros congelados da modularização;
- o `tasks/higiene-repositorio/levantamento.md` também, porque é o diagnóstico datado de 26/09.

**Ficaram sem o caso que os motivou, e não foram mexidos:**

- `pipeline/recorta_sitios.py` foi escrito para a variante `ribeirao-preto-proxy`. Segue como ferramenta genérica (`<slug> --entrada --saida`), e a seção dele no `PIPELINE.md` ainda usa a variante como exemplo. Fica para decisão depois.
- O campo `plantas_de` do `padrao/cidade.py` também nasceu para a variante, mas **continua em uso** pelo `ribeirao-preto-oficial.json`.

## Os 12 `pipeline/testa_*.py`

### Gate vivo (7): os portões de comportamento

A cadeia até eles:

1. `npm run qa` ou a etapa 9 do `pipeline/rodar.py` chamam o `padrao/rodar_qa.py`;
2. ele chama o `padrao/qa.roda`;
3. que chama o `padrao/comportamento.SONDAS`, com um subprocesso por sonda.

Os outros dois dos 9 portões são `pipeline/mede_minimapa.py` e `pipeline/mede_interior.py`, que não são `testa_*`.

- **Última rodada registrada:** `relatorios/qa_sao-carlos.json`, de 18/09/2026, variante v16-moveis, com **os 9 aprovados**. Não reexecutei neste levantamento.
- **Não rodam no CI:** precisam de Chrome e da página montada.

| Script | Linhas | Último commit | Prova | Quem chama | Classe |
|---|---:|---|---|---|---|
| `testa_duplo_clique.py` | 138 | 14/09 `8975867` | a página abre em `file://` | `comportamento.py`; e **`tests/test_double_click_targets.py` o importa, no CI Python** | **gate vivo** |
| `testa_terreno_base.py` | 169 | 14/09 `cbf9722` | terreno de fundo sem buraco | `comportamento.py` | **gate vivo** |
| `testa_quadro_preguicoso.py` | 232 | 14/09 `cbf9722` | rótulo e sombra só refazem quando algo muda | `comportamento.py` | **gate vivo** |
| `testa_governador.py` | 127 | 14/09 `cbf9722` | a resolução chega ao canvas | `comportamento.py` | **gate vivo** |
| `testa_arvore_incremental.py` | 152 | 14/09 `cbf9722` | o remendo por raio é igual à reconstrução | `comportamento.py` | **gate vivo** |
| `testa_v12_ux.py` | 219 | 18/09 `a4ae8a3` | busca, link, noite, minimapa | `comportamento.py` | **gate vivo** |
| `testa_ficha_e_perto.py` | 341 | 18/09 `a4ae8a3` | a vitrine para na ficha; o pino nasce apagado | `comportamento.py` | **gate vivo** |

Os renderizadores também citam alguns desses nomes em comentários (`app.js` do v15, do v16-moveis, do v17 e do v18). É referência, não chamada.

**Um limite conhecido:** as sondas acham a página por `RAIZ/<versão>` e não recebem o `--destino`. Isso fica para a frente de renderizadores.

### Ferramentas operacionais (3)

Ninguém as chama, nem o CI. Elas medem partes do interior e do editor que existem hoje no v16-moveis, e rodam à mão quando essas partes mudam.

| Script | Linhas | Último commit | Uso documentado | O que mede | Classe |
|---|---:|---|---|---|---|
| `testa_junta.py` | 48 | 14/09 `cbf9722` | `python pipeline/testa_junta.py` (São Carlos, `sanca-135-29`) | o fio claro na junta parede-teto, pela foto do `pipeline/foto_interior.py`. Escreve `unreal/_junta.png` | **ferramenta operacional** |
| `testa_luz.py` | 225 | 14/09 `cbf9722` | `python pipeline/testa_luz.py sao-carlos` | interruptor, plafom e parede que veda | **ferramenta operacional** |
| `testa_moveis.py` | 302 | 20/09 `be2676b` | `python pipeline/testa_moveis.py sao-carlos` | o modo Móveis: grade, gizmo, fantasma. O `v1.5/miniaturas/testa_etapas.py` o cita como modelo | **ferramenta operacional** |

### Histórico (1): retirado no #43

| Script | Linhas | Último commit | Por quê | Classe |
|---|---:|---|---|---|
| `testa_pe_de_parede.py` (**saiu no #43**) | 74 | 14/09 `cbf9722` | só mede em **Ribeirão Preto** (`mirra-114`). A docstring explica que em São Carlos a unidade tem atlas do Unreal e o defeito não apareceria. Ribeirão está fora do escopo, e a `mirra-114` está travada para publicação (`NAO_PUBLICAR`) | **histórico** |

**Retirado em 27/09/2026 (#43).**

| Arquivo | Blob | Bytes |
|---|---|---:|
| `pipeline/testa_pe_de_parede.py` | `43c8ae1b7ab2` | 3.796 |

**Motivo:**

- Ninguém o chamava: nem código, nem CI, nem documento vivo. Ele só aparecia no `scripts.md`, no levantamento datado de 26/09 e no inventário congelado da modularização.
- Só media em Ribeirão Preto (`mirra-114`), que está fora do escopo.
- A `mirra-114` está travada para publicação (`NAO_PUBLICAR`).
- A própria docstring dizia que o defeito não se reproduz no caso de São Carlos.

O histórico fica no git (o blob acima) e neste documento.

### `testa_recorte.py`: o gate do build por imóvel (#42)

**Implementado no #42.** A verificação de identidade saiu do script e virou gate do build por imóvel. A autoridade é uma só: a função `diverge` do `pipeline/recorte.py`.

| Item | Estado |
|---|---|
| Onde mora a verificação | `pipeline/recorte.py`: a função pura `diverge(cheia, corte, lib_cheia, lib_corte)` e a exceção `IdentidadeQuebrada` |
| O que confere | cada prédio do recorte, achado pela **posição** do primeiro vértice na cidade inteira, num casamento **1:1** (um prédio da cidade é par de um só prédio do recorte): cor, altura, número de vértices, nome e endereço, frente (`fa`), existência, posição e rotação do `urbanLot`, e o modelo urbano **pelo id**, não pelo índice, porque a biblioteca encolhe. A frente **falha fechado:** presente num lado e ausente no outro reprova |
| Quando | **durante a própria montagem.** O `Recorte.citydata` guarda o bloco inteiro e compara com o recortado; o `Recorte.urbanModels` confere o modelo de cada lote. Não se monta a cidade cheia |
| Efeito | uma divergência levanta `IdentidadeQuebrada` (um `RuntimeError`) e aborta a geração do tour, antes de existir build promovível |
| O gate só lê | o corte em si foi para `_corta_cidade` e `_corta_modelos`, sem mudar a lógica. A saída é byte a byte a de antes (teste `test_the_gate_only_reads` e a rodada do Cedros) |
| Ordem dos blocos | continua travada: `urbanModels` antes de `citydata` e `luzue` antes de `unidades` levantam erro, e não viram biblioteca vazia |
| `pipeline/testa_recorte.py` | **invocador fino** da mesma `diverge`, para rodar à mão sobre páginas já montadas (o tour e a página cheia). Não duplica lógica |

**Os testes** estão em `tests/test_recorte_gate.py`: 20 testes, no CI, determinísticos, com uma cidade de cinco prédios feita à mão e uma biblioteca de 100 modelos com índices esparsos, para que a poda remapeie.

- O recorte correto passa e mantém o modelo pelo id.
- O gate só lê.
- Dois prédios que começam no mesmo ponto não disparam alarme falso.
- As mutações de altura, nome, `fa`, modelo pelo id, posição do `urbanLot`, `urbanLot` ausente e prédio sem par reprovam, cada uma com o seu tipo.
- Um prédio duplicado no recorte, com um só correspondente na cidade inteira, reprova (`duplicado`).
- O array `fa` removido inteiro, ou curto demais, reprova (`fa ausente`), sem depender de `IndexError`. Contra a `diverge` anterior, esses três testes reprovavam, o que prova que pegam os dois furos.
- A divergência aborta o `citydata` e o `urbanModels` durante a montagem.
- A ordem errada dos blocos continua falhando, também passando pelo `aplica`.
- A autoprova do módulo (`_prova`) passa.
- **Mutação:** desligar o gate no `citydata` ou no `urbanModels` faz o teste correspondente reprovar.

**A rodada do Cedros** é o `python pipeline/build_imovel.py monte-dos-cedros-37`:

- ela devolve **`34331f1ceb9d`**, com `reutilizado: true`;
- num build novo em pasta temporária, o gate rodou sobre os dados reais. No `__citydata`, conferiu 23.681 prédios do recorte contra os 89.895 da cidade, com 13.237 lotes urbanos e 10 posições com mais de um prédio; no `__urbanModels`, o modelo de cada lote. As duas conferências deram **0 divergências**;
- `tour.html` e `maquete.html` saíram idênticos byte a byte aos do ar.

O invocador manual, sobre o tour do Cedros e uma página cheia montada, também deu 23.681 prédios e 0 divergências.

## Outros avulsos da raiz, fora desta lista

Dois `.py` da raiz também não têm chamador, e ficam registrados para a decisão de depois:

- `build_pois.py` grava `pois_sao_carlos.json`, que ninguém lê;
- `convert_overture.py` foi substituído pelo `rebuild_city.py` e tem um caminho absoluto de máquina escrito no código.

Os outros `.py` da raiz são chamados pelo `pipeline/rodar.py`, ou são invocadores exigidos por `tests/test_pipeline_paths.py`.

## Resumo e próximos PRs

| Classe | Scripts |
|---|---|
| gate vivo | 7 portões `testa_*` |
| ferramenta operacional | `testa_junta`, `testa_luz`, `testa_moveis` |
| gate do build por imóvel | a verificação de identidade do recorte (`pipeline/recorte.py`, #42); o `testa_recorte` é o invocador manual dela |
| experimento descartável | os 5 `_*.py`, **retirados no #41** |
| histórico | `testa_pe_de_parede`, **retirado no #43** |

**Ordem:**

1. **Feito no #41:** saíram os 5 `_*.py` e os dois JSON de variante de Ribeirão.
2. **Feito no #42:** o `testa_recorte` virou gate do build por imóvel.
3. **Feito no #43:** o `testa_pe_de_parede` saiu do `HEAD`.
4. **Os renderizadores** vêm depois, e com eles a questão das sondas presas à pasta da versão.
