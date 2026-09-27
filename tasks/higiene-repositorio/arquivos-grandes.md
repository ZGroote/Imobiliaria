# Arquivos grandes — inventário, dependências e decisões (27/09/2026)

Este PR não remove nada. Ele traz três coisas:

- o inventário dos arquivos grandes;
- a prova de regenerabilidade dos candidatos a descarte;
- a trava de tamanho no CI.

A decisão de cada arquivo é **proposta** aqui e tomada arquivo por arquivo, antes de qualquer remoção.

**Regras deste ciclo:**

- Nada de LFS nem de `filter-repo`.
- Os `.geojson` e os `.bin` não se apagam.
- As fontes do padrão leve e as do premium são ativos do produto, e não legado.
- Um `source.json` do premium só sai do git depois que houver um destino privado comprovado.

**Base medida:** `main` `e0ff688`. O `HEAD` tem 986 arquivos e 280,3 MiB, dos quais **27 arquivos têm 1 MiB ou mais e somam 240,9 MiB**.

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
| 22,06 | `…/piloto-v3/source-before-normal-repair.json` | **I** | backup escrito pelo `repair-bake-normals.py` | o próprio `repair-bake-normals.py`, quando roda de novo | não | não, mas não faz falta (prova abaixo) |
| 22,03 | `…/piloto-v3/source.json` | **F, premium** | exportado do visualizador; depois recebe os três reparos | `unwrap-v3.py`, `bake-v3.py`, `repair-*` | não | não |
| 15,03 | `…/exterior-v3/geometry-compact.json` | E | `unwrap-exterior.py` | a página do Cedros | Cedros | **sim, provado** |
| 14,20 | `…/exterior-v3/uv.json` | **I** | `unwrap-exterior.py` | `bake-exterior.py` | não | **sim, provado** |
| 6,71 | `…/exterior-v3/lightmap.rgbm.gz` | E | bake (Cycles), denoise e `encode_lightmaps.py` | a página do Cedros | Cedros | não testado: bake em GPU |
| 6,38 | `…/piloto-v3/geometry-compact.json` | E | `unwrap-v3.py` | a página do Cedros | Cedros | **sim, provado** |
| 6,08 | `…/piloto-v3/lightmap.rgbm.gz` | E | bake, denoise e encode | a página do Cedros | Cedros | não testado |
| 5,83 | `…/piloto-v3/uv.json` | **I** | `unwrap-v3.py` | `bake-v3.py` | não | **sim, provado** |
| 4,91 | `sao-carlos/sao-carlos-v7.city.json` | E | `pipeline/city_final.py` (etapa 7) | a montagem | todo imóvel | não: `city_base` não está no git |
| 4,90 | `modelos_urbanos/v1/mapa-casas.json` | E | `modelos_urbanos/v1/compilar_mapa.mjs` | a montagem e `exteriores/v1/*` | todo imóvel | não verificado |
| 4,08 | `sao-carlos/dados/street_tris.json` | E | `pipeline/ruas.py` (etapa 7b) | a montagem | todo imóvel | não: as quadras não estão no git |
| 3,82 | `v1.5/miniaturas/maquete-wish-castanheiras-58.html` | E, publicação | `pagina_maquete.py`, numa versão antiga | `preparar_publicacao.py` (site das miniaturas) | não | não testado: o gerador mudou depois |
| 3,42 | `sao-carlos/dados/muros_segs.json` | E | `pipeline/muros.py` (etapa 6) | a montagem | todo imóvel | não |
| 3,22 | `…/padrao-atual/anterior/v2.html` | E | template aprovado; sem gerador | a página do Cedros | Cedros | não |
| 3,16 | `v1.5/miniaturas/maquete-monte-das-colinas-39.html` | E, publicação | `pagina_maquete.py`, numa versão antiga | `preparar_publicacao.py` | não | não testado: o gerador mudou depois |
| 2,88 | `exteriores/v1/mapa-exteriores.json` | E | `exteriores/v1/gerar.py` (no Blender) | a montagem e `exteriores/v1/*` | todo imóvel | não testado |
| 2,81 | `…/exterior-v3/source.json` | **F, premium** | exportado do visualizador | `unwrap-exterior.py`, `bake-exterior.py` | não | não |
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

