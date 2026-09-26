# Levantamento de higiene do repositório — 26/09/2026

**Só diagnóstico.** Nada foi apagado, movido ou reescrito, e não houve deploy. O documento serve
para planejar a limpeza em PRs pequenos:

1. licença e terceiros;
2. política de artefatos grandes;
3. scripts;
4. ciclo de vida dos renderizadores.

As cirurgias são decididas depois da revisão.

- **Base medida:** `origin/main` = `8bda9727` = tag `estabilizacao-2026-09-26`.
- **Método:** todos os números saíram de comandos de leitura (`git ls-tree -l`, `git rev-list --objects`,
  `git cat-file --batch-check`, `git grep`, a API do GitHub). Nenhum veio de memória.
- **Unidades:** MB é 2²⁰ bytes, sem compressão, salvo onde o texto diz outra coisa.

## 0. Resumo

| Item | Número |
|---|---|
| `HEAD` | 1.017 arquivos, **288,2 MB**. Os 29 acima de 1 MB somam 244,1 MB (85%) |
| Acima do aviso de 50 MB do GitHub | 1: `sao-carlos/dados/lotes_saocarlos_completo.geojson`, 62,3 MB (o limite duro é 100 MB) |
| Repositório no GitHub | público, 83.663 KB compactados (API), **sem licença detectada** |
| `.git` local (pasta principal) | pack de 1,93 GiB, mais 363,6 MiB soltos e 81,2 MiB de lixo |
| Histórico só local | 3.921,6 MB em 3.574 blobs. **99,95% presos na tag local `backup/varrimento-4083`** |
| `.bin` | 239 arquivos, 15,90 MB, todos em `v16-moveis/publicado/mapa/quintais/d9ef5bf4b34f/` |
| Renderizadores | 4 pastas. Duas vivas (v15 e v16-moveis) e duas usadas só por scripts de demonstração (v17 e v18) |
| `three.min.js` / `earcut.min.js` | 4 cópias idênticas de cada; nenhuma traz aviso de licença |
| Licença do projeto | sem arquivo `LICENSE`; o `package.json` da raiz diz `"ISC"` |
| Scripts avulsos | 5 `_*.py` na raiz: todos sem chamador. 12 `pipeline/testa_*.py`: 7 vivos, 4 manuais, 1 histórico |

## 1. Maiores blobs versionados

### 1.1 Por pasta e por extensão

| Pasta | MB | Arquivos | | Extensão | MB | Arquivos |
|---|---:|---:|---|---|---:|---:|
| `v1.5/` | 131,76 | 224 | | `.json` | 124,0 | 146 |
| `sao-carlos/` | 76,95 | 10 | | `.geojson` | 97,75 | 2 |
| raiz | 36,11 | 31 | | `.bin` | 15,90 | 239 |
| `v16-moveis/` | 15,90 | 239 | | `.html` | 13,03 | 20 |
| `experimentos/` | 7,12 | 39 | | `.gz` | 12,78 | 2 |
| `modelos_urbanos/` | 6,98 | 19 | | `.png` | 7,49 | — |
| `exteriores/` | 5,56 | 22 | | `.js` | 5,09 | 103 |
| `renderizador/` | 1,18 | 7 | | `.blend` / `.glb` | 2,95 / 2,80 | 4 / 4 |

### 1.2 Os 20 maiores, com classe e quem lê

Classes usadas nesta tabela:

- **Fonte:** baixada ou escrita à mão, e nenhum script do repositório a gera hoje.
- **Gerado:** saída de script. "entra no build" quer dizer que está no manifesto do build por
  imóvel (`pipeline/build/manifest.py`, `entradas(config)` → sha256 no manifesto publicado).
- **Intermediário:** gerado e lido só por scripts manuais.
- **Publicação:** página ou artefato servido.

