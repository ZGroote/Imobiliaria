# Renderizadores de cidade: inventário e classificação (27/09/2026)

**Histórico deste documento:**

- **#44:** inventário e classificação. Nada foi movido, apagado ou publicado.
- **#45:** o portão "cidade fora do código" passou a ler `config.fonte`.
- **#46:** o v15 deixou de ser o padrão. O `V_PADRAO` é `v16-moveis`, e o layout `v15/...` dos JSON das cidades virou `BASE_CAMINHO_SAIDA`, separado do padrão. O v15 continua congelado e disponível com `--variante v15`.
- **#47:** corrigidas as quatro docs desatualizadas do achado 3.
- **#48:** o v17 e o v18 saíram do `HEAD`, com os dois demos (seção "Retirada do v17 e do v18").
- **#49:** o v15 saiu do `HEAD` e de `VARIANTES` (seção "Retirada do v15"). Com isso a frente termina: uma única árvore de cidade viva, o v16-moveis.

As tabelas abaixo são a medida de 27/09 na base `78e6f12`, **antes** do #45 e do #46. Onde elas dizem que o v15 é o padrão, isso valia até o #46.

**Escopo:** os quatro renderizadores de **cidade**:

- `renderizador/` (v15);
- `v1.5/renderizador-v16-moveis/`;
- `v1.5/renderizador-v17/`;
- `v1.5/renderizador-v18/`.

Entram também as pastas de saída de cada um.

> **Isto não é sobre maquete.** Os dois padrões de maquete continuam **ATIVOS**, e nada aqui os classifica como legado:
>
> - o **LEVE** (`pagina_maquete.py` com os modelos `*_blender`);
> - o **PREMIUM** (o `padrao_atual.py` do Cedros, com luz assada).
>
> O LEVE depende do v16-moveis (ver a seção "Build por imóvel, LEVE e PREMIUM"), e isso é mais uma razão para o v16-moveis ficar como está.

**Base medida:** `main` `78e6f12`.

## Método

| Item | Como foi medido |
|---|---|
| **Quem lê** | `git grep` dos caminhos e dos nomes (`renderizador/`, `\bv15\b`, `renderizador-v16-moveis`, `v16-moveis`, `renderizador-v1[78]`, `\bv1[78]\b`), fora da própria árvore e dos `*.min.js`. Cada ocorrência em código foi lida para separar leitura de comentário |
| **CI / npm** | `.github/workflows/ci.yml` e `package.json` |
| **Build por imóvel** | as `fontes` dos manifests locais em `publicacao/builds/` (a pasta é ignorada pelo git) |
| **Tamanho** | `git ls-tree -r -l HEAD`. "Bytes só desta árvore" conta os blobs que nenhuma das outras três árvores tem |
| **Pastas de saída** | `du` e `git status`, **só leitura**, na pasta principal, que é onde as páginas montadas existem. O worktree não as tem |
| **Portão de código** | a lógica do `portao_cidade_fora_do_codigo` (`padrao/qa.py`), copiada num script fora do repositório e rodada sobre as quatro árvores. O repositório não foi alterado |

**Não foi executado:** o `rodar.py`, o `montar.py`, o `rodar_qa.py`, as sondas e o `publicar.py`. As sondas precisam de Chrome e da página montada. E o `rodar.py` roda o pipeline com qualquer argumento, então não serve para inspeção.

## Classificação

| Árvore | Arquivos | Tamanho no `HEAD` | Bytes só desta árvore | Último commit | Classe |
|---|---:|---:|---:|---|---|
| `v1.5/renderizador-v16-moveis/` | 88 | 1,40 MiB | 0,70 MiB (79 arquivos) | 26/09 `3cce0d4` | **ATIVO.** Não mexe |
| `renderizador/` (v15) | 7 | 1,18 MiB | 0,53 MiB (`app.js`, `cabeca.html`, `corpo.html`, `estilo.css`) | 19/09 `edab4af` | **CONGELADO / REFERÊNCIA.** Continua sendo o **padrão** do build (ver abaixo) |
| `v1.5/renderizador-v17/` | 12 | 1,30 MiB | 0,61 MiB (`app.js`, `corpo.html`, `estilo.css`) | 21/09 `da01e5d` | **DEMO / HISTÓRICO** |
| `v1.5/renderizador-v18/` | 12 | 1,33 MiB | 0,64 MiB (`app.js`, `corpo.html`, `estilo.css`) | 21/09 `da01e5d` | **DEMO / HISTÓRICO** |

