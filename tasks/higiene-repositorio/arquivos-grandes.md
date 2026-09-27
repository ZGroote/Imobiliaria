# Arquivos grandes — inventário, dependências e decisões (27/09/2026)

**Histórico deste documento:**

- **#36:** ele nasceu como inventário, sem remover nada. Trouxe o inventário, a prova de
  regenerabilidade dos candidatos a descarte e a trava de tamanho no CI. As decisões foram tomadas
  arquivo por arquivo, depois dele.
- **#37:** ele foi atualizado com as três saídas aprovadas, que somam 42,08 MiB:
  - saíram os dois `uv.json` e o `source-before-normal-repair.json`;
  - o ambiente de regeneração passou a ser o `requirements-bake.txt` (`numpy==2.4.6`,
    `xatlas==0.0.11`);
  - o `repair-bake-normals.py` deixou de recriar o backup.
- **#38:** as duas fontes premium ganharam um destino privado comprovado, no repositório
  `ZGroote/imobiliaria-artefatos`, com manifesto, downloader e testes.
- **#39:** os dois `source.json` premium saíram do `HEAD` (24,83 MiB), depois da recuperação provada
  ponta a ponta num clone limpo. Eles agora **moram operacionalmente no repositório privado** e
  voltam pelo `tools/baixar_artefatos.py`. Os dois caminhos estão no `.gitignore`.

**Estado depois do #39:** o `HEAD` tem 987 arquivos e 213,5 MiB, e 22 arquivos acima de 1 MiB
somam 174,0 MiB. As linhas dos cinco arquivos que saíram continuam no inventário como registro,
marcadas "saiu", e as provas estão nas seções do fim deste documento.

**Regras deste ciclo:**

- Nada de LFS nem de `filter-repo`.
- Os `.geojson` e os `.bin` não se apagam.
- As fontes do padrão leve e as do premium são ativos do produto, e não legado.
- Um `source.json` do premium só sai do git depois que houver um destino privado comprovado.

**Base medida:** `main` `e0ff688`. O `HEAD` tem 986 arquivos e 280,3 MiB, dos quais **27 arquivos estão acima de 1 MiB e somam 240,9 MiB**.

## Classes

| Classe | O que é | Pode sair do git? |
|---|---|---|
| **E: entra no build ou é publicação** | lido pelo build por imóvel e com sha256 no manifest, ou página servida por um site | não, enquanto o build ler do checkout |
| **F: fonte necessária para reproduzir** | sem gerador no repositório, ou com um gerador cujas entradas não estão no git | só com destino privado comprovado |
| **I: intermediário** | gerado a partir de algo que está no git, ou redundante | sim, depois de provar que se regenera ou que não faz falta |

## Inventário

"No build" foi medido pelo `entradas(config)` do piloto e pelo `fontes_da_maquete` de cada imóvel do piloto (`pipeline/build_imovel.py`), e não por inspeção.