| MB | Arquivo | Classe | Quem gera / quem lê |
|---:|---|---|---|
| 62,33 | `sao-carlos/dados/lotes_saocarlos_completo.geojson` | gerado, entra no build | `pipeline/juntar_lotes.py` (etapa 4) gera; `city_final.py`, `muros.py`, `portoes.py` e `ocupacao.py` leem (fonte `lotes`) |
| 35,43 | `lotes_saocarlos.geojson` (raiz) | fonte, entra no build | nenhum script do repositório o gera (entrou em `da01e5d`, 21/09). Leitores: `consolidar.py` (fallback), `encaixar_casas_lotes.py` e `auditar_quarteiroes.py` (fonte `lotes_visualizacao`) |
| 22,06 | `v1.5/miniaturas/padrao-atual/piloto-v3/source-before-normal-repair.json` | intermediário | cópia de antes do reparo de normais; só `repair-bake-normals.py` a lê |
| 22,03 | `…/piloto-v3/source.json` | intermediário | scripts de bake do Blender (`bake-v3.py`, `denoise-v3.py`, `repair-*.py`); não entra no build |
| 15,03 | `…/exterior-v3/geometry-compact.json` | gerado, entra no build do Cedros | `padrao_atual.py`, `source_manifest()`: vai para a página publicada |
| 14,20 | `…/exterior-v3/uv.json` | intermediário | `unwrap-exterior.py`, `bake-exterior.py` |
| 6,71 | `…/exterior-v3/lightmap.rgbm.gz` | gerado, entra no build do Cedros | idem 15,03 |
| 6,38 | `…/piloto-v3/geometry-compact.json` | gerado, entra no build do Cedros | idem |
| 6,08 | `…/piloto-v3/lightmap.rgbm.gz` | gerado, entra no build do Cedros | idem |
| 5,83 | `…/piloto-v3/uv.json` | intermediário | scripts de bake |
| 4,91 | `sao-carlos/sao-carlos-v7.city.json` | gerado, entra no build | `city_final.py` (fonte `city_saida`) |
| 4,90 | `modelos_urbanos/v1/mapa-casas.json` | gerado, entra no build | `compilar_mapa.mjs`; lido por `exteriores/v1/*` e pelas integrações |
| 4,08 | `sao-carlos/dados/street_tris.json` | gerado, entra no build | `pipeline/ruas.py` |
| 3,82 | `v1.5/miniaturas/maquete-wish-castanheiras-58.html` | publicação | página montada, copiada por `preparar_publicacao.py` para o site de miniaturas |
| 3,42 | `sao-carlos/dados/muros_segs.json` | gerado, entra no build | `pipeline/muros.py` |
| 3,22 | `…/padrao-atual/anterior/v2.html` | fonte, entra no build do Cedros | template da página do Cedros, com o three embutido; `tests/test_build_imovel.py` o exige |
| 3,16 | `v1.5/miniaturas/maquete-monte-das-colinas-39.html` | publicação | idem 3,82 |
| 2,88 | `exteriores/v1/mapa-exteriores.json` | gerado, entra no build | `exteriores/v1/gerar.py` |
| 2,81 | `…/exterior-v3/source.json` | intermediário | scripts de bake |
| 1,93 | `v1.5/miniaturas/castanheiras_blender/modelo.json` | gerado, entra no build | modelo do Blender da Castanheiras (`fontes_da_maquete`) |

O que isso mostra:

- **O build publicado depende dos dois `.geojson`** (97,75 MB juntos).
  - Eles estão no manifesto: `entradas(config)` do piloto soma 148 arquivos e 128,3 MB, e os dois
    são 76% disso.
  - Qualquer política que troque o conteúdo do checkout (LFS sem `lfs pull`, clone raso, sparse)
    muda o sha256 das entradas, ou faz o build falhar.
- **Os intermediários do bake do Cedros somam 66,9 MB** (os 4 `source*.json`/`uv.json` da tabela e
  o `exterior-v3/source.json`).
  - Nenhum build, teste ou site os lê: só os scripts do Blender que regeram o bake.
  - Um deles, `source-before-normal-repair.json`, é uma cópia de antes de um conserto.
- **Duplicatas no `HEAD`:** 25 cópias a mais de blobs idênticos, 2,33 MB na árvore de trabalho. O
  git guarda cada blob uma vez só.
  - 3 cópias extras do `three.min.js` e do `earcut.min.js` (seção 5);
  - 4 pares de PNG idênticos em `…/piloto-v3/textures/`.