Os blobs são **compartilhados** entre as árvores:

- o `three.min.js` (`b6a311783f5b`), o `earcut.min.js` (`79cf67e10013`) e o `rabo.html` são o mesmo blob nas quatro;
- o `cabeca.html` e os cinco módulos soltos do v17 e do v18 são o mesmo blob do v16-moveis: `exterior-details.js`, `listing-models.js`, `road-clearance.js`, `terrain-fit.js` e `urban-models.js`.

Por isso retirar uma árvore economiza, no `HEAD`, só a coluna "bytes só desta árvore", e não o tamanho inteiro.

## Por árvore: quem gera, quem lê, o que é fonte

### v16-moveis: ATIVO

**Quem gera:** é fonte mantida à mão. Saiu da modularização do monólito v16-moveis (concluída em 18/09) e foi para `v1.5/` em 21/09 (`da01e5d`). O `pipeline/build/config.py` a acha por `v1.5/renderizador-<variante>`.

**Quem lê:**

| Onde | O quê |
|---|---|
| **npm** | `npm run qa` → `rodar_qa.py sao-carlos --variante v16-moveis`; `npm run montar` → `montar.py sao-carlos --variante v16-moveis` |
| **CI** | `npm test` roda os 64 `tests/*.mjs` que citam o v16-moveis. **48** deles comparam os módulos com o monólito histórico por `git show <commit>:renderizador-v16-moveis/app.js`. É o **caminho antigo, da raiz**, e é por isso que o CI clona com `fetch-depth: 0`. "Consertar" esse caminho quebra os testes |
| **Publicação do mapa** | `firebase.json` → `public: v16-moveis/publicado` |
| **Piloto e build por imóvel** | `tasks/v1.0/piloto.json` → `"variante": "v16-moveis"`; `build_imovel.py` e `preparar_piloto.py` resolvem a config por ele |
| **Python com caminho escrito** | `pipeline/publicar_imovel.py:48` e `pipeline/preparar_piloto.py:95` (tiles em `v16-moveis/publicado/mapa`), `pipeline/testa_recorte.py:20` (página cheia), `v1.5/miniaturas/pagina_maquete.py:27` e `:2394` (o LEVE), `tools/publicar_aberto.py`, `tools/montar_conferencia_cadastros.py`, `exteriores/v1/preparar.py`, `exteriores/v1/dividir_terrenos.py`, `modelos_urbanos/v1/integracao/testar_browser.py` |
| **JS com caminho escrito** | `modelos_urbanos/v1/gerar_compactos.mjs`, `modelos_urbanos/v1/integracao/*.mjs` (5 arquivos), `tools/auditar_substituicoes.mjs` |
| **Testes Python** | 6 arquivos, entre eles `test_build_manifest.py`, que prova que o manifest do v16-moveis não inclui o `renderizador/app.js` do v15 |

**Fonte, saída e evidência:**

- **fonte:** os 88 arquivos de `v1.5/renderizador-v16-moveis/`;
- **saída regenerável:**
  - `v16-moveis/sao-carlos-v16-moveis-aberto.html` e `.html`, do `montar.py`;
  - `v16-moveis/publicado/**/*.html`, do `publicar.py` e de `tools/publicar_aberto.py`.

  Nenhuma dessas está no git, e **nenhuma está no `.gitignore`**: aparecem como `??` na pasta principal;
- **versionado:** `v16-moveis/publicado/mapa/`, com 239 tiles de quintal (15,90 MiB). O `exteriores/v1/dividir_terrenos.py` os gera, mas eles ficam no git de propósito, porque entram no manifest do build e na publicação (ver `arquivos-grandes.md`).

### v15 (`renderizador/`): CONGELADO / REFERÊNCIA, mas ainda é o padrão