| MiB | Arquivo | Classe | Quem gera | Quem lê | No build | Regenera a partir do git? |
|---:|---|---|---|---|---|---|
| 62,33 | `sao-carlos/dados/lotes_saocarlos_completo.geojson` | E | `pipeline/juntar_lotes.py` (etapa 4) | etapas 5, 6, 6b e 7 | todo imóvel | não: as entradas (lote de planta, sintético, miolo) não estão no git |
| 35,43 | `lotes_saocarlos.geojson` | E | nenhum gerador no repositório | só como fallback: `consolidar.py` com `FALLBACK=1`; `encaixar_casas_lotes.py` se o completo não existir | todo imóvel | não |
| 22,06 | `…/piloto-v3/source-before-normal-repair.json` | **I, saiu em 27/09** | backup escrito pelo `repair-bake-normals.py` | o próprio `repair-bake-normals.py`, quando roda de novo | não | não, mas não faz falta (prova abaixo) |
| 22,03 | `…/piloto-v3/source.json` | **F, premium; saiu em 27/09 (#39)**, mora no repositório privado | exportado do visualizador; depois recebe os três reparos | `unwrap-v3.py`, `bake-v3.py`, `repair-*` | não | não |
| 15,03 | `…/exterior-v3/geometry-compact.json` | E | `unwrap-exterior.py` | a página do Cedros | Cedros | **sim, provado** |
| 14,20 | `…/exterior-v3/uv.json` | **I, saiu em 27/09** | `unwrap-exterior.py` | `bake-exterior.py` | não | **sim, provado** |
| 6,71 | `…/exterior-v3/lightmap.rgbm.gz` | E | bake (Cycles), denoise e `encode_lightmaps.py` | a página do Cedros | Cedros | não testado: bake em GPU |
| 6,38 | `…/piloto-v3/geometry-compact.json` | E | `unwrap-v3.py` | a página do Cedros | Cedros | **sim, provado** |
| 6,08 | `…/piloto-v3/lightmap.rgbm.gz` | E | bake, denoise e encode | a página do Cedros | Cedros | não testado |
| 5,83 | `…/piloto-v3/uv.json` | **I, saiu em 27/09** | `unwrap-v3.py` | `bake-v3.py` | não | **sim, provado** |
| 4,91 | `sao-carlos/sao-carlos-v7.city.json` | E | `pipeline/city_final.py` (etapa 7) | a montagem | todo imóvel | não: `city_base` não está no git |
| 4,90 | `modelos_urbanos/v1/mapa-casas.json` | E | `modelos_urbanos/v1/compilar_mapa.mjs` | a montagem e `exteriores/v1/*` | todo imóvel | não verificado |
| 4,08 | `sao-carlos/dados/street_tris.json` | E | `pipeline/ruas.py` (etapa 7b) | a montagem | todo imóvel | não: as quadras não estão no git |
| 3,82 | `v1.5/miniaturas/maquete-wish-castanheiras-58.html` | E, publicação | `pagina_maquete.py`, numa versão antiga | `preparar_publicacao.py` (site das miniaturas) | não | não testado: o gerador mudou depois |
| 3,42 | `sao-carlos/dados/muros_segs.json` | E | `pipeline/muros.py` (etapa 6) | a montagem | todo imóvel | não |
| 3,22 | `…/padrao-atual/anterior/v2.html` | E | template aprovado; sem gerador | a página do Cedros | Cedros | não |
| 3,16 | `v1.5/miniaturas/maquete-monte-das-colinas-39.html` | E, publicação | `pagina_maquete.py`, numa versão antiga | `preparar_publicacao.py` | não | não testado: o gerador mudou depois |
| 2,88 | `exteriores/v1/mapa-exteriores.json` | E | `exteriores/v1/gerar.py` (no Blender) | a montagem e `exteriores/v1/*` | todo imóvel | não testado |
| 2,81 | `…/exterior-v3/source.json` | **F, premium; saiu em 27/09 (#39)**, mora no repositório privado | exportado do visualizador | `unwrap-exterior.py`, `bake-exterior.py` | não | não |
| 1,93 | `v1.5/miniaturas/castanheiras_blender/modelo.json` | E | `modelar_castanheiras.py` (Blender) | a página da Castanheiras | Castanheiras | não testado |
| 1,85 | `modelos_urbanos/v1/integracao/encaixes-sao-carlos.json` | I, cache | `pipeline/encaixar_casas_lotes.py`, durante a montagem | `exteriores/v1/*`, a montagem | não | sim, pela montagem, mas é caro de recalcular (a montagem valida o cache) |
| 1,71 | `exteriores/v1/componentes.json` | E | `exteriores/v1/componentes.py` | a montagem e `exteriores/v1/*` | todo imóvel | não testado |
| 1,34 | `v1.5/miniaturas/monte-dos-cedros_blender/modelo.json` | F, leve | `modelar_montes.py` (Blender) | `pagina_maquete.py` (`MODELOS_BLENDER`); o build do Cedros usa o premium | não | não testado |
| 1,33 | `v1.5/miniaturas/monte-das-colinas_blender/modelo.json` | E | `modelar_montes.py` (Blender) | a página das Colinas | Colinas | não testado |
| 1,26 | `arvores/arvores_lib.json` | E | `arvores/export_arvores.py` (Blender) | a montagem | todo imóvel | não testado |
| 1,13 | `sao-carlos/dados/portoes.json` | E | `pipeline/portoes.py` (etapa 6b) | a montagem | todo imóvel | não |
| 1,10 | `v1.5/miniaturas/castanheiras_blender/castanheiras.blend` | F, leve | `modelar_castanheiras.py` | quem edita o modelo | não | não testado |
| 15,90 (239) | `v16-moveis/publicado/mapa/quintais/d9ef5bf4b34f/*.bin` | E | `exteriores/v1/dividir_terrenos.py` | o site do mapa; `publicar_imovel.py` e `preparar_piloto.py` copiam para o build por imóvel | o prefixo vai no manifest, e cada arquivo vai para o `estado.json` na publicação | não testado |

## Provas de regenerabilidade

As provas foram feitas numa cópia isolada no scratchpad, fora do repositório. Nenhum arquivo versionado foi reescrito.

**Ferramentas:** Python 3.14.4, `numpy` 2.4.6, `xatlas` 0.0.11 e Blender 5.2.2 LTS, no Windows.

### `uv.json`, do piloto e do exterior: regenerável

Rodei `unwrap-v3.py` e `unwrap-exterior.py` sobre os `source.json` versionados. Os dois scripts são Python com `xatlas`, sem Blender, e levam 2 s e 9 s.

| Arquivo regerado | sha256, versionado e regerado |
|---|---|
| `piloto-v3/uv.json` | `dccdc34a7718e03c…` = `dccdc34a7718e03c…` |
| `piloto-v3/geometry-compact.json` | `1dae995adcdb6657…` = `1dae995adcdb6657…` |
| `exterior-v3/uv.json` | `59d6c208cea6a916…` = `59d6c208cea6a916…` |
| `exterior-v3/geometry-compact.json` | `e357b5c63f493bba…` = `e357b5c63f493bba…` |

O mesmo script escreve o `uv.json` e o `geometry-compact.json`, que é entrada do build. Então regerar o `uv.json` com a mesma versão do `xatlas` reproduz também a geometria publicada. Com outra versão, os dois podem mudar juntos.

O `unwrap.json`, que o script também escreve, guarda o tempo da execução e muda a cada rodada. Ele é pequeno e não entra nesta conta.

O `xatlas` não estava registrado em nenhum `requirements`. No #37 ele entrou no `requirements-bake.txt`, com a versão exata, junto com o `numpy`.

### `source-before-normal-repair.json`: não se regenera, e não faz falta

Ele é o `source.json` de antes dos reparos, o export original, e não tem gerador. Três testes, com o Blender em `-b`:

| Teste | Resultado |
|---|---|
| (a) reparo de normais aplicado ao `source.json` **atual**, sem backup | saída = o `source.json` versionado (`36e683fd164bc666…`): **idempotente** |
| (b) reparo de normais a partir do **backup** | `bcc6e794…`, diferente do atual. As contagens batem com o `normal-repair.json` (18.285 triângulos reorientados e 403 correções coplanares) |
| (c) backup → reparo de normais → batentes (`repair-jamb-v3.py`) → molduras (`repair-trim-v3.py`) | = o `source.json` versionado, nas duas ordens dos dois últimos passos |

O que isso quer dizer:

- O estado atual se reproduz a partir do backup. Mas o atual já basta, porque é ele que o unwrap e o bake leem, e o reparo sobre ele não muda nada.
- **O backup ainda é um risco.** Enquanto ele existe, rodar só o `repair-bake-normals.py` desfaz, sem aviso, os reparos de batentes e molduras (teste b).
- O que se perde ao tirá-lo é o export original, que só faria falta para refazer os três reparos com outro algoritmo. Ele continua no histórico do git.

## Decisões

Foram tomadas arquivo por arquivo depois do #36. As três primeiras linhas foram feitas no #37.

| Arquivo | Decisão | Condição |
|---|---|---|
| `piloto-v3/uv.json`, `exterior-v3/uv.json` (20 MiB) | **saíram do `HEAD`** (#37) | `requirements-bake.txt` com `numpy==2.4.6` e `xatlas==0.0.11`, numa venv própria; `DEPENDENCIAS.md` e `PADRAO-ATUAL.md` dizem como recalcular a luz |
| `piloto-v3/source-before-normal-repair.json` (22 MiB) | **saiu do `HEAD`** (#37), sem ir para armazenamento privado | o `repair-bake-normals.py` deixou de criar e de ler esse backup |
| `piloto-v3/source.json`, `exterior-v3/source.json` (24,8 MiB) | **saíram do `HEAD`** (#39), depois do destino privado comprovado (#38) e da recuperação provada num clone limpo | moram no repositório privado; voltam pelo `tools/baixar_artefatos.py`; os caminhos estão no `.gitignore`. Ver "Destino privado" abaixo |
| `lotes_saocarlos.geojson` (35 MiB) | **fica**, porque os GeoJSON não se apagam neste ciclo | é candidato a sair das entradas do build, porque em São Carlos só é lido como fallback. Isso muda o `fontes` do manifest e é decisão própria |
| `lotes_saocarlos_completo.geojson` e os `.bin` | **ficam** | entram no build e na publicação |
| os outros arquivos de classe E | **ficam** | o build lê do checkout |
| `castanheiras.blend`, `monte-dos-cedros_blender/modelo.json` (padrão leve) | **ficam** | são ativos do produto |
| `encaixes-sao-carlos.json` | **fica** | é cache caro de refazer |
| `maquete-*.html` (site das miniaturas) | **ficam** | o site das miniaturas publica a partir deles |

As três primeiras linhas tiraram 42,08 MiB do `HEAD` (#37).

## Destino privado: o que conta como "comprovado"

O critério foi escrito no #36:

1. **Onde:** um armazenamento privado com dono definido, por exemplo um bucket do Storage com regra fechada ou um repositório de artefatos privado. Não pode ser o Hosting público nem o repositório.
2. **Prova de ida e volta:** subir o arquivo, baixar de outra máquina ou de outro diretório e conferir o sha256 igual ao versionado.
3. **Acesso:** mostrar que uma conta sem permissão recebe negado.
4. **Registro:** um manifesto no repositório com caminho, sha256, tamanho e data de cada arquivo. O script que precisa do arquivo o baixa e confere o sha256 antes de usar.
5. Só então o arquivo sai do `HEAD`, e a linha dele sai da trava, no mesmo PR.

### O destino escolhido e as provas (27/09/2026)

**O destino** é o repositório GitHub **privado** `ZGroote/imobiliaria-artefatos`.

- Ele é separado do `ZGroote/Imobiliaria` de propósito. Isso desacopla da visibilidade do repositório principal **as cópias operacionais daqui em diante**, e nada além disso.
- **O repositório principal tem de continuar privado.** Os dois `source.json` estão no histórico do git do `ZGroote/Imobiliaria`, e tirá-los do `HEAD` não apaga os blobs antigos.
  - Qualquer volta a público exige, antes, um ciclo separado de sanitização e revisão do histórico, planejado e provado.
  - Nada de `filter-repo` neste ciclo.
- O git dele só tem um README. As fontes são **assets** da release `premium-sources-2026-09-27`.
- O Storage do Firebase ficou de fora: exigiria o plano Blaze, com cobrança, regras e deploy, e o projeto está sem cobrança.

| Asset | Destino no repositório principal | Bytes | SHA-256 |
|---|---|---:|---|
| `monte-dos-cedros-37-premium-interior-source.json` | `v1.5/miniaturas/padrao-atual/piloto-v3/source.json` | 23.094.984 | `36e683fd164bc666…` |
| `monte-dos-cedros-37-premium-exterior-source.json` | `v1.5/miniaturas/padrao-atual/exterior-v3/source.json` | 2.943.459 | `3c7a8194bd2f713c…` |

**As provas:**

1. **Upload.** Os assets foram copiados dos blobs exatos de `main` `2c1283d`, e não da cópia em disco. O digest que o GitHub calculou para cada um bate com o SHA-256 acima.
2. **Ida e volta.** `gh release download` para outro diretório: os dois arquivos são idênticos byte a byte ao blob versionado (sha256 e `cmp`).
3. **Acesso negado.** Sem credencial, todas as chamadas respondem **404**: o repositório, a lista de releases, a release pela tag, o asset pela API (`application/octet-stream`) e o link de download. O controle foi o mesmo `curl` anônimo num repositório público, que respondeu 200. Com o `gh` autenticado de quem tem acesso, os mesmos recursos respondem.
4. **Registro.** O manifesto é o `tools/artefatos-privados.json`, com repositório, release, asset, destino, bytes, sha256, data e origem. **O sha256 do manifesto é a autoridade;** o digest do GitHub é só uma conferência a mais.
   - O downloader é o `tools/baixar_artefatos.py`. Ele baixa numa pasta temporária, confere tamanho e sha256, e só então põe o arquivo no lugar.
   - Arquivo que não bate é apagado, e o destino não recebe nada.
   - Arquivo local diferente do manifesto não é sobrescrito.
   - Os testes são `tests/test_artefatos_privados.py`, sem rede. O teste de mutação (tirar a conferência) reprova.

**A recuperação ponta a ponta foi provada** antes da retirada, sem mexer na release nem no manifesto:

1. clone novo do GitHub em `main` `23f2c6e`;
2. os dois `source.json` apagados sem commit, e a ausência confirmada;
3. `python tools/baixar_artefatos.py` respondeu "baixado" para os dois. Tamanho e sha256 bateram com o manifesto, e os bytes com os blobs originais (`5e05a99a…` e `9dac0115…`);
4. `--conferir` passou;
5. uma segunda rodada respondeu "já estava", sem baixar: os arquivos mantiveram o horário de modificação, e nenhuma pasta temporária foi criada. O contador de downloads do GitHub não foi usado como evidência, porque conta a menos.

**Desde o #39, os dois `source.json` não estão mais no `HEAD`.** Eles moram no repositório privado, e os caminhos estão no `.gitignore`. Como os blobs antigos continuam no histórico, o repositório principal continua obrigatoriamente privado (acima).

**Como recuperar:** com o `gh` autenticado por quem tem leitura em `ZGroote/imobiliaria-artefatos`, na raiz do repositório:

```bash
python tools/baixar_artefatos.py
```

Para só conferir o que está no disco, sem rede: `python tools/baixar_artefatos.py --conferir`.

## Trava de tamanho no CI

`tests/test_tamanho_versionado.py` roda no CI pelo `npm run test:py`. Ele reprova quando:

- um arquivo versionado acima de **1 MiB** não está na lista `GRANDES`;
- um arquivo da lista **cresce além do teto** dele, que é o tamanho de hoje arredondado para cima até o MiB inteiro;
- o repositório inteiro passa de **300 MiB** (eram 280,3 na base; 238,3 depois do #37 e 213,5 depois do #39);
- algum arquivo passa de 100 MiB, o limite duro do GitHub;
- uma entrada da lista não existe mais, ou deixou de estar acima de 1 MiB. A lista é o inventário exato, então quando um arquivo sai ou encolhe, a linha dele sai da lista e do inventário no mesmo PR.

O tamanho medido é o do blob no índice do git, e não o do disco, porque no Windows o fim de linha muda o tamanho. A trava foi conferida por mutação, com cada caso revertido depois:

| Mutação | Resultado |
|---|---|
| arquivo novo de 2 MiB | reprova |
| `portoes.json` com 1 MiB a mais | reprova |
| `piloto-v3/uv.json` fora do índice | reprova |
| `arvores_lib.json` encolhido para 500 KB | reprova |

## Prova depois das saídas (27/09/2026)

A prova rodou sobre o commit `d4180f6`, extraído com `git archive`. Esse commit já não tem os três
arquivos.

**O ambiente** é uma venv limpa, criada só com o `requirements-bake.txt` do commit. `pip freeze`
mostra exatamente `numpy==2.4.6` e `xatlas==0.0.11`, com Python 3.14.4.

**O unwrap.** Os dois scripts rodaram na árvore extraída, sem nenhum `uv.json` presente:

| Arquivo | Resultado |
|---|---|
| `piloto-v3/uv.json` | regerado = blob removido `3c1ca56a…` (sha256 `dccdc34a7718e03c…`): **idêntico byte a byte** |
| `exterior-v3/uv.json` | regerado = blob removido `d1751603…` (sha256 `59d6c208cea6a916…`): **idêntico byte a byte** |
| `piloto-v3/geometry-compact.json` | não mudou (`1dae995adcdb6657…`) |
| `exterior-v3/geometry-compact.json` | não mudou (`e357b5c63f493bba…`) |

Os atlas saíram com 2943 × 2948 e 6275 × 6273, as mesmas dimensões do `unwrap.json` versionado.

**O `repair-bake-normals.py` novo,** no Blender 5.2.2 LTS:

| Caso | Resultado |
|---|---|
| (i) sem backup | o `source.json` fica igual ao versionado (`36e683fd164bc666…`), e **nenhum backup é criado** |
| (ii) com o backup antigo plantado na pasta (blob `afcdedf4…`) | o `source.json` fica igual ao versionado. O script ignora o backup; o antigo, nesse caso, gerava `bcc6e794…` e desfazia os reparos de batentes e molduras |

O reparo, quando roda, reescreve o `normal-repair.json` com as contagens daquela rodada (383
triângulos), sem mudar o `source.json`.