- **`.docx` com acento:** `git ls-files` mostra `"relatorios/…"` entre aspas por causa do acento
  no nome. Não é uma pasta estranha: são os 2 `.docx` gerados por
  `relatorios/revisao-cronologia/gerar_*.py`, somando 0,13 MB.

### 1.3 Histórico e refs

**Quem segura cada blob** (conjuntos exatos de `rev-list --objects` por ref, sem a aproximação do
`--not`):

| Onde o blob é alcançável | Blobs | MB |
|---|---:|---:|
| `HEAD` (blobs únicos) | 992 | 285,8 |
| só no histórico de `origin/main` | — | 35,1 |
| só em outros refs do remoto | — | 0,9 |
| **só local, fora do remoto** | **3.574** | **3.921,6** |
| desses: só a tag `backup/varrimento-4083` (`05a4fa9`, 18/09) | 3.571 | 3.919,7 |
| desses: só `wip/pre-consolidacao-local-2026-09-24` e `stash@{0}` | 3 | 1,9 |

**Os maiores blobs só locais:**

- `fontes_osm/sudeste-latest.osm.pbf`: 816 MB. Entrou num commit por acidente; o `.gitignore`
  cita o episódio.
- `.geojson` de lotes de Ribeirão, Sorocaba, Araraquara e São José do Rio Preto;
  `overture_buildings.geojson`; `v13.zip`.
- As páginas montadas do v7 ao v16.

Tudo isso saiu do histórico publicado no varrimento de 18/09. A tag de backup existe para não
perder essas fontes antes de decidir.

**Refs**

- **No remoto:** 21 branches além de `main`. 20 já estão em `main`.
  - A exceção é `claude/serene-edison-de1ior` (20/09, 11 commits): o trabalho original do v17/v18.
    Dos 32 arquivos dele, 25 têm cópia byte a byte em `main` desde `da01e5d`.
  - Os 7 restantes são versões anteriores de scripts que continuaram evoluindo em `main`, mais o
    `firebase.v17.json`, que não existe em `main`.
  - Tags no remoto: só `estabilizacao-2026-09-26`.
- **Locais:**
  - 8 branches, entre elas `main` em `345e246`, atrás de `origin/main` (antes deste PR);
  - as tags `backup/varrimento-4083` (só local) e `estabilizacao-2026-09-26`;
  - `stash@{0}`, "salvaguarda etapa 0 (24/09)".
  - Worktrees: a pasta principal, `imobiliaria-trilho-b` e uma de revisão do Codex, destacada em
    `40d03ab`, que já está no remoto.
- **Lixo na pasta principal** (`git count-objects -v`):
  - 7 `tmp_obj_*` em `.git/objects`;
  - o resto de `.git/worktrees/imobiliaria-trilho-b/refs`;
  - 81,2 MiB no total, mais 2.133 objetos soltos (363,6 MiB) que um `gc` empacotaria.

**Arquivos não versionados**

- O `.gitignore` adota "fonte entra explicitamente": ignora segredos, caches e algumas pastas de
  trabalho, mas não as saídas de build.
- Por isso o `git status` da pasta principal lista dezenas de itens não versionados na raiz:
  - `araraquara/`, `arvores/*.blend`, `exteriores/v1/glb/`;
  - as prévias em `exteriores/v1/`;
  - os `.geojson` de bairros, `blocks.json` e `casas_lote.geojson`.
- Este levantamento não os inventariou um a um: não estão no git e não afetam clone, CI nem
  publicação.

## 2. Os `.bin`

- **Quantos e onde:** 239 arquivos, 15,90 MB (de 0,3 a 204,9 KB, média de 68,1 KB), todos em
  `v16-moveis/publicado/mapa/quintais/d9ef5bf4b34f/`. Nenhum outro `.bin` está versionado.