**Quem gera:** o `pipeline/extrair_renderizador.py --grava` o gerou **uma vez**, a partir de `v8/sao-carlos-v8-aberto.html`. Depois disso foi mantido à mão até 19/09. A entrada do extrator (`v8/`) não existe mais, então o extrator não roda. Se rodasse com `--grava`, sobrescreveria `renderizador/`.

**Capacidade exclusiva: nenhuma hoje.** A matriz de variantes (`tasks/modularizacao/matriz-variantes.md`) mostrou dois galhos. As duas capacidades que só o v15 tinha foram portadas para o v16-moveis atrás de chave de aparência:

- `sombra_projetada` (`scene/city-shadow.js`), **ligada** em `padrao/cidades/sao-carlos.json`;
- `especular_fragmento` (`materials/facades.js`), que a medida de 18/09 mandou não promover.

**Onde ele ainda entra em build, QA e publicação.** Esta é a parte que precisa de PR próprio antes de qualquer retirada:

| Onde | O que acontece hoje |
|---|---|
| `pipeline/build/config.py:7` | `V_PADRAO = 'v15'`. Sem `--variante` e sem `MAPA_V`, **tudo** resolve para o v15 |
| `pipeline/rodar.py:49` | `CONFIG = resolve()`, sem argumento. O comando documentado no `PIPELINE.md` e no `PADRAO.md` (`python pipeline/rodar.py`) **monta o v15** na etapa 8 e **roda o QA do v15** na etapa 9 (`rodar_qa.py <slug>`, sem `--variante`) |
| `padrao/rodar_qa.py` | sem `--variante`, usa o v15. O `npm run qa` passa `--variante v16-moveis` |
| `pipeline/publicar.py` | sem `--variante`, usa o v15, e sem cidade usa `ribeirao-preto`. Não chega em produção por engano, porque escreve em `v15/publicado`, que nenhum `firebase*.json` serve. Mas é o padrão errado |
| `padrao/qa.py:330` (`portao_cidade_fora_do_codigo`) | varre **só** `renderizador/`, qualquer que seja a variante. O `npm run qa` do v16-moveis mede o código do v15. A mesma lógica sobre as quatro árvores deu **0 ocorrências em todas**, então apontar o portão para a fonte da variante (`config.fonte`) continua passando |
| `padrao/cidades/*.json` | **cinco das seis cidades** declaram as saídas em `v15/...` (`html_saida: v15/<cidade>-v15-aberto.html`, e o `html_comprimido` junto). A exceção é a `ribeirao-preto-oficial`: ela usa scratch diagnóstico (`_run_cadastro_oficial/diagnostico-aberto.html` e `diagnostico.html`) e **não é remapeada** por componente de versão. O `BuildConfig.saida()` só troca o componente que é `V_PADRAO` ou que contém `-V_PADRAO`. **Trocar o `V_PADRAO` sem mexer nisso muda o destino das saídas das cinco;** o da oficial não muda |
| `tests/test_build_config.py` | trava `resolve(environ={}).versao == 'v15'` e `VARIANTES == ('v15', 'v16-moveis')` |
| sondas de comportamento | seguem o `VERSAO` (seção seguinte), que é v15 sem `MAPA_V` |

**Outros que leem o v15:**

- `tools/monta_visualizador.py:19` lê o `three.min.js` de `renderizador/lib`, que é o mesmo blob do v16-moveis;
- `pipeline/fazer_backup.py:27` copia `renderizador/` no backup;
- `tests/test_double_click_targets.py`, `test_pipeline_paths.py` e `test_publicar.py` usam "v15" como nome de variante ou no texto.

**O resto são comentários e registros:**

- docstrings de `montar.py`, `extrair_dados.py`, `mede_interior.py`, `testa_ficha_e_perto.py` e `rebuild_city.py`;
- `v1.5/LEIA-ME.md`;
- os registros congelados da modularização.

**Fonte, saída e evidência:**

- **fonte:** os 7 arquivos de `renderizador/`;
- **saída regenerável:** `v15/`, com 81 MB e 7 arquivos na pasta principal, incluindo páginas de Ribeirão Preto. Não é versionada nem ignorada.

### Retirada do v15 (#49, 27/09/2026)