**O `xatlas` não está registrado em nenhum `requirements` nem no `DEPENDENCIAS.md`.** Registrar a versão 0.0.11 é condição para o `uv.json` sair do git.

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

## Decisões propostas (para aprovar arquivo por arquivo)

| Arquivo | Proposta | Condição |
|---|---|---|
| `piloto-v3/uv.json`, `exterior-v3/uv.json` (20 MiB) | **sair do `HEAD`** | registrar `xatlas==0.0.11` em `requirements-fontes.txt` e no `DEPENDENCIAS.md`; anotar no padrão atual que o bake começa pelo unwrap |
| `piloto-v3/source-before-normal-repair.json` (22 MiB) | **sair do `HEAD`** | nenhuma, além da sua decisão: ele não se regenera, mas o reproduzível é o atual. Se quiser guardar o export original, ele vai para o destino privado junto com os `source.json` |
| `piloto-v3/source.json`, `exterior-v3/source.json` (24,8 MiB) | **ficam**, até haver destino privado comprovado | ver "Destino privado" abaixo |
| `lotes_saocarlos.geojson` (35 MiB) | **fica agora**, porque os GeoJSON não se apagam neste ciclo | é candidato a sair das entradas do build, porque em São Carlos só é lido como fallback. Isso muda o `fontes` do manifest e é decisão própria |
| `lotes_saocarlos_completo.geojson` e os `.bin` | **ficam** | entram no build e na publicação |
| os outros arquivos de classe E | **ficam** | o build lê do checkout |
| `castanheiras.blend`, `monte-dos-cedros_blender/modelo.json` (padrão leve) | **ficam** | são ativos do produto |
| `encaixes-sao-carlos.json` | **fica** | é cache caro de refazer |
| `maquete-*.html` (site das miniaturas) | **ficam** | o site das miniaturas publica a partir deles |

Se as três primeiras linhas forem aprovadas, o `HEAD` perde 42 MiB.

## Destino privado: o que conta como "comprovado"

Nada disto foi feito ainda. Serve de critério para quando o `source.json` for sair do git:

1. **Onde:** um armazenamento privado com dono definido, por exemplo um bucket do Storage com regra fechada ou um repositório de artefatos privado. Não pode ser o Hosting público nem o repositório.
2. **Prova de ida e volta:** subir o arquivo, baixar de outra máquina ou de outro diretório e conferir o sha256 igual ao versionado.
3. **Acesso:** mostrar que uma conta sem permissão recebe negado.
4. **Registro:** um manifesto no repositório com caminho, sha256, tamanho e data de cada arquivo. O script que precisa do arquivo o baixa e confere o sha256 antes de usar.
5. Só então o arquivo sai do `HEAD`, e a linha dele sai da trava, no mesmo PR.

## Trava de tamanho no CI

`tests/test_tamanho_versionado.py` roda no CI pelo `npm run test:py`. Ele reprova quando:

- um arquivo versionado acima de **1 MiB** não está na lista `GRANDES`;
- um arquivo da lista **cresce além do teto** dele, que é o tamanho de hoje arredondado para cima até o MiB inteiro;
- o repositório inteiro passa de **300 MiB** (hoje são 280,3);
- algum arquivo passa de 100 MiB, o limite duro do GitHub;
- uma entrada da lista não existe mais. A lista é o inventário, então quando um arquivo sai, a linha dele sai no mesmo PR.

O tamanho medido é o do blob no índice do git, e não o do disco, porque no Windows o fim de linha muda o tamanho. A trava foi conferida por mutação, com cada caso revertido depois:

| Mutação | Resultado |
|---|---|
| arquivo novo de 2 MiB | reprova |
| `portoes.json` com 1 MiB a mais | reprova |
| `piloto-v3/uv.json` fora do índice | reprova |