- **O que são:** os tiles de quintal do mapa. Classe: gerado e publicação.
  - `exteriores/v1/dividir_terrenos.py` os gera.
  - O prefixo `d9ef5bf4b34f` é o de `exteriores/v1/terrenos-manifesto.json`.
  - O resto de `v16-moveis/publicado/` (a página) não está versionado.
- **Quem depende:**
  - o site do mapa: `firebase.json` publica `v16-moveis/publicado`;
  - a publicação por imóvel: `pipeline/publicar_imovel.py` (`TILES`) e `pipeline/preparar_piloto.py`
    copiam o conjunto de tiles do build, e `exteriores/v1/preparar.py` escreve a pasta;
  - `tests/test_publicar.py` e `tests/test_build_imovel.py`, que testa o prefixo
    `./quintais/d9ef5bf4b34f/`.
- **Risco:** tirar esses arquivos do git (ou passá-los para LFS) tira a entrada do build por imóvel
  de quem clona. Mudar o prefixo muda o conjunto de tiles de todo build novo.

## 3. Scripts avulsos

Classificação:

- **vivo:** build, QA, teste ou CI chamam o script;
- **ferramenta manual:** ninguém chama, mas o script mede o estado atual (São Carlos, v16-moveis);
- **histórico:** mede ou produz um estado que já não é o atual;
- **candidato a remoção:** histórico sem dependente, com valor de registro já coberto pelo próprio
  git.

"Quem chama" foi medido com `git grep -w` do nome em todo o repositório, sem contar
`tasks/modularizacao/inventario.json`, que é um inventário congelado.

### 3.1 `_*.py` da raiz (5)

