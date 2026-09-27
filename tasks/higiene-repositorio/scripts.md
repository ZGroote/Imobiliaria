# Scripts avulsos — inventário e classificação (27/09/2026)

**Histórico deste documento:**

- **#40:** inventário e classificação, sem remover nada.
- **#41:** saíram os 5 `_*.py` e os dois JSON de variante de Ribeirão que eles geraram (seção seguinte).

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

### Histórico (1)

| Script | Linhas | Último commit | Por quê | Classe |
|---|---:|---|---|---|
| `testa_pe_de_parede.py` | 74 | 14/09 `cbf9722` | só mede em **Ribeirão Preto** (`mirra-114`). A docstring explica que em São Carlos a unidade tem atlas do Unreal e o defeito não apareceria. Ribeirão está fora do escopo, e a `mirra-114` está travada para publicação (`NAO_PUBLICAR`) | **histórico** |

### `testa_recorte.py`: vira gate do build por imóvel (tratado à parte)

| Item | Estado |
|---|---|
| Linhas / último commit | 108 / 19/09 `52f96cb` |
| O que prova | que o recorte preserva a **identidade** de cada prédio: mesma cor, altura, número de vértices, nome, fachada (`fa`) e modelo urbano. Compara o tour recortado com a página cheia, casando cada prédio pela **posição** |
| Quem chama hoje | ninguém. O `pipeline/recorte.py` o cita duas vezes, em comentário, como o conferidor que pegou defeitos reais |
| Uso documentado | `python pipeline/testa_recorte.py imovel/sao-carlos/sanca-135-29.html`, contra a página cheia fixa `v16-moveis/sao-carlos-v16-moveis-aberto.html` |
| Classe hoje | ferramenta operacional, mas protege uma peça do **produto publicado**: o tour por imóvel |

**Por que não serve como teste genérico de CI:** ele precisa de duas páginas montadas, o tour e a página cheia do mapa, e nenhuma das duas está no git. Montar as duas no CI custaria minutos por imóvel. E a página cheia vem de um caminho fixo da pasta da versão, que é o mesmo problema das sondas.

**Desenho proposto para o gate (a implementar em PR próprio):**

1. **Onde:** dentro do build por imóvel. O `pipeline/imovel.py` (`gera`) monta o tour chamando `montar.monta(..., recorte=r)`. O recorte é aplicado **bloco a bloco** (`Recorte.aplica`), com o texto inteiro de cada bloco na mão. Então o gate **não precisa da página cheia:** basta guardar o `__citydata` e o `__urbanModels` inteiros no momento do recorte e comparar com os recortados.
2. **O quê:** a mesma verificação do script, movida para uma função do `pipeline/recorte.py`, que não sai de lá. São duas regras:
   - todo prédio do recorte tem par na cidade inteira pela posição;
   - cor, altura, vértices, nome, `fa` e modelo urbano (pelo **id** do modelo) são iguais.
3. **Efeito:** divergência faz o `build_imovel.py` **falhar** (`ValueError`), antes de gravar o build. É o mesmo lugar onde já estão a canonicalização e a checagem de fonte estável. Recorte que troca a identidade de um prédio não vira preview nem live.
4. **Prova:** um teste Python do CI, sem montar cidade, com um `__citydata` pequeno montado à mão:
   - recorte correto passa;
   - trocar altura, nome ou modelo de um prédio reprova;
   - prédio sem par reprova.

   Mais uma rodada do build do Cedros, que tem de reproduzir o `34331f1ceb9d` (o gate só lê, então não muda os bytes).
5. **E o script manual:** vira um invocador fino dessa função, ou sai quando o gate entrar. Fica para você decidir no PR do gate.

## Outros avulsos da raiz, fora desta lista

Dois `.py` da raiz também não têm chamador, e ficam registrados para a decisão de depois:

- `build_pois.py` grava `pois_sao_carlos.json`, que ninguém lê;
- `convert_overture.py` foi substituído pelo `rebuild_city.py` e tem um caminho absoluto de máquina escrito no código.

Os outros `.py` da raiz são chamados pelo `pipeline/rodar.py`, ou são invocadores exigidos por `tests/test_pipeline_paths.py`.

## Resumo e próximos PRs

| Classe | Scripts |
|---|---|
| gate vivo | 7 portões `testa_*` |
| ferramenta operacional | `testa_junta`, `testa_luz`, `testa_moveis`; e `testa_recorte`, a caminho de virar gate |
| experimento descartável | os 5 `_*.py`, **retirados no #41** |
| histórico | `testa_pe_de_parede` |

**Ordem:**

1. **Feito no #41:** saíram os 5 `_*.py` e os dois JSON de variante de Ribeirão.
2. **Transformar o `testa_recorte` em gate do build por imóvel,** com o desenho acima.
3. **Decidir o `testa_pe_de_parede`:** fica como histórico ou sai.
4. **Os renderizadores** vêm depois, e com eles a questão das sondas presas à pasta da versão.