Saiu do `HEAD`, **removido e não movido** para `_arquivo/`: o histórico do git é a referência, como já é para os testes de equivalência da modularização (`git show <commit>:...`).

| Saiu | Objeto no git | Arquivos | Bytes |
|---|---|---:|---:|
| `renderizador/` | árvore `aa64236b09ec` | 7 | 1.242.127 (1,18 MiB) |

Os blobs: `app.js` `e8428038df54` (524.159), `cabeca.html` `3db7bbb9c57d`, `corpo.html` `de4f14e915a6`, `estilo.css` `4951121e8df0`, `lib/three.min.js` `b6a311783f5b`, `lib/earcut.min.js` `79cf67e10013` e `rabo.html` `8b137891791f`. Os três últimos continuam no v16-moveis, que tem o mesmo blob.

- **Por que podia sair:** depois do #45 e do #46, o v15 não era o padrão, não era servido pelo Firebase, não entrava no Cedros nem na publicação, e não tinha capacidade exclusiva (as duas foram portadas para o v16-moveis atrás de chave).
- **`v15` deixou de ser variante:** `VARIANTES = ('v16-moveis',)`. `--variante v15` e `MAPA_V=v15` reprovam como **variante desconhecida** no `montar`, no `rodar_qa`, no `publicar`, no `rodar.py` e nas sondas.
- **Precedência: flag explícita > `MAPA_V` > padrão.** Nenhum import valida o ambiente. Quem aceita `--variante` (`montar`, `rodar_qa`, `publicar`) deixa a flag vencer um `MAPA_V=v15` esquecido. Quem não aceita (as sondas, os medidores e o `fazer_backup`) faz `resolve().versao` no próprio processo e reprova antes de procurar a página velha que ainda está em `v15/` no disco.
- **`BASE_CAMINHO_SAIDA = 'v15'` fica.** Ele não é variante: é o layout que cinco JSON de cidade ainda declaram (`v15/<cidade>-v15-aberto.html`), remapeado para `v16-moveis/...`. Os JSON não mudaram.
- **Os consumidores auxiliares migraram:** o `tools/monta_visualizador.py` pega o three.js do v16-moveis (mesmo blob), e o `pipeline/fazer_backup.py` arquiva `v1.5/renderizador-v16-moveis/`. Sem isso, o backup sairia sem renderizador, calado, porque ele pula caminho que não existe.
- **Trava:** `tests/test_pipeline_paths.py` reprova se `renderizador/` voltar ao índice do git.
- **Cedros:** `34331f1ceb9d`, com `tour.html` e `maquete.html` iguais byte a byte.

### v17 e v18: DEMO / HISTÓRICO

**Quem gera:** nasceram na branch `claude/serene-edison-de1ior`:

- `fbaf74f` trouxe as três etapas e a planta 3D;
- `ea81c4c` e `d9b4682` trouxeram o montador de demo;
- `facd7ef` trouxe o `firebase.v17.json`.

A branch continua no remoto e não foi mesclada. As árvores entraram no `main` pela consolidação da 1.5 (`da01e5d`, 21/09) e ninguém as editou desde então. Cada uma é um `app.js` monolítico, não modular.

**As funções já estão no v16-moveis:**

- as três etapas e a planta em cena própria do v17 foram portadas como módulo em `a5411f1` (20/09);
- a maquete do v18 (`montaMaquete`) está em `listings/stage.js` e no `app.js` do v16-moveis desde `da01e5d`.

Os comentários `v17.` e `v18.` dentro do `stage.js` marcam essa origem.

**Quem lê:** só as duas demos.

- `v1.5/miniaturas/demo_v17.py` lê `renderizador-v17/` e escreve `v17/demo-v17.html`.
- `v1.5/miniaturas/demo_v18.py` lê `renderizador-v18/` e escreve `v18/demo-v18.html`.

E também:

- **nenhum teste** depende delas. Os 8 `tests/*.mjs` que citam "v17" o fazem em comentário, e todos testam módulos do v16-moveis;
- **nenhum build** as usa: nenhuma das duas está em `VARIANTES`, então `montar.py`, `rodar_qa.py` e `publicar.py` as **recusam** (`variante desconhecida`);
- **nenhuma publicação** as serve: não existe `firebase.v17.json` no `main` e nenhum target no `.firebaserc`;
- **nenhum manifest** de imóvel as lista;
- o `pagina_maquete.py` cita o `montaMaquete` do v18 como origem do desenho, em docstring, mas lê o v16-moveis.