Os cinco têm o mesmo último commit, `cbf9722` (14/09, "preserve source baseline before
modularization"): entraram no git junto com o baseline, não foram escritos depois dele. **Nenhum é
chamado por ninguém**, e os cinco são do experimento proxy/union de **Ribeirão Preto**.

| Script | Linhas | O que faz | Classificação |
|---|---:|---|---|
| `_diagnostico_quadra.py` | 180 | diagnóstico por quarteirão da base UNION (lote vazio × casa engolida) | candidato a remoção |
| `_mede_proxy.py` | 204 | sonda de raycast: mirar um prédio devolve aquele prédio? (variante proxy) | candidato a remoção |
| `_union_proxy.py` | 302 | dissolve os footprints do Overture da variante proxy (`-union.city.json`) | candidato a remoção |
| `_variante_proxy.py` | 94 | escreve `padrao/cidades/ribeirao-preto-proxy.json` | candidato a remoção |
| `_variante_union.py` | 75 | escreve `padrao/cidades/ribeirao-preto-proxy-union.json` | candidato a remoção |

**Dependência a decidir junto com os scripts:** os dois JSON de cidade que eles geraram estão
versionados.

- O `ribeirao-preto-proxy-union.json` se declara "VARIANTE DE EXPERIMENTO, não é cidade de produção".
- `padrao/rodar_qa.py --todas` enumera `padrao/cidades/*.json` e os inclui.
- `padrao/cidade.py:38` cita o slug num comentário.
- Remover só os scripts não quebra nada. Remover os JSON muda o que o `--todas` roda.

**Os outros `.py` da raiz**, fora do pedido mas no mesmo lugar:

- **Vivos, chamados por `pipeline/rodar.py`:** `rebuild_city.py`, `fetch_osm_buildings.py`,
  `fetch_osm_pois.py`, `merge_osm_overture.py` e `build_blocks.py`.
- **Invocador do caminho antigo:** `baixar_openplots.py`. `tests/test_pipeline_paths.py` o exige,
  junto com os 13 invocadores de `plantas_pipeline/`.
- **Sem chamador:**
  - `build_pois.py` grava `pois_sao_carlos.json`, que ninguém lê;
  - `convert_overture.py` foi substituído por `rebuild_city.py`, que gera o mesmo `city_bruto`, e
    tem o caminho absoluto `C:\Users\respawn\Desktop\imobiliaria\…` fixo na linha 262.

### 3.2 `pipeline/testa_*.py` (12)

**Vivos (7): são 7 dos 9 portões de comportamento.**

- A cadeia até eles:
  - `npm run qa` ou `pipeline/rodar.py`, etapa 9;
  - → `padrao/rodar_qa.py` → `padrao/qa.roda`;
  - → `padrao/comportamento.SONDAS`, um subprocesso por sonda.
- Os outros dois portões são `pipeline/mede_minimapa.py` e `pipeline/mede_interior.py`.
- **Não rodam no CI:** precisam de Chrome headless e da página montada.

| Script | Linhas | Último commit | Prova |
|---|---:|---|---|
| `testa_duplo_clique.py` | 138 | 14/09 `8975867` | a página abre em `file://`. **`tests/test_double_click_targets.py` o importa (CI Python)** |
| `testa_terreno_base.py` | 169 | 14/09 `cbf9722` | terreno de fundo sem buraco |
| `testa_quadro_preguicoso.py` | 232 | 14/09 `cbf9722` | rótulo e sombra só refazem quando algo muda |
| `testa_governador.py` | 127 | 14/09 `cbf9722` | a resolução chega ao canvas |
| `testa_arvore_incremental.py` | 152 | 14/09 `cbf9722` | o remendo por raio dá o mesmo conjunto da reconstrução |
| `testa_v12_ux.py` | 219 | 18/09 `a4ae8a3` | busca, link, noite, minimapa |
| `testa_ficha_e_perto.py` | 341 | 18/09 `a4ae8a3` | a vitrine para na ficha; o pino nasce apagado |

**Ferramentas manuais (4):** sem chamador, mas medem o estado atual.

| Script | Linhas | Último commit | O que mede | Observação |
|---|---:|---|---|---|
| `testa_recorte.py` | 108 | 19/09 `52f96cb` | o recorte por imóvel preserva a identidade dos prédios | **único conferidor de `pipeline/recorte.py`, que entra no build por imóvel**; nem o build nem o CI o chamam |
| `testa_moveis.py` | 302 | 20/09 `be2676b` | modo Móveis do v16-moveis (grade, gizmo, fantasma) | `v1.5/miniaturas/testa_etapas.py` o cita como modelo |
| `testa_luz.py` | 225 | 14/09 `cbf9722` | interruptor, plafom e parede que veda (v16) | — |
| `testa_junta.py` | 48 | 14/09 `cbf9722` | fio claro da junta parede-teto | São Carlos, `sanca-135-29`, via `foto_interior.py` |

**Histórico (1):** `testa_pe_de_parede.py` (74 linhas, 14/09).

- Precisa de Ribeirão Preto montado; a docstring explica que em São Carlos a unidade tem atlas do
  Unreal e o defeito não apareceria.
- Com o escopo atual só em São Carlos, ele não tem onde rodar.

**Achado lateral, para o PR de renderizadores.** Todas as sondas localizam a página por
`os.path.join(RAIZ, VERSAO)`, com `VERSAO` importado de `pipeline/montar.py`.

- Só três fogem disso:
  - `testa_junta` passa por `foto_interior.py`;
  - `testa_pe_de_parede` também tira a foto por subprocesso;
  - `testa_recorte` tem o caminho fixo `v16-moveis/sao-carlos-v16-moveis-aberto.html`.
- Nenhuma recebe o `destino` de `BuildConfig`: um build feito com `--destino` é medido na página
  antiga da pasta da versão.
- Renomear ou mover a pasta de saída de uma variante muda o que os portões medem, sem erro.

## 4. Versões e renderizadores

**Qual renderizador cada variante usa** (`pipeline/build/config.py`):

- `VARIANTES = ('v15', 'v16-moveis')` e `V_PADRAO = 'v15'`.
- A fonte do `v15` é `renderizador/`. A de qualquer outra variante é `v1.5/renderizador-<variante>`.
- A pasta de saída é o nome da variante, na raiz: `v15/` e `v16-moveis/`. Nenhuma está versionada,
  exceto os tiles da seção 2.

| Versão | Pasta | Arquivos / MB | Último commit | Quem depende |
|---|---|---|---|---|
| **v15**, o monólito | `renderizador/` | 7 / 1,18 | 19/09 `edab4af` | a variante **padrão** (ver abaixo) |
| **v16-moveis**, modular | `v1.5/renderizador-v16-moveis/` | 88 / — | 24/09 `8647d2b` | tudo o que está no ar (ver abaixo) |
| v17 | `v1.5/renderizador-v17/` | 12 / — | 21/09 `da01e5d` | **só** `v1.5/miniaturas/demo_v17.py` |
| v18 | `v1.5/renderizador-v18/` | 12 / — | 21/09 `da01e5d` | **só** `v1.5/miniaturas/demo_v18.py` |
| v16 e v3–v12 | removidos | — | — | `tests/test_build_config.py` e `tests/test_pipeline_paths.py` garantem que não voltam |

**Quem depende do v15** (`renderizador/`):

- `montar.py`, `publicar.py` e `rodar_qa.py` caem nele sem `--variante`. Os comentários de
  `publicar.py:50` e `tests/test_publicar.py` registram que isso já subiu o renderizador antigo em
  silêncio.
- **`padrao/qa.py:330`**: o portão "cidade fora do código do renderizador" varre **só esta pasta**,
  qualquer que seja a variante medida.
- `tests/test_build_config.py` e `test_build_manifest.py` o tratam como variante válida.
- `pipeline/fazer_backup.py` e `pipeline/extrair_renderizador.py`.
- O `html_saida` dos JSON de cidade é `v15/…`, e `BuildConfig.saida` reescreve esse caminho para a
  variante.

**Quem depende do v16-moveis:**

- `npm run montar` e `npm run qa` (`--variante v16-moveis`).
- `tasks/v1.0/piloto.json`, cuja variante é a do piloto.
- **O site do mapa** (`firebase.json` → `v16-moveis/publicado`).
- **A publicação por imóvel:** `pagina_maquete.py` lê daqui o `lib/three.min.js` e o `interior/*.js`.
- 63 dos 67 testes Node (`tests/test_*.mjs`) e `tests/browser_texture_equivalence.py`.
- `modelos_urbanos/v1/*`, `modelos_cadastrados/gerar_estudos.mjs` e `tools/auditar_substituicoes.mjs`.

**Onde o v17 e o v18 aparecem:**

- Os dois demos escrevem em `v17/` e `v18/`, pastas que não estão versionadas.
- `v1.5/miniaturas/pagina_maquete.py:10` cita o `montaMaquete` do v18 **só em comentário**: o código
  foi copiado, não é lido do v18.
- Nenhum build, teste ou site lê essas pastas.

**Onde cada site no ar busca o renderizador.** Isto é só registro: produção está congelada neste
ciclo.

| Site | Pasta publicada | Renderizador |
|---|---|---|
| mapa (`firebase.json`) | `v16-moveis/publicado` | v16-moveis |
| imóveis (`firebase.imoveis.json`) | `publicacao/site`, fora do git | Cedros: template `padrao-atual/anterior/v2.html`, com three embutido. Os demais: `pagina_maquete.py`, com three e interior do v16-moveis |
| miniaturas (`firebase.miniaturas.json`) | `v1.5/miniaturas/publicado-atual`, fora do git | os `maquete-*.html` versionados, copiados por `preparar_publicacao.py` |
| painel (`firebase.painel.json`) | `painel/out` | nenhum |

**Configurações de cidade fora do escopo atual:** 7 dos 8 JSON de `padrao/cidades/`.

- São eles: `araraquara`, os quatro `ribeirao-preto*`, `sao-jose-do-rio-preto` e `sorocaba`.
- O dado dessas cidades não está no git (seção 1.3).
- Os JSON continuam enumerados por `rodar_qa.py --todas`.

## 5. `three.min.js` e `earcut.min.js`

| | `three.min.js` | `earcut.min.js` |
|---|---|---|
| Blob | `b6a31178…`, 678.588 bytes | `79cf67e1…`, 7.131 bytes |
| Cópias no `HEAD` | 4, idênticas | 4, idênticas |
| Onde | `renderizador/lib/` e `v1.5/renderizador-{v16-moveis,v17,v18}/lib/` | idem |
| Versão | **r168**: `REVISION "168"` no próprio arquivo | não registrada: UMD minificado, sem cabeçalho |
| Como foi feito | empacotado aqui como IIFE com `esbuild --format=iife --global-name=THREE` (`PIPELINE.md` §4.4), porque o three não publica UMD depois do r150. A versão exata do pacote npm e o comando completo não estão registrados | não registrado |
| No `package.json` | não (nem na raiz nem no painel) | não |
| Aviso de licença | **nenhum** | **nenhum** |
| Licença do projeto de origem | MIT (three.js) | ISC (Mapbox) |

**Onde mais estão embutidos.** O three vai byte a byte para dentro de toda página montada:

- `montar.py:84`, para o mapa;
- `pagina_maquete.py`, para os imóveis;
- o template `padrao-atual/anterior/v2.html`, que é entrada do build do Cedros.

Com isso ele aparece também em `v1.5/miniaturas/maquete.html`, nos dois `maquete-*.html` e em
`experimentos/mirante-7-2026-09-22/miniatura.html`. **As páginas publicadas levam o three e o
earcut sem o aviso de copyright e permissão, que as duas licenças pedem que acompanhe as cópias.**

**Quem carrega as cópias**

- `pipeline/montar.py` lê da fonte da variante.
- `pipeline/build/manifest.py` põe os dois no manifesto.
- `pipeline/extrair_renderizador.py`.
- `pagina_maquete.py:27`, a partir de `v16-moveis/lib`.
- 32 testes Node, via `vm`: todos de `v1.5/renderizador-v16-moveis/lib/`.
- Os scripts de `modelos_urbanos/` e `modelos_cadastrados/`, também de `v16-moveis/lib`.
- `padrao/qa.py` pula `lib/` de propósito.
- O aceite da modularização já registrava que as 2 únicas duplicatas textuais de código eram essas
  duas bibliotecas (`tasks/modularizacao/aceite-final.md`).

**Consequência para a limpeza:**

- A cópia de que o resto depende é a do v16-moveis.
- As do v17 e do v18 só servem aos demos.
- A de `renderizador/` serve à variante v15.
- Atualizar o three hoje é refazer o bundle à mão e copiar em 4 pastas e no template do Cedros.

## 6. Licença

Esta seção descreve a situação. Não é parecer jurídico.

### 6.1 Do projeto

- **Não há** `LICENSE`, `COPYING` nem `NOTICE` em lugar nenhum do repositório (`git ls-files`).
- A API do GitHub devolve `"license": null` para um repositório **público**.
- O `package.json` da raiz declara `"license": "ISC"`, junto com `"author": ""` e
  `"description": ""`, que são os valores padrão do `npm init`. A declaração contradiz a ausência
  de arquivo de licença.
- `painel/package.json` tem `"private": true` e nenhuma licença.

### 6.2 Código e mídia de terceiros no repositório

| O quê | Onde | Licença de origem | Aviso no repositório |
|---|---|---|---|
| three.js r168 | 4 cópias, mais as páginas montadas | MIT | nenhum |
| earcut | 4 cópias, mais as páginas montadas | ISC | nenhum |
| texturas de fachada (`Bricks023`, `Concrete016`, `Plaster001`) | `texturas/*.webp` | CC0 (ambientCG) | documentada em `pipeline/baixa_texturas.py` |
| texturas do Cedros | `…/piloto-v3/textures/*.png` | `PADRAO-ATUAL.md` diz que madeira, tecido e reboco são procedurais | sem origem externa registrada |
| móveis e árvores | `moveis/moveis_lib.json`, `arvores/arvores_lib.json` | gerados por script dentro do Blender (`moveis/export_moveis.py`, `arvores/export_arvores.py`) | — |
| **imagens de divulgação da iPlano/Grupo Plano** | `experimentos/mirante-7-2026-09-22/`: `fotos/01–05.jpg`, `fotos-iplano/*.jpg` e `contato.jpg`, que é a folha de contato das mesmas imagens (renders de ambiente e plantas de venda) | de terceiro, sem licença | a origem está em `ESTUDO.md`; não há autorização registrada |

### 6.3 Dados versionados ou publicados

| Fonte | O que está no git | Licença ou termo | Crédito nas páginas |
|---|---|---|---|
| OpenStreetMap (vias, POIs, alturas, tags de prédio) | derivados em `sao-carlos/` (`street_tris`, `poidata_merged`, `sao-carlos-v7.city.json`…) | ODbL | **o mapa mostra "© OpenStreetMap"** com link (`corpo.html` do v15 e do v16-moveis). A página por imóvel não tem crédito nenhum; não foi conferido aqui se ela carrega dado derivado de OSM ou Overture |
| Overture Maps (footprints) | derivado na base da cidade | não registrado no repositório (o tema de edificações é distribuído sob ODbL; conferir na release usada) | nenhum além do OSM |
| SigaSC, Prefeitura de São Carlos (quadras, loteamentos, endereços) | `lotes_saocarlos*.geojson` (97,75 MB) e `sao-carlos/dados/*` | nenhum termo registrado; extração pelo render do MapServer, com WFS e WMS trancados | nenhum |
| OpenPlots (plantas de loteamento) | lotes oficiais georreferenciados, dentro dos `.geojson` de lotes | nenhum termo registrado | nenhum |
| IBGE CNEFE (endereços) | entra na ocupação; o bruto não está versionado | dado público; nenhum termo registrado | nenhum |
| Sentinel-2 via Element84 (NDVI) | `sao-carlos/dados/vegetacao_ndvi.json` (0,33 MB) | termos Copernicus: não registrados no repositório | só em comentário do `app.js` |
| open-elevation (relevo) | `sao-carlos/relevo_wide.json` | não registrado | nenhum |
| **Imóveis de clientes** | `plantas_fornecidas/<id>/unidade.json` (5 unidades reais e um exemplo), os modelos `v1.5/miniaturas/*_blender/` e as páginas `maquete-*.html` | não é licença de software: é autorização do dono do dado | não se aplica |

### 6.4 Em aberto para o PR de licença e terceiros

1. Que licença o próprio código terá. Hoje não há nenhuma, e o `package.json` diz ISC.
2. Como e onde os avisos do three.js e do earcut vão acompanhar as cópias e as páginas publicadas.
3. Que crédito de dados as páginas por imóvel e o mapa precisam além do "© OpenStreetMap".
4. Se as imagens da iPlano e os dados de imóveis de clientes podem ficar num repositório público.

## 7. O que cada limpeza futura precisa respeitar

Isto não é proposta de solução: é o que o levantamento mostrou que **quebra** se a cirurgia não
levar em conta.

- **Artefatos grandes**
  - Os dois `.geojson`, os `geometry-compact`/`lightmap` do Cedros, os tiles `.bin` e o template
    `v2.html` são entradas de build com sha256 no manifesto publicado.
  - `tests/test_build_imovel.py` exige que as fontes do Cedros estejam no manifesto, e
    `tests/test_publicar.py` usa `v16-moveis/publicado`.
  - Os 66,9 MB de intermediários do bake não têm leitor fora dos scripts do Blender.
- **Histórico**
  - 99,95% do peso do `.git` local está numa tag que não existe no remoto. O remoto tem 83,7 MB.
  - Reescrever o histórico do `main` não é necessário para o tamanho do clone; tratar só a tag local
    é outra decisão.
- **Scripts**
  - Os 7 `testa_*` vivos são portões com o caminho escrito em `padrao/comportamento.py`, e
    `testa_duplo_clique` é importado por um teste de CI.
  - Os invocadores de `plantas_pipeline/` e `baixar_openplots.py` são exigidos por
    `tests/test_pipeline_paths.py`.
  - Os 5 `_*.py` não têm dependente.
- **Renderizadores**
  - A v15 é o padrão de `BuildConfig` e o único alvo do portão "cidade fora do código".
  - O v16-moveis é tudo o que está no ar.
  - O v17 e o v18 servem só aos dois demos.
  - As sondas de comportamento acham a página pela pasta da versão, não pelo `--destino`.