**Fonte, saída e evidência:**

- **fonte das demos:** os 12 arquivos de cada árvore;
- **saída regenerável:** `v17/` e `v18/`. Na pasta principal, `v17/` tem 32 MB com uma `sao-carlos-v17-aberto.html` antiga, montada quando o v17 ainda era variante, e `v18/` não existe. Nenhuma das duas é versionada ou ignorada.

### Retirada do v17 e do v18 (#48, 27/09/2026)

Saíram do `HEAD`, **removidos e não movidos** para `_arquivo/`: o histórico do git é a referência.

| Saiu | Objeto no git | Arquivos | Bytes |
|---|---|---:|---:|
| `v1.5/renderizador-v17/` | árvore `ab8ad1416486` | 12 | 1.367.424 |
| `v1.5/renderizador-v18/` | árvore `94f10d1df32c` | 12 | 1.398.689 |
| `v1.5/miniaturas/demo_v17.py` | blob `d277ef9b9db0` | 1 | 11.292 |
| `v1.5/miniaturas/demo_v18.py` | blob `5c277da85ea2` | 1 | 11.455 |
| **total** | | **26** | **2.788.860** (2,66 MiB) |

- **Por que podiam sair:** a classificação acima. Ninguém além dos dois demos os lia, nenhum teste, build, manifest ou config de Hosting os usava, o pipeline os recusava, e as funções já estavam no v16-moveis.
- **O `HEAD` encolhe 2,66 MiB, mas o repositório não:** os blobs compartilhados (`three.min.js`, `earcut.min.js`, `cabeca.html`, `rabo.html` e os cinco módulos soltos) continuam no v16-moveis, e o resto continua no histórico.
- **Trava:** `tests/test_pipeline_paths.py` reprova se `renderizador-v17/`, `renderizador-v18/`, `demo_v17.py` ou `demo_v18.py` voltarem ao índice do git, em qualquer pasta.
- **Cedros:** o `pagina_maquete.py` é fonte do build e teve só docstring e comentário alterados. O rebuild deu `34331f1ceb9d`, com `tour.html` e `maquete.html` iguais byte a byte.

## Sondas: de onde tiram o caminho da página

| Como acham a página | Sondas |
|---|---|
| `RAIZ/VERSAO/<cidade>-VERSAO-aberto.html`, com o `VERSAO` de `pipeline.montar` (`MAPA_V` ou v15) | os 9 portões de comportamento de `padrao/comportamento.py`: `testa_duplo_clique`, `testa_terreno_base`, `testa_quadro_preguicoso`, `testa_governador`, `testa_arvore_incremental`, `testa_v12_ux`, `testa_ficha_e_perto`, `mede_minimapa` e `mede_interior`. Também as manuais `testa_luz`, `testa_moveis` e `v1.5/miniaturas/testa_etapas.py` |
| caminho **escrito** do v16-moveis | `pipeline/testa_recorte.py:20` (a página cheia de referência) |
| caminho escrito do v15, v17 ou v18 | **nenhuma** |

O `rodar_qa.py --variante X` põe `MAPA_V` no ambiente antes de chamar as sondas, então o `npm run qa` mede o v16-moveis. **Continua valendo:** as sondas ignoram `--destino` e medem a página na pasta da versão.

## Build por imóvel, LEVE e PREMIUM

As `fontes` dos manifests locais, por árvore:

| Build | Fontes | `renderizador-v16-moveis/` | `padrao-atual/` | v15, v17, v18 |
|---|---:|---:|---:|---:|
| `monte-dos-cedros-37` `34331f1ceb9d` (no ar), `215965d37d7d`, `39234fb6c9bc` | 164 | 89 | 10 | **0** |
| `monte-das-colinas-39` `9f13a8855255` | 156 | 89 | 0 | **0** |
| `wish-castanheiras-58` `5ff5e5e73b16` | 156 | 89 | 0 | **0** |

As 89 entradas são os 88 arquivos da árvore mais o `estilo.css` registrado como **ausente** (`null`). O `manifest.snapshot` anota presença de propósito: um opcional que some também muda a página.

- **Tour:** a cidade recortada do v16-moveis (`pipeline/imovel.py` e `pipeline/recorte.py`).
- **LEVE:** o `pagina_maquete.py` embute do v16-moveis o `lib/three.min.js`, `core/geometry.js`, `materials/interior*.js` e nove módulos de `interior/`:
  - `furniture-param`, `furniture-catalog`, `shell-geometry`, `openings`, `floor-plan`;
  - `bake`, `light-atlas`, `house-mesh`, `furniture-editor` (este só no Cedros).

  **Retirar ou renomear o v16-moveis quebra o LEVE.**
- **PREMIUM:** no Cedros, o `pagina_maquete.py` entrega a página ao `padrao_atual.py`. Ele lê só os arquivos de `padrao-atual/`, com o three embutido no `anterior/v2.html`. **Não depende de nenhuma árvore de renderizador de cidade.**

Resultado: o Cedros e o `build_imovel` dependem **só** do v16-moveis. Nada no build por imóvel lê o v15, o v17 ou o v18.

## Achados que ficam para os próximos PRs

Não foram corrigidos aqui, porque este PR é só inventário.

1. **O v15 ainda é o padrão.** Os pontos de troca estão todos na tabela do v15: o `V_PADRAO`, o `rodar.py`, o `publicar.py`, o `rodar_qa.py`, o remapeamento do `html_saida` e o `test_build_config`.
2. **O portão "cidade fora do código" mede a árvore errada** quando a variante é o v16-moveis. Hoje passa nas quatro, então o conserto não muda o resultado.
3. **Documentação desatualizada** (corrigida no #47):
   - `v1.5/miniaturas/README.md:106` manda rodar `MAPA_V=v18 ... testa_etapas.py`, mas o v18 não é variante e o `montar.py` o recusa;
   - `v1.5/miniaturas/README.md:176` diz que o `firebase.v17.json` "continua na raiz", mas ele só existe na branch `claude/serene-edison-de1ior`;
   - `v1.5/miniaturas/pagina_maquete.py:15` diz que a saída padrão é `v18/maquete.html`, mas é `v1.5/miniaturas/maquete.html` (linha 35);
   - `tests/test_pipeline_paths.py:13` diz que a "saída viva hoje é só `v15/`".
4. **As pastas de saída não estão no `.gitignore`:** `v15/`, `v17/`, `v18/` e o HTML de `v16-moveis/` aparecem como `??`. Ignorar exige cuidado, porque `v16-moveis/publicado/mapa/` tem os 239 tiles versionados.
5. **`pipeline/extrair_renderizador.py`** é histórico de uso único, e sua entrada não existe mais.

## Ordem decidida (gate do #44)

Nada disso foi feito neste PR.

1. **Feito no #45. Fazer o QA medir o renderizador usado:** o portão "cidade fora do código" passa a ler `config.fonte`. Vem **antes** da troca do padrão, porque não se promove o v16-moveis a padrão com uma barreira de QA ainda apontada para o v15. Como a mesma lógica deu 0 nas quatro árvores, o PR é isolável e de baixo risco.
2. **Feito no #46. Tirar o v15 de padrão.** O `V_PADRAO` passa a ser `v16-moveis`, com o remapeamento de `html_saida` resolvido e o `rodar.py`, o `publicar.py` e o `rodar_qa.py` seguindo junto. É o passo de mais risco, e merece PR só dele, com o Cedros conferido byte a byte (`34331f1ceb9d`).
3. **Feito no #47. Corrigir a documentação desatualizada** (achado 3).
4. **Feito no #48. v17 e v18:** as árvores e as duas demos saíram do `HEAD`. O histórico fica no git e na branch `claude/serene-edison-de1ior`.
5. **Feito no #49. v15:** saiu do `HEAD` e de `VARIANTES`, depois que os passos 1 e 2 provaram que nada além de suporte explícito e dois auxiliares o consultava.
